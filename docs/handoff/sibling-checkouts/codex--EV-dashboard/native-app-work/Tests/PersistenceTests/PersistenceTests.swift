import AppModels
import Foundation
import Persistence
import SeedData
import Support

private enum ResearchImportFixtureLoader {
    static func load(_ name: String, file: StaticString = #filePath) throws -> [[String: String]] {
        try ResearchImportFileParser().parseRows(from: url(for: name, file: file))
    }

    static func url(for name: String, file: StaticString = #filePath) -> URL {
        let testFile = URL(fileURLWithPath: "\(file)")
        return testFile
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures/ResearchImports/\(name).csv")
    }
}
#if canImport(Testing)
import Testing

struct PersistenceTests {
    @Test
    func bootstrapSeedsCanonicalVehiclesAndListings() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)

        try await database.bootstrapIfNeeded()

        let vehicles = try await database.fetchCanonicalVehicles()
        let listings = try await database.fetchListings()
        let reviewItems = try await database.fetchReviewQueue()

        #expect(!vehicles.isEmpty)
        #expect(!listings.isEmpty)
        #expect(!reviewItems.isEmpty)
        #expect(vehicles.contains { $0.make == "Hyundai" && $0.year == 2025 })
    }

    @Test
    func preferencesRoundTrip() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)

        try await database.upsertPreference(key: "syncCadenceHours", value: "6")
        let value = try await database.fetchPreference(key: "syncCadenceHours")

        #expect(value == "6")
    }

    @Test
    func savedSearchesAndCompareSetsRoundTrip() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)
        try await database.bootstrapIfNeeded()

        try await database.replaceSavedSearches([
            SavedSearch(
                id: "search-ford-ontario",
                name: "Ford Ontario",
                query: "mach-e",
                radiusMode: .province,
                province: "Ontario",
                powertrains: [.bev],
                notificationsEnabled: true
            )
        ])
        try await database.replaceCompareSets([
            CompareSet(
                id: "compare-mach-e",
                name: "Mach-E trims",
                vehicleIDs: [
                    "ford-mustang-mach-e-select-2025",
                    "ford-mustang-mach-e-premium-2025"
                ]
            )
        ])

        let searches = try await database.fetchSavedSearches()
        #expect(searches.map(\.id) == ["search-ford-ontario"])
        #expect(searches.first?.powertrains == [.bev])
        #expect(searches.first?.notificationsEnabled == true)

        let compareSets = try await database.fetchCompareSets()
        #expect(compareSets.map(\.id) == ["compare-mach-e"])
        #expect(compareSets.first?.vehicleIDs == [
            "ford-mustang-mach-e-select-2025",
            "ford-mustang-mach-e-premium-2025"
        ])
    }

    @Test
    func listingNotesRoundTrip() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)
        try await database.bootstrapIfNeeded()

        try await database.replaceListings(for: "oem-inventory", with: [
            Listing(
                id: "oem-inventory-note-test",
                canonicalVehicleID: "ford-mustang-mach-e-select-2025",
                sourceID: "oem-inventory",
                dealerName: "Thorncrest Ford",
                city: "Toronto",
                province: "Ontario",
                locationLabel: "Toronto, ON",
                priceCAD: 55_995,
                condition: .new,
                sourceURL: "https://example.com/ford-note",
                confidence: .medium,
                notes: ["Displayed price falls back to inferred MSRP."]
            )
        ])

        let listing = try #require(try await database.fetchListings(for: "ford-mustang-mach-e-select-2025").first {
            $0.id == "oem-inventory-note-test"
        })
        #expect(listing.notes == ["Displayed price falls back to inferred MSRP."])
        #expect(listing.confidence == .medium)
    }

    @Test
    func leverageTablesBootstrapAndRoundTrip() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)

        try await database.bootstrapIfNeeded()

        #expect(try await database.fetchDealerProfiles().count >= 4)
        #expect(try await database.fetchInventoryListings().contains { $0.make == "Kia" && $0.sourceType == .dealer })
        #expect(try await database.fetchIncentivePrograms().contains { $0.id == "incentive-evap-federal" })
        #expect(try await database.fetchFinanceOffers().contains { $0.listingID == "inventory-kia-ev9-markham-2025-a" })
        #expect(try await database.fetchResearchBatches().contains { $0.provider == .chatGPTDeepResearch })
    }

    @Test
    func researchImportValidatorRequiresSourceBackedHyundaiKiaRows() throws {
        let result = ResearchImportValidator().validate(rows: [
            [
                "make": "Hyundai",
                "model": "IONIQ 5",
                "trim": "Preferred AWD Long Range",
                "year": "2025",
                "powertrain": "BEV",
                "dealer": "Downtown Hyundai",
                "city": "Toronto",
                "province": "Ontario",
                "advertised_price_cad": "55988",
                "msrp_cad": "58999",
                "stock_or_vin": "HY-I5-2025-A",
                "status": "In Stock",
                "odometer_km": "230",
                "source_url": "https://example.com/hyundai/ioniq5",
                "source_type": "Dealer",
                "observed_date": "2026-04-30T12:00:00Z",
                "incentive_discount_notes": "Dealer discount visible.",
                "finance_offer_notes": "",
                "confidence_note": "Dealer page needs confirmation."
            ],
            [
                "make": "Toyota",
                "model": "RAV4 Hybrid",
                "trim": "XLE",
                "year": "2025",
                "powertrain": "HEV",
                "dealer": "Outside Scope",
                "city": "Toronto",
                "province": "Ontario",
                "advertised_price_cad": "42000",
                "source_url": "https://example.com/toyota",
                "source_type": "Dealer"
            ]
        ])

        #expect(result.acceptedRows.count == 1)
        #expect(result.acceptedRows.first?.sourceType == .dealer)
        #expect(result.rejectedRows.count == 1)
    }

    @Test
    func researchImportFixturesMatchStrictSchema() throws {
        let validRows = try ResearchImportFixtureLoader.load("hyundai-kia-gta-valid")
        let invalidRows = try ResearchImportFixtureLoader.load("hyundai-kia-gta-invalid")

        let validResult = ResearchImportValidator().validate(rows: validRows)
        let invalidResult = ResearchImportValidator().validate(rows: invalidRows)

        #expect(validResult.acceptedRows.count == 4)
        #expect(validResult.rejectedRows.isEmpty)
        #expect(validResult.acceptedRows.contains { $0.powertrain == .hev })
        #expect(validResult.acceptedRows.contains { $0.sourceType == .marketplace })
        #expect(invalidResult.acceptedRows.isEmpty)
        #expect(invalidResult.rejectedRows.count == 4)
    }

    @Test
    func researchImportAssemblerBuildsWritePlanFromFixture() throws {
        let rows = try ResearchImportFixtureLoader.load("hyundai-kia-gta-valid")
        let plan = ResearchImportAssembler().writePlan(
            rows: rows,
            provider: .chatGPTDeepResearch,
            prompt: "fixture prompt",
            importedFileName: "hyundai-kia-gta-valid.csv",
            importedAt: Date(timeIntervalSince1970: 1_800_000_000)
        )

        #expect(plan.batch.acceptedRows == 4)
        #expect(plan.batch.rejectedRows == 0)
        #expect(plan.listings.count == 4)
        #expect(plan.listings.contains { $0.powertrain == .phev && $0.sourceType == .marketplace && $0.confidence == .low })
        #expect(plan.listings.allSatisfy { $0.sourceURL.hasPrefix("https://") })
    }

    @Test
    func researchImportMergeCollapsesDuplicateStockAndDealerTrimRows() throws {
        let assembler = ResearchImportAssembler()
        let oldDate = Date(timeIntervalSince1970: 1_700_000_000)
        let newDate = Date(timeIntervalSince1970: 1_800_000_000)
        let existingStock = Self.fixtureInventoryListing(id: "existing-stock", stockNumber: "HY-I5-2025-A", firstSeenAt: oldDate, lastSeenAt: oldDate)
        let importedStock = Self.fixtureInventoryListing(id: "imported-stock", stockNumber: "HY-I5-2025-A", firstSeenAt: newDate, lastSeenAt: newDate)
        let existingNoStock = Self.fixtureInventoryListing(id: "existing-no-stock", stockNumber: nil, firstSeenAt: oldDate, lastSeenAt: oldDate)
        let importedNoStock = Self.fixtureInventoryListing(id: "imported-no-stock", stockNumber: nil, firstSeenAt: newDate, lastSeenAt: newDate)

        let merged = assembler.mergedListings(
            existing: [existingStock, existingNoStock],
            imported: [importedStock, importedNoStock]
        )

        #expect(merged.count == 2)
        #expect(merged.allSatisfy { $0.firstSeenAt == oldDate })
        #expect(merged.allSatisfy { $0.lastSeenAt == newDate })
    }

    @Test
    @MainActor
    func compareCSVCanBeGeneratedWithoutSavePanel() {
        let vehicle = SampleData.canonicalVehicles[0]
        let listing = SampleData.listings.first { $0.canonicalVehicleID == vehicle.id }
        let csv = ExportService().compareCSV(
            vehicles: [vehicle],
            listings: listing.map { [$0] } ?? [],
            includeListingPrice: true
        )

        #expect(csv.contains(#""Vehicle","Powertrain","MSRP CAD","Best Listing CAD","Best Listing Dealer""#))
        #expect(csv.contains(vehicle.displayName))
        #expect(csv.contains("Tesla Toronto Lawrence"))
    }

    private static func fixtureInventoryListing(
        id: String,
        stockNumber: String?,
        firstSeenAt: Date,
        lastSeenAt: Date
    ) -> InventoryListing {
        InventoryListing(
            id: id,
            canonicalVehicleID: "hyundai-ioniq-5-preferred-awd-2025",
            stockNumber: stockNumber,
            make: "Hyundai",
            model: "IONIQ 5",
            trim: "Preferred AWD Long Range",
            year: 2025,
            powertrain: .bev,
            dealerName: "Downtown Hyundai",
            city: "Toronto",
            province: "Ontario",
            status: "In Stock",
            advertisedPriceCAD: 55_988,
            msrpCAD: 58_999,
            sourceURL: "https://example.com/\(id)",
            sourceType: .dealer,
            confidence: .high,
            firstSeenAt: firstSeenAt,
            lastSeenAt: lastSeenAt
        )
    }
}
#elseif canImport(XCTest)
import XCTest

final class PersistenceTests: XCTestCase {
    func testBootstrapSeedsCanonicalVehiclesAndListings() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)

        try await database.bootstrapIfNeeded()

        let vehicles = try await database.fetchCanonicalVehicles()
        let listings = try await database.fetchListings()
        let reviewItems = try await database.fetchReviewQueue()

        XCTAssertFalse(vehicles.isEmpty)
        XCTAssertFalse(listings.isEmpty)
        XCTAssertFalse(reviewItems.isEmpty)
        XCTAssertTrue(vehicles.contains { $0.make == "Hyundai" && $0.year == 2025 })
    }

    func testPreferencesRoundTrip() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)

        try await database.upsertPreference(key: "syncCadenceHours", value: "6")
        let value = try await database.fetchPreference(key: "syncCadenceHours")

        XCTAssertEqual(value, "6")
    }

    func testSavedSearchesAndCompareSetsRoundTrip() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)
        try await database.bootstrapIfNeeded()

        try await database.replaceSavedSearches([
            SavedSearch(
                id: "search-ford-ontario",
                name: "Ford Ontario",
                query: "mach-e",
                radiusMode: .province,
                province: "Ontario",
                powertrains: [.bev],
                notificationsEnabled: true
            )
        ])
        try await database.replaceCompareSets([
            CompareSet(
                id: "compare-mach-e",
                name: "Mach-E trims",
                vehicleIDs: [
                    "ford-mustang-mach-e-select-2025",
                    "ford-mustang-mach-e-premium-2025"
                ]
            )
        ])

        let searches = try await database.fetchSavedSearches()
        XCTAssertEqual(searches.map(\.id), ["search-ford-ontario"])
        XCTAssertEqual(searches.first?.powertrains, [.bev])
        XCTAssertEqual(searches.first?.notificationsEnabled, true)

        let compareSets = try await database.fetchCompareSets()
        XCTAssertEqual(compareSets.map(\.id), ["compare-mach-e"])
        XCTAssertEqual(compareSets.first?.vehicleIDs, [
            "ford-mustang-mach-e-select-2025",
            "ford-mustang-mach-e-premium-2025"
        ])
    }

    func testListingNotesRoundTrip() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)
        try await database.bootstrapIfNeeded()

        try await database.replaceListings(for: "oem-inventory", with: [
            Listing(
                id: "oem-inventory-note-test",
                canonicalVehicleID: "ford-mustang-mach-e-select-2025",
                sourceID: "oem-inventory",
                dealerName: "Thorncrest Ford",
                city: "Toronto",
                province: "Ontario",
                locationLabel: "Toronto, ON",
                priceCAD: 55_995,
                condition: .new,
                sourceURL: "https://example.com/ford-note",
                confidence: .medium,
                notes: ["Displayed price falls back to inferred MSRP."]
            )
        ])

        let listing = try XCTUnwrap(try await database.fetchListings(for: "ford-mustang-mach-e-select-2025").first {
            $0.id == "oem-inventory-note-test"
        })
        XCTAssertEqual(listing.notes, ["Displayed price falls back to inferred MSRP."])
        XCTAssertEqual(listing.confidence, .medium)
    }

    func testLeverageTablesBootstrapAndRoundTrip() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)

        try await database.bootstrapIfNeeded()

        XCTAssertGreaterThanOrEqual(try await database.fetchDealerProfiles().count, 4)
        XCTAssertTrue(try await database.fetchInventoryListings().contains { $0.make == "Kia" && $0.sourceType == .dealer })
        XCTAssertTrue(try await database.fetchIncentivePrograms().contains { $0.id == "incentive-evap-federal" })
        XCTAssertTrue(try await database.fetchFinanceOffers().contains { $0.listingID == "inventory-kia-ev9-markham-2025-a" })
        XCTAssertTrue(try await database.fetchResearchBatches().contains { $0.provider == .chatGPTDeepResearch })
    }

    func testResearchImportValidatorRequiresSourceBackedHyundaiKiaRows() throws {
        let result = ResearchImportValidator().validate(rows: [
            [
                "make": "Hyundai",
                "model": "IONIQ 5",
                "trim": "Preferred AWD Long Range",
                "year": "2025",
                "powertrain": "BEV",
                "dealer": "Downtown Hyundai",
                "city": "Toronto",
                "province": "Ontario",
                "advertised_price_cad": "55988",
                "msrp_cad": "58999",
                "stock_or_vin": "HY-I5-2025-A",
                "status": "In Stock",
                "odometer_km": "230",
                "source_url": "https://example.com/hyundai/ioniq5",
                "source_type": "Dealer",
                "observed_date": "2026-04-30T12:00:00Z",
                "incentive_discount_notes": "Dealer discount visible.",
                "finance_offer_notes": "",
                "confidence_note": "Dealer page needs confirmation."
            ],
            [
                "make": "Toyota",
                "model": "RAV4 Hybrid",
                "trim": "XLE",
                "year": "2025",
                "powertrain": "HEV",
                "dealer": "Outside Scope",
                "city": "Toronto",
                "province": "Ontario",
                "advertised_price_cad": "42000",
                "source_url": "https://example.com/toyota",
                "source_type": "Dealer"
            ]
        ])

        XCTAssertEqual(result.acceptedRows.count, 1)
        XCTAssertEqual(result.acceptedRows.first?.sourceType, .dealer)
        XCTAssertEqual(result.rejectedRows.count, 1)
    }

    func testResearchImportFixturesMatchStrictSchema() throws {
        let validRows = try ResearchImportFixtureLoader.load("hyundai-kia-gta-valid")
        let invalidRows = try ResearchImportFixtureLoader.load("hyundai-kia-gta-invalid")

        let validResult = ResearchImportValidator().validate(rows: validRows)
        let invalidResult = ResearchImportValidator().validate(rows: invalidRows)

        XCTAssertEqual(validResult.acceptedRows.count, 4)
        XCTAssertTrue(validResult.rejectedRows.isEmpty)
        XCTAssertTrue(validResult.acceptedRows.contains { $0.powertrain == .hev })
        XCTAssertTrue(validResult.acceptedRows.contains { $0.sourceType == .marketplace })
        XCTAssertTrue(invalidResult.acceptedRows.isEmpty)
        XCTAssertEqual(invalidResult.rejectedRows.count, 4)
    }

    func testResearchImportAssemblerBuildsWritePlanFromFixture() throws {
        let rows = try ResearchImportFixtureLoader.load("hyundai-kia-gta-valid")
        let plan = ResearchImportAssembler().writePlan(
            rows: rows,
            provider: .chatGPTDeepResearch,
            prompt: "fixture prompt",
            importedFileName: "hyundai-kia-gta-valid.csv",
            importedAt: Date(timeIntervalSince1970: 1_800_000_000)
        )

        XCTAssertEqual(plan.batch.acceptedRows, 4)
        XCTAssertEqual(plan.batch.rejectedRows, 0)
        XCTAssertEqual(plan.listings.count, 4)
        XCTAssertTrue(plan.listings.contains { $0.powertrain == .phev && $0.sourceType == .marketplace && $0.confidence == .low })
        XCTAssertTrue(plan.listings.allSatisfy { $0.sourceURL.hasPrefix("https://") })
    }

    func testResearchImportMergeCollapsesDuplicateStockAndDealerTrimRows() throws {
        let assembler = ResearchImportAssembler()
        let oldDate = Date(timeIntervalSince1970: 1_700_000_000)
        let newDate = Date(timeIntervalSince1970: 1_800_000_000)
        let existingStock = Self.fixtureInventoryListing(id: "existing-stock", stockNumber: "HY-I5-2025-A", firstSeenAt: oldDate, lastSeenAt: oldDate)
        let importedStock = Self.fixtureInventoryListing(id: "imported-stock", stockNumber: "HY-I5-2025-A", firstSeenAt: newDate, lastSeenAt: newDate)
        let existingNoStock = Self.fixtureInventoryListing(id: "existing-no-stock", stockNumber: nil, firstSeenAt: oldDate, lastSeenAt: oldDate)
        let importedNoStock = Self.fixtureInventoryListing(id: "imported-no-stock", stockNumber: nil, firstSeenAt: newDate, lastSeenAt: newDate)

        let merged = assembler.mergedListings(
            existing: [existingStock, existingNoStock],
            imported: [importedStock, importedNoStock]
        )

        XCTAssertEqual(merged.count, 2)
        XCTAssertTrue(merged.allSatisfy { $0.firstSeenAt == oldDate })
        XCTAssertTrue(merged.allSatisfy { $0.lastSeenAt == newDate })
    }

    @MainActor
    func testCompareCSVCanBeGeneratedWithoutSavePanel() {
        let vehicle = SampleData.canonicalVehicles[0]
        let listing = SampleData.listings.first { $0.canonicalVehicleID == vehicle.id }
        let csv = ExportService().compareCSV(
            vehicles: [vehicle],
            listings: listing.map { [$0] } ?? [],
            includeListingPrice: true
        )

        XCTAssertTrue(csv.contains(#""Vehicle","Powertrain","MSRP CAD","Best Listing CAD","Best Listing Dealer""#))
        XCTAssertTrue(csv.contains(vehicle.displayName))
        XCTAssertTrue(csv.contains("Tesla Toronto Lawrence"))
    }

    private static func fixtureInventoryListing(
        id: String,
        stockNumber: String?,
        firstSeenAt: Date,
        lastSeenAt: Date
    ) -> InventoryListing {
        InventoryListing(
            id: id,
            canonicalVehicleID: "hyundai-ioniq-5-preferred-awd-2025",
            stockNumber: stockNumber,
            make: "Hyundai",
            model: "IONIQ 5",
            trim: "Preferred AWD Long Range",
            year: 2025,
            powertrain: .bev,
            dealerName: "Downtown Hyundai",
            city: "Toronto",
            province: "Ontario",
            status: "In Stock",
            advertisedPriceCAD: 55_988,
            msrpCAD: 58_999,
            sourceURL: "https://example.com/\(id)",
            sourceType: .dealer,
            confidence: .high,
            firstSeenAt: firstSeenAt,
            lastSeenAt: lastSeenAt
        )
    }
}
#endif
