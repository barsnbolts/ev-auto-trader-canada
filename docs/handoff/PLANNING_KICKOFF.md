# Planning Kickoff Prompt — extra-high reasoning, planning + pre-work only

Paste verbatim into a fresh Claude Code session set to **extra-high
reasoning**. The session does NOT execute the M-task implementations
beyond what is explicitly safe-to-pre-do; its real job is to spend the
extra-high budget on thinking, research, and decision-making so that a
follow-up **medium-reasoning session** can chug through purely
mechanical execution from a written `docs/handoff/EXECUTION_PLAN_*.md`.

Mirror sha at the time this prompt was authored: `7ee46e3` on
`claude/verify-environment-setup-oTu3S`.

---

```
You are the PLANNING + PRE-WORK pass for the EV Auto Trader Canada project. Run on extra-high reasoning. Your job is NOT to ship M0→M12 in this session — your job is to do the thinking, research, and design that turns each M-task into a self-contained mechanical script a medium-reasoning session can execute later. You may also DO any of the M-tasks that are safe to fully complete during planning (mechanical, no judgment, no surprises).

## 0. Bootstrap

1. cwd must end with /ev-auto-trader-canada. Never cd outside this tree.
2. Confirm: git remote -v shows barsnbolts/ev-auto-trader-canada, current branch is claude/verify-environment-setup-oTu3S, HEAD is 7ee46e3 or newer. Run: git fetch --all --prune && git pull --ff-only.
3. Detect environment by listing the MCPs available:
     - If `mcp__Claude_in_Chrome__*` AND `mcp__Apify__*` AND `mcp__scheduled-tasks__create_scheduled_task` are all present → MODE = MAC.
     - Else → MODE = SANDBOX.
   Print the detected mode in your first message. The mode determines whether M0/M2/M11 are within scope this session (MAC) or BLOCKED-with-detailed-instructions (SANDBOX).
4. Read these in order before doing any planning work:
     docs/handoff/SANDBOX_README.md
     docs/handoff/PLAN_M0_M12_RECONSTRUCTED.md
     docs/handoff/PLAN_M0_M12_AUTHORITATIVE.md
     docs/handoff/SANDBOX_LIMITS.md
     docs/handoff/mac-context/plans/you-are-continuing-the-shiny-pixel.md
     SESSION_HANDOFF_2026-05-01.md
     REPLAN_BRIEF.md
     OVERNIGHT_SUMMARY.md
     MEDIUM_NEXT.md
     NEXT.md
     BLOCKERS_MEDIUM.md
     LOW_NEXT.md
5. Skim docs/handoff/superpowers/ — full superpowers skill content is mirrored locally; SKILL.md files are authoritative.
6. Read the tail of docs/handoff/mac-context/transcripts/3c6bf353-…jsonl to see what the previous session(s) actually did.

## 1. Hard rules (non-negotiable, both modes)

- Touch ONLY this repo's tree. Never cd elsewhere. Never operate git on another repo. Never write Mac files outside docs/handoff/mac-context/.
- Never `git add -A` or `git add .` — stage by explicit path.
- Never `--no-verify`, `--amend`, `--force`, `--force-with-lease`, or `git reset --hard` against shared branches.
- Never push to main. Working branch is claude/verify-environment-setup-oTu3S.
- Push gate: `npm run predeploy` MUST pass before any push.
- 3 consecutive predeploy failures → halt + ask. Vercel deploy broken twice → halt + ask.
- Apify ALLOWED up to $30 cumulative; ask in chat before first run.
- TodoWrite live, exactly one in_progress.
- Force /compact at 250k context.

## 2. Reasoning level for THIS session vs the next

- THIS session: extra-high. Use it on thinking, not typing. Think before grepping; grep before drafting; draft before committing.
- The follow-up session you are setting up: medium. It will execute strictly from `docs/handoff/EXECUTION_PLAN_<YYYY-MM-DD>.md` you produce. It must NOT need to make design decisions; if it would have to, that's a planning gap on you.

## 3. Mission this session — in priority order

### 3a. Investigate every M-task (HEAVY LIFTING)

For each of M0, M2, M3, M4, M6, M9, M10A, M11, M12, produce a fully-specified work order. The work order must be detailed enough that a medium-reasoning session reading only the work order (not the source) could execute it without back-tracking. For each task collect:

- **Files touched**, exact paths, with line ranges where applicable.
- **Call-site map**: every grep/find result that is in scope, with file:line.
- **Diff sketch**: pseudo-diff or before/after snippet for each non-trivial edit. Skip diff sketches for pure additions of new files; just describe the contents.
- **Verification steps**: exact commands to run after the change (typecheck, build, scoreOrder comparison, snapshot diff, etc.) and the expected output to assert.
- **Edge cases / known gotchas**: e.g. for M4, the order of cookie reads matters; for M3, snapshot retention rules; for M12, OEM trim ambiguity rules.
- **Pre-fetched data** (where applicable): see §3b below.
- **Status**: READY (medium can do it), BLOCKED-MAC-ONLY (subset that needs Mac MCPs), or COMPLETED-BY-PLANNING (you finished it during this session).

### 3b. Do safe-to-pre-do work NOW (so medium has less to do)

Within the budget of this session, complete these where they are mechanical and not destructive:

- **Exa research** for M9 (heatpump availability per model/trim) and M12 (OEM MSRP refresh). Save raw research to `docs/handoff/research/M9_heatpump_<date>.md` and `docs/handoff/research/M12_msrp_<date>.md`. Don't write the final data files yet unless the planning is unambiguous; medium session writes them under instruction.
- **M10 Phase A**: write `docs/LEASEBUSTERS_PROBE.md` outright. Phase A is a documentation-only task; finish it here. After writing, mark M10A as COMPLETED-BY-PLANNING and pause M10 entirely (Phase B/C still need go-ahead).
- **MAC-only probes**:
  - M0 GraphQL probe — actually run it (Chrome MCP). Save raw captures to `docs/handoff/research/M0_graphql_<date>.json` plus a one-page interpretation in `docs/handoff/research/M0_findings_<date>.md`. Decision: "GraphQL usable" or "GraphQL unusable, fall through to M3".
  - M2 sample scrape — run a tiny ON+H/K sample (1 page per province per make to confirm shape, NOT the full scrape). Save to `docs/handoff/research/M2_sample_<date>.json` so medium can resume from a known-good schema. Stay well under the $30 Apify cap; if a small sample crosses $5 cumulative, stop and report.
- **Greps + call-site enumeration** for M4, M6: produce the full file:line lists in the EXECUTION_PLAN. No edits yet.

Do NOT do during planning:

- M3 implementation (snapshot-diff is touchy; design it but let medium implement under guidance).
- M4 cookie migration (HIGH-tagged, multi-file, scoreOrder verification — leave for medium so its full attention is on the change).
- M6 rename (let medium do it after planning enumerates every import site).
- M11 cron registration if MAC mode (write the exact `mcp__scheduled-tasks__create_scheduled_task` call as a script in the plan; medium executes).
- Any commit that touches src/ for an M-task. Research artifacts under docs/handoff/research/ may be committed; M-task implementations stay for medium.

### 3c. Produce the medium-session kickoff prompt

The last thing you do this session is write `docs/handoff/EXECUTION_KICKOFF_<YYYY-MM-DD>.md` containing the paste-ready prompt for a fresh medium-reasoning session. That prompt must:

- Reference the EXECUTION_PLAN_<date>.md as the only source of truth.
- Reaffirm hard rules from §1.
- Tell medium to set its reasoning to medium and proceed task-by-task in EXECUTION_PLAN order, marking each task DONE in TodoWrite as it lands a passing predeploy + push.
- Instruct medium to halt + ask if any work order in EXECUTION_PLAN reads as ambiguous — that is a planning gap to escalate, not improvise around.

## 4. Output artifact spec

Produce these files under `docs/handoff/`:

- `EXECUTION_PLAN_<YYYY-MM-DD>.md` — the per-task work orders (§3a) plus a top-level checklist of statuses.
- `EXECUTION_KICKOFF_<YYYY-MM-DD>.md` — the paste prompt for the next session (§3c).
- `research/M0_graphql_<YYYY-MM-DD>.json` + `research/M0_findings_<YYYY-MM-DD>.md` (MAC mode only).
- `research/M2_sample_<YYYY-MM-DD>.json` (MAC mode only, optional if M0 succeeded).
- `research/M9_heatpump_<YYYY-MM-DD>.md`.
- `research/M12_msrp_<YYYY-MM-DD>.md`.
- `docs/LEASEBUSTERS_PROBE.md` (M10 Phase A; counts as COMPLETED-BY-PLANNING).

Commit these in logical groups with explicit `git add` paths. Predeploy gate still applies (research/docs-only commits will pass typecheck trivially; do not skip it). Push after each group with the standard exponential-backoff retry.

## 5. Stop conditions (halt + ask in chat)

- 3 consecutive predeploy failures.
- Vercel deploy broken twice.
- About to write outside this repo's tree (or outside docs/handoff/mac-context/ for Mac state mirroring).
- Apify cumulative > $5 during sampling, or any single run estimated > $10.
- A work order you are drafting reveals a question that needs the user's input — pause and ask in chat rather than guess.
- Schema change that invalidates existing snapshots beyond the stable-ID migration.

## 6. First action

After §0 finishes:

1. Post in chat: "MODE = <MAC|SANDBOX>, HEAD = <sha>, planning pass starting".
2. Write a TodoWrite with these top-level items: `[plan-M0, plan-M2, plan-M3, plan-M4, plan-M6, plan-M9, plan-M10A-write-doc, plan-M11, plan-M12, write-EXECUTION_PLAN, write-EXECUTION_KICKOFF]`. Set the first relevant one in_progress.
3. Begin investigation. Take your time on extra-high — the cheaper next session depends on this one being thorough.
```
