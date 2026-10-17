import { PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { SendMessageCommand } from '@aws-sdk/client-sqs';

const BUS = process.env.EVENT_BUS_NAME ?? 'shop-events';

/** The EventBridge event a function publishes after changing an order. */
export const orderEvent = (type: string, detail: Record<string, unknown>) =>
  new PutEventsCommand({ Entries: [{ EventBusName: BUS, Source: 'shop.orders', DetailType: type, Detail: JSON.stringify(detail) }] });

/** The SQS message that hands work to another worker. */
export const enqueue = (queue: string, body: Record<string, unknown>, groupId?: string) =>
  new SendMessageCommand({ QueueUrl: `https://sqs.eu-west-1.amazonaws.com/000000000000/${queue}`, MessageBody: JSON.stringify(body), MessageGroupId: groupId });
