# TESTING.md

## Proof Matrix
- compile proof: `CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift build --product EVAutoTraderApp`
- launch proof: `./script/build_and_run.sh --verify`
- runtime event evidence: `./script/build_and_run.sh --telemetry`
- smoke/build signal: `./script/build_and_run.sh`
- package-test build signal: `CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift test`
- runtime assertion proof: not confirmed in the current environment

## Current Rules
- Use `swift build` for every control/doc/source checkpoint unless a queue item says otherwise.
- Use `--verify` only when launch/runtime behavior changed.
- Use `--telemetry` only when lifecycle or sync log evidence is the question.
- Use `swift test` only at meaningful batch boundaries; do not claim runtime assertion execution from it yet.
- Never run SwiftPM build/test/launch verification in parallel.
- Treat Ford live-price gaps as source-data/MSRP-fallback notes unless refresh behavior breaks.
- Treat `swift test list` as unreliable for assertion proof here; a clean exit can still produce build/enumeration-level output only.

## Unknown Or Unproven
- `swift test` runtime assertion execution is not proven here.
- `swift test list` did not provide reliable runtime assertion proof here.
- `xcrun --find xctest` was unavailable in the active Command Line Tools environment.
