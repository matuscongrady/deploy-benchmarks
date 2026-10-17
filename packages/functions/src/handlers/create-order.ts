import { apiHandler, authenticate, createOrder, enqueue } from '@shop/service';
import { z } from 'zod';
import { revision } from './create-order.revision';

const schema = z.object({ requestId: z.string().min(1), lines: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })).min(1) });
const sample = { requestId: 'req-1', lines: [{ productId: 'coffee', quantity: 2 }, { productId: 'mug', quantity: 1 }] };

export const handler = apiHandler({ name: 'create-order', schema, sample }, async (body, event) => {
  const customerId = await authenticate(event.headers?.authorization);
  const order = await createOrder(customerId, body.requestId, body.lines);
  const next = enqueue('payment-capture', { orderId: order.id });
  return { revision, orderId: order.id, status: order.status, total: order.total.toFixed(2), queued: next.input.QueueUrl!.split('/').pop() };
});
