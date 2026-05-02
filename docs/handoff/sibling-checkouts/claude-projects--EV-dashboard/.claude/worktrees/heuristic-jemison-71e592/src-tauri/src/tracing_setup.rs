// Tracing setup for Rust side. Writes rolling daily log to logs/debug/rust.log.
// Enabled only when EV_DEBUG env var is set; otherwise silent.

use std::path::PathBuf;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{fmt, EnvFilter};

/// Initialises tracing. Returns a guard that must be kept alive for the life
/// of the process; dropping it flushes the appender.
///
/// When `EV_DEBUG` is unset, returns `None` (no-op — silent).
pub fn init() -> Option<WorkerGuard> {
    if std::env::var("EV_DEBUG").is_err() {
        return None;
    }

    let log_dir = log_dir();
    std::fs::create_dir_all(&log_dir).ok()?;

    let file_appender = RollingFileAppender::new(Rotation::DAILY, &log_dir, "rust.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    let filter = EnvFilter::try_from_env("EV_DEBUG_LEVEL")
        .unwrap_or_else(|_| EnvFilter::new("info,ev_dashboard=debug"));

    let _ = fmt()
        .with_env_filter(filter)
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_target(true)
        .try_init();

    Some(guard)
}

/// Resolve `logs/debug/` relative to project root. In a Tauri bundle the CWD
/// may be the app bundle, so we walk up until we find a Cargo.toml or bail to
/// a user-local path. Good-enough heuristic for personal use.
fn log_dir() -> PathBuf {
    if let Ok(cwd) = std::env::current_dir() {
        let mut p = cwd.clone();
        for _ in 0..6 {
            if p.join("Cargo.toml").exists() || p.join("package.json").exists() {
                return p.join("logs").join("debug");
            }
            if !p.pop() {
                break;
            }
        }
    }
    // Fallback to a per-user location.
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home)
        .join("Library")
        .join("Logs")
        .join("ev-dashboard")
}
