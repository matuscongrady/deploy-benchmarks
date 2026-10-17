// Runs one measurement series for one tool and one application. README.md explains the method.
//
//   node bench.mjs setup   <tool> <app>                     write the test's project into work/ and deploy it once (not timed)
//   node bench.mjs package <tool> <app> [--runs 5] [--warm]  package Lambda functions from a clean (or warm) build
//                                                            cache; for a container, record only the image size
//   node bench.mjs deploy  <tool> <app> [--runs 5]           deploy a code change from this machine
//   node bench.mjs push    <tool> <app> [--runs 5]           push a code change: cold, then warm 15 minutes later
//   deploy and push take --change shared to change the shared service package (packages/service/src/orders.ts) instead of each handler (Lambda apps)
//   node bench.mjs remove  <tool> <app>                      delete what setup created
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import {
  APPS, businessOk, call, describeChange, editSource, fileSize, functionNames, machine, readRevision, record, ROOT, run, sleep, targetNames,
  waitForRevisions
} from './lib.mjs';
import { commitProject, installDirs, measurements, test, TOOLS, writeProject } from './project.mjs';

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
if (!app || !TOOLS.includes(toolName)) {
  throw new Error(`Usage: node bench.mjs <setup|package|deploy|push|remove> <tool> <app>. Tools: ${TOOLS.join(', ')}. Apps: ${Object.keys(APPS).join(', ')}.`);
}
const tool = (await import(`./tools/${toolName}.mjs`)).default;
if (!tool.apps.includes(appId)) throw new Error(`${toolName} is not measured on ${appId}`);

const t = test(toolName, tool, appId);
const { name, branch } = t;
const change = describeChange(app, values.change);
const dir = join(ROOT, 'work', name);
const runs = Number(values.runs);
mkdirSync(join(ROOT, 'logs'), { recursive: true });
const log = join(ROOT, 'logs', `${name}-${command}-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const ctx = { app, name, dir, branch, run: (cmd) => run(cmd, { cwd: dir, log }) };
const addressFile = join(dir, '.bench-addresses.json');
const git = (...args) => run(['git', ...args], { cwd: dir, log });
const list = (commands) => (Array.isArray(commands[0]) ? commands : [commands]);
const runAll = (commands) => Promise.all(list(commands).map((cmd) => run(cmd, { cwd: dir, log, allowFailure: true })));

/**
 * Writes the project, the same files and commit as the test's branch, then installs its locked dependencies, which
 * bundlers read from node_modules. Tools that build on their own servers need no local install.
 */
async function prepare() {
  if (existsSync(dir)) return;
  writeProject(t, dir);
  commitProject(t, dir);
  // The Git push test pushes to the test's branch of your fork, which the platforms deploy from.
  if (process.env.BENCH_FORK) await git('remote', 'add', 'origin', process.env.BENCH_FORK);
  if (!tool.remoteBuild) for (const sub of installDirs(t, dir)) await run(['npm', 'ci', '--no-audit', '--no-fund'], { cwd: join(dir, sub), log });
}

async function describeRun() {
  return {
    tool: toolName,
    toolVersion: await tool.version(ctx),
    stacktapeCommit: tool.commit,
    machine: await machine(),
    log: relative(ROOT, log)
  };
}

async function setup() {
  await prepare();
  for (const cmd of tool.setup?.(ctx) ?? []) await ctx.run(cmd);
  // Tools that deploy only from Git create their services through their API here.
  await tool.provision?.(ctx);
  const firstDeploy = tool.firstDeploy?.(ctx) ?? tool.deploy?.(ctx, targetNames(app));
  if (firstDeploy) for (const result of await runAll(firstDeploy)) if (result.code) throw new Error(`Deploy failed; see ${log}`);
  for (const cmd of tool.afterFirstDeploy?.(ctx) ?? []) await ctx.run(cmd);
  const addresses = await tool.addresses(ctx);
  for (const target of targetNames(app)) {
    // A new service can take a moment to receive traffic after its platform reports it live, so retry for 3 minutes.
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await call(app, target, addresses[target], { business: true });
        if (!businessOk(app, target, response)) throw new Error(`${target} returned an unexpected result: ${JSON.stringify(response)}`);
        break;
      } catch (error) {
        if (attempt === 36) throw error;
        await sleep(5000);
      }
    }
  }
  writeFileSync(addressFile, JSON.stringify(addresses, null, 2));
  console.log(`Set up ${name}; every target passed its business check.`);
}

async function measureArtifacts() {
  const artifacts = (await tool.artifacts(ctx)).map((a) => ({ file: a.file, bytes: a.bytes ?? fileSize(a.path) }));
  return { bytes: artifacts.reduce((sum, a) => sum + a.bytes, 0), artifacts };
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
  // No tool builds a container image except as part of its deploy, so container build time is measured there. Here a
  // container gets only its image size, which the build just made.
  if (app.kind === 'service') {
    const { bytes, artifacts } = await measureArtifacts();
    record('package.jsonl', { app: appId, bytes, artifacts, ...info, at: new Date().toISOString() });
    console.log(`${name} image: ${bytes} bytes`);
    return;
  }
  for (let i = 1; i <= runs; i++) {
    if (values.warm) {
      // Keep the previous build and its cache; change only the source, like a developer's next build.
      editSource(dir, change, `package-${Date.now()}`);
    } else {
      for (const output of tool.buildOutputs) rmSync(join(dir, output), { recursive: true, force: true });
    }
    const { ms } = await ctx.run(tool.package(ctx));
    const { bytes, artifacts } = await measureArtifacts();
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
    // Only this branch's caches: other tests may be running in the same fork.
    await ctx.run(['gh', 'cache', 'delete', '--all', '--ref', `refs/heads/${branch}`, '--succeed-on-no-caches']);
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
  if (!measurements(t).push) throw new Error(`${toolName} has no Git push test on ${appId}`);
  const info = await describeRun();
  const push = [['git', 'push', 'origin', `HEAD:${branch}`]];
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
  const removal = await tool.remove(ctx);
  if (removal.length) for (const cmd of list(removal)) await ctx.run(cmd);
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
