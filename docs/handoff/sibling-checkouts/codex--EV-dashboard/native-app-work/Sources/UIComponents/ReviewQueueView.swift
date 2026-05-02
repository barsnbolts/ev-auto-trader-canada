import AppModels
import Foundation
import SwiftUI
import Support

public struct ReviewQueueView: View {
    public let items: [ReviewQueueItem]

    public init(items: [ReviewQueueItem]) {
        self.items = items
    }

    public var body: some View {
        Group {
            if items.isEmpty {
                ContentUnavailableView {
                    Label("Review Queue Is Empty", systemImage: "checkmark.seal")
                } description: {
                    Text("No low-confidence or incomplete live-source records need review right now.")
                }
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    reviewSummary

                    List(sortedItems) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(item.reason)
                                    .fontWeight(.medium)
                                Spacer()
                                Text("\(item.severity.displayName) confidence")
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(severityColor(for: item.severity).opacity(0.15), in: Capsule())
                                    .foregroundStyle(severityColor(for: item.severity))
                            }
                            Text(item.rawIdentifier)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            HStack(spacing: 8) {
                                Label(Formatters.relative(date: item.createdAt), systemImage: "clock")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                Text("Run \(item.sourceRunID.prefix(8))")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .fontDesign(.monospaced)
                            }
                            if let payloadLines = formattedPayloadLines(from: item.rawPayload) {
                                VStack(alignment: .leading, spacing: 2) {
                                    ForEach(payloadLines, id: \.self) { line in
                                        Text(line)
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                            .textSelection(.enabled)
                                            .fontDesign(.monospaced)
                                    }
                                }
                            } else {
                                Text(item.rawPayload)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .textSelection(.enabled)
                                    .fontDesign(.monospaced)
                                    .lineLimit(6)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
        .navigationTitle("Records Needing Review")
    }

    private var reviewSummary: some View {
        HStack(spacing: 16) {
            summaryMetric(title: "Total", value: "\(items.count)")
            summaryMetric(title: "Low Confidence", value: "\(items.filter { $0.severity == .low }.count)")
            summaryMetric(title: "Medium", value: "\(items.filter { $0.severity == .medium }.count)")
            summaryMetric(title: "High", value: "\(items.filter { $0.severity == .high }.count)")
            Spacer()
            if let newest = items.map(\.createdAt).max() {
                Text("Newest \(Formatters.relative(date: newest))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 2)
    }

    private var sortedItems: [ReviewQueueItem] {
        items.sorted {
            if $0.severity.score == $1.severity.score {
                return $0.createdAt > $1.createdAt
            }

            return $0.severity.score < $1.severity.score
        }
    }

    private func summaryMetric(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
        }
    }

    private func severityColor(for severity: ConfidenceLevel) -> Color {
        switch severity {
        case .high:
            return .secondary
        case .medium:
            return .orange
        case .low:
            return .red
        }
    }

    private func formattedPayloadLines(from rawPayload: String) -> [String]? {
        guard
            let data = rawPayload.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: String]
        else {
            return nil
        }

        return object.keys.sorted().compactMap { key in
            guard let value = object[key], !value.isEmpty else { return nil }
            return "\(key): \(value)"
        }
    }
}
