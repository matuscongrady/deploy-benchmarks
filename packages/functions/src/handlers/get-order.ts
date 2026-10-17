import { apiHandler, authenticate, getOrder } from '@shop/service';
import { notFound } from '@shop/util';
import { z } from 'zod';
import { revision } from './get-order.revision';

export const handler = apiHandler({ name: 'get-order', schema: z.object({ orderId: z.string() }), sample: { orderId: 'ord_100' } }, async (body, event) => {
  const customerId = await authenticate(event.headers?.authorization);
  const order = await getOrder(body.orderId);
  if (order.customerId !== customerId) throw notFound(`Order ${body.orderId}`);
  return { revision, orderId: order.id, status: order.status, total: order.total.toFixed(2), items: order.lines.length, shipments: order.shipments.length };
});
