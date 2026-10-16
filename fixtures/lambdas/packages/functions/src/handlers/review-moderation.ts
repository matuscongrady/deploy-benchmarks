import { moderationRequest, sqsWorker } from '@shop/service';
import { z } from 'zod';
import { revision } from './review-moderation.revision';

const schema = z.object({ reviewId: z.string(), productId: z.string(), rating: z.number().int().min(1).max(5), text: z.string().max(2000) });
const sample = { reviewId: 'rev_1', productId: 'coffee', rating: 5, text: 'Great beans, fresh and fruity.' };

export const handler = sqsWorker({ name: 'review-moderation', schema, sample }, async (review) => {
  const request = moderationRequest(review.text);
  const needsHumanReview = review.rating <= 2 || review.text.length > 1000;
  return { revision, reviewId: review.reviewId, model: request.model, needsHumanReview };
});
