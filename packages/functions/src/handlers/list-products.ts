import { apiHandler, listProducts } from '@shop/service';
import { z } from 'zod';
import { revision } from './list-products.revision';

export const handler = apiHandler({ name: 'list-products', schema: z.object({ category: z.string().optional() }), sample: { category: 'grocery' } }, async (body) => {
  const products = (await listProducts()).filter((p) => !body.category || p.category === body.category);
  return { revision, products: products.map((p) => ({ id: p.id, name: p.name, price: p.price.toFixed(2) })) };
});
