import AppKit
import AppModels
import Foundation

@MainActor
public final class ExportService {
    public init() {}

    public func exportCompareCSV(
        vehicles: [CanonicalVehicle],
        listings: [Listing] = [],
        inventoryListings: [InventoryListing] = [],
        leverageScores: [LeverageScore] = [],
        includeListingPrice: Bool = true
    ) throws -> URL? {
        guard !vehicles.isEmpty else { return nil }

        let panel = NSSavePanel()
        panel.canCreateDirectories = true
        panel.nameFieldStringValue = "ev-compare.csv"
        panel.allowedContentTypes = [.commaSeparatedText]

        guard panel.runModal() == .OK, let url = panel.url else {
            return nil
        }

        let csv = compareCSV(
            vehicles: vehicles,
            listings: listings,
            inventoryListings: inventoryListings,
            leverageScores: leverageScores,
            includeListingPrice: includeListingPrice
        )
        try csv.write(to: url, atomically: true, encoding: .utf8)
        AppLogger.export.info("Exported compare CSV to \(url.path(percentEncoded: false), privacy: .public)")
        return url
    }

    public func compareCSV(
        vehicles: [CanonicalVehicle],
        listings: [Listing] = [],
        inventoryListings: [InventoryListing] = [],
        leverageScores: [LeverageScore] = [],
        includeListingPrice: Bool = true
    ) -> String {
        var headers = ["Vehicle", "Powertrain", "MSRP CAD"]
        if includeListingPrice {
            headers.append(contentsOf: ["Best Listing CAD", "Best Listing Dealer"])
        }
        headers.append(contentsOf: [
            "Leverage Score",
            "Best Target Dealer",
            "Best Target Advertised CAD",
            "Discount CAD",
            "Incentive CAD",
            "Evidence URL",
            "Combined Range km",
            "Max Charge kW",
            "Confidence"
        ])

        var csv = csvRow(headers)
        for vehicle in vehicles {
            let bestListing = listings
                .filter { $0.canonicalVehicleID == vehicle.id }
                .min { $0.priceCAD < $1.priceCAD }
            let bestTarget = inventoryListings
                .filter { $0.canonicalVehicleID == vehicle.id }
                .min { $0.priceBreakdown.effectivePreTaxPriceCAD < $1.priceBreakdown.effectivePreTaxPriceCAD }
            let targetScore = bestTarget.flatMap { target in
                leverageScores.first { $0.inventoryListingID == target.id }
            }
            var row = [
                vehicle.displayName,
                vehicle.powertrain.rawValue,
                String(Int(vehicle.msrpCAD))
            ]

            if includeListingPrice {
                row.append(bestListing.map { String(Int($0.priceCAD)) } ?? "")
                row.append(bestListing?.dealerName ?? "")
            }

            let leverageScoreValue = targetScore.map { String(format: "%.0f", $0.total) } ?? ""
            let targetDealer = bestTarget?.dealerName ?? ""
            let targetAdvertised = bestTarget.map { String(Int($0.advertisedPriceCAD.rounded())) } ?? ""
            let targetDiscount = bestTarget.map { String(Int($0.priceBreakdown.discountFromMSRPCAD.rounded())) } ?? ""
            let targetIncentive = bestTarget.map { String(Int($0.priceBreakdown.incentiveAmountCAD.rounded())) } ?? ""
            let targetURL = bestTarget?.sourceURL ?? ""
            let combinedRange = String(vehicle.rangeCombinedKm)
            let maxCharge = vehicle.maxChargeRateKW.map { String(Int($0)) } ?? "-"

            row.append(contentsOf: [
                leverageScoreValue,
                targetDealer,
                targetAdvertised,
                targetDiscount,
                targetIncentive,
                targetURL,
                combinedRange,
                maxCharge,
                vehicle.confidence.displayName
            ])
            csv.append(csvRow(row))
        }

        return csv
    }

    private func csvRow(_ fields: [String]) -> String {
        fields.map { field in
            "\"\(field.replacingOccurrences(of: "\"", with: "\"\""))\""
        }.joined(separator: ",") + "\n"
    }
}
