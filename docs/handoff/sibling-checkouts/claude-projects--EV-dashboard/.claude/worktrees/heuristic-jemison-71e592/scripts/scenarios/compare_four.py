"""compare_four — user added 4 vehicles + opened compare view.

Driven externally (Chrome-MCP or Ian clicks). This scenario verifies the
debug log captured the interaction:
  - at least 4 compareIds state changes
  - a compare_view_open ui event
"""

from _helpers import error_events, has_any, store_changes_for_key

DESCRIPTION = "User added 4 vehicles to compare and opened compare view."


def assert_trace(events):
    results = []
    compare_changes = store_changes_for_key(events, "compareIds")
    results.append(
        (len(compare_changes) >= 4, f"≥4 compareIds state changes (found {len(compare_changes)})")
    )
    results.append(
        (
            has_any(events, source="ui", event="compare_view_open"),
            "compare_view_open ui event fired",
        )
    )
    results.append((len(error_events(events)) == 0, "no error events"))
    return results
