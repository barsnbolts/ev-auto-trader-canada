"""plain_mode_persists — toggling Plain/Geek was captured in the store."""

from _helpers import error_events, store_changes_for_key

DESCRIPTION = "Plain/Geek toggle mutated plainMode at least once."


def assert_trace(events):
    results = []
    pm = store_changes_for_key(events, "plainMode")
    results.append((len(pm) >= 1, f"≥1 plainMode state change (found {len(pm)})"))
    results.append((len(error_events(events)) == 0, "no error events"))
    return results
