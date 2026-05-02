import AppModels
import Foundation
import SeedData
import SQLite3
import Support

public actor AppDatabase {
    nonisolated(unsafe) private let db: OpaquePointer?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init(url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)

        var handle: OpaquePointer?
        if sqlite3_open(url.path, &handle) != SQLITE_OK {
            defer { sqlite3_close(handle) }
            throw DatabaseError.openFailed(message: String(cString: sqlite3_errmsg(handle)))
        }

        self.db = handle
        encoder.dateEncodingStrategy = .secondsSince1970
        decoder.dateDecodingStrategy = .secondsSince1970

        try Self.execute(on: handle, "PRAGMA foreign_keys = ON;")
        try Self.migrateIfNeeded(on: handle)
    }

    deinit {
        sqlite3_close(db)
    }

    public static func live() throws -> AppDatabase {
        try AppDatabase(url: try AppPaths.databaseURL())
    }

    public func bootstrapIfNeeded() throws {
        if try fetchScalarCount(table: "canonical_vehicles") == 0 {
            try upsertCanonicalVehicles(SampleData.canonicalVehicles + SampleData.dealLeverageCanonicalVehicles)
        }

        if try fetchScalarCount(table: "listings") == 0 {
            try replaceListings(for: "seed", with: SampleData.listings)
        }

        if try fetchScalarCount(table: "source_runs") == 0 {
            try replaceSourceRuns(SampleData.sourceRuns)
        }

        if try fetchScalarCount(table: "review_queue") == 0 {
            try replaceReviewQueue(SampleData.reviewQueueItems)
        }

        if try fetchScalarCount(table: "saved_searches") == 0 {
            try replaceSavedSearches(SampleData.savedSearches)
        }

        if try fetchScalarCount(table: "compare_sets") == 0 {
            try replaceCompareSets(SampleData.compareSets)
        }

        if try fetchScalarCount(table: "dealer_profiles") == 0 {
            try replaceDealerProfiles(SampleData.dealerProfiles)
        }

        if try fetchScalarCount(table: "inventory_listings") == 0 {
            try replaceInventoryListings(SampleData.inventoryListings)
        }

        if try fetchScalarCount(table: "incentive_programs") == 0 {
            try replaceIncentivePrograms(SampleData.incentivePrograms)
        }

        if try fetchScalarCount(table: "finance_offers") == 0 {
            try replaceFinanceOffers(SampleData.financeOffers)
        }

        if try fetchScalarCount(table: "research_batches") == 0 {
            try replaceResearchBatches(SampleData.researchBatches)
        }
    }

    public func fetchCanonicalVehicles() throws -> [CanonicalVehicle] {
        let sql = """
        SELECT id, make, model, trim, year, powertrain, msrp_cad, battery_kwh, range_city_km,
               range_highway_km, range_combined_km, max_charge_rate_kw, level1_hours, level2_hours,
               fast_charge_minutes_10_80, default_province, confidence, provenance_json, notes_json, is_coming_soon
        FROM canonical_vehicles
        ORDER BY make, model, year DESC, trim;
        """

        return try query(sql) { statement in
            CanonicalVehicle(
                id: statement.text(at: 0),
                make: statement.text(at: 1),
                model: statement.text(at: 2),
                trim: statement.text(at: 3),
                year: Int(statement.int64(at: 4)),
                powertrain: PowertrainType(rawValue: statement.text(at: 5)) ?? .bev,
                msrpCAD: statement.double(at: 6),
                batteryCapacityKWh: statement.optionalDouble(at: 7),
                rangeCityKm: Int(statement.int64(at: 8)),
                rangeHighwayKm: Int(statement.int64(at: 9)),
                rangeCombinedKm: Int(statement.int64(at: 10)),
                maxChargeRateKW: statement.optionalDouble(at: 11),
                level1Hours: statement.optionalDouble(at: 12),
                level2Hours: statement.optionalDouble(at: 13),
                fastChargeMinutesTenToEighty: statement.optionalInt(at: 14),
                defaultProvince: statement.text(at: 15),
                confidence: ConfidenceLevel(rawValue: statement.text(at: 16)) ?? .medium,
                provenance: try decodeJSON(statement.text(at: 17), as: [ProvenanceRecord].self),
                notes: try decodeJSON(statement.text(at: 18), as: [String].self),
                isComingSoon: statement.int64(at: 19) == 1
            )
        }
    }

    public func fetchListings(for canonicalVehicleID: String? = nil) throws -> [Listing] {
        if let canonicalVehicleID {
            let sql = """
            SELECT id, canonical_vehicle_id, source_id, dealer_name, city, province, location_label,
                   price_cad, mileage_km, condition, source_url, confidence, updated_at, listing_notes_json
            FROM listings
            WHERE canonical_vehicle_id = ?
            ORDER BY condition, price_cad ASC;
            """

            return try query(sql, bindings: [.text(canonicalVehicleID)]) { statement in
                try listing(from: statement)
            }
        }

        let sql = """
        SELECT id, canonical_vehicle_id, source_id, dealer_name, city, province, location_label,
               price_cad, mileage_km, condition, source_url, confidence, updated_at, listing_notes_json
        FROM listings
        ORDER BY updated_at DESC;
        """

        return try query(sql) { statement in
            try listing(from: statement)
        }
    }

    public func fetchDealerProfiles() throws -> [DealerProfile] {
        let sql = """
        SELECT id, name, brand, city, province, website_url, distance_km
        FROM dealer_profiles
        ORDER BY brand, city, name;
        """

        return try query(sql) { statement in
            DealerProfile(
                id: statement.text(at: 0),
                name: statement.text(at: 1),
                brand: statement.text(at: 2),
                city: statement.text(at: 3),
                province: statement.text(at: 4),
                websiteURL: statement.optionalText(at: 5),
                distanceFromConfiguredPostalCodeKm: statement.optionalDouble(at: 6)
            )
        }
    }

    public func fetchInventoryListings() throws -> [InventoryListing] {
        let sql = """
        SELECT id, canonical_vehicle_id, vin, stock_number, make, model, trim, year, powertrain,
               dealer_id, dealer_name, city, province, distance_km, condition, odometer_km, status,
               advertised_price_cad, msrp_cad, price_breakdown_json, source_url, source_type,
               confidence, first_seen_at, last_seen_at, incentive_program_ids_json,
               finance_offer_ids_json, notes_json
        FROM inventory_listings
        ORDER BY last_seen_at DESC, advertised_price_cad ASC;
        """

        return try query(sql) { statement in
            InventoryListing(
                id: statement.text(at: 0),
                canonicalVehicleID: statement.text(at: 1),
                vin: statement.optionalText(at: 2),
                stockNumber: statement.optionalText(at: 3),
                make: statement.text(at: 4),
                model: statement.text(at: 5),
                trim: statement.text(at: 6),
                year: Int(statement.int64(at: 7)),
                powertrain: PowertrainType(rawValue: statement.text(at: 8)) ?? .bev,
                dealerID: statement.optionalText(at: 9),
                dealerName: statement.text(at: 10),
                city: statement.text(at: 11),
                province: statement.text(at: 12),
                distanceFromConfiguredPostalCodeKm: statement.optionalDouble(at: 13),
                condition: ListingCondition(rawValue: statement.text(at: 14)) ?? .new,
                odometerKm: statement.optionalInt(at: 15),
                status: statement.text(at: 16),
                advertisedPriceCAD: statement.double(at: 17),
                msrpCAD: statement.double(at: 18),
                priceBreakdown: try decodeJSON(statement.text(at: 19), as: PriceBreakdown.self),
                sourceURL: statement.text(at: 20),
                sourceType: ResearchSourceType(rawValue: statement.text(at: 21)) ?? .manual,
                confidence: ConfidenceLevel(rawValue: statement.text(at: 22)) ?? .medium,
                firstSeenAt: Date(timeIntervalSince1970: statement.double(at: 23)),
                lastSeenAt: Date(timeIntervalSince1970: statement.double(at: 24)),
                incentiveProgramIDs: try decodeJSON(statement.text(at: 25), as: [String].self),
                financeOfferIDs: try decodeJSON(statement.text(at: 26), as: [String].self),
                notes: try decodeJSON(statement.text(at: 27), as: [String].self)
            )
        }
    }

    public func fetchIncentivePrograms() throws -> [IncentiveProgram] {
        let sql = """
        SELECT id, name, kind, jurisdiction, applicable_makes_json, applicable_models_json,
               max_amount_cad, eligibility_notes, source_url, last_verified_at
        FROM incentive_programs
        ORDER BY jurisdiction, name;
        """

        return try query(sql) { statement in
            IncentiveProgram(
                id: statement.text(at: 0),
                name: statement.text(at: 1),
                kind: statement.text(at: 2),
                jurisdiction: statement.text(at: 3),
                applicableMakes: try decodeJSON(statement.text(at: 4), as: [String].self),
                applicableModels: try decodeJSON(statement.text(at: 5), as: [String].self),
                maxAmountCAD: statement.double(at: 6),
                eligibilityNotes: statement.text(at: 7),
                sourceURL: statement.text(at: 8),
                lastVerifiedAt: Date(timeIntervalSince1970: statement.double(at: 9))
            )
        }
    }

    public func fetchFinanceOffers() throws -> [FinanceOffer] {
        let sql = """
        SELECT id, listing_id, source_name, apr_percent, term_months, monthly_payment_cad,
               down_payment_cad, mandatory_fees_cad, expires_at, source_url, notes_json
        FROM finance_offers
        ORDER BY expires_at IS NULL, expires_at ASC;
        """

        return try query(sql) { statement in
            FinanceOffer(
                id: statement.text(at: 0),
                listingID: statement.optionalText(at: 1),
                sourceName: statement.text(at: 2),
                aprPercent: statement.double(at: 3),
                termMonths: Int(statement.int64(at: 4)),
                monthlyPaymentCAD: statement.optionalDouble(at: 5),
                downPaymentCAD: statement.optionalDouble(at: 6),
                mandatoryFeesCAD: statement.double(at: 7),
                expiresAt: statement.optionalDouble(at: 8).map(Date.init(timeIntervalSince1970:)),
                sourceURL: statement.text(at: 9),
                notes: try decodeJSON(statement.text(at: 10), as: [String].self)
            )
        }
    }

    public func fetchResearchBatches() throws -> [ResearchBatch] {
        let sql = """
        SELECT id, provider, prompt, imported_file_name, source_count, accepted_rows,
               rejected_rows, review_queue_records, created_at
        FROM research_batches
        ORDER BY created_at DESC;
        """

        return try query(sql) { statement in
            ResearchBatch(
                id: statement.text(at: 0),
                provider: ResearchProvider(rawValue: statement.text(at: 1)) ?? .manual,
                prompt: statement.text(at: 2),
                importedFileName: statement.optionalText(at: 3),
                sourceCount: Int(statement.int64(at: 4)),
                acceptedRows: Int(statement.int64(at: 5)),
                rejectedRows: Int(statement.int64(at: 6)),
                reviewQueueRecords: Int(statement.int64(at: 7)),
                createdAt: Date(timeIntervalSince1970: statement.double(at: 8))
            )
        }
    }

    public func fetchSourceRuns() throws -> [SourceRun] {
        let sql = """
        SELECT id, source_id, display_name, started_at, completed_at, status, fetched_records,
               published_records, review_records, error_message
        FROM source_runs
        ORDER BY started_at DESC;
        """

        return try query(sql) { statement in
            SourceRun(
                id: statement.text(at: 0),
                sourceID: statement.text(at: 1),
                displayName: statement.text(at: 2),
                startedAt: Date(timeIntervalSince1970: statement.double(at: 3)),
                completedAt: statement.optionalDouble(at: 4).map(Date.init(timeIntervalSince1970:)),
                status: statement.text(at: 5),
                fetchedRecords: Int(statement.int64(at: 6)),
                publishedRecords: Int(statement.int64(at: 7)),
                reviewRecords: Int(statement.int64(at: 8)),
                errorMessage: statement.optionalText(at: 9)
            )
        }
    }

    public func fetchReviewQueue() throws -> [ReviewQueueItem] {
        let sql = """
        SELECT id, source_run_id, reason, severity, raw_identifier, raw_payload, created_at
        FROM review_queue
        ORDER BY created_at DESC;
        """

        return try query(sql) { statement in
            ReviewQueueItem(
                id: statement.text(at: 0),
                sourceRunID: statement.text(at: 1),
                reason: statement.text(at: 2),
                severity: ConfidenceLevel(rawValue: statement.text(at: 3)) ?? .medium,
                rawIdentifier: statement.text(at: 4),
                rawPayload: statement.text(at: 5),
                createdAt: Date(timeIntervalSince1970: statement.double(at: 6))
            )
        }
    }

    public func fetchSavedSearches() throws -> [SavedSearch] {
        let sql = """
        SELECT id, name, query, radius_mode, province, powertrains_json, notifications_enabled, created_at
        FROM saved_searches
        ORDER BY created_at DESC;
        """

        return try query(sql) { statement in
            SavedSearch(
                id: statement.text(at: 0),
                name: statement.text(at: 1),
                query: statement.text(at: 2),
                radiusMode: RadiusMode(rawValue: statement.text(at: 3)) ?? .hundredKm,
                province: statement.text(at: 4),
                powertrains: try decodeJSON(statement.text(at: 5), as: [PowertrainType].self),
                notificationsEnabled: statement.int64(at: 6) == 1,
                createdAt: Date(timeIntervalSince1970: statement.double(at: 7))
            )
        }
    }

    public func fetchCompareSets() throws -> [CompareSet] {
        let setSQL = """
        SELECT id, name, created_at
        FROM compare_sets
        ORDER BY created_at DESC;
        """

        let sets: [(String, String, Date)] = try query(setSQL) { statement in
            (statement.text(at: 0), statement.text(at: 1), Date(timeIntervalSince1970: statement.double(at: 2)))
        }

        var compareSets: [CompareSet] = []
        for (id, name, createdAt) in sets {
            let items = try query(
                "SELECT vehicle_id FROM compare_set_items WHERE compare_set_id = ? ORDER BY rowid ASC;",
                bindings: [.text(id)]
            ) { statement in
                statement.text(at: 0)
            }
            compareSets.append(CompareSet(id: id, name: name, vehicleIDs: items, createdAt: createdAt))
        }
        return compareSets
    }

    public func upsertCanonicalVehicles(_ vehicles: [CanonicalVehicle]) throws {
        let sql = """
        INSERT INTO canonical_vehicles (
          id, make, model, trim, year, powertrain, msrp_cad, battery_kwh, range_city_km,
          range_highway_km, range_combined_km, max_charge_rate_kw, level1_hours, level2_hours,
          fast_charge_minutes_10_80, default_province, confidence, provenance_json, notes_json, is_coming_soon
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          make = excluded.make,
          model = excluded.model,
          trim = excluded.trim,
          year = excluded.year,
          powertrain = excluded.powertrain,
          msrp_cad = excluded.msrp_cad,
          battery_kwh = excluded.battery_kwh,
          range_city_km = excluded.range_city_km,
          range_highway_km = excluded.range_highway_km,
          range_combined_km = excluded.range_combined_km,
          max_charge_rate_kw = excluded.max_charge_rate_kw,
          level1_hours = excluded.level1_hours,
          level2_hours = excluded.level2_hours,
          fast_charge_minutes_10_80 = excluded.fast_charge_minutes_10_80,
          default_province = excluded.default_province,
          confidence = excluded.confidence,
          provenance_json = excluded.provenance_json,
          notes_json = excluded.notes_json,
          is_coming_soon = excluded.is_coming_soon;
        """

        try execute("BEGIN IMMEDIATE TRANSACTION;")
        do {
            for vehicle in vehicles {
                try execute(
                    sql,
                    bindings: [
                        .text(vehicle.id),
                        .text(vehicle.make),
                        .text(vehicle.model),
                        .text(vehicle.trim),
                        .int64(Int64(vehicle.year)),
                        .text(vehicle.powertrain.rawValue),
                        .double(vehicle.msrpCAD),
                        .optionalDouble(vehicle.batteryCapacityKWh),
                        .int64(Int64(vehicle.rangeCityKm)),
                        .int64(Int64(vehicle.rangeHighwayKm)),
                        .int64(Int64(vehicle.rangeCombinedKm)),
                        .optionalDouble(vehicle.maxChargeRateKW),
                        .optionalDouble(vehicle.level1Hours),
                        .optionalDouble(vehicle.level2Hours),
                        .optionalInt(vehicle.fastChargeMinutesTenToEighty),
                        .text(vehicle.defaultProvince),
                        .text(vehicle.confidence.rawValue),
                        .text(try encodeJSON(vehicle.provenance)),
                        .text(try encodeJSON(vehicle.notes)),
                        .int64(vehicle.isComingSoon ? 1 : 0)
                    ]
                )
            }
            try execute("COMMIT;")
        } catch {
            try? execute("ROLLBACK;")
            throw error
        }
    }

    public func replaceListings(for sourceID: String, with listings: [Listing]) throws {
        try execute("DELETE FROM listings WHERE source_id = ? OR source_id = 'seed';", bindings: [.text(sourceID)])

        let sql = """
        INSERT INTO listings (
          id, canonical_vehicle_id, source_id, dealer_name, city, province, location_label,
          price_cad, mileage_km, condition, source_url, confidence, updated_at, listing_notes_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """

        for listing in listings {
            try execute(
                sql,
                bindings: [
                    .text(listing.id),
                    .text(listing.canonicalVehicleID),
                    .text(listing.sourceID),
                    .text(listing.dealerName),
                    .text(listing.city),
                    .text(listing.province),
                    .text(listing.locationLabel),
                    .double(listing.priceCAD),
                    .optionalInt(listing.mileageKm),
                    .text(listing.condition.rawValue),
                    .text(listing.sourceURL),
                    .text(listing.confidence.rawValue),
                    .double(listing.updatedAt.timeIntervalSince1970),
                    .text(try encodeJSON(listing.notes))
                ]
            )
        }
    }

    public func replaceSourceRuns(_ runs: [SourceRun]) throws {
        try execute("DELETE FROM source_runs;")
        let sql = """
        INSERT INTO source_runs (
          id, source_id, display_name, started_at, completed_at, status,
          fetched_records, published_records, review_records, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """

        for run in runs {
            try execute(
                sql,
                bindings: [
                    .text(run.id),
                    .text(run.sourceID),
                    .text(run.displayName),
                    .double(run.startedAt.timeIntervalSince1970),
                    .optionalDouble(run.completedAt?.timeIntervalSince1970),
                    .text(run.status),
                    .int64(Int64(run.fetchedRecords)),
                    .int64(Int64(run.publishedRecords)),
                    .int64(Int64(run.reviewRecords)),
                    .optionalText(run.errorMessage)
                ]
            )
        }
    }

    public func replaceReviewQueue(_ items: [ReviewQueueItem]) throws {
        try execute("DELETE FROM review_queue;")
        let sql = """
        INSERT INTO review_queue (
          id, source_run_id, reason, severity, raw_identifier, raw_payload, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?);
        """

        for item in items {
            try execute(
                sql,
                bindings: [
                    .text(item.id),
                    .text(item.sourceRunID),
                    .text(item.reason),
                    .text(item.severity.rawValue),
                    .text(item.rawIdentifier),
                    .text(item.rawPayload),
                    .double(item.createdAt.timeIntervalSince1970)
                ]
            )
        }
    }

    public func replaceSavedSearches(_ searches: [SavedSearch]) throws {
        try execute("DELETE FROM saved_searches;")
        let sql = """
        INSERT INTO saved_searches (
          id, name, query, radius_mode, province, powertrains_json, notifications_enabled, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """

        for search in searches {
            try execute(
                sql,
                bindings: [
                    .text(search.id),
                    .text(search.name),
                    .text(search.query),
                    .text(search.radiusMode.rawValue),
                    .text(search.province),
                    .text(try encodeJSON(search.powertrains)),
                    .int64(search.notificationsEnabled ? 1 : 0),
                    .double(search.createdAt.timeIntervalSince1970)
                ]
            )
        }
    }

    public func replaceCompareSets(_ sets: [CompareSet]) throws {
        try execute("DELETE FROM compare_set_items;")
        try execute("DELETE FROM compare_sets;")
        let setSQL = "INSERT INTO compare_sets (id, name, created_at) VALUES (?, ?, ?);"
        let itemSQL = "INSERT INTO compare_set_items (compare_set_id, vehicle_id) VALUES (?, ?);"

        for set in sets {
            try execute(
                setSQL,
                bindings: [
                    .text(set.id),
                    .text(set.name),
                    .double(set.createdAt.timeIntervalSince1970)
                ]
            )

            for vehicleID in set.vehicleIDs {
                try execute(itemSQL, bindings: [.text(set.id), .text(vehicleID)])
            }
        }
    }

    public func replaceDealerProfiles(_ dealers: [DealerProfile]) throws {
        try execute("DELETE FROM dealer_profiles;")
        let sql = """
        INSERT INTO dealer_profiles (id, name, brand, city, province, website_url, distance_km)
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """

        for dealer in dealers {
            try execute(
                sql,
                bindings: [
                    .text(dealer.id),
                    .text(dealer.name),
                    .text(dealer.brand),
                    .text(dealer.city),
                    .text(dealer.province),
                    .optionalText(dealer.websiteURL),
                    .optionalDouble(dealer.distanceFromConfiguredPostalCodeKm)
                ]
            )
        }
    }

    public func replaceInventoryListings(_ listings: [InventoryListing]) throws {
        try execute("DELETE FROM inventory_listings;")
        let sql = """
        INSERT INTO inventory_listings (
          id, canonical_vehicle_id, vin, stock_number, make, model, trim, year, powertrain,
          dealer_id, dealer_name, city, province, distance_km, condition, odometer_km, status,
          advertised_price_cad, msrp_cad, price_breakdown_json, source_url, source_type,
          confidence, first_seen_at, last_seen_at, incentive_program_ids_json,
          finance_offer_ids_json, notes_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """

        for listing in listings {
            try execute(
                sql,
                bindings: [
                    .text(listing.id),
                    .text(listing.canonicalVehicleID),
                    .optionalText(listing.vin),
                    .optionalText(listing.stockNumber),
                    .text(listing.make),
                    .text(listing.model),
                    .text(listing.trim),
                    .int64(Int64(listing.year)),
                    .text(listing.powertrain.rawValue),
                    .optionalText(listing.dealerID),
                    .text(listing.dealerName),
                    .text(listing.city),
                    .text(listing.province),
                    .optionalDouble(listing.distanceFromConfiguredPostalCodeKm),
                    .text(listing.condition.rawValue),
                    .optionalInt(listing.odometerKm),
                    .text(listing.status),
                    .double(listing.advertisedPriceCAD),
                    .double(listing.msrpCAD),
                    .text(try encodeJSON(listing.priceBreakdown)),
                    .text(listing.sourceURL),
                    .text(listing.sourceType.rawValue),
                    .text(listing.confidence.rawValue),
                    .double(listing.firstSeenAt.timeIntervalSince1970),
                    .double(listing.lastSeenAt.timeIntervalSince1970),
                    .text(try encodeJSON(listing.incentiveProgramIDs)),
                    .text(try encodeJSON(listing.financeOfferIDs)),
                    .text(try encodeJSON(listing.notes))
                ]
            )
        }
    }

    public func replaceIncentivePrograms(_ programs: [IncentiveProgram]) throws {
        try execute("DELETE FROM incentive_programs;")
        let sql = """
        INSERT INTO incentive_programs (
          id, name, kind, jurisdiction, applicable_makes_json, applicable_models_json,
          max_amount_cad, eligibility_notes, source_url, last_verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """

        for program in programs {
            try execute(
                sql,
                bindings: [
                    .text(program.id),
                    .text(program.name),
                    .text(program.kind),
                    .text(program.jurisdiction),
                    .text(try encodeJSON(program.applicableMakes)),
                    .text(try encodeJSON(program.applicableModels)),
                    .double(program.maxAmountCAD),
                    .text(program.eligibilityNotes),
                    .text(program.sourceURL),
                    .double(program.lastVerifiedAt.timeIntervalSince1970)
                ]
            )
        }
    }

    public func replaceFinanceOffers(_ offers: [FinanceOffer]) throws {
        try execute("DELETE FROM finance_offers;")
        let sql = """
        INSERT INTO finance_offers (
          id, listing_id, source_name, apr_percent, term_months, monthly_payment_cad,
          down_payment_cad, mandatory_fees_cad, expires_at, source_url, notes_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """

        for offer in offers {
            try execute(
                sql,
                bindings: [
                    .text(offer.id),
                    .optionalText(offer.listingID),
                    .text(offer.sourceName),
                    .double(offer.aprPercent),
                    .int64(Int64(offer.termMonths)),
                    .optionalDouble(offer.monthlyPaymentCAD),
                    .optionalDouble(offer.downPaymentCAD),
                    .double(offer.mandatoryFeesCAD),
                    .optionalDouble(offer.expiresAt?.timeIntervalSince1970),
                    .text(offer.sourceURL),
                    .text(try encodeJSON(offer.notes))
                ]
            )
        }
    }

    public func replaceResearchBatches(_ batches: [ResearchBatch]) throws {
        try execute("DELETE FROM research_batches;")
        let sql = """
        INSERT INTO research_batches (
          id, provider, prompt, imported_file_name, source_count, accepted_rows,
          rejected_rows, review_queue_records, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """

        for batch in batches {
            try execute(
                sql,
                bindings: [
                    .text(batch.id),
                    .text(batch.provider.rawValue),
                    .text(batch.prompt),
                    .optionalText(batch.importedFileName),
                    .int64(Int64(batch.sourceCount)),
                    .int64(Int64(batch.acceptedRows)),
                    .int64(Int64(batch.rejectedRows)),
                    .int64(Int64(batch.reviewQueueRecords)),
                    .double(batch.createdAt.timeIntervalSince1970)
                ]
            )
        }
    }

    public func upsertPreference(key: String, value: String) throws {
        try execute(
            """
            INSERT INTO app_preferences (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
            """,
            bindings: [.text(key), .text(value)]
        )
    }

    public func fetchPreference(key: String) throws -> String? {
        try query(
            "SELECT value FROM app_preferences WHERE key = ?;",
            bindings: [.text(key)]
        ) { statement in
            statement.text(at: 0)
        }.first
    }

    private func listing(from statement: SQLiteStatement) throws -> Listing {
        Listing(
            id: statement.text(at: 0),
            canonicalVehicleID: statement.text(at: 1),
            sourceID: statement.text(at: 2),
            dealerName: statement.text(at: 3),
            city: statement.text(at: 4),
            province: statement.text(at: 5),
            locationLabel: statement.text(at: 6),
            priceCAD: statement.double(at: 7),
            mileageKm: statement.optionalInt(at: 8),
            condition: ListingCondition(rawValue: statement.text(at: 9)) ?? .new,
            sourceURL: statement.text(at: 10),
            confidence: ConfidenceLevel(rawValue: statement.text(at: 11)) ?? .medium,
            updatedAt: Date(timeIntervalSince1970: statement.double(at: 12)),
            notes: try decodeJSON(statement.text(at: 13), as: [String].self)
        )
    }

    private func fetchScalarCount(table: String) throws -> Int {
        Int(try scalarInt("SELECT COUNT(*) FROM \(table);"))
    }

    private func scalarInt(_ sql: String) throws -> Int64 {
        try query(sql) { statement in
            statement.int64(at: 0)
        }.first ?? 0
    }

    private func encodeJSON<T: Encodable>(_ value: T) throws -> String {
        let data = try encoder.encode(value)
        return String(decoding: data, as: UTF8.self)
    }

    private func decodeJSON<T: Decodable>(_ string: String, as type: T.Type) throws -> T {
        let data = Data(string.utf8)
        return try decoder.decode(T.self, from: data)
    }

    private func execute(_ sql: String, bindings: [SQLiteValue] = []) throws {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw DatabaseError.prepareFailed(message: errorMessage())
        }
        defer { sqlite3_finalize(statement) }

        try bind(bindings, to: statement)

        let step = sqlite3_step(statement)
        guard step == SQLITE_DONE || step == SQLITE_ROW else {
            throw DatabaseError.stepFailed(message: errorMessage())
        }
    }

    private func query<T>(_ sql: String, bindings: [SQLiteValue] = [], map: (SQLiteStatement) throws -> T) throws -> [T] {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw DatabaseError.prepareFailed(message: errorMessage())
        }
        defer { sqlite3_finalize(statement) }

        try bind(bindings, to: statement)

        var rows: [T] = []
        while true {
            let result = sqlite3_step(statement)
            if result == SQLITE_ROW {
                rows.append(try map(SQLiteStatement(raw: statement)))
            } else if result == SQLITE_DONE {
                return rows
            } else {
                throw DatabaseError.stepFailed(message: errorMessage())
            }
        }
    }

    private func bind(_ values: [SQLiteValue], to statement: OpaquePointer?) throws {
        for (index, value) in values.enumerated() {
            let parameterIndex = Int32(index + 1)
            let code: Int32
            switch value {
            case .text(let string):
                code = sqlite3_bind_text(statement, parameterIndex, string, -1, SQLITE_TRANSIENT)
            case .optionalText(let string):
                if let string {
                    code = sqlite3_bind_text(statement, parameterIndex, string, -1, SQLITE_TRANSIENT)
                } else {
                    code = sqlite3_bind_null(statement, parameterIndex)
                }
            case .double(let double):
                code = sqlite3_bind_double(statement, parameterIndex, double)
            case .optionalDouble(let double):
                if let double {
                    code = sqlite3_bind_double(statement, parameterIndex, double)
                } else {
                    code = sqlite3_bind_null(statement, parameterIndex)
                }
            case .int64(let int):
                code = sqlite3_bind_int64(statement, parameterIndex, int)
            case .optionalInt(let int):
                if let int {
                    code = sqlite3_bind_int64(statement, parameterIndex, Int64(int))
                } else {
                    code = sqlite3_bind_null(statement, parameterIndex)
                }
            }

            guard code == SQLITE_OK else {
                throw DatabaseError.bindFailed(message: errorMessage())
            }
        }
    }

    private func errorMessage() -> String {
        db.map { String(cString: sqlite3_errmsg($0)) } ?? "Unknown SQLite error"
    }
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

private extension AppDatabase {
    static func migrateIfNeeded(on db: OpaquePointer?) throws {
        let currentVersion = Int(sqlite3_libversion_number())
        AppLogger.persistence.debug("SQLite library version: \(currentVersion, privacy: .public)")

        let existingVersion = Int(try scalarInt(on: db, sql: "PRAGMA user_version;"))
        if existingVersion < 1 {
            try createBaseTables(on: db)
            try execute(on: db, "PRAGMA user_version = 1;")
        }

        if existingVersion < 2 {
            try createLeverageTables(on: db)
            try execute(on: db, "PRAGMA user_version = 2;")
        }
    }

    static func createBaseTables(on db: OpaquePointer?) throws {
        try execute(on: db, """
        CREATE TABLE IF NOT EXISTS canonical_vehicles (
          id TEXT PRIMARY KEY,
          make TEXT NOT NULL,
          model TEXT NOT NULL,
          trim TEXT NOT NULL,
          year INTEGER NOT NULL,
          powertrain TEXT NOT NULL,
          msrp_cad REAL NOT NULL,
          battery_kwh REAL,
          range_city_km INTEGER NOT NULL,
          range_highway_km INTEGER NOT NULL,
          range_combined_km INTEGER NOT NULL,
          max_charge_rate_kw REAL,
          level1_hours REAL,
          level2_hours REAL,
          fast_charge_minutes_10_80 INTEGER,
          default_province TEXT NOT NULL,
          confidence TEXT NOT NULL,
          provenance_json TEXT NOT NULL,
          notes_json TEXT NOT NULL,
          is_coming_soon INTEGER NOT NULL DEFAULT 0
        );
        """)

        try execute(on: db, """
        CREATE TABLE IF NOT EXISTS listings (
          id TEXT PRIMARY KEY,
          canonical_vehicle_id TEXT NOT NULL,
          source_id TEXT NOT NULL,
          dealer_name TEXT NOT NULL,
          city TEXT NOT NULL,
          province TEXT NOT NULL,
          location_label TEXT NOT NULL,
          price_cad REAL NOT NULL,
          mileage_km INTEGER,
          condition TEXT NOT NULL,
          source_url TEXT NOT NULL,
          confidence TEXT NOT NULL,
          updated_at REAL NOT NULL,
          listing_notes_json TEXT NOT NULL,
          FOREIGN KEY (canonical_vehicle_id) REFERENCES canonical_vehicles(id)
        );
        """)

        try execute(on: db, """
        CREATE TABLE IF NOT EXISTS source_runs (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          started_at REAL NOT NULL,
          completed_at REAL,
          status TEXT NOT NULL,
          fetched_records INTEGER NOT NULL,
          published_records INTEGER NOT NULL,
          review_records INTEGER NOT NULL,
          error_message TEXT
        );
        """)

        try execute(on: db, """
        CREATE TABLE IF NOT EXISTS saved_searches (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          query TEXT NOT NULL,
          radius_mode TEXT NOT NULL,
          province TEXT NOT NULL,
          powertrains_json TEXT NOT NULL,
          notifications_enabled INTEGER NOT NULL DEFAULT 0,
          created_at REAL NOT NULL
        );
        """)

        try execute(on: db, """
        CREATE TABLE IF NOT EXISTS compare_sets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at REAL NOT NULL
        );
        """)

        try execute(on: db, """
        CREATE TABLE IF NOT EXISTS compare_set_items (
          compare_set_id TEXT NOT NULL,
          vehicle_id TEXT NOT NULL,
          FOREIGN KEY (compare_set_id) REFERENCES compare_sets(id) ON DELETE CASCADE,
          FOREIGN KEY (vehicle_id) REFERENCES canonical_vehicles(id) ON DELETE CASCADE
        );
        """)

        try execute(on: db, """
        CREATE TABLE IF NOT EXISTS review_queue (
          id TEXT PRIMARY KEY,
          source_run_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          severity TEXT NOT NULL,
          raw_identifier TEXT NOT NULL,
          raw_payload TEXT NOT NULL,
          created_at REAL NOT NULL
        );
        """)

        try execute(on: db, """
        CREATE TABLE IF NOT EXISTS app_preferences (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        """)
    }

    static func createLeverageTables(on db: OpaquePointer?) throws {
        try execute(on: db, """
        CREATE TABLE IF NOT EXISTS dealer_profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          brand TEXT NOT NULL,
          city TEXT NOT NULL,
          province TEXT NOT NULL,
          website_url TEXT,
          distance_km REAL
        );
        """)

        try execute(on: db, """
        CREATE TABLE IF NOT EXISTS inventory_listings (
          id TEXT PRIMARY KEY,
          canonical_vehicle_id TEXT NOT NULL,
          vin TEXT,
          stock_number TEXT,
          make TEXT NOT NULL,
          model TEXT NOT NULL,
          trim TEXT NOT NULL,
          year INTEGER NOT NULL,
          powertrain TEXT NOT NULL,
          dealer_id TEXT,
          dealer_name TEXT NOT NULL,
          city TEXT NOT NULL,
          province TEXT NOT NULL,
          distance_km REAL,
          condition TEXT NOT NULL,
          odometer_km INTEGER,
          status TEXT NOT NULL,
          advertised_price_cad REAL NOT NULL,
          msrp_cad REAL NOT NULL,
          price_breakdown_json TEXT NOT NULL,
          source_url TEXT NOT NULL,
          source_type TEXT NOT NULL,
          confidence TEXT NOT NULL,
          first_seen_at REAL NOT NULL,
          last_seen_at REAL NOT NULL,
          incentive_program_ids_json TEXT NOT NULL,
          finance_offer_ids_json TEXT NOT NULL,
          notes_json TEXT NOT NULL,
          FOREIGN KEY (canonical_vehicle_id) REFERENCES canonical_vehicles(id)
        );
        """)

        try execute(on: db, """
        CREATE TABLE IF NOT EXISTS incentive_programs (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          kind TEXT NOT NULL,
          jurisdiction TEXT NOT NULL,
          applicable_makes_json TEXT NOT NULL,
          applicable_models_json TEXT NOT NULL,
          max_amount_cad REAL NOT NULL,
          eligibility_notes TEXT NOT NULL,
          source_url TEXT NOT NULL,
          last_verified_at REAL NOT NULL
        );
        """)

        try execute(on: db, """
        CREATE TABLE IF NOT EXISTS finance_offers (
          id TEXT PRIMARY KEY,
          listing_id TEXT,
          source_name TEXT NOT NULL,
          apr_percent REAL NOT NULL,
          term_months INTEGER NOT NULL,
          monthly_payment_cad REAL,
          down_payment_cad REAL,
          mandatory_fees_cad REAL NOT NULL,
          expires_at REAL,
          source_url TEXT NOT NULL,
          notes_json TEXT NOT NULL
        );
        """)

        try execute(on: db, """
        CREATE TABLE IF NOT EXISTS research_batches (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          prompt TEXT NOT NULL,
          imported_file_name TEXT,
          source_count INTEGER NOT NULL,
          accepted_rows INTEGER NOT NULL,
          rejected_rows INTEGER NOT NULL,
          review_queue_records INTEGER NOT NULL,
          created_at REAL NOT NULL
        );
        """)
    }

    static func scalarInt(on db: OpaquePointer?, sql: String) throws -> Int64 {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw DatabaseError.prepareFailed(message: errorMessage(on: db))
        }
        defer { sqlite3_finalize(statement) }

        guard sqlite3_step(statement) == SQLITE_ROW else {
            throw DatabaseError.stepFailed(message: errorMessage(on: db))
        }
        return sqlite3_column_int64(statement, 0)
    }

    static func execute(on db: OpaquePointer?, _ sql: String) throws {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw DatabaseError.prepareFailed(message: errorMessage(on: db))
        }
        defer { sqlite3_finalize(statement) }

        let step = sqlite3_step(statement)
        guard step == SQLITE_DONE || step == SQLITE_ROW else {
            throw DatabaseError.stepFailed(message: errorMessage(on: db))
        }
    }

    static func errorMessage(on db: OpaquePointer?) -> String {
        db.map { String(cString: sqlite3_errmsg($0)) } ?? "Unknown SQLite error"
    }
}

private enum SQLiteValue {
    case text(String)
    case optionalText(String?)
    case double(Double)
    case optionalDouble(Double?)
    case int64(Int64)
    case optionalInt(Int?)
}

private struct SQLiteStatement {
    let raw: OpaquePointer?

    func text(at index: Int32) -> String {
        guard let cString = sqlite3_column_text(raw, index) else { return "" }
        return String(cString: cString)
    }

    func optionalText(at index: Int32) -> String? {
        guard sqlite3_column_type(raw, index) != SQLITE_NULL else { return nil }
        return text(at: index)
    }

    func double(at index: Int32) -> Double {
        sqlite3_column_double(raw, index)
    }

    func optionalDouble(at index: Int32) -> Double? {
        guard sqlite3_column_type(raw, index) != SQLITE_NULL else { return nil }
        return double(at: index)
    }

    func int64(at index: Int32) -> Int64 {
        sqlite3_column_int64(raw, index)
    }

    func optionalInt(at index: Int32) -> Int? {
        guard sqlite3_column_type(raw, index) != SQLITE_NULL else { return nil }
        return Int(int64(at: index))
    }
}

public enum DatabaseError: Error, LocalizedError {
    case openFailed(message: String)
    case prepareFailed(message: String)
    case bindFailed(message: String)
    case stepFailed(message: String)

    public var errorDescription: String? {
        switch self {
        case .openFailed(let message): "Failed to open database: \(message)"
        case .prepareFailed(let message): "Failed to prepare database statement: \(message)"
        case .bindFailed(let message): "Failed to bind database statement: \(message)"
        case .stepFailed(let message): "Failed to execute database statement: \(message)"
        }
    }
}
