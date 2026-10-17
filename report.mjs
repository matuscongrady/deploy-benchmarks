// Prints median, minimum and maximum of every series in results/*.jsonl.
//   node report.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPS, ROOT } from './lib.mjs';

const load = (file) =>
  existsSync(join(ROOT, 'results', file))
    ? readFileSync(join(ROOT, 'results', file), 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
    : [];

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const seconds = (ms) => (ms / 1000).toFixed(1);
const megabytes = (bytes) => (bytes / 1e6).toFixed(2);
const stats = (values, format) => (values.length ? `${format(median(values))} (${format(Math.min(...values))}–${format(Math.max(...values))})` : '–');

function table(title, rows, key, columns) {
  const groups = new Map();
  for (const row of rows) {
    const id = key(row);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  console.log(`\n${title}\n`);
  const lines = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([id, group]) => [id, `${group.length}`, ...columns.map(([, c]) => c(group))]);
  const header = ['series', 'runs', ...columns.map(([heading]) => heading)];
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i].length)));
  for (const line of [header, ...lines]) console.log(line.map((cell, i) => cell.padEnd(widths[i])).join('  '));
}

// Container build time belongs to the deploy table: no tool builds an image except as part of its deploy.
const packages = load('package.jsonl');
const isContainer = (r) => APPS[r.app]?.kind === 'service';
const done = (g) => g.filter((r) => !r.failed);
table('Lambda packaging time and upload size', packages.filter((r) => !isContainer(r)), (r) => `${r.app} ${r.tool} ${r.cache}`, [
  ['failed', (g) => `${g.length - done(g).length}`],
  ['seconds: median (min–max)', (g) => stats(done(g).map((r) => r.ms), seconds)],
  ['MB: median (min–max)', (g) => stats(done(g).map((r) => r.bytes), megabytes)]
]);
table('Container image size', packages.filter(isContainer), (r) => `${r.app} ${r.tool}`, [
  ['MB: median (min–max)', (g) => stats(g.map((r) => r.bytes), megabytes)]
]);

// Failed or incorrect deploys are listed, not averaged in.
const deploys = load('deploy.jsonl');
const ok = (r) => r.businessOk && r.unchangedOk;
table('Time from deploy start (or git push return) until the new code serves', deploys, (r) => `${r.app} ${r.tool} ${r.journey} ${r.change}`, [
  ['excluded', (g) => `${g.filter((r) => !ok(r)).length}`],
  ['seconds: median (min–max)', (g) => stats(g.filter(ok).map((r) => r.readyMs), seconds)]
]);
for (const r of deploys.filter((r) => !ok(r))) {
  const why = r.failed ? `failed: ${r.error}` : `business check ${r.businessOk ? 'passed' : 'failed'}, unchanged targets ${r.unchangedOk ? 'kept' : 'changed'}`;
  console.log(`Excluded: ${r.app} ${r.tool} ${r.journey} ${r.change} run ${r.run} (${why}); log ${r.log}`);
}
