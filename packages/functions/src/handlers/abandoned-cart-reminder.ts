import { composeEmail, prisma, scheduledJob } from '@shop/service';
import pMap from 'p-map';
import { revision } from './abandoned-cart-reminder.revision';

// Pending orders older than a day get one reminder email.
export const handler = scheduledJob({ name: 'abandoned-cart-reminder' }, async (now) => {
  const pending = await prisma.order.findMany({ where: { status: 'pending', placedAt: { lt: new Date(now.getTime() - 86_400_000) } }, include: { customer: true } });
  const emails = await pMap(pending, (o) => composeEmail(o.customer.email, 'You left something in your cart', `<p>Your order ${o.id} is waiting.</p>`), { concurrency: 5 });
  return { revision, reminded: emails.map((e) => e.to) };
});
