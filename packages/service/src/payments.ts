import type Stripe from 'stripe';
import { stripe } from './clients';
import { stableId } from './orders';

const toCents = (amount: { times(n: number): { toNumber(): number } }) => Math.round(amount.times(100).toNumber());

/** The capture request for an order's authorized payment. */
export function captureRequest(order: { id: string; total: Parameters<typeof toCents>[0]; currency: string }) {
  const params: Stripe.PaymentIntentCaptureParams = { amount_to_capture: toCents(order.total), metadata: { orderId: order.id } };
  return { params, idempotencyKey: stableId('capture', order.id) };
}

/** The refund request for part of an order. */
export function refundRequest(orderId: string, amount: Parameters<typeof toCents>[0], reason: Stripe.RefundCreateParams.Reason) {
  const params: Stripe.RefundCreateParams = { payment_intent: `pi_${orderId}`, amount: toCents(amount), reason };
  return { params, idempotencyKey: stableId('refund', orderId) };
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_fixture_only';

/** Verifies a Stripe webhook. A test request without a signature is signed with the fixture secret first. */
export function verifyWebhook(payload: string, signature?: string) {
  const header = signature ?? stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
  return stripe.webhooks.constructEvent(payload, header, webhookSecret);
}
