import AppModels
import Catalog
import Persistence
#if canImport(Testing)
import Testing

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
