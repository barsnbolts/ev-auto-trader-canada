// Tauri 2 entry point for EV Auto Trader Canada — macOS personal-use shell.
//
// Phase A: bundles the Next.js static export and exposes plugin-fs +
// plugin-shell to the WebView. plugin-fs is scoped to
// $HOME/ev-auto-trader-canada/data/**/* via capabilities/main.json.
//
// Phase B (this commit): adds two custom Rust commands so the dossier
// "Verify availability" chip and the "Refresh inventory" modal can drive
// long-running scripts that live in the user's repo:
//   - run_verify_unit(unit_id) — spawns scripts/verify_unit.py, returns
//     the script's JSON stdout. Synchronous. ~5 second budget.
//   - run_refresh() — spawns scripts/refresh_daily.sh asynchronously and
//     streams every stdout/stderr line over the `refresh-log` event
//     channel so the React modal can render a live log. Returns when
//     the script exits; non-zero exit propagates as Err to JS.
//
// Both commands resolve the repo root from $HOME/ev-auto-trader-canada
// (matches the plugin-fs capability scope). If the user moves the repo,
// edit REPO_REL below.

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;

use serde::Serialize;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager};

const REPO_REL: &str = "ev-auto-trader-canada";

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn repo_root() -> Result<PathBuf, String> {
    home_dir()
        .map(|h| h.join(REPO_REL))
        .ok_or_else(|| "HOME not set".to_string())
}

#[derive(Clone, Serialize)]
struct RefreshLogLine {
    ts: String,
    level: String,
    message: String,
}

fn now_iso() -> String {
    use std::time::SystemTime;
    let dur = SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    // simple ISO-ish timestamp; consumer just renders as-is
    let secs = dur.as_secs();
    let h = (secs / 3600) % 24;
    let m = (secs / 60) % 60;
    let s = secs % 60;
    format!("{:02}:{:02}:{:02}", h, m, s)
}

#[tauri::command]
fn set_dock_badge(count: Option<u64>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use objc2::rc::autoreleasepool;
        use objc2_app_kit::NSApplication;
        use objc2_foundation::{MainThreadMarker, NSString};

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
    let _ = count; // suppress unused-warn on non-macOS
    Ok(())
}

#[tauri::command]
fn run_verify_unit(unit_id: String) -> Result<String, String> {
    let root = repo_root()?;
    let script = root.join("scripts").join("verify_unit.py");
    if !script.exists() {
        return Err(format!("verify script missing: {}", script.display()));
    }
    let output = Command::new("python3")
        .arg(&script)
        .arg(&unit_id)
        .current_dir(&root)
        .output()
        .map_err(|e| format!("spawn failed: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("verify_unit.py exit {:?}: {stderr}", output.status.code()));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn run_refresh(app: AppHandle) -> Result<(), String> {
    let root = repo_root()?;
    let script = root.join("scripts").join("refresh_daily.sh");
    if !script.exists() {
        return Err(format!("refresh script missing: {}", script.display()));
    }

    let mut child = Command::new("bash")
        .arg(&script)
        .current_dir(&root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn failed: {e}"))?;

    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;

    // Stream stdout
    let app_out = app.clone();
    let out_handle = thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            let _ = app_out.emit(
                "refresh-log",
                RefreshLogLine {
                    ts: now_iso(),
                    level: "info".into(),
                    message: line,
                },
            );
        }
    });

    // Stream stderr
    let app_err = app.clone();
    let err_handle = thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            let _ = app_err.emit(
                "refresh-log",
                RefreshLogLine {
                    ts: now_iso(),
                    level: "warn".into(),
                    message: line,
                },
            );
        }
    });

    let status = child.wait().map_err(|e| format!("wait failed: {e}"))?;
    let _ = out_handle.join();
    let _ = err_handle.join();

    if status.success() {
        let _ = app.emit(
            "refresh-log",
            RefreshLogLine {
                ts: now_iso(),
                level: "info".into(),
                message: "Refresh complete.".into(),
            },
        );
        Ok(())
    } else {
        Err(format!("refresh_daily.sh exit {:?}", status.code()))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![run_verify_unit, run_refresh, set_dock_badge])
        .setup(|app| {
            // Bring the main window to front on launch (helps when the
            // WebView is slow to paint on cold start).
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }

            // Native macOS menu — adds a "File" submenu with a Refresh
            // item bound to Cmd+R. Standard App / Edit / Window / Help
            // submenus are added via the SubmenuBuilder presets so the
            // app feels like a normal Mac app (Cmd+H hide, Cmd+Q quit,
            // Cmd+M minimize, copy/paste, etc.).
            let refresh = MenuItemBuilder::new("Refresh Inventory")
                .id("file_refresh")
                .accelerator("CmdOrCtrl+R")
                .build(app)?;
            let file_submenu = SubmenuBuilder::new(app, "File")
                .item(&refresh)
                .build()?;
            let menu = MenuBuilder::new(app)
                .items(&[
                    &SubmenuBuilder::new(app, "EV.trader CA")
                        .about(None)
                        .separator()
                        .services()
                        .separator()
                        .hide()
                        .hide_others()
                        .show_all()
                        .separator()
                        .quit()
                        .build()?,
                    &file_submenu,
                    &SubmenuBuilder::new(app, "Edit")
                        .undo()
                        .redo()
                        .separator()
                        .cut()
                        .copy()
                        .paste()
                        .select_all()
                        .build()?,
                    &SubmenuBuilder::new(app, "Window")
                        .minimize()
                        .maximize()
                        .close_window()
                        .build()?,
                ])
                .build()?;
            app.set_menu(menu)?;

            // Dispatch menu events. Currently just routes file_refresh →
            // run_refresh in a background thread so the UI stays live.
            app.on_menu_event(move |app_handle, event| {
                if event.id() == "file_refresh" {
                    let h = app_handle.clone();
                    thread::spawn(move || {
                        let _ = run_refresh(h);
                    });
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
