"""task_complexity.py — single source of truth for which level handles which task.

Used by:
  scripts/check_level.py   — gates a task against the current detected level.
  scripts/queue.py         — when run with --respect-level, only surfaces ready
                             items that fit the current level.
  docs/task_complexity_map.md — human-readable mirror of this data.

Levels are ordered: low < medium < high < xhigh < max.
Models are ordered: haiku < sonnet < opus.
A task's `min_level` requires *both* effort >= min_effort AND model >= min_model.

Task-type tags below are matched against item descriptions in AUTONOMOUS_PLAN.md
and against explicit `--task-type` flags passed to scripts/check_level.py.

If a task tag isn't found, the helper returns the default ("medium" / "sonnet")
— this keeps the gate permissive rather than blocking unknown work.
"""

from __future__ import annotations

EFFORT_ORDER = ["low", "medium", "high", "xhigh", "max"]
MODEL_ORDER = ["haiku", "sonnet", "opus"]


def effort_rank(e: str) -> int:
    e = (e or "").lower().strip()
    if e in EFFORT_ORDER:
        return EFFORT_ORDER.index(e)
    # Tolerate aliases.
    aliases = {"extrahigh": "xhigh", "extra-high": "xhigh", "extra_high": "xhigh"}
    if e in aliases:
        return EFFORT_ORDER.index(aliases[e])
    return 1  # default to medium when unknown


def model_rank(m: str) -> int:
    """Map "claude-opus-4-7[1m]" or similar to a tier rank."""
    m = (m or "").lower()
    if "opus" in m:
        return MODEL_ORDER.index("opus")
    if "sonnet" in m:
        return MODEL_ORDER.index("sonnet")
    if "haiku" in m:
        return MODEL_ORDER.index("haiku")
    return MODEL_ORDER.index("sonnet")  # default


# Task-type catalogue. Keys are tags; values are (min_effort, min_model, why).
# Add entries as the project grows. Keep keys lower-case kebab-or-snake.
TASKS: dict[str, tuple[str, str, str]] = {
    # Highest-judgment tasks (planning, architecture)
    "cluster-planning": ("max", "opus", "designing a new cluster end-to-end"),
    "spec-writing": ("high", "opus", "ambiguity → design judgment"),
    "architectural-refactor": ("high", "opus", "cross-file invariants must hold"),
    "physics-model-change": ("high", "opus", "load-bearing IP, golden tests must stay green"),
    "rust-crate-integration": ("high", "opus", "unfamiliar APIs + compile error judgment"),
    "external-api-design": ("high", "opus", "hard-to-reverse contract decisions"),
    # Medium-implementable
    "spec-implementation": ("medium", "sonnet", "spec already decided what to build"),
    "data-update": ("medium", "sonnet", "seed.json edits with cited sources"),
    "bug-fix-clear-repro": ("medium", "sonnet", "repro narrows the search"),
    "test-addition": ("medium", "sonnet", "shape mirrors existing tests"),
    "ui-tweak-single-file": ("medium", "sonnet", "small JSX/CSS changes"),
    "chrome-mcp-validation": ("medium", "sonnet", "scripted browser exercise"),
    "documentation": ("medium", "sonnet", "docs need clarity, not deep judgment"),
    "research-deep": ("medium", "sonnet", "parallel-dispatch fan-out; each agent reasons short"),
    "ui-tweak-multi-file": ("medium", "sonnet", "JSX/CSS spanning ≥2 files"),
    # Low-effort cleanup
    "milestone-ritual": ("low", "haiku", "deterministic script invocation"),
    "caveman-commit-message": ("low", "haiku", "rote summary"),
    "dead-code-archive": ("low", "haiku", "git mv after grep verifies no callers"),
    "rename-symbol": ("low", "haiku", "deterministic search-and-replace"),
    "queue-rerank": ("low", "haiku", "scripted"),
    "typo-fix": ("low", "haiku", "trivial"),
    "format-fix": ("low", "haiku", "trivial"),
    # Default / unknown
    "default": ("medium", "sonnet", "fallback when task tag not provided"),
}


def lookup(task_tag: str) -> tuple[str, str, str]:
    return TASKS.get(task_tag.strip().lower(), TASKS["default"])


def fits(current_effort: str, current_model: str, task_tag: str) -> tuple[bool, str]:
    """Return (passes, message). Passes when current level >= required level."""
    min_effort, min_model, why = lookup(task_tag)
    eff_ok = effort_rank(current_effort) >= effort_rank(min_effort)
    mod_ok = model_rank(current_model) >= model_rank(min_model)
    if eff_ok and mod_ok:
        return True, (
            f"ok: {task_tag} needs ≥{min_effort}/{min_model}; "
            f"current {current_effort}/{current_model} fits."
        )
    needs = []
    if not eff_ok:
        needs.append(f"effort ≥ {min_effort} (have {current_effort})")
    if not mod_ok:
        needs.append(f"model ≥ {min_model} (have {current_model})")
    return False, (
        f"mismatch: {task_tag} requires "
        + " AND ".join(needs)
        + f". Reason: {why}."
    )


def all_compatible_tags(current_effort: str, current_model: str) -> list[str]:
    out = []
    for tag in TASKS:
        if tag == "default":
            continue
        ok, _ = fits(current_effort, current_model, tag)
        if ok:
            out.append(tag)
    return out


def apply_calibration(
    updates: dict[str, tuple[str, str]],
) -> list[tuple[str, tuple[str, str], tuple[str, str]]]:
    """Atomically rewrite TASKS minimums with the given {tag: (effort, model)} updates.

    Returns a list of (tag, (old_effort, old_model), (new_effort, new_model)) for
    every change actually applied. Skips entries where the tag isn't already in
    TASKS or the value is unchanged. Writes a timestamped backup next to the
    source file. The 'why' string is preserved as-is.
    """
    from pathlib import Path

    src = Path(__file__).resolve()
    text = src.read_text(encoding="utf-8")
    changes: list[tuple[str, tuple[str, str], tuple[str, str]]] = []
    new_text = text
    for tag, (new_effort, new_model) in updates.items():
        if tag not in TASKS:
            continue
        old_effort, old_model, why = TASKS[tag]
        if old_effort == new_effort and old_model == new_model:
            continue
        # Replace the literal tuple opening — keep the rest of the line
        # (the `why` string + closing) intact by anchoring on the tag key.
        old_anchor = f'"{tag}": ("{old_effort}", "{old_model}",'
        new_anchor = f'"{tag}": ("{new_effort}", "{new_model}",'
        if old_anchor in new_text:
            new_text = new_text.replace(old_anchor, new_anchor, 1)
            changes.append((tag, (old_effort, old_model), (new_effort, new_model)))
        # else: skip — formatting drift; calibrator will see no change
    if changes:
        _atomic_write_with_backup(src, new_text)
    return changes


def _atomic_write_with_backup(path, new_text: str):
    from pathlib import Path
    import time as _time

    ts = _time.strftime("%Y%m%d-%H%M%S")
    backup = path.with_suffix(path.suffix + f".bak.{ts}")
    backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(new_text, encoding="utf-8")
    tmp.replace(path)
    return backup
