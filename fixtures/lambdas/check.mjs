// Runs every function with its test input and checks the result against ../manifest.json. Needs no accounts and no
// database: the service package answers from sample data. Run with `npm run check` after `npm ci`.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

process.env.LOG_LEVEL ??= 'warn';
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url)));
const contains = (actual, want) =>
  Array.isArray(want)
    ? Array.isArray(actual) && actual.length === want.length && want.every((v, i) => contains(actual[i], v))
    : want && typeof want === 'object'
      ? actual && Object.entries(want).every(([k, v]) => contains(actual[k], v))
      : actual === want;

for (const fn of manifest.lambda.functions) {
  const { handler } = await import(new URL(`packages/functions/src/handlers/${fn.name}.ts`, import.meta.url));
  let result = await handler(fn.probe.input);
  if (typeof result?.body === 'string') {
    assert.equal(result.statusCode, 200, `${fn.name}: ${result.body}`);
    result = JSON.parse(result.body);
  }
  if (Array.isArray(result.results)) result = { ...result, ...result.results[0] };
  assert.equal(result.revision, 'baseline', `${fn.name}: revision`);
  assert.equal(result.serviceRevision, 'baseline', `${fn.name}: serviceRevision`);
  assert.ok(contains(result, fn.probe.expected), `${fn.name}: unexpected result ${JSON.stringify(result)}`);
}

// Invalid input is rejected rather than processed.
const { handler: createOrder } = await import('./packages/functions/src/handlers/create-order.ts');
assert.equal((await createOrder({ body: JSON.stringify({ requestId: 'r', lines: [] }) })).statusCode, 400);
const { handler: capture } = await import('./packages/functions/src/handlers/payment-capture.ts');
assert.equal((await capture({ Records: [{ messageId: 'm1', body: '{}' }] })).batchItemFailures.length, 1);
console.log(`Checked ${manifest.lambda.functions.length} functions and their business results.`);
process.exit(0);
