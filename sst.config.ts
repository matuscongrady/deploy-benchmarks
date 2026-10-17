/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app() {
    return { name: 'bmk-sst-lambda-5', home: 'aws', removal: 'remove', providers: { aws: { region: 'eu-west-1' } } };
  },
  async run() {
    new sst.aws.Function('CreateOrder', { handler: 'packages/functions/src/handlers/create-order.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('PaymentCapture', { handler: 'packages/functions/src/handlers/payment-capture.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('OrderConfirmationEmail', { handler: 'packages/functions/src/handlers/order-confirmation-email.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('FulfilmentDispatch', { handler: 'packages/functions/src/handlers/fulfilment-dispatch.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('SalesReport', { handler: 'packages/functions/src/handlers/sales-report.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds', nodejs: { install: ['pdfkit'] } });
  }
});
