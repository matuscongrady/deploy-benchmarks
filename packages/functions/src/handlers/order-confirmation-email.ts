import { composeEmail, getOrder, sqsWorker } from '@shop/service';
import { z } from 'zod';
import { revision } from './order-confirmation-email.revision';

export const handler = sqsWorker({ name: 'order-confirmation-email', schema: z.object({ orderId: z.string() }), sample: { orderId: 'ord_100' } }, async ({ orderId }) => {
  const order = await getOrder(orderId);
  const items = order.lines.map((l) => `<li>${l.quantity} × ${l.productId}</li>`).join('');
  const email = await composeEmail(order.customer.email, `Order ${order.id} confirmed`, `<p>Thanks, ${order.customer.name}!</p><ul>${items}</ul><p>Total ${order.total.toFixed(2)} ${order.currency}</p>`);
  return { revision, ...email };
});
