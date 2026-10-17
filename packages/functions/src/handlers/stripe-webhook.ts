import { apiHandler, orderEvent, setOrderStatus, verifyWebhook } from '@shop/service';
import type Stripe from 'stripe';
import { z } from 'zod';
import { revision } from './stripe-webhook.revision';

const samplePayload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'payment_intent.succeeded', data: { object: { id: 'pi_1', metadata: { orderId: 'ord_101' } } } });

export const handler = apiHandler({ name: 'stripe-webhook', schema: z.object({ payload: z.string(), signature: z.string().optional() }), sample: { payload: samplePayload } }, async (body) => {
  const event = verifyWebhook(body.payload, body.signature);
  const orderId = (event.data.object as Stripe.PaymentIntent).metadata.orderId;
  if (event.type === 'payment_intent.succeeded') await setOrderStatus(orderId, 'paid');
  const published = orderEvent('OrderPaid', { orderId });
  return { revision, accepted: true, type: event.type, orderId, published: published.input.Entries![0].DetailType };
});
