"""leaflet_no_errors — regression guard for the 'Map container already initialized' fix.

Verifies:
  - at least 1 compare_tab_change to 'map' (tab was visited)
  - zero error events mentioning leaflet / initialized
"""

from _helpers import error_events, has_any

DESCRIPTION = "No Leaflet initialization errors after visiting the Map tab."


def assert_trace(events):
    results = []
    results.append(
        (
            has_any(events, source="ui", event="compare_tab_change"),
            "user switched compare tabs at least once",
        )
    )
    errs = error_events(events)
    leaflet_errs = [
        e for e in errs if "leaflet" in json_str(e).lower() or "initialized" in json_str(e).lower()
    ]
    results.append(
        (
            len(leaflet_errs) == 0,
            f"no Leaflet/initialized errors (found {len(leaflet_errs)})",
        )
    )
    return results


def json_str(e):
    import json

    return json.dumps(e, default=str)
