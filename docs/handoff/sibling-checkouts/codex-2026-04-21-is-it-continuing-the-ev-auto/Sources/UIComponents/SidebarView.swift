import AppModels
import Catalog
import SwiftUI

public struct SidebarView: View {
    @Bindable private var catalogStore: CatalogStore

    public init(catalogStore: CatalogStore) {
        self.catalogStore = catalogStore
    }

    public var body: some View {
        List(selection: $catalogStore.selectedVehicleID) {
            filtersSection

            ForEach(groupedVehicles.keys.sorted(), id: \.self) { make in
                Section(make) {
                    ForEach(groupedVehicles[make]!.keys.sorted(), id: \.self) { model in
                        DisclosureGroup(model) {
                            ForEach(groupedVehicles[make]![model] ?? []) { vehicle in
                                Button {
                                    catalogStore.select(vehicleID: vehicle.id)
                                } label: {
                                    HStack(spacing: 10) {
                                        Image(systemName: vehicle.powertrain == .bev ? "bolt.car" : "car.rear.waves.up")
                                            .foregroundStyle(.secondary)
                                            .frame(width: 18)

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(vehicle.trim)
                                                .lineLimit(1)
                                            Text("\(vehicle.year) · \(vehicle.powertrain.rawValue) · \(vehicle.confidence.displayName)")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                                .lineLimit(1)
                                        }
                                    }
                                }
                                .buttonStyle(.plain)
                                .tag(vehicle.id)
                                .contextMenu {
                                    Button(catalogStore.compareVehicleIDs.contains(vehicle.id) ? "Remove From Compare" : "Add To Compare") {
                                        catalogStore.toggleCompare(vehicleID: vehicle.id)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.sidebar)
    }

    private var groupedVehicles: [String: [String: [CanonicalVehicle]]] {
        Dictionary(grouping: catalogStore.filteredVehicles, by: \.make)
            .mapValues { makeVehicles in
                Dictionary(grouping: makeVehicles, by: \.model)
            }
    }

    private var filtersSection: some View {
        Section("Filters") {
            Picker("Province", selection: $catalogStore.selectedProvince) {
                Text("Ontario").tag("Ontario")
                Text("British Columbia").tag("British Columbia")
                Text("Quebec").tag("Quebec")
                Text("Alberta").tag("Alberta")
                Text("National").tag("National")
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Powertrains")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                ForEach(PowertrainType.allCases) { powertrain in
                    Toggle(
                        powertrain.rawValue,
                        isOn: Binding(
                            get: { catalogStore.selectedPowertrains.contains(powertrain) },
                            set: { isEnabled in
                                if isEnabled {
                                    catalogStore.selectedPowertrains.insert(powertrain)
                                } else {
                                    catalogStore.selectedPowertrains.remove(powertrain)
                                }
                            }
                        )
                    )
                }
            }

            HStack {
                Label("\(catalogStore.reviewCount)", systemImage: "exclamationmark.triangle")
                    .foregroundStyle(catalogStore.reviewCount > 0 ? Color.orange : Color.secondary)
                Spacer()
                Text("Import Review")
                    .foregroundStyle(.secondary)
            }
            .font(.caption)

            HStack {
                Label("\(catalogStore.sourceRunCount)", systemImage: "dot.radiowaves.left.and.right")
                    .foregroundStyle(catalogStore.sourceRunCount == 0 ? Color.secondary : Color.green)
                Spacer()
                Text("Research Batches")
                    .foregroundStyle(.secondary)
            }
            .font(.caption)
        }
    }
}
