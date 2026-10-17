/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app() {
    return { name: 'bmk-sst-lambda-25', home: 'aws', removal: 'remove', providers: { aws: { region: 'eu-west-1' } } };
  },
  async run() {
    new sst.aws.Function('CreateOrder', { handler: 'packages/functions/src/handlers/create-order.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('GetOrder', { handler: 'packages/functions/src/handlers/get-order.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('ListProducts', { handler: 'packages/functions/src/handlers/list-products.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('StripeWebhook', { handler: 'packages/functions/src/handlers/stripe-webhook.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('OrderConfirmationEmail', { handler: 'packages/functions/src/handlers/order-confirmation-email.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('PaymentCapture', { handler: 'packages/functions/src/handlers/payment-capture.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('InventoryReservation', { handler: 'packages/functions/src/handlers/inventory-reservation.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('FulfilmentDispatch', { handler: 'packages/functions/src/handlers/fulfilment-dispatch.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('RefundProcessor', { handler: 'packages/functions/src/handlers/refund-processor.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('ReturnRequest', { handler: 'packages/functions/src/handlers/return-request.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('ReviewModeration', { handler: 'packages/functions/src/handlers/review-moderation.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('ProductDescription', { handler: 'packages/functions/src/handlers/product-description.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('LoyaltyPoints', { handler: 'packages/functions/src/handlers/loyalty-points.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('FraudCheck', { handler: 'packages/functions/src/handlers/fraud-check.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('InvoiceEmail', { handler: 'packages/functions/src/handlers/invoice-email.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('CustomerSync', { handler: 'packages/functions/src/handlers/customer-sync.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('DeliveryNotification', { handler: 'packages/functions/src/handlers/delivery-notification.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('SalesReport', { handler: 'packages/functions/src/handlers/sales-report.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds', nodejs: { install: ['pdfkit'] } });
    new sst.aws.Function('ShipmentTrackingSync', { handler: 'packages/functions/src/handlers/shipment-tracking-sync.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('LowStockAlert', { handler: 'packages/functions/src/handlers/low-stock-alert.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('DailySalesSummary', { handler: 'packages/functions/src/handlers/daily-sales-summary.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('AbandonedCartReminder', { handler: 'packages/functions/src/handlers/abandoned-cart-reminder.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('ProductFeedExport', { handler: 'packages/functions/src/handlers/product-feed-export.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('SupplierReorder', { handler: 'packages/functions/src/handlers/supplier-reorder.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
    new sst.aws.Function('DataRetentionCleanup', { handler: 'packages/functions/src/handlers/data-retention-cleanup.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds' });
  }
});
