"""Unit tests for calibrate.compute_min_updates + compute_token_updates.

Synthetic observation rows used so tests don't depend on the live log.
Run via:
    python3 -m unittest scripts.test_calibrate
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from calibrate import (  # noqa: E402
    _normalize,
    compute_min_updates,
    compute_token_updates,
)


def obs(
    tag: str,
    model: str,
    effort: str,
    passed: bool,
    self_tokens: int = 5000,
    confidence: str = "medium",
    git_lines: int = 50,
    turns: int = 5,
    ts: int = 1,
) -> dict:
    return _normalize(
        {
            "ts": ts,
            "milestone_id": "TEST",
            "model": model,
            "effort": effort,
            "task_tag": tag,
            "passed_first_try": passed,
            "indirect": {
                "git_lines_changed": git_lines,
                "wall_clock_min": 5.0,
                "completed_turns_delta": turns,
                "milestone_exit_code": 0 if passed else 1,
            },
            "self_estimate": {"cost_tokens": self_tokens, "confidence": confidence},
            "source": "milestone",
        }
    )


class TestMinUpdates(unittest.TestCase):
    def test_lower_after_three_consecutive_successes_one_tier_below(self) -> None:
        # spec-implementation has min ≥ medium/sonnet by default. Three
        # successful runs at low/sonnet (one tier below in effort) should
        # lower the min.
        rows = [
            obs("spec-implementation", "sonnet", "low", True, ts=i + 1) for i in range(3)
        ]
        updates = compute_min_updates(rows)
        self.assertIn("spec-implementation", updates)
        new_effort, new_model = updates["spec-implementation"]
        self.assertEqual(new_effort, "low")
        self.assertEqual(new_model, "sonnet")

    def test_a_single_failure_at_lower_resets_streak(self) -> None:
        # 2 successes then 1 failure at low/sonnet → streak resets, no lower
        rows = [
            obs("spec-implementation", "sonnet", "low", True, ts=1),
            obs("spec-implementation", "sonnet", "low", True, ts=2),
            obs("spec-implementation", "sonnet", "low", False, ts=3),
        ]
        updates = compute_min_updates(rows)
        # The latest run was a failure at low — streak counts from end and
        # stops at first failure → 0. Should not lower.
        self.assertNotIn("spec-implementation", updates)

    def test_failure_at_current_min_raises_min(self) -> None:
        # spec-implementation min = medium/sonnet. A failure AT that level
        # should immediately raise the min one tier (effort → high).
        rows = [obs("spec-implementation", "sonnet", "medium", False, ts=1)]
        updates = compute_min_updates(rows)
        self.assertIn("spec-implementation", updates)
        new_effort, new_model = updates["spec-implementation"]
        self.assertEqual(new_effort, "high")  # effort raised one tier
        self.assertEqual(new_model, "sonnet")

    def test_no_change_when_only_observations_are_at_or_above_min(self) -> None:
        # Three successes at the current min level — no down-trigger because
        # the rule requires successes at a STRICTLY CHEAPER level.
        rows = [
            obs("spec-implementation", "sonnet", "medium", True, ts=i + 1) for i in range(3)
        ]
        updates = compute_min_updates(rows)
        self.assertNotIn("spec-implementation", updates)


class TestTokenUpdates(unittest.TestCase):
    def test_no_update_below_min_observation_count(self) -> None:
        # 4 obs (< MIN_OBS_FOR_TOKENS=5) → no update even with massive drift.
        rows = [
            obs("spec-implementation", "sonnet", "medium", True, self_tokens=1, ts=i + 1)
            for i in range(4)
        ]
        updates = compute_token_updates(rows)
        self.assertNotIn("spec-implementation", updates)

    def test_no_update_if_drift_below_threshold(self) -> None:
        # spec-implementation default = 15000. Five obs each at 16000
        # (drift = 6.7 % < 20 %) → no change.
        rows = [
            obs("spec-implementation", "sonnet", "medium", True, self_tokens=16000, ts=i + 1)
            for i in range(5)
        ]
        updates = compute_token_updates(rows)
        self.assertNotIn("spec-implementation", updates)

    def test_update_when_drift_above_threshold(self) -> None:
        # spec-implementation default = 15000. Five obs at 30000 (+100 %)
        # AND git_lines low so combined-cost-units doesn't bump indirect estimate
        # above the self-estimate. → update applied.
        rows = [
            obs(
                "spec-implementation",
                "sonnet",
                "medium",
                True,
                self_tokens=30000,
                git_lines=10,
                turns=2,
                ts=i + 1,
            )
            for i in range(5)
        ]
        updates = compute_token_updates(rows)
        self.assertIn("spec-implementation", updates)
        # New value should be ~30000 (rounded to nearest 1k, weighted median)
        self.assertGreaterEqual(updates["spec-implementation"], 25000)

    def test_high_confidence_observations_weighted_higher(self) -> None:
        # 2 high-confidence obs at 50000 (weight 3 each) + 3 low at 10000 (w 1)
        # → median tilts toward high-confidence values.
        rows = [
            obs("spec-implementation", "sonnet", "medium", True, self_tokens=50000,
                confidence="high", git_lines=10, turns=2, ts=1),
            obs("spec-implementation", "sonnet", "medium", True, self_tokens=50000,
                confidence="high", git_lines=10, turns=2, ts=2),
            obs("spec-implementation", "sonnet", "medium", True, self_tokens=10000,
                confidence="low", git_lines=10, turns=2, ts=3),
            obs("spec-implementation", "sonnet", "medium", True, self_tokens=10000,
                confidence="low", git_lines=10, turns=2, ts=4),
            obs("spec-implementation", "sonnet", "medium", True, self_tokens=10000,
                confidence="low", git_lines=10, turns=2, ts=5),
        ]
        updates = compute_token_updates(rows)
        self.assertIn("spec-implementation", updates)
        # 6 weighted entries of 50000 + 3 weighted entries of 10000 → median = 50000
        self.assertEqual(updates["spec-implementation"], 50000)


if __name__ == "__main__":
    unittest.main()
