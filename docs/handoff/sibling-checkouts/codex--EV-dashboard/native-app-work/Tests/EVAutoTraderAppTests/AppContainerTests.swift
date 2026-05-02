import AppModels
import Foundation
import Persistence
import SyncEngine
@testable import EVAutoTraderApp

#if canImport(Testing)
import Testing

struct AppContainerTests {
    @Test
    @MainActor
    func refreshLoadsRunsAndReviewStateThroughAppContainer() async throws {
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("sqlite")
        let database = try AppDatabase(url: tempURL)
        try await database.bootstrapIfNeeded()

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [AppContainerURLProtocolStub.self]
        let session = URLSession(configuration: configuration)

        let container = AppContainer(
            database: database,
            syncCoordinator: SyncCoordinator(adapters: [OEMInventoryAdapter(session: session)])
        )

        await container.refresh()

        #expect(container.lastSyncError == nil)
        #expect(container.syncCoordinator.status == "Up to date")
        #expect(container.catalogStore.sourceRunCount == 1)
        #expect(container.catalogStore.reviewCount == 0)
        #expect(container.inventoryStore.allSourceRuns.count == 1)
        #expect(container.inventoryStore.reviewQueue.isEmpty)

        let listings = try await database.fetchListings()
        #expect(listings.contains(where: { $0.sourceID == "oem-inventory" && $0.canonicalVehicleID.hasPrefix("ford-mustang-mach-e") }))
    }

    @Test
    @MainActor
    func refreshSurfacesFailedSourceRunWithoutCrashingContainer() async throws {
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("sqlite")
        let database = try AppDatabase(url: tempURL)
        try await database.bootstrapIfNeeded()

        let container = AppContainer(
            database: database,
            syncCoordinator: SyncCoordinator(adapters: [FailingSourceAdapter()])
        )

        await container.refresh()

        #expect(container.lastSyncError == nil)
        let failedRun = try #require(container.inventoryStore.allSourceRuns.first {
            $0.sourceID == "oem-inventory"
        })
        #expect(failedRun.status == "failed")
        #expect(failedRun.errorMessage?.isEmpty == false)
    }
}
#elseif canImport(XCTest)
import XCTest

final class AppContainerTests: XCTestCase {
    @MainActor
    func testRefreshLoadsRunsAndReviewStateThroughAppContainer() async throws {
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("sqlite")
        let database = try AppDatabase(url: tempURL)
        try await database.bootstrapIfNeeded()

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [AppContainerURLProtocolStub.self]
        let session = URLSession(configuration: configuration)

        let container = AppContainer(
            database: database,
            syncCoordinator: SyncCoordinator(adapters: [OEMInventoryAdapter(session: session)])
        )

        await container.refresh()

        XCTAssertNil(container.lastSyncError)
        XCTAssertEqual(container.syncCoordinator.status, "Up to date")
        XCTAssertEqual(container.catalogStore.sourceRunCount, 1)
        XCTAssertEqual(container.catalogStore.reviewCount, 0)
        XCTAssertEqual(container.inventoryStore.allSourceRuns.count, 1)
        XCTAssertTrue(container.inventoryStore.reviewQueue.isEmpty)

        let listings = try await database.fetchListings()
        XCTAssertTrue(listings.contains(where: { $0.sourceID == "oem-inventory" && $0.canonicalVehicleID.hasPrefix("ford-mustang-mach-e") }))
    }

    @MainActor
    func testRefreshSurfacesFailedSourceRunWithoutCrashingContainer() async throws {
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("sqlite")
        let database = try AppDatabase(url: tempURL)
        try await database.bootstrapIfNeeded()

        let container = AppContainer(
            database: database,
            syncCoordinator: SyncCoordinator(adapters: [FailingSourceAdapter()])
        )

        await container.refresh()

        XCTAssertNil(container.lastSyncError)
        let failedRun = try XCTUnwrap(container.inventoryStore.allSourceRuns.first {
            $0.sourceID == "oem-inventory"
        })
        XCTAssertEqual(failedRun.status, "failed")
        XCTAssertEqual(failedRun.errorMessage?.isEmpty, false)
    }
}
#endif

private let appContainerStubResponses: [String: Data] = [
    "https://www.ford.ca/inventory/details/ford/en_ca/mach-e/vin/3FMTK1S56SMA59233": makeFordHTML(
        title: "2025 Mustang Mach-E Select",
        vin: "3FMTK1S56SMA59233",
        status: "Just Arrived",
        dealer: "Thorncrest Ford",
        address: "1575 The Queensway, Toronto, ON M8Z1T9",
        package: "Select (100A)",
        price: "$55,995"
    ),
    "https://www.ford.ca/inventory/details/ford/en_ca/mach-e/vin/3FMTK4SX4SMA55278": makeFordHTML(
        title: "2025 Mustang Mach-E GT",
        vin: "3FMTK4SX4SMA55278",
        status: "In Stock",
        dealer: "Erinwood Ford Sales Inc.",
        address: "2395 Motorway Blvd, Mississauga, ON L5L1V4",
        package: "GT (400A)",
        price: "$76,995"
    ),
    "https://www.ford.ca/inventory/details/ford/en_ca/mach-e/vin/3FMTK3SU5TMA02851": makeFordHTML(
        title: "2026 Mustang Mach-E Premium",
        vin: "3FMTK3SU5TMA02851",
        status: "In Stock",
        dealer: "Airport Ford Lincoln",
        address: "49 Rymal Rd E, Hamilton, ON L9B1B9",
        package: "Premium (300A)",
        price: "$66,995"
    )
]

private func makeFordHTML(
    title: String,
    vin: String,
    status: String,
    dealer: String,
    address: String,
    package: String,
    price: String
) -> Data {
    Data("""
    <html>
    <body>
      <h1>\(title)</h1>
      <div>VIN: \(vin)</div>
      <div>\(status)</div>
      <h2>Vehicle Location</h2>
      <div>\(dealer)</div>
      <div>\(address)</div>
      <div>Package</div><div>\(package)</div>
      <div>Cash Purchase Price</div><div>\(price)</div>
    </body>
    </html>
    """.utf8)
}

private final class AppContainerURLProtocolStub: URLProtocol, @unchecked Sendable {
    static let responses = appContainerStubResponses

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

private struct FailingSourceAdapter: SourceAdapter {
    let sourceID = "oem-inventory"
    let displayName = "Failing Ford Stub"

    func fetchSnapshots() async throws -> [RawVehicleSnapshot] {
        throw URLError(.cannotLoadFromNetwork)
    }
}
