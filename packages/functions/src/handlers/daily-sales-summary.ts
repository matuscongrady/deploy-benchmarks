import { appendRowsRequest, Decimal, ordersPlacedBetween, scheduledJob } from '@shop/service';
import { isoDay, plusDays } from '@shop/util';
import { revision } from './daily-sales-summary.revision';

export const handler = scheduledJob({ name: 'daily-sales-summary' }, async (now) => {
  const day = new Date(`${isoDay(plusDays(now, -1))}T00:00:00Z`);
  const orders = await ordersPlacedBetween(day, plusDays(day, 1));
  const revenue = orders.reduce((sum, o) => sum.plus(o.total), new Decimal(0));
  const request = appendRowsRequest('Daily!A:C', [[isoDay(day), orders.length, revenue.toFixed(2)]]);
  return { revision, day: isoDay(day), orders: orders.length, revenue: revenue.toFixed(2), range: request.range };
});
