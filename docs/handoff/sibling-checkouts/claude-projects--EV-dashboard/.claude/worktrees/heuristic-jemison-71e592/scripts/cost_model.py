"""cost_model.py — single source of truth for cost + throughput estimates.

Used by:
  scripts/recommend_model.py  — picks UP/DOWN model swaps based on these numbers
  scripts/queue.py            — when surfacing the queue with cost annotations
  docs/task_complexity_map.md — humans can read the same constants here

Numbers are *rough buckets*, not precise predictions. Tune via real LEARNINGS.

Combined cost factor = MODEL_COST[model] * EFFORT_COST[effort].
Estimated tokens for a task = TASK_TOKENS[tag] (model/effort doesn't change
how many tokens the task generates — the *cost per token* is what scales).
Estimated wall-clock minutes = TASK_TOKENS[tag] / 1000 * MODEL_LATENCY[model] * EFFORT_LATENCY[effort].

Cost = tokens * combined_cost_factor. Cheaper level → smaller dollar (or quota)
hit; faster model → less wall-clock waiting.
"""

from __future__ import annotations

from pathlib import Path
from typing import TypedDict

from task_complexity import TASKS, effort_rank, model_rank


# Relative monetary cost (rough Anthropic API ratios; Haiku as 1).
MODEL_COST: dict[str, float] = {
    "haiku": 1.0,
    "sonnet": 3.0,
    "opus": 5.0,
}

EFFORT_COST: dict[str, float] = {
    "low": 0.5,
    "medium": 1.0,
    "high": 2.0,
    "xhigh": 3.0,
    "max": 5.0,
}

# Relative wall-clock latency multiplier (lower = faster).
MODEL_LATENCY: dict[str, float] = {
    "haiku": 0.4,
    "sonnet": 0.6,
    "opus": 1.0,
}

EFFORT_LATENCY: dict[str, float] = {
    "low": 0.5,
    "medium": 1.0,
    "high": 1.5,
    "xhigh": 2.0,
    "max": 3.0,
}

# Per-task-tag rough token count (output tokens, including reasoning tokens
# at higher effort levels). Tuned by hand; refine when LEARNINGS accumulates
# real numbers.
TASK_TOKENS: dict[str, int] = {
    "cluster-planning": 80_000,
    "spec-writing": 40_000,
    "architectural-refactor": 30_000,
    "physics-model-change": 30_000,
    "rust-crate-integration": 30_000,
    "external-api-design": 25_000,
    "spec-implementation": 29_000,
    "data-update": 8_000,
    "bug-fix-clear-repro": 8_000,
    "test-addition": 8_000,
    "chrome-mcp-validation": 8_000,
    "ui-tweak-single-file": 5_000,
    "documentation": 5_000,
    "research-deep": 12_000,
    "ui-tweak-multi-file": 7_000,
    "dead-code-archive": 2_000,
    "rename-symbol": 2_000,
    "queue-rerank": 2_000,
    "milestone-ritual": 2_000,
    "typo-fix": 2_000,
    "format-fix": 2_000,
    "caveman-commit-message": 1_000,
    "default": 8_000,
}


def normalize_model(m: str) -> str:
    """Take 'claude-opus-4-7[1m]' or similar and return canonical tier name."""
    m = (m or "").lower()
    if "opus" in m:
        return "opus"
    if "sonnet" in m:
        return "sonnet"
    if "haiku" in m:
        return "haiku"
    return "sonnet"  # safe default


def normalize_effort(e: str) -> str:
    e = (e or "").lower().strip()
    aliases = {"extrahigh": "xhigh", "extra-high": "xhigh", "extra_high": "xhigh"}
    if e in aliases:
        return aliases[e]
    if e in EFFORT_COST:
        return e
    return "medium"


class Estimate(TypedDict):
    tokens: int
    cost_factor: float       # relative — multiply tokens to get effective cost
    cost_units: float        # tokens × cost_factor — comparable across models
    minutes: float           # rough wall-clock time


def estimate(model: str, effort: str, task_tag: str) -> Estimate:
    m = normalize_model(model)
    e = normalize_effort(effort)
    tag = task_tag if task_tag in TASK_TOKENS else "default"
    tokens = TASK_TOKENS[tag]
    cost_factor = MODEL_COST[m] * EFFORT_COST[e]
    minutes = (tokens / 1000.0) * MODEL_LATENCY[m] * EFFORT_LATENCY[e]
    return Estimate(
        tokens=tokens,
        cost_factor=cost_factor,
        cost_units=tokens * cost_factor,
        minutes=round(minutes, 2),
    )


def cheapest_compatible(task_tag: str) -> tuple[str, str, Estimate]:
    """Return the (model, effort, estimate) tuple with the lowest cost_units
    among levels that satisfy the task's min_level requirement."""
    if task_tag not in TASKS:
        task_tag = "default"
    min_effort, min_model, _why = TASKS[task_tag]
    min_e_rank = effort_rank(min_effort)
    min_m_rank = model_rank(min_model)
    best: tuple[str, str, Estimate] | None = None
    for m in MODEL_COST:
        if model_rank(m) < min_m_rank:
            continue
        for e in EFFORT_COST:
            if effort_rank(e) < min_e_rank:
                continue
            est = estimate(m, e, task_tag)
            if best is None or est["cost_units"] < best[2]["cost_units"]:
                best = (m, e, est)
    assert best is not None  # at least min_model + min_effort qualifies
    return best


def apply_calibration(updates: dict[str, int]) -> list[tuple[str, int, int]]:
    """Atomically rewrite TASK_TOKENS with the given {tag: new_int} updates.

    Returns a list of (tag, old, new) tuples for every change actually applied.
    Skips entries where the tag isn't already in TASK_TOKENS or the value is
    unchanged. Writes a timestamped backup next to the source file.
    """
    src = Path(__file__).resolve()
    text = src.read_text(encoding="utf-8")
    changes: list[tuple[str, int, int]] = []
    new_text = text
    for tag, new_val in updates.items():
        if tag not in TASK_TOKENS:
            continue
        old_val = TASK_TOKENS[tag]
        if old_val == new_val:
            continue
        # Match the literal source line. Tolerate either underscored or plain
        # int formatting (e.g. 80_000 or 80000).
        old_repr_a = f'"{tag}": {old_val:_d}'
        old_repr_b = f'"{tag}": {old_val:d}'
        new_repr = f'"{tag}": {new_val:_d}'
        if old_repr_a in new_text:
            new_text = new_text.replace(old_repr_a, new_repr, 1)
            changes.append((tag, old_val, new_val))
        elif old_repr_b in new_text:
            new_text = new_text.replace(old_repr_b, new_repr, 1)
            changes.append((tag, old_val, new_val))
        # else: silent skip — formatting edge case, calibrator will see no diff
    if changes:
        _atomic_write_with_backup(src, new_text)
    return changes


def _atomic_write_with_backup(path: Path, new_text: str) -> Path:
    import time as _time

    ts = _time.strftime("%Y%m%d-%H%M%S")
    backup = path.with_suffix(path.suffix + f".bak.{ts}")
    backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(new_text, encoding="utf-8")
    tmp.replace(path)
    return backup


def fastest_compatible(task_tag: str) -> tuple[str, str, Estimate]:
    """Return the (model, effort, estimate) tuple with the lowest minutes
    among levels that satisfy the task's min_level requirement."""
    if task_tag not in TASKS:
        task_tag = "default"
    min_effort, min_model, _why = TASKS[task_tag]
    min_e_rank = effort_rank(min_effort)
    min_m_rank = model_rank(min_model)
    best: tuple[str, str, Estimate] | None = None
    for m in MODEL_COST:
        if model_rank(m) < min_m_rank:
            continue
        for e in EFFORT_COST:
            if effort_rank(e) < min_e_rank:
                continue
            est = estimate(m, e, task_tag)
            if best is None or est["minutes"] < best[2]["minutes"]:
                best = (m, e, est)
    assert best is not None
    return best
