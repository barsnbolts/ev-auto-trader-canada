# Dock badge — concrete recipe (mechanical apply)

> **Phase C item from TODO_INDEX.** Replaces the no-op stub at
> `src-tauri/src/lib.rs:62` with a real NSDockTile binding via objc2.
> ~5k tokens. ~30 minutes including Tauri rebuild.
>
> Frontend wiring is already done (DockBadgeSync.tsx mounts in layout,
> tauriRuntime.ts forwards to invoke). Only Rust changes.

## Step 1 — Cargo.toml

Append to `src-tauri/Cargo.toml` after the `[dependencies]` section:

```toml
[target.'cfg(target_os = "macos")'.dependencies]
objc2 = "0.5"
objc2-app-kit = "0.2"
objc2-foundation = "0.2"
```

## Step 2 — lib.rs

Replace the `set_dock_badge` body in `src-tauri/src/lib.rs:61-82` with:

```rust
#[tauri::command]
fn set_dock_badge(count: Option<u64>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use objc2::rc::autoreleasepool;
        use objc2_app_kit::NSApplication;
        use objc2_foundation::{NSString, MainThreadMarker};

        let mtm = MainThreadMarker::new()
            .ok_or_else(|| "set_dock_badge must run on main thread".to_string())?;

        autoreleasepool(|_| {
            let app = NSApplication::sharedApplication(mtm);
            let dock_tile = unsafe { app.dockTile() };
            let label = match count {
                Some(n) if n > 0 => Some(NSString::from_str(&n.to_string())),
                _ => None,
            };
            unsafe { dock_tile.setBadgeLabel(label.as_deref()) };
        });
    }
    let _ = count;  // suppress unused-warn on non-macOS
    Ok(())
}
```

## Step 3 — Verify compile

```bash
cd ~/ev-auto-trader-canada
cd src-tauri
cargo check --target aarch64-apple-darwin 2>&1 | tail -20
```

Expected: `Finished` with no errors. If `setBadgeLabel:` signature
doesn't match, the objc2-app-kit version may have updated — check
`https://docs.rs/objc2-app-kit/latest/objc2_app_kit/struct.NSDockTile.html`
for the current method name and adjust.

## Step 4 — Build + test

```bash
cd ~/ev-auto-trader-canada
npx tauri build --target aarch64-apple-darwin 2>&1 | tail -20
open "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/EV.trader CA.app"
```

Inside the app, the badge should reflect the value `DockBadgeSync` is
posting (count of new listings since last open). To force a non-zero
test value, edit `src/components/DockBadgeSync.tsx` to hardcode `42`,
rebuild, watch the dock icon — should show "42" in red circle.

## Step 5 — Commit

```bash
cd ~/ev-auto-trader-canada
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs
git commit -m "feat(tauri): NSDockTile badge — Phase C dock badge shipped

Replaces no-op stub with objc2-app-kit binding. Reflects new-listings
count posted by DockBadgeSync.tsx. macOS-only; non-macOS targets stay no-op."
git push origin HEAD
```

Append to `docs/handoff/TAURI_BUILD_LOG.md`:

```
- 2026-05-XX: Phase C dock badge shipped (NSDockTile via objc2). HEAD <sha>.
```

## Fallback if objc2-app-kit setBadgeLabel signature has drifted

Some versions of objc2-app-kit name it `setBadgeLabel_` (trailing underscore)
or expose it via a different protocol. If `cargo check` fails on the call:

```rust
// Alternative: use raw msg_send! macro
use objc2::msg_send;
unsafe {
    let _: () = msg_send![&*dock_tile, setBadgeLabel: label.as_deref()];
}
```

Or fall back to a NSAutoreleasePool + manual NSString construction. The
key insight is the binding must run on the main thread (hence the
`MainThreadMarker` check).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Compile error: `unresolved import objc2_app_kit::NSApplication` | objc2-app-kit version too old/new | Check docs.rs, adjust version |
| Compile error: `setBadgeLabel takes Option<&NSString>` | Signature changed | Pass `label.as_deref()` (already in snippet) |
| App builds but badge never shows | `DockBadgeSync` not invoking | Check React DevTools → confirm component mounted |
| Badge shows count then disappears | `count: null` being passed | DockBadgeSync should debounce + only post non-zero |
| Build fails with "must run on main thread" | Tauri command running off main thread | Wrap with `app.run_on_main_thread(...)` |

## Why this was a stub before

Tauri 2.11's `AppHandle` did not expose a `set_badge_count` method (we
verified by reading tauri 2.11 sources). The objc2 binding is the
canonical workaround. Future Tauri may add a native API; this recipe
will need a one-line swap when that lands.
