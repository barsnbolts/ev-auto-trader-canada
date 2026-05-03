# Agent orchestration best-practices (2026-05-02)

> Research synthesized from Anthropic Claude Code Agent SDK docs + 2026
> community wisdom. Saved here because the dispatched Sonnet research
> subagent couldn't write to this directory directly (its sandbox cwd was
> `EV dashboard`, not `ev-auto-trader-canada`).

## TL;DR — highest-leverage rules

1. **Default subagent model = `sonnet`.** Pass `model: "sonnet"` on every Agent dispatch unless the task genuinely needs Opus reasoning (architecture, judgment, cross-file refactor). Saves ~5× cost. `haiku` for read-only Explore tasks.
2. **Subagent prompt MUST be self-contained.** Parent conversation history NEVER transfers. Required fields: exact file paths, schema snippets, expected output format, success criterion. Omitting = #1 failure mode.
3. **Parallel dispatch only when ≥3 independent tasks with ZERO shared files.** Each spawn costs ~5-15k bootstrapping tokens. Below ~10k of actual work, parallel costs more than sequential.
4. **Never let two subagents write to the same file simultaneously.** Use staging files (`/tmp/foo.staging.json`) or sequence them. For this project: `data/incentives.json`, `src/components/InventoryTable.tsx` are collision hotspots — single owner per dispatch.
5. **Subagents CANNOT spawn sub-subagents.** Max nesting = parent → subagent only.
6. **Set `maxTurns` cost guard.** 10-25 for research, 25-50 for implementation. Anthropic documented a runaway: 887k tokens/min from 23 unguarded subagents.
7. **Resume over respawn for iterative follow-ups on same data.** Use SendMessage with the agent ID. Fresh spawn only when context exceeds ~600k tokens or task is genuinely new.
8. **Agent Teams (multi-agent collaboration) are experimental + default-disabled + 7× token multiplier.** Skip. Stick with single subagents + the project's `milestone.py` ritual.

## Prompt structure that works

A well-formed subagent prompt has these sections in order:

```
1. Role + project context (1-2 sentences)
2. Project root path + today's date
3. Task goal (1 sentence)
4. Files involved with file:line refs
5. Inputs available + canonical paths
6. Decision rules / constraints
7. Output format (exact)
8. Verification commands
9. Boundary: what NOT to touch
```

**Token sweet spot**: 500-1500 tokens. Too short = subagent under-investigates. Too long = burns prompt-cache tokens before any actual work.

## Anti-patterns

| Failure | Symptom | Mitigation |
|---|---|---|
| Vague prompt | Subagent dumps generic best-practices, never reads project files | Include exact file:line refs and a verification command |
| Over-broad scope | Subagent returns 30k tokens of "considered alternatives" | Set `maxTurns` + "report ≤200 words" |
| Hallucinated file paths | Subagent edits a file that doesn't exist or has different layout | Ask for `ls` or `Read` first; verify in the prompt |
| Same-file parallel dispatch | Last-writer-wins; first subagent's work is silently overwritten | Sequence OR consolidate to one owner per file |
| Missing success criterion | Subagent stops at "looks done"; doesn't run predeploy | Add explicit verification command with expected output |
| Subagent runs Opus by default | 5× cost burned on mechanical work | Always pass `model: "sonnet"` |

## When subagent vs inline

**Use subagent when:**
- Task is ≥10 min of work
- Self-contained (parent doesn't need real-time visibility)
- Parent context is bloating (subagent fresh-context isolation actively saves tokens)
- Mechanical loop with many similar lookups (data fill, scrape, batch UI)

**Keep inline when:**
- <5 min work
- Cross-file judgment with shared context
- Architectural decisions
- Anywhere parent context is small + cache-warm

## Specific to ev-auto-trader-canada

- **Phase B parallel dispatch (M10 data + UI batch)**: SAFE because B1 (incentives.json) and B2 (multiple .tsx files) share NO files. Verified: data/incentives.json is data; .tsx files are code. No overlap.
- **Phase B previous plan (3 subagents): COLLISION** — old B2 and B3 both touched `InventoryTable.tsx`. Consolidated to single B2 owning all UI work.
- **Phase C data fill + math wiring**: SAFE if sequenced. C1 writes `data/incentives.json`, C2 reads that file + writes `src/lib/scoring.ts` + UI tsx. No overlap if sequenced.
- **Audit subagent (Phase A6)**: read-only across the entire repo. No collisions possible. Always safe.

## Tool restrictions per agent type

| Type | Tools | When to use |
|---|---|---|
| `Explore` | Read-only (no Edit/Write/Bash-write) | Codebase searches, "where is X defined", quick lookups. CHEAP. |
| `general-purpose` | All tools (incl Edit/Write/Bash) | Standard data fill, code edits, multi-step tasks |
| `Plan` | Returns plans, doesn't execute | High-level design before commit |
| `statusline-setup`, `code-reviewer`, etc. | Niche, restricted toolsets | Use when their narrow scope matches |

## SendMessage vs fresh spawn

**SendMessage to existing agent:**
- Cache-warm: prior tool results stay loaded
- Cheaper for follow-up Q&A on the same domain
- Subagent ID returned in original spawn result (e.g., `a64f844b388a78310`)

**Fresh spawn:**
- New context, no carryover
- Required when topic shifts genuinely
- Required when prior agent's context exceeds ~600k tokens

For this project: probably never SendMessage. Each phase is distinct enough that fresh context is the right call.
