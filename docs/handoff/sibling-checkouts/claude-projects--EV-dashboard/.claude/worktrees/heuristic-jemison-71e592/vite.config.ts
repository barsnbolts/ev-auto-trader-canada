import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

// Appends POSTed debug events to logs/debug/<YYYY-MM-DD>.jsonl.
// Only runs in dev server. No-op in production build. Client-side is gated by
// VITE_DEBUG — this plugin will simply see no traffic when VITE_DEBUG=0.
function debugLogSink(): Plugin {
  return {
    name: "ev-dashboard-debug-log-sink",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__debug_log", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          try {
            const body = Buffer.concat(chunks).toString("utf8");
            // Validate parseable JSON; reject malformed to avoid polluting the log.
            JSON.parse(body);
            const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            const dir = join(process.cwd(), "logs", "debug");
            mkdirSync(dir, { recursive: true });
            appendFileSync(join(dir, `${date}.jsonl`), body + "\n", "utf8");
            res.statusCode = 204;
            res.end();
          } catch (err) {
            res.statusCode = 400;
            res.end(String(err));
          }
        });
        req.on("error", () => {
          res.statusCode = 500;
          res.end();
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), debugLogSink()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "esnext",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
