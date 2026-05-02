import AppModels
import Foundation

public struct ResearchPromptGenerator: Sendable {
    public init() {}

    public func prompt(
        provider: ResearchProvider,
        make: String?,
        model: String?,
        radiusMode: RadiusMode,
        postalCode: String?
    ) -> String {
        let brandClause = make ?? "Hyundai and Kia"
        let modelClause = model.map { " for \($0)" } ?? ""
        let postal = postalCode?.trimmingCharacters(in: .whitespacesAndNewlines)
        let locationClause: String

        switch radiusMode {
        case .hundredKm:
            locationClause = "within 100 km of \(postal?.isEmpty == false ? postal! : "my configured GTA postal code")"
        case .oneFiftyKm:
            locationClause = "within 150 km of \(postal?.isEmpty == false ? postal! : "my configured GTA postal code")"
        case .province:
            locationClause = "across Ontario"
        case .national:
            locationClause = "across Canada"
        }

        return """
        You are doing buyer-side vehicle research for a Canadian car negotiation dashboard.

        Goal: find all new 2025 and 2026 electrified \(brandClause) vehicles\(modelClause) \(locationClause). Include BEV, PHEV, and HEV only. Exclude gas-only and used listings unless a dealer marks a demo as new.

        Search official OEM inventory, dealership pages, dealer group pages, AutoTrader/Kijiji-style marketplaces, and official incentive pages. Do not use login-gated, CAPTCHA-gated, or unclear private sources.

        Return a CSV table with exactly these columns:
        make,model,trim,year,powertrain,dealer,city,province,advertised_price_cad,msrp_cad,stock_or_vin,status,odometer_km,source_url,source_type,observed_date,incentive_discount_notes,finance_offer_notes,confidence_note

        Rules:
        - source_url is required for every row.
        - source_type must be one of OEM, Dealer, Marketplace, Government, Manual.
        - Treat marketplace rows as lower-confidence comparison leverage unless the dealer page confirms the same stock.
        - Capture visible discounts, OEM cash, dealer discounts, mandatory fees, and finance APR/payment claims only when source-backed.
        - For EVAP/federal eligibility, check the current Transport Canada EVAP program page and vehicle list. Do not assume every Hyundai/Kia BEV or PHEV qualifies; record trim, final-transaction-value caveats, lease term, and dealer-confirmation needs in incentive_discount_notes.
        - Prefer direct dealer/OEM evidence over summarized marketplace snippets.
        - Include duplicate same-trim stock because duplicate inventory creates negotiation leverage.
        - Add a short confidence_note explaining what is verified and what still needs dealer confirmation.

        Provider note for \(provider.rawValue): include citations/source links beside the research summary, but keep the final CSV clean and machine-readable.
        """
    }
}

public struct ResearchImportRow: Codable, Hashable, Sendable {
    public var make: String
    public var model: String
    public var trim: String
    public var year: Int
    public var powertrain: PowertrainType
    public var dealer: String
    public var city: String
    public var province: String
    public var advertisedPriceCAD: Double
    public var msrpCAD: Double?
    public var stockOrVIN: String?
    public var status: String
    public var odometerKm: Int?
    public var sourceURL: String
    public var sourceType: ResearchSourceType
    public var observedDate: Date?
    public var incentiveDiscountNotes: String
    public var financeOfferNotes: String
    public var confidenceNote: String
}

public struct ResearchImportIssue: Identifiable, Hashable, Sendable {
    public let id = UUID()
    public var rowNumber: Int
    public var message: String
}

public struct ResearchImportResult: Hashable, Sendable {
    public var acceptedRows: [ResearchImportRow]
    public var rejectedRows: [ResearchImportIssue]

    public init(acceptedRows: [ResearchImportRow], rejectedRows: [ResearchImportIssue]) {
        self.acceptedRows = acceptedRows
        self.rejectedRows = rejectedRows
    }
}

public struct ResearchImportWritePlan: Hashable, Sendable {
    public var batch: ResearchBatch
    public var listings: [InventoryListing]
    public var reviewItems: [ReviewQueueItem]

    public init(batch: ResearchBatch, listings: [InventoryListing], reviewItems: [ReviewQueueItem]) {
        self.batch = batch
        self.listings = listings
        self.reviewItems = reviewItems
    }
}

public struct ResearchImportFileParser: Sendable {
    public init() {}

    public func parseRows(from url: URL) throws -> [[String: String]] {
        let data = try Data(contentsOf: url)
        if url.pathExtension.localizedCaseInsensitiveCompare("json") == .orderedSame {
            return try parseJSON(data)
        }

        guard let csv = String(data: data, encoding: .utf8) else {
            throw ImportError.invalid("import file must be UTF-8 CSV or JSON")
        }
        return try parseCSV(csv)
    }

    public func parseCSV(_ csv: String) throws -> [[String: String]] {
        let rows = try parseCSVRows(csv)
        guard let headers = rows.first, !headers.isEmpty else {
            return []
        }
        let normalizedHeaders = headers.map { $0.trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "\u{FEFF}"))) }

        return rows.dropFirst().map { values in
            Dictionary(uniqueKeysWithValues: normalizedHeaders.enumerated().map { offset, header in
                (header, offset < values.count ? values[offset] : "")
            })
        }
    }

    private func parseJSON(_ data: Data) throws -> [[String: String]] {
        let object = try JSONSerialization.jsonObject(with: data)
        guard let rows = object as? [[String: Any]] else {
            throw ImportError.invalid("JSON import must be an array of row objects")
        }

        return rows.map { row in
            row.reduce(into: [String: String]()) { result, pair in
                if pair.value is NSNull {
                    result[pair.key] = ""
                } else {
                    result[pair.key] = String(describing: pair.value)
                }
            }
        }
    }

    private func parseCSVRows(_ csv: String) throws -> [[String]] {
        var rows: [[String]] = []
        var row: [String] = []
        var field = ""
        var inQuotes = false
        let characters = Array(csv)
        var index = characters.startIndex

        while index < characters.endIndex {
            let character = characters[index]
            if character == "\"" {
                let nextIndex = characters.index(after: index)
                if inQuotes, nextIndex < characters.endIndex, characters[nextIndex] == "\"" {
                    field.append("\"")
                    index = characters.index(after: nextIndex)
                } else {
                    inQuotes.toggle()
                    index = nextIndex
                }
            } else if character == "," && !inQuotes {
                row.append(field)
                field = ""
                index = characters.index(after: index)
            } else if (character == "\n" || character == "\r") && !inQuotes {
                row.append(field)
                rows.append(row)
                row = []
                field = ""
                let nextIndex = characters.index(after: index)
                if character == "\r", nextIndex < characters.endIndex, characters[nextIndex] == "\n" {
                    index = characters.index(after: nextIndex)
                } else {
                    index = nextIndex
                }
            } else {
                field.append(character)
                index = characters.index(after: index)
            }
        }

        guard !inQuotes else {
            throw ImportError.invalid("CSV contains an unterminated quoted field")
        }

        if !field.isEmpty || !row.isEmpty {
            row.append(field)
            rows.append(row)
        }

        return rows
    }
}

public struct ResearchImportAssembler: Sendable {
    public init() {}

    public func writePlan(
        rows: [[String: String]],
        provider: ResearchProvider,
        prompt: String,
        importedFileName: String?,
        importedAt: Date = .now
    ) -> ResearchImportWritePlan {
        let result = ResearchImportValidator().validate(rows: rows)
        let batchID = "research-\(stableToken([provider.rawValue, importedFileName ?? "", "\(importedAt.timeIntervalSince1970)"]))"
        let listings = result.acceptedRows.map { listing(from: $0, importedAt: importedAt) }
        let reviewItems = result.rejectedRows.map { issue in
            ReviewQueueItem(
                id: "\(batchID)-row-\(issue.rowNumber)",
                sourceRunID: batchID,
                reason: issue.message,
                severity: .low,
                rawIdentifier: "Research row \(issue.rowNumber)",
                rawPayload: rawPayload(rowNumber: issue.rowNumber, message: issue.message),
                createdAt: importedAt
            )
        }

        return ResearchImportWritePlan(
            batch: ResearchBatch(
                id: batchID,
                provider: provider,
                prompt: prompt,
                importedFileName: importedFileName,
                sourceCount: Set(result.acceptedRows.map(\.sourceURL)).count,
                acceptedRows: result.acceptedRows.count,
                rejectedRows: result.rejectedRows.count,
                reviewQueueRecords: reviewItems.count,
                createdAt: importedAt
            ),
            listings: listings,
            reviewItems: reviewItems
        )
    }

    public func mergedListings(existing: [InventoryListing], imported: [InventoryListing]) -> [InventoryListing] {
        var merged: [String: InventoryListing] = [:]
        for listing in existing {
            let key = dedupeKey(for: listing)
            if let existingListing = merged[key] {
                merged[key] = mergedListing(existing: existingListing, incoming: listing)
            } else {
                merged[key] = listing
            }
        }
        for listing in imported {
            let key = dedupeKey(for: listing)
            if let existingListing = merged[key] {
                merged[key] = mergedListing(existing: existingListing, incoming: listing)
            } else {
                merged[key] = listing
            }
        }
        return merged.values.sorted { $0.lastSeenAt > $1.lastSeenAt }
    }

    private func mergedListing(existing: InventoryListing, incoming: InventoryListing) -> InventoryListing {
        var updated = incoming.lastSeenAt >= existing.lastSeenAt ? incoming : existing
        updated.firstSeenAt = min(existing.firstSeenAt, incoming.firstSeenAt)
        updated.lastSeenAt = max(existing.lastSeenAt, incoming.lastSeenAt)
        updated.notes = Array(Set(existing.notes + incoming.notes)).sorted()
        return updated
    }

    public func mergedBatches(existing: [ResearchBatch], imported: ResearchBatch) -> [ResearchBatch] {
        var merged = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })
        merged[imported.id] = imported
        return merged.values.sorted { $0.createdAt > $1.createdAt }
    }

    public func mergedReviewItems(existing: [ReviewQueueItem], imported: [ReviewQueueItem]) -> [ReviewQueueItem] {
        var merged = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })
        for item in imported {
            merged[item.id] = item
        }
        return merged.values.sorted { $0.createdAt > $1.createdAt }
    }

    private func listing(from row: ResearchImportRow, importedAt: Date) -> InventoryListing {
        let stockOrVIN = row.stockOrVIN?.trimmingCharacters(in: .whitespacesAndNewlines)
        let vin = stockOrVIN?.count == 17 ? stockOrVIN : nil
        let stockNumber = vin == nil ? stockOrVIN : nil
        let msrp = row.msrpCAD ?? row.advertisedPriceCAD
        let dealerDiscount = max(0, msrp - row.advertisedPriceCAD)
        let idSeed = [
            row.make,
            row.model,
            row.trim,
            "\(row.year)",
            row.dealer,
            stockOrVIN?.isEmpty == false ? stockOrVIN! : row.sourceURL
        ].joined(separator: "-")

        return InventoryListing(
            id: "import-\(stableToken([idSeed]))",
            canonicalVehicleID: canonicalVehicleID(for: row),
            vin: vin,
            stockNumber: stockNumber,
            make: row.make,
            model: row.model,
            trim: row.trim,
            year: row.year,
            powertrain: row.powertrain,
            dealerName: row.dealer,
            city: row.city,
            province: row.province,
            condition: .new,
            odometerKm: row.odometerKm,
            status: row.status,
            advertisedPriceCAD: row.advertisedPriceCAD,
            msrpCAD: msrp,
            priceBreakdown: PriceBreakdown(
                msrpCAD: msrp,
                advertisedPriceCAD: row.advertisedPriceCAD,
                dealerDiscountCAD: dealerDiscount
            ),
            sourceURL: row.sourceURL,
            sourceType: row.sourceType,
            confidence: confidence(for: row),
            firstSeenAt: row.observedDate ?? importedAt,
            lastSeenAt: importedAt,
            notes: notes(for: row)
        )
    }

    private func confidence(for row: ResearchImportRow) -> ConfidenceLevel {
        if row.sourceType == .marketplace {
            return .low
        }
        if row.sourceType == .dealer || row.sourceType == .oem {
            return .high
        }
        return .medium
    }

    private func notes(for row: ResearchImportRow) -> [String] {
        [
            row.incentiveDiscountNotes.isEmpty ? nil : "Incentives/discounts: \(row.incentiveDiscountNotes)",
            row.financeOfferNotes.isEmpty ? nil : "Finance evidence: \(row.financeOfferNotes)",
            row.confidenceNote.isEmpty ? nil : "Confidence: \(row.confidenceNote)",
            row.sourceType == .marketplace ? "Marketplace evidence only; confirm against dealer/OEM source before quoting." : nil
        ].compactMap(\.self)
    }

    private func canonicalVehicleID(for row: ResearchImportRow) -> String {
        stableSlug([row.make, row.model, row.trim, "\(row.year)"])
    }

    private func dedupeKey(for listing: InventoryListing) -> String {
        if let vin = listing.vin?.trimmingCharacters(in: .whitespacesAndNewlines), !vin.isEmpty {
            return "vin:\(vin.lowercased())"
        }
        if let stock = listing.stockNumber?.trimmingCharacters(in: .whitespacesAndNewlines), !stock.isEmpty {
            return stableSlug(["stock", listing.dealerName, stock])
        }
        return stableSlug([
            "dealer-trim",
            listing.dealerName,
            listing.city,
            listing.province,
            listing.make,
            listing.model,
            listing.trim,
            "\(listing.year)"
        ])
    }

    private func rawPayload(rowNumber: Int, message: String) -> String {
        let object = ["row_number": "\(rowNumber)", "message": message]
        guard
            let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]),
            let string = String(data: data, encoding: .utf8)
        else {
            return "row_number: \(rowNumber); message: \(message)"
        }
        return string
    }

    private func stableToken(_ values: [String]) -> String {
        stableSlug(values) + "-\(stableHash(values.joined(separator: "|")))"
    }

    private func stableSlug(_ values: [String]) -> String {
        values
            .joined(separator: "-")
            .lowercased()
            .unicodeScalars
            .map { CharacterSet.alphanumerics.contains($0) ? Character($0) : "-" }
            .reduce(into: "") { partial, character in
                if character == "-", partial.last == "-" { return }
                partial.append(character)
            }
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }

    private func stableHash(_ value: String) -> String {
        let hash = value.unicodeScalars.reduce(UInt64(5_381)) { (($0 << 5) &+ $0) &+ UInt64($1.value) }
        return String(hash, radix: 16)
    }
}

public struct ResearchImportValidator: Sendable {
    public init() {}

    public func validate(rows: [[String: String]]) -> ResearchImportResult {
        var accepted: [ResearchImportRow] = []
        var rejected: [ResearchImportIssue] = []

        for (offset, row) in rows.enumerated() {
            let rowNumber = offset + 2
            do {
                accepted.append(try parse(row: row))
            } catch {
                rejected.append(ResearchImportIssue(rowNumber: rowNumber, message: error.localizedDescription))
            }
        }

        return ResearchImportResult(acceptedRows: accepted, rejectedRows: rejected)
    }

    private func parse(row: [String: String]) throws -> ResearchImportRow {
        let make = try required("make", in: row)
        let model = try required("model", in: row)
        let trim = try required("trim", in: row)
        let year = try int("year", in: row)
        let powertrainRaw = try required("powertrain", in: row).uppercased()
        let powertrain = try value(PowertrainType(rawValue: powertrainRaw), field: "powertrain")
        let dealer = try required("dealer", in: row)
        let city = try required("city", in: row)
        let province = try required("province", in: row)
        let advertisedPrice = try double("advertised_price_cad", in: row)
        let msrp = try optionalPrice("msrp_cad", in: row)
        let sourceURL = try required("source_url", in: row)
        let sourceTypeRaw = try required("source_type", in: row)
        let sourceType = try value(normalizedSourceType(sourceTypeRaw), field: "source_type")
        let observedDate = try date("observed_date", in: row)
        let incentiveDiscountNotes = try required("incentive_discount_notes", in: row)
        let confidenceNote = try required("confidence_note", in: row)

        guard year == 2025 || year == 2026 else {
            throw ImportError.invalid("year must be 2025 or 2026")
        }
        guard make.caseInsensitiveCompare("Hyundai") == .orderedSame || make.caseInsensitiveCompare("Kia") == .orderedSame else {
            throw ImportError.invalid("make must be Hyundai or Kia")
        }
        guard powertrain == .bev || powertrain == .phev || powertrain == .hev else {
            throw ImportError.invalid("powertrain must be BEV, PHEV, or HEV")
        }
        guard (10_000...250_000).contains(advertisedPrice) else {
            throw ImportError.invalid("advertised_price_cad is outside the expected new-vehicle range")
        }
        guard sourceURL.lowercased().hasPrefix("http") else {
            throw ImportError.invalid("source_url must be an http(s) URL")
        }

        return ResearchImportRow(
            make: make,
            model: model,
            trim: trim,
            year: year,
            powertrain: powertrain,
            dealer: dealer,
            city: city,
            province: province,
            advertisedPriceCAD: advertisedPrice,
            msrpCAD: msrp,
            stockOrVIN: optional("stock_or_vin", in: row),
            status: optional("status", in: row) ?? "Unconfirmed",
            odometerKm: optionalInt("odometer_km", in: row),
            sourceURL: sourceURL,
            sourceType: sourceType,
            observedDate: observedDate,
            incentiveDiscountNotes: incentiveDiscountNotes,
            financeOfferNotes: optional("finance_offer_notes", in: row) ?? "",
            confidenceNote: confidenceNote
        )
    }

    private func normalizedSourceType(_ value: String) -> ResearchSourceType? {
        switch value.trimmingCharacters(in: .whitespacesAndNewlines).localizedLowercase {
        case "oem": return .oem
        case "dealer": return .dealer
        case "marketplace": return .marketplace
        case "government": return .government
        case "manual": return .manual
        default: return nil
        }
    }

    private func required(_ field: String, in row: [String: String]) throws -> String {
        guard let value = row[field]?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            throw ImportError.missing(field)
        }
        return value
    }

    private func optional(_ field: String, in row: [String: String]) -> String? {
        let value = row[field]?.trimmingCharacters(in: .whitespacesAndNewlines)
        return value?.isEmpty == false ? value : nil
    }

    private func int(_ field: String, in row: [String: String]) throws -> Int {
        guard let parsed = Int(try required(field, in: row)) else {
            throw ImportError.invalid("\(field) must be an integer")
        }
        return parsed
    }

    private func optionalInt(_ field: String, in row: [String: String]) -> Int? {
        optional(field, in: row).flatMap(Int.init)
    }

    private func double(_ field: String, in row: [String: String]) throws -> Double {
        let normalized = try required(field, in: row).replacingOccurrences(of: ",", with: "")
        guard let parsed = Double(normalized) else {
            throw ImportError.invalid("\(field) must be a number")
        }
        return parsed
    }

    private func optionalPrice(_ field: String, in row: [String: String]) throws -> Double? {
        guard let value = optional(field, in: row) else {
            return nil
        }
        let normalized = value.replacingOccurrences(of: ",", with: "")
        guard let parsed = Double(normalized) else {
            throw ImportError.invalid("\(field) must be a number")
        }
        guard (10_000...250_000).contains(parsed) else {
            throw ImportError.invalid("\(field) is outside the expected new-vehicle range")
        }
        return parsed
    }

    private func date(_ field: String, in row: [String: String]) throws -> Date {
        let value = try required(field, in: row)
        guard let parsed = ISO8601DateFormatter().date(from: value) else {
            throw ImportError.invalid("\(field) must be an ISO-8601 date")
        }
        return parsed
    }

    private func value<T>(_ value: T?, field: String) throws -> T {
        guard let value else {
            throw ImportError.invalid("\(field) has an unsupported value")
        }
        return value
    }
}

private enum ImportError: LocalizedError {
    case missing(String)
    case invalid(String)

    var errorDescription: String? {
        switch self {
        case .missing(let field):
            return "Missing required field \(field)"
        case .invalid(let message):
            return message
        }
    }
}
