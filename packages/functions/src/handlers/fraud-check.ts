import { getOrder, orderEvent, sqsWorker } from '@shop/service';
import { z } from 'zod';
import { revision } from './fraud-check.revision';

export const handler = sqsWorker({ name: 'fraud-check', schema: z.object({ orderId: z.string(), ipCountry: z.string().length(2) }), sample: { orderId: 'ord_100', ipCountry: 'CZ' } }, async ({ orderId, ipCountry }) => {
  const order = await getOrder(orderId);
  const signals = [order.total.greaterThan(500) && 'large order', !['CZ', 'DE', 'US'].includes(ipCountry) && 'unusual country', order.lines.length > 20 && 'many lines'].filter(Boolean);
  const decision = signals.length ? 'review' : 'approve';
  const event = orderEvent('FraudChecked', { orderId, decision });
  return { revision, orderId, decision, signals, event: event.input.Entries![0].DetailType };
});
