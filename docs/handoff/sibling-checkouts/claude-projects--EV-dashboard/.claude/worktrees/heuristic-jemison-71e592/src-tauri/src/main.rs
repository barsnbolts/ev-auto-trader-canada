// Prevents additional console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod thermal;
mod tracing_setup;
mod trip_planner;

fn main() {
    // Keep the tracing guard alive for the duration of the process; dropping
    // it flushes the appender. When EV_DEBUG is unset this is None (no-op).
    let _tracing_guard = tracing_setup::init();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            thermal::compute_thermal,
            trip_planner::plan_trip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
