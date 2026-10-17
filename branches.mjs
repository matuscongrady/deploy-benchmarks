// Generates one branch per test, named <app>/<tool>, from main's fixtures, tool modules and configs/. Each branch is
// a single commit that holds only that application and that tool's configuration, written by the same function that
// writes bench.mjs's work/ projects.
//   node branches.mjs           create or update the local branches
//   node branches.mjs --push    also force-push them to origin
//   node branches.mjs --check   fail if a branch on origin differs from what main generates
// Run `node configs.mjs` first; it writes the lockfiles the branches contain.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';
import { commitProject, tests, writeProject } from './project.mjs';

const check = process.argv.includes('--check');
const push = process.argv.includes('--push');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

execFileSync('node', ['configs.mjs', '--check'], { cwd: ROOT, stdio: 'inherit' });
if (!check && git('status', '--porcelain', '--untracked-files=no', '--', 'fixtures', 'tools', 'configs', 'lib.mjs', 'project.mjs')) {
  throw new Error('Commit the changes to fixtures/, tools/, configs/, lib.mjs and project.mjs first, so the branches match a commit on main.');
}
if (check) git('fetch', '--quiet', 'origin');

const all = await tests();
const differing = [];
for (const t of all) {
  const tmp = mkdtempSync(join(tmpdir(), 'bmk-branch-'));
  try {
    writeProject(t, tmp);
    const commit = commitProject(t, tmp);
    if (check) {
      let published;
      try {
        published = git('rev-parse', '--verify', '--quiet', `refs/remotes/origin/${t.branch}`);
      } catch {
        published = 'missing';
      }
      if (published !== commit) differing.push(`${t.branch} (origin has ${published.slice(0, 12)}, main generates ${commit.slice(0, 12)})`);
      continue;
    }
    git('fetch', '--quiet', '--force', tmp, `${t.branch}:refs/heads/${t.branch}`);
    console.log(`${t.branch} ${commit.slice(0, 12)}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (check) {
  if (differing.length) {
    console.error(`These branches differ from what main generates:\n  ${differing.join('\n  ')}\nRun node branches.mjs --push.`);
    process.exit(1);
  }
  console.log(`All ${all.length} branches on origin match main.`);
} else if (push) {
  execFileSync('git', ['push', '--force', '--atomic', 'origin', ...all.map((t) => `refs/heads/${t.branch}:refs/heads/${t.branch}`)], { cwd: ROOT, stdio: 'inherit' });
}
process.exit(0);
