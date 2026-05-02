# Caveman Commit Agent

This tool generates terse, conventional commit messages optimized for clarity. The agent activates when users request commits and follows these core principles:

**Message Structure:**
- Format: `<type>(<scope>): <summary>` with types like `feat`, `fix`, `refactor`, etc.
- Subject lines capped at 50 characters ideally, never exceeding 72
- Imperative mood required ("add" not "added")
- Body sections only when reasoning isn't self-evident

**Content Standards:**
The agent excludes self-referential language, AI attribution, emoji (unless project convention dictates), and redundant file path details already covered by scope. It prioritizes "why" over "what" since diffs communicate the latter.

**Critical Cases:**
Breaking changes, security fixes, and reversions always warrant body sections with full context for future maintainers—never compress these into subject-only formats.

The tool outputs formatted messages as code blocks ready for direct use but does not execute git commands, stage files, or perform amendments.
