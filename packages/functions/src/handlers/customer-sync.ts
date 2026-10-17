import { appendRowsRequest, getCustomer, sqsWorker } from '@shop/service';
import { isoDay } from '@shop/util';
import { z } from 'zod';
import { revision } from './customer-sync.revision';

export const handler = sqsWorker({ name: 'customer-sync', schema: z.object({ customerId: z.string() }), sample: { customerId: 'cus_9' } }, async ({ customerId }) => {
  const customer = await getCustomer(customerId);
  const request = appendRowsRequest('Customers!A:D', [[customer.id, customer.name, customer.email, isoDay(customer.createdAt)]]);
  return { revision, customerId, rows: request.requestBody.values.length, range: request.range };
});
