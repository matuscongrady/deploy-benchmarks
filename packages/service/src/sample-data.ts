// The rows the fixture database starts with, as PostgreSQL would return them in text form. Dates are fixed so every
// check is repeatable.
export type Row = Record<string, string>;

const rows = (table: string, items: Record<string, string | number>[]) =>
  items.map((item) => ({ __table: table, ...Object.fromEntries(Object.entries(item).map(([k, v]) => [k, String(v)])) }));

export const seed: Record<string, Row[]> = {
  Customer: rows('Customer', [
    { id: 'cus_7', email: 'alex@example.test', name: 'Alex Novak', createdAt: '2024-06-01 08:00:00' },
    { id: 'cus_9', email: 'sam@example.test', name: 'Sam Lee', createdAt: '2024-11-20 17:30:00' }
  ]),
  Product: rows('Product', [
    { id: 'coffee', name: 'Coffee beans', category: 'grocery', price: '12.50', stock: 40, weightGrams: 1000 },
    { id: 'mug', name: 'Ceramic mug', category: 'home', price: '8.00', stock: 3, weightGrams: 500 },
    { id: 'tea', name: 'Green tea', category: 'grocery', price: '6.25', stock: 25, weightGrams: 300 }
  ]),
  Order: rows('Order', [
    { id: 'ord_100', customerId: 'cus_7', status: 'paid', total: '33.00', currency: 'USD', placedAt: '2025-01-15 12:00:00' },
    { id: 'ord_101', customerId: 'cus_9', status: 'pending', total: '18.75', currency: 'USD', placedAt: '2025-01-14 15:45:00' }
  ]),
  OrderLine: rows('OrderLine', [
    { id: 'ol_1', orderId: 'ord_100', productId: 'coffee', quantity: 2, unitPrice: '12.50' },
    { id: 'ol_2', orderId: 'ord_100', productId: 'mug', quantity: 1, unitPrice: '8.00' },
    { id: 'ol_3', orderId: 'ord_101', productId: 'tea', quantity: 3, unitPrice: '6.25' }
  ]),
  Shipment: rows('Shipment', [
    { id: 'shp_1', orderId: 'ord_100', carrier: 'UPS', trackingNumber: '1Z999AA10123456784', status: 'in_transit', updatedAt: '2025-01-16 09:00:00' }
  ])
};
