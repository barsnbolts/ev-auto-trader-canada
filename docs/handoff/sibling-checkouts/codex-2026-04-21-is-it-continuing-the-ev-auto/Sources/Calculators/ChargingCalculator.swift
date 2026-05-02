import AppModels
import Foundation

public struct ChargingCalculator: Sendable {
    public init() {}

    public func estimate(for vehicle: CanonicalVehicle, chargeType: ChargeType) -> ChargingEstimate {
        switch chargeType {
        case .level1:
            return ChargingEstimate(
                chargeType: .level1,
                estimatedHours: vehicle.level1Hours,
                note: vehicle.level1Hours == nil ? "L1 estimate unavailable." : "Home outlet charging estimate."
            )
        case .level2:
            return ChargingEstimate(
                chargeType: .level2,
                estimatedHours: vehicle.level2Hours,
                note: vehicle.level2Hours == nil ? "L2 estimate unavailable." : "240V home or public AC charging estimate."
            )
        case .level3:
            return ChargingEstimate(
                chargeType: .level3,
                estimatedMinutes: vehicle.fastChargeMinutesTenToEighty,
                tenToEightyMinutes: vehicle.fastChargeMinutesTenToEighty,
                note: vehicle.fastChargeMinutesTenToEighty == nil ? "DC fast charging estimate unavailable." : "10-80 estimate shown as the primary DC fast-charge benchmark."
            )
        }
    }

    public func estimateTenToEighty(for vehicle: CanonicalVehicle) -> ChargingEstimate {
        ChargingEstimate(
            chargeType: .level3,
            estimatedMinutes: vehicle.fastChargeMinutesTenToEighty,
            tenToEightyMinutes: vehicle.fastChargeMinutesTenToEighty,
            note: vehicle.fastChargeMinutesTenToEighty == nil ? "No 10-80 benchmark available." : "10-80 benchmark based on peak charging behavior and ramp characteristics."
        )
    }
}
