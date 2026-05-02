import AppModels
import Foundation

public struct ScoredInventoryListing: Identifiable, Hashable, Sendable {
    public var id: String { listing.id }
    public let listing: InventoryListing
    public let score: LeverageScore

    public init(listing: InventoryListing, score: LeverageScore) {
        self.listing = listing
        self.score = score
    }
}

public struct LeverageCalculator: Sendable {
    public init() {}

    public func rankedListings(
        _ listings: [InventoryListing],
        incentives: [IncentiveProgram],
        financeOffers: [FinanceOffer],
        now: Date = .now
    ) -> [ScoredInventoryListing] {
        listings
            .filter { $0.condition == .new }
            .map {
                ScoredInventoryListing(
                    listing: $0,
                    score: score(
                        listing: $0,
                        allListings: listings,
                        incentives: incentives,
                        financeOffers: financeOffers,
                        now: now
                    )
                )
            }
            .sorted {
                if Int($0.score.total.rounded()) == Int($1.score.total.rounded()) {
                    return $0.listing.priceBreakdown.effectivePreTaxPriceCAD < $1.listing.priceBreakdown.effectivePreTaxPriceCAD
                }
                return $0.score.total > $1.score.total
            }
    }

    public func score(
        listing: InventoryListing,
        allListings: [InventoryListing],
        incentives: [IncentiveProgram],
        financeOffers: [FinanceOffer],
        now: Date = .now
    ) -> LeverageScore {
        var reasons: [String] = []
        let dealerWeakness = dealerWeaknessScore(for: listing, allListings: allListings, now: now, reasons: &reasons)
        let discountGap = discountGapScore(for: listing, allListings: allListings, reasons: &reasons)
        let supplyPressure = supplyPressureScore(for: listing, allListings: allListings, reasons: &reasons)
        let incentivesScore = incentiveScore(for: listing, incentives: incentives, financeOffers: financeOffers, reasons: &reasons)
        let evidenceQuality = evidenceQualityScore(for: listing, now: now, reasons: &reasons)

        let total = (
            dealerWeakness * 0.30 +
            discountGap * 0.25 +
            supplyPressure * 0.20 +
            incentivesScore * 0.15 +
            evidenceQuality * 0.10
        )

        return LeverageScore(
            inventoryListingID: listing.id,
            total: min(100, max(0, total)),
            dealerWeakness: dealerWeakness,
            discountGap: discountGap,
            supplyPressure: supplyPressure,
            incentives: incentivesScore,
            evidenceQuality: evidenceQuality,
            reasons: reasons
        )
    }

    private func dealerWeaknessScore(
        for listing: InventoryListing,
        allListings: [InventoryListing],
        now: Date,
        reasons: inout [String]
    ) -> Double {
        var score = 0.0

        if listing.year == 2025 {
            score += 35
            reasons.append("2025 stock is a leftover against 2026 availability.")
        }

        if let odometer = listing.odometerKm, odometer >= 100 {
            score += min(25, Double(odometer) / 80)
            reasons.append("Demo or test-drive mileage gives room to push.")
        }

        let ageDays = now.timeIntervalSince(listing.firstSeenAt) / 86_400
        if ageDays >= 45 {
            score += 25
            reasons.append("Listing has been observed for \(Int(ageDays)) days.")
        } else if ageDays >= 21 {
            score += 12
            reasons.append("Listing has been sitting for more than three weeks.")
        }

        let sameDealerSameTrim = allListings.filter {
            $0.dealerName == listing.dealerName &&
            $0.model == listing.model &&
            $0.trim == listing.trim &&
            $0.year == listing.year
        }.count
        if sameDealerSameTrim > 1 {
            score += 15
            reasons.append("Dealer has duplicate same-trim inventory.")
        }

        if listing.status.localizedCaseInsensitiveContains("in stock") {
            score += 8
            reasons.append("Vehicle is in stock now, not merely inbound.")
        }

        return min(100, score)
    }

    private func discountGapScore(
        for listing: InventoryListing,
        allListings: [InventoryListing],
        reasons: inout [String]
    ) -> Double {
        let msrp = max(listing.msrpCAD, 1)
        let discount = listing.priceBreakdown.discountFromMSRPCAD
        var score = min(100, (discount / msrp) * 1_250)

        let peers = allListings.filter {
            $0.year == listing.year &&
            $0.make == listing.make &&
            $0.model == listing.model &&
            $0.trim == listing.trim
        }
        if peers.count >= 2 {
            let median = median(peers.map(\.advertisedPriceCAD))
            if listing.advertisedPriceCAD < median {
                let advantage = median - listing.advertisedPriceCAD
                score += min(25, (advantage / msrp) * 1_000)
                reasons.append("Advertised price beats same-trim median by \(currency(advantage)).")
            }
        }

        if discount > 0 {
            reasons.append("Visible discount from MSRP is \(currency(discount)).")
        }

        return min(100, score)
    }

    private func supplyPressureScore(
        for listing: InventoryListing,
        allListings: [InventoryListing],
        reasons: inout [String]
    ) -> Double {
        let sameTrim = allListings.filter {
            $0.year == listing.year &&
            $0.make == listing.make &&
            $0.model == listing.model &&
            $0.trim == listing.trim
        }
        let competingDealers = Set(sameTrim.map(\.dealerName)).subtracting([listing.dealerName])
        let ontarioAlternatives = sameTrim.filter { $0.province == "Ontario" && $0.id != listing.id }.count

        if !competingDealers.isEmpty {
            reasons.append("\(competingDealers.count) competing dealer\(competingDealers.count == 1 ? "" : "s") have comparable stock.")
        }
        if ontarioAlternatives > 0 {
            reasons.append("\(ontarioAlternatives) Ontario alternative\(ontarioAlternatives == 1 ? "" : "s") can anchor negotiation.")
        }

        return min(100, Double(sameTrim.count - 1) * 18 + Double(competingDealers.count) * 12)
    }

    private func incentiveScore(
        for listing: InventoryListing,
        incentives: [IncentiveProgram],
        financeOffers: [FinanceOffer],
        reasons: inout [String]
    ) -> Double {
        var score = 0.0

        let matchingIncentives = incentives.filter { incentive in
            let makeMatches = incentive.applicableMakes.isEmpty || incentive.applicableMakes.contains {
                $0.caseInsensitiveCompare(listing.make) == .orderedSame
            }
            let modelMatches = incentive.applicableModels.isEmpty || incentive.applicableModels.contains {
                listing.model.localizedCaseInsensitiveContains($0) || $0.localizedCaseInsensitiveContains(listing.model)
            }
            return makeMatches && modelMatches
        }

        if listing.priceBreakdown.incentiveAmountCAD > 0 {
            score += 40
            reasons.append("Imported incentive amount is \(currency(listing.priceBreakdown.incentiveAmountCAD)).")
        }

        if listing.priceBreakdown.manufacturerDiscountCAD > 0 {
            score += 25
            reasons.append("Manufacturer/OEM discount is visible.")
        }

        if !matchingIncentives.isEmpty {
            score += min(25, Double(matchingIncentives.count) * 12)
            reasons.append("\(matchingIncentives.count) matching incentive program\(matchingIncentives.count == 1 ? "" : "s") need dealer confirmation.")
        }

        if financeOffers.contains(where: { $0.listingID == listing.id }) {
            score += 10
            reasons.append("Dealer/OEM finance offer is attached; compare APR and fees directly.")
        }

        return min(100, score)
    }

    private func evidenceQualityScore(
        for listing: InventoryListing,
        now: Date,
        reasons: inout [String]
    ) -> Double {
        var score: Double
        switch listing.confidence {
        case .high: score = 70
        case .medium: score = 45
        case .low: score = 20
        }

        switch listing.sourceType {
        case .dealer, .oem:
            score += 20
            reasons.append("Evidence comes from a direct \(listing.sourceType.rawValue) source.")
        case .marketplace:
            score += 5
            reasons.append("Marketplace evidence is useful leverage but lower confidence.")
        case .government:
            score += 15
        case .manual:
            score += 8
        }

        let ageDays = now.timeIntervalSince(listing.lastSeenAt) / 86_400
        if ageDays <= 7 {
            score += 10
        } else if ageDays >= 30 {
            score -= 15
            reasons.append("Evidence is more than 30 days old; recheck before quoting.")
        }

        return min(100, max(0, score))
    }

    private func median(_ values: [Double]) -> Double {
        guard !values.isEmpty else { return 0 }
        let sorted = values.sorted()
        let middle = sorted.count / 2
        if sorted.count.isMultiple(of: 2) {
            return (sorted[middle - 1] + sorted[middle]) / 2
        }
        return sorted[middle]
    }

    private func currency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "CAD"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$\(Int(value.rounded()))"
    }
}
