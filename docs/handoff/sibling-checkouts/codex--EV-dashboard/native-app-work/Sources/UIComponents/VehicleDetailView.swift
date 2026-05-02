import AppModels
import Calculators
import Foundation
import SwiftUI
import Support

public struct VehicleDetailView: View {
    public let vehicle: CanonicalVehicle
    public let listings: [Listing]
    public let sourceRuns: [SourceRun]
    public let rangeCalculator: RangeCalculator
    public let chargingCalculator: ChargingCalculator

    @Binding private var compareVehicleIDs: Set<String>
    @AppStorage("temperatureDefaultC") private var temperatureDefaultC = 22.0
    @State private var isPreconditioned = true

    public init(
        vehicle: CanonicalVehicle,
        listings: [Listing],
        sourceRuns: [SourceRun],
        rangeCalculator: RangeCalculator,
        chargingCalculator: ChargingCalculator,
        compareVehicleIDs: Binding<Set<String>>
    ) {
        self.vehicle = vehicle
        self.listings = listings
        self.sourceRuns = sourceRuns
        self.rangeCalculator = rangeCalculator
        self.chargingCalculator = chargingCalculator
        self._compareVehicleIDs = compareVehicleIDs
    }

    public var body: some View {
        let rangeEstimate = rangeCalculator.estimate(
            for: vehicle,
            temperatureC: temperatureDefaultC,
            isPreconditioned: isPreconditioned,
            view: .combined
        )

        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                summaryCard(rangeEstimate: rangeEstimate)
                metricsGrid(rangeEstimate: rangeEstimate)
                chargingSection
                provenanceSection
                availabilitySection
            }
            .padding(24)
        }
        .background(.clear)
    }

    private func summaryCard(rangeEstimate: RangeEstimate) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(vehicle.displayName)
                        .font(.largeTitle)
                        .fontWeight(.semibold)

                    Text("\(vehicle.powertrain.rawValue) · \(vehicle.defaultProvince) default market")
                        .foregroundStyle(.secondary)

                    HStack(spacing: 10) {
                        confidenceBadge(vehicle.confidence)
                        if vehicle.isComingSoon {
                            Label("Coming Soon", systemImage: "calendar.badge.clock")
                                .font(.caption)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(.thinMaterial, in: Capsule())
                        }
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 6) {
                    Text(Formatters.currency(vehicle.msrpCAD))
                        .font(.title2)
                        .fontWeight(.bold)
                    Text("MSRP")
                        .foregroundStyle(.secondary)
                }
            }

            HStack(spacing: 16) {
                VStack(alignment: .leading) {
                    Text("Temp")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("\(Int(temperatureDefaultC.rounded()))C")
                        .font(.headline)
                }

                Slider(value: $temperatureDefaultC, in: -25...35, step: 1)
                    .frame(maxWidth: 280)

                Toggle("Preconditioned", isOn: $isPreconditioned)
                    .toggleStyle(.switch)

                Spacer()

                Button(compareVehicleIDs.contains(vehicle.id) ? "Remove From Compare" : "Add To Compare") {
                    if compareVehicleIDs.contains(vehicle.id) {
                        compareVehicleIDs.remove(vehicle.id)
                    } else if compareVehicleIDs.count < 4 {
                        compareVehicleIDs.insert(vehicle.id)
                    }
                }
            }

            Text(rangeEstimate.note)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(20)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func metricsGrid(rangeEstimate: RangeEstimate) -> some View {
        Grid(horizontalSpacing: 16, verticalSpacing: 12) {
            GridRow {
                metricCard(title: "Combined Range", value: "\(rangeEstimate.combinedKm) km", detail: "Temperature adjusted")
                metricCard(title: "City Range", value: "\(rangeEstimate.cityKm) km", detail: "Urban estimate")
                metricCard(title: "Highway Range", value: "\(rangeEstimate.highwayKm) km", detail: "Highway estimate")
            }

            GridRow {
                metricCard(title: "Battery", value: vehicle.batteryCapacityKWh.map { String(format: "%.1f kWh", $0) } ?? "-", detail: "Usable estimate")
                metricCard(title: "Fast Charge", value: vehicle.fastChargeMinutesTenToEighty.map { "\($0) min" } ?? "-", detail: "10-80 benchmark")
                metricCard(title: "Listings", value: "\(listings.count)", detail: "Current availability")
            }
        }
    }

    private var chargingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Charging Intelligence")
                .font(.title3)
                .fontWeight(.semibold)

            HStack(spacing: 12) {
                chargingCard(chargingCalculator.estimate(for: vehicle, chargeType: .level1))
                chargingCard(chargingCalculator.estimate(for: vehicle, chargeType: .level2))
                chargingCard(chargingCalculator.estimateTenToEighty(for: vehicle))
            }

            if vehicle.powertrain != .bev {
                Text("Electric-first estimates are shown separately from fuel-backed operation for \(vehicle.powertrain.rawValue).")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var provenanceSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Provenance & Confidence")
                .font(.title3)
                .fontWeight(.semibold)

            ForEach(vehicle.provenance) { provenance in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(provenance.sourceName)
                            .fontWeight(.medium)
                        Spacer()
                        Text(Formatters.relative(date: provenance.lastVerifiedAt))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Text(provenance.detail)
                        .foregroundStyle(.secondary)
                    if let sourceURL = provenance.sourceURL {
                        if let url = URL(string: sourceURL) {
                            Link(sourceURL, destination: url)
                                .font(.caption)
                        } else {
                            Text(sourceURL)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .textSelection(.enabled)
                        }
                    }
                }
                .padding(14)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }

    private var availabilitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Availability")
                    .font(.title3)
                    .fontWeight(.semibold)
                Spacer()
                if let latestRun {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Last sync \(Formatters.relative(date: latestRun.startedAt))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(latestRun.status.capitalized)
                            .font(.caption2)
                            .foregroundStyle(latestRun.status == "failed" ? .red : .secondary)
                    }
                }
            }

            if relevantSourceRuns.isEmpty, let latestRun {
                availabilityRunSummary(latestRun)
            } else {
                ForEach(relevantSourceRuns) { run in
                    availabilityRunSummary(run)
                }
            }

            if listings.isEmpty {
                ContentUnavailableView {
                    Label("No Listings Yet", systemImage: "tray")
                } description: {
                    Text(emptyAvailabilityMessage)
                }
            } else {
                availabilitySummary

                Table(listings) {
                    TableColumn("Source") { listing in
                        Text(sourceDisplayName(for: listing.sourceID))
                    }
                    TableColumn("Dealer", value: \.dealerName)
                    TableColumn("Condition", value: \.condition.rawValue)
                    TableColumn("Price") { listing in
                        Text(Formatters.currency(listing.priceCAD))
                    }
                    TableColumn("Location", value: \.locationLabel)
                    TableColumn("Confidence") { listing in
                        confidenceBadge(listing.confidence)
                    }
                }
                .frame(minHeight: 220)
            }

            if let latestRun, let errorMessage = latestRun.errorMessage, !errorMessage.isEmpty {
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.top, 4)
            }
        }
    }

    private func availabilityRunSummary(_ run: SourceRun) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                statusBadge(run.status)
                Text(run.displayName)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Spacer()
                if let completedAt = run.completedAt {
                    Text("Completed \(Formatters.relative(date: completedAt))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            HStack(spacing: 16) {
                runMetric(title: "Fetched", value: "\(run.fetchedRecords)")
                runMetric(title: "Published", value: "\(run.publishedRecords)")
                runMetric(title: "Review", value: "\(run.reviewRecords)")
            }

            if run.reviewRecords > 0 {
                Label("\(run.reviewRecords) record\(run.reviewRecords == 1 ? "" : "s") from this source run still need review before they can publish cleanly.", systemImage: "exclamationmark.circle")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
        .padding(14)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var availabilitySummary: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(listings.count) live listing\(listings.count == 1 ? "" : "s") across \(uniqueDealerCount) dealer\(uniqueDealerCount == 1 ? "" : "s")")
                .font(.caption)
                .foregroundStyle(.secondary)

            if hasPriceBasisNote {
                Label("At least one listing includes source-provided price notes. Review the listing provenance before treating the price as final dealer truth.", systemImage: "info.circle")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
    }

    private var emptyAvailabilityMessage: String {
        guard let latestRun else {
            return "This trim is in the catalog, but there are no published listings yet. Try a refresh or check the review queue for low-confidence source matches."
        }

        if latestRun.status.localizedCaseInsensitiveContains("fail") {
            return "The latest source run failed before listings could publish. Review the sync warning below, then try another refresh after the source issue is resolved."
        }

        if latestRun.reviewRecords > 0 {
            return "This trim is in the catalog, but \(latestRun.reviewRecords) record\(latestRun.reviewRecords == 1 ? "" : "s") from the latest source run still need review before they can publish as live listings."
        }

        return "This trim is in the catalog, but there are no published listings yet from the latest successful source run. Try another refresh if you expect dealer inventory to be live."
    }

    private func runMetric(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
        }
    }

    private func statusBadge(_ status: String) -> some View {
        let normalized = status.localizedLowercase
        let tint: Color

        if normalized.contains("fail") {
            tint = .red
        } else if normalized.contains("refresh") {
            tint = .orange
        } else {
            tint = .green
        }

        return Text(status.capitalized)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(tint.opacity(0.15), in: Capsule())
            .foregroundStyle(tint)
    }

    private func metricCard(title: String, value: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3)
                .fontWeight(.semibold)
            Text(detail)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func chargingCard(_ estimate: ChargingEstimate) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(estimate.chargeType.rawValue)
                .font(.caption)
                .foregroundStyle(.secondary)

            if let estimatedMinutes = estimate.estimatedMinutes {
                Text("\(estimatedMinutes) min")
                    .font(.title3)
                    .fontWeight(.semibold)
            } else if let estimatedHours = estimate.estimatedHours {
                Text("\(estimatedHours, specifier: "%.1f") h")
                    .font(.title3)
                    .fontWeight(.semibold)
            } else {
                Text("-")
                    .font(.title3)
                    .fontWeight(.semibold)
            }

            Text(estimate.note)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func confidenceBadge(_ confidence: ConfidenceLevel) -> some View {
        Text(confidence.displayName)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(badgeColor(confidence).opacity(0.2), in: Capsule())
            .foregroundStyle(badgeColor(confidence))
    }

    private func badgeColor(_ confidence: ConfidenceLevel) -> Color {
        switch confidence {
        case .high: .green
        case .medium: .orange
        case .low: .red
        }
    }

    private var uniqueDealerCount: Int {
        Set(listings.map(\.dealerName)).count
    }

    private var listingSourceIDs: Set<String> {
        Set(listings.map(\.sourceID))
    }

    private var relevantSourceRuns: [SourceRun] {
        guard !listingSourceIDs.isEmpty else { return [] }
        return sourceRuns.filter { listingSourceIDs.contains($0.sourceID) }
    }

    private var latestRun: SourceRun? {
        relevantSourceRuns.first ?? sourceRuns.first
    }

    private var hasPriceBasisNote: Bool {
        listings.contains { listing in
            listing.notes.contains { note in
                note.localizedCaseInsensitiveContains("inferred MSRP") ||
                note.localizedCaseInsensitiveContains("API listing price") ||
                note.localizedCaseInsensitiveContains("API MSRP")
            }
        }
    }

    private func sourceDisplayName(for sourceID: String) -> String {
        switch sourceID {
        case "oem-inventory":
            return "Ford Canada"
        case "vw-canada-inventory":
            return "VW Canada"
        case "dealer-group":
            return "Dealer Group"
        default:
            return sourceID
        }
    }
}
