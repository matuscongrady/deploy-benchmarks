# Deploy benchmarks

This repository measures two things for several deployment tools:

- **Packaging:** how long a tool takes to turn an application into what it uploads, and how big that upload is.
- **Deploying a change:** how long it takes from starting a deploy until the changed code answers requests.

The tools are Stacktape, Serverless Framework, SST, AWS CDK, Render, Heroku and Ravion. Stacktape publishes these
results on its website, so we wrote down every choice we made. If you think a tool is set up worse than its users
would set it up, please [open an issue](#think-a-tool-is-set-up-badly).

## Results

Results will be published here after the measurement runs on a dedicated EC2 machine.

| Test | Stacktape | Serverless Framework | SST | AWS CDK | Render | Heroku | Ravion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Package 1 / 5 / 25 Lambda functions | – | – | – | – | | | |
| Build the Node.js / Python container | – | | – | – | – | – | – |
| Deploy a change from a laptop | – | – | – | – | | – | |
| Deploy a change by Git push | – | – | – | – | – | – | – |

Each cell will show the median of ten runs, with the fastest and slowest run. The raw data for every run is in
`results/`, and `node report.mjs` prints the summary.

## What we measured

We use small commerce applications whose code does real work. One function builds a PDF, an Excel workbook and a
Word document; others price carts, verify webhook signatures or parse CSV files. They are described in
[`fixtures/README.md`](fixtures/README.md).

| Test | Applications | Tools |
| --- | --- | --- |
| Lambda packaging | 1, 5 and 25 functions | Stacktape, Serverless Framework, SST, AWS CDK |
| Container build | a Node.js API and a Python API | Stacktape, SST, AWS CDK, Render, Heroku, Ravion |
| Deploy a change from a laptop | all of the above | the tools that deploy from the command line |
| Deploy a change by Git push, first push | all of the above, plus five services | every tool |
| Deploy a change by Git push, 15 minutes later | same as the first push | every tool |

In the five-service application, the change edits three services. The other two must keep running their old code.

## How a run works

**The change.** Every function and service has a small revision file, for example
[`handlers/report.revision.mjs`](fixtures/lambdas/handlers/report.revision.mjs). A deploy run writes a new revision
string into the revision file of every changed function or service. Every response from the applications contains
the revision of the code that produced it. All tools get the same change.

**When a deploy counts as done.** The clock starts when the deploy command starts. For a Git push, it starts when
`git push` returns. The clock stops when every changed function or service has returned the new revision. Functions
are invoked every 250 ms and services are called every second. The clock does not wait for the command to exit; the
command's own duration is recorded separately. After the clock stops, every function and service must also return
the right business result (for example a cart total of `33.00`) from the expected revision. Runs that fail this
check are kept in the raw data but left out of the results.

**Packaging.** The clock covers the tool's own packaging command. Before each run we delete the tool's previous build
output. For container builds we also empty Docker's build cache. Base images stay in the local image store for every
tool: we pull the base image of the SST and CDK Dockerfile before the series, and Stacktape pulls its own base images.
Every series starts with one run that is not measured, so nothing a tool downloads on first use is timed. The
"warm" container series keeps the previous build and changes only the source, like a developer's next build.

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
0.25 vCPU and 512 MB. The exact files are in [`configs/`](configs); `node configs.mjs` regenerates them from the tool
modules in [`tools/`](tools).

### Stacktape

- Configuration: [`configs/stacktape/`](configs/stacktape), written by [`tools/stacktape.mjs`](tools/stacktape.mjs).
- Packaging: `stacktape package`. Deploy: `stacktape deploy`.
- Functions and the Node.js service use Stacktape's `js-bundle` packaging. The Python service uses `buildpack`.
- `stacktape deploy` updates code-only changes directly, without a CloudFormation update. This is its default.
- Git push: Stacktape Console's Git integration, which builds on a runner in your AWS account. The runner stops after
  15 idle minutes, so the push 15 minutes later starts a stopped runner.

### Serverless Framework

- Configuration: [`configs/serverless/`](configs/serverless), written by [`tools/serverless.mjs`](tools/serverless.mjs).
- Packaging: `serverless package`. Deploy: `serverless deploy`.
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
- Git push: GitHub Actions, using the [shared workflow](configs/serverless/lambda-5/.github/workflows/deploy.yml).
  Serverless Framework v4 has no Git deployment service of its own.

### SST

- Configuration: [`configs/sst/`](configs/sst), written by [`tools/sst.mjs`](tools/sst.mjs).
- Deploy: `sst deploy`. Functions use `sst.aws.Function`; services use `sst.aws.Service` on an SST cluster.
- Packaging: SST has no command that only packages. `sst diff` on a deployed stage builds and zips every function,
  then compares the plan with what is deployed. Its time therefore includes that comparison, which reads from AWS.
- Containers are built from a plain [Dockerfile](configs/sst/node/Dockerfile): the official slim image, a locked
  production install, then the source. SST runs `docker build` during `sst deploy`; the packaging test runs the same
  `docker build` directly.
- Git push: the [shared GitHub Actions workflow](configs/sst/lambda-5/.github/workflows/deploy.yml). SST's own
  Autodeploy needs an SST Console account and is not measured.

### AWS CDK

- Configuration: [`configs/cdk/`](configs/cdk), written by [`tools/cdk.mjs`](tools/cdk.mjs).
- Deploy: `cdk deploy`. Functions use `NodejsFunction`; services use `ApplicationLoadBalancedFargateService`.
- Packaging: `cdk synth`, which bundles each function with esbuild (installed in the project, as CDK recommends).
  CDK zips the bundles later, during `cdk deploy`, so zipping is not part of CDK's packaging time. For the upload
  size we zip each bundle at the same compression level CDK uses.
- Containers use the same Dockerfile as SST and the same direct `docker build`.
- Git push: the [shared GitHub Actions workflow](configs/cdk/lambda-5/.github/workflows/deploy.yml).
- **CDK with hotswap** is reported as a separate tool. `cdk deploy --hotswap` updates Lambda code and ECS services
  directly, which is CDK's fast path for code changes. CDK documents it for development stacks only, because it
  leaves the CloudFormation stack out of date. Its first deploy is a normal `cdk deploy`.

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
| Keep `pdfkit` out of the bundle and install it as a package: `build.esbuild.external` (Serverless), `nodejs.install` (SST), `bundling.nodeModules` (CDK) | Serverless Framework, SST, AWS CDK | PDFKit reads its font files from disk. Bundled, the report function fails with `ENOENT ... Helvetica.afm`. We checked that each of these tools fails without the setting. Stacktape detects such packages itself. |
| Load balancer health check path `/health` | SST, AWS CDK | The default path `/` returns 404 in these applications, so the services would never become healthy. |
| A Dockerfile | SST, AWS CDK | Both need one to build a container. Stacktape, Render, Heroku and Ravion build from the source. |
| `--awsAccount` | Stacktape | Stacktape deploys with credentials from the Stacktape Console for a connected AWS account, not with `AWS_PROFILE`. |

## Known limitations

- **Stacktape is not the fastest or smallest everywhere.** In our local test runs, AWS CDK's Lambda uploads were
  smaller at every size, partly because CDK uploads no source maps by default. Serverless Framework's upload was
  smaller for 5 functions. The plain Dockerfile that SST and CDK build produced both container images faster than
  Stacktape, from an empty build cache and after a source change. The published results will show every case where
  Stacktape loses.
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

## Rerun everything yourself

You need Node.js 22 or newer, npm, Git, Docker with BuildKit, `zip`, the AWS CLI and a disposable AWS account.
Everything the benchmark creates is named `bmk-*`. Run on a dedicated machine in the same region as the deployments;
we use EC2.

```sh
npm install                  # the AWS SDK used to invoke functions
export AWS_PROFILE=...       # credentials for the disposable account
export BENCH_REGION=eu-west-1
```

**Serverless Framework** needs `SERVERLESS_ACCESS_KEY`, or `serverless login` once.

**Stacktape** needs a binary and the name of the AWS account connected in the Stacktape Console. Check that the name
belongs to the same account as `AWS_PROFILE` with `stacktape info:whoami`.

```sh
export STACKTAPE_BIN=$(which stacktape)        # or a binary built from source, see below
export STACKTAPE_AWS_ACCOUNT=<connection name>
```

To build Stacktape from source, as we do:

```sh
git clone https://github.com/stacktape/stacktape && cd stacktape
pnpm install --frozen-lockfile
pnpm turbo run build --filter=@stacktape/init-ui
cd apps/cli
bun scripts/build-dist-package.ts --platform linux --version 4.0.0-bench.$(git rev-parse --short HEAD) --keepUnarchived
export STACKTAPE_BIN=$PWD/__dist/linux/stacktape STACKTAPE_COMMIT=$(git rev-parse HEAD)
```

Run a series. Tools are `stacktape`, `serverless`, `sst`, `cdk`, `cdk-hotswap`, `render`, `heroku` and `ravion`.
Applications are `lambda-1`, `lambda-5`, `lambda-25`, `node`, `python` and `five-services`.

```sh
node bench.mjs setup   sst lambda-5             # create the project and deploy it (not measured)
node bench.mjs package sst lambda-5 --runs 10   # package from an empty build cache
node bench.mjs package sst node --runs 10 --warm
node bench.mjs deploy  sst lambda-5 --runs 10   # deploy a change from this machine
node bench.mjs remove  sst lambda-5             # delete everything setup created
node report.mjs                                 # median, fastest and slowest run of every series
```

Each project is written to `work/bmk-<tool>-<app>/` as its own Git repository, with the tool installed from the
project's `package.json`. Command logs are in `logs/`. SST's function packaging needs a deployed stage, so run `setup`
first. To spread network and AWS variation evenly, run one round of every tool before the next round:

```sh
for round in $(seq 10); do
  for tool in stacktape serverless sst cdk cdk-hotswap; do node bench.mjs deploy $tool lambda-25 --runs 1; done
done
```

### Git push runs

`node bench.mjs push <tool> <app> --runs 5` commits a change, pushes `main` to the project's `origin` remote and
measures until the new code answers. Each run is a pair: a first push with an empty build cache, then a second push
15 minutes after the first one finished. Before you start, create a GitHub repository for the project, add it as
`origin` in `work/bmk-<tool>-<app>/`, push once, and connect the deploy service:

- **Serverless Framework, SST, AWS CDK:** the project contains `.github/workflows/deploy.yml`. Add the repository
  secrets `AWS_ROLE_ARN` (a role this repository can assume through GitHub OIDC) and, for Serverless,
  `SERVERLESS_ACCESS_KEY`. The first push of each pair deletes the repository's Actions caches with
  `gh cache delete --all`.
- **Stacktape:** connect the repository in the Stacktape Console. The runner uses the Stacktape version set in the
  Console, so publish the binary you measure first. To empty its caches, delete the project's runner in the Console
  and pass `--cold-reset manual`.
- **Render:** create a Blueprint from the project's `render.yaml` and set `RENDER_API_KEY`. To empty the build cache,
  use "Clear build cache & deploy" on the previous commit, wait for it, then pass `--cold-reset manual`.
- **Heroku:** run `heroku login` and `heroku plugins:install @heroku-cli/plugin-builds`. `setup` creates the apps.
  Connect each app to the GitHub repository and turn on automatic deploys. The first push of each pair empties the
  build cache with `heroku builds:cache:purge`.
- **Ravion:** connect the GitHub repository and the AWS account in Ravion, add one web module per service with the
  default builder, and turn on deploy on push. Set `RAVION_URL_API` (and `RAVION_URL_REPORTING` and so on for five
  services) to the service URLs. Reset the cache by hand and pass `--cold-reset manual`.

## Repository layout

| Path | What it is |
| --- | --- |
| [`bench.mjs`](bench.mjs) | The runner: `setup`, `package`, `deploy`, `push` and `remove` |
| [`lib.mjs`](lib.mjs) | The applications, the change, running commands, the probes, the shared Dockerfile and workflow |
| [`tools/`](tools) | One module per tool: its configuration, commands, artifacts and addresses |
| [`configs/`](configs) | The configuration files each tool gets, generated by `node configs.mjs` |
| [`report.mjs`](report.mjs) | Prints the median, fastest and slowest run of every series |
| [`fixtures/`](fixtures) | The test applications |

## Think a tool is set up badly?

We want each tool to look the way its users would set it up. If a configuration here is worse than what you would
use, or a measurement favors one tool, please open an issue in this repository. Tell us what you would change and,
if you can, link the documentation that supports it. We will rerun the affected tests.
