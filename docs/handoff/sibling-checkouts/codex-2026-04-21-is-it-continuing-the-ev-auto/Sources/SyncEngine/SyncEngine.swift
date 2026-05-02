import AppModels
import Foundation
import Persistence
import SeedData
import Support

public protocol SourceAdapter: Sendable {
    var sourceID: String { get }
    var displayName: String { get }
    func fetchSnapshots() async throws -> [RawVehicleSnapshot]
}

private extension SampleData {
    static var liveSourceCanonicalVehicles: [CanonicalVehicle] {
        canonicalVehicles.filter {
            ($0.make == "Ford" && $0.model == "Mustang Mach-E") ||
            ($0.make == "Volkswagen" && $0.model == "ID.4")
        }
    }
}

public struct OEMInventoryAdapter: SourceAdapter {
    public let sourceID = "oem-inventory"
    public let displayName = "Ford Canada Inventory"

    private let session: URLSession
    private let vehiclePages: [FordInventoryPage]

    public init(session: URLSession = .shared) {
        self.session = session
        self.vehiclePages = FordInventoryPage.defaultPages
    }

    public func fetchSnapshots() async throws -> [RawVehicleSnapshot] {
        var snapshots: [RawVehicleSnapshot] = []
        var failures: [String] = []

        for page in vehiclePages {
            do {
                let (data, _) = try await session.data(from: page.url)
                let html = String(decoding: data, as: UTF8.self)
                if let snapshot = parseSnapshot(html: html, page: page) {
                    snapshots.append(snapshot)
                } else {
                    failures.append("Unable to parse \(page.url.absoluteString)")
                }
            } catch {
                failures.append("\(page.url.absoluteString): \(error.localizedDescription)")
            }
        }

        if snapshots.isEmpty {
            throw FordInventoryError.noSnapshots(failures)
        }

        if !failures.isEmpty {
            AppLogger.sync.error("Ford inventory parsed with partial failures: \(failures.joined(separator: " | "), privacy: .public)")
        }

        return snapshots
    }

    private func parseSnapshot(html: String, page: FordInventoryPage) -> RawVehicleSnapshot? {
        let normalized = html
            .replacingOccurrences(of: "\u{00a0}", with: " ")
            .replacingOccurrences(of: "&nbsp;", with: " ")

        guard
            let titleLine = firstMatch(in: normalized, pattern: #"<h1[^>]*>\s*([0-9]{4}\s+Mustang Mach-E.*?|[0-9]{4}\s+Ford Mustang Mach-E.*?)\s*</h1>"#),
            let title = stripHTML(titleLine),
            let year = extractYear(from: title),
            let vin = firstMatch(in: normalized, pattern: #"VIN:\s*([A-HJ-NPR-Z0-9]{17})"#)
                ?? firstMatch(in: normalized, pattern: #"\b([A-HJ-NPR-Z0-9]{17})\b"#),
            let package = fieldValue(in: normalized, label: "Package"),
            let dealerName = firstNonEmpty([
                firstMatch(in: normalized, pattern: #"<h2[^>]*>\s*Vehicle Location\s*</h2>\s*<[^>]+>\s*([^<]+?)\s*</"#),
                lineAfter(label: "Vehicle Location", in: normalized),
                page.fallbackDealerName
            ]),
            let address = firstNonEmpty([
                addressNearVIN(in: normalized),
                lineAfter(label: dealerName, in: normalized),
                page.fallbackAddress
            ]),
            let cityProvince = extractCityProvince(from: address)
        else {
            return nil
        }

        let trim = package
            .replacingOccurrences(of: #"\s*\([^)]+\)"#, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let status = firstNonEmpty([
            firstMatch(in: normalized, pattern: #"(In Stock|Just Arrived|Available Now)"#),
            page.fallbackAvailability
        ]) ?? "Available"
        let listedPrice = extractPrice(in: normalized)
        let msrp = listedPrice ?? inferredMSRP(for: trim, year: year)
        let confidence: ConfidenceLevel = listedPrice == nil ? .medium : .high
        let notes = [
            "Inventory status: \(status)",
            listedPrice == nil ? "Displayed price currently falls back to inferred MSRP because dealer-page HTML did not expose a live dealer price in this fetch." : nil
        ].compactMap { $0 }

        return RawVehicleSnapshot(
            sourceID: sourceID,
            externalListingID: vin,
            dealerName: dealerName,
            make: "Ford",
            model: "Mustang Mach-E",
            trim: trim,
            year: year,
            powertrain: .bev,
            msrpCAD: msrp,
            listingPriceCAD: listedPrice ?? msrp ?? 0,
            city: cityProvince.city,
            province: cityProvince.province,
            condition: .new,
            sourceURL: page.url.absoluteString,
            confidenceHint: confidence,
            matchedCanonicalVehicleID: nil,
            notes: notes
        )
    }

    private func fieldValue(in html: String, label: String) -> String? {
        let escaped = NSRegularExpression.escapedPattern(for: label)
        let pattern = "\(escaped)\\s*</[^>]+>\\s*<[^>]+>\\s*([^<]+?)\\s*</"
        return firstMatch(in: html, pattern: pattern).flatMap(stripHTML)
    }

    private func addressNearVIN(in html: String) -> String? {
        let pattern = #"VIN:\s*[A-HJ-NPR-Z0-9]{17}.*?<[^>]+>\s*([^<]+?)\s*</[^>]+>\s*<[^>]+>\s*([^<]+?)\s*</[^>]+>"#
        guard let groups = matchGroups(in: html, pattern: pattern), groups.count >= 3 else { return nil }
        return [stripHTML(groups[1]), stripHTML(groups[2])]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .joined(separator: " ")
    }

    private func lineAfter(label: String, in html: String) -> String? {
        guard let range = html.range(of: label) else { return nil }
        let tail = String(html[range.upperBound...])
        let lines = tail
            .components(separatedBy: .newlines)
            .map { stripHTML($0) ?? "" }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && $0 != label }
        return lines.first
    }

    private func extractCityProvince(from address: String) -> (city: String, province: String)? {
        let pattern = #".*?,\s*([^,]+),\s*([A-Z]{2}|[A-Za-z ]+)\s*[A-Z0-9]{0,7}$"#
        if let groups = matchGroups(in: address, pattern: pattern), groups.count >= 3 {
            return (
                city: groups[1].trimmingCharacters(in: .whitespacesAndNewlines),
                province: normalizeProvince(groups[2])
            )
        }

        let pieces = address.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        guard pieces.count >= 2 else { return nil }
        let provinceToken = pieces.last?.components(separatedBy: .whitespaces).first ?? ""
        return (city: pieces[pieces.count - 2], province: normalizeProvince(provinceToken))
    }

    private func normalizeProvince(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        switch trimmed.uppercased() {
        case "ON": return "Ontario"
        case "BC": return "British Columbia"
        case "AB": return "Alberta"
        case "QC": return "Quebec"
        default: return trimmed
        }
    }

    private func extractYear(from title: String) -> Int? {
        Int(title.prefix(4))
    }

    private func extractPrice(in html: String) -> Double? {
        let patterns = [
            #"\$([0-9]{2,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?)"#,
            #"([0-9]{2,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?)\s*CAD"#
        ]

        for pattern in patterns {
            if let match = firstMatch(in: html, pattern: pattern) {
                return Double(match.replacingOccurrences(of: ",", with: ""))
            }
        }

        return nil
    }

    private func inferredMSRP(for trim: String, year: Int) -> Double? {
        switch (year, trim.lowercased()) {
        case (2025, let trim) where trim.contains("select"):
            return 55995
        case (2025, let trim) where trim.contains("premium"):
            return 64995
        case (2025, let trim) where trim.contains("gt"):
            return 76995
        case (2026, let trim) where trim.contains("premium"):
            return 66995
        default:
            return nil
        }
    }

    private func firstNonEmpty(_ values: [String?]) -> String? {
        values
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first(where: { !$0.isEmpty })
    }

    private func firstMatch(in text: String, pattern: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive, .dotMatchesLineSeparators]) else {
            return nil
        }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let match = regex.firstMatch(in: text, options: [], range: range) else { return nil }
        let captureRange = match.numberOfRanges > 1 ? match.range(at: 1) : match.range(at: 0)
        guard let swiftRange = Range(captureRange, in: text) else { return nil }
        return String(text[swiftRange])
    }

    private func matchGroups(in text: String, pattern: String) -> [String]? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive, .dotMatchesLineSeparators]) else {
            return nil
        }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let match = regex.firstMatch(in: text, options: [], range: range) else { return nil }

        return (0..<match.numberOfRanges).compactMap { index in
            guard let swiftRange = Range(match.range(at: index), in: text) else { return nil }
            return String(text[swiftRange])
        }
    }

    private func stripHTML(_ value: String) -> String? {
        let withoutTags = value.replacingOccurrences(of: #"<[^>]+>"#, with: " ", options: .regularExpression)
        let decoded = withoutTags
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&reg;", with: "")
            .replacingOccurrences(of: "&trade;", with: "")
            .replacingOccurrences(of: "®", with: "")
        let collapsed = decoded.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return collapsed.isEmpty ? nil : collapsed
    }
}

private struct FordInventoryPage: Sendable {
    let url: URL
    let fallbackDealerName: String?
    let fallbackAddress: String?
    let fallbackAvailability: String?

    static let defaultPages: [FordInventoryPage] = [
        FordInventoryPage(
            url: URL(string: "https://www.ford.ca/inventory/details/ford/en_ca/mach-e/vin/3FMTK1S56SMA59233")!,
            fallbackDealerName: "Thorncrest Ford",
            fallbackAddress: "1575 The Queensway, Toronto, ON M8Z1T9",
            fallbackAvailability: "Just Arrived"
        ),
        FordInventoryPage(
            url: URL(string: "https://www.ford.ca/inventory/details/ford/en_ca/mach-e/vin/3FMTK4SX4SMA55278")!,
            fallbackDealerName: "Erinwood Ford Sales Inc.",
            fallbackAddress: "2395 Motorway Blvd, Mississauga, ON L5L1V4",
            fallbackAvailability: "In Stock"
        ),
        FordInventoryPage(
            url: URL(string: "https://www.ford.ca/inventory/details/ford/en_ca/mach-e/vin/3FMTK3SU5TMA02851")!,
            fallbackDealerName: "Airport Ford Lincoln",
            fallbackAddress: "49 Rymal Rd E, Hamilton, ON L9B1B9",
            fallbackAvailability: "In Stock"
        )
    ]
}

private enum FordInventoryError: LocalizedError {
    case noSnapshots([String])

    var errorDescription: String? {
        switch self {
        case .noSnapshots(let failures):
            if failures.isEmpty {
                return "Ford inventory returned no snapshots."
            }
            return "Ford inventory returned no snapshots: \(failures.joined(separator: " | "))"
        }
    }
}

public struct DealerGroupAdapter: SourceAdapter {
    public let sourceID = "dealer-group"
    public let displayName = "Dealer Group"

    public init() {}

    public func fetchSnapshots() async throws -> [RawVehicleSnapshot] {
        try await Task.sleep(for: .milliseconds(220))
        return SampleData.dealerSnapshots
    }
}

public struct VolkswagenCanadaInventoryAdapter: SourceAdapter {
    public let sourceID = "vw-canada-inventory"
    public let displayName = "Volkswagen Canada Inventory"

    private let session: URLSession
    private let endpoint: URL

    public init(
        session: URLSession = .shared,
        endpoint: URL = URL(string: "https://globalapi.vwtools.ca/inventory-app/vehicles?postal_code=M5V%202T6&distance=100&category=new&model=id4&limit=5")!
    ) {
        self.session = session
        self.endpoint = endpoint
    }

    public func fetchSnapshots() async throws -> [RawVehicleSnapshot] {
        let (data, response) = try await session.data(from: endpoint)
        if let httpResponse = response as? HTTPURLResponse, !(200..<300).contains(httpResponse.statusCode) {
            throw VolkswagenInventoryError.httpStatus(httpResponse.statusCode)
        }

        let inventory = try JSONDecoder().decode(VolkswagenInventoryResponse.self, from: data)
        let snapshots = inventory.data.compactMap(snapshot)
        if snapshots.isEmpty {
            throw VolkswagenInventoryError.noSnapshots
        }
        return snapshots
    }

    private func snapshot(from vehicle: VolkswagenInventoryVehicle) -> RawVehicleSnapshot? {
        guard
            let trim = vehicle.trim?.en?.trimmingCharacters(in: .whitespacesAndNewlines),
            !trim.isEmpty,
            let dealer = vehicle.dealerInfo,
            let city = dealer.city?.trimmingCharacters(in: .whitespacesAndNewlines),
            !city.isEmpty,
            let province = dealer.province?.trimmingCharacters(in: .whitespacesAndNewlines),
            !province.isEmpty
        else {
            return nil
        }

        let identifier = firstNonEmpty([
            vehicle.vin,
            vehicle.stockNumber,
            vehicle.id.map(String.init)
        ]) ?? UUID().uuidString
        let dealerName = firstNonEmpty([dealer.fullname, dealer.website]) ?? "Volkswagen Dealer"
        let sourceURL = firstNonEmpty([vehicle.deeplink?.en, dealer.website]) ?? endpoint.absoluteString
        let listingPrice = vehicle.price ?? vehicle.pcs?.en?.price?.value ?? 0
        let msrp = vehicle.pcs?.en?.price?.value ?? vehicle.price
        let status = vehicle.inStock == true ? "In stock" : (vehicle.inTransit == true ? "In transit" : "Availability unconfirmed")

        return RawVehicleSnapshot(
            sourceID: sourceID,
            externalListingID: identifier,
            dealerName: dealerName,
            make: "Volkswagen",
            model: vehicle.modelName ?? "ID.4",
            trim: normalizedTrim(trim),
            year: vehicle.year,
            powertrain: .bev,
            msrpCAD: msrp,
            listingPriceCAD: listingPrice,
            city: city,
            province: normalizeProvince(province),
            condition: .new,
            sourceURL: sourceURL,
            confidenceHint: vehicle.inStock == true && listingPrice > 0 ? .high : .medium,
            notes: notes(for: vehicle, status: status, msrp: msrp, listingPrice: listingPrice)
        )
    }

    private func normalizedTrim(_ trim: String) -> String {
        trim.replacingOccurrences(of: "ID.4", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
    }

    private func normalizeProvince(_ value: String) -> String {
        switch value.uppercased() {
        case "ON": return "Ontario"
        case "BC": return "British Columbia"
        case "AB": return "Alberta"
        case "QC": return "Quebec"
        default: return value
        }
    }

    private func notes(
        for vehicle: VolkswagenInventoryVehicle,
        status: String,
        msrp: Double?,
        listingPrice: Double
    ) -> [String] {
        [
            "Inventory status: \(status)",
            vehicle.stockNumber.map { "Stock number: \($0)" },
            vehicle.inventoryDate.map { "Inventory date: \($0)" },
            msrp.map { "VW API MSRP: \(Int($0.rounded())) CAD" },
            listingPrice > 0 ? "VW API listing price: \(Int(listingPrice.rounded())) CAD" : nil,
            "Source: Volkswagen Canada inventory JSON; local MVP use remains low-volume and provenance-preserving."
        ].compactMap { $0 }
    }

    private func firstNonEmpty(_ values: [String?]) -> String? {
        values.compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first(where: { !$0.isEmpty })
    }
}

private enum VolkswagenInventoryError: LocalizedError {
    case httpStatus(Int)
    case noSnapshots

    var errorDescription: String? {
        switch self {
        case .httpStatus(let status):
            return "Volkswagen inventory returned HTTP \(status)."
        case .noSnapshots:
            return "Volkswagen inventory returned no usable ID.4 snapshots."
        }
    }
}

private struct VolkswagenInventoryResponse: Decodable {
    let data: [VolkswagenInventoryVehicle]
}

private struct VolkswagenInventoryVehicle: Decodable {
    let id: Int?
    let vin: String?
    let trim: VolkswagenLocalizedText?
    let year: Int
    let price: Double?
    let category: String?
    let inStock: Bool?
    let inTransit: Bool?
    let modelName: String?
    let dealerInfo: VolkswagenDealerInfo?
    let stockNumber: String?
    let inventoryDate: String?
    let deeplink: VolkswagenLocalizedText?
    let pcs: VolkswagenPricingContainer?

    enum CodingKeys: String, CodingKey {
        case id
        case vin
        case trim
        case year
        case price
        case category
        case inStock = "in_stock"
        case inTransit = "in_transit"
        case modelName = "model_name"
        case dealerInfo = "dealer_info"
        case stockNumber = "stock_number"
        case inventoryDate = "inventory_date"
        case deeplink
        case pcs
    }
}

private struct VolkswagenLocalizedText: Decodable {
    let en: String?
    let fr: String?
}

private struct VolkswagenDealerInfo: Decodable {
    let city: String?
    let website: String?
    let fullname: String?
    let province: String?
}

private struct VolkswagenPricingContainer: Decodable {
    let en: VolkswagenPricingLanguage?
}

private struct VolkswagenPricingLanguage: Decodable {
    let price: VolkswagenPrice?
}

private struct VolkswagenPrice: Decodable {
    let label: String?
    let value: Double?
}

@MainActor
@Observable
public final class SyncCoordinator {
    public private(set) var status: String = "Idle"
    public private(set) var lastRun: Date?
    public private(set) var isRefreshing = false

    private let adapters: [any SourceAdapter]

    public init(adapters: [any SourceAdapter]) {
        self.adapters = adapters
    }

    public func refreshAll(using database: AppDatabase) async throws {
        status = "Refreshing"
        isRefreshing = true
        defer {
            isRefreshing = false
            lastRun = .now
        }

        try await database.upsertCanonicalVehicles(SampleData.liveSourceCanonicalVehicles)
        let canonicalVehicles = try await database.fetchCanonicalVehicles()

        var allPublished: [Listing] = []
        var allRuns: [SourceRun] = []
        var reviewItems: [ReviewQueueItem] = []

        for adapter in adapters {
            let startedAt = Date()
            do {
                let snapshots = try await adapter.fetchSnapshots()
                let published = mapPublishedListings(snapshots: snapshots, vehicles: canonicalVehicles)
                let queued = mapReviewItems(snapshots: snapshots, vehicles: canonicalVehicles, sourceRunID: "\(adapter.sourceID)-\(startedAt.timeIntervalSince1970)")

                let run = SourceRun(
                    id: "\(adapter.sourceID)-\(startedAt.timeIntervalSince1970)",
                    sourceID: adapter.sourceID,
                    displayName: adapter.displayName,
                    startedAt: startedAt,
                    completedAt: .now,
                    status: "completed",
                    fetchedRecords: snapshots.count,
                    publishedRecords: published.count,
                    reviewRecords: queued.count
                )

                allPublished.append(contentsOf: published)
                allRuns.append(run)
                reviewItems.append(contentsOf: queued)
                AppLogger.sync.info("Refreshed source \(adapter.displayName, privacy: .public) with \(snapshots.count, privacy: .public) snapshots.")
            } catch {
                let failedRun = SourceRun(
                    sourceID: adapter.sourceID,
                    displayName: adapter.displayName,
                    startedAt: startedAt,
                    completedAt: .now,
                    status: "failed",
                    fetchedRecords: 0,
                    publishedRecords: 0,
                    reviewRecords: 0,
                    errorMessage: error.localizedDescription
                )
                allRuns.append(failedRun)
                AppLogger.sync.error("Source refresh failed for \(adapter.displayName, privacy: .public): \(error.localizedDescription, privacy: .public)")
            }
        }

        for sourceID in adapters.map(\.sourceID) {
            try await database.replaceListings(for: sourceID, with: allPublished.filter { $0.sourceID == sourceID })
        }
        try await database.replaceSourceRuns(allRuns)
        try await database.replaceReviewQueue(reviewItems)

        status = "Up to date"
    }

    public func refresh(source sourceID: String, using database: AppDatabase) async throws {
        guard let adapter = adapters.first(where: { $0.sourceID == sourceID }) else { return }
        try await database.upsertCanonicalVehicles(SampleData.liveSourceCanonicalVehicles)
        let canonicalVehicles = try await database.fetchCanonicalVehicles()
        let snapshots = try await adapter.fetchSnapshots()
        let published = mapPublishedListings(snapshots: snapshots, vehicles: canonicalVehicles)
        let review = mapReviewItems(snapshots: snapshots, vehicles: canonicalVehicles, sourceRunID: "\(sourceID)-manual")

        try await database.replaceListings(for: sourceID, with: published)
        try await database.replaceReviewQueue(review)
        lastRun = .now
        status = "Refreshed \(adapter.displayName)"
    }

    private func mapPublishedListings(snapshots: [RawVehicleSnapshot], vehicles: [CanonicalVehicle]) -> [Listing] {
        let vehicleLookup = Dictionary(uniqueKeysWithValues: vehicles.map { ($0.id, $0) })

        return snapshots.compactMap { snapshot in
            let match = match(snapshot: snapshot, vehicles: vehicles)
            guard let matchedVehicleID = match.vehicleID, match.confidence == .high else { return nil }

            let vehicle = vehicleLookup[matchedVehicleID]
            let finalConfidence = minConfidence(snapshot.confidenceHint, vehicle?.confidence ?? .high, match.confidence)

            return Listing(
                id: "\(snapshot.sourceID)-\(snapshot.externalListingID)",
                canonicalVehicleID: matchedVehicleID,
                sourceID: snapshot.sourceID,
                dealerName: snapshot.dealerName ?? defaultDealerName(for: snapshot),
                city: snapshot.city,
                province: snapshot.province,
                locationLabel: locationLabel(for: snapshot),
                priceCAD: snapshot.listingPriceCAD,
                condition: snapshot.condition,
                sourceURL: snapshot.sourceURL,
                confidence: finalConfidence,
                notes: snapshot.notes
            )
        }
    }

    private func mapReviewItems(snapshots: [RawVehicleSnapshot], vehicles: [CanonicalVehicle], sourceRunID: String) -> [ReviewQueueItem] {
        snapshots.compactMap { snapshot in
            let match = match(snapshot: snapshot, vehicles: vehicles)
            guard match.confidence != .high else { return nil }

            return ReviewQueueItem(
                sourceRunID: sourceRunID,
                reason: match.reason,
                severity: match.confidence,
                rawIdentifier: snapshot.externalListingID,
                rawPayload: reviewPayload(for: snapshot, reason: match.reason)
            )
        }
    }

    private func match(snapshot: RawVehicleSnapshot, vehicles: [CanonicalVehicle]) -> (vehicleID: String?, confidence: ConfidenceLevel, reason: String) {
        if let matchedCanonicalVehicleID = snapshot.matchedCanonicalVehicleID {
            return (matchedCanonicalVehicleID, .high, "Source provided a canonical vehicle identifier.")
        }

        if let exact = vehicles.first(where: {
            $0.make.caseInsensitiveCompare(snapshot.make) == .orderedSame &&
            $0.model.caseInsensitiveCompare(snapshot.model) == .orderedSame &&
            $0.trim.caseInsensitiveCompare(snapshot.trim) == .orderedSame &&
            $0.year == snapshot.year
        }) {
            return (exact.id, .high, "Exact make/model/trim match.")
        }

        if let fuzzy = vehicles.first(where: {
            $0.make.caseInsensitiveCompare(snapshot.make) == .orderedSame &&
            $0.model.caseInsensitiveCompare(snapshot.model) == .orderedSame &&
            (
                snapshot.trim.localizedCaseInsensitiveContains($0.trim) ||
                $0.trim.localizedCaseInsensitiveContains(snapshot.trim)
            )
        }) {
            return (fuzzy.id, .medium, "Trim name is close but not exact.")
        }

        return (nil, .low, "No deterministic canonical match.")
    }

    private func minConfidence(_ lhs: ConfidenceLevel, _ rhs: ConfidenceLevel, _ rhs2: ConfidenceLevel) -> ConfidenceLevel {
        [lhs, rhs, rhs2].min(by: { $0.score < $1.score }) ?? .medium
    }

    private func defaultDealerName(for snapshot: RawVehicleSnapshot) -> String {
        snapshot.sourceID == "oem-inventory" ? "\(snapshot.make) \(snapshot.city)" : "\(snapshot.make) Dealer"
    }

    private func locationLabel(for snapshot: RawVehicleSnapshot) -> String {
        "\(snapshot.city), \(provinceAbbreviation(snapshot.province))"
    }

    private func provinceAbbreviation(_ province: String) -> String {
        switch province.lowercased() {
        case "ontario":
            return "ON"
        case "british columbia":
            return "BC"
        case "alberta":
            return "AB"
        case "quebec":
            return "QC"
        default:
            return String(province.prefix(2)).uppercased()
        }
    }

    private func reviewPayload(for snapshot: RawVehicleSnapshot, reason: String) -> String {
        var payload: [String: String] = [
            "make": snapshot.make,
            "model": snapshot.model,
            "trim": snapshot.trim,
            "year": String(snapshot.year),
            "city": snapshot.city,
            "province": snapshot.province,
            "source_url": snapshot.sourceURL,
            "reason": reason
        ]

        if let dealerName = snapshot.dealerName, !dealerName.isEmpty {
            payload["dealer_name"] = dealerName
        }

        if snapshot.listingPriceCAD > 0 {
            payload["price_cad"] = String(Int(snapshot.listingPriceCAD.rounded()))
        }

        let orderedKeys = payload.keys.sorted()
        let body = orderedKeys.map { key in
            let value = payload[key, default: ""]
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "\"", with: "\\\"")
            return #""\#(key)":"\#(value)""#
        }.joined(separator: ",")

        return "{\(body)}"
    }
}
