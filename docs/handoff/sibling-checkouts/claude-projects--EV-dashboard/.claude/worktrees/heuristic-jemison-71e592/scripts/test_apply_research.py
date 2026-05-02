#!/usr/bin/env python3
"""Unit tests for apply_research.validate_result()."""

from __future__ import annotations

import unittest

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from apply_research import validate_result, REQUIRED_VEHICLE_FIELDS  # noqa: E402


def _full_valid() -> dict:
    return {
        "vehicle": {k: "x" for k in REQUIRED_VEHICLE_FIELDS},
        "cited_fields": {
            k: {"value": 1, "confidence": "Medium"}
            for k in [
                "battery_kwh_total", "battery_kwh_usable", "range_km",
                "ac_charge_kw_max", "dc_charge_kw_max", "cargo_l_seats_up",
                "tow_rating_kg", "weight_kg", "has_heat_pump", "msrp_cad",
                "federal_izev_cad", "provincial_rebate_cad_on",
            ]
        },
        "thermal_arrays": {
            "cold_derate_curve": [], "hvac_draw_kw_by_temp": [], "hp_min_temp_c": -10,
            "precon_time_by_temp": [], "precon_thermal_gain": 0.85,
            "dc_cold_soak_curve": [], "charging_curve_20c": [],
        },
        "overall_confidence": "Medium",
    }


class T(unittest.TestCase):
    def test_full_valid(self):
        self.assertEqual(validate_result(_full_valid()), [])

    def test_missing_vehicle_field(self):
        r = _full_valid()
        del r["vehicle"]["model"]
        errs = validate_result(r)
        self.assertTrue(any("model" in e for e in errs))

    def test_missing_cited_field(self):
        r = _full_valid()
        del r["cited_fields"]["range_km"]
        errs = validate_result(r)
        self.assertTrue(any("range_km" in e for e in errs))

    def test_invalid_confidence_string(self):
        r = _full_valid()
        r["cited_fields"]["range_km"]["confidence"] = "kinda-sure"
        errs = validate_result(r)
        self.assertTrue(any("confidence" in e for e in errs))

    def test_missing_thermal_array(self):
        r = _full_valid()
        del r["thermal_arrays"]["charging_curve_20c"]
        errs = validate_result(r)
        self.assertTrue(any("charging_curve_20c" in e for e in errs))

    def test_missing_overall_confidence(self):
        r = _full_valid()
        del r["overall_confidence"]
        errs = validate_result(r)
        self.assertTrue(any("overall_confidence" in e for e in errs))


if __name__ == "__main__":
    unittest.main()
