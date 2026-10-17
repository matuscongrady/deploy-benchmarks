import { getOrder, slackMessage, sqsWorker } from '@shop/service';
import { daysBetween } from '@shop/util';
import { z } from 'zod';
import { revision } from './return-request.revision';

const schema = z.object({ orderId: z.string(), requestedAt: z.iso.datetime(), reason: z.string() });
const sample = { orderId: 'ord_100', requestedAt: '2025-02-01T10:00:00Z', reason: 'Mug arrived chipped' };

export const handler = sqsWorker({ name: 'return-request', schema, sample }, async (message) => {
  const order = await getOrder(message.orderId);
  const days = daysBetween(order.placedAt, new Date(message.requestedAt));
  const eligible = days <= 30;
  const notice = slackMessage('#returns', `Return request for ${order.id}`, [message.reason, `${days} days after purchase`, eligible ? 'Eligible' : 'Outside the 30-day window']);
  return { revision, orderId: order.id, eligible, days, slackBlocks: notice.blocks.length };
});
