import { composeEmail, getOrder, slackMessage, sqsWorker } from '@shop/service';
import { z } from 'zod';
import { revision } from './delivery-notification.revision';

export const handler = sqsWorker({ name: 'delivery-notification', schema: z.object({ orderId: z.string(), status: z.enum(['delivered', 'failed']) }), sample: { orderId: 'ord_100', status: 'delivered' } }, async ({ orderId, status }) => {
  const order = await getOrder(orderId);
  if (status === 'failed') return { revision, orderId, slack: slackMessage('#fulfilment', `Delivery failed for ${orderId}`, [order.customer.name]).channel };
  const email = await composeEmail(order.customer.email, `Order ${orderId} delivered`, '<p>Your order has arrived. Enjoy!</p>');
  return { revision, orderId, emailed: email.to };
});
