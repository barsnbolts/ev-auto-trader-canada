import AppModels
import Calculators
import Foundation
import SeedData
#if canImport(Testing)
import Testing

struct CalculatorTests {
    @Test
    func rangeCalculatorRespondsToColdWeather() {
        let calculator = RangeCalculator()
        let vehicle = #require(SampleData.canonicalVehicles.first { $0.id == "tesla-model3-rwd-2024" })

        let mild = calculator.estimate(for: vehicle, temperatureC: 22, isPreconditioned: true, view: .combined)
        let cold = calculator.estimate(for: vehicle, temperatureC: -10, isPreconditioned: false, view: .combined)

        #expect(mild.combinedKm > cold.combinedKm)
    }

    @Test
    func chargingCalculatorReturnsTenToEightyEstimate() {
        let calculator = ChargingCalculator()
        let vehicle = #require(SampleData.canonicalVehicles.first { $0.id == "kia-ev9-land-awd-2024" })

        let estimate = calculator.estimateTenToEighty(for: vehicle)
        #expect(estimate.tenToEightyMinutes == 24)
    }

    @Test
    func preconditioningImprovesColdWeatherEstimate() throws {
        let calculator = RangeCalculator()
        let vehicle = try #require(SampleData.canonicalVehicles.first { $0.id == "tesla-model3-rwd-2024" })

        let cold = calculator.estimate(for: vehicle, temperatureC: -15, isPreconditioned: false, view: .combined)
        let preconditioned = calculator.estimate(for: vehicle, temperatureC: -15, isPreconditioned: true, view: .combined)

        #expect(preconditioned.combinedKm > cold.combinedKm)
    }

    @Test
    func leverageCalculatorPrioritizesDealerWeaknessSignals() throws {
        let calculator = LeverageCalculator()
        let ranked = calculator.rankedListings(
            SampleData.inventoryListings,
            incentives: SampleData.incentivePrograms,
            financeOffers: SampleData.financeOffers
        )

        let top = try #require(ranked.first)
        #expect(top.listing.sourceURL.hasPrefix("https://"))
        #expect(!top.listing.sourceURL.contains("example.com"))
        #expect(top.score.dealerWeakness > 50)
        #expect(top.score.reasons.contains { $0.localizedCaseInsensitiveContains("in stock") || $0.localizedCaseInsensitiveContains("leftover") })
    }

    @Test
    func hevRangeUsesHybridSpecificNote() throws {
        let calculator = RangeCalculator()
        let vehicle = try #require(SampleData.dealLeverageCanonicalVehicles.first { $0.powertrain == .hev })

        let estimate = calculator.estimate(for: vehicle, temperatureC: 0, isPreconditioned: false, view: .combined)
        #expect(estimate.combinedKm == 0)
        #expect(estimate.note.localizedCaseInsensitiveContains("Hybrid"))
    }

    @Test
    func leverageCalculatorPenalizesStaleMarketplaceEvidence() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let freshDealer = Self.fixtureListing(
            id: "fresh-dealer",
            sourceType: .dealer,
            confidence: .high,
            lastSeenAt: now
        )
        let staleMarketplace = Self.fixtureListing(
            id: "stale-marketplace",
            sourceType: .marketplace,
            confidence: .low,
            lastSeenAt: now.addingTimeInterval(-45 * 86_400)
        )
        let calculator = LeverageCalculator()

        let freshScore = calculator.score(
            listing: freshDealer,
            allListings: [freshDealer, staleMarketplace],
            incentives: [],
            financeOffers: [],
            now: now
        )
        let staleScore = calculator.score(
            listing: staleMarketplace,
            allListings: [freshDealer, staleMarketplace],
            incentives: [],
            financeOffers: [],
            now: now
        )

        #expect(freshScore.evidenceQuality > staleScore.evidenceQuality)
        #expect(staleScore.reasons.contains { $0.localizedCaseInsensitiveContains("Marketplace evidence") })
        #expect(staleScore.reasons.contains { $0.localizedCaseInsensitiveContains("more than 30 days old") })
    }

    private static func fixtureListing(
        id: String,
        sourceType: ResearchSourceType,
        confidence: ConfidenceLevel,
        lastSeenAt: Date
    ) -> InventoryListing {
        InventoryListing(
            id: id,
            canonicalVehicleID: "hyundai-ioniq-5-preferred-awd-2025",
            stockNumber: id,
            make: "Hyundai",
            model: "IONIQ 5",
            trim: "Preferred AWD Long Range",
            year: 2025,
            powertrain: .bev,
            dealerName: id,
            city: "Toronto",
            province: "Ontario",
            status: "In Stock",
            advertisedPriceCAD: 56_000,
            msrpCAD: 58_999,
            sourceURL: "https://example.com/\(id)",
            sourceType: sourceType,
            confidence: confidence,
            firstSeenAt: lastSeenAt.addingTimeInterval(-7 * 86_400),
            lastSeenAt: lastSeenAt
        )
    }
}
#elseif canImport(XCTest)
import XCTest

final class CalculatorTests: XCTestCase {
    func testRangeCalculatorRespondsToColdWeather() {
        let calculator = RangeCalculator()
        let vehicle = SampleData.canonicalVehicles.first { $0.id == "tesla-model3-rwd-2024" }!

        let mild = calculator.estimate(for: vehicle, temperatureC: 22, isPreconditioned: true, view: .combined)
        let cold = calculator.estimate(for: vehicle, temperatureC: -10, isPreconditioned: false, view: .combined)

        XCTAssertGreaterThan(mild.combinedKm, cold.combinedKm)
    }

    func testChargingCalculatorReturnsTenToEightyEstimate() {
        let calculator = ChargingCalculator()
        let vehicle = SampleData.canonicalVehicles.first { $0.id == "kia-ev9-land-awd-2024" }!

        let estimate = calculator.estimateTenToEighty(for: vehicle)
        XCTAssertEqual(estimate.tenToEightyMinutes, 24)
    }

    func testPreconditioningImprovesColdWeatherEstimate() throws {
        let calculator = RangeCalculator()
        let vehicle = SampleData.canonicalVehicles.first { $0.id == "tesla-model3-rwd-2024" }!

        let cold = calculator.estimate(for: vehicle, temperatureC: -15, isPreconditioned: false, view: .combined)
        let preconditioned = calculator.estimate(for: vehicle, temperatureC: -15, isPreconditioned: true, view: .combined)

        XCTAssertGreaterThan(preconditioned.combinedKm, cold.combinedKm)
    }

    func testLeverageCalculatorPrioritizesDealerWeaknessSignals() throws {
        let calculator = LeverageCalculator()
        let ranked = calculator.rankedListings(
            SampleData.inventoryListings,
            incentives: SampleData.incentivePrograms,
            financeOffers: SampleData.financeOffers
        )

        let top = try XCTUnwrap(ranked.first)
        XCTAssertTrue(top.listing.sourceURL.hasPrefix("https://"))
        XCTAssertFalse(top.listing.sourceURL.contains("example.com"))
        XCTAssertGreaterThan(top.score.dealerWeakness, 50)
        XCTAssertTrue(top.score.reasons.contains { $0.localizedCaseInsensitiveContains("in stock") || $0.localizedCaseInsensitiveContains("leftover") })
    }

    func testHEVRangeUsesHybridSpecificNote() throws {
        let calculator = RangeCalculator()
        let vehicle = try XCTUnwrap(SampleData.dealLeverageCanonicalVehicles.first { $0.powertrain == .hev })

        let estimate = calculator.estimate(for: vehicle, temperatureC: 0, isPreconditioned: false, view: .combined)
        XCTAssertEqual(estimate.combinedKm, 0)
        XCTAssertTrue(estimate.note.localizedCaseInsensitiveContains("Hybrid"))
    }

    func testLeverageCalculatorPenalizesStaleMarketplaceEvidence() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let freshDealer = Self.fixtureListing(
            id: "fresh-dealer",
            sourceType: .dealer,
            confidence: .high,
            lastSeenAt: now
        )
        let staleMarketplace = Self.fixtureListing(
            id: "stale-marketplace",
            sourceType: .marketplace,
            confidence: .low,
            lastSeenAt: now.addingTimeInterval(-45 * 86_400)
        )
        let calculator = LeverageCalculator()

        let freshScore = calculator.score(
            listing: freshDealer,
            allListings: [freshDealer, staleMarketplace],
            incentives: [],
            financeOffers: [],
            now: now
        )
        let staleScore = calculator.score(
            listing: staleMarketplace,
            allListings: [freshDealer, staleMarketplace],
            incentives: [],
            financeOffers: [],
            now: now
        )

        XCTAssertGreaterThan(freshScore.evidenceQuality, staleScore.evidenceQuality)
        XCTAssertTrue(staleScore.reasons.contains { $0.localizedCaseInsensitiveContains("Marketplace evidence") })
        XCTAssertTrue(staleScore.reasons.contains { $0.localizedCaseInsensitiveContains("more than 30 days old") })
    }

    private static func fixtureListing(
        id: String,
        sourceType: ResearchSourceType,
        confidence: ConfidenceLevel,
        lastSeenAt: Date
    ) -> InventoryListing {
        InventoryListing(
            id: id,
            canonicalVehicleID: "hyundai-ioniq-5-preferred-awd-2025",
            stockNumber: id,
            make: "Hyundai",
            model: "IONIQ 5",
            trim: "Preferred AWD Long Range",
            year: 2025,
            powertrain: .bev,
            dealerName: id,
            city: "Toronto",
            province: "Ontario",
            status: "In Stock",
            advertisedPriceCAD: 56_000,
            msrpCAD: 58_999,
            sourceURL: "https://example.com/\(id)",
            sourceType: sourceType,
            confidence: confidence,
            firstSeenAt: lastSeenAt.addingTimeInterval(-7 * 86_400),
            lastSeenAt: lastSeenAt
        )
    }
}
#endif
