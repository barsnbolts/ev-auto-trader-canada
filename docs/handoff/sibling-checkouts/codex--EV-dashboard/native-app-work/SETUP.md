# SETUP.md

## Environment
- Platform: macOS
- App type: native SwiftUI app packaged from SwiftPM
- Active path in this repo: SwiftPM + `script/build_and_run.sh`
- Current developer environment seen during this project: Command Line Tools active, not full Xcode as the selected developer directory

## Commands
- Run app:
```bash
./script/build_and_run.sh
```

- Verify app launch:
```bash
./script/build_and_run.sh --verify
```

- Build app directly:
```bash
CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift build --product EVAutoTraderApp
```

- Test package:
```bash
CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift test
```

## Notes
- The build script is the easiest beginner-safe launch path.
- The direct `swift build` and `swift test` commands use a project-local clang module cache because that worked more reliably in this environment.
- The current live OEM path includes Ford Canada Mustang Mach-E and Volkswagen Canada ID.4 inventory; setup commands stay the same as product work continues.
- Full Xcode may still be helpful later for stronger macOS debugging and test verification, but it is not required for the current scaffold build path.
- There is no separate lint command currently configured in this repo.
- There is no standalone typecheck command currently configured in this repo; the build command is the current compile check.
