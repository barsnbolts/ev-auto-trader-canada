# EV Auto Trader Canada

Native macOS EV research app for Apple Silicon, built with SwiftUI, SQLite, and a local-first sync pipeline.

Current live-data path: Ford Canada Mustang Mach-E and Volkswagen Canada ID.4 inventory are wired through the sync pipeline. Active work stays tracked in `PLAN.md`; proof limits stay tracked in `TESTING.md`.

## Start Here
- Source of truth: `PLAN.md`
- Operating rules: `AGENTS.md`
- Setup: `SETUP.md`
- Testing proof limits: `TESTING.md`
- Parked issues: `ISSUE_LOG.md`

## Quickstart

Run:

```bash
./script/build_and_run.sh
```

Verify launch:

```bash
./script/build_and_run.sh --verify
```

Build:

```bash
CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift build --product EVAutoTraderApp
```

Test:

```bash
CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift test
```
