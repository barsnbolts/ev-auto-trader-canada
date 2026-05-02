import { writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const outDir = new URL('../outputs/', import.meta.url);
const rawDir = new URL('../sources/raw_pages/', import.meta.url);
const url = 'https://www.bankstreetkia.com/ottawa-Kia-dealer/new-car-inventory-list?model=EV6~EV9&type=N';

function strip(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function first(regex, text) {
  return text.match(regex)?.[1]?.trim() ?? '';
}

function money(value) {
  return (value ?? '').replace(/[$, ]/g, '');
}

function decodeEntities(value) {
  return (value ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'");
}

function parseMoneyLabel(label, html) {
  const decoded = decodeEntities(html);
  return money(first(new RegExp(`${label}\\s*<\\/span>:\\s*<span[^>]*>\\$([0-9,]+(?:\\.\\d{2})?)`, 'i'), decoded));
}

function parseRows(html) {
  const rows = [];
  const blocks = html.split(/<div class="row sresult relative nomargin nopadding">/).slice(1);
  for (const block of blocks) {
    if (!/Kia EV[69]/i.test(block)) continue;
    const text = strip(block);
    const vin = first(/\bVIN:\s*([A-HJ-NPR-Z0-9]{17})\b/i, text).toUpperCase();
    if (!vin) continue;
    const title = first(/<a class="styleColor"[^>]*>([^<]*Kia EV[69][^<]*)<\/a>/i, block).replace(/\s+/g, ' ').trim();
    const detailPath = first(/<a class="styleColor"\s+href="([^"]+)"/i, block);
    const detailUrl = detailPath ? new URL(detailPath, url).toString() : url;
    const sellingPrice = money(first(/result-msrp-val[\s\S]{0,180}?<span><span class="kia-dollar-sign">\$<\/span>([0-9,]+(?:\.\d{2})?)/i, block));
    const msrp = parseMoneyLabel('MSRP', block) || money(first(/\bMSRP\s+\$([0-9,]+)/i, text));
    const manufacturerRebate = parseMoneyLabel('Manufacturer Rebate', block) || money(first(/Manufacturer Rebate\s+\$([0-9,]+)/i, text));
    const marchBonus = parseMoneyLabel('March Bonus', block) || money(first(/March Bonus\s+\$([0-9,]+)/i, text));
    const adminFee = parseMoneyLabel('Admin Fee', block);
    const omvicFee = parseMoneyLabel('OMVIC Fee', block);
    const tireFee = parseMoneyLabel('Ont Tire & Oil Filter Levies Fee', block);
    const status = first(/Status:\s*([^:]+?)\s+VIN:/i, text).replace(/\s+/g, ' ').trim();
    const stock = first(/Stock#:\s*([A-Z0-9-]+)/i, text);
    const trim = first(/202[0-9]\s+Kia\s+EV[69]\s+([^$]{0,80}?)(?:Status:|$)/i, text).replace(/\s+/g, ' ').trim();
    const drivetrain = first(/Drivetrain:\s*([A-Z]+)/i, text);
    const exterior = first(/Exterior:\s*([^:]+?)\s+Interior:/i, text).replace(/\s+/g, ' ').trim();
    const interior = first(/Interior:\s*([^:]+?)\s+HWY:/i, text).replace(/\s+/g, ' ').trim();
    const model = /EV6/i.test(title) ? 'EV6' : 'EV9';
    const isAccept = status === 'In-Stock' && sellingPrice && (msrp || sellingPrice);
    rows.push({
      tool: 'Bank Street list parser',
      dealer: 'Bank Street Kia',
      city: 'Ottawa',
      province: 'Ontario',
      model,
      title,
      status,
      vin,
      stock,
      trim,
      drivetrain,
      exterior,
      interior,
      msrp,
      sellingPrice,
      manufacturerRebate,
      marchBonus,
      adminFee,
      omvicFee,
      tireFee,
      discount: msrp && sellingPrice ? Number(msrp) - Number(sellingPrice) : '',
      verdict: isAccept ? 'ACCEPT_CANDIDATE' : 'REJECT_OR_RECHECK',
      source_url: url,
      detail_url: detailUrl,
      evidence: text.slice(0, 500),
    });
  }
  return rows;
}

function tsv(rows) {
  const header = [
    'tool', 'dealer', 'city', 'province', 'model', 'title', 'status', 'vin', 'stock',
    'trim', 'drivetrain', 'exterior', 'interior', 'sellingPrice', 'msrp',
    'manufacturerRebate', 'marchBonus', 'adminFee', 'omvicFee', 'tireFee',
    'discount', 'verdict', 'source_url', 'detail_url'
  ];
  const esc = (value) => String(value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
  return [header.join('\t'), ...rows.map((row) => header.map((key) => esc(row[key])).join('\t'))].join('\n') + '\n';
}

await mkdir(outDir, { recursive: true });
await mkdir(rawDir, { recursive: true });

const started = performance.now();
const response = await fetch(url, {
  headers: {
    'user-agent': 'Mozilla/5.0 research-benchmark/1.0',
    accept: 'text/html,application/xhtml+xml',
  },
});
const html = await response.text();
await writeFile(new URL('bankstreet_ev6_ev9_list.html', rawDir), html);
const rows = response.ok ? parseRows(html) : [];
for (const row of rows) row.runtime_ms = Math.round(performance.now() - started);

await writeFile(new URL('bankstreet_inventory_probe_results.tsv', outDir), tsv(rows));
console.log(tsv(rows));
