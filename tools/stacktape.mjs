// Stacktape, run from the binary in STACKTAPE_BIN (a release build of the CLI).
// Stacktape deploys into an AWS account connected in the Stacktape Console, with credentials the Console issues, not
// with AWS_PROFILE. STACKTAPE_AWS_ACCOUNT names that connection; it must be the account AWS_PROFILE points to.
// Git push journey: Stacktape Console GitOps (the project's GitHub repository connected in the Console). The Console
// runner uses the Stacktape version configured in the Console, not STACKTAPE_BIN.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { capture, findFunctions, imageBytes, REGION, serviceDir, STAGE, stackOutputs, zipSize } from '../lib.mjs';

// `docs` is set when the commands are written into a branch README rather than run.
const bin = ({ docs } = {}) => (docs ? 'stacktape' : (process.env.STACKTAPE_BIN ?? 'stacktape'));
const common = ['--stage', STAGE, '--region', REGION];
function account({ docs }) {
  if (docs) return ['--awsAccount', '<connection-name>'];
  if (!process.env.STACKTAPE_AWS_ACCOUNT) throw new Error('Set STACKTAPE_AWS_ACCOUNT to the Console connection name of the AWS account to deploy to');
  return ['--awsAccount', process.env.STACKTAPE_AWS_ACCOUNT];
}
const camel = (s) => s.replace(/-(.)/g, (_, c) => c.toUpperCase());

function config({ app, name }) {
  const resources = {};
  if (app.kind === 'lambda') {
    for (const fn of app.functions) {
      const packaging = { entryfilePath: `packages/functions/src/handlers/${fn}.ts` };
      resources[camel(fn)] = {
        type: 'function',
        properties: { packaging: { type: 'js-bundle', properties: packaging }, runtime: 'nodejs22.x', memory: 512, timeout: 30 }
      };
    }
    return { projectName: name, resources };
  }
  for (const service of Object.keys(app.services)) {
    const dir = serviceDir(app, service);
    // Stacktape's docs recommend js-bundle for a Node.js server with one entry file and buildpack for Python.
    const packaging =
      app.language === 'python'
        ? { type: 'buildpack', properties: { sourceDirectoryPath: dir } }
        : { type: 'js-bundle', properties: { entryfilePath: join(dir, 'server.mjs') } };
    resources[service] = { type: 'web-service', properties: { packaging, resources: { cpu: 0.25, memory: 512 } } };
  }
  const outputs = Object.keys(app.services).map((s) => ({ name: `${s}Url`, value: `$ResourceParam('${s}', 'url')` }));
  return { projectName: name, resources, stackConfig: { outputs } };
}

export default {
  apps: ['lambda-1', 'lambda-5', 'lambda-25', 'container-node', 'container-python', 'five-services'],
  docs: {
    name: 'Stacktape',
    account: 'a Stacktape account with the AWS account connected',
    version:
      'The Stacktape CLI built from source of [stacktape/stacktape](https://github.com/stacktape/stacktape), as described in the main README. Each result records the commit (`stacktapeCommit`).',
    credentials: [
      '`AWS_PROFILE`: a profile for the disposable AWS account. The harness uses it to call the deployed code and read stack outputs.',
      '`STACKTAPE_API_KEY`, or run `stacktape login` once.',
      '`STACKTAPE_AWS_ACCOUNT`: the name of the AWS account connection in the Stacktape Console. Stacktape deploys with credentials from that connection, not with `AWS_PROFILE`, so check with `stacktape info:whoami` that both point to the same account.',
      '`STACKTAPE_BIN`: the path of the Stacktape binary to measure.'
    ],
    gitPush: () => [
      'In the Stacktape Console, connect your fork and this branch to the project, with the stage `bmk` in `eu-west-1`. The Console runner builds in your AWS account with the Stacktape version set in the Console, so set the version you measure there.',
      "To empty the runner's caches before each first push, delete the project's runner in the Console and pass `--cold-reset manual`."
    ]
  },
  // JSON is valid YAML.
  files: (ctx) => ({ 'stacktape.yml': JSON.stringify(config(ctx), null, 2) }),
  version: () => capture([bin(), 'version']).match(/version: (\S+?)\.?$/m)?.[1],
  buildOutputs: ['.stacktape'],
  package: (ctx) => [bin(ctx), 'package', ...common],
  // `package` writes the function ZIPs and, beside them, the source maps that deploy uploads separately
  // (`*.source-maps.json`, gzip-compressed as `*.source-maps.json.gz` by newer builds). Shared layers are zipped only
  // during deploy, so we zip their directories here, storing their `node_modules` links as links as Stacktape's own
  // archive does. Container images go to the local Docker image store.
  artifacts({ app, dir }) {
    if (app.kind === 'service') return [{ file: 'api-service-container', bytes: imageBytes('api-service-container:latest') }];
    const [invocation] = readdirSync(join(dir, '.stacktape'));
    const build = join(dir, '.stacktape', invocation, 'build');
    const files = readdirSync(join(build, 'lambdas')).filter((f) => f.endsWith('.zip') || /\.source-maps\.json(\.gz)?$/.test(f));
    const layerDir = join(build, 'layers');
    const layers = existsSync(layerDir) ? readdirSync(layerDir, { withFileTypes: true }) : [];
    return [
      ...files.map((f) => ({ file: `lambdas/${f}`, path: join(build, 'lambdas', f) })),
      ...layers.map((e) =>
        e.isDirectory() ? { file: `layers/${e.name}.zip`, bytes: zipSize(join(layerDir, e.name), { symlinks: true }) } : { file: `layers/${e.name}`, path: join(layerDir, e.name) }
      )
    ];
  },
  // Code-only changes are updated directly (without CloudFormation) by the default deploy.
  deploy: (ctx) => [bin(ctx), 'deploy', ...common, ...account(ctx), '--autoConfirmOperation'],
  remove: (ctx) => [bin(ctx), 'delete', ...common, ...account(ctx), '--autoConfirmOperation'],
  addresses({ app, name }) {
    if (app.kind === 'lambda') return findFunctions(`${name}-${STAGE}-`, app.functions);
    const outputs = stackOutputs(`${name}-${STAGE}`);
    return Object.fromEntries(Object.keys(app.services).map((s) => [s, outputs[`${s}Url`]]));
  }
};
