import { readFile, writeFile } from 'node:fs/promises';

const files = {
  inventory: [
    '../staging/inventory_candidates.tsv',
    '../staging/bankstreet_inventory_candidates.tsv',
  ],
  price: [
    '../staging/price_history_candidates.tsv',
    '../staging/bankstreet_price_history_candidates.tsv',
  ],
  rejected: [
    '../staging/bankstreet_rejected_candidates.tsv',
  ],
};

async function combine(paths, outPath) {
  const blocks = [];
  for (const path of paths) {
    const text = await readFile(new URL(path, import.meta.url), 'utf8');
    const lines = text.trim().split(/\r?\n/);
    if (blocks.length === 0) blocks.push(lines[0]);
    blocks.push(...lines.slice(1));
  }
  await writeFile(new URL(outPath, import.meta.url), blocks.join('\n') + '\n');
  return blocks.length - 1;
}

const inventory = await combine(files.inventory, '../staging/all_inventory_candidates.tsv');
const price = await combine(files.price, '../staging/all_price_history_candidates.tsv');
const rejected = await combine(files.rejected, '../staging/all_rejected_candidates.tsv');

console.log(`inventory=${inventory} price=${price} rejected=${rejected}`);
