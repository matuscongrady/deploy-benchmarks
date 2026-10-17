import { Decimal, getOrder, refundRequest, setOrderStatus, sqsWorker } from '@shop/service';
import { z } from 'zod';
import { revision } from './refund-processor.revision';

const schema = z.object({ orderId: z.string(), productId: z.string(), quantity: z.number().int().positive() });

export const handler = sqsWorker({ name: 'refund-processor', schema, sample: { orderId: 'ord_100', productId: 'mug', quantity: 1 } }, async (message) => {
  const order = await getOrder(message.orderId);
  const line = order.lines.find((l) => l.productId === message.productId)!;
  const refund = refundRequest(order.id, new Decimal(line.unitPrice).times(message.quantity), 'requested_by_customer');
  await setOrderStatus(order.id, 'partially_refunded');
  return { revision, orderId: order.id, amount: refund.params.amount, idempotencyKey: refund.idempotencyKey };
});
