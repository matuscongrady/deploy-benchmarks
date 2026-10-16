/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app() {
    return { name: 'bmk-sst-lambda-25', home: 'aws', removal: 'remove', providers: { aws: { region: 'eu-west-1' } } };
  },
  async run() {
    new sst.aws.Function('Report', { handler: 'handlers/report.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds', nodejs: { install: ['pdfkit'] } });
    new sst.aws.Function('ProductLookup', { handler: 'handlers/product-lookup.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('CartPricing', { handler: 'handlers/cart-pricing.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('CreateOrder', { handler: 'handlers/create-order.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('Notification', { handler: 'handlers/notification.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('ProductSearch', { handler: 'handlers/product-search.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('CategoryList', { handler: 'handlers/category-list.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('InventoryCheck', { handler: 'handlers/inventory-check.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('ReserveStock', { handler: 'handlers/reserve-stock.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('ReleaseStock', { handler: 'handlers/release-stock.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('ShippingQuote', { handler: 'handlers/shipping-quote.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('TaxQuote', { handler: 'handlers/tax-quote.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('ApplyDiscount', { handler: 'handlers/apply-discount.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('PaymentIntent', { handler: 'handlers/payment-intent.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('PaymentWebhook', { handler: 'handlers/payment-webhook.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('OrderStatus', { handler: 'handlers/order-status.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('CancelOrder', { handler: 'handlers/cancel-order.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('ReturnRequest', { handler: 'handlers/return-request.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('CustomerProfile', { handler: 'handlers/customer-profile.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('CustomerToken', { handler: 'handlers/customer-token.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('Invoice', { handler: 'handlers/invoice.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('CatalogImport', { handler: 'handlers/catalog-import.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('CatalogFeed', { handler: 'handlers/catalog-feed.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('DailySummary', { handler: 'handlers/daily-summary.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('ShipmentUpdate', { handler: 'handlers/shipment-update.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
  }
});
