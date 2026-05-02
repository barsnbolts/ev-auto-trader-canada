import AppModels
import Foundation
import Observation
import Persistence
import Support

@MainActor
@Observable
public final class InventoryStore {
    public var listings: [Listing] = []
    public var inventoryListings: [InventoryListing] = []
    public var dealerProfiles: [DealerProfile] = []
    public var incentivePrograms: [IncentiveProgram] = []
    public var financeOffers: [FinanceOffer] = []
    public var researchBatches: [ResearchBatch] = []
    public var selectedInventoryListingID: String?
    public var allSourceRuns: [SourceRun] = []
    public var reviewQueue: [ReviewQueueItem] = []
    public var savedSearches: [SavedSearch] = []
    public var compareSets: [CompareSet] = []

    public init() {}

    public func load(from database: AppDatabase, vehicleID: String?) async throws {
        listings = try await database.fetchListings(for: vehicleID)
        inventoryListings = try await database.fetchInventoryListings()
        dealerProfiles = try await database.fetchDealerProfiles()
        incentivePrograms = try await database.fetchIncentivePrograms()
        financeOffers = try await database.fetchFinanceOffers()
        researchBatches = try await database.fetchResearchBatches()
        allSourceRuns = try await database.fetchSourceRuns()
        reviewQueue = try await database.fetchReviewQueue()
        savedSearches = try await database.fetchSavedSearches()
        compareSets = try await database.fetchCompareSets()

        if selectedInventoryListingID == nil {
            selectedInventoryListingID = inventoryListings.first?.id
        }
    }

    public var latestRun: SourceRun? {
        allSourceRuns.first
    }

    public var selectedInventoryListing: InventoryListing? {
        guard let selectedInventoryListingID else { return inventoryListings.first }
        return inventoryListings.first { $0.id == selectedInventoryListingID } ?? inventoryListings.first
    }

    public func selectInventoryListing(id: String) {
        selectedInventoryListingID = id
    }

    public func importResearchFile(
        at url: URL,
        provider: ResearchProvider,
        prompt: String,
        using database: AppDatabase
    ) async throws {
        let didStartAccessing = url.startAccessingSecurityScopedResource()
        defer {
            if didStartAccessing {
                url.stopAccessingSecurityScopedResource()
            }
        }

        let rows = try ResearchImportFileParser().parseRows(from: url)
        let assembler = ResearchImportAssembler()
        let plan = assembler.writePlan(
            rows: rows,
            provider: provider,
            prompt: prompt,
            importedFileName: url.lastPathComponent
        )

        try await database.replaceInventoryListings(
            assembler.mergedListings(existing: inventoryListings, imported: plan.listings)
        )
        try await database.replaceResearchBatches(
            assembler.mergedBatches(existing: researchBatches, imported: plan.batch)
        )
        try await database.replaceReviewQueue(
            assembler.mergedReviewItems(existing: reviewQueue, imported: plan.reviewItems)
        )
        try await load(from: database, vehicleID: nil)
        selectedInventoryListingID = plan.listings.first?.id ?? selectedInventoryListingID
    }
}
