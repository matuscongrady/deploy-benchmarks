import { App, Duration, Stack } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';

// Prisma's generated client reads import.meta.url, which a CommonJS bundle leaves empty, so the functions are bundled
// as ES modules. The banner gives them a `require` for CommonJS dependencies that load Node.js built-ins.
const esm = { format: OutputFormat.ESM, banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" };

const app = new App();
const stack = new Stack(app, 'bmk-cdk-lambda-1', { env: { region: 'eu-west-1' } });
new NodejsFunction(stack, 'sales-report', { entry: 'packages/functions/src/handlers/sales-report.ts', functionName: 'bmk-cdk-lambda-1-sales-report', runtime: Runtime.NODEJS_22_X, memorySize: 512, timeout: Duration.seconds(30), bundling: { ...esm, nodeModules: ['pdfkit'] } });
