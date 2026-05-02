import AppModels
import Calculators
import Catalog
import Foundation
import Persistence
import Support
import SyncEngine

@MainActor
@Observable
final class AppContainer {
    let database: AppDatabase
    let catalogStore = CatalogStore()
    let inventoryStore = InventoryStore()
    let syncCoordinator: SyncCoordinator
    let rangeCalculator = RangeCalculator()
    let chargingCalculator = ChargingCalculator()
    let notificationCoordinator: NotificationCoordinator
    let exportService = ExportService()

    var isBootstrapping = true
    var bootstrapError: String?
    var lastSyncError: String?

    init(
        database: AppDatabase,
        syncCoordinator: SyncCoordinator,
        notificationCoordinator: NotificationCoordinator = NotificationCoordinator()
    ) {
        self.database = database
        self.syncCoordinator = syncCoordinator
        self.notificationCoordinator = notificationCoordinator
    }

    convenience init() throws {
        try self.init(
            database: AppDatabase.live(),
            syncCoordinator: SyncCoordinator(
                adapters: [
                    OEMInventoryAdapter(),
                    VolkswagenCanadaInventoryAdapter(),
                    DealerGroupAdapter()
                ]
            )
        )
    }

    func load() async {
        guard isBootstrapping else { return }
        bootstrapError = nil
        AppLogger.app.info("Bootstrap started.")
        do {
            try await database.bootstrapIfNeeded()
            try await catalogStore.load(from: database)
            try await inventoryStore.load(from: database, vehicleID: catalogStore.selectedVehicleID)
            await notificationCoordinator.requestAuthorizationIfNeeded()
            isBootstrapping = false
            AppLogger.app.info("Bootstrap completed with \(self.catalogStore.allVehicles.count, privacy: .public) vehicles and \(self.inventoryStore.allSourceRuns.count, privacy: .public) source runs loaded.")
        } catch {
            bootstrapError = error.localizedDescription
            AppLogger.app.error("Bootstrap failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func refresh() async {
        lastSyncError = nil
        AppLogger.sync.info("Refresh started.")
        do {
            try await syncCoordinator.refreshAll(using: database)
            try await catalogStore.load(from: database)
            try await inventoryStore.load(from: database, vehicleID: catalogStore.selectedVehicleID)
            AppLogger.sync.info("Refresh completed with \(self.inventoryStore.listings.count, privacy: .public) listings, \(self.inventoryStore.allSourceRuns.count, privacy: .public) source runs, and \(self.inventoryStore.reviewQueue.count, privacy: .public) review items.")
        } catch {
            lastSyncError = error.localizedDescription
            AppLogger.sync.error("Refresh failed: \(error.localizedDescription, privacy: .public)")
            notificationCoordinator.notifySyncFailure(sourceName: "Sync", message: error.localizedDescription)
        }
    }

    func selectionChanged() async {
        do {
            try await inventoryStore.load(from: database, vehicleID: catalogStore.selectedVehicleID)
        } catch {
            lastSyncError = error.localizedDescription
        }
    }

    func importResearchFile(at url: URL, provider: ResearchProvider, prompt: String) async throws {
        try await inventoryStore.importResearchFile(
            at: url,
            provider: provider,
            prompt: prompt,
            using: database
        )
        try await catalogStore.load(from: database)
    }

    func dismissSyncError() {
        lastSyncError = nil
    }
}
