import { enqueue, lowStockProducts, scheduledJob } from '@shop/service';
import { revision } from './supplier-reorder.revision';

const REORDER_TO = 50;

export const handler = scheduledJob({ name: 'supplier-reorder' }, async () => {
  const products = await lowStockProducts(10);
  const orders = products.map((p) => ({ productId: p.id, quantity: REORDER_TO - p.stock }));
  const messages = orders.map((o) => enqueue('supplier-orders', o, o.productId));
  return { revision, reorders: orders, queued: messages.length };
});
