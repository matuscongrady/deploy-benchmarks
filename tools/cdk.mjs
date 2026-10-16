// AWS CDK v2: NodejsFunction for Lambda, ApplicationLoadBalancedFargateService for containers.
// Git push journey: the shared GitHub Actions workflow.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_IMAGES, capture, dockerBuild, dockerfile, imageBytes, REGION, serviceDir, stackOutputs, zipSize } from '../lib.mjs';

const cdk = ['npx', 'cdk'];

function lambdaApp({ app, name }) {
  const functions = app.functions.map((fn) => {
    // PDFKit reads its font files from disk, so it is installed into the function instead of bundled.
    const bundling = fn === 'sales-report' ? `, bundling: { nodeModules: ['pdfkit'] }` : '';
    return `new NodejsFunction(stack, '${fn}', { entry: 'packages/functions/src/handlers/${fn}.ts', functionName: '${name}-${fn}', runtime: Runtime.NODEJS_22_X, memorySize: 512, timeout: Duration.seconds(30)${bundling} });`;
  });
  return `import { App, Duration, Stack } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

const app = new App();
const stack = new Stack(app, '${name}', { env: { region: '${REGION}' } });
${functions.join('\n')}
`;
}

function serviceApp({ app, name }) {
  const services = Object.keys(app.services).map(
    (s) => `
const ${s} = new ApplicationLoadBalancedFargateService(stack, '${s}', {
  cluster, cpu: 256, memoryLimitMiB: 512,
  taskImageOptions: { image: ContainerImage.fromAsset('${serviceDir(app, s)}'), containerPort: 3000 }
});
${s}.targetGroup.configureHealthCheck({ path: '/health' });
new CfnOutput(stack, '${s}Url', { value: \`http://\${${s}.loadBalancer.loadBalancerDnsName}\` });`
  );
  return `import { App, CfnOutput, Stack } from 'aws-cdk-lib';
import { Cluster, ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';

const app = new App();
const stack = new Stack(app, '${name}', { env: { region: '${REGION}' } });
const cluster = new Cluster(stack, 'Cluster');
${services.join('\n')}
`;
}

export default {
  apps: ['lambda-1', 'lambda-5', 'lambda-25', 'node', 'python', 'five-services'],
  // esbuild is installed so NodejsFunction bundles locally; without it CDK bundles inside a Docker container.
  devDependencies: { 'aws-cdk': '2.1145.0', 'aws-cdk-lib': '2.273.0', constructs: '10.8.1', esbuild: '0.28.2' },
  gitDeploy: 'github-actions',
  files(ctx) {
    const { app } = ctx;
    const files = { 'cdk.json': JSON.stringify({ app: 'node app.mjs' }), 'app.mjs': app.kind === 'lambda' ? lambdaApp(ctx) : serviceApp(ctx) };
    if (app.kind === 'service') for (const s of Object.keys(app.services)) Object.assign(files, dockerfile(app, s));
    return files;
  },
  version: ({ dir }) => capture([...cdk, '--version'], dir).split(' ')[0],
  // `cdk bootstrap` prepares the account and region once.
  setup: () => [[...cdk, 'bootstrap']],
  // The image the Dockerfile starts from; it stays pulled between clean builds, like every tool's base images.
  baseImages: ({ app }) => (app.kind === 'service' ? [BASE_IMAGES[app.language]] : []),
  buildOutputs: ['cdk.out'],
  // `cdk synth` bundles each function into cdk.out. CDK zips the asset directories later, during `cdk deploy`, so
  // zipping is not in CDK's packaging time; the upload size zips each directory at zlib's default level, as CDK does.
  // Container images are built only during `cdk deploy`, with `docker build`; the same build here gives the image size.
  package: ({ app, name }) => (app.kind === 'service' ? dockerBuild(app, 'api', name) : [...cdk, 'synth', '--quiet']),
  artifacts: ({ app, name, dir }) =>
    app.kind === 'service'
      ? [{ file: name, bytes: imageBytes(name) }]
      : readdirSync(join(dir, 'cdk.out'))
          .filter((f) => f.startsWith('asset.'))
          .map((f) => ({ file: `${f}.zip`, bytes: zipSize(join(dir, 'cdk.out', f)) })),
  deploy: () => [...cdk, 'deploy', '--require-approval', 'never'],
  remove: () => [...cdk, 'destroy', '--force'],
  addresses({ app, name }) {
    if (app.kind === 'lambda') return Object.fromEntries(app.functions.map((fn) => [fn, `${name}-${fn}`]));
    const outputs = stackOutputs(name);
    return Object.fromEntries(Object.keys(app.services).map((s) => [s, outputs[`${s}Url`]]));
  }
};
