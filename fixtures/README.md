# Applications used in the tests

These are small commerce applications, with code that does actual work. They are not copies of one handler with different names. The same source and dependency locks go to every platform.

The tests measure building and updating an application. They do not measure database speed, payment processing or email delivery. Product data lives in the source tree, dates are fixed and external operations return a result rather than contacting another service. That keeps the result checks repeatable and avoids charging a real card or sending real email.

## Check an application locally

Each application has a check that runs its business logic without any cloud account:

```sh
cd fixtures/lambdas && npm ci && npm run check
cd fixtures/containers/node && npm ci && node check.mjs
cd fixtures/containers/python && uv venv --python 3.11.14 .venv && uv pip install --python .venv/bin/python --require-hashes -r requirements-check.txt && .venv/bin/python check.py
```

The benchmark runner does not run these checks. It checks the deployed applications after every run instead.

## Lambda applications

`lambdas/` is the backend of a small online shop, set up the way many teams build a Lambda backend: an npm
workspace with one package of functions and two shared packages that nearly every function imports.

| Package | What it holds |
| --- | --- |
| `packages/util` | Logging (pino), errors, date helpers (date-fns, date-fns-tz), retries (p-retry), concurrency (p-map), validation (zod) |
| `packages/service` | The database layer (Prisma with `@prisma/adapter-pg` and `pg`), the AWS clients (SQS, S3, EventBridge, Secrets Manager), API tokens (jose), and the clients of the outside services: Stripe, Slack, Google Sheets, OpenAI and email (Nodemailer) |
| `packages/functions` | 25 handlers in `src/handlers/`: 4 HTTP APIs, 13 SQS queue workers and 8 scheduled jobs |

`packages/service` exports everything from one entry point and creates its clients once per Lambda container, as most
backends do. Every function therefore bundles the whole service package, including every SDK, even when it uses only
one client. That is what makes the 25-function application heavy, and it is the case shared layers and per-function
bundling handle differently.

`prisma generate` runs on `npm ci` (a `postinstall` script of `packages/service`) and writes the Prisma client to
`packages/service/src/generated/`. It runs for every tool during setup and is not timed.

The three Lambda applications are the same project with a different set of handlers:

| Application | Functions | Code edit for a rebuild or deployment |
| --- | --- | --- |
| 1 function | `sales-report` | Its revision file |
| 5 functions | `create-order`, `payment-capture`, `order-confirmation-email`, `fulfilment-dispatch`, `sales-report`: one API, three workers and one scheduled job | All five revision files, or the shared service package |
| 25 functions | All handlers below | All 25 revision files, or the shared service package |

| Handler | Trigger | Work performed |
| --- | --- | --- |
| `create-order` | API | Authenticate the customer's token, create the order and queue its payment capture |
| `get-order` | API | Return one of the customer's orders with its lines and shipment |
| `list-products` | API | List the catalog, optionally by category |
| `stripe-webhook` | API | Verify the Stripe signature of a payment event and mark the order paid |
| `order-confirmation-email` | SQS | Compose the confirmation email for an order |
| `payment-capture` | SQS | Build the Stripe capture request and the order event |
| `inventory-reservation` | SQS | Check stock for each order line |
| `fulfilment-dispatch` | SQS | Create the shipment and queue the delivery notification |
| `refund-processor` | SQS | Build a Stripe refund and update the order |
| `return-request` | SQS | Check a return against the 30-day window and notify the team on Slack |
| `review-moderation` | SQS | Build the OpenAI moderation request for a product review |
| `product-description` | SQS | Build the OpenAI request for a product description |
| `loyalty-points` | SQS | Calculate the points an order earns |
| `fraud-check` | SQS | Score an order and emit the result as an event |
| `invoice-email` | SQS | Compose the invoice email |
| `customer-sync` | SQS | Build the Google Sheets row for a customer |
| `delivery-notification` | SQS | Compose the delivery email and the Slack message |
| `sales-report` | Schedule | Build the day's sales report as a PDF, an Excel workbook and a Word document (PDFKit, ExcelJS, docx) |
| `shipment-tracking-sync` | Schedule | Mark shipments in transit as delivered |
| `low-stock-alert` | Schedule | Post the products low on stock to Slack |
| `daily-sales-summary` | Schedule | Total the day's orders and build the Google Sheets row |
| `abandoned-cart-reminder` | Schedule | Compose a reminder for pending orders older than a day |
| `product-feed-export` | Schedule | Export the catalog as CSV for marketplaces |
| `supplier-reorder` | Schedule | Queue a reorder for each product low on stock |
| `data-retention-cleanup` | Schedule | Find shipments delivered more than 90 days ago |

**No outside services.** The functions build every request they would send (to SQS, S3, EventBridge, Stripe, Slack,
Google, OpenAI or the mail server) and return it instead of sending it. The database is the one exception: the
`pg` pool in `packages/service/src/fixture-database.ts` answers Prisma's SQL from the in-memory tables in
`sample-data.ts`, so Prisma, its driver adapter and `pg` run their real code without a PostgreSQL server. Writes are
returned but not kept, so repeated calls give the same answer. These two files exist only for the benchmark. The
tokens and keys in the source (`sk_test_fixture_only` and similar) are placeholders, not credentials.

**Libraries.** We picked the most downloaded package for each job, unless a backend like this one usually uses
another. Downloads from npm for 13 September to 12 October 2026:

| Job | Chosen | Downloads | Alternatives |
| --- | --- | --- | --- |
| Validation | zod | 1,432 M | joi 118 M |
| IDs | uuid | 1,353 M | nanoid 1,191 M |
| API tokens | jose | 645 M | jsonwebtoken 265 M |
| Dates | date-fns, date-fns-tz | 454 M, 49 M | dayjs 331 M |
| Concurrency, retries | p-map, p-retry | 365 M, 249 M | |
| Logging | pino | 234 M | winston 124 M |
| Database driver | pg | 268 M | |
| ORM | Prisma (`@prisma/client`, `@prisma/adapter-pg`) | 78 M, 28 M | drizzle-orm 115 M, kysely 84 M, typeorm 24 M |
| AWS | `@aws-sdk/client-s3`, `-secrets-manager`, `-sqs`, `-eventbridge` | 212 M, 58 M, 55 M, 15 M | |
| AI | openai | 186 M | |
| Email | nodemailer | 109 M | resend 55 M |
| Payments | stripe | 101 M | |
| Chat | `@slack/web-api` | 62 M | |
| Spreadsheets | `@googleapis/sheets` | 7 M | googleapis 48 M |
| Documents | exceljs, pdfkit, docx | 75 M, 43 M, 29 M | |

Two choices are not the most downloaded: Prisma, because it is the ORM of the backends this one is modelled on, and
`@googleapis/sheets`, the per-API package Google recommends over the full `googleapis` package (about 250 MB
installed).

**Business check.** `npm run check` calls every handler with the input the benchmark sends after a deploy (`{}`, so
each handler uses its sample request) and compares the result with `manifest.json`. The sample order has two coffees
at USD 12.50 and one mug at USD 8.00, so order totals are `33.00`. The sales report must contain a PDF (`%PDF`), an
Excel workbook and a Word document (both `PK`, as ZIP-based formats), each larger than 1 KB.

**Revisions.** Every handler has a revision file (`create-order.revision.ts`) and reports its value as `revision`.
`packages/service/src/orders.ts` has `serviceRevision`, which every response also reports. The standard change edits
each handler's revision file. The shared change (`--change shared`) edits only `orders.ts`, which every function
imports, so every function must be rebuilt and redeployed.

## One-container applications

`containers/node/` and `containers/python/` implement the same storefront API. The Node app uses Express, Zod, Decimal.js, Handlebars and Luxon. The Python app uses FastAPI and Pydantic, with Python's decimal and datetime libraries.

These are two separate language tests. They are not a claim that Express and FastAPI have identical dependency sizes.

Both expose these routes:

| Request | What to check |
| --- | --- |
| `GET /health` | `status: "ok"` |
| `GET /version` | The expected application revision |
| `GET /products` | Coffee and mug products |
| `POST /quote` | Correct decimal pricing and the expected revision |
| `POST /receipt` | Rendered receipt HTML and the expected revision |

Use this quote request after deployment:

```json
{"lines":[{"productId":"coffee","quantity":2},{"productId":"mug","quantity":1}]}
```

The response must contain `total: "33.00"`, `currency: "USD"` and the new revision. A health check alone is insufficient: it can succeed on the old application.

To run Node locally:

```sh
cd fixtures/containers/node
PORT=3000 npm start
```

To run Python locally after creating `.venv` as shown above:

```sh
cd fixtures/containers/python
PORT=3000 .venv/bin/uvicorn app:app --host 0.0.0.0 --port 3000
```

`revision.mjs` and `revision.py` are the respective edit targets. The directories contain no Dockerfile. Automatic builders receive the app source, its lockfile and its start command. A provider configuration may add its required build recipe without changing the application.

## Five-container application

`containers/five-services/` contains five independently built and deployed HTTP services. These are five workloads, not five sidecars in one task.

| Service | Business check | Edited in the update test? |
| --- | --- | --- |
| `api` | Price two coffees at USD 25.00 | Yes |
| `reporting` | Process a supplied job ID and generate an actual PDF | Yes |
| `inventory` | Reserve two mugs and report ten remaining | No |
| `webhooks` | Verify and accept a signed payment event | No |
| `notifications` | Process a supplied job ID and render an order email | Yes |

Each service directory contains its own package manifest, lockfile and revision file. Use that directory as the build context. Using the whole repository as every service's context would let unrelated edits invalidate all five builds.

Edit the three named services' `revision.mjs` files and leave the other two directories untouched. After deployment, verify the new revisions on those three and the previous revisions on inventory and webhooks. Inspect the build and upload records as well; unchanged source alone does not prove cache reuse.

Reporting and notifications process fresh jobs through their HTTP endpoints. The response includes the supplied `jobId` and the revision of the code that processed it. They do not use an external queue and do not benchmark background-worker startup. The deployment probe must supply a new job ID for each check.

Each service's `probe.json` contains its request and expected fields. The webhook probe computes its signature with HMAC-SHA256 using the documented fixture signing string.

## Expected results

`manifest.json` lists every function and service with its probe request and expected response. Expected objects
are subsets of the full response; arrays must match in length and order. The benchmark uses it for the business check
after each run.
