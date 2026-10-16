/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app() {
    return { name: 'bmk-sst-lambda-5', home: 'aws', removal: 'remove', providers: { aws: { region: 'eu-west-1' } } };
  },
  async run() {
    new sst.aws.Function('Report', { handler: 'handlers/report.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds', nodejs: { install: ['pdfkit'] } });
    new sst.aws.Function('ProductLookup', { handler: 'handlers/product-lookup.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('CartPricing', { handler: 'handlers/cart-pricing.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('CreateOrder', { handler: 'handlers/create-order.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('Notification', { handler: 'handlers/notification.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
  }
});
