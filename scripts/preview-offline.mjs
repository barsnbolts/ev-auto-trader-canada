import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const sampleDataPath = path.join(rootDir, 'data', 'vehicles.sample.json');

const navSections = ['Inventory', 'Compare', 'Data Quality', 'Source Notes'];

function loadSampleVehicles() {
  const raw = fs.readFileSync(sampleDataPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.vehicles)) {
    throw new Error('Invalid sample data: expected "vehicles" array');
  }
  return parsed.vehicles;
}

function renderCurrency(amount) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(amount);
}

function summarize(vehicles) {
  return {
    totalVehicles: vehicles.length,
    missingRange: vehicles.filter((v) => v.rangeKm == null).length,
    missingLocation: vehicles.filter((v) => v.location == null).length,
    lastUpdated: new Date().toISOString()
  };
}

function renderHtml(vehicles, summary) {
  const cards = vehicles.map((v) => `
    <article class="card">
      <h3>${v.year} ${v.make} ${v.model}</h3>
      <p><strong>Price:</strong> ${renderCurrency(v.priceCad)}</p>
      <p><strong>Range:</strong> ${v.rangeKm == null ? 'Missing' : `${v.rangeKm} km`}</p>
      <p><strong>Location:</strong> ${v.location ?? 'Missing'}</p>
      <p><strong>Source:</strong> ${v.source}</p>
    </article>
  `).join('');

  const compareRows = vehicles.map((v) => `
    <tr>
      <td>${v.id}</td>
      <td>${v.make} ${v.model}</td>
      <td>${renderCurrency(v.priceCad)}</td>
      <td>${v.rangeKm == null ? '—' : `${v.rangeKm} km`}</td>
      <td>${v.location ?? '—'}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>EV Auto Trader Canada — Offline Preview</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; color: #0b1b33; background: #f5f8ff; }
    header { background: #0f2f61; color: white; padding: 1rem 1.25rem; }
    nav ul { display: flex; gap: 1rem; list-style: none; padding: 0; margin: .5rem 0 0; }
    main { padding: 1.25rem; display: grid; gap: 1rem; }
    section { background: white; border-radius: 10px; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .75rem; }
    .card { border: 1px solid #dbe5ff; border-radius: 8px; padding: .75rem; background: #fbfdff; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; border-bottom: 1px solid #e6ecff; padding: .5rem; }
    .notice { border-left: 4px solid #ffb020; background: #fff7e7; }
    .muted { color: #53617a; font-size: .9rem; }
  </style>
</head>
<body>
  <header>
    <h1>EV Auto Trader Canada — Offline Sample Preview</h1>
    <p class="muted">Everything is in this repository (data + preview server + launcher scripts).</p>
    <nav aria-label="Top sections">
      <ul>
        ${navSections.map((s) => `<li>${s}</li>`).join('')}
      </ul>
    </nav>
  </header>
  <main>
    <section id="inventory">
      <h2>Vehicle cards (sample data)</h2>
      <div class="cards">${cards}</div>
    </section>

    <section id="compare">
      <h2>Compare table</h2>
      <table>
        <thead><tr><th>ID</th><th>Vehicle</th><th>Price (CAD)</th><th>Range</th><th>Location</th></tr></thead>
        <tbody>${compareRows}</tbody>
      </table>
    </section>

    <section id="missing-data-summary">
      <h2>Missing-data summary</h2>
      <ul>
        <li>Total vehicles: ${summary.totalVehicles}</li>
        <li>Vehicles missing range: ${summary.missingRange}</li>
        <li>Vehicles missing location: ${summary.missingLocation}</li>
      </ul>
    </section>

    <section id="provenance" class="notice">
      <h2>Data provenance / sample mode</h2>
      <p>This page is running in no-install sample mode with data loaded from <code>data/vehicles.sample.json</code>.</p>
      <p>Sources shown in cards are sample feed labels and not live marketplace integrations.</p>
      <p class="muted">Updated at: ${summary.lastUpdated}</p>
    </section>
  </main>
</body>
</html>`;
}

function createServer() {
  return http.createServer((req, res) => {
    const vehicles = loadSampleVehicles();
    const summary = summarize(vehicles);

    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, ...summary }));
      return;
    }

    if (req.url === '/api/vehicles') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ vehicles }));
      return;
    }

    if (req.url === '/api/summary') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(summary));
      return;
    }

    if (req.url !== '/' && req.url !== '/index.html') {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }

    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(renderHtml(vehicles, summary));
  });
}

const preferredPort = Number(process.env.PORT || 3000);

function startServer(port, attemptsLeft = 10) {
  const server = createServer();

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      startServer(port + 1, attemptsLeft - 1);
      return;
    }

    console.error('Failed to start preview server:', err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`Offline preview running at http://localhost:${port}`);
    console.log('Press Ctrl+C to stop.');
  });
}

startServer(preferredPort);
