---
name: Ian McAdam profile
description: Ian's role, background, preferences, and how to collaborate with him effectively
type: user
originSessionId: d92199a2-b04d-4c16-8bc7-83b46b7a1128
---
# Who Ian is

- **First coding project ever.** Everything here is net-new territory for him — TypeScript, React, Tauri, Zustand, Vite, Python scripts, git, hooks, tests. Scaffold was built by Claude in Cowork; Ian is driving the roadmap but not writing code himself.
- **First-time EV buyer, Ontario.** Replacing an ICE vehicle. Shopping seriously. This app is a real purchase-decision tool, not a portfolio piece.
- **Second user: his mom.** She'll use the app alongside him. Has some accessibility considerations (specifics to be gathered at Cluster F checkpoint — low vision? motor? cognitive? plain-language preference?).
- **Works in Cowork.** The project is built under a workspace mount with Claude-in-Chrome, Exa, computer-use, scheduled tasks, and sub-agents available.

# How to collaborate with Ian

- **Hold his hand on concepts.** When a new technical term comes up (Zustand, HMR, localStorage, tsc, Vite, Tailwind, etc.) define it plainly the first time it appears in his view. Don't assume foundation.
- **He rambles when he's thinking.** Extract intent — don't latch onto exact words. Before acting on a fuzzy request, restate what you heard in plain English and confirm.
- **Plain English for user-facing writing.** Recaps, explanations, questions → plain sentences a non-coder can follow. Caveman style ONLY for internal artifacts (commits, scripts, LEARNINGS mechanical entries, queue items).
- **Aggressive in-cluster autonomy.** He wants me to decide and move within a cluster, only stopping for architectural/irreversible choices or cluster boundaries. See plan §1.6 for the specific autonomy rules.
- **Token efficiency matters.** He asked for caveman-style internal writing, sub-agent delegation, cache-friendly docs, and a self-optimization loop every 5 milestones. This is a real constraint, not a suggestion.
- **Reasoning model strategy.** Sonnet 4.6 as default for 70–80% of the work; Opus 4.7 for architectural decisions, user-facing recaps, review sweeps, data-source conflict resolution.
- **Cluster recaps are a learning moment.** Each cluster recap introduces at most one new technical concept, and should be written so Ian learns *why* we did the work, not just that we did it.

# How Ian likes decisions presented

- When offering options, pick a recommended default and state the tradeoff in one sentence, not a decision matrix.
- When asking a blocking question, use AskUserQuestion with 2–4 options, not open-ended prose.
- When something is reversible in ≤15 minutes, don't ask — just do it and mention the default chosen.
