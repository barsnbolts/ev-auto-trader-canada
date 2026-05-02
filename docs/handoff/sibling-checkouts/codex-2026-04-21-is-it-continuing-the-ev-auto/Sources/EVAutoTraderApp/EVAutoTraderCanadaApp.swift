import Calculators
import SwiftUI
import UIComponents

@main
struct EVAutoTraderCanadaApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @AppStorage("exportsIncludeListingPrice") private var exportsIncludeListingPrice = true
    @State private var container: AppContainer = {
        do {
            return try AppContainer()
        } catch {
            fatalError("Unable to initialize app container: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup("EV Auto Trader Canada", id: "main") {
            Group {
                if let bootstrapError = container.bootstrapError, !container.isBootstrapping {
                    ContentUnavailableView("Launch Error", systemImage: "exclamationmark.triangle", description: Text(bootstrapError))
                } else {
                    ContentView(
                        catalogStore: container.catalogStore,
                        inventoryStore: container.inventoryStore,
                        rangeCalculator: container.rangeCalculator,
                        chargingCalculator: container.chargingCalculator,
                        isBootstrapping: container.isBootstrapping,
                        isRefreshing: container.syncCoordinator.isRefreshing,
                        syncStatus: container.syncCoordinator.status,
                        syncError: container.lastSyncError,
                        refreshAction: { await container.refresh() },
                        researchImportAction: { url, provider, prompt in
                            try await container.importResearchFile(at: url, provider: provider, prompt: prompt)
                        },
                        dismissSyncError: { container.dismissSyncError() }
                    )
                    .task {
                        await container.load()
                    }
                    .onChange(of: container.catalogStore.selectedVehicleID) { _, _ in
                        Task { await container.selectionChanged() }
                    }
                }
            }
            .frame(minWidth: 1160, minHeight: 760)
        }
        .defaultLaunchBehavior(.presented)
        .commands {
            EVAutoTraderCommands(container: container)
        }

        Window("Compare", id: "compare") {
            CompareView(
                vehicles: container.catalogStore.compareVehicles,
                includesListingPricesInExport: exportsIncludeListingPrice,
                exportAction: {
                    do {
                        let scores = LeverageCalculator()
                            .rankedListings(
                                container.inventoryStore.inventoryListings,
                                incentives: container.inventoryStore.incentivePrograms,
                                financeOffers: container.inventoryStore.financeOffers
                            )
                            .map(\.score)
                        _ = try container.exportService.exportCompareCSV(
                            vehicles: container.catalogStore.compareVehicles,
                            listings: container.inventoryStore.listings,
                            inventoryListings: container.inventoryStore.inventoryListings,
                            leverageScores: scores,
                            includeListingPrice: exportsIncludeListingPrice
                        )
                    } catch {
                        container.bootstrapError = error.localizedDescription
                    }
                }
            )
            .frame(minWidth: 920, minHeight: 560)
        }
        .restorationBehavior(.disabled)

        Window("Review Queue", id: "reviewQueue") {
            ReviewQueueView(items: container.inventoryStore.reviewQueue)
                .frame(minWidth: 640, minHeight: 440)
        }
        .restorationBehavior(.disabled)

        Settings {
            SettingsView()
        }

        MenuBarExtra("EV Auto", systemImage: "bolt.car") {
            MenuBarStatusView(
                catalogStore: container.catalogStore,
                syncStatus: container.syncCoordinator.status,
                refreshAction: { await container.refresh() }
            )
        }
        .menuBarExtraStyle(.window)
    }
}
