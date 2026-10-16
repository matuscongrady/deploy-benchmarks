// Shared helpers: the test applications, running commands, editing the source and probing deployed code.
import { spawn, execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { appendFileSync, cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { cpus, hostname, tmpdir, totalmem } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InvokeCommand, LambdaClient, ListFunctionsCommand } from '@aws-sdk/client-lambda';

export const ROOT = dirname(fileURLToPath(import.meta.url));
export const REGION = process.env.BENCH_REGION ?? 'eu-west-1';
export const STAGE = 'bmk';
const manifest = JSON.parse(readFileSync(join(ROOT, 'fixtures/manifest.json'), 'utf8'));

// The six test applications. A target is a Lambda function or an HTTP service; `changed` targets get the source edit.
const lambdaApp = (count) => {
  const id = `lambda-${count}`;
  const functions = manifest.lambda.workloads.find((w) => w.id === id).functions;
  return { id, kind: 'lambda', functions, changed: functions };
};
const services = Object.fromEntries(manifest.fiveServices.services.map((s) => [s.name, s]));
export const APPS = {
  'lambda-1': lambdaApp(1),
  'lambda-5': lambdaApp(5),
  'lambda-25': lambdaApp(25),
  node: { id: 'node', kind: 'service', language: 'node', services: { api: manifest.containers[0] }, changed: ['api'] },
  python: { id: 'python', kind: 'service', language: 'python', services: { api: manifest.containers[1] }, changed: ['api'] },
  'five-services': { id: 'five-services', kind: 'service', language: 'node', services, changed: ['api', 'reporting', 'notifications'] }
};

/** Where the service's source lives inside the project. The single-service apps keep their source at the root. */
export const serviceDir = (app, name) => (app.id === 'five-services' ? name : '.');
export const targetNames = (app) => (app.kind === 'lambda' ? app.functions : Object.keys(app.services));

/** Copies the application source into a fresh project directory. Installed output is never copied. */
export function copyAppSource(app, dir) {
  mkdirSync(dir, { recursive: true });
  const skip = (path) => !/(node_modules|\.venv|__pycache__|check\.mjs|check\.py|requirements-check)/.test(path);
  if (app.kind === 'lambda') {
    const src = join(ROOT, 'fixtures/lambdas');
    cpSync(join(src, 'data.mjs'), join(dir, 'data.mjs'));
    for (const fn of app.functions) {
      for (const file of [`${fn}.mjs`, `${fn}.revision.mjs`]) cpSync(join(src, 'handlers', file), join(dir, 'handlers', file));
    }
    // Each Lambda app declares only the dependencies its functions import.
    for (const file of ['package.json', 'package-lock.json']) cpSync(join(src, 'workload-locks', app.id, file), join(dir, file));
    return;
  }
  for (const [name, service] of Object.entries(app.services)) {
    cpSync(join(ROOT, service.buildContext), join(dir, serviceDir(app, name)), { recursive: true, filter: skip });
  }
}

/** Path of the file that holds a target's revision string. */
export function revisionFile(app, target) {
  if (app.kind === 'lambda') return join('handlers', `${target}.revision.mjs`);
  return join(serviceDir(app, target), app.language === 'python' ? 'revision.py' : 'revision.mjs');
}

/** The scripted source edit every tool receives: it changes the revision string of each changed target. */
export function editSource(app, dir, revision) {
  for (const target of app.changed) {
    const file = join(dir, revisionFile(app, target));
    const text = file.endsWith('.py') ? `REVISION = '${revision}'\n` : `export const revision = '${revision}';\n`;
    writeFileSync(file, text);
  }
}

export function readRevision(app, dir, target) {
  return readFileSync(join(dir, revisionFile(app, target)), 'utf8').match(/'([^']*)'/)[1];
}

/** Runs a command, appending its output to `log`. Resolves with the exit code and elapsed milliseconds. */
export function run(cmd, { cwd, log, env, allowFailure = false } = {}) {
  const [file, ...args] = cmd;
  appendFileSync(log, `\n$ ${cmd.join(' ')}   (cwd ${cwd})\n`);
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (d) => appendFileSync(log, d));
    child.stderr.on('data', (d) => appendFileSync(log, d));
    child.on('error', reject);
    child.on('close', (code) => {
      const ms = Math.round(performance.now() - started);
      appendFileSync(log, `[exit ${code} after ${ms} ms]\n`);
      if (code !== 0 && !allowFailure) reject(new Error(`${cmd.join(' ')} failed with exit ${code}; see ${log}`));
      else resolve({ code, ms });
    });
  });
}

/** Runs a short command and returns its trimmed output (used for versions and lookups). */
export function capture(cmd, cwd) {
  return execFileSync(cmd[0], cmd.slice(1), { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export const fileSize = (path) => statSync(path).size;

/** Size of a directory zipped at deflate level 6 (zlib's default), for tools that zip only during deploy. */
export function zipSize(dir) {
  const out = join(tmpdir(), `bmk-${process.pid}-${Date.now()}.zip`);
  execFileSync('zip', ['-q', '-r', '-X', '-6', out, '.'], { cwd: dir });
  const bytes = statSync(out).size;
  rmSync(out);
  return bytes;
}

/** CloudFormation stack outputs as an object. */
export function stackOutputs(stackName) {
  const json = capture(['aws', 'cloudformation', 'describe-stacks', '--region', REGION, '--stack-name', stackName, '--output', 'json']);
  return Object.fromEntries((JSON.parse(json).Stacks[0].Outputs ?? []).map((o) => [o.OutputKey, o.OutputValue]));
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const lambda = new LambdaClient({ region: REGION });

/** Names of the deployed functions that start with `prefix`. */
export async function functionNames(prefix) {
  const names = [];
  for (let Marker; ; ) {
    const page = await lambda.send(new ListFunctionsCommand({ Marker }));
    names.push(...page.Functions.map((f) => f.FunctionName).filter((n) => n.startsWith(prefix)));
    if (!(Marker = page.NextMarker)) break;
  }
  return names;
}

/** Finds the deployed name of each function by listing functions whose names start with `prefix`. */
export async function findFunctions(prefix, functions) {
  const names = await functionNames(prefix);
  const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.fromEntries(
    functions.map((fn) => {
      const matches = names.filter((n) => squash(n.slice(prefix.length)).includes(squash(fn)));
      if (matches.length !== 1) throw new Error(`Expected one deployed function for ${fn} under ${prefix}, found ${matches}`);
      return [fn, matches[0]];
    })
  );
}

/** Invokes a function or calls a service and returns its response body. */
export async function call(app, target, address, { business = false } = {}) {
  if (app.kind === 'lambda') {
    const result = await lambda.send(new InvokeCommand({ FunctionName: address, Payload: JSON.stringify({}) }));
    if (result.FunctionError) throw new Error(`${target}: ${Buffer.from(result.Payload).toString()}`);
    return JSON.parse(Buffer.from(result.Payload).toString());
  }
  const probe = business ? app.services[target].businessProbe : app.services[target].versionProbe;
  let body = probe.body && { ...probe.body };
  if (body?.jobId) body.jobId = `job-${Date.now()}`;
  if (probe.sign) body[probe.sign] = createHmac('sha256', 'fixture-only-not-a-secret').update(body.payload).digest('hex');
  const response = await fetch(new URL(probe.path, address), {
    method: probe.method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`${target}: HTTP ${response.status}`);
  return response.json();
}

/** Checks a response against the fixture's expected business result. Arrays must match in length and order. */
export function businessOk(app, target, response) {
  const expected = app.kind === 'lambda'
    ? manifest.lambda.functions.find((f) => f.name === target).probe.expected
    : app.services[target].businessProbe.expected;
  const contains = (actual, want) =>
    Array.isArray(want)
      ? Array.isArray(actual) && actual.length === want.length && want.every((v, i) => contains(actual[i], v))
      : want && typeof want === 'object'
        ? actual && Object.entries(want).every(([k, v]) => contains(actual[k], v))
        : actual === want;
  return contains(response, expected);
}

/**
 * Polls each target on its own until it serves its expected revision, and resolves with the time (performance.now)
 * of the last target's first correct answer. A new call starts every interval even while earlier calls are still
 * running (at most four at a time per target), so a slow function does not lower the timer's resolution.
 */
export async function waitForRevisions(app, addresses, expected, { timeoutMs = 45 * 60_000, onUnexpected, stop } = {}) {
  const interval = app.kind === 'lambda' ? 250 : 1000;
  const deadline = performance.now() + timeoutMs;
  let readyAt = 0;
  await Promise.all(
    Object.keys(expected).map(async (target) => {
      let done = false;
      let inFlight = 0;
      while (!done) {
        if (performance.now() > deadline) throw new Error(`Timed out waiting for ${target}`);
        if (stop?.()) throw new Error(`Stopped waiting: ${stop()}`);
        if (inFlight < 4) {
          inFlight++;
          call(app, target, addresses[target])
            .then(({ revision }) => {
              if (revision === expected[target] && !done) {
                done = true;
                readyAt = Math.max(readyAt, performance.now());
              } else if (revision !== expected[target] && !app.changed.includes(target)) onUnexpected?.(target, revision);
            })
            .catch(() => {}) // Errors during a rollout are expected; keep polling.
            .finally(() => inFlight--);
        }
        await sleep(interval);
      }
    })
  );
  return readyAt;
}

/** Describes the machine that ran the measurement. On EC2 it adds the instance type and region. */
export async function machine() {
  const info = { hostname: hostname(), cpu: cpus()[0].model, cpus: cpus().length, memoryGb: Math.round(totalmem() / 2 ** 30), node: process.version };
  try {
    const imds = 'http://169.254.169.254/latest';
    const token = await fetch(`${imds}/api/token`, {
      method: 'PUT',
      headers: { 'x-aws-ec2-metadata-token-ttl-seconds': '60' },
      signal: AbortSignal.timeout(300)
    }).then((r) => r.text());
    const get = (path) => fetch(`${imds}/meta-data/${path}`, { headers: { 'x-aws-ec2-metadata-token': token } }).then((r) => r.text());
    info.instanceType = await get('instance-type');
    info.region = await get('placement/region');
  } catch {
    // Not on EC2.
  }
  return info;
}

export function record(file, entry) {
  mkdirSync(join(ROOT, 'results'), { recursive: true });
  appendFileSync(join(ROOT, 'results', file), `${JSON.stringify(entry)}\n`);
}

/** Base images of the Dockerfiles below. */
export const BASE_IMAGES = { node: 'node:22-slim', python: 'python:3.11-slim' };

/**
 * The Dockerfile SST and CDK build for a service: the official slim image, a locked production install, then the
 * source. Both tools require a Dockerfile; Stacktape and the hosted platforms build without one.
 */
export function dockerfile(app, service) {
  const dir = serviceDir(app, service);
  const node = `FROM ${BASE_IMAGES.node}
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production PORT=3000
CMD ["node", "server.mjs"]
`;
  const python = `FROM ${BASE_IMAGES.python}
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "3000"]
`;
  return {
    [join(dir, 'Dockerfile')]: app.language === 'python' ? python : node,
    [join(dir, '.dockerignore')]: 'node_modules\n.venv\n.git\n.sst\ncdk.out\n.stacktape\n'
  };
}

/**
 * GitHub Actions workflow for tools without their own Git deployment service. Every such tool gets the same steps:
 * a fresh runner, Node 22 with npm's download cache, AWS credentials through OIDC, `npm ci`, then the tool's deploy.
 */
export function githubWorkflow(deploy) {
  return `name: deploy
on:
  push:
    branches: [main]
permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: \${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${REGION}
      - run: npm ci
      - run: ${deploy.join(' ')}${deploy.includes('serverless') ? '\n        env:\n          SERVERLESS_ACCESS_KEY: ${{ secrets.SERVERLESS_ACCESS_KEY }}' : ''}
`;
}

/** Builds a service image the way SST and CDK do: `docker build` of the service's Dockerfile. */
export const dockerBuild = (app, service, tag) => ['docker', 'build', '-t', tag, serviceDir(app, service)];

/** Compressed size of a local image, which is what a registry push uploads when the registry has no layers yet. */
export const imageBytes = (tag) => Number(capture(['docker', 'image', 'inspect', tag, '--format', '{{.Size}}']));
