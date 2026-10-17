import { App, Duration, Stack } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

const app = new App();
const stack = new Stack(app, 'bmk-cdk-hotswap-lambda-1', { env: { region: 'eu-west-1' } });
new NodejsFunction(stack, 'sales-report', { entry: 'packages/functions/src/handlers/sales-report.ts', functionName: 'bmk-cdk-hotswap-lambda-1-sales-report', runtime: Runtime.NODEJS_22_X, memorySize: 512, timeout: Duration.seconds(30), bundling: { nodeModules: ['pdfkit'] } });
