import AppModels
import Calculators
import Catalog
import SwiftUI
import Support

public struct ContentView: View {
    @Bindable private var catalogStore: CatalogStore
    @Bindable private var inventoryStore: InventoryStore

    private let rangeCalculator: RangeCalculator
    private let chargingCalculator: ChargingCalculator
    private let isBootstrapping: Bool
    private let isRefreshing: Bool
    private let syncStatus: String
    private let syncError: String?
    private let refreshAction: @Sendable () async -> Void
    private let researchImportAction: @Sendable (URL, ResearchProvider, String) async throws -> Void
    private let dismissSyncError: () -> Void

    public init(
        catalogStore: CatalogStore,
        inventoryStore: InventoryStore,
        rangeCalculator: RangeCalculator,
        chargingCalculator: ChargingCalculator,
        isBootstrapping: Bool,
        isRefreshing: Bool,
        syncStatus: String,
        syncError: String?,
        refreshAction: @escaping @Sendable () async -> Void,
        researchImportAction: @escaping @Sendable (URL, ResearchProvider, String) async throws -> Void,
        dismissSyncError: @escaping () -> Void
    ) {
        self.catalogStore = catalogStore
        self.inventoryStore = inventoryStore
        self.rangeCalculator = rangeCalculator
        self.chargingCalculator = chargingCalculator
        self.isBootstrapping = isBootstrapping
        self.isRefreshing = isRefreshing
        self.syncStatus = syncStatus
        self.syncError = syncError
        self.refreshAction = refreshAction
        self.researchImportAction = researchImportAction
        self.dismissSyncError = dismissSyncError
    }

    public var body: some View {
        NavigationSplitView {
            SidebarView(catalogStore: catalogStore)
                .navigationSplitViewColumnWidth(min: 260, ideal: 310)
        } detail: {
            Group {
                if isBootstrapping {
                    bootstrappingView
                } else if catalogStore.selectedVehicle != nil {
                    LeverageDashboardView(
                        catalogStore: catalogStore,
                        inventoryStore: inventoryStore,
                        researchImportAction: researchImportAction
                    )
                } else {
                    ContentUnavailableView("No Vehicle Selected", systemImage: "car.side")
                }
            }
        }
        .overlay(alignment: .center) {
            if isBootstrapping {
                bootstrappingOverlay
            }
        }
        .safeAreaInset(edge: .top) {
            if shouldShowStatusBanner {
                statusBanner
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
            }
        }
        .searchable(text: $catalogStore.query, placement: .toolbar, prompt: "Search make, model, or trim")
        .toolbar {
            ToolbarItemGroup {
                Button {
                    Task { await refreshAction() }
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .keyboardShortcut("r")
                .disabled(isBootstrapping || isRefreshing)

                Picker("Scope", selection: $catalogStore.selectedRadiusMode) {
                    ForEach(RadiusMode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .frame(width: 130)
            }
        }
    }

    private var statusBanner: some View {
        HStack(spacing: 12) {
            if let syncError {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Refresh Needs Attention")
                        .font(.headline)
                    Text(syncError)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Dismiss") {
                    dismissSyncError()
                }
                Button("Try Again") {
                    Task { await refreshAction() }
                }
                .buttonStyle(.borderedProminent)
            } else if isBootstrapping {
                ProgressView()
                    .controlSize(.small)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Loading your deal workspace")
                        .font(.headline)
                    Text("Bootstrapping the database, loading trims, and preparing leverage scoring.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            } else if isRefreshing {
                ProgressView()
                    .controlSize(.small)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Refreshing saved research")
                        .font(.headline)
                    Text(syncStatus)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            } else if needsLiveDataAttention {
                Image(systemName: catalogStore.sourceRunCount == 0 ? "clock.arrow.circlepath" : "exclamationmark.circle.fill")
                    .foregroundStyle(catalogStore.sourceRunCount == 0 ? Color.secondary : Color.orange)
                VStack(alignment: .leading, spacing: 4) {
                    Text(liveDataAttentionTitle)
                        .font(.headline)
                    Text(liveDataAttentionMessage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if catalogStore.sourceRunCount == 0 {
                    Button("Refresh Now") {
                        Task { await refreshAction() }
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
        .padding(14)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var shouldShowStatusBanner: Bool {
        isBootstrapping || isRefreshing || syncError != nil || needsLiveDataAttention
    }

    private var needsLiveDataAttention: Bool {
        !isBootstrapping && !isRefreshing && syncError == nil && (catalogStore.sourceRunCount == 0 || catalogStore.reviewCount > 0)
    }

    private var liveDataAttentionTitle: String {
        catalogStore.sourceRunCount == 0 ? "No Research Batches Yet" : "Import Review Needs Attention"
    }

    private var liveDataAttentionMessage: String {
        if catalogStore.sourceRunCount == 0 {
            return "Import a source-backed ChatGPT or Gemini research file to create the first ranked inventory snapshot."
        }

        return "\(catalogStore.reviewCount) imported record\(catalogStore.reviewCount == 1 ? "" : "s") need review before the app can treat the evidence as negotiation-ready."
    }

    private var bootstrappingView: some View {
        ContentUnavailableView {
            Label("Loading Deal Workspace", systemImage: "bolt.circle")
        } description: {
            Text("The app is setting up the local database and loading the Hyundai/Kia leverage dashboard.")
        } actions: {
            ProgressView()
        }
    }

    private var bootstrappingOverlay: some View {
        VStack(spacing: 10) {
            ProgressView()
            Text("Preparing the app…")
                .font(.headline)
            Text("This should only take a moment on first launch.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(20)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}
