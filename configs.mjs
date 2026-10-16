// Writes the configuration each tool gets for each application into configs/<tool>/<app>/, so readers can see the
// exact files without running anything. bench.mjs writes the same files into each project, and package.json gets the
// tool's devDependencies.
//   node configs.mjs
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { APPS, githubWorkflow, ROOT } from './lib.mjs';

rmSync(join(ROOT, 'configs'), { recursive: true, force: true });
// cdk-hotswap uses the CDK files unchanged.
for (const file of readdirSync(join(ROOT, 'tools')).filter((f) => f !== 'cdk-hotswap.mjs')) {
  const toolName = file.replace('.mjs', '');
  const tool = (await import(`./tools/${file}`)).default;
  for (const appId of tool.apps) {
    const ctx = { app: APPS[appId], name: `bmk-${toolName}-${appId}`, dir: '.' };
    const files = tool.files(ctx);
    if (tool.gitDeploy === 'github-actions') files['.github/workflows/deploy.yml'] = githubWorkflow(tool.deploy(ctx));
    if (tool.devDependencies) files['devDependencies.json'] = `${JSON.stringify(tool.devDependencies, null, 2)}\n`;
    for (const [path, content] of Object.entries(files)) {
      const out = join(ROOT, 'configs', toolName, appId, path);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, content);
    }
  }
}
console.log('Wrote configs/');
process.exit(0);
