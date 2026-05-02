import { readFile, writeFile } from 'node:fs/promises';

const input = new URL('../outputs/bankstreet_inventory_probe_results.tsv', import.meta.url);
const inventoryOut = new URL('../staging/bankstreet_inventory_candidates.tsv', import.meta.url);
const priceOut = new URL('../staging/bankstreet_price_history_candidates.tsv', import.meta.url);
const rejectedOut = new URL('../staging/bankstreet_rejected_candidates.tsv', import.meta.url);

function parseTsv(text) {
  const [header, ...rows] = text.trim().split(/\r?\n/).map((line) => line.split('\t'));
  return rows.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])));
}

function money(value) {
  if (!value) return '';
  return String(Math.round(Number(value)));
}

function pct(discount, msrp) {
  if (!discount || !msrp) return '';
  return `${((Number(discount) / Number(msrp)) * 100).toFixed(2)}%`;
}

function inventoryTsv(rows) {
  const header = [
    'Snapshot Date', 'Province', 'Dealer Name', 'Dealer City', 'VIN', 'Stock Number', 'Brand',
    'Model', 'Model Year', 'Trim', 'Drivetrain', 'Asking Price CAD', 'Exterior Colour',
    'Interior Colour', 'Days on Lot', 'Listing Status', 'Listing URL', 'Validation Status',
    'Source URL', 'Base MSRP CAD', 'Freight/PDI CAD', 'Dealer Fees CAD', 'Promo Type',
    'Promo Details', 'Promo Expiry', 'OEM Incentive CAD', 'Gov Incentive CAD',
    'Price Evidence Text', 'Window Sticker URL', 'OEM Offer URL', 'Checked At',
    'Free Source Path', 'Extraction Notes'
  ];
  const out = [header.join('\t')];
  for (const row of rows) {
    const visibleFees = [row.adminFee, row.omvicFee, row.tireFee].filter(Boolean).map(Number).reduce((a, b) => a + b, 0);
    const benchmarkExtra = row.msrp && row.sellingPrice && Number(row.sellingPrice) > Number(row.msrp)
      ? Number(row.sellingPrice) - Number(row.msrp)
      : visibleFees;
    const details = row.discount && Number(row.discount) > 0
      ? `Selling price $${money(row.sellingPrice)} is $${money(row.discount)} below MSRP $${money(row.msrp)} before taxes/licensing.`
      : `Selling price $${money(row.sellingPrice)} includes delivery, destination, and fees; MSRP component is $${money(row.msrp)} and total source-backed benchmark extras are $${benchmarkExtra.toFixed(2)}.`;
    const values = [
      '2026-05-01',
      row.province,
      row.dealer,
      row.city,
      row.vin,
      row.stock,
      'Kia',
      `Kia ${row.model}`,
      row.title.slice(0, 4),
      row.trim,
      row.drivetrain,
      money(row.sellingPrice),
      row.exterior || 'UNKNOWN',
      row.interior || 'UNKNOWN',
      'UNKNOWN',
      row.status === 'In-Stock' ? 'NEW_AVAILABLE' : row.status,
      row.detail_url || row.source_url,
      'VIN_PRICE_MSRP_SOURCE_BACKED_VPIC_PARTIAL_OR_ERROR',
      row.detail_url || row.source_url,
      money(row.msrp),
      'UNKNOWN',
      benchmarkExtra ? benchmarkExtra.toFixed(2) : 'UNKNOWN',
      row.discount && Number(row.discount) > 0 ? 'Dealer/OEM discount shown in dealer selling price' : 'None visible',
      details,
      'UNKNOWN',
      'UNKNOWN',
      'UNKNOWN',
      `Status ${row.status}; VIN ${row.vin}; stock ${row.stock}; selling price $${money(row.sellingPrice)}; MSRP $${money(row.msrp)}; admin fee $${row.adminFee}; OMVIC $${row.omvicFee}; tire/oil levy $${row.tireFee}.`,
      'UNKNOWN',
      'https://www.kia.ca/en/shopping-tools/special-offers',
      '2026-05-01',
      'Bank Street Kia public inventory list parser + NHTSA vPIC batch QA',
      'vPIC returned Kia Corporation/2026/MPV but error codes 3/5 and/or 14 for these Canadian Kia EV9 VINs; dealer page supplies VIN/model/trim/price evidence.'
    ];
    out.push(values.map((value) => String(value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t'));
  }
  return out.join('\n') + '\n';
}

function priceTsv(rows) {
  const header = ['Snapshot Date', 'VIN', 'Dealer', 'Model', 'Trim', 'Asking Price CAD', 'MSRP CAD', 'Discount CAD', 'Discount %', 'Listing URL', 'Source Tool'];
  const out = [header.join('\t')];
  for (const row of rows) {
    const discount = row.msrp && row.sellingPrice ? Number(row.msrp) - Number(row.sellingPrice) : '';
    out.push([
      '2026-05-01',
      row.vin,
      row.dealer,
      `Kia ${row.model}`,
      row.trim,
      money(row.sellingPrice),
      money(row.msrp),
      discount === '' ? '' : String(Math.round(discount)),
      pct(discount, row.msrp),
      row.detail_url || row.source_url,
      'Bank Street Kia public inventory list parser'
    ].join('\t'));
  }
  return out.join('\n') + '\n';
}

function rejectedTsv(rows) {
  const header = ['Rejection ID', 'Model', 'Model Year', 'Trim', 'VIN', 'Dealer', 'Reason Rejected', 'Replacement Canonical VIN Row', 'Source URL'];
  const out = [header.join('\t')];
  let index = 1;
  for (const row of rows) {
    out.push([
      `REJ-BSK-${String(index).padStart(3, '0')}`,
      `Kia ${row.model}`,
      row.title.slice(0, 4),
      row.trim,
      row.vin,
      row.dealer,
      row.status !== 'In-Stock'
        ? `Dealer list status is ${row.status}; final INVENTORY requires currently available/public price-backed row.`
        : 'Missing selling price or MSRP in extracted dealer evidence.',
      'N/A',
      row.detail_url || row.source_url,
    ].join('\t'));
    index += 1;
  }
  return out.join('\n') + '\n';
}

const rows = parseTsv(await readFile(input, 'utf8'));
const accepted = rows.filter((row) => row.verdict === 'ACCEPT_CANDIDATE');
const rejected = rows.filter((row) => row.verdict !== 'ACCEPT_CANDIDATE');
await writeFile(inventoryOut, inventoryTsv(accepted));
await writeFile(priceOut, priceTsv(accepted));
await writeFile(rejectedOut, rejectedTsv(rejected));
console.log(`accepted=${accepted.length} rejected=${rejected.length}`);
