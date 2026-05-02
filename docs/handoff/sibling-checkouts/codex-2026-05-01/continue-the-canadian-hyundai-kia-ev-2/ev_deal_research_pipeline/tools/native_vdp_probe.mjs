import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const targetsPath = new URL('../staging/benchmark_targets.tsv', import.meta.url);
const outDir = new URL('../outputs/', import.meta.url);
const rawDir = new URL('../sources/raw_pages/', import.meta.url);

function parseTsv(text) {
  const [header, ...rows] = text.trim().split(/\r?\n/).map((line) => line.split('\t'));
  return rows.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])));
}

function cleanText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function first(regex, text) {
  const match = text.match(regex);
  return match?.[1]?.trim() ?? '';
}

function attr(id, html) {
  return first(new RegExp(`<data\\s+id=["']${id}["']\\s+value=["']([^"']*)["']`, 'i'), html);
}

function inputByField(name, html) {
  return first(new RegExp(`data-field-name=["']${name}["'][^>]*value=["']([^"']*)["']`, 'i'), html);
}

function itemprop(name, html) {
  return first(new RegExp(`itemprop=["']${name}["'][^>]*>([^<]+)`, 'i'), html);
}

function moneyNear(label, text) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`${escaped}\\s*[:#]?\\s*\\$?([0-9][0-9,]*(?:\\.\\d{2})?)`, 'i'),
    new RegExp(`${escaped}[\\s\\S]{0,80}?\\$([0-9][0-9,]*(?:\\.\\d{2})?)`, 'i'),
  ];
  for (const pattern of patterns) {
    const value = first(pattern, text);
    if (value) return value.replace(/,/g, '');
  }
  return '';
}

function detect(html, text, target) {
  const vin = (attr('vin', html) || first(/\bVIN\s*#?:?\s*([A-HJ-NPR-Z0-9]{17})\b/i, text) || first(/\b([A-HJ-NPR-Z0-9]{17})\b/i, text)).toUpperCase();
  const stock = attr('stock', html) || inputByField('stock-number', html) || first(/Stock\s*(?:#|:|Number)?\s*([A-Z0-9-]{3,20})/i, text);
  const make = attr('make', html) || inputByField('make', html) || itemprop('brand', html) || first(/\bMake:\s*([A-Za-z]+)/i, text);
  const model = attr('model', html) || inputByField('model', html) || itemprop('model', html) || target.model.replace(/^Hyundai |^Kia /, '');
  const year = attr('year', html) || inputByField('year', html) || itemprop('releaseDate', html) || first(/\b(20[0-9]{2})\b/, text);
  const trim = attr('trim', html) || itemprop('trim', html) || first(/\bTrim:\s*([A-Za-z0-9 +/-]{2,40})/i, text);
  const ogTitle = first(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i, html);
  const title = ogTitle || first(/(?:New|Used)\s+((?:20[0-9]{2})\s+(?:Hyundai|Kia)[^|<\n]{3,80})/i, text) || [year, make, model, trim].filter(Boolean).join(' ');
  const msrp = moneyNear('MSRP', text);
  const dealerPrice = attr('price', html) || first(/data-price\s*=\s*["']?\s*([0-9]+(?:\.[0-9]+)?)/i, html) || moneyNear('Dealer Price', text) || moneyNear('Purchase Price', text) || moneyNear('Price', text);
  const adminFee = first(/Admin Fee:\s*<\/p>\s*<span>\+\s*\$([0-9][0-9,]*(?:\.\d{2})?)/i, html)?.replace(/,/g, '') || first(/\$([0-9][0-9,]*(?:\.\d{2})?)\s+admin fee/i, text)?.replace(/,/g, '') || moneyNear('Admin Fee', text);
  const omvic = first(/OMVIC:\s*<\/p>\s*<span>\+\s*\$([0-9][0-9,]*(?:\.\d{2})?)/i, html)?.replace(/,/g, '') || first(/\$([0-9][0-9,]*(?:\.\d{2})?)\s+OMVIC Fee/i, text)?.replace(/,/g, '') || moneyNear('OMVIC', text);
  const sold = /\bSold\b/i.test(text);
  const newStatus = /\bNew\b/i.test(text) && !sold;
  const dealer =
    first(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i, html).replace(/&#039;/g, "'") ||
    first(/\b(Pathway Hyundai|Neddy'?s North Bay Hyundai|Orl[ée]ans Kia)\b/i, text) ||
    first(/\bat\s+([A-Z][A-Za-z' -]{3,40}(?:Hyundai|Kia))\b/, text);
  const city =
    first(/\b(?:in|at)\s+([A-Z][A-Za-z' -]+),\s*(?:Ontario|ON)\b/i, text) ||
    first(/\b(Orleans|Orléans|North Bay),\s*(?:Ontario|ON)\b/i, text);
  const exterior = attr('color', html) || first(/Exterior (?:Color|Colour):?\s*([A-Za-z0-9 -]{3,40})/i, text);
  const interior = first(/Interior (?:Color|Colour):?\s*([A-Za-z0-9 -]{3,40})/i, text);

  let verdict = 'REJECT';
  let failure = '';
  if (!vin) failure = 'VIN_MISSING';
  else if (!dealerPrice) failure = 'PRICE_MISSING';
  else if (!msrp) failure = 'MSRP_MISSING';
  else if (sold) failure = 'SOLD';
  else verdict = 'ACCEPT_CANDIDATE';

  return {
    id: target.id,
    tool: 'Native Node fetch',
    model: target.model,
    url: target.url,
    success: vin || dealerPrice || msrp ? 'YES' : 'NO',
    verdict,
    failure,
    vin,
    stock,
    title,
    make,
    year,
    trim,
    dealer,
    city,
    province: /Ontario|\bON\b/i.test(text) ? 'Ontario' : '',
    listing_status: sold ? 'SOLD' : newStatus ? 'NEW_AVAILABLE' : '',
    asking_price_cad: dealerPrice,
    msrp_cad: msrp,
    admin_fee_cad: adminFee,
    omvic_fee_cad: omvic,
    exterior_colour: exterior,
    interior_colour: interior,
    evidence: text.slice(0, 600),
    bytes: html.length,
  };
}

function toTsv(rows) {
  const header = [
    'id', 'tool', 'model', 'success', 'verdict', 'failure', 'vin', 'stock', 'title', 'make', 'year', 'trim',
    'dealer', 'city', 'province', 'listing_status', 'asking_price_cad', 'msrp_cad',
    'admin_fee_cad', 'omvic_fee_cad', 'exterior_colour', 'interior_colour', 'runtime_ms',
    'bytes', 'url'
  ];
  const esc = (value) => String(value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
  return [header.join('\t'), ...rows.map((row) => header.map((key) => esc(row[key])).join('\t'))].join('\n') + '\n';
}

await mkdir(outDir, { recursive: true });
await mkdir(rawDir, { recursive: true });

const targets = parseTsv(await readFile(targetsPath, 'utf8'));
const results = [];

for (const target of targets) {
  const started = performance.now();
  try {
    const response = await fetch(target.url, {
      headers: {
        'user-agent': 'Mozilla/5.0 research-benchmark/1.0',
        'accept': 'text/html,application/xhtml+xml',
      },
    });
    const html = await response.text();
    await writeFile(new URL(`${target.id}.html`, rawDir), html);
    const text = cleanText(html);
    const row = detect(html, text, target);
    row.runtime_ms = Math.round(performance.now() - started);
    if (!response.ok) {
      row.success = 'NO';
      row.verdict = 'REJECT';
      row.failure = `HTTP_${response.status}`;
    }
    results.push(row);
  } catch (error) {
    results.push({
      id: target.id,
      tool: 'Native Node fetch',
      model: target.model,
      url: target.url,
      success: 'NO',
      verdict: 'REJECT',
      failure: error.message,
      runtime_ms: Math.round(performance.now() - started),
      bytes: 0,
    });
  }
}

await writeFile(new URL('native_vdp_probe_results.tsv', outDir), toTsv(results));
console.log(toTsv(results));
