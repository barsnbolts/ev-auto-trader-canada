# Caveman-Review Code Review Guide

This is a style guide for ultra-compressed, terse code review comments that prioritize signal over noise.

## Core Format

Comments follow the pattern: `L<line>: <problem>. <fix>.` with optional file prefixes for multi-file diffs. Severity prefixes (`🔴 bug:`, `🟡 risk:`, `🔵 nit:`, `❓ q:`) indicate priority levels.

## Key Principles

**Eliminate filler language:** Remove phrases like "I noticed that," "You might want to consider," or "This is just a suggestion." These add nothing actionable.

**Include essentials:** Exact line numbers, symbol names in backticks, and concrete fixes. The "why" matters only when the fix isn't self-evident.

**Avoid restating code:** Reviewers can read the diff themselves—focus on the problem and solution.

**One finding per line:** No multi-comment rambling.

## Exception: Context Matters

For security issues (CVE-level), architectural disagreements, or reviews of newer team members, switch to full explanatory prose. Resume terse style afterward.

## Scope Limitations

This tool generates review comments only—it doesn't write fixes, approve/reject PRs, or run linters. Output is ready to paste directly into the PR.
