# Sandbox Limits — what cannot be done from `/home/user/ev-auto-trader-canada`

## Filesystem

- `/Users/ianmcadam/...` does not exist. The Mac filesystem is not
  mounted; no NFS, SMB, SSH, FUSE, or 9p bridge.
- `~` resolves to `/root` in this container, not the user's Mac home.
- Only outbound network: GitHub git remote via local proxy at
  `127.0.0.1:33049`.

## Missing MCPs

- **Chrome MCP** (`mcp__Claude_in_Chrome__*`) — required for live
  browser probes (M0 GraphQL capture, M12 trim configurator fallback)
- **Apify MCP** (`mcp__Apify__*`) — required for paid scrapes
  (M2 ON+H/K, M12 daysOnMarket fallback)
- **scheduled-tasks MCP** (`mcp__scheduled-tasks__create_scheduled_task`)
  — required for OS-level cron registration (M11, M14)

## Missing Superpowers skills

The Superpowers plugin is not installed in the sandbox. References to
`/superpowers:brainstorm` etc. in repo docs cannot be invoked. The
content those skills produced (e.g. the M0→M12 plan) lives only on the
Mac and was never committed.

## Available MCPs

- GitHub (full)
- Gmail
- Google Calendar
- Notion
- **Exa** (`mcp__9a04470a__web_search_exa`, `web_fetch_exa`) ← key for
  M9, M12, M13
- Google Drive
