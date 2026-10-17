import { captureRequest, getOrder, orderEvent, sqsWorker } from '@shop/service';
import { z } from 'zod';
import { revision } from './payment-capture.revision';

export const handler = sqsWorker({ name: 'payment-capture', schema: z.object({ orderId: z.string() }), sample: { orderId: 'ord_100' } }, async ({ orderId }) => {
  const order = await getOrder(orderId);
  const capture = captureRequest(order);
  const event = orderEvent('PaymentCaptureRequested', { orderId, amount: capture.params.amount_to_capture });
  return { revision, orderId, amount: capture.params.amount_to_capture, idempotencyKey: capture.idempotencyKey, event: event.input.Entries![0].DetailType };
});
