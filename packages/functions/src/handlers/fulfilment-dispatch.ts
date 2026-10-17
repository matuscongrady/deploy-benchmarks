import { enqueue, getOrder, prisma, sqsWorker, stableId } from '@shop/service';
import { z } from 'zod';
import { revision } from './fulfilment-dispatch.revision';

export const handler = sqsWorker({ name: 'fulfilment-dispatch', schema: z.object({ orderId: z.string(), carrier: z.enum(['UPS', 'DHL']).default('UPS') }), sample: { orderId: 'ord_100' } }, async ({ orderId, carrier }) => {
  const order = await getOrder(orderId);
  const weightGrams = (await prisma.product.findMany({ where: { id: { in: order.lines.map((l) => l.productId) } } })).reduce(
    (sum, p) => sum + p.weightGrams * order.lines.find((l) => l.productId === p.id)!.quantity,
    0
  );
  const shipment = await prisma.shipment.create({
    data: { id: stableId('shipment', orderId), orderId, carrier, trackingNumber: 'pending', status: 'label_requested', updatedAt: new Date('2025-01-16T08:00:00Z') }
  });
  const label = enqueue('carrier-labels', { shipmentId: shipment.id, carrier, weightGrams }, orderId);
  return { revision, shipmentId: shipment.id, carrier, weightGrams, queued: label.input.QueueUrl!.split('/').pop() };
});
