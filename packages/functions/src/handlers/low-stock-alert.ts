import { lowStockProducts, scheduledJob, slackMessage } from '@shop/service';
import { revision } from './low-stock-alert.revision';

export const handler = scheduledJob({ name: 'low-stock-alert' }, async () => {
  const products = await lowStockProducts(5);
  const message = slackMessage('#inventory', 'Low stock', products.map((p) => `${p.name}: ${p.stock} left`));
  return { revision, lowStock: products.map((p) => p.id), channel: message.channel };
});
