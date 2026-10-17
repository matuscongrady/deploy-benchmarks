// The project each test deploys: one application with one tool's configuration. bench.mjs writes it into work/ and
// branches.mjs commits it as the test's branch, with the same function and the same commit, so the two never differ.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { APPS, copyAppSource, githubWorkflow, ROOT, serviceDir, targetNames } from './lib.mjs';

export const REPOSITORY = 'https://github.com/stacktape/deploy-benchmarks';
export const TOOLS = ['stacktape', 'serverless', 'sst', 'cdk', 'cdk-hotswap', 'render', 'heroku', 'ravion'];

/** Every test: each tool with each application it is measured on, in a fixed order. */
export async function tests() {
  const list = [];
  for (const toolName of TOOLS) {
    const tool = (await import(`./tools/${toolName}.mjs`)).default;
    for (const appId of Object.keys(APPS).filter((id) => tool.apps.includes(id))) list.push(test(toolName, tool, appId));
  }
  return list;
}

export function test(toolName, tool, appId) {
  const app = APPS[appId];
  return { toolName, tool, appId, app, name: `bmk-${toolName}-${appId}`, branch: `${appId}/${toolName}` };
}

/** What a test measures. The Git push test needs setup steps; tools and apps without them have no Git push test. */
export function measurements({ tool, app }) {
  return {
    package: Boolean(tool.package) && app.id !== 'five-services',
    deploy: Boolean(tool.deploy),
    push: Boolean(tool.docs.gitPush(app))
  };
}

/** Directories with a package-lock.json, where the project's dependencies are installed with `npm ci`. */
export const installDirs = ({ app }, dir) =>
  ['.', ...(app.id === 'five-services' ? targetNames(app).map((s) => serviceDir(app, s)) : [])].filter((sub) => existsSync(join(dir, sub, 'package-lock.json')));

/**
 * The files a tool adds to the application in `dir`: its configuration, the Git push workflow and, for tools installed
 * from npm, the root package.json with the tool's devDependencies. configs/ holds a copy of these files together with
 * the package-lock.json that matches each package.json.
 */
export function toolFiles(t, dir) {
  const { tool, app, name, branch } = t;
  const ctx = { app, name, dir: '.', branch };
  const files = tool.files(ctx);
  if (tool.gitDeploy === 'github-actions') files['.github/workflows/deploy.yml'] = githubWorkflow(tool.deploy(ctx), branch);
  if (tool.devDependencies) {
    const path = join(dir, 'package.json');
    const pkg = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { name, private: true, type: 'module' };
    pkg.devDependencies = { ...pkg.devDependencies, ...tool.devDependencies };
    files['package.json'] = `${JSON.stringify(pkg, null, 2)}\n`;
  }
  return files;
}

const GITIGNORE = 'node_modules/\npackages/service/src/generated/\n.serverless/\n.sst/\ncdk.out/\n.stacktape/\n.bench-addresses.json\n';

/** Writes the whole project into an empty directory: the application, the tool's files, the lockfile and a README. */
export function writeProject(t, dir) {
  copyAppSource(t.app, dir);
  const files = { ...toolFiles(t, dir), '.gitignore': GITIGNORE, 'README.md': readme(t) };
  const lock = join(ROOT, 'configs', t.toolName, t.appId, 'package-lock.json');
  if (t.tool.devDependencies) {
    if (!existsSync(lock)) throw new Error(`${lock} is missing; run node configs.mjs`);
    files['package-lock.json'] = readFileSync(lock, 'utf8');
  }
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
}

// A fixed author, date and message make the commit identical wherever it is made, so the work/ project that
// bench.mjs creates has the same commit as the published branch and a push to a fork continues that branch.
const COMMIT_ENV = {
  GIT_AUTHOR_NAME: 'deploy-benchmarks',
  GIT_AUTHOR_EMAIL: 'noreply@stacktape.com',
  GIT_AUTHOR_DATE: '2026-10-17T00:00:00Z',
  GIT_COMMITTER_NAME: 'deploy-benchmarks',
  GIT_COMMITTER_EMAIL: 'noreply@stacktape.com',
  GIT_COMMITTER_DATE: '2026-10-17T00:00:00Z'
};

/** Makes `dir` a Git repository with the project as its only commit, on the test's branch. Returns the commit. */
export function commitProject(t, dir) {
  const git = (...args) =>
    execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', '-c', 'core.excludesFile=/dev/null', ...args], {
      cwd: dir,
      env: { ...process.env, ...COMMIT_ENV },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  git('init', '-q', '-b', t.branch);
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', `${t.app.id} deployed with ${t.tool.docs.name}\n\nGenerated from main by node branches.mjs.`);
  return git('rev-parse', 'HEAD');
}

const shell = (cmd) => cmd.join(' ');
const block = (lines) => ['```sh', ...lines, '```'];
/** A shell block of [command, comment] rows with the comments lined up. */
const commented = (rows) => {
  const width = Math.max(...rows.filter(([, c]) => c).map(([cmd]) => cmd.length));
  return block(rows.map(([cmd, comment]) => (comment ? `${cmd.padEnd(width)}   # ${comment}` : cmd)));
};
const mainLink = (path) => `[\`${path}\`](${REPOSITORY}/blob/main/${path})`;

const APP_DESCRIPTIONS = {
  'lambda-1': ['the Lambda backend with 1 function (`sales-report`)', 'fixtures/lambdas'],
  'lambda-5': ['the Lambda backend with 5 functions', 'fixtures/lambdas'],
  'lambda-25': ['the Lambda backend with all 25 functions', 'fixtures/lambdas'],
  'container-node': ['the Node.js container API', 'fixtures/containers/node'],
  'container-python': ['the Python container API', 'fixtures/containers/python'],
  'five-services': ['five Node.js container services, of which the change edits three', 'fixtures/containers/five-services']
};

const FILE_DESCRIPTIONS = {
  'stacktape.yml': 'The Stacktape configuration',
  'serverless.yml': 'The Serverless Framework configuration',
  'sst.config.ts': 'The SST configuration',
  'app.mjs': 'The CDK app: one stack with the functions or services',
  'cdk.json': 'Tells the CDK CLI to run `app.mjs`',
  'render.yaml': 'The Render Blueprint',
  'deploy.yml': 'The GitHub Actions workflow that the Git push test uses',
  Dockerfile: 'The Dockerfile that the tool builds',
  '.dockerignore': 'What the Docker build leaves out'
};

/** The README of a test branch. */
export function readme(t) {
  const { toolName, tool, appId, app, name, branch } = t;
  const docs = { app, name, dir: '.', branch, docs: true };
  const [description, source] = APP_DESCRIPTIONS[appId];
  const does = measurements(t);
  const manualReset = !tool.gitDeploy && !tool.resetCache;
  const config = Object.keys(toolFiles(t, join(ROOT, source))).filter((f) => f !== 'package.json');
  const needs = ['Node.js 22 or newer', 'npm', 'Git', ...(tool.remoteBuild ? [] : ['Docker with BuildKit', '`zip`', 'the AWS CLI', 'a disposable AWS account']), ...[tool.docs.account ?? []].flat()];
  const list = (items) => `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
  const lines = [
    `# ${branch}`,
    '',
    `This branch is one test of the [deploy benchmarks](${REPOSITORY}): ${description}, deployed with ${tool.docs.name}.`,
    "It holds only that application and the tool's configuration, so it deploys as it is.",
    '',
    `\`node branches.mjs\` on \`main\` generates this branch from \`main\`'s fixtures and tool modules. Don't edit it here: change \`main\` and generate the branches again.`,
    '',
    '## Tool version',
    '',
    tool.docs.version,
    '',
    '## Files',
    '',
    '| Path | What it is |',
    '| --- | --- |',
    ...config.map((f) => `| \`${f}\` | ${FILE_DESCRIPTIONS[f.split('/').pop()]} |`),
    ...(tool.devDependencies ? ["| `package.json`, `package-lock.json` | The application's manifest, with the tool added as a pinned devDependency |"] : []),
    `| ${config.length || tool.devDependencies ? 'Everything else' : 'All files'} | The application, copied from ${mainLink(source)} |`,
    ...(tool.docs.configNote ? ['', tool.docs.configNote] : []),
    '',
    '## Credentials',
    '',
    ...tool.docs.credentials.map((c) => `- ${c}`),
    '',
    '## Reproduce the measurement',
    '',
    `You need ${list(needs)}. ${tool.docs.region ?? 'The AWS resources are created in `eu-west-1`.'} ${does.deploy ? 'Run the harness from `main`, with the credentials above:' : `${tool.docs.name} deploys only from Git, so this test is the Git push test below.`}`,
    ''
  ];
  if (does.deploy) {
    lines.push(
      ...commented([
        [`git clone ${REPOSITORY} && cd deploy-benchmarks`],
        ['npm ci'],
        [`node bench.mjs setup   ${toolName} ${appId}`, `write work/${name}/ and deploy it once (not measured)`],
        ...(does.package ? [[`node bench.mjs package ${toolName} ${appId} --runs 10`, app.kind === 'lambda' ? 'package from an empty build cache' : 'record the image size']] : []),
        ...(does.package && app.kind === 'lambda' ? [[`node bench.mjs package ${toolName} ${appId} --runs 10 --warm`, 'package after a source change']] : []),
        [`node bench.mjs deploy  ${toolName} ${appId} --runs 10`, 'deploy a code change from this machine'],
        ...(app.kind === 'lambda' ? [[`node bench.mjs deploy  ${toolName} ${appId} --runs 10 --change shared`, 'change the shared service package instead']] : []),
        ['node report.mjs', 'median, fastest and slowest run'],
        [`node bench.mjs remove  ${toolName} ${appId}`, 'delete everything setup created']
      ]),
      '',
      `\`setup\` writes the files of this branch to \`work/${name}/\` and commits them as the same commit that this branch has.`,
      ''
    );
  }
  if (does.push) {
    lines.push(
      '## Git push test',
      '',
      'Each run is a pair: a first push with an empty build cache, then a second push 15 minutes after the first one finished. The clock starts when `git push` returns.',
      '',
      '1. Fork the repository with all branches: untick "Copy the main branch only".',
      ...tool.docs.gitPush(app).map((step, i) => `${i + 2}. ${step}`),
      `${tool.docs.gitPush(app).length + 2}. Run the commands below. The project in \`work/\` has the same commit as this branch, so its pushes continue your fork's branch.`,
      '',
      ...commented([
        ...(does.deploy ? [] : [[`git clone ${REPOSITORY} && cd deploy-benchmarks`], ['npm ci']]),
        ['export BENCH_FORK=https://github.com/<you>/deploy-benchmarks', "setup adds it as the project's origin"],
        [`node bench.mjs setup ${toolName} ${appId}`, does.deploy ? 'skip if you already ran it with BENCH_FORK set' : 'write the project to work/ and check the deployed service'],
        [`node bench.mjs push ${toolName} ${appId} --runs 10${manualReset ? ' --cold-reset manual' : ''}`],
        ['node report.mjs']
      ]),
      ''
    );
  }
  if (tool.deploy) {
    const installs = tool.remoteBuild ? [] : installDirs(t, join(ROOT, source)).map((sub) => (sub === '.' ? 'npm ci' : `(cd ${sub} && npm ci)`));
    // The SST and CDK manifests come from this branch, not from the fixture, so the root always installs.
    if (tool.devDependencies && !installs.includes('npm ci')) installs.unshift('npm ci');
    const first = tool.firstDeploy?.(docs) ?? tool.deploy(docs, targetNames(app));
    const commands = (c) => (Array.isArray(c[0]) ? c : [c]).map(shell);
    lines.push(
      '## Deploy it with the tool alone',
      '',
      'From a checkout of this branch, without the harness:',
      '',
      ...block([
        ...installs,
        ...(tool.setup?.(docs) ?? []).map(shell),
        ...commands(first),
        ...(tool.afterFirstDeploy?.(docs) ?? []).map(shell),
        ...(tool.firstDeploy ? ['# after a code change:', ...commands(tool.deploy(docs))] : []),
        '# delete everything:',
        ...commands(tool.remove(docs))
      ]),
      ''
    );
  }
  lines.push(
    '## Expected result',
    '',
    'Each run appends one JSON line to `results/package.jsonl` or `results/deploy.jsonl`. Times are in milliseconds and sizes in bytes. Every line also records the tool version, the machine and the command log.',
    '',
    '```js'
  );
  if (does.package && app.kind === 'lambda') lines.push(`{ "app": "${appId}", "tool": "${toolName}", "cache": "clean", "run": 1, "ms": <packaging time>, "bytes": <upload size>, "artifacts": [{ "file": "...", "bytes": ... }] }`);
  if (does.package && app.kind === 'service') lines.push(`{ "app": "${appId}", "tool": "${toolName}", "bytes": <compressed image size>, "artifacts": [...] }`);
  const deployLine = (journey, extra) =>
    `{ "app": "${appId}", "tool": "${toolName}", "journey": "${journey}", "run": 1, "change": "handlers", "changedTargets": ${app.changed.length}, "readyMs": <time until the new code answers>, ${extra}"businessOk": true, "unchangedOk": true }`;
  if (does.deploy) lines.push(deployLine('cli', '"commandMs": <deploy command duration>, '));
  const build = tool.buildInfo ? '"build": <build records from the platform>, ' : '';
  if (does.push) lines.push(deployLine('git-cold', `"coldReset": "${manualReset ? 'manual' : 'scripted'}", ${build}`), deployLine('git-warm', build));
  lines.push(
    '```',
    '',
    '`node report.mjs` prints the median with the fastest and slowest run of each series. Runs whose business check failed are listed and left out.',
    '',
    '## Results',
    '',
    `Pending. The results will be published in the [main README](${REPOSITORY}#results) after the measurement runs on a dedicated EC2 machine.`,
    ''
  );
  return lines.join('\n');
}
