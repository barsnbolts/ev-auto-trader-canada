import AppModels
import Foundation

public struct RangeCalculator: Sendable {
    public init() {}

    public func estimate(
        for vehicle: CanonicalVehicle,
        temperatureC: Double,
        isPreconditioned: Bool,
        view: RangeView
    ) -> RangeEstimate {
        let baseline = 22.0
        let temperatureDelta = temperatureC - baseline

        let coldPenaltyPerDegree: Double
        let warmBonusPerDegree: Double
        let minimumFactor: Double

        switch vehicle.powertrain {
        case .bev:
            coldPenaltyPerDegree = 0.012
            warmBonusPerDegree = 0.004
            minimumFactor = 0.58
        case .phev:
            coldPenaltyPerDegree = 0.009
            warmBonusPerDegree = 0.003
            minimumFactor = 0.67
        case .erev:
            coldPenaltyPerDegree = 0.008
            warmBonusPerDegree = 0.002
            minimumFactor = 0.72
        case .hev:
            return RangeEstimate(
                cityKm: 0,
                highwayKm: 0,
                combinedKm: 0,
                note: "Hybrid fuel-economy metrics are tracked separately from plug-in electric range."
            )
        }

        let rawFactor: Double
        if temperatureDelta >= 0 {
            rawFactor = 1.0 + min(temperatureDelta * warmBonusPerDegree, 0.08)
        } else {
            rawFactor = max(1.0 + (temperatureDelta * coldPenaltyPerDegree), minimumFactor)
        }

        let preconditioningBoost = (isPreconditioned && temperatureC < baseline) ? 0.05 : 0
        let finalFactor = min(rawFactor + preconditioningBoost, 1.08)

        let city = Int((Double(vehicle.rangeCityKm) * finalFactor).rounded())
        let highway = Int((Double(vehicle.rangeHighwayKm) * finalFactor).rounded())
        let combined = Int((Double(vehicle.rangeCombinedKm) * finalFactor).rounded())

        let viewSummary: String
        switch view {
        case .city:
            viewSummary = "City-biased estimate"
        case .highway:
            viewSummary = "Highway-biased estimate"
        case .combined:
            viewSummary = "Combined estimate"
        }

        let preconditioningSummary = isPreconditioned ? "with preconditioning" : "without preconditioning"
        let note = "\(viewSummary) at \(Int(temperatureC.rounded()))C \(preconditioningSummary)."

        return RangeEstimate(cityKm: city, highwayKm: highway, combinedKm: combined, note: note)
    }
}
