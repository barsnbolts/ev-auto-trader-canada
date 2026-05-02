"""slider_updates_rings — moving the temp slider triggers a rings_update.

Verifies:
  - at least 1 temp_c state change in the window
  - at least 1 rings_update ui event (implies MapPanel re-ran thermal)
  - no errors
"""

from _helpers import error_events, has_any, store_changes_for_key

DESCRIPTION = "Moving the temp slider caused a rings_update."


def assert_trace(events):
    results = []
    temp_changes = store_changes_for_key(events, "temp_c")
    results.append((len(temp_changes) >= 1, f"≥1 temp_c change (found {len(temp_changes)})"))
    results.append(
        (has_any(events, source="ui", event="rings_update"), "rings_update ui event fired")
    )
    results.append((len(error_events(events)) == 0, "no error events"))
    return results
