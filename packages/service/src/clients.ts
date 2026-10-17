// Clients for the services this backend talks to. They are created once per Lambda container, as in most backends.
// The fixture never sends a request through them: each function builds the request it would send and returns it.
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { S3Client } from '@aws-sdk/client-s3';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SQSClient } from '@aws-sdk/client-sqs';
import { auth as googleAuth, sheets } from '@googleapis/sheets';
import { WebClient } from '@slack/web-api';
import nodemailer from 'nodemailer';
import OpenAI from 'openai';
import Stripe from 'stripe';

const region = process.env.AWS_REGION ?? 'eu-west-1';
export const sqs = new SQSClient({ region });
export const eventBridge = new EventBridgeClient({ region });
export const s3 = new S3Client({ region });
export const secrets = new SecretsManagerClient({ region });

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_fixture_only');
export const slack = new WebClient(process.env.SLACK_BOT_TOKEN ?? 'xoxb-fixture-only');
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? 'sk-fixture-only' });
export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'email-smtp.eu-west-1.amazonaws.com',
  port: 587,
  auth: { user: process.env.SMTP_USER ?? 'fixture', pass: process.env.SMTP_PASSWORD ?? 'fixture' }
});
export const spreadsheets = sheets({
  version: 'v4',
  auth: new googleAuth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
});
