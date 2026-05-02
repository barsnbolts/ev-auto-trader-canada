import { existsSync } from 'node:fs';

const checks = [
  ['README.md exists', existsSync('README.md')],
  ['package.json exists', existsSync('package.json')],
  ['docs/current-status.md exists', existsSync('docs/current-status.md')],
  ['docs/handoff-codex-macbook.md exists', existsSync('docs/handoff-codex-macbook.md')],
  ['docs/task-board.md exists', existsSync('docs/task-board.md')],
  ['docs/session-decisions.json exists', existsSync('docs/session-decisions.json')],
  ['scripts/preview-offline.mjs exists', existsSync('scripts/preview-offline.mjs')],
  ['data/vehicles.sample.json exists', existsSync('data/vehicles.sample.json')],
  ['start.command exists', existsSync('start.command')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
