import { App, Duration, Stack } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

const app = new App();
const stack = new Stack(app, 'bmk-cdk-lambda-5', { env: { region: 'eu-west-1' } });
new NodejsFunction(stack, 'report', { entry: 'handlers/report.mjs', functionName: 'bmk-cdk-lambda-5-report', runtime: Runtime.NODEJS_22_X, memorySize: 512, timeout: Duration.seconds(30), bundling: { nodeModules: ['pdfkit'] } });
new NodejsFunction(stack, 'product-lookup', { entry: 'handlers/product-lookup.mjs', functionName: 'bmk-cdk-lambda-5-product-lookup', runtime: Runtime.NODEJS_22_X, memorySize: 512, timeout: Duration.seconds(30) });
new NodejsFunction(stack, 'cart-pricing', { entry: 'handlers/cart-pricing.mjs', functionName: 'bmk-cdk-lambda-5-cart-pricing', runtime: Runtime.NODEJS_22_X, memorySize: 512, timeout: Duration.seconds(30) });
new NodejsFunction(stack, 'create-order', { entry: 'handlers/create-order.mjs', functionName: 'bmk-cdk-lambda-5-create-order', runtime: Runtime.NODEJS_22_X, memorySize: 512, timeout: Duration.seconds(30) });
new NodejsFunction(stack, 'notification', { entry: 'handlers/notification.mjs', functionName: 'bmk-cdk-lambda-5-notification', runtime: Runtime.NODEJS_22_X, memorySize: 512, timeout: Duration.seconds(30) });
