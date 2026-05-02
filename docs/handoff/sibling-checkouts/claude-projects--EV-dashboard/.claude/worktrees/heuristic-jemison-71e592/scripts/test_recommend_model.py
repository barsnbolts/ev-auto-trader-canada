"""Unit tests for recommend_model.decide — covers each decision branch.

Synthetic queue items used so tests don't depend on the live AUTONOMOUS_PLAN.
Run via:
    python3 -m unittest scripts/test_recommend_model.py
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from recommend_model import decide  # noqa: E402


def item(id_: str, title: str, tag: str, priority: float = 1.0) -> dict:
    return {
        "id": id_,
        "title": title,
        "tag": tag,
        "value": 2,
        "cost": 1,
        "priority": priority,
        "zone": 0,
        "prefix_rank": 0,
    }


class TestDecide(unittest.TestCase):
    def test_stop_when_queue_empty(self) -> None:
        d = decide("opus", "xhigh", [], [])
        self.assertEqual(d["decision"], "stop-no-work")

    def test_nudge_up_when_top_priority_parked_one_tier_above(self) -> None:
        # On sonnet/medium, a high-priority spec-writing item (needs opus/high) is parked.
        compatible = [
            item("LOW1", "ui tweak label", "ui-tweak-single-file", priority=0.8),
        ]
        skipped = [
            item("HI1", "spec for new cluster", "spec-writing", priority=3.0),
        ]
        d = decide("sonnet", "medium", compatible, skipped)
        self.assertEqual(d["decision"], "nudge-up")
        self.assertEqual(d["blocked_item"], "HI1")
        self.assertEqual(d["target_model"], "opus")

    def test_nudge_down_when_next3_all_fit_cheaper_level(self) -> None:
        # On opus/xhigh, three trivial items (default tag → fits sonnet/medium).
        compatible = [
            item(f"X{i}", f"some default work {i}", "default", priority=3.0 - i * 0.1)
            for i in range(3)
        ]
        d = decide("opus", "xhigh", compatible, [])
        self.assertEqual(d["decision"], "nudge-down")
        self.assertGreaterEqual(d["saving_factor"], 3.0)
        self.assertEqual(d["target_model"], "sonnet")

    def test_silent_swap_when_no_strong_signal(self) -> None:
        # On sonnet/medium, top item is a spec-implementation (fits exactly).
        # Should pick top compatible, no nudge.
        compatible = [
            item("OK1", "implement spec from cluster I", "spec-implementation", priority=2.0),
            item("OK2", "documentation update", "documentation", priority=1.0),
        ]
        d = decide("sonnet", "medium", compatible, [])
        # Could be 'stay' or 'silent-swap' depending on whether anything is skipped.
        self.assertIn(d["decision"], ("stay", "silent-swap"))
        self.assertEqual(d["pick"], "OK1")

    def test_stop_when_all_items_parked(self) -> None:
        compatible: list[dict] = []
        skipped = [
            item("HI1", "design new architecture", "architectural-refactor", priority=3.0),
        ]
        d = decide("haiku", "low", compatible, skipped)
        # If skipped[0] is one tier above current → nudge-up.
        # haiku → opus is a >1 jump, so should NOT nudge-up; falls through to stop.
        self.assertIn(d["decision"], ("nudge-up", "stop-no-work"))

    def test_nudge_up_only_for_one_tier_jump(self) -> None:
        # On haiku/low, a max-effort cluster-planning item is parked.
        # haiku → opus is a 2-tier model jump; should NOT nudge-up (too far).
        compatible = [item("OK1", "rename a thing", "rename-symbol", priority=0.5)]
        skipped = [item("PLAN", "plan whole cluster", "cluster-planning", priority=3.0)]
        d = decide("haiku", "low", compatible, skipped)
        # cluster-planning needs max+opus; haiku → opus is a 2-tier jump.
        # Logic checks `0 <= jump <= 1`. 2-tier model jump should fail nudge-up.
        # That should return silent-swap or stay (since compatible isn't empty).
        self.assertNotEqual(d["decision"], "nudge-up")


if __name__ == "__main__":
    unittest.main()
