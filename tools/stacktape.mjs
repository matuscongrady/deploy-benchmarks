// Stacktape, run from the binary in STACKTAPE_BIN (a release build of the CLI).
// Stacktape deploys into an AWS account connected in the Stacktape Console, with credentials the Console issues, not
// with AWS_PROFILE. STACKTAPE_AWS_ACCOUNT names that connection; it must be the account AWS_PROFILE points to.
// Git push journey: Stacktape Console GitOps (the project's GitHub repository connected in the Console). The Console
// runner uses the Stacktape version configured in the Console, not STACKTAPE_BIN.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { capture, findFunctions, imageBytes, REGION, serviceDir, STAGE, stackOutputs, zipSize } from '../lib.mjs';

const bin = process.env.STACKTAPE_BIN ?? 'stacktape';
const common = ['--stage', STAGE, '--region', REGION];
function account() {
  if (!process.env.STACKTAPE_AWS_ACCOUNT) throw new Error('Set STACKTAPE_AWS_ACCOUNT to the Console connection name of the AWS account to deploy to');
  return ['--awsAccount', process.env.STACKTAPE_AWS_ACCOUNT];
}
const camel = (s) => s.replace(/-(.)/g, (_, c) => c.toUpperCase());

function config({ app, name }) {
  const resources = {};
  if (app.kind === 'lambda') {
    for (const fn of app.functions) {
      const packaging = { entryfilePath: `handlers/${fn}.mjs` };
      // PDFKit reads its font files from disk, so it cannot be bundled.
      if (fn === 'report') packaging.dependenciesToExcludeFromBundle = ['pdfkit'];
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
  apps: ['lambda-1', 'lambda-5', 'lambda-25', 'node', 'python', 'five-services'],
  // JSON is valid YAML.
  files: (ctx) => ({ 'stacktape.yml': JSON.stringify(config(ctx), null, 2) }),
  version: () => capture([bin, 'version']).match(/version: (\S+?)\.?$/m)?.[1],
  buildOutputs: ['.stacktape'],
  package: () => [bin, 'package', ...common],
  // `package` writes the function ZIPs. Shared layers are zipped only during deploy, so we zip them here.
  // Container images go to the local Docker image store.
  artifacts({ app, dir }) {
    if (app.kind === 'service') return [{ file: 'api-service-container', bytes: imageBytes('api-service-container:latest') }];
    const [invocation] = readdirSync(join(dir, '.stacktape'));
    const build = join(dir, '.stacktape', invocation, 'build');
    const zips = readdirSync(join(build, 'lambdas')).filter((f) => f.endsWith('.zip'));
    const layerDir = join(build, 'layers');
    const layers = existsSync(layerDir) ? readdirSync(layerDir) : [];
    return [
      ...zips.map((f) => ({ file: `lambdas/${f}`, path: join(build, 'lambdas', f) })),
      ...layers.map((layer) => ({ file: `layers/${layer}.zip`, bytes: zipSize(join(layerDir, layer)) }))
    ];
  },
  // Code-only changes are updated directly (without CloudFormation) by the default deploy.
  deploy: () => [bin, 'deploy', ...common, ...account(), '--autoConfirmOperation'],
  remove: () => [bin, 'delete', ...common, ...account(), '--autoConfirmOperation'],
  addresses({ app, name }) {
    if (app.kind === 'lambda') return findFunctions(`${name}-${STAGE}-`, app.functions);
    const outputs = stackOutputs(`${name}-${STAGE}`);
    return Object.fromEntries(Object.keys(app.services).map((s) => [s, outputs[`${s}Url`]]));
  }
};
