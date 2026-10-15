// Serverless Framework v4. Needs SERVERLESS_ACCESS_KEY (or `serverless login`) in addition to AWS credentials.
// Git push journey: the shared GitHub Actions workflow (Serverless v4 has no Git deployment service of its own).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { capture, findFunctions, REGION, STAGE } from '../lib.mjs';

const VERSION = '4.44.0';
const sls = ['npx', 'serverless'];
const common = ['--stage', STAGE, '--region', REGION];

// No `build` or `package` section. For JavaScript handlers the default is one ZIP of the project, with its
// production node_modules, shared by every function. Serverless bundles with esbuild by default only for TypeScript.
const config = ({ app, name }) => `service: ${name}
frameworkVersion: '${VERSION}'
provider:
  name: aws
  runtime: nodejs22.x
  region: ${REGION}
  memorySize: 512
  timeout: 30
functions:
${app.functions.map((fn) => `  ${fn}:\n    handler: handlers/${fn}.handler`).join('\n')}
`;

export default {
  apps: ['lambda-1', 'lambda-5', 'lambda-25'],
  devDependencies: { serverless: VERSION },
  gitDeploy: 'github-actions',
  files: (ctx) => ({ 'serverless.yml': config(ctx) }),
  version: ({ dir }) => capture(['sh', '-c', 'npx serverless --version 2>&1'], dir).match(/Framework (\S+)/)?.[1],
  buildOutputs: ['.serverless'],
  package: () => [...sls, 'package', ...common],
  artifacts: ({ dir }) =>
    readdirSync(join(dir, '.serverless'))
      .filter((f) => f.endsWith('.zip'))
      .map((f) => ({ file: f, path: join(dir, '.serverless', f) })),
  // `serverless deploy` is the documented deploy. `serverless deploy function` is a separate, opt-in shortcut.
  deploy: () => [...sls, 'deploy', ...common],
  remove: () => [...sls, 'remove', ...common],
  addresses: ({ app, name }) => findFunctions(`${name}-${STAGE}-`, app.functions)
};
