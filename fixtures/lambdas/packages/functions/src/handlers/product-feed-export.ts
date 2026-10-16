import { exportFile, listProducts, scheduledJob } from '@shop/service';
import { isoDay } from '@shop/util';
import { revision } from './product-feed-export.revision';

export const handler = scheduledJob({ name: 'product-feed-export' }, async (now) => {
  const products = await listProducts();
  const csv = ['id,title,price,availability', ...products.map((p) => `${p.id},"${p.name}",${p.price.toFixed(2)} USD,${p.stock > 0 ? 'in_stock' : 'out_of_stock'}`)].join('\n');
  const put = exportFile(`feeds/${isoDay(now)}/products.csv`, csv, 'text/csv');
  return { revision, products: products.length, key: put.input.Key, bytes: csv.length };
});
