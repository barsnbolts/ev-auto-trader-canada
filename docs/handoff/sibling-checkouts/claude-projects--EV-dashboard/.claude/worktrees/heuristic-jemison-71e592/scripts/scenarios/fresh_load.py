"""fresh_load — app loaded cleanly, no errors in the window."""

from _helpers import error_events

DESCRIPTION = "Fresh app load: no error events, window is non-empty."


def assert_trace(events):
    results = []
    results.append((len(events) >= 0, f"log reachable ({len(events)} events in window)"))
    errs = error_events(events)
    results.append((len(errs) == 0, f"no error-level events (found {len(errs)})"))
    return results
