import AppModels
import Catalog
import Foundation
import Persistence
#if canImport(Testing)
import Testing

private enum CatalogTestFixtures {
    static func writeResearchImportCSV() throws -> URL {
        let csv = """
        make,model,trim,year,powertrain,dealer,city,province,advertised_price_cad,msrp_cad,stock_or_vin,status,odometer_km,source_url,source_type,observed_date,incentive_discount_notes,finance_offer_notes,confidence_note
        Hyundai,IONIQ 5,Preferred AWD Long Range w/Ultimate Pkg,2026,BEV,Downtown Hyundai,Toronto,Ontario,65649,65649,26668D,In Stock,0,https://www.downtownhyundai.com/inventory/2026-hyundai-ioniq-5-preferred-Gpy5Id8mR0iZKwOoJa3yQQvdp/,Dealer,2026-05-01T14:55:00Z,No seeded federal incentive; EVAP eligibility must be checked by exact trim and final transaction value.,,Dealer page verifies stock VIN price and new condition.
        Toyota,RAV4 Hybrid,XLE,2025,HEV,Outside Scope Toyota,Toronto,Ontario,42000,44000,TOY-RAV4-2025-H1,In Stock,0,https://www.toyota.ca/toyota/en/vehicles/rav4hybrid/overview,Dealer,2026-05-01T14:55:00Z,Outside make.,,Should reject non-Hyundai/Kia.
        """
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("csv")
        try csv.write(to: url, atomically: true, encoding: .utf8)
        return url
    }
}

@MainActor
struct CatalogStoreTests {
    @Test
    func catalogStoreFiltersByPowertrain() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)
        try await database.bootstrapIfNeeded()

        let store = CatalogStore()
        try await store.load(from: database)

        store.selectedPowertrains = [.phev]
        let filtered = store.filteredVehicles

        #expect(filtered.allSatisfy { $0.powertrain == .phev })
    }

    @Test
    func catalogStoreSelectsFirstVehicleOnLoad() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)
        try await database.bootstrapIfNeeded()

        let store = CatalogStore()
        try await store.load(from: database)

        #expect(store.selectedVehicleID != nil)
    }

    @Test
    func catalogStoreLoadsReviewAndSourceCounts() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)
        try await database.bootstrapIfNeeded()

        let store = CatalogStore()
        try await store.load(from: database)

        #expect(store.reviewCount == try await database.fetchReviewQueue().count)
        #expect(store.sourceRunCount == try await database.fetchSourceRuns().count)
    }

    @Test
    func inventoryStoreLoadsSelectedVehicleAndAuxiliaryState() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)
        try await database.bootstrapIfNeeded()

        let store = InventoryStore()
        try await store.load(from: database, vehicleID: "tesla-model3-rwd-2024")

        #expect(store.listings.allSatisfy { $0.canonicalVehicleID == "tesla-model3-rwd-2024" })
        #expect(!store.allSourceRuns.isEmpty)
        #expect(!store.reviewQueue.isEmpty)
        #expect(!store.savedSearches.isEmpty)
        #expect(!store.compareSets.isEmpty)
    }

    @Test
    func inventoryStoreImportsResearchFileIntoDatabaseAndReviewQueue() async throws {
        let databaseURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: databaseURL)
        try await database.bootstrapIfNeeded()

        let importURL = try CatalogTestFixtures.writeResearchImportCSV()
        let store = InventoryStore()
        try await store.load(from: database, vehicleID: nil)
        let initialListingCount = store.inventoryListings.count
        let initialReviewCount = store.reviewQueue.count
        let initialBatchCount = store.researchBatches.count

        try await store.importResearchFile(
            at: importURL,
            provider: .chatGPTDeepResearch,
            prompt: "round trip prompt",
            using: database
        )

        let listings = try await database.fetchInventoryListings()
        let batches = try await database.fetchResearchBatches()
        let reviewItems = try await database.fetchReviewQueue()

        #expect(listings.count == initialListingCount + 1)
        #expect(listings.contains { $0.dealerName == "Downtown Hyundai" && $0.stockNumber == "26668D" })
        #expect(batches.count == initialBatchCount + 1)
        #expect(batches.first?.acceptedRows == 1)
        #expect(batches.first?.rejectedRows == 1)
        #expect(reviewItems.count == initialReviewCount + 1)
        #expect(reviewItems.contains { $0.reason.localizedCaseInsensitiveContains("make must be Hyundai or Kia") })
        #expect(store.selectedInventoryListing?.dealerName == "Downtown Hyundai")
    }

    @Test
    @MainActor
    func compareSelectionCapsAtFourAndTogglesRemoval() {
        let store = CatalogStore()

        store.toggleCompare(vehicleID: "one")
        store.toggleCompare(vehicleID: "two")
        store.toggleCompare(vehicleID: "three")
        store.toggleCompare(vehicleID: "four")
        store.toggleCompare(vehicleID: "five")

        #expect(store.compareVehicleIDs.count == 4)
        #expect(store.compareVehicleIDs.isSuperset(of: ["one", "two", "three", "four"]))

        store.toggleCompare(vehicleID: "two")
        #expect(!store.compareVehicleIDs.contains("two"))
    }
}
#elseif canImport(XCTest)
import XCTest

private enum CatalogTestFixtures {
    static func writeResearchImportCSV() throws -> URL {
        let csv = """
        make,model,trim,year,powertrain,dealer,city,province,advertised_price_cad,msrp_cad,stock_or_vin,status,odometer_km,source_url,source_type,observed_date,incentive_discount_notes,finance_offer_notes,confidence_note
        Hyundai,IONIQ 5,Preferred AWD Long Range w/Ultimate Pkg,2026,BEV,Downtown Hyundai,Toronto,Ontario,65649,65649,26668D,In Stock,0,https://www.downtownhyundai.com/inventory/2026-hyundai-ioniq-5-preferred-Gpy5Id8mR0iZKwOoJa3yQQvdp/,Dealer,2026-05-01T14:55:00Z,No seeded federal incentive; EVAP eligibility must be checked by exact trim and final transaction value.,,Dealer page verifies stock VIN price and new condition.
        Toyota,RAV4 Hybrid,XLE,2025,HEV,Outside Scope Toyota,Toronto,Ontario,42000,44000,TOY-RAV4-2025-H1,In Stock,0,https://www.toyota.ca/toyota/en/vehicles/rav4hybrid/overview,Dealer,2026-05-01T14:55:00Z,Outside make.,,Should reject non-Hyundai/Kia.
        """
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("csv")
        try csv.write(to: url, atomically: true, encoding: .utf8)
        return url
    }
}

@MainActor
final class CatalogStoreTests: XCTestCase {
    func testCatalogStoreFiltersByPowertrain() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)
        try await database.bootstrapIfNeeded()

        let store = CatalogStore()
        try await store.load(from: database)

        store.selectedPowertrains = [.phev]
        let filtered = store.filteredVehicles

        XCTAssertTrue(filtered.allSatisfy { $0.powertrain == .phev })
    }

    func testCatalogStoreSelectsFirstVehicleOnLoad() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)
        try await database.bootstrapIfNeeded()

        let store = CatalogStore()
        try await store.load(from: database)

        XCTAssertNotNil(store.selectedVehicleID)
    }

    func testCatalogStoreLoadsReviewAndSourceCounts() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)
        try await database.bootstrapIfNeeded()

        let store = CatalogStore()
        try await store.load(from: database)

        XCTAssertEqual(store.reviewCount, try await database.fetchReviewQueue().count)
        XCTAssertEqual(store.sourceRunCount, try await database.fetchSourceRuns().count)
    }

    func testInventoryStoreLoadsSelectedVehicleAndAuxiliaryState() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: url)
        try await database.bootstrapIfNeeded()

        let store = InventoryStore()
        try await store.load(from: database, vehicleID: "tesla-model3-rwd-2024")

        XCTAssertTrue(store.listings.allSatisfy { $0.canonicalVehicleID == "tesla-model3-rwd-2024" })
        XCTAssertFalse(store.allSourceRuns.isEmpty)
        XCTAssertFalse(store.reviewQueue.isEmpty)
        XCTAssertFalse(store.savedSearches.isEmpty)
        XCTAssertFalse(store.compareSets.isEmpty)
    }

    func testInventoryStoreImportsResearchFileIntoDatabaseAndReviewQueue() async throws {
        let databaseURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathExtension("sqlite3")
        let database = try AppDatabase(url: databaseURL)
        try await database.bootstrapIfNeeded()

        let importURL = try CatalogTestFixtures.writeResearchImportCSV()
        let store = InventoryStore()
        try await store.load(from: database, vehicleID: nil)
        let initialListingCount = store.inventoryListings.count
        let initialReviewCount = store.reviewQueue.count
        let initialBatchCount = store.researchBatches.count

        try await store.importResearchFile(
            at: importURL,
            provider: .chatGPTDeepResearch,
            prompt: "round trip prompt",
            using: database
        )

        let listings = try await database.fetchInventoryListings()
        let batches = try await database.fetchResearchBatches()
        let reviewItems = try await database.fetchReviewQueue()

        XCTAssertEqual(listings.count, initialListingCount + 1)
        XCTAssertTrue(listings.contains { $0.dealerName == "Downtown Hyundai" && $0.stockNumber == "26668D" })
        XCTAssertEqual(batches.count, initialBatchCount + 1)
        XCTAssertEqual(batches.first?.acceptedRows, 1)
        XCTAssertEqual(batches.first?.rejectedRows, 1)
        XCTAssertEqual(reviewItems.count, initialReviewCount + 1)
        XCTAssertTrue(reviewItems.contains { $0.reason.localizedCaseInsensitiveContains("make must be Hyundai or Kia") })
        XCTAssertEqual(store.selectedInventoryListing?.dealerName, "Downtown Hyundai")
    }

    @MainActor
    func testCompareSelectionCapsAtFourAndTogglesRemoval() {
        let store = CatalogStore()

        store.toggleCompare(vehicleID: "one")
        store.toggleCompare(vehicleID: "two")
        store.toggleCompare(vehicleID: "three")
        store.toggleCompare(vehicleID: "four")
        store.toggleCompare(vehicleID: "five")

        XCTAssertEqual(store.compareVehicleIDs.count, 4)
        XCTAssertTrue(store.compareVehicleIDs.isSuperset(of: ["one", "two", "three", "four"]))

        store.toggleCompare(vehicleID: "two")
        XCTAssertFalse(store.compareVehicleIDs.contains("two"))
    }
}
#endif
