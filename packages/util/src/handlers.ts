// Wrappers for the three kinds of Lambda entry point in this backend: SQS workers, scheduled jobs and HTTP APIs.
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import pMap from 'p-map';
import pRetry from 'p-retry';
import { z, ZodError } from 'zod';
import { HttpError } from './errors';
import { logger } from './logger';

type Extra = Record<string, unknown>;

/**
 * Processes each SQS message with retries and reports failed messages back to SQS. Without records (a plain test
 * invocation), the worker processes its sample message.
 */
export function sqsWorker<S extends z.ZodTypeAny>(options: { name: string; schema: S; sample: z.input<S>; extra?: () => Extra }, process: (message: z.output<S>) => Promise<Extra>) {
  return async (event: Partial<SQSEvent> = {}): Promise<SQSBatchResponse & Extra> => {
    const records = event.Records ?? [{ messageId: 'sample', body: JSON.stringify(options.sample) }];
    const batchItemFailures: { itemIdentifier: string }[] = [];
    const results = await pMap(
      records,
      async (record) => {
        try {
          const message = options.schema.parse(JSON.parse(record.body));
          return await pRetry(() => process(message), { retries: 2, minTimeout: 50 });
        } catch (error) {
          logger.error({ err: error, messageId: record.messageId, worker: options.name }, 'Message failed');
          batchItemFailures.push({ itemIdentifier: record.messageId! });
          return undefined;
        }
      },
      { concurrency: 5 }
    );
    logger.info({ worker: options.name, processed: records.length, failed: batchItemFailures.length }, 'Batch done');
    return { batchItemFailures, results, ...options.extra?.() };
  };
}

/** Runs a scheduled job. */
export function scheduledJob(options: { name: string; extra?: () => Extra }, run: (now: Date) => Promise<Extra>) {
  return async (event: { time?: string } = {}) => {
    const result = await run(new Date(event.time ?? '2025-01-16T06:00:00Z'));
    logger.info({ job: options.name }, 'Job done');
    return { ...result, ...options.extra?.() };
  };
}

/** Handles an HTTP API request: validates the body, maps errors to status codes and returns JSON. */
export function apiHandler<S extends z.ZodTypeAny>(
  options: { name: string; schema: S; sample: z.input<S>; extra?: () => Extra },
  handle: (body: z.output<S>, event: APIGatewayProxyEventV2) => Promise<Extra>
) {
  return async (event: Partial<APIGatewayProxyEventV2> = {}): Promise<APIGatewayProxyResultV2> => {
    const json = (statusCode: number, body: Extra) => ({ statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, ...options.extra?.() }) });
    try {
      const body = options.schema.parse(event.body ? JSON.parse(event.body) : options.sample);
      return json(200, await handle(body, event as APIGatewayProxyEventV2));
    } catch (error) {
      if (error instanceof ZodError) return json(400, { error: 'Invalid request', issues: error.issues });
      if (error instanceof HttpError) return json(error.statusCode, { error: error.message });
      logger.error({ err: error, api: options.name }, 'Request failed');
      return json(500, { error: 'Internal error' });
    }
  };
}
