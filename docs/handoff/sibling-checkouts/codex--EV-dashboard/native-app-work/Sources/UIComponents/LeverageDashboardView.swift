import AppKit
import AppModels
import Calculators
import Catalog
import SwiftUI
import Support
import UniformTypeIdentifiers

public struct LeverageDashboardView: View {
    @Bindable private var catalogStore: CatalogStore
    @Bindable private var inventoryStore: InventoryStore
    private let researchImportAction: @Sendable (URL, ResearchProvider, String) async throws -> Void
    private let leverageCalculator = LeverageCalculator()
    private let promptGenerator = ResearchPromptGenerator()

    @AppStorage("buyerPostalCode") private var buyerPostalCode = ""
    @State private var selectedTab: DashboardTab = .bestTargets
    @State private var promptProvider: ResearchProvider = .chatGPTDeepResearch
    @State private var promptMake = "Hyundai and Kia"
    @State private var promptModel = ""
    @State private var isFileImporterPresented = false
    @State private var isImportingResearch = false
    @State private var importStatusMessage: String?

    public init(
        catalogStore: CatalogStore,
        inventoryStore: InventoryStore,
        researchImportAction: @escaping @Sendable (URL, ResearchProvider, String) async throws -> Void
    ) {
        self.catalogStore = catalogStore
        self.inventoryStore = inventoryStore
        self.researchImportAction = researchImportAction
    }

    public var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            Picker("Dashboard", selection: $selectedTab) {
                ForEach(DashboardTab.allCases) { tab in
                    Label(tab.title, systemImage: tab.systemImage).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding([.horizontal, .top], 16)

            Group {
                switch selectedTab {
                case .bestTargets:
                    bestTargetsView
                case .researchPrompt:
                    researchPromptView
                case .importReview:
                    importReviewView
                case .vehicleDetail:
                    selectedListingDetail
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .onChange(of: inventoryStore.selectedInventoryListingID) { _, newValue in
            guard
                let newValue,
                let listing = inventoryStore.inventoryListings.first(where: { $0.id == newValue })
            else { return }
            catalogStore.select(vehicleID: listing.canonicalVehicleID)
        }
        .fileImporter(
            isPresented: $isFileImporterPresented,
            allowedContentTypes: [.commaSeparatedText, .json, .plainText],
            allowsMultipleSelection: false
        ) { result in
            handleImportSelection(result)
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Hyundai/Kia Deal Leverage")
                    .font(.largeTitle)
                    .fontWeight(.semibold)
                Text("Cheapest credible targets first: weak dealer position, real discount, nearby alternatives, source-backed incentives.")
                    .foregroundStyle(.secondary)
            }
            Spacer()
            metricPill(title: "Targets", value: "\(filteredRankedListings.count)")
            metricPill(title: "Dealers", value: "\(Set(filteredRankedListings.map { $0.listing.dealerName }).count)")
            metricPill(title: "Top Score", value: filteredRankedListings.first.map { String(format: "%.0f", $0.score.total) } ?? "-")
        }
        .padding(20)
    }

    private var bestTargetsView: some View {
        HSplitView {
            VStack(spacing: 12) {
                filtersStrip
                targetTable
            }
            .frame(minWidth: 680)

            selectedListingDetail
                .frame(minWidth: 360, idealWidth: 430)
        }
        .padding(16)
    }

    private var filtersStrip: some View {
        HStack(spacing: 12) {
            Picker("Scope", selection: $catalogStore.selectedRadiusMode) {
                ForEach(RadiusMode.allCases) { mode in
                    Text(scopeTitle(mode)).tag(mode)
                }
            }
            .frame(width: 170)

            Picker("Province", selection: $catalogStore.selectedProvince) {
                Text("Ontario").tag("Ontario")
                Text("National").tag("National")
            }
            .frame(width: 140)

            Toggle("BEV", isOn: powertrainBinding(.bev))
            Toggle("PHEV", isOn: powertrainBinding(.phev))
            Toggle("HEV", isOn: powertrainBinding(.hev))

            Spacer()

            Text("Manual refresh + saved snapshots")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var targetTable: some View {
        Table(filteredRankedListings, selection: $inventoryStore.selectedInventoryListingID) {
            TableColumn("Score") { item in
                Text(String(format: "%.0f", item.score.total))
                    .fontWeight(.semibold)
                    .monospacedDigit()
            }
            .width(54)

            TableColumn("Vehicle") { item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.listing.displayName)
                        .lineLimit(1)
                    Text("\(item.listing.powertrain.rawValue) - \(item.listing.status)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .width(min: 220, ideal: 280)

            TableColumn("Dealer") { item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.listing.dealerName)
                        .lineLimit(1)
                    Text("\(item.listing.city), \(provinceAbbreviation(item.listing.province))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .width(min: 150, ideal: 190)

            TableColumn("Advertised") { item in
                Text(Formatters.currency(item.listing.advertisedPriceCAD))
                    .monospacedDigit()
            }
            .width(110)

            TableColumn("Discount") { item in
                Text(Formatters.currency(item.listing.priceBreakdown.discountFromMSRPCAD))
                    .monospacedDigit()
            }
            .width(100)

            TableColumn("Source") { item in
                sourceBadge(item.listing.sourceType, confidence: item.listing.confidence)
            }
            .width(125)
        }
        .overlay {
            if filteredRankedListings.isEmpty {
                if rankedListings.isEmpty {
                    ContentUnavailableView(
                        "No Imported Stock Yet",
                        systemImage: "tray.badge.plus",
                        description: Text("Generate a Deep Research prompt, import source-backed rows, then rank the first negotiation targets.")
                    )
                } else {
                    ContentUnavailableView(
                        "No Targets In This Scope",
                        systemImage: "scope",
                        description: Text("Current stock exists outside these filters. Switch scope or loosen powertrain filters to widen leverage.")
                    )
                }
            }
        }
    }

    private var selectedListingDetail: some View {
        ScrollView {
            if let selected = selectedScoredListing {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(selected.listing.displayName)
                                .font(.title2)
                                .fontWeight(.semibold)
                            Spacer()
                            Text(String(format: "%.0f", selected.score.total))
                                .font(.title2)
                                .fontWeight(.bold)
                                .monospacedDigit()
                        }
                        Text("\(selected.listing.dealerName) - \(selected.listing.city), \(provinceAbbreviation(selected.listing.province))")
                            .foregroundStyle(.secondary)
                        sourceBadge(selected.listing.sourceType, confidence: selected.listing.confidence)
                    }
                    .padding(16)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                    priceWaterfall(for: selected.listing)
                    scoreBreakdown(selected.score)
                    evidenceSection(for: selected.listing)
                }
                .padding(4)
            } else {
                ContentUnavailableView(
                    "No Target Selected",
                    systemImage: "target",
                    description: Text("A selected listing shows price waterfall, leverage reasons, finance proof, and source evidence.")
                )
                    .frame(maxWidth: .infinity, minHeight: 360)
            }
        }
    }

    private func priceWaterfall(for listing: InventoryListing) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Price Waterfall")
                .font(.headline)
            waterfallRow("MSRP", listing.priceBreakdown.msrpCAD)
            waterfallRow("Advertised", listing.priceBreakdown.advertisedPriceCAD)
            waterfallRow("Dealer discount", -listing.priceBreakdown.dealerDiscountCAD)
            waterfallRow("OEM discount", -listing.priceBreakdown.manufacturerDiscountCAD)
            waterfallRow("Mandatory fees", listing.priceBreakdown.mandatoryFeesCAD)
            waterfallRow("Incentives", -listing.priceBreakdown.incentiveAmountCAD)
            Divider()
            waterfallRow("Effective pre-tax", listing.priceBreakdown.effectivePreTaxPriceCAD, emphasized: true)
            waterfallRow("After Ontario HST", listing.priceBreakdown.effectiveAfterTaxPriceCAD, emphasized: true)
        }
        .padding(14)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func scoreBreakdown(_ score: LeverageScore) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Leverage Reasons")
                .font(.headline)
            scoreBar("Dealer weakness", score.dealerWeakness)
            scoreBar("Discount gap", score.discountGap)
            scoreBar("Supply pressure", score.supplyPressure)
            scoreBar("Incentives", score.incentives)
            scoreBar("Evidence", score.evidenceQuality)
            Divider()
            ForEach(score.reasons.prefix(8), id: \.self) { reason in
                Label(reason, systemImage: "checkmark.circle")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func evidenceSection(for listing: InventoryListing) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Evidence")
                .font(.headline)
            if let stock = listing.stockNumber {
                labelValue("Stock/VIN", stock)
            }
            if let odometer = listing.odometerKm {
                labelValue("Odometer", "\(odometer) km")
            }
            labelValue("First seen", Formatters.relative(date: listing.firstSeenAt))
            labelValue("Last seen", Formatters.relative(date: listing.lastSeenAt))
            if let url = URL(string: listing.sourceURL) {
                Link("Open source evidence", destination: url)
            } else {
                Text(listing.sourceURL)
                    .textSelection(.enabled)
            }
            if !listing.notes.isEmpty {
                Divider()
                ForEach(listing.notes, id: \.self) { note in
                    Text(note)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(14)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var researchPromptView: some View {
        let prompt = currentResearchPrompt

        return VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Research Prompt")
                    .font(.headline)
                Text("Copy a source-backed research request for 2025-2026 Hyundai/Kia BEV, PHEV, and HEV inventory.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 12) {
                Picker("Provider", selection: $promptProvider) {
                    Text("ChatGPT").tag(ResearchProvider.chatGPTDeepResearch)
                    Text("Gemini").tag(ResearchProvider.geminiDeepResearch)
                }
                .frame(width: 180)

                Picker("Make", selection: $promptMake) {
                    Text("Hyundai and Kia").tag("Hyundai and Kia")
                    Text("Hyundai").tag("Hyundai")
                    Text("Kia").tag("Kia")
                }
                .frame(width: 180)

                TextField("Optional model", text: $promptModel)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 180)

                Spacer()

                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(prompt, forType: .string)
                } label: {
                    Label("Copy Prompt", systemImage: "doc.on.doc")
                }
            }

            TextEditor(text: .constant(prompt))
                .font(.system(.body, design: .monospaced))
                .scrollContentBackground(.hidden)
                .padding(10)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .padding(16)
    }

    private var importReviewView: some View {
        HSplitView {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Research Batches")
                        .font(.headline)
                    Spacer()
                    Button {
                        isFileImporterPresented = true
                    } label: {
                        Label("Import CSV/JSON", systemImage: "square.and.arrow.down")
                    }
                    .disabled(isImportingResearch)
                }
                if let importStatusMessage {
                    Text(importStatusMessage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                List(inventoryStore.researchBatches) { batch in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(batch.provider.rawValue)
                            .fontWeight(.medium)
                        Text("\(batch.acceptedRows) accepted, \(batch.rejectedRows) rejected, \(batch.reviewQueueRecords) review")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(Formatters.relative(date: batch.createdAt))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .overlay {
                    if inventoryStore.researchBatches.isEmpty {
                        ContentUnavailableView(
                            "No Research Batches",
                            systemImage: "doc.badge.plus",
                            description: Text("Imported files will appear here with accepted, rejected, and review counts.")
                        )
                    }
                }
            }
            .padding(16)
            .frame(minWidth: 320)

            VStack(alignment: .leading, spacing: 12) {
                Text("Import Review")
                    .font(.headline)
                if isImportingResearch {
                    HStack(spacing: 8) {
                        ProgressView()
                            .controlSize(.small)
                        Text("Importing source-backed rows")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                ReviewQueueView(items: inventoryStore.reviewQueue)
                Text("Hold rows with missing source URLs, impossible prices, unsupported makes, stale evidence, or trim mismatches until corrected.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(16)
            .frame(minWidth: 420)
        }
    }

    private var rankedListings: [ScoredInventoryListing] {
        leverageCalculator.rankedListings(
            inventoryStore.inventoryListings.filter { $0.make == "Hyundai" || $0.make == "Kia" },
            incentives: inventoryStore.incentivePrograms,
            financeOffers: inventoryStore.financeOffers
        )
    }

    private var filteredRankedListings: [ScoredInventoryListing] {
        rankedListings.filter { item in
            let listing = item.listing
            guard listing.year == 2025 || listing.year == 2026 else { return false }
            guard catalogStore.selectedPowertrains.contains(listing.powertrain) else { return false }
            guard matchesScope(listing) else { return false }

            let query = catalogStore.query.trimmingCharacters(in: .whitespacesAndNewlines).localizedLowercase
            guard !query.isEmpty else { return true }
            let haystack = "\(listing.make) \(listing.model) \(listing.trim) \(listing.dealerName) \(listing.city)".localizedLowercase
            return haystack.contains(query)
        }
    }

    private var selectedScoredListing: ScoredInventoryListing? {
        guard let selectedID = inventoryStore.selectedInventoryListingID else {
            return filteredRankedListings.first
        }
        return rankedListings.first { $0.id == selectedID } ?? filteredRankedListings.first
    }

    private var currentResearchPrompt: String {
        promptGenerator.prompt(
            provider: promptProvider,
            make: promptMake == "Hyundai and Kia" ? nil : promptMake,
            model: promptModel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : promptModel,
            radiusMode: catalogStore.selectedRadiusMode,
            postalCode: buyerPostalCode
        )
    }

    private func matchesScope(_ listing: InventoryListing) -> Bool {
        switch catalogStore.selectedRadiusMode {
        case .hundredKm:
            return (listing.distanceFromConfiguredPostalCodeKm ?? .infinity) <= 100
        case .oneFiftyKm:
            return (listing.distanceFromConfiguredPostalCodeKm ?? .infinity) <= 150
        case .province:
            return listing.province == catalogStore.selectedProvince || catalogStore.selectedProvince == "National"
        case .national:
            return true
        }
    }

    private func metricPill(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
                .monospacedDigit()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func powertrainBinding(_ powertrain: PowertrainType) -> Binding<Bool> {
        Binding(
            get: { catalogStore.selectedPowertrains.contains(powertrain) },
            set: { enabled in
                if enabled {
                    catalogStore.selectedPowertrains.insert(powertrain)
                } else {
                    catalogStore.selectedPowertrains.remove(powertrain)
                }
            }
        )
    }

    private func sourceBadge(_ sourceType: ResearchSourceType, confidence: ConfidenceLevel) -> some View {
        Text("\(sourceType.rawValue) / \(confidence.displayName)")
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(sourceColor(sourceType, confidence: confidence).opacity(0.15), in: Capsule())
            .foregroundStyle(sourceColor(sourceType, confidence: confidence))
    }

    private func sourceColor(_ sourceType: ResearchSourceType, confidence: ConfidenceLevel) -> Color {
        if confidence == .low || sourceType == .marketplace {
            return .orange
        }
        if sourceType == .dealer || sourceType == .oem {
            return .green
        }
        return .secondary
    }

    private func handleImportSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            isImportingResearch = true
            importStatusMessage = "Importing \(url.lastPathComponent)..."
            Task {
                do {
                    try await researchImportAction(url, promptProvider, currentResearchPrompt)
                    importStatusMessage = "Imported \(url.lastPathComponent). Review rejected rows before using them as leverage."
                } catch {
                    importStatusMessage = "Import failed: \(error.localizedDescription)"
                }
                isImportingResearch = false
            }
        case .failure(let error):
            importStatusMessage = "Import failed: \(error.localizedDescription)"
        }
    }

    private func waterfallRow(_ title: String, _ value: Double, emphasized: Bool = false) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(Formatters.currency(value))
                .fontWeight(emphasized ? .semibold : .regular)
                .monospacedDigit()
        }
        .font(emphasized ? .subheadline : .caption)
    }

    private func scoreBar(_ title: String, _ value: Double) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                Spacer()
                Text(String(format: "%.0f", value))
                    .monospacedDigit()
            }
            .font(.caption)
            ProgressView(value: value, total: 100)
        }
    }

    private func labelValue(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .textSelection(.enabled)
        }
        .font(.caption)
    }

    private func scopeTitle(_ mode: RadiusMode) -> String {
        switch mode {
        case .hundredKm: "100 km"
        case .oneFiftyKm: "150 km"
        case .province: "Ontario"
        case .national: "National"
        }
    }

    private func provinceAbbreviation(_ province: String) -> String {
        switch province {
        case "Ontario": "ON"
        case "Quebec": "QC"
        case "British Columbia": "BC"
        case "Alberta": "AB"
        default: String(province.prefix(2)).uppercased()
        }
    }
}

private enum DashboardTab: String, CaseIterable, Identifiable {
    case bestTargets
    case researchPrompt
    case importReview
    case vehicleDetail

    var id: String { rawValue }

    var title: String {
        switch self {
        case .bestTargets: "Best Targets"
        case .researchPrompt: "Research Prompt"
        case .importReview: "Import Review"
        case .vehicleDetail: "Detail"
        }
    }

    var systemImage: String {
        switch self {
        case .bestTargets: "target"
        case .researchPrompt: "text.page.badge.magnifyingglass"
        case .importReview: "tray.full"
        case .vehicleDetail: "doc.text.magnifyingglass"
        }
    }
}
