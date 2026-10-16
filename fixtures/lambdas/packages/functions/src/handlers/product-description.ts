import { describeProductRequest, prisma, sqsWorker } from '@shop/service';
import { notFound } from '@shop/util';
import { z } from 'zod';
import { revision } from './product-description.revision';

export const handler = sqsWorker({ name: 'product-description', schema: z.object({ productId: z.string() }), sample: { productId: 'tea' } }, async ({ productId }) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw notFound(`Product ${productId}`);
  const request = describeProductRequest(product);
  return { revision, productId, model: request.model, messages: request.messages.length };
});
