# Argus — first-Mac-session bootstrap

## Context

Picking up Argus (single-user reverse image search aggregator) on
`claude/project-review-mobile-VTeqx`. Previous sessions worked in a Linux
sandbox; this is the first session on the operator's Mac, so anything
that was gated on Mac-only tooling (the `claude` CLI, real `exiftool`,
launchd, Keychain, BotFather/Telegram bridge, Playwright MCP browsers)
is now reachable.

Blocker discovered before grounding: `/Users/ianmcadam/Documents/Claude/OSINT/`
is empty — the repo doesn't exist on this Mac yet, and the previous-session
sandbox filesystem isn't shared. Discovered the remote: `barsnbolts/OSINT`
(private, default branch `claude/reverse-image-search-tool-BKkJw`).
Operator confirmed: clone from GitHub.

This plan only covers Steps 1-3 of the operator's brief (ground, verify
env, recommend a slice). It explicitly does **not** start implementation —
operator said "Wait for me to pick before implementing."

## Plan

### 1. Clone + checkout

```bash
gh repo clone barsnbolts/OSINT /Users/ianmcadam/Documents/Claude/OSINT
cd /Users/ianmcadam/Documents/Claude/OSINT
git checkout claude/project-review-mobile-VTeqx
git log --oneline -5
```

The OSINT directory exists but is empty — `gh repo clone` into it should
work without `--`-style force flags; if it complains, fall back to cloning
into a temp dir and moving contents (don't delete the empty dir under the
operator's documents tree).

### 2. Ground (Step 1 of the brief)

Read in order, then summarise back in 4-5 bullets:

1. `CLAUDE.md` — phase table, architecture, conventions
2. `bridge/README.md` — launchd + Keychain setup for the Telegram daemon
3. `git log --oneline -5` — what shipped most recently

(The brief also references `/root/.claude/plans/so-i-really-wanna-gleaming-rivest.md`,
which is a sandbox-only path. Skip — it doesn't exist on Mac. If the repo
itself contains an equivalent handoff doc, read that instead.)

### 3. Verify env (Step 2 of the brief)

Run in parallel, report what's missing. Stop if anything fails:

- `uv --version`
- `claude --version` (the headless CLI, NOT the API)
- `exiftool -ver`
- `gh --version` (already confirmed: 2.91.0)
- `uv sync && uv run pytest -q` — expect 164 passed, 3 skipped
- `uv run ruff check .` — expect clean

### 4. Recommend a slice (Step 3 of the brief)

Read enough of the three candidate tracks to recommend one in 2-3
sentences, naming the main tradeoff. The candidates:

- **Phase 4 live validation** (`worker/claude_calls.py`) — smallest
  scope, validates the real `claude -p` JSON for crop proposals, unblocks
  cropping UI end-to-end.
- **Bridge under launchd** — highest mobile leverage; walk operator
  through BotFather token + chat ID + `security add-generic-password` +
  `launchctl bootstrap`.
- **Phase 5 Playwright MCP** — Yandex + Google Lens shells exist,
  biggest result-quality win, biggest scope.

Then **stop and wait** for the operator's pick. Do not start coding.

## Working agreement (from operator brief, captured here so it survives)

- Branch: `claude/project-review-mobile-VTeqx`. Don't merge or push to
  main without asking.
- Pre-commit: `uv run pytest && uv run ruff check .`
- Commit messages: short imperative ("add X", "fix Y") matching `git log`.
- Telegram / iCloud Drive / Keychain commands: show exact command before
  running.
- Network blocks or missing Mac deps: surface, don't silently stub.

## Critical files (to be read in step 2)

- `CLAUDE.md` (root) — project orientation
- `bridge/README.md` — launchd / Keychain wiring
- `worker/claude_calls.py` — relevant if operator picks Phase 4
- (any file Step 2 surfaces as critical — re-read on a per-slice basis
  once operator picks)

## Verification

End state of this bootstrap, before handing back to operator:

1. `git branch --show-current` returns `claude/project-review-mobile-VTeqx`
2. `uv run pytest -q` → 164 passed, 3 skipped (or surfaced delta)
3. `uv run ruff check .` → clean (or surfaced delta)
4. A 4-5 bullet project-state summary in chat
5. A 2-3 sentence recommendation among the three slices, naming the
   tradeoff
6. No edits to the working tree, no commits, no pushes

---

# Phase B+: Parallel agent dispatch + solo Phase 5/bridge

## Status snapshot (bootstrap is done, Phase 4 + 6 also done)

Post-bootstrap shipped commits on `claude/project-review-mobile-VTeqx`:

- `310ddd0` — Phase 4 live: `claude -p` needs Read tool + visible errors
- `64074f7` — fix CI: `--group dev` → `--extra dev` so ruff installs
- `0983304` — Phase 6 live: `claude -p` reranker with note attachment

CI green on `64074f7`. Test count 175 (164 expected + 3 sandbox-skipped that
run on Mac + 8 new from Phase 4 & 6). Pushed but no PR opened.

## Context for this extension

Operator on opus 4.7 extra-high asked for a phenomenal pre-plan: maximize
what parallel sonnet 4.6 medium agents accomplish in one fan-out (so they
each get a lot to do — no need to spin up new ones), then continue solo on
opus 4.7 medium without further agents. Pre-spec everything so the
post-pause execution is mechanical.

## Pause point (operator drops opus 4.7 extra-high → 4.7 medium HERE)

Once this plan is approved, operator can drop reasoning. Everything from
Step 1 onward is medium-suitable:
- Step 1 dispatches pre-specced agents (no synthesis at dispatch time)
- Step 2 mechanical merge of two file-disjoint branches
- Step 3 live e2e on the Mac (read terminal output, surface failures)
- Step 4-5 Playwright MCP wiring (medium with bump-back-to-high if a
  diagnostic moment hits — surface it, don't tank silently)
- Step 6 operator-interactive bridge walkthrough (mostly typing exact
  commands the operator runs)

If anything in Step 4 or 5 demands extra-high, surface and pause.

## Plan

### Step 1 — Parallel agent dispatch (single message)

Spawn TWO `general-purpose` agents in parallel with `isolation: "worktree"`
(default sonnet 4.6 medium). File-disjoint by design — no merge conflicts.
Each gets a self-contained fat prompt (see Appendix A and B below) with
file paths, exact code outlines, test specs, commit-message style, push
instructions.

Both agents end by pushing their per-agent branch to remote and returning
SHA + branch + test count.

#### Agent 1 — Phase 9 chat + geoloc live (Appendix A)
- Branch: `claude/phase9-live` off `claude/project-review-mobile-VTeqx`
- Files: `worker/chat.py`, `worker/geoloc.py`, `tests/test_chat.py`,
  `tests/test_geoloc.py`
- Pattern reference: Phase 6 `worker/rank.py:_live_rank` (commit `0983304`)
- Verification: `uv run pytest -q && uv run ruff check .` (both green)

#### Agent 2 — Wrapper hardening + smoke extension + CI Node 24 (Appendix B)
- Branch: `claude/wrapper-hardening` off `claude/project-review-mobile-VTeqx`
- Files: `worker/claude_calls.py` (multi-attachment),
  `worker/smoke.py` (mode flag), `.github/workflows/test.yml` (Node 24 env),
  `tests/test_claude_calls.py`, `tests/test_smoke_cli.py`
- Pattern reference: Phase 4 wrapper (commit `310ddd0`)
- Verification: same as Agent 1

### Step 2 — Integrate agent branches

After both agents complete:
1. `git fetch origin`
2. `git merge --ff-only origin/claude/phase9-live` (file-disjoint, FF
   should always succeed)
3. `git merge --ff-only origin/claude/wrapper-hardening`
4. `uv run pytest -q && uv run ruff check .` locally (union must be green)
5. `git push`
6. Watch CI via `until ! gh run list ... | grep queued; do sleep 15; done`

If FF fails (unexpected file overlap): merge with --no-ff, resolve manually,
re-run tests, surface to operator.

If either branch is broken at merge time: cherry-pick the salvageable bits,
surface the gap, don't silently rework.

### Step 3 — Live e2e validation on Mac

Agents committed unit tests but did NOT make live `claude -p` calls
(worktrees lack the auth state from `claude auth login`). I validate:

- `uv run python -c "from pathlib import Path; from worker import claude_calls; print(claude_calls.propose_crop(Path('/Users/ianmcadam/Downloads/download (1).png'), timeout=120))"`
  → real crop coords (already validated for Phase 4, re-validate after
  Agent 2's wrapper changes)
- `uv run python -m worker.smoke '/Users/ianmcadam/Downloads/download (1).png' --mode crop`
  → exercises Agent 2's smoke extension end-to-end
- A small driver script that builds a fake Job + populates results,
  calls `worker.chat.answer(job, "what's the top result?")`, prints
  reply (validates Agent 1 chat live)
- Same shape for `worker.geoloc.guess_location(job)` against a photo
  with EXIF GPS (returns EXIF dict) and one without (calls live AI,
  returns `{lat,lon,confidence,note}`)
- Confirm `job.log` contains expected events (`crop_proposed`,
  `claude_failed` ones if any)

If a live call breaks: bump back to opus high, diagnose, fix, commit.
Otherwise commit nothing — validation only.

### Step 4 — Phase 5 Yandex via Playwright MCP

Wire `worker/adapters/yandex.py:search()` to the live browser. Parser is
already done; the gap is the browser flow. MCP availability check first
(`mcp__Claude_in_Chrome__*` is available; check whether playwright-mcp is
also reachable — CLAUDE.md says Playwright but Chrome MCP can substitute).

Flow:
1. Navigate to `https://yandex.com/images/search?rpt=imageview` (image
   upload variant)
2. Upload image via `file_upload` tool to the page's file input
3. Wait for results page
4. Extract HTML via `get_page_text` or `read_page`
5. Feed HTML to existing parser in `worker/adapters/yandex.py`
6. Replace `raise AdapterError(kind="upstream", msg="Phase 5 marker")`
   with the real flow, keeping the marker as fallback on browser failure

Risks: CAPTCHA, anti-bot fingerprinting, rate limits. If hit: surface +
bump reasoning if needed.

Tests: extend `tests/test_yandex_lens_adversarial.py` with mocks of the
browser tool calls. Live e2e separately.

### Step 5 — Phase 5 Lens via Playwright MCP

Same shape as Yandex but for `worker/adapters/google_lens.py`. Likely
needs Google login state or captcha. Likely first-attempt failure mode is
CAPTCHA → surface + ask operator how to proceed (use Lens via Chrome
extension session vs headless).

### Step 6 — Bridge launchd walkthrough (operator-interactive)

Per `bridge/README.md`. Sequence:

1. Operator opens Telegram → `@BotFather` → `/newbot` → save token
2. Operator sends bot any message from phone
3. I show: `curl "https://api.telegram.org/bot<TOKEN>/getUpdates" | jq '.result[].message.chat.id'`
4. Operator runs that locally, pastes chat id back
5. I show the two Keychain commands (`security add-generic-password ...`)
   for token + chat id; **operator runs them** — Keychain is per-brief
   "show command first" + operator-only category
6. I edit `bridge/launchd.plist` and `bridge/launchd-run.sh` (REPLACE_ME →
   `ianmcadam`)
7. I show: `cp + launchctl bootstrap + enable + kickstart` per README
8. Operator approves + runs (launchd is system-level, operator-only)
9. Smoke from phone: `/status`, `/next test`, `/stop`, `/start`

This step is NOT agent-dispatchable — it requires operator's phone +
Telegram + browser + terminal at the same time.

## Critical files (already known cold; no re-read needed at execution time)

- `worker/claude_calls.py` — Phase 4 wrapper, target of Agent 2 multi-attach
- `worker/rank.py` — Phase 6 live pattern, reference for Agent 1
- `worker/chat.py` + `worker/geoloc.py` — Phase 9 swap points (Agent 1)
- `worker/smoke.py` — extended by Agent 2
- `.github/workflows/test.yml` — Node 24 bump (Agent 2)
- `worker/adapters/yandex.py` + `worker/adapters/google_lens.py` — Phase 5
- `bridge/launchd.plist` + `bridge/launchd-run.sh` — Step 6

## Verification

End state of Phase B+ work:
1. `git log --oneline -8` shows: `0983304` Phase 6, `<a1>` Phase 9,
   `<a2>` hardening, `<integration>` merge, `<yandex>` Phase 5 Yandex,
   `<lens>` Phase 5 Lens, `<bridge>` bridge wiring
2. CI green on working branch
3. Live calls verified on Mac for crop, rank, chat, geoloc
4. `uv run python -m worker.smoke <photo> --mode all` exercises all 6
   engines + crop + chat with no Phase-5 marker errors
5. `bridge/` daemon running under launchd; `/status` from phone returns
   last commit + AUTOPILOT tail
6. CI Node-20 deprecation warning silenced

## What NOT to do (per CLAUDE.md + brief, restated for durability)

- Don't merge or push to default branch (`claude/reverse-image-search-tool-BKkJw`)
  without asking
- Don't run live AI calls inside agents (worktrees lack `claude auth` state)
- Don't wire face-search engines (PimEyes/FaceCheck) before Yandex+Lens
- Don't replace `claude -p` with Anthropic API
- Don't write `Co-Authored-By` trailers in commits (existing style omits)
- Don't touch Keychain or `launchctl bootstrap` ourselves — operator runs
  those (per brief: "show me the exact command before running it")

---

## Appendix A — Agent 1 prompt (Phase 9 chat + geoloc live)

```
You are picking up Argus, a single-user reverse-image-search aggregator,
on a Mac at /Users/ianmcadam/Documents/Claude/OSINT/. Your task: ship
Phase 9 — wire `worker/chat.py:_live_answer` and `worker/geoloc.py:_live_geoloc`
to the live `claude -p` CLI, mirroring the Phase 6 pattern that already
exists in `worker/rank.py:_live_rank` (commit 0983304).

## Branch
Create `claude/phase9-live` off `claude/project-review-mobile-VTeqx`. Push to
that branch. DO NOT push to main or to the default branch.

## Files to read first (parallel reads in one message)
- worker/claude_calls.py — wrapper, especially _run_claude signature and
  attachment+Read pattern
- worker/rank.py — Phase 6 reference (the exact shape your live paths should
  follow)
- worker/chat.py — file you'll modify
- worker/geoloc.py — file you'll modify
- tests/test_rank.py — test pattern reference (live-path tests with
  monkeypatch of _stub_active and _run_claude)
- tests/test_chat.py + tests/test_geoloc.py — extend these

## Spec — worker/chat.py:_live_answer

Replace the NotImplementedError body. Live path: send a compact Job
summary as JSON to claude -p, ask for a 1-2 sentence plain-text reply.
Fallback to the existing stub branch on any error.

Add `import json` at top.

```python
def _live_answer(job: Job, question: str, *, timeout: float = 60.0) -> str:
    summary = _job_to_summary(job)
    prompt = (
        "You are answering a follow-up question about a reverse-image-search job. "
        "Reply with a 1-2 sentence answer in plain text. No markdown, no JSON, no fences.\n\n"
        f"Question: {question}\n\n"
        f"Job context:\n{json.dumps(summary, ensure_ascii=False)}"
    )
    try:
        return _run_claude(prompt, timeout=timeout).strip()
    except ClaudeCallError as e:
        log.warning({"event": "claude_failed", "step": "chat", "msg": str(e)})
        return _stub_answer(job, question)
```

`_job_to_summary(job)` — new helper. Returns
`{"subject": job.subject, "n_photos": len(job.photos), "results": [...top 10
with engine/url/title/note...], "exif_summary": {pid: e.get("summary", {})
for pid, e in job.exif.items()}}`. Cap results at 10 entries. Keep
serialized payload under ~3KB.

`_stub_answer(job, question)` — new helper. Move the existing stub branch
of `answer()` (the entire `if _stub_active():` block body) into this helper.
The `answer()` function now reads:
```python
def answer(job: Job, question: str) -> str:
    if _stub_active():
        return _stub_answer(job, question)
    return _live_answer(job, question)
```

Imports: `from worker.claude_calls import ClaudeCallError, _run_claude, _stub_active`

## Spec — worker/geoloc.py:_live_geoloc

Read worker/geoloc.py first to see how EXIF GPS extraction is wired. EXIF
is the FIRST path; live AI fires only when EXIF is absent. Preserve that
order.

```python
GEOLOC_PROMPT = """\
Identify any geographic location clues in this image (signage, architecture,
vegetation, license plates, distinctive landmarks). Reply with ONLY one JSON
object: {"lat":FLOAT|null,"lon":FLOAT|null,"confidence":STRING,"note":STRING}
where confidence is one of: high, medium, low, none. If no clues, lat/lon=null,
confidence="none". note is a 1-sentence justification. No prose, no markdown."""

def _live_geoloc(photo_path: Path, *, timeout: float = 90.0) -> dict:
    try:
        raw = _run_claude(GEOLOC_PROMPT, timeout=timeout, attachment=photo_path)
        return _parse_geoloc_json(raw)
    except (ClaudeCallError, ValueError) as e:
        log.warning({"event": "claude_failed", "step": "geoloc_ai", "msg": str(e)})
        return {"lat": None, "lon": None, "confidence": "none",
                "note": f"live geoloc failed: {e}"}
```

`_parse_geoloc_json(raw)` — same forgiving fence-strip as Phase 4/6 then
json.loads. Validate: returned obj is a dict with the four expected keys
(coerce missing to None/"none"/""). Raise ValueError on non-dict reply.

If geoloc.py has a `guess_location(job)` entry point that already calls EXIF
first and falls through to a stub, change the fallback to call `_live_geoloc`
on each photo with no EXIF GPS. Aggregate: if ANY photo gets a real lat/lon,
return that (highest confidence wins). Otherwise return the EXIF-or-AI dict
with confidence="none".

## Tests

Add to tests/test_chat.py (mirroring tests/test_rank.py live-path tests):
- test_live_answer_uses_claude_when_stub_off (monkeypatch _run_claude to
  return canned reply, assert returned == reply.strip())
- test_live_answer_falls_back_to_stub_on_claudecallerror
- test_job_to_summary_caps_results_at_10 (feed 20, verify 10)
- test_job_to_summary_includes_subject_and_n_photos

Add to tests/test_geoloc.py:
- test_live_geoloc_parses_valid_json
- test_live_geoloc_falls_back_on_garbage
- test_live_geoloc_falls_back_on_claude_error
- test_geoloc_prefers_exif_over_live (if EXIF GPS present, never call _live_geoloc)

Run before commit: `uv run pytest -q && uv run ruff check .`. Both must
pass. Test count should land 179-183 (was 175 + 4-8 new).

## Commit style (match existing — see `git log -3 --format=fuller`)

- Title: short imperative ≤70 chars, e.g. "Phase 9 live: chat + geoloc via claude -p"
- Body: 2-3 paragraphs explaining the live path + fallback chain + test count
- NO Co-Authored-By trailer (existing commits don't have one)

Single commit covering both files.

## Push

```
git push -u origin claude/phase9-live
```

## Return to caller

Commit SHA + branch name + test count + any caveats. Hard cap your
response at 250 words.
```

## Appendix B — Agent 2 prompt (wrapper hardening + smoke + CI Node 24)

```
You are picking up Argus on a Mac at /Users/ianmcadam/Documents/Claude/OSINT/.
Your task: three follow-ups on infra/wrapper polish, all in one branch.

## Branch
Create `claude/wrapper-hardening` off `claude/project-review-mobile-VTeqx`.
Push to that branch. DO NOT push to main or to the default branch.

## Files to read first (parallel)
- worker/claude_calls.py — wrapper to extend (commit 310ddd0 just hardened)
- worker/smoke.py — current smoke CLI (only does adapters)
- tests/test_claude_calls.py — pattern reference
- tests/test_smoke_cli.py — pattern reference
- .github/workflows/test.yml — CI workflow

## Spec 1 — _run_claude accepts list of attachments

Change worker/claude_calls.py:_run_claude signature:
```python
def _run_claude(
    prompt: str,
    *,
    timeout: float = 60.0,
    attachment: Path | list[Path] | None = None,
) -> str:
```

Behavior:
- None → no attachment flags (current behavior unchanged)
- single Path → current behavior unchanged (--add-dir parent + --allowedTools Read,
  prompt prefixed with "Use the Read tool to open the image at <path>, then:")
- list[Path] → one --add-dir per UNIQUE parent dir, single --allowedTools Read,
  prompt prefixed with "Use the Read tool to open these images: <comma-separated
  paths>, then:"

Empty list = treat as None.

## Spec 2 — worker/smoke.py mode flag

New `--mode <crop|search|chat|all>` flag (default `search` to preserve
existing behavior).

- `search` (default): existing fan-out across adapters, unchanged
- `crop`: call `worker.claude_calls.propose_crop(image)` and print the box
  JSON via `print(json.dumps({"step":"crop","box":box}))`
- `chat`: build a synthetic Job with the image as a Photo, call
  `worker.chat.answer(job, question)` where question comes from
  `--question <text>` or stdin if not provided. Print as
  `{"step":"chat","question":Q,"reply":R}`.
- `all`: run crop, then search, then a sample chat question
  ("how many results did we find?")

Add `--question <text>` arg for chat mode.

Tests: add to tests/test_smoke_cli.py covering each mode dispatch (mock
claude_calls.propose_crop, chat.answer, and adapters; assert correct
function called with expected args).

## Spec 3 — CI Node 24 bump

In `.github/workflows/test.yml`, add at the workflow `env:` level (top of
file, before `jobs:`):
```yaml
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"
```

This silences the Node-20 deprecation warning without bumping action
versions.

## Tests for Spec 1

Add to tests/test_claude_calls.py:
- test_run_claude_multi_attachment_unique_parents (2 photos, same dir →
  one --add-dir; 2 photos, different dirs → two --add-dir; both paths in
  prompt; --allowedTools Read present once)
- test_run_claude_empty_list_treated_as_none

## Verification

`uv run pytest -q && uv run ruff check .` both green. Test count ~178-181
(was 175 + 3-6 new).

## Commit style

Match existing. ONE commit covering all three changes (cleanest history)
or three small commits (clearer separation) — your call. Imperative title
≤70 chars. No Co-Authored-By trailer.

## Push

```
git push -u origin claude/wrapper-hardening
```

## Return to caller

Commit SHA(s) + branch name + test count + any caveats. ≤250 words.
```

