import { prisma, scheduledJob, shipmentsInTransit } from '@shop/service';
import pMap from 'p-map';
import { revision } from './shipment-tracking-sync.revision';

// The carrier's tracking API is not called; a shipment counts as delivered three days after its last update.
export const handler = scheduledJob({ name: 'shipment-tracking-sync' }, async (now) => {
  const shipments = await shipmentsInTransit();
  const updated = await pMap(
    shipments,
    async (s) => {
      const delivered = now.getTime() - s.updatedAt.getTime() > 3 * 86_400_000;
      if (delivered) await prisma.shipment.update({ where: { id: s.id }, data: { status: 'delivered', updatedAt: now } });
      return delivered;
    },
    { concurrency: 4 }
  );
  return { revision, checked: shipments.length, delivered: updated.filter(Boolean).length };
});
