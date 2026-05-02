import Catalog
import SwiftUI

public struct MenuBarStatusView: View {
    @Bindable private var catalogStore: CatalogStore
    public let syncStatus: String
    public let refreshAction: @Sendable () async -> Void

    @Environment(\.openWindow) private var openWindow

    public init(catalogStore: CatalogStore, syncStatus: String, refreshAction: @escaping @Sendable () async -> Void) {
        self.catalogStore = catalogStore
        self.syncStatus = syncStatus
        self.refreshAction = refreshAction
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("EV Auto Trader Canada")
                .font(.headline)
            Text(syncStatus)
                .foregroundStyle(.secondary)
            Text("\(catalogStore.filteredVehicles.count) visible vehicles · \(catalogStore.sourceRunCount) research batch\(catalogStore.sourceRunCount == 1 ? "" : "es") · \(catalogStore.reviewCount) review item\(catalogStore.reviewCount == 1 ? "" : "s")")
                .font(.caption)
                .foregroundStyle(.secondary)

            Label(healthSummaryText, systemImage: healthSummaryIcon)
                .font(.caption)
                .foregroundStyle(healthSummaryColor)

            if let nextStepText {
                Text(nextStepText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Group {
                if catalogStore.reviewCount > 0 {
                    Label("\(catalogStore.reviewCount) item\(catalogStore.reviewCount == 1 ? "" : "s") still need review", systemImage: "exclamationmark.circle")
                        .font(.caption)
                        .foregroundStyle(.orange)
                } else {
                    Label("Review queue is clear", systemImage: "checkmark.circle")
                        .font(.caption)
                        .foregroundStyle(.green)
                }
            }

            Group {
                if catalogStore.sourceRunCount == 0 {
                    Label("No research batches recorded yet", systemImage: "clock.arrow.circlepath")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Label("\(catalogStore.sourceRunCount) research batch\(catalogStore.sourceRunCount == 1 ? "" : "es") available", systemImage: "dot.radiowaves.left.and.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Divider()

            Button("Open Main Window") {
                openWindow(id: "main")
            }

            Button("Open Comparison") {
                openWindow(id: "compare")
            }

            Button("Open Review Queue") {
                openWindow(id: "reviewQueue")
            }

            Button("Refresh Now") {
                Task { await refreshAction() }
            }
        }
        .padding(16)
        .frame(width: 260)
    }

    private var healthSummaryText: String {
        if catalogStore.sourceRunCount == 0 {
            return "No research batches recorded yet"
        }

        if catalogStore.reviewCount > 0 {
            return "Imported evidence needs review"
        }

        if syncStatus.localizedCaseInsensitiveContains("refresh") {
            return "Research refresh is in progress"
        }

        if syncStatus.localizedCaseInsensitiveContains("fail") || syncStatus.localizedCaseInsensitiveContains("error") {
            return "Research status needs attention"
        }

        return "Research status looks healthy"
    }

    private var healthSummaryIcon: String {
        if catalogStore.sourceRunCount == 0 {
            return "clock.arrow.circlepath"
        }

        if catalogStore.reviewCount > 0 {
            return "exclamationmark.circle"
        }

        if syncStatus.localizedCaseInsensitiveContains("refresh") {
            return "arrow.triangle.2.circlepath"
        }

        if syncStatus.localizedCaseInsensitiveContains("fail") || syncStatus.localizedCaseInsensitiveContains("error") {
            return "exclamationmark.triangle"
        }

        return "checkmark.circle"
    }

    private var healthSummaryColor: Color {
        if catalogStore.sourceRunCount == 0 {
            return .secondary
        }

        if catalogStore.reviewCount > 0 {
            return .orange
        }

        if syncStatus.localizedCaseInsensitiveContains("refresh") {
            return .secondary
        }

        if syncStatus.localizedCaseInsensitiveContains("fail") || syncStatus.localizedCaseInsensitiveContains("error") {
            return .red
        }

        return .green
    }

    private var nextStepText: String? {
        if catalogStore.sourceRunCount == 0 {
            return "Import a source-backed research file to create the first ranked snapshot."
        }

        if catalogStore.reviewCount > 0 {
            return "Open the review queue to inspect unmatched or incomplete imported records."
        }

        if syncStatus.localizedCaseInsensitiveContains("fail") || syncStatus.localizedCaseInsensitiveContains("error") {
            return "Open the main window for the latest import or refresh warning."
        }

        return "Open the main window to review ranked listings and source evidence."
    }
}
