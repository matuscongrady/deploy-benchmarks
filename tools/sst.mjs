// SST v4 (Pulumi-based): sst.aws.Function for Lambda, sst.aws.Service on an SST cluster for containers.
// Git push journey: the shared GitHub Actions workflow. (SST's own Autodeploy needs an SST Console account.)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_IMAGES, capture, dockerBuild, dockerfile, findFunctions, imageBytes, REGION, serviceDir, STAGE } from '../lib.mjs';

const sst = ['npx', 'sst'];
const pascal = (s) => s.replace(/(^|-)(.)/g, (_, __, c) => c.toUpperCase());

function config({ app, name }) {
  let body;
  if (app.kind === 'lambda') {
    body = app.functions
      .map((fn) => {
        // PDFKit reads its font files from disk, so it is installed into the function instead of bundled.
        const install = fn === 'sales-report' ? `, nodejs: { install: ['pdfkit'] }` : '';
        return `    new sst.aws.Function('${pascal(fn)}', { handler: 'packages/functions/src/handlers/${fn}.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds'${install} });`;
      })
      .join('\n');
  } else {
    const services = Object.keys(app.services).map(
      (s) => `    const ${s} = new sst.aws.Service('${pascal(s)}', {
      cluster, cpu: '0.25 vCPU', memory: '0.5 GB', image: { context: '${serviceDir(app, s)}' },
      loadBalancer: { ports: [{ listen: '80/http', forward: '3000/http' }], health: { '3000/http': { path: '/health' } } }
    });`
    );
    body = `    const cluster = new sst.aws.Cluster('Cluster', { vpc: new sst.aws.Vpc('Vpc') });
${services.join('\n')}
    return { ${Object.keys(app.services).map((s) => `${s}Url: ${s}.url`).join(', ')} };`;
  }
  return `/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app() {
    return { name: '${name}', home: 'aws', removal: 'remove', providers: { aws: { region: '${REGION}' } } };
  },
  async run() {
${body}
  }
});
`;
}

export default {
  apps: ['lambda-1', 'lambda-5', 'lambda-25', 'node', 'python', 'five-services'],
  devDependencies: { sst: '4.17.2' },
  gitDeploy: 'github-actions',
  files(ctx) {
    const files = { 'sst.config.ts': config(ctx) };
    if (ctx.app.kind === 'service') for (const s of Object.keys(ctx.app.services)) Object.assign(files, dockerfile(ctx.app, s));
    return files;
  },
  version: ({ dir }) => capture([...sst, 'version'], dir).split(' ').pop(),
  setup: () => [[...sst, 'install']],
  // The image the Dockerfile starts from; it stays pulled between clean builds, like every tool's base images.
  baseImages: ({ app }) => (app.kind === 'service' ? [BASE_IMAGES[app.language]] : []),
  buildOutputs: ['.sst/artifacts'],
  // SST has no packaging-only command. `sst diff` on a deployed stage builds and zips every function, then compares
  // the plan with the deployed state, so its time includes reading that state from AWS.
  // Container images are built during `sst deploy` with `docker build`; the same build here gives the image size.
  package: ({ app, name }) => (app.kind === 'service' ? dockerBuild(app, 'api', name) : [...sst, 'diff', '--stage', STAGE]),
  artifacts({ app, name, dir }) {
    if (app.kind === 'service') return [{ file: name, bytes: imageBytes(name) }];
    // Each function's code.zip, plus its source map, which SST uploads next to the ZIP rather than inside it.
    const root = join(dir, '.sst/artifacts');
    return readdirSync(root, { recursive: true })
      .filter((f) => f.endsWith('/code.zip') || /^[^/]+-src\/[^/]+\.map$/.test(f))
      .map((f) => ({ file: f, path: join(root, f) }));
  },
  deploy: () => [...sst, 'deploy', '--stage', STAGE],
  remove: () => [...sst, 'remove', '--stage', STAGE],
  addresses({ app, name, dir }) {
    if (app.kind === 'lambda') return findFunctions(`${name}-${STAGE}-`, app.functions);
    const outputs = JSON.parse(readFileSync(join(dir, '.sst/outputs.json'), 'utf8'));
    return Object.fromEntries(Object.keys(app.services).map((s) => [s, outputs[`${s}Url`]]));
  }
};
