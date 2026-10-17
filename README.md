# Deploy benchmarks

This repository measures two things for several deployment tools:

- **Packaging:** how long a tool takes to turn Lambda functions into what it uploads, and how big that upload is. For
  containers, only the image size.
- **Deploying a change:** how long it takes from starting a deploy until the changed code answers requests.

The tools are Stacktape, Serverless Framework, SST, AWS CDK, Render, Heroku and Ravion. Stacktape publishes these
results on its website, so we wrote down every choice we made. If you think a tool is set up worse than its users
would set it up, please [open an issue](#think-a-tool-is-set-up-badly).

## Reproduce one test

Every test has its own branch, named `<app>/<tool>`, for example
[`lambda-25/sst`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-25/sst). A branch holds only that
application and that tool's configuration, so it deploys as it is. Its README gives the tool version, the setup, the
commands and the shape of the result. The [list of branches](#test-branches) is below.

You need Node.js 22 or newer, npm, Git, Docker with BuildKit, `zip`, the AWS CLI and a disposable AWS account.
The AWS deployments run in `eu-west-1`. To measure how long SST takes to deploy a change to the 25-function Lambda backend:

```sh
git clone https://github.com/stacktape/deploy-benchmarks && cd deploy-benchmarks
npm ci
export AWS_PROFILE=<profile of a disposable account>
node bench.mjs setup  sst lambda-25            # write the lambda-25/sst branch to work/ and deploy it once (not measured)
node bench.mjs deploy sst lambda-25 --runs 10  # deploy a code change ten times
node report.mjs                                # median, fastest and slowest run
node bench.mjs remove sst lambda-25            # delete everything setup created
```

Replace `sst lambda-25` with any tool and application from the list of branches. The other measurements are
`node bench.mjs package` (packaging and image size) and `node bench.mjs push` (Git push), described in
[Run the benchmark](#run-the-benchmark). Each tool needs these credentials:

<!-- generated:credentials -->

| Tool | What it needs |
| --- | --- |
| Stacktape | `AWS_PROFILE`: a profile for the disposable AWS account. The harness uses it to call the deployed code and read stack outputs.<br>`STACKTAPE_API_KEY`, or run `stacktape login` once.<br>`STACKTAPE_AWS_ACCOUNT`: the name of the AWS account connection in the Stacktape Console. Stacktape deploys with credentials from that connection, not with `AWS_PROFILE`, so check with `stacktape info:whoami` that both point to the same account.<br>`STACKTAPE_BIN`: the path of the Stacktape binary to measure. |
| Serverless Framework | `AWS_PROFILE`: a profile for the disposable AWS account.<br>`SERVERLESS_ACCESS_KEY`, or run `npm exec --workspace=packages/functions -- serverless login` once. |
| SST | `AWS_PROFILE`: a profile for the disposable AWS account. |
| AWS CDK | `AWS_PROFILE`: a profile for the disposable AWS account. `cdk bootstrap` runs once during setup. |
| AWS CDK with hotswap | `AWS_PROFILE`: a profile for the disposable AWS account. `cdk bootstrap` runs once during setup. |
| Render | `RENDER_API_KEY`: the harness creates the services, reads their URLs and build events and empties their build caches through the Render API.<br>`BENCH_FORK`: the URL of your fork. Render's GitHub app must have access to it. |
| Heroku | `HEROKU_API_KEY`, or run `heroku login` once.<br>The builds plugin: `heroku plugins:install @heroku-cli/plugin-builds`. |
| Ravion | Run `ravion login` once.<br>`RAVION_URL_API`, and for five services also `RAVION_URL_REPORTING`, `RAVION_URL_INVENTORY`, `RAVION_URL_WEBHOOKS` and `RAVION_URL_NOTIFICATIONS`: the URL of each service. |

<!-- /generated:credentials -->

## Results

Results will be published here after the measurement runs on a dedicated EC2 machine.

| Test | Stacktape | Serverless Framework | SST | AWS CDK | Render | Heroku | Ravion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Package 1 / 5 / 25 Lambda functions | – | – | – | – | | | |
| Node.js / Python container image size | – | | – | – | | – | |
| Deploy a change from a laptop | – | – | – | – | | – | |
| Deploy a change by Git push | – | – | – | – | – | – | – |

Each cell will show the median of ten runs, with the fastest and slowest run. The raw data for every run will be in
`results/`, and `node report.mjs` prints the summary.

## Test branches

<!-- generated:branches -->

| Branch | Application | Tool | Measured |
| --- | --- | --- | --- |
| [`lambda-1/stacktape`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-1/stacktape) | `lambda-1` | Stacktape | packaging, deploy from a laptop, Git push |
| [`lambda-5/stacktape`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-5/stacktape) | `lambda-5` | Stacktape | packaging, deploy from a laptop, Git push |
| [`lambda-25/stacktape`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-25/stacktape) | `lambda-25` | Stacktape | packaging, deploy from a laptop, Git push |
| [`container-node/stacktape`](https://github.com/stacktape/deploy-benchmarks/tree/container-node/stacktape) | `container-node` | Stacktape | image size, deploy from a laptop, Git push |
| [`container-python/stacktape`](https://github.com/stacktape/deploy-benchmarks/tree/container-python/stacktape) | `container-python` | Stacktape | image size, deploy from a laptop, Git push |
| [`five-services/stacktape`](https://github.com/stacktape/deploy-benchmarks/tree/five-services/stacktape) | `five-services` | Stacktape | deploy from a laptop, Git push |
| [`lambda-1/serverless`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-1/serverless) | `lambda-1` | Serverless Framework | packaging, deploy from a laptop, Git push |
| [`lambda-5/serverless`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-5/serverless) | `lambda-5` | Serverless Framework | packaging, deploy from a laptop, Git push |
| [`lambda-25/serverless`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-25/serverless) | `lambda-25` | Serverless Framework | packaging, deploy from a laptop, Git push |
| [`lambda-1/sst`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-1/sst) | `lambda-1` | SST | packaging, deploy from a laptop, Git push |
| [`lambda-5/sst`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-5/sst) | `lambda-5` | SST | packaging, deploy from a laptop, Git push |
| [`lambda-25/sst`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-25/sst) | `lambda-25` | SST | packaging, deploy from a laptop, Git push |
| [`container-node/sst`](https://github.com/stacktape/deploy-benchmarks/tree/container-node/sst) | `container-node` | SST | image size, deploy from a laptop, Git push |
| [`container-python/sst`](https://github.com/stacktape/deploy-benchmarks/tree/container-python/sst) | `container-python` | SST | image size, deploy from a laptop, Git push |
| [`five-services/sst`](https://github.com/stacktape/deploy-benchmarks/tree/five-services/sst) | `five-services` | SST | deploy from a laptop, Git push |
| [`lambda-1/cdk`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-1/cdk) | `lambda-1` | AWS CDK | packaging, deploy from a laptop, Git push |
| [`lambda-5/cdk`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-5/cdk) | `lambda-5` | AWS CDK | packaging, deploy from a laptop, Git push |
| [`lambda-25/cdk`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-25/cdk) | `lambda-25` | AWS CDK | packaging, deploy from a laptop, Git push |
| [`container-node/cdk`](https://github.com/stacktape/deploy-benchmarks/tree/container-node/cdk) | `container-node` | AWS CDK | image size, deploy from a laptop, Git push |
| [`container-python/cdk`](https://github.com/stacktape/deploy-benchmarks/tree/container-python/cdk) | `container-python` | AWS CDK | image size, deploy from a laptop, Git push |
| [`five-services/cdk`](https://github.com/stacktape/deploy-benchmarks/tree/five-services/cdk) | `five-services` | AWS CDK | deploy from a laptop, Git push |
| [`lambda-1/cdk-hotswap`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-1/cdk-hotswap) | `lambda-1` | AWS CDK with hotswap | packaging, deploy from a laptop |
| [`lambda-5/cdk-hotswap`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-5/cdk-hotswap) | `lambda-5` | AWS CDK with hotswap | packaging, deploy from a laptop |
| [`lambda-25/cdk-hotswap`](https://github.com/stacktape/deploy-benchmarks/tree/lambda-25/cdk-hotswap) | `lambda-25` | AWS CDK with hotswap | packaging, deploy from a laptop |
| [`container-node/cdk-hotswap`](https://github.com/stacktape/deploy-benchmarks/tree/container-node/cdk-hotswap) | `container-node` | AWS CDK with hotswap | image size, deploy from a laptop |
| [`container-python/cdk-hotswap`](https://github.com/stacktape/deploy-benchmarks/tree/container-python/cdk-hotswap) | `container-python` | AWS CDK with hotswap | image size, deploy from a laptop |
| [`five-services/cdk-hotswap`](https://github.com/stacktape/deploy-benchmarks/tree/five-services/cdk-hotswap) | `five-services` | AWS CDK with hotswap | deploy from a laptop |
| [`container-node/render`](https://github.com/stacktape/deploy-benchmarks/tree/container-node/render) | `container-node` | Render | Git push |
| [`container-python/render`](https://github.com/stacktape/deploy-benchmarks/tree/container-python/render) | `container-python` | Render | Git push |
| [`five-services/render`](https://github.com/stacktape/deploy-benchmarks/tree/five-services/render) | `five-services` | Render | Git push |
| [`container-node/heroku`](https://github.com/stacktape/deploy-benchmarks/tree/container-node/heroku) | `container-node` | Heroku | deploy from a laptop, Git push |
| [`container-python/heroku`](https://github.com/stacktape/deploy-benchmarks/tree/container-python/heroku) | `container-python` | Heroku | deploy from a laptop, Git push |
| [`five-services/heroku`](https://github.com/stacktape/deploy-benchmarks/tree/five-services/heroku) | `five-services` | Heroku | deploy from a laptop |
| [`container-node/ravion`](https://github.com/stacktape/deploy-benchmarks/tree/container-node/ravion) | `container-node` | Ravion | Git push |
| [`container-python/ravion`](https://github.com/stacktape/deploy-benchmarks/tree/container-python/ravion) | `container-python` | Ravion | Git push |
| [`five-services/ravion`](https://github.com/stacktape/deploy-benchmarks/tree/five-services/ravion) | `five-services` | Ravion | Git push |

<!-- /generated:branches -->

## What we measured

The Lambda applications are the backend of a small online shop, built like many real Lambda backends: an npm
workspace whose functions all import a shared `service` package (Prisma with PostgreSQL, the AWS SDK, Stripe, Slack,
Google Sheets, OpenAI, email) and a shared `util` package. Most functions are queue workers and scheduled jobs; four
are HTTP APIs; one builds a PDF, an Excel workbook and a Word document. The 1- and 5-function applications are
subsets of the 25-function one. The container applications are small commerce APIs whose code does real work. All
of them are described in [`fixtures/README.md`](fixtures/README.md).

| Test | Applications | Tools |
| --- | --- | --- |
| Lambda packaging | `lambda-1`, `lambda-5`, `lambda-25` | Stacktape, Serverless Framework, SST, AWS CDK |
| Container image size | `container-node`, `container-python` | Stacktape, SST, AWS CDK |
| Deploy a change from a laptop | all of the above, plus `five-services` | the tools that deploy from the command line |
| Deploy a change by Git push, first push | all of the above | every tool |
| Deploy a change by Git push, 15 minutes later | same as the first push | every tool |

In the five-service application, the change edits three services. The other two must keep running their old code.
The Lambda applications have a second deploy test, the shared change: it edits a module of the shared `service`
package, which every function imports, so every function must be rebuilt.

## How a run works

**The change.** Every function and service has a small revision file, for example
[`create-order.revision.ts`](fixtures/lambdas/packages/functions/src/handlers/create-order.revision.ts). A deploy run
writes a new revision string into the revision file of every changed function or service. Every response from the
applications contains the revision of the code that produced it. All tools get the same change. The shared change
(`--change shared`) instead edits `serviceRevision` in
[`packages/service/src/orders.ts`](fixtures/lambdas/packages/service/src/orders.ts), which every Lambda response
reports.

**When a deploy counts as done.** The clock starts when the deploy command starts. For a Git push, it starts when
`git push` returns. The clock stops when every changed function or service has returned the new revision. Functions
are invoked every 250 ms and services are called every second. The clock does not wait for the command to exit; the
command's own duration is recorded separately. After the clock stops, every function and service must also return
the right business result (for example a cart total of `33.00`) from the expected revision. Runs that fail this
check are kept in the raw data but left out of the results.

**Packaging.** The clock covers the tool's own packaging command. Before each run we delete the tool's previous build
output. Every series starts with one run that is not measured, so nothing a tool downloads on first use is timed. The
"warm" series keeps the previous build and changes only the source, like a developer's next build.

**Container build time is part of the deploy, not packaging.** No tool builds a container image except as part of a
deploy, so the deploy test times each tool's whole deploy command, image build included; for containers, the
packaging test reports only the image size.

**Upload size.** For Lambda, this is everything the tool uploads as code: each function's ZIP, each layer it creates,
and the source maps it uploads next to the ZIPs (SST and Stacktape do this). For containers, it is the compressed
image size reported by the local Docker image store, which is what a push to an empty registry uploads. Heroku
reports a compressed slug instead of an image. Render does not report a size.

**Not measured.** Creating the infrastructure the first time, installing tools and dependencies, and the checks
after each run.

**Recorded for every run:** the tool and its version, the Stacktape commit when Stacktape is built from source, the
machine, the timings, the sizes and a log of every command.

## How each tool is set up

Every tool uses its documented defaults, except where noted in [Where a tool needed help](#where-a-tool-needed-help).
On AWS, every function uses Node.js 22 with 512 MB of memory and a 30-second timeout, and every container uses
0.25 vCPU and 512 MB. The npm tools are pinned in each project's `package.json` and `package-lock.json`. Render,
Heroku and Ravion choose their own build images, so they run whatever version the platform offers at the time of the
measurement. The exact files are in the test branches and in [`configs/`](configs); `node configs.mjs` regenerates
them from the tool modules in [`tools/`](tools).

### Stacktape

- Configuration: [`configs/stacktape/`](configs/stacktape), written by [`tools/stacktape.mjs`](tools/stacktape.mjs).
- Version: the CLI built from source at a commit that each result records. See
  [Build Stacktape from source](#build-stacktape-from-source).
- Packaging: `stacktape package`. Deploy: `stacktape deploy`.
- Functions and the Node.js services use Stacktape's `js-bundle` packaging. The Python service uses `buildpack`.
- `stacktape deploy` updates code-only changes directly, without a CloudFormation update. This is its default.
- Git push: Stacktape Console's Git integration, which builds on a runner in your AWS account. The runner stops after
  15 idle minutes, so the push 15 minutes later starts a stopped runner.

### Serverless Framework

- Configuration: [`configs/serverless/`](configs/serverless), written by [`tools/serverless.mjs`](tools/serverless.mjs).
- Version: 4.44.0.
- Packaging: `serverless package`. Deploy: `serverless deploy`.
- The Serverless service is the monorepo's `packages/functions` package, where its `serverless.yml` lives. That is
  the usual layout, and Serverless installs `external` packages at the versions in that package's `package.json`.
- Version 4 with its built-in esbuild bundling (`build.esbuild`), with esbuild's default options. Without that
  setting, version 4 bundles only TypeScript handlers. We turned it on because most Serverless projects bundle their
  code. In the last month, the [`serverless`](https://www.npmjs.com/package/serverless) package had 5.9 million
  downloads, [`serverless-esbuild`](https://www.npmjs.com/package/serverless-esbuild) 2.0 million,
  [`serverless-webpack`](https://www.npmjs.com/package/serverless-webpack) 1.0 million and
  [`serverless-plugin-typescript`](https://www.npmjs.com/package/serverless-plugin-typescript) 0.5 million. Weekly,
  [version 3 had 681,000 downloads and version 4 had 511,000](https://www.npmjs.com/package/serverless?activeTab=versions)
  (October 2026).
- `serverless deploy function` is faster for a single function, but it is a separate command and skips
  CloudFormation, so we use `serverless deploy`.
- Git push: GitHub Actions, using the
  [shared workflow](configs/serverless/lambda-5/.github/workflows/deploy.yml). Serverless Framework v4 has no Git
  deployment service of its own.

### SST

- Configuration: [`configs/sst/`](configs/sst), written by [`tools/sst.mjs`](tools/sst.mjs).
- Version: 4.17.2.
- Deploy: `sst deploy`. Functions use `sst.aws.Function`; services use `sst.aws.Service` on an SST cluster.
- Packaging: SST has no command that only packages. `sst diff` on a deployed stage builds and zips every function,
  then compares the plan with what is deployed. Its time therefore includes that comparison, which reads from AWS.
- Containers are built from a plain [Dockerfile](configs/sst/container-node/Dockerfile): the official slim image, a
  locked production install, then the source. SST runs `docker build` during `sst deploy`; for the image size, the
  packaging test runs the same `docker build` directly.
- Git push: the [shared GitHub Actions workflow](configs/sst/lambda-5/.github/workflows/deploy.yml). SST's own
  Autodeploy needs an SST Console account and is not measured.

### AWS CDK

- Configuration: [`configs/cdk/`](configs/cdk), written by [`tools/cdk.mjs`](tools/cdk.mjs).
- Version: CDK CLI 2.1145.0 with aws-cdk-lib 2.273.0, constructs 10.8.1 and esbuild 0.28.2.
- Deploy: `cdk deploy`. Functions use `NodejsFunction`; services use `ApplicationLoadBalancedFargateService`.
- Packaging: `cdk synth`, which bundles each function with esbuild (installed in the project, as CDK recommends).
  CDK zips the bundles later, during `cdk deploy`, so zipping is not part of CDK's packaging time. For the upload
  size we zip each bundle at the same compression level CDK uses.
- Containers use the same Dockerfile as SST, and the image size comes from the same direct `docker build`.
- Git push: the [shared GitHub Actions workflow](configs/cdk/lambda-5/.github/workflows/deploy.yml).
- **CDK with hotswap** is reported as a separate tool, with its own branches (`<app>/cdk-hotswap`).
  `cdk deploy --hotswap` updates Lambda code and ECS services directly, which is CDK's fast path for code changes.
  CDK documents it for development stacks only, because it leaves the CloudFormation stack out of date. Its first
  deploy is a normal `cdk deploy`. It has no Git push test.

### Render

- Configuration: [`configs/render/`](configs/render), written by [`tools/render.mjs`](tools/render.mjs).
- Render's native Node.js and Python runtimes on Starter instances, with the build and start commands from Render's
  Express and FastAPI guides.
- Render deploys only from a Git repository, so it has no laptop deploy. Build time comes from Render's build events.

### Heroku

- [`tools/heroku.mjs`](tools/heroku.mjs). No extra configuration: the applications already have a `Procfile` and
  runtime version files.
- The default stack and the official Node.js and Python buildpacks. Each service is its own Heroku app.
- Laptop deploy: `git push` to Heroku's Git remote. Git push: Heroku's GitHub integration with automatic deploys.
- Heroku builds the repository root. For the five-service application we push each service with `git subtree push`,
  and its GitHub integration cannot deploy it.

### Ravion

- [`tools/ravion.mjs`](tools/ravion.mjs). No extra configuration: Ravion's default builder, Railpack, detects the
  runtime and start command from the source.
- Ravion deploys only from a Git repository, so it has no laptop deploy. Build time comes from Ravion's pipeline runs.

## Where a tool needed help

| What | Tools | Why |
| --- | --- | --- |
| Keep `pdfkit` out of the bundle and install it as a package: `build.esbuild.external` (Serverless), `nodejs.install` (SST), `bundling.nodeModules` (CDK) | Serverless Framework, SST, AWS CDK | PDFKit reads its font files from disk. Bundled, the sales report fails with `ENOENT ... Helvetica.afm`. We checked that each of these tools fails without the setting. Stacktape detects such packages itself. Serverless applies `external` to every function, so each function's ZIP contains PDFKit. |
| `package.individually: true` | Serverless Framework | By default all functions share one ZIP. For 25 functions that ZIP holds every bundle and source map, over 600 MB unpacked; Lambda accepts at most 250 MB. |
| An esbuild `banner` that defines `require` | Serverless Framework | Serverless bundles this ES module project to an ES module, where CommonJS dependencies (ExcelJS, among others) cannot `require` Node.js built-ins. The banner is the fix in [Serverless's build guide](https://www.serverless.com/framework/docs/providers/aws/guide/building). CDK and Stacktape emit CommonJS. |
| Load balancer health check path `/health` | SST, AWS CDK | The default path `/` returns 404 in these applications, so the services would never become healthy. |
| A Dockerfile | SST, AWS CDK | Both need one to build a container. Stacktape, Render, Heroku and Ravion build from the source. |
| `--awsAccount` | Stacktape | Stacktape deploys with credentials from the Stacktape Console for a connected AWS account, not with `AWS_PROFILE`. |

**Left at each tool's default:** the AWS SDK and Prisma. Stacktape, Serverless Framework and AWS CDK all leave
`@aws-sdk/*` out of the bundle, because the Node.js 22 Lambda runtime provides it, and bundle Prisma's client, whose
query compiler is plain JavaScript and WebAssembly in Prisma 7. `prisma generate` runs on `npm ci` for every tool.

## Known limitations

- **Stacktape does not have to win.** The published results will show every test where another tool is faster or
  smaller. Source maps count toward the upload size of the tools that upload them (SST and Stacktape), and AWS CDK
  uploads none by default.
- **The tools roll out changes differently.** Serverless Framework and AWS CDK go through CloudFormation. Stacktape
  and CDK with hotswap update code directly. SST uses Pulumi. Render, Heroku and Ravion run their own pipelines. We
  measure each tool's normal path; the guarantees are not the same.
- **First response.** A service counts as updated at its first response from the new code. During a rolling update,
  some requests can still reach the old code for a short time.
- **SST's packaging time** includes the plan comparison of `sst diff`, because SST has no packaging-only command.
- **CDK's and Stacktape's packaging times** do not include zipping that happens only during deploy (CDK's function
  bundles, Stacktape's shared layers). Their upload sizes do include those ZIPs.
- **Hosted builders** (Render, Heroku, Ravion) run on the provider's machines, so their build times depend on the
  provider's capacity. Render and Ravion have no way to empty only the build cache, so their first-push runs need a
  manual cache reset.
- **One machine, one region, one period.** The results describe this setup, not every project.

## Run the benchmark

Run on a dedicated machine in `eu-west-1`, the region of the deployments; we use EC2. Everything the benchmark
creates is named `bmk-*`. Install the harness's own dependency (the AWS SDK, to invoke functions) and set the
credentials from the [table above](#reproduce-one-test):

```sh
npm ci
export AWS_PROFILE=...
```

Tools are `stacktape`, `serverless`, `sst`, `cdk`, `cdk-hotswap`, `render`, `heroku` and `ravion`. Applications are
`lambda-1`, `lambda-5`, `lambda-25`, `container-node`, `container-python` and `five-services`.

```sh
node bench.mjs setup   sst lambda-5                         # write the project and deploy it (not measured)
node bench.mjs package sst lambda-5 --runs 10               # package from an empty build cache
node bench.mjs package sst lambda-5 --runs 10 --warm        # package after a source change
node bench.mjs package sst container-node                   # container image size
node bench.mjs deploy  sst lambda-5 --runs 10               # deploy a code change from this machine
node bench.mjs deploy  sst lambda-5 --runs 10 --change shared   # change the shared service package instead
node bench.mjs remove  sst lambda-5                         # delete everything setup created
node report.mjs                                             # median, fastest and slowest run of every series
```

`setup` writes the test's branch to `work/bmk-<tool>-<app>/` as its own Git repository, with the same commit as the
published branch, and installs its locked dependencies. Command logs are in `logs/`. SST's function packaging needs
a deployed stage, so run `setup` first. To spread network and AWS variation evenly, run one round of every tool
before the next round:

```sh
for round in $(seq 10); do
  for tool in stacktape serverless sst cdk cdk-hotswap; do node bench.mjs deploy $tool lambda-25 --runs 1; done
done
```

### Build Stacktape from source

The published results use a Stacktape CLI built from source. Each result records the commit in `stacktapeCommit`.

```sh
git clone https://github.com/stacktape/stacktape && cd stacktape
pnpm install --frozen-lockfile
pnpm turbo run build --filter=@stacktape/init-ui
cd apps/cli
bun scripts/build-dist-package.ts --platform linux --version 4.0.0-bench.$(git rev-parse --short HEAD) --keepUnarchived
export STACKTAPE_BIN=$PWD/__dist/linux/stacktape STACKTAPE_COMMIT=$(git rev-parse HEAD)
```

### Git push runs

`node bench.mjs push <tool> <app> --runs 5` commits a change to the project in `work/`, pushes it to the test's
branch on the project's `origin` remote and measures until the new code answers. Each run is a pair: a first push
with an empty build cache, then a second push 15 minutes after the first one finished.

You need a fork of this repository with all branches (untick "Copy the main branch only"), because the platforms
deploy from your fork's branch. The project that `setup` writes has the same commit as the published branch, so its
pushes continue your fork's branch. After `setup`, add your fork as the project's `origin`:

```sh
git -C work/bmk-<tool>-<app> remote add origin git@github.com:<you>/deploy-benchmarks.git
```

Then connect the deploy service to your fork's branch. Each test branch's README has these steps for its
application:

<!-- generated:git-push-setup -->

**Stacktape**

- In the Stacktape Console, connect your fork and the test's branch to the project, with the stage `bmk` in `eu-west-1`. The Console runner builds in your AWS account with the Stacktape version set in the Console, so set the version you measure there.
- To empty the runner's caches before each first push, delete the project's runner in the Console and pass `--cold-reset manual`.
- The Console runner installs Stacktape from npm, so this test needs a published version. The pinned commit above is not published, so the qualification results have no Stacktape Git push test.

**Serverless Framework**

- Turn on GitHub Actions in your fork. This branch's `.github/workflows/deploy.yml` deploys every push to the branch.
- Add the repository secrets `AWS_ROLE_ARN` and `SERVERLESS_ACCESS_KEY`. `AWS_ROLE_ARN` is a role in the disposable account that the fork can assume through GitHub OIDC.
- Sign `gh` in to an account that can manage the fork's Actions caches (`gh auth login` or `GH_TOKEN`). The first push of each pair deletes them with `gh cache delete --all`.

**SST**

- Turn on GitHub Actions in your fork. This branch's `.github/workflows/deploy.yml` deploys every push to the branch.
- Add the repository secret `AWS_ROLE_ARN`. `AWS_ROLE_ARN` is a role in the disposable account that the fork can assume through GitHub OIDC.
- Sign `gh` in to an account that can manage the fork's Actions caches (`gh auth login` or `GH_TOKEN`). The first push of each pair deletes them with `gh cache delete --all`.

**AWS CDK**

- Turn on GitHub Actions in your fork. This branch's `.github/workflows/deploy.yml` deploys every push to the branch.
- Add the repository secret `AWS_ROLE_ARN`. `AWS_ROLE_ARN` is a role in the disposable account that the fork can assume through GitHub OIDC.
- Sign `gh` in to an account that can manage the fork's Actions caches (`gh auth login` or `GH_TOKEN`). The first push of each pair deletes them with `gh cache delete --all`.

**AWS CDK with hotswap**: no Git push test.

**Render**

- Install Render's GitHub app on your fork. With `BENCH_FORK` set, `node bench.mjs setup` creates the services of `render.yaml` through the Render API, deploying the test's branch of your fork on every push. A Blueprint created from `render.yaml` in the Render dashboard is the same.
- The first push of each pair starts with a "Clear build cache & deploy" of the previous commit through the Render API and waits until it is live.

**Heroku**

- `node bench.mjs setup` creates the Heroku app. In the Heroku dashboard, connect it to your fork and the test's branch, and turn on automatic deploys.
- The first push of each pair empties the build cache with `heroku builds:cache:purge`.

**Ravion**

- In Ravion, connect your fork and your AWS account.
- Add one web module with the repository root as its source directory and the default builder, and turn on deploy on push for the test's branch.
- Set the `RAVION_URL_*` variables to the service URLs.
- Ravion has no command that empties its build cache. Reset it by hand before each first push and pass `--cold-reset manual`.

<!-- /generated:git-push-setup -->

For Render, Ravion and Heroku, connect the platform before `setup`: they deploy only from Git, and `setup` checks the
deployed services.

## Regenerate the configurations and branches

The test branches and [`configs/`](configs) are generated from [`tools/`](tools), [`fixtures/`](fixtures),
[`lib.mjs`](lib.mjs) and [`project.mjs`](project.mjs). Don't edit them by hand. After a change to those files:

```sh
node configs.mjs           # rewrite configs/, the pinned lockfiles and the generated parts of this README
git commit -am "..."       # the branches are generated from committed files
node branches.mjs --push   # rebuild every <app>/<tool> branch and force-push it
node branches.mjs --check  # confirm that every branch on GitHub matches main
```

`node configs.mjs` keeps the versions in each lockfile unless a pinned tool version changes. Each branch is a single
commit with a fixed author and date, so the same files always give the same commit, on any machine.
`node configs.mjs --check` and `node branches.mjs --check` change nothing and fail when something is out of date.

## Repository layout

| Path | What it is |
| --- | --- |
| [`bench.mjs`](bench.mjs) | The runner: `setup`, `package`, `deploy`, `push` and `remove` |
| [`lib.mjs`](lib.mjs) | The applications, the change, running commands, the probes, the shared Dockerfile and workflow |
| [`project.mjs`](project.mjs) | The project of each test: the files, the commit and the branch README |
| [`tools/`](tools) | One module per tool: its configuration, commands, artifacts, addresses and setup notes |
| [`configs/`](configs) | The files each tool adds to each application, with their lockfiles, generated by `node configs.mjs` |
| [`branches.mjs`](branches.mjs) | Generates the `<app>/<tool>` branches |
| [`report.mjs`](report.mjs) | Prints the median, fastest and slowest run of every series |
| [`fixtures/`](fixtures) | The test applications |

## Think a tool is set up badly?

We want each tool to look the way its users would set it up. If a configuration here is worse than what you would
use, or a measurement favors one tool, please open an issue in this repository. Tell us what you would change and,
if you can, link the documentation that supports it. We will rerun the affected tests.

## License

[MIT](LICENSE)
