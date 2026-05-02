import AppModels
import Foundation
import Observation
import Persistence
import Support

@MainActor
@Observable
public final class CatalogStore {
    public var allVehicles: [CanonicalVehicle] = []
    public var query: String = ""
    public var selectedProvince: String = "Ontario"
    public var selectedRadiusMode: RadiusMode = .hundredKm
    public var selectedPowertrains: Set<PowertrainType> = [.bev, .phev, .hev]
    public var selectedVehicleID: String?
    public var compareVehicleIDs: Set<String> = []
    public var reviewCount: Int = 0
    public var sourceRunCount: Int = 0
    public var isLoading = false
    public var errorMessage: String?

    public init() {}

    public func load(from database: AppDatabase) async throws {
        isLoading = true
        defer { isLoading = false }

        let vehicles = try await database.fetchCanonicalVehicles()
        let reviewQueue = try await database.fetchReviewQueue()
        let sourceRuns = try await database.fetchSourceRuns()

        allVehicles = vehicles
        reviewCount = reviewQueue.count
        sourceRunCount = sourceRuns.count

        if selectedVehicleID == nil {
            selectedVehicleID = filteredVehicles.first?.id ?? vehicles.first?.id
        }
    }

    public var filteredVehicles: [CanonicalVehicle] {
        allVehicles.filter { vehicle in
            let matchesTargetScope = (vehicle.make == "Hyundai" || vehicle.make == "Kia") && (vehicle.year == 2025 || vehicle.year == 2026)
            let matchesPowertrain = selectedPowertrains.contains(vehicle.powertrain)
            let matchesProvince = selectedRadiusMode == .national || vehicle.defaultProvince == selectedProvince
            let matchesQuery: Bool
            if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                matchesQuery = true
            } else {
                let haystack = "\(vehicle.make) \(vehicle.model) \(vehicle.trim)".localizedLowercase
                matchesQuery = haystack.contains(query.localizedLowercase)
            }
            return matchesTargetScope && matchesPowertrain && matchesProvince && matchesQuery
        }
    }

    public var selectedVehicle: CanonicalVehicle? {
        guard let selectedVehicleID else { return filteredVehicles.first ?? allVehicles.first }
        return allVehicles.first(where: { $0.id == selectedVehicleID }) ?? filteredVehicles.first ?? allVehicles.first
    }

    public var compareVehicles: [CanonicalVehicle] {
        allVehicles.filter { compareVehicleIDs.contains($0.id) }
    }

    public func select(vehicleID: String) {
        selectedVehicleID = vehicleID
        AppLogger.ui.info("Selected vehicle \(vehicleID, privacy: .public)")
    }

    public func toggleCompare(vehicleID: String) {
        if compareVehicleIDs.contains(vehicleID) {
            compareVehicleIDs.remove(vehicleID)
        } else if compareVehicleIDs.count < 4 {
            compareVehicleIDs.insert(vehicleID)
        }
    }
}
