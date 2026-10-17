import { getOrder, listProducts, sqsWorker } from '@shop/service';
import { conflict } from '@shop/util';
import { z } from 'zod';
import { revision } from './inventory-reservation.revision';

export const handler = sqsWorker({ name: 'inventory-reservation', schema: z.object({ orderId: z.string() }), sample: { orderId: 'ord_100' } }, async ({ orderId }) => {
  const [order, products] = await Promise.all([getOrder(orderId), listProducts()]);
  const remaining = order.lines.map((line) => {
    const stock = products.find((p) => p.id === line.productId)!.stock - line.quantity;
    if (stock < 0) throw conflict(`Not enough ${line.productId}`);
    return { productId: line.productId, remaining: stock };
  });
  return { revision, orderId, reserved: order.lines.length, remaining };
});
