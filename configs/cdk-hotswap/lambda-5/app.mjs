import { App, Duration, Stack } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

const app = new App();
const stack = new Stack(app, 'bmk-cdk-hotswap-lambda-5', { env: { region: 'eu-west-1' } });
new NodejsFunction(stack, 'create-order', { entry: 'packages/functions/src/handlers/create-order.ts', functionName: 'bmk-cdk-hotswap-lambda-5-create-order', runtime: Runtime.NODEJS_22_X, memorySize: 512, timeout: Duration.seconds(30) });
new NodejsFunction(stack, 'payment-capture', { entry: 'packages/functions/src/handlers/payment-capture.ts', functionName: 'bmk-cdk-hotswap-lambda-5-payment-capture', runtime: Runtime.NODEJS_22_X, memorySize: 512, timeout: Duration.seconds(30) });
new NodejsFunction(stack, 'order-confirmation-email', { entry: 'packages/functions/src/handlers/order-confirmation-email.ts', functionName: 'bmk-cdk-hotswap-lambda-5-order-confirmation-email', runtime: Runtime.NODEJS_22_X, memorySize: 512, timeout: Duration.seconds(30) });
new NodejsFunction(stack, 'fulfilment-dispatch', { entry: 'packages/functions/src/handlers/fulfilment-dispatch.ts', functionName: 'bmk-cdk-hotswap-lambda-5-fulfilment-dispatch', runtime: Runtime.NODEJS_22_X, memorySize: 512, timeout: Duration.seconds(30) });
new NodejsFunction(stack, 'sales-report', { entry: 'packages/functions/src/handlers/sales-report.ts', functionName: 'bmk-cdk-hotswap-lambda-5-sales-report', runtime: Runtime.NODEJS_22_X, memorySize: 512, timeout: Duration.seconds(30), bundling: { nodeModules: ['pdfkit'] } });
