import Foundation

public enum ConfidenceLevel: String, Codable, CaseIterable, Sendable, Identifiable {
    case high
    case medium
    case low

    public var id: String { rawValue }

    public var displayName: String {
        rawValue.capitalized
    }

    public var score: Int {
        switch self {
        case .high: 3
        case .medium: 2
        case .low: 1
        }
    }
}

public enum RadiusMode: String, Codable, CaseIterable, Sendable, Identifiable {
    case hundredKm = "100km"
    case oneFiftyKm = "150km"
    case province
    case national

    public var id: String { rawValue }
}

public enum PowertrainType: String, Codable, CaseIterable, Sendable, Identifiable {
    case bev = "BEV"
    case phev = "PHEV"
    case erev = "EREV"
    case hev = "HEV"

    public var id: String { rawValue }
}

public enum ResearchProvider: String, Codable, CaseIterable, Sendable, Identifiable {
    case chatGPTDeepResearch = "ChatGPT Deep Research"
    case geminiDeepResearch = "Gemini Deep Research"
    case manual = "Manual"

    public var id: String { rawValue }
}

public enum ResearchSourceType: String, Codable, CaseIterable, Sendable, Identifiable {
    case oem = "OEM"
    case dealer = "Dealer"
    case marketplace = "Marketplace"
    case government = "Government"
    case manual = "Manual"

    public var id: String { rawValue }
}

public enum ListingCondition: String, Codable, CaseIterable, Sendable, Identifiable {
    case new
    case used

    public var id: String { rawValue }
}

public enum RangeView: String, Codable, CaseIterable, Sendable, Identifiable {
    case city
    case highway
    case combined

    public var id: String { rawValue }
}

public enum ChargeType: String, Codable, CaseIterable, Sendable, Identifiable {
    case level1 = "L1"
    case level2 = "L2"
    case level3 = "L3"

    public var id: String { rawValue }
}

public struct ProvenanceRecord: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var sourceName: String
    public var detail: String
    public var sourceURL: String?
    public var lastVerifiedAt: Date

    public init(
        id: String = UUID().uuidString,
        sourceName: String,
        detail: String,
        sourceURL: String? = nil,
        lastVerifiedAt: Date = .now
    ) {
        self.id = id
        self.sourceName = sourceName
        self.detail = detail
        self.sourceURL = sourceURL
        self.lastVerifiedAt = lastVerifiedAt
    }
}

public struct CanonicalVehicle: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var make: String
    public var model: String
    public var trim: String
    public var year: Int
    public var powertrain: PowertrainType
    public var msrpCAD: Double
    public var batteryCapacityKWh: Double?
    public var rangeCityKm: Int
    public var rangeHighwayKm: Int
    public var rangeCombinedKm: Int
    public var maxChargeRateKW: Double?
    public var level1Hours: Double?
    public var level2Hours: Double?
    public var fastChargeMinutesTenToEighty: Int?
    public var defaultProvince: String
    public var confidence: ConfidenceLevel
    public var provenance: [ProvenanceRecord]
    public var notes: [String]
    public var isComingSoon: Bool

    public init(
        id: String = UUID().uuidString,
        make: String,
        model: String,
        trim: String,
        year: Int,
        powertrain: PowertrainType,
        msrpCAD: Double,
        batteryCapacityKWh: Double? = nil,
        rangeCityKm: Int,
        rangeHighwayKm: Int,
        rangeCombinedKm: Int,
        maxChargeRateKW: Double? = nil,
        level1Hours: Double? = nil,
        level2Hours: Double? = nil,
        fastChargeMinutesTenToEighty: Int? = nil,
        defaultProvince: String = "Ontario",
        confidence: ConfidenceLevel,
        provenance: [ProvenanceRecord],
        notes: [String] = [],
        isComingSoon: Bool = false
    ) {
        self.id = id
        self.make = make
        self.model = model
        self.trim = trim
        self.year = year
        self.powertrain = powertrain
        self.msrpCAD = msrpCAD
        self.batteryCapacityKWh = batteryCapacityKWh
        self.rangeCityKm = rangeCityKm
        self.rangeHighwayKm = rangeHighwayKm
        self.rangeCombinedKm = rangeCombinedKm
        self.maxChargeRateKW = maxChargeRateKW
        self.level1Hours = level1Hours
        self.level2Hours = level2Hours
        self.fastChargeMinutesTenToEighty = fastChargeMinutesTenToEighty
        self.defaultProvince = defaultProvince
        self.confidence = confidence
        self.provenance = provenance
        self.notes = notes
        self.isComingSoon = isComingSoon
    }

    public var displayName: String {
        "\(year) \(make) \(model) \(trim)"
    }
}

public struct Listing: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var canonicalVehicleID: String
    public var sourceID: String
    public var dealerName: String
    public var city: String
    public var province: String
    public var locationLabel: String
    public var priceCAD: Double
    public var mileageKm: Int?
    public var condition: ListingCondition
    public var sourceURL: String
    public var confidence: ConfidenceLevel
    public var updatedAt: Date
    public var notes: [String]

    public init(
        id: String = UUID().uuidString,
        canonicalVehicleID: String,
        sourceID: String,
        dealerName: String,
        city: String,
        province: String,
        locationLabel: String,
        priceCAD: Double,
        mileageKm: Int? = nil,
        condition: ListingCondition,
        sourceURL: String,
        confidence: ConfidenceLevel,
        updatedAt: Date = .now,
        notes: [String] = []
    ) {
        self.id = id
        self.canonicalVehicleID = canonicalVehicleID
        self.sourceID = sourceID
        self.dealerName = dealerName
        self.city = city
        self.province = province
        self.locationLabel = locationLabel
        self.priceCAD = priceCAD
        self.mileageKm = mileageKm
        self.condition = condition
        self.sourceURL = sourceURL
        self.confidence = confidence
        self.updatedAt = updatedAt
        self.notes = notes
    }
}

public struct Dealer: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var city: String
    public var province: String
    public var websiteURL: String?

    public init(id: String = UUID().uuidString, name: String, city: String, province: String, websiteURL: String? = nil) {
        self.id = id
        self.name = name
        self.city = city
        self.province = province
        self.websiteURL = websiteURL
    }
}

public struct Source: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var displayName: String
    public var kind: String
    public var isEnabled: Bool

    public init(id: String, displayName: String, kind: String, isEnabled: Bool = true) {
        self.id = id
        self.displayName = displayName
        self.kind = kind
        self.isEnabled = isEnabled
    }
}

public struct SourceRun: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var sourceID: String
    public var displayName: String
    public var startedAt: Date
    public var completedAt: Date?
    public var status: String
    public var fetchedRecords: Int
    public var publishedRecords: Int
    public var reviewRecords: Int
    public var errorMessage: String?

    public init(
        id: String = UUID().uuidString,
        sourceID: String,
        displayName: String,
        startedAt: Date = .now,
        completedAt: Date? = nil,
        status: String,
        fetchedRecords: Int,
        publishedRecords: Int,
        reviewRecords: Int,
        errorMessage: String? = nil
    ) {
        self.id = id
        self.sourceID = sourceID
        self.displayName = displayName
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.status = status
        self.fetchedRecords = fetchedRecords
        self.publishedRecords = publishedRecords
        self.reviewRecords = reviewRecords
        self.errorMessage = errorMessage
    }
}

public struct SavedSearch: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var query: String
    public var radiusMode: RadiusMode
    public var province: String
    public var powertrains: [PowertrainType]
    public var notificationsEnabled: Bool
    public var createdAt: Date

    public init(
        id: String = UUID().uuidString,
        name: String,
        query: String,
        radiusMode: RadiusMode,
        province: String,
        powertrains: [PowertrainType],
        notificationsEnabled: Bool,
        createdAt: Date = .now
    ) {
        self.id = id
        self.name = name
        self.query = query
        self.radiusMode = radiusMode
        self.province = province
        self.powertrains = powertrains
        self.notificationsEnabled = notificationsEnabled
        self.createdAt = createdAt
    }
}

public struct CompareSet: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var vehicleIDs: [String]
    public var createdAt: Date

    public init(id: String = UUID().uuidString, name: String, vehicleIDs: [String], createdAt: Date = .now) {
        self.id = id
        self.name = name
        self.vehicleIDs = vehicleIDs
        self.createdAt = createdAt
    }
}

public struct RangeEstimate: Codable, Hashable, Sendable {
    public var cityKm: Int
    public var highwayKm: Int
    public var combinedKm: Int
    public var note: String

    public init(cityKm: Int, highwayKm: Int, combinedKm: Int, note: String) {
        self.cityKm = cityKm
        self.highwayKm = highwayKm
        self.combinedKm = combinedKm
        self.note = note
    }
}

public struct ChargingEstimate: Codable, Hashable, Sendable {
    public var chargeType: ChargeType
    public var estimatedHours: Double?
    public var estimatedMinutes: Int?
    public var tenToEightyMinutes: Int?
    public var note: String

    public init(
        chargeType: ChargeType,
        estimatedHours: Double? = nil,
        estimatedMinutes: Int? = nil,
        tenToEightyMinutes: Int? = nil,
        note: String
    ) {
        self.chargeType = chargeType
        self.estimatedHours = estimatedHours
        self.estimatedMinutes = estimatedMinutes
        self.tenToEightyMinutes = tenToEightyMinutes
        self.note = note
    }
}

public struct ReviewQueueItem: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var sourceRunID: String
    public var reason: String
    public var severity: ConfidenceLevel
    public var rawIdentifier: String
    public var rawPayload: String
    public var createdAt: Date

    public init(
        id: String = UUID().uuidString,
        sourceRunID: String,
        reason: String,
        severity: ConfidenceLevel,
        rawIdentifier: String,
        rawPayload: String,
        createdAt: Date = .now
    ) {
        self.id = id
        self.sourceRunID = sourceRunID
        self.reason = reason
        self.severity = severity
        self.rawIdentifier = rawIdentifier
        self.rawPayload = rawPayload
        self.createdAt = createdAt
    }
}

public struct RawVehicleSnapshot: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var sourceID: String
    public var externalListingID: String
    public var dealerName: String?
    public var make: String
    public var model: String
    public var trim: String
    public var year: Int
    public var powertrain: PowertrainType
    public var msrpCAD: Double?
    public var listingPriceCAD: Double
    public var city: String
    public var province: String
    public var condition: ListingCondition
    public var sourceURL: String
    public var confidenceHint: ConfidenceLevel
    public var batteryCapacityKWh: Double?
    public var rangeCombinedKm: Int?
    public var matchedCanonicalVehicleID: String?
    public var notes: [String]

    public init(
        id: String = UUID().uuidString,
        sourceID: String,
        externalListingID: String,
        dealerName: String? = nil,
        make: String,
        model: String,
        trim: String,
        year: Int,
        powertrain: PowertrainType,
        msrpCAD: Double?,
        listingPriceCAD: Double,
        city: String,
        province: String,
        condition: ListingCondition,
        sourceURL: String,
        confidenceHint: ConfidenceLevel,
        batteryCapacityKWh: Double? = nil,
        rangeCombinedKm: Int? = nil,
        matchedCanonicalVehicleID: String? = nil,
        notes: [String] = []
    ) {
        self.id = id
        self.sourceID = sourceID
        self.externalListingID = externalListingID
        self.dealerName = dealerName
        self.make = make
        self.model = model
        self.trim = trim
        self.year = year
        self.powertrain = powertrain
        self.msrpCAD = msrpCAD
        self.listingPriceCAD = listingPriceCAD
        self.city = city
        self.province = province
        self.condition = condition
        self.sourceURL = sourceURL
        self.confidenceHint = confidenceHint
        self.batteryCapacityKWh = batteryCapacityKWh
        self.rangeCombinedKm = rangeCombinedKm
        self.matchedCanonicalVehicleID = matchedCanonicalVehicleID
        self.notes = notes
    }
}

public struct DealerProfile: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var brand: String
    public var city: String
    public var province: String
    public var websiteURL: String?
    public var distanceFromConfiguredPostalCodeKm: Double?

    public init(
        id: String = UUID().uuidString,
        name: String,
        brand: String,
        city: String,
        province: String,
        websiteURL: String? = nil,
        distanceFromConfiguredPostalCodeKm: Double? = nil
    ) {
        self.id = id
        self.name = name
        self.brand = brand
        self.city = city
        self.province = province
        self.websiteURL = websiteURL
        self.distanceFromConfiguredPostalCodeKm = distanceFromConfiguredPostalCodeKm
    }
}

public struct PriceBreakdown: Codable, Hashable, Sendable {
    public var msrpCAD: Double
    public var advertisedPriceCAD: Double
    public var dealerDiscountCAD: Double
    public var manufacturerDiscountCAD: Double
    public var mandatoryFeesCAD: Double
    public var incentiveAmountCAD: Double
    public var taxRate: Double

    public init(
        msrpCAD: Double,
        advertisedPriceCAD: Double,
        dealerDiscountCAD: Double = 0,
        manufacturerDiscountCAD: Double = 0,
        mandatoryFeesCAD: Double = 0,
        incentiveAmountCAD: Double = 0,
        taxRate: Double = 0.13
    ) {
        self.msrpCAD = msrpCAD
        self.advertisedPriceCAD = advertisedPriceCAD
        self.dealerDiscountCAD = dealerDiscountCAD
        self.manufacturerDiscountCAD = manufacturerDiscountCAD
        self.mandatoryFeesCAD = mandatoryFeesCAD
        self.incentiveAmountCAD = incentiveAmountCAD
        self.taxRate = taxRate
    }

    public var effectivePreTaxPriceCAD: Double {
        max(0, advertisedPriceCAD + mandatoryFeesCAD - incentiveAmountCAD)
    }

    public var effectiveAfterTaxPriceCAD: Double {
        effectivePreTaxPriceCAD * (1 + taxRate)
    }

    public var discountFromMSRPCAD: Double {
        max(0, msrpCAD - advertisedPriceCAD + dealerDiscountCAD + manufacturerDiscountCAD)
    }
}

public struct InventoryListing: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var canonicalVehicleID: String
    public var vin: String?
    public var stockNumber: String?
    public var make: String
    public var model: String
    public var trim: String
    public var year: Int
    public var powertrain: PowertrainType
    public var dealerID: String?
    public var dealerName: String
    public var city: String
    public var province: String
    public var distanceFromConfiguredPostalCodeKm: Double?
    public var condition: ListingCondition
    public var odometerKm: Int?
    public var status: String
    public var advertisedPriceCAD: Double
    public var msrpCAD: Double
    public var priceBreakdown: PriceBreakdown
    public var sourceURL: String
    public var sourceType: ResearchSourceType
    public var confidence: ConfidenceLevel
    public var firstSeenAt: Date
    public var lastSeenAt: Date
    public var incentiveProgramIDs: [String]
    public var financeOfferIDs: [String]
    public var notes: [String]

    public init(
        id: String = UUID().uuidString,
        canonicalVehicleID: String,
        vin: String? = nil,
        stockNumber: String? = nil,
        make: String,
        model: String,
        trim: String,
        year: Int,
        powertrain: PowertrainType,
        dealerID: String? = nil,
        dealerName: String,
        city: String,
        province: String,
        distanceFromConfiguredPostalCodeKm: Double? = nil,
        condition: ListingCondition = .new,
        odometerKm: Int? = nil,
        status: String,
        advertisedPriceCAD: Double,
        msrpCAD: Double,
        priceBreakdown: PriceBreakdown? = nil,
        sourceURL: String,
        sourceType: ResearchSourceType,
        confidence: ConfidenceLevel,
        firstSeenAt: Date = .now,
        lastSeenAt: Date = .now,
        incentiveProgramIDs: [String] = [],
        financeOfferIDs: [String] = [],
        notes: [String] = []
    ) {
        self.id = id
        self.canonicalVehicleID = canonicalVehicleID
        self.vin = vin
        self.stockNumber = stockNumber
        self.make = make
        self.model = model
        self.trim = trim
        self.year = year
        self.powertrain = powertrain
        self.dealerID = dealerID
        self.dealerName = dealerName
        self.city = city
        self.province = province
        self.distanceFromConfiguredPostalCodeKm = distanceFromConfiguredPostalCodeKm
        self.condition = condition
        self.odometerKm = odometerKm
        self.status = status
        self.advertisedPriceCAD = advertisedPriceCAD
        self.msrpCAD = msrpCAD
        self.priceBreakdown = priceBreakdown ?? PriceBreakdown(msrpCAD: msrpCAD, advertisedPriceCAD: advertisedPriceCAD)
        self.sourceURL = sourceURL
        self.sourceType = sourceType
        self.confidence = confidence
        self.firstSeenAt = firstSeenAt
        self.lastSeenAt = lastSeenAt
        self.incentiveProgramIDs = incentiveProgramIDs
        self.financeOfferIDs = financeOfferIDs
        self.notes = notes
    }

    public var displayName: String {
        "\(year) \(make) \(model) \(trim)"
    }
}

public struct IncentiveProgram: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var kind: String
    public var jurisdiction: String
    public var applicableMakes: [String]
    public var applicableModels: [String]
    public var maxAmountCAD: Double
    public var eligibilityNotes: String
    public var sourceURL: String
    public var lastVerifiedAt: Date

    public init(
        id: String = UUID().uuidString,
        name: String,
        kind: String,
        jurisdiction: String,
        applicableMakes: [String],
        applicableModels: [String],
        maxAmountCAD: Double,
        eligibilityNotes: String,
        sourceURL: String,
        lastVerifiedAt: Date = .now
    ) {
        self.id = id
        self.name = name
        self.kind = kind
        self.jurisdiction = jurisdiction
        self.applicableMakes = applicableMakes
        self.applicableModels = applicableModels
        self.maxAmountCAD = maxAmountCAD
        self.eligibilityNotes = eligibilityNotes
        self.sourceURL = sourceURL
        self.lastVerifiedAt = lastVerifiedAt
    }
}

public struct FinanceOffer: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var listingID: String?
    public var sourceName: String
    public var aprPercent: Double
    public var termMonths: Int
    public var monthlyPaymentCAD: Double?
    public var downPaymentCAD: Double?
    public var mandatoryFeesCAD: Double
    public var expiresAt: Date?
    public var sourceURL: String
    public var notes: [String]

    public init(
        id: String = UUID().uuidString,
        listingID: String? = nil,
        sourceName: String,
        aprPercent: Double,
        termMonths: Int,
        monthlyPaymentCAD: Double? = nil,
        downPaymentCAD: Double? = nil,
        mandatoryFeesCAD: Double = 0,
        expiresAt: Date? = nil,
        sourceURL: String,
        notes: [String] = []
    ) {
        self.id = id
        self.listingID = listingID
        self.sourceName = sourceName
        self.aprPercent = aprPercent
        self.termMonths = termMonths
        self.monthlyPaymentCAD = monthlyPaymentCAD
        self.downPaymentCAD = downPaymentCAD
        self.mandatoryFeesCAD = mandatoryFeesCAD
        self.expiresAt = expiresAt
        self.sourceURL = sourceURL
        self.notes = notes
    }
}

public struct ResearchBatch: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var provider: ResearchProvider
    public var prompt: String
    public var importedFileName: String?
    public var sourceCount: Int
    public var acceptedRows: Int
    public var rejectedRows: Int
    public var reviewQueueRecords: Int
    public var createdAt: Date

    public init(
        id: String = UUID().uuidString,
        provider: ResearchProvider,
        prompt: String,
        importedFileName: String? = nil,
        sourceCount: Int,
        acceptedRows: Int,
        rejectedRows: Int,
        reviewQueueRecords: Int,
        createdAt: Date = .now
    ) {
        self.id = id
        self.provider = provider
        self.prompt = prompt
        self.importedFileName = importedFileName
        self.sourceCount = sourceCount
        self.acceptedRows = acceptedRows
        self.rejectedRows = rejectedRows
        self.reviewQueueRecords = reviewQueueRecords
        self.createdAt = createdAt
    }
}

public struct LeverageScore: Identifiable, Codable, Hashable, Sendable {
    public var id: String { inventoryListingID }
    public var inventoryListingID: String
    public var total: Double
    public var dealerWeakness: Double
    public var discountGap: Double
    public var supplyPressure: Double
    public var incentives: Double
    public var evidenceQuality: Double
    public var reasons: [String]

    public init(
        inventoryListingID: String,
        total: Double,
        dealerWeakness: Double,
        discountGap: Double,
        supplyPressure: Double,
        incentives: Double,
        evidenceQuality: Double,
        reasons: [String]
    ) {
        self.inventoryListingID = inventoryListingID
        self.total = total
        self.dealerWeakness = dealerWeakness
        self.discountGap = discountGap
        self.supplyPressure = supplyPressure
        self.incentives = incentives
        self.evidenceQuality = evidenceQuality
        self.reasons = reasons
    }
}
