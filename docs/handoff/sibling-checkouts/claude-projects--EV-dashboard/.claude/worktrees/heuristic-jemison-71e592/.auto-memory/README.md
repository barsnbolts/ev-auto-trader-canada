# .auto-memory/

Cross-session memory for this project, checked into git so it survives fresh clones and is visible to any future Claude session regardless of which user account runs the build.

Four files, each scoped to one kind of memory (mirrors the file-based memory convention at `~/.claude/projects/<project>/memory/`):

- `user.md` — who Ian is, how to collaborate with him
- `feedback.md` — confirmed preferences and corrections
- `project.md` — scope, finish line, architectural decisions, risks
- `reference.md` — external APIs, data sources, docs this project depends on

**Editing rules:**
- Keep entries terse (caveman style OK here — these are internal artifacts).
- Append-only for corrections/decisions; never delete history.
- If an entry becomes obsolete, mark it with `~~strikethrough~~` + reason, don't erase.
- `scripts/self_audit.py` (every 5 milestones) prunes truly-stale entries.
