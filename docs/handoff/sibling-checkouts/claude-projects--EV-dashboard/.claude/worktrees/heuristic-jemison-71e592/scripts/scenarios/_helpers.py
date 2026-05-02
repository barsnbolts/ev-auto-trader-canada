"""Shared helpers for drive_app.py scenarios.

A scenario module exposes:
  DESCRIPTION: str
  def assert_trace(events: list[dict]) -> list[tuple[bool, str]]:

Each tuple is (passed, message). drive_app.py aggregates, writes a report,
and exits 0/1 based on whether all passed.
"""

from __future__ import annotations


def count(events: list[dict], *, source: str, event: str) -> int:
    return sum(1 for e in events if e.get("source") == source and e.get("event") == event)


def has_any(events: list[dict], *, source: str, event: str) -> bool:
    return count(events, source=source, event=event) > 0


def error_events(events: list[dict]) -> list[dict]:
    return [e for e in events if e.get("level") == "error"]


def store_changes_for_key(events: list[dict], key: str) -> list[dict]:
    """Return all store state_change events that mutated `key`."""
    out = []
    for e in events:
        if e.get("source") != "store" or e.get("event") != "state_change":
            continue
        payload = e.get("payload") or {}
        if isinstance(payload, dict) and key in payload:
            out.append(e)
    return out
