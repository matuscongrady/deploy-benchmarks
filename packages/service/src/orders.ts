import { notFound } from '@shop/util';
import { v5 as uuidv5 } from 'uuid';
import { Decimal, prisma } from './db';

/** Changes when this module changes; every response reports it, so a deploy test can tell old code from new. */
export const serviceRevision = 'r1792250603612';

const ID_NAMESPACE = '6f1c4d7e-2b8a-4c3e-9f50-1a2b3c4d5e6f';
/** A stable ID for the same input, so a retried message creates the same record. */
export const stableId = (...parts: string[]) => uuidv5(parts.join('|'), ID_NAMESPACE);

export async function getOrder(id: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: { lines: true, customer: true, shipments: true } });
  if (!order) throw notFound(`Order ${id}`);
  return order;
}

export const ordersPlacedBetween = (from: Date, to: Date) =>
  prisma.order.findMany({ where: { placedAt: { gte: from, lt: to } }, include: { lines: true } });

export const setOrderStatus = (id: string, status: string) => prisma.order.update({ where: { id }, data: { status } });

export async function priceLines(lines: { productId: string; quantity: number }[]) {
  const products = await prisma.product.findMany({ where: { id: { in: lines.map((l) => l.productId) } } });
  const priced = lines.map((line) => {
    const product = products.find((p) => p.id === line.productId);
    if (!product) throw notFound(`Product ${line.productId}`);
    return { ...line, unitPrice: product.price };
  });
  const total = priced.reduce((sum, l) => sum.plus(l.unitPrice.times(l.quantity)), new Decimal(0));
  return { lines: priced, total };
}

export async function createOrder(customerId: string, requestId: string, lines: { productId: string; quantity: number }[]) {
  const priced = await priceLines(lines);
  const id = stableId(customerId, requestId);
  const order = await prisma.order.create({
    data: { id, customerId, status: 'pending', total: priced.total, currency: 'USD', placedAt: new Date('2025-01-15T12:00:00Z') }
  });
  for (const [i, line] of priced.lines.entries()) {
    await prisma.orderLine.create({ data: { id: `${id}-${i}`, orderId: id, productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice } });
  }
  return order;
}

export const getCustomer = async (id: string) => (await prisma.customer.findUnique({ where: { id } })) ?? Promise.reject(notFound(`Customer ${id}`));
export const listProducts = () => prisma.product.findMany({});
export const lowStockProducts = (threshold: number) => prisma.product.findMany({ where: { stock: { lt: threshold } } });
export const shipmentsInTransit = () => prisma.shipment.findMany({ where: { status: 'in_transit' } });
