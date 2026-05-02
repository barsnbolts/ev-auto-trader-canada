import AppModels
import SwiftUI
import Support

public struct CompareView: View {
    public let vehicles: [CanonicalVehicle]
    public let includesListingPricesInExport: Bool
    public let exportAction: () -> Void

    public init(
        vehicles: [CanonicalVehicle],
        includesListingPricesInExport: Bool,
        exportAction: @escaping () -> Void
    ) {
        self.vehicles = vehicles
        self.includesListingPricesInExport = includesListingPricesInExport
        self.exportAction = exportAction
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Compare")
                    .font(.largeTitle)
                    .fontWeight(.semibold)
                Spacer()
                Button("Export Comparison CSV", action: exportAction)
                    .disabled(vehicles.isEmpty)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)

            Text(exportSummary)
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 20)

            if vehicles.isEmpty {
                ContentUnavailableView {
                    Label("Select Vehicles To Compare", systemImage: "square.grid.2x2")
                } description: {
                    Text("Add up to four vehicles from the detail view or sidebar context menu to compare price, range, charging, and confidence side by side.")
                }
            } else {
                ScrollView(.horizontal) {
                    HStack(alignment: .top, spacing: 16) {
                        ForEach(vehicles) { vehicle in
                            VStack(alignment: .leading, spacing: 10) {
                                Text(vehicle.displayName)
                                    .font(.headline)
                                Text(vehicle.powertrain.rawValue)
                                    .foregroundStyle(.secondary)
                                Divider()
                                compareRow("MSRP", Formatters.currency(vehicle.msrpCAD))
                                compareRow("Combined", "\(vehicle.rangeCombinedKm) km")
                                compareRow("Battery", vehicle.batteryCapacityKWh.map { String(format: "%.1f kWh", $0) } ?? "-")
                                compareRow("10-80", vehicle.fastChargeMinutesTenToEighty.map { "\($0) min" } ?? "-")
                                compareRow("Charge Rate", vehicle.maxChargeRateKW.map { String(format: "%.0f kW", $0) } ?? "-")
                                compareRow("Confidence", vehicle.confidence.displayName)
                            }
                            .padding(18)
                            .frame(width: 250, alignment: .leading)
                            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 20)
                }
            }
        }
    }

    private func compareRow(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .fontWeight(.medium)
        }
    }

    private var exportSummary: String {
        if includesListingPricesInExport {
            return "CSV export includes MSRP plus the best currently loaded listing price when one is available."
        }

        return "CSV export includes MSRP only. Enable listing prices in Settings to include currently loaded listing columns."
    }
}
