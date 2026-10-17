import { getOrder, sqsWorker } from '@shop/service';
import { z } from 'zod';
import { revision } from './loyalty-points.revision';

// One point per whole currency unit, doubled for orders over 30.
export const handler = sqsWorker({ name: 'loyalty-points', schema: z.object({ orderId: z.string() }), sample: { orderId: 'ord_100' } }, async ({ orderId }) => {
  const order = await getOrder(orderId);
  const base = Math.floor(order.total.toNumber());
  return { revision, customerId: order.customerId, points: order.total.greaterThan(30) ? base * 2 : base };
});
