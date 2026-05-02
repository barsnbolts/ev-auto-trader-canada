import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const artifactsDir = path.join(rootDir, 'artifacts');

fs.mkdirSync(artifactsDir, { recursive: true });

const htmlPath = path.join(artifactsDir, 'offline-preview.html');
const zipPath = path.join(artifactsDir, 'ev-auto-trader-canada-offline.zip');
const dataPath = path.join(rootDir, 'data', 'vehicles.sample.json');

const payload = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const vehicles = Array.isArray(payload.vehicles) ? payload.vehicles : [];

const rows = vehicles.map((v) => `<tr><td>${v.year}</td><td>${v.make}</td><td>${v.model}</td><td>${v.priceCad}</td><td>${v.rangeKm ?? 'Missing'}</td></tr>`).join('\n');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>EV Auto Trader Canada - Offline Snapshot</title>
<style>body{font-family:system-ui,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}</style>
</head>
<body>
<h1>EV Auto Trader Canada — Offline Snapshot</h1>
<p>Everything is in this repository: data + scripts + launcher + docs.</p>
<p>Live preview command: <code>npm run preview:offline</code></p>
<table><thead><tr><th>Year</th><th>Make</th><th>Model</th><th>MSRP (CAD)</th><th>Range (km)</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;

fs.writeFileSync(htmlPath, html);

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

execFileSync('zip', [
  '-r',
  zipPath,
  '.',
  '-x',
  '.git/*',
  'artifacts/*'
], { cwd: rootDir, stdio: 'inherit' });

console.log(`Wrote artifact HTML: ${htmlPath}`);
console.log(`Wrote artifact ZIP: ${zipPath}`);
