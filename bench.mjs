// Runs one measurement series for one tool and one application. README.md explains the method.
//
//   node bench.mjs setup   <tool> <app>                     create the project and deploy it once (not timed)
//   node bench.mjs package <tool> <app> [--runs 5] [--warm]  package from a clean (or warm) build cache
//   node bench.mjs deploy  <tool> <app> [--runs 5]           deploy a code change from this machine
//   node bench.mjs push    <tool> <app> [--runs 5]           push a code change: cold, then warm 15 minutes later
//   deploy and push take --change shared to change the shared service package (packages/service/src/orders.ts) instead of each handler (Lambda apps)
//   node bench.mjs remove  <tool> <app>                      delete what setup created
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  APPS, businessOk, call, copyAppSource, describeChange, editSource, fileSize, functionNames, githubWorkflow, machine, readRevision, record, ROOT,
  run, sleep, targetNames, waitForRevisions
} from './lib.mjs';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    runs: { type: 'string', default: '5' },
    warm: { type: 'boolean', default: false },
    change: { type: 'string', default: 'handlers' },
    'cold-reset': { type: 'string' }
  }
});
const [command, toolName, appId] = positionals;
const app = APPS[appId];
if (!app || !toolName) throw new Error('Usage: node bench.mjs <setup|package|deploy|push|remove> <tool> <app>. See README.md.');
const tool = (await import(`./tools/${toolName}.mjs`)).default;
if (!tool.apps.includes(appId)) throw new Error(`${toolName} is not measured on ${appId}`);

const name = `bmk-${toolName}-${appId}`;
const change = describeChange(app, values.change);
const dir = join(ROOT, 'work', name);
const runs = Number(values.runs);
mkdirSync(join(ROOT, 'logs'), { recursive: true });
const log = join(ROOT, 'logs', `${name}-${command}-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const ctx = { app, name, dir, run: (cmd) => run(cmd, { cwd: dir, log }) };
const addressFile = join(dir, '.bench-addresses.json');
const git = (...args) => run(['git', ...args], { cwd: dir, log });
const list = (commands) => (Array.isArray(commands[0]) ? commands : [commands]);
const runAll = (commands) => Promise.all(list(commands).map((cmd) => run(cmd, { cwd: dir, log, allowFailure: true })));

/** Writes the project: application source, tool configuration, installed dependencies and a Git repository. */
async function prepare() {
  if (existsSync(dir)) return;
  copyAppSource(app, dir);
  const files = tool.files(ctx);
  if (tool.gitDeploy === 'github-actions') files['.github/workflows/deploy.yml'] = githubWorkflow(tool.deploy(ctx));
  files['.gitignore'] = 'node_modules/\npackages/service/src/generated/\n.serverless/\n.sst/\ncdk.out/\n.stacktape/\n.bench-addresses.json\n';
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
  if (tool.devDependencies) {
    const path = join(dir, 'package.json');
    const pkg = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { name, private: true, type: 'module' };
    pkg.devDependencies = { ...pkg.devDependencies, ...tool.devDependencies };
    writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
    await run(['npm', 'install', '--no-audit', '--no-fund'], { cwd: dir, log });
  }
  // Install the application's locked dependencies; bundlers read them from node_modules.
  for (const sub of appId === 'five-services' ? Object.keys(app.services) : ['.']) {
    const done = sub === '.' && tool.devDependencies;
    if (!done && existsSync(join(dir, sub, 'package-lock.json'))) await run(['npm', 'ci', '--no-audit', '--no-fund'], { cwd: join(dir, sub), log });
  }
  await git('init', '-q', '-b', 'main');
  await git('add', '-A');
  await git('commit', '-qm', 'Initial version');
}

async function describeRun() {
  return {
    tool: toolName,
    toolVersion: await tool.version(ctx),
    stacktapeCommit: toolName === 'stacktape' ? process.env.STACKTAPE_COMMIT : undefined,
    machine: await machine(),
    log
  };
}

async function setup() {
  await prepare();
  for (const cmd of tool.setup?.(ctx) ?? []) await ctx.run(cmd);
  const firstDeploy = tool.firstDeploy?.(ctx) ?? tool.deploy?.(ctx, targetNames(app));
  if (firstDeploy) for (const result of await runAll(firstDeploy)) if (result.code) throw new Error(`Deploy failed; see ${log}`);
  const addresses = await tool.addresses(ctx);
  for (const target of targetNames(app)) {
    const response = await call(app, target, addresses[target], { business: true });
    if (!businessOk(app, target, response)) throw new Error(`${target} returned an unexpected result: ${JSON.stringify(response)}`);
  }
  writeFileSync(addressFile, JSON.stringify(addresses, null, 2));
  console.log(`Set up ${name}; every target passed its business check.`);
}

async function packageRuns() {
  if (!tool.package || appId === 'five-services') throw new Error(`No packaging test for ${toolName} on ${appId}`);
  await prepare();
  const info = await describeRun();
  // One untimed run first, for every tool: it downloads anything a tool fetches on first use (Serverless its
  // framework, Stacktape its base images) and leaves a previous build for the warm series. Base images then stay in
  // the local image store; clean runs empty only the build cache.
  for (const image of tool.baseImages?.(ctx) ?? []) await ctx.run(['docker', 'pull', image]);
  await ctx.run(tool.package(ctx));
  for (let i = 1; i <= runs; i++) {
    if (values.warm) {
      // Keep the previous build and its cache; change only the source, like a developer's next build.
      editSource(dir, change, `package-${Date.now()}`);
    } else {
      for (const output of tool.buildOutputs) rmSync(join(dir, output), { recursive: true, force: true });
      if (app.kind === 'service') await ctx.run(['docker', 'builder', 'prune', '-af']);
    }
    const { ms } = await ctx.run(tool.package(ctx));
    const artifacts = (await tool.artifacts(ctx)).map((a) => ({ file: a.file, bytes: a.bytes ?? fileSize(a.path) }));
    const bytes = artifacts.reduce((sum, a) => sum + a.bytes, 0);
    record('package.jsonl', { app: appId, cache: values.warm ? 'warm' : 'clean', run: i, ms, bytes, artifacts, ...info, at: new Date().toISOString() });
    console.log(`${name} package run ${i}: ${ms} ms, ${bytes} bytes`);
  }
}

/**
 * Changes the source of every changed target and times the deploy: from the start of the deploy command, or from
 * the return of `git push`, until every changed target serves the new revision.
 */
async function timedChange({ journey, push, deploy }) {
  const addresses = JSON.parse(readFileSync(addressFile, 'utf8'));
  const revision = `r${Date.now()}`;
  // Changed targets must serve the new revision. For a per-target change, the others must keep their old one.
  const expected = {};
  for (const t of targetNames(app)) {
    if (change.targets.includes(t)) expected[t] = revision;
    else if (change.kind === 'handlers') expected[t] = readRevision(dir, change.file(t));
  }
  editSource(dir, change, revision);
  await git('commit', '-qam', `Change ${change.kind === 'shared' ? change.file() : 'revisions'} to ${revision}`);
  if (push) for (const result of await runAll(push)) if (result.code) throw new Error(`git push failed; see ${log}`);
  const pushedAt = push ? new Date().toISOString() : undefined;
  const started = performance.now();
  const running = deploy ? runAll(deploy) : Promise.resolve([]);
  let failed = false;
  running.then((results) => (failed = results.some((r) => r.code !== 0)));
  const unexpected = [];
  const readyAt = await waitForRevisions(app, addresses, expected, {
    field: change.field,
    changed: change.targets,
    onUnexpected: (target, seen) => unexpected.push({ target, seen }),
    stop: () => failed && 'the deploy command failed'
  });
  const commands = await running;
  // Every target must now give the right business result from the expected revision: new for changed targets, old
  // for unchanged ones.
  const checks = await Promise.all(
    targetNames(app).map(async (t) => {
      const response = await call(app, t, addresses[t], { business: true });
      return businessOk(app, t, response) && (expected[t] === undefined || response[change.field] === expected[t]);
    })
  );
  return {
    journey,
    change: change.kind,
    changedTargets: change.targets.length,
    revision,
    pushedAt,
    readyMs: Math.round(readyAt - started),
    commandMs: commands.length ? Math.max(...commands.map((r) => r.ms)) : undefined,
    businessOk: checks.every(Boolean),
    unchangedOk: unexpected.length === 0,
    unexpected
  };
}

async function deployRuns() {
  if (!tool.deploy) throw new Error(`${toolName} deploys only from Git; use the push command`);
  const info = await describeRun();
  for (let i = 1; i <= runs; i++) {
    const result = await timedChange({ journey: 'cli', deploy: tool.deploy(ctx) });
    record('deploy.jsonl', { app: appId, run: i, ...result, ...info, at: new Date().toISOString() });
    console.log(`${name} CLI deploy run ${i}: new code served after ${result.readyMs} ms`);
  }
}

/** Empties the build cache the next Git push would use. Returns how it was done. */
async function resetCache() {
  if (tool.gitDeploy === 'github-actions') {
    await ctx.run(['gh', 'cache', 'delete', '--all']);
    return 'scripted';
  }
  if (tool.resetCache) {
    await tool.resetCache(ctx);
    return 'scripted';
  }
  if (values['cold-reset'] === 'manual') return 'manual';
  throw new Error(`${toolName} has no scripted cache reset. Reset it by hand (see README.md) and pass --cold-reset manual.`);
}

async function pushRuns() {
  const info = await describeRun();
  const push = tool.push?.(ctx) ?? [['git', 'push', 'origin', 'HEAD:main']];
  for (let i = 1; i <= runs; i++) {
    let readyAt = 0;
    for (const cache of ['cold', 'warm']) {
      const coldReset = cache === 'cold' ? await resetCache() : undefined;
      if (cache === 'warm') await sleep(Math.max(0, readyAt + 15 * 60_000 - Date.now()));
      const result = await timedChange({ journey: `git-${cache}`, push });
      readyAt = Date.now();
      const build = await tool.buildInfo?.({ ...ctx, pushedAt: result.pushedAt });
      record('deploy.jsonl', { app: appId, run: i, ...result, coldReset, build, ...info, at: new Date().toISOString() });
      console.log(`${name} ${cache} Git push run ${i}: new code served after ${result.readyMs} ms`);
    }
  }
}

async function remove() {
  for (const cmd of list(tool.remove(ctx))) await ctx.run(cmd);
  // A remove command can exit 0 without deleting everything (SST does when interrupted), so check.
  const left = app.kind === 'lambda' ? await functionNames(`${name}-`) : [];
  if (left.length) throw new Error(`These functions still exist after remove: ${left.join(', ')}`);
  rmSync(addressFile, { force: true });
  console.log(`Removed ${name}.`);
}

const commands = { setup, package: packageRuns, deploy: deployRuns, push: pushRuns, remove };
if (!commands[command]) throw new Error(`Unknown command ${command}`);
await commands[command]();
console.log(`Command output: ${log}`);
process.exit(0); // The AWS SDK keeps sockets open.
