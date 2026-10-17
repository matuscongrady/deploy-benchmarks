// Writes the generated files on main:
// - configs/<tool>/<app>/: the files each tool adds to each application, and the package-lock.json that pins the
//   tool's npm packages. bench.mjs and branches.mjs copy the lockfile from here, so every install is the same.
// - the generated sections of README.md: the test branches and each tool's credentials and Git push setup.
//   node configs.mjs           write them
//   node configs.mjs --check   fail if they are out of date, without writing
// A lockfile is created with `npm install --package-lock-only`, starting from the lockfile already in configs/ (or the
// application's own), so existing versions stay unless a pinned version changes.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { copyAppSource, ROOT } from './lib.mjs';
import { measurements, REPOSITORY, tests, TOOLS, toolFiles } from './project.mjs';

const check = process.argv.includes('--check');
const all = await tests();
const expected = new Map(); // path relative to ROOT -> content

for (const t of all) {
  const tmp = mkdtempSync(join(tmpdir(), 'bmk-configs-'));
  try {
    copyAppSource(t.app, tmp);
    const files = toolFiles(t, tmp);
    if (t.tool.devDependencies) {
      const current = join(ROOT, 'configs', t.toolName, t.appId, 'package-lock.json');
      if (existsSync(current)) writeFileSync(join(tmp, 'package-lock.json'), readFileSync(current));
      writeFileSync(join(tmp, 'package.json'), files['package.json']);
      execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: tmp, stdio: ['ignore', 'ignore', 'inherit'] });
      files['package-lock.json'] = readFileSync(join(tmp, 'package-lock.json'), 'utf8');
    }
    for (const [path, content] of Object.entries(files)) expected.set(join('configs', t.toolName, t.appId, path), content);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// The generated sections of README.md.
const tools = await Promise.all(TOOLS.map(async (name) => ({ name, tool: (await import(`./tools/${name}.mjs`)).default })));
const branchUrl = (branch) => `${REPOSITORY}/tree/${branch}`;
const sections = {
  branches: [
    '| Branch | Application | Tool | Measured |',
    '| --- | --- | --- | --- |',
    ...all.map((t) => {
      const does = measurements(t);
      const measured = [
        does.package && (t.app.kind === 'lambda' ? 'packaging' : 'image size'),
        does.deploy && 'deploy from a laptop',
        does.push && 'Git push'
      ].filter(Boolean);
      return `| [\`${t.branch}\`](${branchUrl(t.branch)}) | \`${t.appId}\` | ${t.tool.docs.name} | ${measured.join(', ')} |`;
    })
  ],
  credentials: [
    '| Tool | What it needs |',
    '| --- | --- |',
    ...tools.map(({ tool }) => `| ${tool.docs.name} | ${tool.docs.credentials.join('<br>')} |`)
  ],
  // Shown for the tool's first application; a branch README has the steps for its own application.
  'git-push-setup': tools.flatMap(({ name, tool }) => {
    const steps = tool.docs.gitPush(all.find((t) => t.toolName === name).app);
    return steps ? [`**${tool.docs.name}**`, '', ...steps.map((s) => `- ${s.replaceAll('this branch', "the test's branch")}`), ''] : [`**${tool.docs.name}**: no Git push test.`, ''];
  })
};
let readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
for (const [key, lines] of Object.entries(sections)) {
  const pattern = new RegExp(`(<!-- generated:${key} -->\\n)[\\s\\S]*?(<!-- /generated:${key} -->)`);
  if (!pattern.test(readme)) throw new Error(`README.md has no generated:${key} section`);
  readme = readme.replace(pattern, `$1\n${lines.join('\n').trimEnd()}\n\n$2`);
}
expected.set('README.md', readme);

// Compare with what is on disk, then write.
const onDisk = (dir) => (existsSync(dir) ? readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => relative(ROOT, join(e.parentPath, e.name))) : []);
const stale = [...expected].filter(([path, content]) => !existsSync(join(ROOT, path)) || readFileSync(join(ROOT, path), 'utf8') !== content).map(([path]) => path);
const extra = onDisk(join(ROOT, 'configs')).filter((path) => !expected.has(path));
if (check) {
  if (stale.length || extra.length) {
    console.error(`Out of date: ${[...stale, ...extra].join(', ')}\nRun node configs.mjs.`);
    process.exit(1);
  }
  console.log('configs/ and README.md are up to date.');
  process.exit(0);
}
rmSync(join(ROOT, 'configs'), { recursive: true, force: true });
for (const [path, content] of expected) {
  mkdirSync(dirname(join(ROOT, path)), { recursive: true });
  writeFileSync(join(ROOT, path), content);
}
console.log(`Wrote configs/ and README.md (${stale.length} changed, ${extra.length} removed).`);
process.exit(0);
