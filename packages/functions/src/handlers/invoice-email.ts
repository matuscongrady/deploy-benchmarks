import { composeEmail, getOrder, sqsWorker } from '@shop/service';
import { isoDay } from '@shop/util';
import { z } from 'zod';
import { revision } from './invoice-email.revision';

export const handler = sqsWorker({ name: 'invoice-email', schema: z.object({ orderId: z.string() }), sample: { orderId: 'ord_100' } }, async ({ orderId }) => {
  const order = await getOrder(orderId);
  const email = await composeEmail(order.customer.email, `Invoice for order ${order.id}`, `<h1>Invoice ${order.id}</h1><p>${isoDay(order.placedAt)}</p><p>Total ${order.total.toFixed(2)} ${order.currency}</p>`);
  return { revision, orderId, total: order.total.toFixed(2), ...email };
});
