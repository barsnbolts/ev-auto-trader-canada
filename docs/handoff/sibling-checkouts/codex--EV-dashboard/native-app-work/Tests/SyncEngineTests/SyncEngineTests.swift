import AppModels
import Foundation
import Persistence
@testable import SyncEngine

#if canImport(Testing)
import Testing

struct SyncEngineTests {
    @Test
    @MainActor
    func fordRefreshPublishesListingsAndWritesSourceRuns() async throws {
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("sqlite")
        let database = try AppDatabase(url: tempURL)
        try await database.bootstrapIfNeeded()

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FordURLProtocolStub.self]
        let session = URLSession(configuration: configuration)

        let coordinator = SyncCoordinator(adapters: [OEMInventoryAdapter(session: session)])
        try await coordinator.refreshAll(using: database)

        let listings = try await database.fetchListings()
        let fordListings = listings.filter { $0.sourceID == "oem-inventory" && $0.canonicalVehicleID.hasPrefix("ford-mustang-mach-e") }
        #expect(fordListings.count == 3)
        #expect(fordListings.contains(where: { $0.city == "Toronto" && $0.priceCAD == 55_995 }))
        #expect(fordListings.contains(where: { $0.dealerName == "Thorncrest Ford" && $0.locationLabel == "Toronto, ON" }))

        let sourceRuns = try await database.fetchSourceRuns()
        #expect(sourceRuns.contains(where: { $0.sourceID == "oem-inventory" && $0.status == "completed" && $0.publishedRecords >= 3 }))

        let reviewQueue = try await database.fetchReviewQueue()
        #expect(!reviewQueue.contains(where: { $0.rawIdentifier == "3FMTK1S56SMA59233" }))
    }

    @Test
    @MainActor
    func fordRefreshPublishesMSRPFallbackWithMediumConfidence() async throws {
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("sqlite")
        let database = try AppDatabase(url: tempURL)
        try await database.bootstrapIfNeeded()

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FordMSRPFallbackURLProtocolStub.self]
        let session = URLSession(configuration: configuration)

        let coordinator = SyncCoordinator(adapters: [OEMInventoryAdapter(session: session)])
        try await coordinator.refreshAll(using: database)

        let listing = try #require(try await database.fetchListings().first {
            $0.id == "oem-inventory-3FMTK1S56SMA59233"
        })
        #expect(listing.priceCAD == 55_995)
        #expect(listing.confidence == .medium)
        #expect(listing.notes.contains {
            $0.localizedCaseInsensitiveContains("inferred MSRP")
        })

        let sourceRun = try #require(try await database.fetchSourceRuns().first {
            $0.sourceID == "oem-inventory"
        })
        #expect(sourceRun.fetchedRecords == 1)
        #expect(sourceRun.publishedRecords == 1)
        #expect(sourceRun.reviewRecords == 0)
    }

    @Test
    @MainActor
    func fuzzyTrimMatchDoesNotCrossMakeAndModel() async throws {
        let database = try AppDatabase(url: FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("sqlite"))
        try await database.bootstrapIfNeeded()

        let snapshot = RawVehicleSnapshot(
            sourceID: "test-source",
            externalListingID: "cross-make-gt",
            make: "Fictional",
            model: "Different",
            trim: "GT",
            year: 2024,
            powertrain: .bev,
            msrpCAD: 70_000,
            listingPriceCAD: 70_000,
            city: "Toronto",
            province: "Ontario",
            condition: .new,
            sourceURL: "https://example.com/cross-make-gt",
            confidenceHint: .high
        )
        let coordinator = SyncCoordinator(adapters: [StubSnapshotAdapter(sourceID: "oem-inventory", snapshots: [snapshot])])

        try await coordinator.refreshAll(using: database)

        let listings = try await database.fetchListings()
        #expect(!listings.contains { $0.id == "oem-inventory-cross-make-gt" })

        let review = try #require(try await database.fetchReviewQueue().first {
            $0.rawIdentifier == "cross-make-gt"
        })
        #expect(review.severity == .low)
        #expect(review.reason == "No deterministic canonical match.")
    }

    @Test
    @MainActor
    func refreshAllPersistsArbitrarySourceIDs() async throws {
        let database = try AppDatabase(url: FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("sqlite"))
        try await database.bootstrapIfNeeded()

        let snapshot = RawVehicleSnapshot(
            sourceID: "third-source",
            externalListingID: "third-source-mach-e",
            dealerName: "Third Source Ford",
            make: "Ford",
            model: "Mustang Mach-E",
            trim: "Select",
            year: 2025,
            powertrain: .bev,
            msrpCAD: 55_995,
            listingPriceCAD: 54_995,
            city: "Ottawa",
            province: "Ontario",
            condition: .new,
            sourceURL: "https://example.com/third-source-mach-e",
            confidenceHint: .high
        )
        let coordinator = SyncCoordinator(adapters: [StubSnapshotAdapter(sourceID: "third-source", snapshots: [snapshot])])

        try await coordinator.refreshAll(using: database)

        let listings = try await database.fetchListings()
        #expect(listings.contains {
            $0.sourceID == "third-source" &&
            $0.id == "third-source-third-source-mach-e" &&
            $0.dealerName == "Third Source Ford"
        })

        let sourceRuns = try await database.fetchSourceRuns()
        #expect(sourceRuns.contains {
            $0.sourceID == "third-source" &&
            $0.status == "completed" &&
            $0.publishedRecords == 1
        })
    }

    @Test
    func volkswagenAdapterMapsID4InventoryJSON() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [VolkswagenURLProtocolStub.self]
        let session = URLSession(configuration: configuration)
        let adapter = VolkswagenCanadaInventoryAdapter(
            session: session,
            endpoint: URL(string: "https://globalapi.vwtools.ca/inventory-app/vehicles?postal_code=M5V%202T6&distance=100&category=new&model=id4&limit=1")!
        )

        let snapshots = try await adapter.fetchSnapshots()
        let snapshot = try #require(snapshots.first)

        #expect(snapshot.sourceID == "vw-canada-inventory")
        #expect(snapshot.externalListingID == "1V29SPE84SC001385")
        #expect(snapshot.make == "Volkswagen")
        #expect(snapshot.model == "ID.4")
        #expect(snapshot.trim == "PRO S AWD")
        #expect(snapshot.year == 2025)
        #expect(snapshot.listingPriceCAD == 60_495)
        #expect(snapshot.msrpCAD == 60_842)
        #expect(snapshot.dealerName == "Owasco Volkswagen")
        #expect(snapshot.city == "Whitby")
        #expect(snapshot.province == "Ontario")
        #expect(snapshot.sourceURL.contains("owascovw.ca"))
        #expect(snapshot.notes.contains { $0.contains("Stock number: VN294") })
    }
}
#elseif canImport(XCTest)
import XCTest

final class SyncEngineTests: XCTestCase {
    @MainActor
    func testFordRefreshPublishesListingsAndWritesSourceRuns() async throws {
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("sqlite")
        let database = try AppDatabase(url: tempURL)
        try await database.bootstrapIfNeeded()

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FordURLProtocolStub.self]
        let session = URLSession(configuration: configuration)

        let coordinator = SyncCoordinator(adapters: [OEMInventoryAdapter(session: session)])
        try await coordinator.refreshAll(using: database)

        let listings = try await database.fetchListings()
        let fordListings = listings.filter { $0.sourceID == "oem-inventory" && $0.canonicalVehicleID.hasPrefix("ford-mustang-mach-e") }
        XCTAssertEqual(fordListings.count, 3)
        XCTAssertTrue(fordListings.contains(where: { $0.city == "Toronto" && $0.priceCAD == 55_995 }))
        XCTAssertTrue(fordListings.contains(where: { $0.dealerName == "Thorncrest Ford" && $0.locationLabel == "Toronto, ON" }))

        let sourceRuns = try await database.fetchSourceRuns()
        XCTAssertTrue(sourceRuns.contains(where: { $0.sourceID == "oem-inventory" && $0.status == "completed" && $0.publishedRecords >= 3 }))

        let reviewQueue = try await database.fetchReviewQueue()
        XCTAssertFalse(reviewQueue.contains(where: { $0.rawIdentifier == "3FMTK1S56SMA59233" }))
    }

    @MainActor
    func testFordRefreshPublishesMSRPFallbackWithMediumConfidence() async throws {
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("sqlite")
        let database = try AppDatabase(url: tempURL)
        try await database.bootstrapIfNeeded()

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FordMSRPFallbackURLProtocolStub.self]
        let session = URLSession(configuration: configuration)

        let coordinator = SyncCoordinator(adapters: [OEMInventoryAdapter(session: session)])
        try await coordinator.refreshAll(using: database)

        let listing = try XCTUnwrap(try await database.fetchListings().first {
            $0.id == "oem-inventory-3FMTK1S56SMA59233"
        })
        XCTAssertEqual(listing.priceCAD, 55_995)
        XCTAssertEqual(listing.confidence, .medium)
        XCTAssertTrue(listing.notes.contains {
            $0.localizedCaseInsensitiveContains("inferred MSRP")
        })

        let sourceRun = try XCTUnwrap(try await database.fetchSourceRuns().first {
            $0.sourceID == "oem-inventory"
        })
        XCTAssertEqual(sourceRun.fetchedRecords, 1)
        XCTAssertEqual(sourceRun.publishedRecords, 1)
        XCTAssertEqual(sourceRun.reviewRecords, 0)
    }

    @MainActor
    func testFuzzyTrimMatchDoesNotCrossMakeAndModel() async throws {
        let database = try AppDatabase(url: FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("sqlite"))
        try await database.bootstrapIfNeeded()

        let snapshot = RawVehicleSnapshot(
            sourceID: "test-source",
            externalListingID: "cross-make-gt",
            make: "Fictional",
            model: "Different",
            trim: "GT",
            year: 2024,
            powertrain: .bev,
            msrpCAD: 70_000,
            listingPriceCAD: 70_000,
            city: "Toronto",
            province: "Ontario",
            condition: .new,
            sourceURL: "https://example.com/cross-make-gt",
            confidenceHint: .high
        )
        let coordinator = SyncCoordinator(adapters: [StubSnapshotAdapter(sourceID: "oem-inventory", snapshots: [snapshot])])

        try await coordinator.refreshAll(using: database)

        let listings = try await database.fetchListings()
        XCTAssertFalse(listings.contains { $0.id == "oem-inventory-cross-make-gt" })

        let review = try XCTUnwrap(try await database.fetchReviewQueue().first {
            $0.rawIdentifier == "cross-make-gt"
        })
        XCTAssertEqual(review.severity, .low)
        XCTAssertEqual(review.reason, "No deterministic canonical match.")
    }

    @MainActor
    func testRefreshAllPersistsArbitrarySourceIDs() async throws {
        let database = try AppDatabase(url: FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("sqlite"))
        try await database.bootstrapIfNeeded()

        let snapshot = RawVehicleSnapshot(
            sourceID: "third-source",
            externalListingID: "third-source-mach-e",
            dealerName: "Third Source Ford",
            make: "Ford",
            model: "Mustang Mach-E",
            trim: "Select",
            year: 2025,
            powertrain: .bev,
            msrpCAD: 55_995,
            listingPriceCAD: 54_995,
            city: "Ottawa",
            province: "Ontario",
            condition: .new,
            sourceURL: "https://example.com/third-source-mach-e",
            confidenceHint: .high
        )
        let coordinator = SyncCoordinator(adapters: [StubSnapshotAdapter(sourceID: "third-source", snapshots: [snapshot])])

        try await coordinator.refreshAll(using: database)

        let listings = try await database.fetchListings()
        XCTAssertTrue(listings.contains {
            $0.sourceID == "third-source" &&
            $0.id == "third-source-third-source-mach-e" &&
            $0.dealerName == "Third Source Ford"
        })

        let sourceRuns = try await database.fetchSourceRuns()
        XCTAssertTrue(sourceRuns.contains {
            $0.sourceID == "third-source" &&
            $0.status == "completed" &&
            $0.publishedRecords == 1
        })
    }

    func testVolkswagenAdapterMapsID4InventoryJSON() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [VolkswagenURLProtocolStub.self]
        let session = URLSession(configuration: configuration)
        let adapter = VolkswagenCanadaInventoryAdapter(
            session: session,
            endpoint: URL(string: "https://globalapi.vwtools.ca/inventory-app/vehicles?postal_code=M5V%202T6&distance=100&category=new&model=id4&limit=1")!
        )

        let snapshots = try await adapter.fetchSnapshots()
        let snapshot = try XCTUnwrap(snapshots.first)

        XCTAssertEqual(snapshot.sourceID, "vw-canada-inventory")
        XCTAssertEqual(snapshot.externalListingID, "1V29SPE84SC001385")
        XCTAssertEqual(snapshot.make, "Volkswagen")
        XCTAssertEqual(snapshot.model, "ID.4")
        XCTAssertEqual(snapshot.trim, "PRO S AWD")
        XCTAssertEqual(snapshot.year, 2025)
        XCTAssertEqual(snapshot.listingPriceCAD, 60_495)
        XCTAssertEqual(snapshot.msrpCAD, 60_842)
        XCTAssertEqual(snapshot.dealerName, "Owasco Volkswagen")
        XCTAssertEqual(snapshot.city, "Whitby")
        XCTAssertEqual(snapshot.province, "Ontario")
        XCTAssertTrue(snapshot.sourceURL.contains("owascovw.ca"))
        XCTAssertTrue(snapshot.notes.contains { $0.contains("Stock number: VN294") })
    }
}
#endif

private let stubResponses: [String: Data] = [
    "https://www.ford.ca/inventory/details/ford/en_ca/mach-e/vin/3FMTK1S56SMA59233": makeHTML(
        title: "2025 Mustang Mach-E Select",
        vin: "3FMTK1S56SMA59233",
        status: "Just Arrived",
        dealer: "Thorncrest Ford",
        address: "1575 The Queensway, Toronto, ON M8Z1T9",
        package: "Select (100A)",
        price: "$55,995"
    ),
    "https://www.ford.ca/inventory/details/ford/en_ca/mach-e/vin/3FMTK4SX4SMA55278": makeHTML(
        title: "2025 Mustang Mach-E GT",
        vin: "3FMTK4SX4SMA55278",
        status: "In Stock",
        dealer: "Erinwood Ford Sales Inc.",
        address: "2395 Motorway Blvd, Mississauga, ON L5L1V4",
        package: "GT (400A)",
        price: "$76,995"
    ),
    "https://www.ford.ca/inventory/details/ford/en_ca/mach-e/vin/3FMTK3SU5TMA02851": makeHTML(
        title: "2026 Mustang Mach-E Premium",
        vin: "3FMTK3SU5TMA02851",
        status: "In Stock",
        dealer: "Airport Ford Lincoln",
        address: "49 Rymal Rd E, Hamilton, ON L9B1B9",
        package: "Premium (300A)",
        price: "$66,995"
    )
]

private func makeHTML(
    title: String,
    vin: String,
    status: String,
    dealer: String,
    address: String,
    package: String,
    price: String?
) -> Data {
    let priceHTML = price.map { "<div>Cash Purchase Price</div><div>\($0)</div>" } ?? ""
    return Data("""
    <html>
    <body>
      <h1>\(title)</h1>
      <div>VIN: \(vin)</div>
      <div>\(status)</div>
      <h2>Vehicle Location</h2>
      <div>\(dealer)</div>
      <div>\(address)</div>
      <div>Package</div><div>\(package)</div>
      \(priceHTML)
    </body>
    </html>
    """.utf8)
}

private final class FordURLProtocolStub: URLProtocol, @unchecked Sendable {
    static let responses = stubResponses

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard
            let url = request.url,
            let data = Self.responses[url.absoluteString]
        else {
            client?.urlProtocol(self, didFailWithError: URLError(.fileDoesNotExist))
            return
        }

        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private final class FordMSRPFallbackURLProtocolStub: URLProtocol, @unchecked Sendable {
    static let responses: [String: Data] = [
        "https://www.ford.ca/inventory/details/ford/en_ca/mach-e/vin/3FMTK1S56SMA59233": makeHTML(
            title: "2025 Mustang Mach-E Select",
            vin: "3FMTK1S56SMA59233",
            status: "Just Arrived",
            dealer: "Thorncrest Ford",
            address: "1575 The Queensway, Toronto, ON M8Z1T9",
            package: "Select (100A)",
            price: nil
        )
    ]

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard
            let url = request.url,
            let data = Self.responses[url.absoluteString]
        else {
            client?.urlProtocol(self, didFailWithError: URLError(.fileDoesNotExist))
            return
        }

        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private final class VolkswagenURLProtocolStub: URLProtocol, @unchecked Sendable {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: volkswagenInventoryJSON)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private struct StubSnapshotAdapter: SourceAdapter {
    let sourceID: String
    let displayName = "Stub Inventory"
    let snapshots: [RawVehicleSnapshot]

    func fetchSnapshots() async throws -> [RawVehicleSnapshot] {
        snapshots
    }
}

private let volkswagenInventoryJSON = Data("""
{
  "data": [
    {
      "vin": "1V29SPE84SC001385",
      "trim": { "en": "ID.4 PRO S AWD", "fr": "ID.4 PRO S AWD" },
      "year": 2025,
      "price": 60495,
      "category": "new",
      "in_stock": true,
      "in_transit": false,
      "model_name": "ID.4",
      "stock_number": "VN294",
      "inventory_date": "2025-04-04",
      "dealer_info": {
        "city": "Whitby",
        "website": "https://www.owascovw.ca/en/",
        "fullname": "Owasco Volkswagen",
        "province": "ON"
      },
      "deeplink": {
        "en": "https://www.owascovw.ca/new/inventory/Volkswagen-ID.4-2025-id12190117.html",
        "fr": "https://www.owascovw.ca/new/inventory/Volkswagen-ID.4-2025-id12190117.html"
      },
      "pcs": {
        "en": {
          "price": { "label": "MSRP", "value": 60842 }
        }
      }
    }
  ]
}
""".utf8)
