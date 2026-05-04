// Tauri 2 entry point for EV Auto Trader Canada — macOS personal-use shell.
// Phase A: bundles the Next.js static export and exposes plugin-fs +
// plugin-shell to the WebView. No custom Rust commands yet — runtime data
// reads use plugin-fs scoped to $HOME/ev-auto-trader-canada/data/**/*.
//
// Phase B (deferred) wires custom commands for refresh + verify; the
// generate_handler! macro below is the single place to register them.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
