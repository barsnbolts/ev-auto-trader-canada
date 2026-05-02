import AppModels
import Foundation

public enum SampleData {
    public static let canonicalVehicles: [CanonicalVehicle] = [
        CanonicalVehicle(
            id: "tesla-model3-rwd-2024",
            make: "Tesla",
            model: "Model 3",
            trim: "RWD",
            year: 2024,
            powertrain: .bev,
            msrpCAD: 54990,
            batteryCapacityKWh: 57.5,
            rangeCityKm: 540,
            rangeHighwayKm: 470,
            rangeCombinedKm: 513,
            maxChargeRateKW: 170,
            level1Hours: 42,
            level2Hours: 8.5,
            fastChargeMinutesTenToEighty: 27,
            confidence: .high,
            provenance: [
                ProvenanceRecord(sourceName: "Tesla Canada", detail: "Official spec sheet and pricing.", sourceURL: "https://www.tesla.com/en_ca/model3")
            ],
            notes: ["Best for value-focused Ontario shoppers.", "Strong fast-charge network support."]
        ),
        CanonicalVehicle(
            id: "hyundai-ioniq5-preferred-awd-2024",
            make: "Hyundai",
            model: "IONIQ 5",
            trim: "Preferred AWD Long Range",
            year: 2024,
            powertrain: .bev,
            msrpCAD: 58999,
            batteryCapacityKWh: 77.4,
            rangeCityKm: 512,
            rangeHighwayKm: 432,
            rangeCombinedKm: 488,
            maxChargeRateKW: 235,
            level1Hours: 55,
            level2Hours: 7.2,
            fastChargeMinutesTenToEighty: 18,
            confidence: .high,
            provenance: [
                ProvenanceRecord(sourceName: "Hyundai Canada", detail: "OEM published specifications.", sourceURL: "https://www.hyundaicanada.com/")
            ],
            notes: ["800V platform makes it one of the fastest charging options."]
        ),
        CanonicalVehicle(
            id: "mitsubishi-outlander-phev-gt-2024",
            make: "Mitsubishi",
            model: "Outlander PHEV",
            trim: "GT S-AWC",
            year: 2024,
            powertrain: .phev,
            msrpCAD: 57398,
            batteryCapacityKWh: 20,
            rangeCityKm: 74,
            rangeHighwayKm: 62,
            rangeCombinedKm: 68,
            maxChargeRateKW: 38,
            level1Hours: 16,
            level2Hours: 6.5,
            fastChargeMinutesTenToEighty: 38,
            confidence: .high,
            provenance: [
                ProvenanceRecord(sourceName: "Mitsubishi Canada", detail: "Published electric and combined efficiency numbers.", sourceURL: "https://www.mitsubishi-motors.ca/")
            ],
            notes: ["Good electric-first family SUV if DC fast top-up matters."]
        ),
        CanonicalVehicle(
            id: "ram-1500-ramcharger-limited-2025",
            make: "Ram",
            model: "1500 Ramcharger",
            trim: "Limited",
            year: 2025,
            powertrain: .erev,
            msrpCAD: 89995,
            batteryCapacityKWh: 92,
            rangeCityKm: 236,
            rangeHighwayKm: 214,
            rangeCombinedKm: 225,
            maxChargeRateKW: 145,
            level1Hours: 78,
            level2Hours: 11,
            fastChargeMinutesTenToEighty: 36,
            confidence: .medium,
            provenance: [
                ProvenanceRecord(sourceName: "Ram Canada", detail: "Officially confirmed coming-soon program details.", sourceURL: "https://www.ramtrucks.ca/")
            ],
            notes: ["EREV figures are preliminary and should be reviewed before final publishing."],
            isComingSoon: true
        ),
        CanonicalVehicle(
            id: "kia-ev9-land-awd-2024",
            make: "Kia",
            model: "EV9",
            trim: "Land AWD",
            year: 2024,
            powertrain: .bev,
            msrpCAD: 74995,
            batteryCapacityKWh: 99.8,
            rangeCityKm: 489,
            rangeHighwayKm: 420,
            rangeCombinedKm: 451,
            maxChargeRateKW: 230,
            level1Hours: 68,
            level2Hours: 8.9,
            fastChargeMinutesTenToEighty: 24,
            confidence: .high,
            provenance: [
                ProvenanceRecord(sourceName: "Kia Canada", detail: "Official Canadian pricing and range values.", sourceURL: "https://www.kia.ca/")
            ],
            notes: ["Three-row EV with family-focused cargo and seating flexibility."]
        ),
        CanonicalVehicle(
            id: "volkswagen-id4-pro-s-2025",
            make: "Volkswagen",
            model: "ID.4",
            trim: "PRO S",
            year: 2025,
            powertrain: .bev,
            msrpCAD: 56842,
            batteryCapacityKWh: 82,
            rangeCityKm: 506,
            rangeHighwayKm: 428,
            rangeCombinedKm: 468,
            maxChargeRateKW: 175,
            level1Hours: 83,
            level2Hours: 8,
            fastChargeMinutesTenToEighty: 28,
            confidence: .medium,
            provenance: [
                ProvenanceRecord(sourceName: "Volkswagen Canada", detail: "Official 2025 ID.4 technical data and public inventory JSON.", sourceURL: "https://www.vw.ca/en/models/new-vehicles/2025-id4.html/__ui/technical-data.app")
            ],
            notes: ["Second selected live source path uses public Volkswagen Canada ID.4 inventory JSON.", "City/highway range estimates are derived from VW Canada energy-consumption ratios pending broader official catalog import."]
        ),
        CanonicalVehicle(
            id: "volkswagen-id4-pro-s-awd-2025",
            make: "Volkswagen",
            model: "ID.4",
            trim: "PRO S AWD",
            year: 2025,
            powertrain: .bev,
            msrpCAD: 60842,
            batteryCapacityKWh: 82,
            rangeCityKm: 447,
            rangeHighwayKm: 396,
            rangeCombinedKm: 423,
            maxChargeRateKW: 175,
            level1Hours: 83,
            level2Hours: 8,
            fastChargeMinutesTenToEighty: 28,
            confidence: .medium,
            provenance: [
                ProvenanceRecord(sourceName: "Volkswagen Canada", detail: "Official 2025 ID.4 technical data and public inventory JSON.", sourceURL: "https://www.vw.ca/en/models/new-vehicles/2025-id4.html/__ui/technical-data.app")
            ],
            notes: ["Second selected live source path uses public Volkswagen Canada ID.4 inventory JSON.", "City/highway range estimates are derived from VW Canada energy-consumption ratios pending broader official catalog import."]
        ),
        CanonicalVehicle(
            id: "ford-mustang-mach-e-select-2025",
            make: "Ford",
            model: "Mustang Mach-E",
            trim: "Select",
            year: 2025,
            powertrain: .bev,
            msrpCAD: 55995,
            batteryCapacityKWh: 73,
            rangeCityKm: 470,
            rangeHighwayKm: 395,
            rangeCombinedKm: 430,
            maxChargeRateKW: 150,
            level1Hours: 48,
            level2Hours: 8.2,
            fastChargeMinutesTenToEighty: 32,
            confidence: .medium,
            provenance: [
                ProvenanceRecord(sourceName: "Ford Canada", detail: "Public Mach-E inventory and model pages.", sourceURL: "https://www.ford.ca/suvs/mach-e/")
            ],
            notes: ["First selected live inventory path uses public Ford Canada dealer detail pages."]
        ),
        CanonicalVehicle(
            id: "ford-mustang-mach-e-premium-2025",
            make: "Ford",
            model: "Mustang Mach-E",
            trim: "Premium",
            year: 2025,
            powertrain: .bev,
            msrpCAD: 64995,
            batteryCapacityKWh: 88,
            rangeCityKm: 515,
            rangeHighwayKm: 435,
            rangeCombinedKm: 474,
            maxChargeRateKW: 150,
            level1Hours: 54,
            level2Hours: 8.8,
            fastChargeMinutesTenToEighty: 32,
            confidence: .medium,
            provenance: [
                ProvenanceRecord(sourceName: "Ford Canada", detail: "Public Mach-E inventory and model pages.", sourceURL: "https://www.ford.ca/suvs/mach-e/")
            ],
            notes: ["First selected live inventory path uses public Ford Canada dealer detail pages."]
        ),
        CanonicalVehicle(
            id: "ford-mustang-mach-e-gt-2025",
            make: "Ford",
            model: "Mustang Mach-E",
            trim: "GT",
            year: 2025,
            powertrain: .bev,
            msrpCAD: 76995,
            batteryCapacityKWh: 91,
            rangeCityKm: 455,
            rangeHighwayKm: 385,
            rangeCombinedKm: 420,
            maxChargeRateKW: 150,
            level1Hours: 54,
            level2Hours: 8.8,
            fastChargeMinutesTenToEighty: 32,
            confidence: .medium,
            provenance: [
                ProvenanceRecord(sourceName: "Ford Canada", detail: "Public Mach-E inventory and model pages.", sourceURL: "https://www.ford.ca/suvs/mach-e/")
            ],
            notes: ["First selected live inventory path uses public Ford Canada dealer detail pages."]
        ),
        CanonicalVehicle(
            id: "ford-mustang-mach-e-premium-2026",
            make: "Ford",
            model: "Mustang Mach-E",
            trim: "Premium",
            year: 2026,
            powertrain: .bev,
            msrpCAD: 66995,
            batteryCapacityKWh: 88,
            rangeCityKm: 525,
            rangeHighwayKm: 445,
            rangeCombinedKm: 485,
            maxChargeRateKW: 150,
            level1Hours: 54,
            level2Hours: 8.8,
            fastChargeMinutesTenToEighty: 32,
            confidence: .medium,
            provenance: [
                ProvenanceRecord(sourceName: "Ford Canada", detail: "Public Mach-E inventory and model pages.", sourceURL: "https://www.ford.ca/suvs/mach-e/")
            ],
            notes: ["First selected live inventory path uses public Ford Canada dealer detail pages."]
        )
    ]

    public static let listings: [Listing] = [
        Listing(
            id: "listing-oem-tesla-1",
            canonicalVehicleID: "tesla-model3-rwd-2024",
            sourceID: "oem-inventory",
            dealerName: "Tesla Toronto Lawrence",
            city: "Toronto",
            province: "Ontario",
            locationLabel: "Toronto, ON",
            priceCAD: 54490,
            condition: .new,
            sourceURL: "https://www.tesla.com/en_ca/inventory/new/m3",
            confidence: .high
        ),
        Listing(
            id: "listing-dealer-ioniq5-1",
            canonicalVehicleID: "hyundai-ioniq5-preferred-awd-2024",
            sourceID: "dealer-group",
            dealerName: "Downtown Hyundai",
            city: "Toronto",
            province: "Ontario",
            locationLabel: "Toronto, ON",
            priceCAD: 57688,
            condition: .new,
            sourceURL: "https://example.com/hyundai/ioniq5-1",
            confidence: .high
        ),
        Listing(
            id: "listing-dealer-outlander-1",
            canonicalVehicleID: "mitsubishi-outlander-phev-gt-2024",
            sourceID: "dealer-group",
            dealerName: "North York Mitsubishi",
            city: "North York",
            province: "Ontario",
            locationLabel: "North York, ON",
            priceCAD: 54995,
            mileageKm: 6200,
            condition: .used,
            sourceURL: "https://example.com/mitsubishi/outlander-phev-1",
            confidence: .high
        ),
        Listing(
            id: "listing-oem-ev9-1",
            canonicalVehicleID: "kia-ev9-land-awd-2024",
            sourceID: "oem-inventory",
            dealerName: "Kia Markham",
            city: "Markham",
            province: "Ontario",
            locationLabel: "Markham, ON",
            priceCAD: 73800,
            condition: .new,
            sourceURL: "https://example.com/kia/ev9-1",
            confidence: .high
        )
    ]

    public static let sourceRuns: [SourceRun] = [
        SourceRun(
            id: "source-run-oem-latest",
            sourceID: "oem-inventory",
            displayName: "OEM Inventory",
            startedAt: .now.addingTimeInterval(-3_600),
            completedAt: .now.addingTimeInterval(-3_540),
            status: "completed",
            fetchedRecords: 12,
            publishedRecords: 10,
            reviewRecords: 2
        ),
        SourceRun(
            id: "source-run-dealer-latest",
            sourceID: "dealer-group",
            displayName: "Dealer Group",
            startedAt: .now.addingTimeInterval(-7_200),
            completedAt: .now.addingTimeInterval(-7_140),
            status: "completed",
            fetchedRecords: 8,
            publishedRecords: 7,
            reviewRecords: 1
        )
    ]

    public static let reviewQueueItems: [ReviewQueueItem] = [
        ReviewQueueItem(
            id: "review-ramcharger-trim",
            sourceRunID: "source-run-oem-latest",
            reason: "Officially confirmed model but trim naming is still evolving.",
            severity: .medium,
            rawIdentifier: "ramcharger-limited-preprod",
            rawPayload: #"{"make":"Ram","model":"1500 Ramcharger","trim":"Limited Pre-Production","year":2025}"#
        )
    ]

    public static let savedSearches: [SavedSearch] = [
        SavedSearch(
            id: "saved-search-ontario-awd",
            name: "Ontario AWD EVs",
            query: "awd",
            radiusMode: .hundredKm,
            province: "Ontario",
            powertrains: [.bev],
            notificationsEnabled: true
        )
    ]

    public static let compareSets: [CompareSet] = [
        CompareSet(
            id: "compare-family-haulers",
            name: "Family EVs",
            vehicleIDs: [
                "hyundai-ioniq5-preferred-awd-2024",
                "kia-ev9-land-awd-2024",
                "mitsubishi-outlander-phev-gt-2024"
            ]
        )
    ]

    public static let oemSnapshots: [RawVehicleSnapshot] = [
        RawVehicleSnapshot(
            sourceID: "oem-inventory",
            externalListingID: "tesla-oem-2024-001",
            make: "Tesla",
            model: "Model 3",
            trim: "RWD",
            year: 2024,
            powertrain: .bev,
            msrpCAD: 54990,
            listingPriceCAD: 54490,
            city: "Toronto",
            province: "Ontario",
            condition: .new,
            sourceURL: "https://www.tesla.com/en_ca/inventory/new/m3",
            confidenceHint: .high,
            batteryCapacityKWh: 57.5,
            rangeCombinedKm: 513,
            matchedCanonicalVehicleID: "tesla-model3-rwd-2024"
        ),
        RawVehicleSnapshot(
            sourceID: "oem-inventory",
            externalListingID: "kia-oem-2024-ev9-001",
            make: "Kia",
            model: "EV9",
            trim: "Land AWD",
            year: 2024,
            powertrain: .bev,
            msrpCAD: 74995,
            listingPriceCAD: 73800,
            city: "Markham",
            province: "Ontario",
            condition: .new,
            sourceURL: "https://example.com/kia/ev9-1",
            confidenceHint: .high,
            batteryCapacityKWh: 99.8,
            rangeCombinedKm: 451,
            matchedCanonicalVehicleID: "kia-ev9-land-awd-2024"
        ),
        RawVehicleSnapshot(
            sourceID: "oem-inventory",
            externalListingID: "ram-2025-preprod-001",
            make: "Ram",
            model: "1500 Ramcharger",
            trim: "Limited Pre-Production",
            year: 2025,
            powertrain: .erev,
            msrpCAD: 89995,
            listingPriceCAD: 89995,
            city: "Windsor",
            province: "Ontario",
            condition: .new,
            sourceURL: "https://example.com/ram/ramcharger",
            confidenceHint: .medium,
            batteryCapacityKWh: 92,
            rangeCombinedKm: 225,
            notes: ["Trim naming needs review before auto-publish."]
        )
    ]

    public static let dealerSnapshots: [RawVehicleSnapshot] = [
        RawVehicleSnapshot(
            sourceID: "dealer-group",
            externalListingID: "hyundai-dg-001",
            make: "Hyundai",
            model: "IONIQ 5",
            trim: "Preferred AWD Long Range",
            year: 2024,
            powertrain: .bev,
            msrpCAD: 58999,
            listingPriceCAD: 57688,
            city: "Toronto",
            province: "Ontario",
            condition: .new,
            sourceURL: "https://example.com/hyundai/ioniq5-1",
            confidenceHint: .high,
            batteryCapacityKWh: 77.4,
            rangeCombinedKm: 488,
            matchedCanonicalVehicleID: "hyundai-ioniq5-preferred-awd-2024"
        ),
        RawVehicleSnapshot(
            sourceID: "dealer-group",
            externalListingID: "mitsubishi-dg-001",
            make: "Mitsubishi",
            model: "Outlander PHEV",
            trim: "GT S-AWC",
            year: 2024,
            powertrain: .phev,
            msrpCAD: 57398,
            listingPriceCAD: 54995,
            city: "North York",
            province: "Ontario",
            condition: .used,
            sourceURL: "https://example.com/mitsubishi/outlander-phev-1",
            confidenceHint: .high,
            batteryCapacityKWh: 20,
            rangeCombinedKm: 68,
            matchedCanonicalVehicleID: "mitsubishi-outlander-phev-gt-2024"
        )
    ]

    public static let dealLeverageCanonicalVehicles: [CanonicalVehicle] = [
        CanonicalVehicle(
            id: "hyundai-ioniq5-preferred-awd-2025",
            make: "Hyundai",
            model: "IONIQ 5",
            trim: "Preferred AWD Long Range",
            year: 2025,
            powertrain: .bev,
            msrpCAD: 58999,
            batteryCapacityKWh: 84,
            rangeCityKm: 520,
            rangeHighwayKm: 440,
            rangeCombinedKm: 488,
            maxChargeRateKW: 235,
            level1Hours: 55,
            level2Hours: 7.2,
            fastChargeMinutesTenToEighty: 18,
            confidence: .medium,
            provenance: [
                ProvenanceRecord(sourceName: "Hyundai Canada", detail: "Seeded buyer dashboard record; verify current MSRP and incentives before negotiating.", sourceURL: "https://www.hyundaicanada.com/en/showroom/ioniq-5")
            ],
            notes: ["Target-scope record for Hyundai/Kia leverage dashboard."]
        ),
        CanonicalVehicle(
            id: "hyundai-ioniq6-preferred-awd-2025",
            make: "Hyundai",
            model: "IONIQ 6",
            trim: "Preferred AWD Long Range",
            year: 2025,
            powertrain: .bev,
            msrpCAD: 58999,
            batteryCapacityKWh: 77.4,
            rangeCityKm: 520,
            rangeHighwayKm: 450,
            rangeCombinedKm: 499,
            maxChargeRateKW: 235,
            level1Hours: 54,
            level2Hours: 7.1,
            fastChargeMinutesTenToEighty: 18,
            confidence: .medium,
            provenance: [
                ProvenanceRecord(sourceName: "Hyundai Canada", detail: "Seeded buyer dashboard record; verify against current official spec sheet.", sourceURL: "https://www.hyundaicanada.com/")
            ],
            notes: ["Aerodynamic sedan alternative; compare dealer discount depth against IONIQ 5."]
        ),
        CanonicalVehicle(
            id: "hyundai-tucson-phev-ultimate-2025",
            make: "Hyundai",
            model: "Tucson PHEV",
            trim: "Ultimate AWD",
            year: 2025,
            powertrain: .phev,
            msrpCAD: 49999,
            batteryCapacityKWh: 13.8,
            rangeCityKm: 53,
            rangeHighwayKm: 45,
            rangeCombinedKm: 50,
            maxChargeRateKW: 7.2,
            level1Hours: 11,
            level2Hours: 2.2,
            fastChargeMinutesTenToEighty: nil,
            confidence: .medium,
            provenance: [
                ProvenanceRecord(sourceName: "Hyundai Canada", detail: "Seeded PHEV target-scope record; confirm current Canadian pricing.", sourceURL: "https://www.hyundaicanada.com/")
            ],
            notes: ["PHEV leverage candidate if EV incentives or BEV stock are weak."]
        ),
        CanonicalVehicle(
            id: "hyundai-santa-fe-hybrid-luxury-2025",
            make: "Hyundai",
            model: "Santa Fe Hybrid",
            trim: "Luxury AWD",
            year: 2025,
            powertrain: .hev,
            msrpCAD: 46999,
            batteryCapacityKWh: nil,
            rangeCityKm: 0,
            rangeHighwayKm: 0,
            rangeCombinedKm: 0,
            maxChargeRateKW: nil,
            level1Hours: nil,
            level2Hours: nil,
            fastChargeMinutesTenToEighty: nil,
            confidence: .low,
            provenance: [
                ProvenanceRecord(sourceName: "Hyundai Canada", detail: "Hybrid target-scope placeholder; update with official fuel economy rather than EV range.", sourceURL: "https://www.hyundaicanada.com/")
            ],
            notes: ["HEV included for deal leverage; electric range fields intentionally zero until hybrid-specific metrics are modeled."]
        ),
        CanonicalVehicle(
            id: "kia-ev6-land-awd-2025",
            make: "Kia",
            model: "EV6",
            trim: "Land AWD",
            year: 2025,
            powertrain: .bev,
            msrpCAD: 59995,
            batteryCapacityKWh: 84,
            rangeCityKm: 505,
            rangeHighwayKm: 430,
            rangeCombinedKm: 469,
            maxChargeRateKW: 235,
            level1Hours: 55,
            level2Hours: 7.3,
            fastChargeMinutesTenToEighty: 18,
            confidence: .medium,
            provenance: [
                ProvenanceRecord(sourceName: "Kia Canada", detail: "Seeded buyer dashboard record; verify with current Kia Canada pricing.", sourceURL: "https://www.kia.ca/")
            ],
            notes: ["800V platform; compare against IONIQ 5 discounts."]
        ),
        CanonicalVehicle(
            id: "kia-ev9-land-awd-2025",
            make: "Kia",
            model: "EV9",
            trim: "Land AWD",
            year: 2025,
            powertrain: .bev,
            msrpCAD: 74995,
            batteryCapacityKWh: 99.8,
            rangeCityKm: 489,
            rangeHighwayKm: 420,
            rangeCombinedKm: 451,
            maxChargeRateKW: 230,
            level1Hours: 68,
            level2Hours: 8.9,
            fastChargeMinutesTenToEighty: 24,
            confidence: .medium,
            provenance: [
                ProvenanceRecord(sourceName: "Kia Canada", detail: "Seeded buyer dashboard record; verify current EV9 trim pricing.", sourceURL: "https://www.kia.ca/content/dam/marketing/content/vehicles/brochures/2026/ev9/MY26_EV9_MAR10_ENG.pdf")
            ],
            notes: ["Three-row EV; high MSRP makes dealer discount spread especially important."]
        ),
        CanonicalVehicle(
            id: "kia-sportage-phev-ex-premium-2025",
            make: "Kia",
            model: "Sportage PHEV",
            trim: "EX Premium AWD",
            year: 2025,
            powertrain: .phev,
            msrpCAD: 45995,
            batteryCapacityKWh: 13.8,
            rangeCityKm: 55,
            rangeHighwayKm: 47,
            rangeCombinedKm: 51,
            maxChargeRateKW: 7.2,
            level1Hours: 11,
            level2Hours: 2.2,
            fastChargeMinutesTenToEighty: nil,
            confidence: .medium,
            provenance: [
                ProvenanceRecord(sourceName: "Kia Canada", detail: "Seeded PHEV record; confirm current trim and finance programs.", sourceURL: "https://www.kia.ca/")
            ],
            notes: ["PHEV stock may create stronger negotiation openings than scarce BEVs."]
        ),
        CanonicalVehicle(
            id: "kia-sorento-hybrid-ex-2025",
            make: "Kia",
            model: "Sorento Hybrid",
            trim: "EX AWD",
            year: 2025,
            powertrain: .hev,
            msrpCAD: 43995,
            batteryCapacityKWh: nil,
            rangeCityKm: 0,
            rangeHighwayKm: 0,
            rangeCombinedKm: 0,
            maxChargeRateKW: nil,
            level1Hours: nil,
            level2Hours: nil,
            fastChargeMinutesTenToEighty: nil,
            confidence: .low,
            provenance: [
                ProvenanceRecord(sourceName: "Kia Canada", detail: "Hybrid target-scope placeholder; import official hybrid metrics later.", sourceURL: "https://www.kia.ca/")
            ],
            notes: ["HEV included for broad electrified leverage; no plug-in charging metrics."]
        )
    ]

    public static let dealerProfiles: [DealerProfile] = [
        DealerProfile(id: "dealer-downtown-hyundai", name: "Downtown Hyundai", brand: "Hyundai", city: "Toronto", province: "Ontario", websiteURL: "https://www.downtownhyundai.com/", distanceFromConfiguredPostalCodeKm: 4),
        DealerProfile(id: "dealer-mississauga-hyundai", name: "Mississauga Hyundai", brand: "Hyundai", city: "Mississauga", province: "Ontario", websiteURL: "https://www.mississaugahyundai.com/", distanceFromConfiguredPostalCodeKm: 28),
        DealerProfile(id: "dealer-kia-markham", name: "Kia Markham", brand: "Kia", city: "Markham", province: "Ontario", websiteURL: "https://www.kiamarkham.com/", distanceFromConfiguredPostalCodeKm: 31),
        DealerProfile(id: "dealer-401-dixie-kia", name: "401 Dixie Kia", brand: "Kia", city: "Mississauga", province: "Ontario", websiteURL: "https://www.401dixiekia.com/", distanceFromConfiguredPostalCodeKm: 25)
    ]

    public static let incentivePrograms: [IncentiveProgram] = [
        IncentiveProgram(
            id: "incentive-evap-federal",
            name: "EVAP / Federal ZEV Incentive",
            kind: "Federal",
            jurisdiction: "Canada",
            applicableMakes: ["Hyundai", "Kia"],
            applicableModels: ["IONIQ", "EV6", "EV9", "Tucson PHEV", "Sportage PHEV"],
            maxAmountCAD: 5000,
            eligibilityNotes: "Eligibility and funding status must be verified immediately before negotiation.",
            sourceURL: "https://tc.canada.ca/en/road-transportation/innovative-technologies/electric-vehicles/electric-vehicle-affordability-program-evap/electric-vehicle-affordability-program-vehicle-list?page=2&wbdisable=true"
        )
    ]

    public static let inventoryListings: [InventoryListing] = [
        InventoryListing(
            id: "inventory-hyundai-ioniq5-downtown-2025-a",
            canonicalVehicleID: "hyundai-ioniq5-preferred-awd-2025",
            stockNumber: "HY-I5-2025-A",
            make: "Hyundai",
            model: "IONIQ 5",
            trim: "Preferred AWD Long Range",
            year: 2025,
            powertrain: .bev,
            dealerID: "dealer-downtown-hyundai",
            dealerName: "Downtown Hyundai",
            city: "Toronto",
            province: "Ontario",
            distanceFromConfiguredPostalCodeKm: 4,
            odometerKm: 230,
            status: "In Stock",
            advertisedPriceCAD: 55988,
            msrpCAD: 58999,
            priceBreakdown: PriceBreakdown(msrpCAD: 58999, advertisedPriceCAD: 55988, dealerDiscountCAD: 3011, mandatoryFeesCAD: 899, incentiveAmountCAD: 5000),
            sourceURL: "https://example.com/hyundai/ioniq5-downtown",
            sourceType: .dealer,
            confidence: .medium,
            firstSeenAt: .now.addingTimeInterval(-58 * 86_400),
            lastSeenAt: .now.addingTimeInterval(-2 * 86_400),
            incentiveProgramIDs: ["incentive-evap-federal"],
            notes: ["Demo mileage and 2025 model-year age make this a strong opening target."]
        ),
        InventoryListing(
            id: "inventory-hyundai-ioniq5-mississauga-2025-b",
            canonicalVehicleID: "hyundai-ioniq5-preferred-awd-2025",
            stockNumber: "HY-I5-2025-B",
            make: "Hyundai",
            model: "IONIQ 5",
            trim: "Preferred AWD Long Range",
            year: 2025,
            powertrain: .bev,
            dealerID: "dealer-mississauga-hyundai",
            dealerName: "Mississauga Hyundai",
            city: "Mississauga",
            province: "Ontario",
            distanceFromConfiguredPostalCodeKm: 28,
            status: "In Stock",
            advertisedPriceCAD: 57990,
            msrpCAD: 58999,
            priceBreakdown: PriceBreakdown(msrpCAD: 58999, advertisedPriceCAD: 57990, dealerDiscountCAD: 1009, mandatoryFeesCAD: 799, incentiveAmountCAD: 5000),
            sourceURL: "https://example.com/hyundai/ioniq5-mississauga",
            sourceType: .marketplace,
            confidence: .low,
            firstSeenAt: .now.addingTimeInterval(-32 * 86_400),
            lastSeenAt: .now.addingTimeInterval(-5 * 86_400),
            incentiveProgramIDs: ["incentive-evap-federal"],
            notes: ["Marketplace evidence; confirm on dealer page before using as a hard quote."]
        ),
        InventoryListing(
            id: "inventory-kia-ev9-markham-2025-a",
            canonicalVehicleID: "kia-ev9-land-awd-2025",
            stockNumber: "KIA-EV9-2025-A",
            make: "Kia",
            model: "EV9",
            trim: "Land AWD",
            year: 2025,
            powertrain: .bev,
            dealerID: "dealer-kia-markham",
            dealerName: "Kia Markham",
            city: "Markham",
            province: "Ontario",
            distanceFromConfiguredPostalCodeKm: 31,
            odometerKm: 110,
            status: "In Stock",
            advertisedPriceCAD: 71995,
            msrpCAD: 74995,
            priceBreakdown: PriceBreakdown(msrpCAD: 74995, advertisedPriceCAD: 71995, dealerDiscountCAD: 3000, mandatoryFeesCAD: 995, incentiveAmountCAD: 0),
            sourceURL: "https://example.com/kia/ev9-markham",
            sourceType: .dealer,
            confidence: .medium,
            firstSeenAt: .now.addingTimeInterval(-48 * 86_400),
            lastSeenAt: .now.addingTimeInterval(-1 * 86_400),
            notes: ["High-dollar 2025 stock with demo mileage; pressure against other three-row alternatives."]
        ),
        InventoryListing(
            id: "inventory-kia-sportage-phev-dixie-2025-a",
            canonicalVehicleID: "kia-sportage-phev-ex-premium-2025",
            stockNumber: "KIA-SP-PHEV-2025-A",
            make: "Kia",
            model: "Sportage PHEV",
            trim: "EX Premium AWD",
            year: 2025,
            powertrain: .phev,
            dealerID: "dealer-401-dixie-kia",
            dealerName: "401 Dixie Kia",
            city: "Mississauga",
            province: "Ontario",
            distanceFromConfiguredPostalCodeKm: 25,
            status: "In Transit",
            advertisedPriceCAD: 45495,
            msrpCAD: 45995,
            priceBreakdown: PriceBreakdown(msrpCAD: 45995, advertisedPriceCAD: 45495, dealerDiscountCAD: 500, mandatoryFeesCAD: 699, incentiveAmountCAD: 2500),
            sourceURL: "https://example.com/kia/sportage-phev-dixie",
            sourceType: .dealer,
            confidence: .medium,
            firstSeenAt: .now.addingTimeInterval(-18 * 86_400),
            lastSeenAt: .now.addingTimeInterval(-3 * 86_400),
            incentiveProgramIDs: ["incentive-evap-federal"],
            notes: ["PHEV alternative; use only if BEV pricing does not move enough."]
        )
    ]

    public static let financeOffers: [FinanceOffer] = [
        FinanceOffer(
            id: "finance-kia-ev9-markham-offer",
            listingID: "inventory-kia-ev9-markham-2025-a",
            sourceName: "Kia Markham dealer offer",
            aprPercent: 4.99,
            termMonths: 60,
            monthlyPaymentCAD: nil,
            downPaymentCAD: nil,
            mandatoryFeesCAD: 995,
            expiresAt: .now.addingTimeInterval(20 * 86_400),
            sourceURL: "https://example.com/kia/ev9-markham",
            notes: ["Dealer-offer placeholder; replace with imported quote before relying on payments."]
        )
    ]

    public static let researchBatches: [ResearchBatch] = [
        ResearchBatch(
            id: "research-seed-chatgpt-gta",
            provider: .chatGPTDeepResearch,
            prompt: "Seed batch for Hyundai/Kia GTA leverage dashboard; regenerate from Research Prompt view before live shopping.",
            importedFileName: "seed-hyundai-kia-gta.csv",
            sourceCount: 4,
            acceptedRows: 4,
            rejectedRows: 0,
            reviewQueueRecords: 1
        )
    ]
}
