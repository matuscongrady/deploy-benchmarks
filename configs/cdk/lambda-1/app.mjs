import { App, Duration, Stack } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

const app = new App();
const stack = new Stack(app, 'bmk-cdk-lambda-1', { env: { region: 'eu-west-1' } });
new NodejsFunction(stack, 'report', { entry: 'handlers/report.mjs', functionName: 'bmk-cdk-lambda-1-report', runtime: Runtime.NODEJS_22_X, memorySize: 512, timeout: Duration.seconds(30), bundling: { nodeModules: ['pdfkit'] } });
