# Deploy benchmarks

This repository measures how long it takes to package an application and to get a code change serving, with
Stacktape and with the tools people compare it to. Every tool deploys the same applications, gets the same source
edit and is timed the same way. Every tool runs with its documented defaults. Where a tool needed a setting to make
an application work at all, this README says which setting and why.

The results feed two charts on the Stacktape website: "Packages it" and "Deploys it".

## What is measured

| Test | Applications | Tools | Measured |
| --- | --- | --- | --- |
| Lambda packaging | 1, 5 and 25 functions | Stacktape, Serverless Framework, SST, AWS CDK | Packaging time and total upload size |
| Container packaging | Node API, Python API | Stacktape, SST, CDK, Ravion, Render, Heroku | Build time and image (or slug) size |
| Deploy a change from a laptop | all of the above, plus five services | the tools above that deploy from the CLI | Time until the new code serves |
| Deploy a change by Git push, cold | all of the above, plus five services | every tool | Time until the new code serves |
| Deploy a change by Git push, warm | same as cold, pushed 15 minutes later | every tool | Time until the new code serves |

The applications are in [`fixtures/`](fixtures/README.md). They are small commerce apps whose code does real work:
the report function builds a PDF, an Excel workbook and a Word document. The Lambda apps use 1, 5 and 25 of the 25
handlers. The Node and Python APIs serve the same storefront routes. The five-service app has five independently
deployed Node services; the change edits three of them, and the other two must keep serving their old revision.

## How it is measured

**The code change.** Every target (function or service) has a revision file, for example
`handlers/report.revision.mjs` containing `export const revision = 'baseline';`. A deploy run writes a new revision
string into the revision file of every changed target and commits it. Every response from the applications includes
the revision of the code that produced it.

**Deploy timer.** The timer starts when the deploy command starts. For a Git push it starts when `git push` returns.
It stops when every changed function or service returns the new revision. Each function is invoked every 250 ms and
each service is called every second (`GET /version`); a new call starts on schedule even when an earlier call is
still running, so a slow function does not coarsen the timer. The timer does not wait for the CLI to exit; the CLI time is
recorded separately as `commandMs`. After the timer stops, every target must pass its business check (for example
`POST /quote` must return `total: "33.00"`) from the expected revision, so unchanged services must still run their
old code. Runs that
fail these checks are recorded but left out of the summary.

**Packaging timer.** The timer covers the tool's own packaging command. Before each run the tool's build output is
deleted, and for container builds the Docker build cache is emptied (`docker builder prune -af`). Base images stay
pulled. The `--warm` variant keeps the previous build and changes only the source, as in a developer's next build;
it is meaningful only for tools that cache builds by default (the Docker builds).

**Upload size.** For Lambda it is the total size of the code the tool uploads: every function ZIP, every layer it
creates, and source maps the tool uploads beside the ZIPs (SST does this). For containers it is the compressed image
size reported by the local Docker image store, which is what a push to an empty registry uploads. Heroku reports a
compressed slug instead of an image, so its size is a different format. Render does not report an artifact size.

**Not timed.** Creating the infrastructure the first time (`setup`), bootstrapping accounts, installing tools and
dependencies, and the checks after each run.

**Recorded per run.** Tool, tool version, the Stacktape commit when Stacktape is built from source, the machine
(CPU, memory, and on EC2 the instance type and region), timings, sizes and the path of the full command log. Results
are appended to `results/package.jsonl` and `results/deploy.jsonl`.

## Commands and settings per tool

All AWS tools deploy to the same region. Functions use Node.js 22 with 512 MB of memory and a 30 second timeout on
every tool. Containers use 0.25 vCPU and 512 MB on every AWS tool.

| Tool | Packaging command | CLI deploy command | Git push deploy |
| --- | --- | --- | --- |
| Stacktape | `stacktape package --stage bmk --region eu-west-1` | `stacktape deploy --stage bmk --region eu-west-1 --awsAccount <name> --autoConfirmOperation` | Stacktape Console GitOps |
| Serverless Framework 4.44.0 | `serverless package --stage bmk` | `serverless deploy --stage bmk` | GitHub Actions running `serverless deploy` |
| SST 4.17.2 | `sst diff --stage bmk` (functions), `docker build` (containers) | `sst deploy --stage bmk` | GitHub Actions running `sst deploy` |
| AWS CDK 2.1145.0 (lib 2.273.0) | `cdk synth` (functions), `docker build` (containers) | `cdk deploy --require-approval never` | GitHub Actions running `cdk deploy` |
| AWS CDK, hotswap | as CDK | `cdk deploy --require-approval never --hotswap` | none |
| Ravion | its Railpack build (from the pipeline record) | none: deploys only from Git | Ravion's Git trigger |
| Render | its native build (from the service events) | none: deploys only from Git | Render auto-deploy |
| Heroku | its buildpack build (from the build record) | `git push heroku main` | Heroku GitHub integration |

Notes on these choices:

- **Stacktape.** The default `deploy` updates code-only changes directly instead of going through CloudFormation.
  Node services use `js-bundle` packaging and the Python service uses `buildpack`, as Stacktape's docs recommend.
  Stacktape's `package` command does not zip shared layers (deploy does), so their size is measured by zipping the
  layer directories, and their zipping time is not in Stacktape's packaging time.
- **Serverless Framework.** No `build` or `package` settings. For JavaScript handlers its default is one ZIP of the
  whole project with its production `node_modules`, shared by all functions; it bundles with esbuild by default only
  for TypeScript. `serverless deploy function` is a faster, separate command, but it is not the default deploy.
- **SST.** SST has no packaging-only command. `sst diff` against the deployed stage builds and zips every function,
  so its time also includes comparing the plan with the deployed state. For containers SST runs `docker build`
  during deploy; the packaging test times the same `docker build` directly.
- **CDK.** `cdk synth` bundles each function with esbuild (installed in the project, as CDK recommends). CDK zips the
  bundles later, during `cdk deploy`, so zipping is not in CDK's packaging time; the upload size zips each bundle at
  zlib's default level, as CDK does. Containers are built with `docker build` during deploy, timed directly here.
- **CDK hotswap.** `--hotswap` is CDK's fast path for code changes. CDK documents it for development only: it skips
  CloudFormation and leaves the stack drifted. It is reported as a separate tool so readers can see both.
- **Python on Railpack** (Stacktape's Python buildpack, Ravion) installs the Python interpreter during the build. A
  Dockerfile build gets it from its base image, which stays pulled between runs, so a clean Railpack build does more
  work than a clean Dockerfile build.
- **SST and CDK containers** build the same plain Dockerfile (official slim image, locked production install, then
  the source); see `dockerfile()` in [`lib.mjs`](lib.mjs). Their container packaging results are therefore the same
  measurement. Stacktape, Ravion, Render and Heroku build without a Dockerfile.
- **Render** uses the build and start commands from its Express and FastAPI guides (`npm install`, `npm start`;
  `pip install -r requirements.txt`, `uvicorn ...`) on Starter instances.
- **Heroku** uses the default stack, the official Node.js and Python buildpacks and the fixture's `Procfile`. Each
  service is a separate Heroku app. For the five-service app, each service is pushed with `git subtree push`, because
  Heroku builds the repository root.

Settings that a tool needed to make the applications work:

| Setting | Tools | Why |
| --- | --- | --- |
| Keep `pdfkit` out of the bundle and install it | Stacktape (`dependenciesToExcludeFromBundle`), SST (`nodejs.install`), CDK (`bundling.nodeModules`) | PDFKit reads font files from disk at run time. Serverless needs nothing because it does not bundle by default. |
| Load balancer health check path `/health` | SST, CDK | The default path `/` returns 404 in these apps, so the services would never become healthy. |

## Reproduce the measurements

### Machine and tools

Run the campaign on a dedicated machine, for example an EC2 instance in the same region as the deployments. You need
Node.js 22 or newer, npm, Docker with BuildKit, `zip`, the AWS CLI with credentials for a disposable account, and Git.
The Git journeys also need the GitHub CLI (`gh`), and the hosted platforms need their CLIs (see below).

```sh
npm install                 # installs the AWS SDK used to invoke functions
export AWS_PROFILE=...      # a disposable account; every resource is named bmk-*
export BENCH_REGION=eu-west-1
```

Each project is generated under `work/bmk-<tool>-<app>/` as a standalone Git repository with its own `package.json`,
so the tool versions above are installed per project with `npm install`. Command logs go to `logs/`.

### Stacktape built from source

Build a release binary from a clean checkout of the Stacktape monorepo and point the benchmark at it:

```sh
git -C ~/stacktape worktree add ~/stacktape-bench-cli origin/main --detach
cd ~/stacktape-bench-cli
pnpm install --frozen-lockfile
pnpm turbo run build --filter=@stacktape/init-ui
cd apps/cli
bun scripts/build-dist-package.ts --platform linux --version 4.0.0-bench.$(git rev-parse --short HEAD) --keepUnarchived
export STACKTAPE_BIN=$PWD/__dist/linux/stacktape
export STACKTAPE_COMMIT=$(git rev-parse HEAD)
```

Stacktape deploys into an AWS account connected in the Stacktape Console, using credentials the Console issues;
it does not use `AWS_PROFILE` for that. Set `STACKTAPE_AWS_ACCOUNT` to the connection name of the same account that
`AWS_PROFILE` points to. The runner refuses to deploy Stacktape without it. Check the account with
`stacktape info:whoami` first: if the name is wrong, Stacktape deploys into the other account.

```sh
export STACKTAPE_AWS_ACCOUNT=<connection name>
```

### Serverless Framework

Set `SERVERLESS_ACCESS_KEY` (or run `serverless login` once). Serverless v4 requires it even for `package`.

### Run a series

```sh
node bench.mjs setup   stacktape lambda-5            # create the project and deploy it (not timed)
node bench.mjs package stacktape lambda-5 --runs 10   # packaging, clean build cache each run
node bench.mjs deploy  stacktape lambda-5 --runs 10   # code change deployed from this machine
node bench.mjs remove  stacktape lambda-5             # delete the stack
node report.mjs                                       # median, min and max of every series
```

Tools are `stacktape`, `serverless`, `sst`, `cdk`, `cdk-hotswap`, `ravion`, `render` and `heroku`. Apps are
`lambda-1`, `lambda-5`, `lambda-25`, `node`, `python` and `five-services`. `cdk-hotswap` shares nothing with `cdk`; it
gets its own project and stack. SST's function packaging needs a deployed stage, so run `setup` before `package`.

To spread changes in network and AWS load across tools, run one round of every tool before the next round:

```sh
for round in $(seq 10); do
  for tool in stacktape serverless sst cdk cdk-hotswap; do node bench.mjs deploy $tool lambda-25 --runs 1; done
done
```

### Git push journeys

`node bench.mjs push <tool> <app> --runs 5` makes a change, commits it, pushes the project's `main` branch to its
`origin` remote and times until the new code serves. Each run is a pair: a cold push with the build cache emptied,
then a warm push 15 minutes after the cold one started serving. Before you start, create a GitHub repository for the
project, add it as `origin` in `work/bmk-<tool>-<app>/`, push once, and connect the deploy service:

- **Serverless, SST, CDK:** the project contains `.github/workflows/deploy.yml`. It runs on a fresh GitHub-hosted
  runner, restores npm's download cache, gets AWS credentials through OIDC and runs the CLI deploy. Add the
  repository secrets `AWS_ROLE_ARN` (a role trusted for this repository through GitHub OIDC) and, for Serverless,
  `SERVERLESS_ACCESS_KEY`. The cold run deletes the repository's Actions caches with `gh cache delete --all`.
- **Stacktape:** connect the repository and branch in the Stacktape Console (GitOps). The Console runner keeps its
  caches on an EBS volume and stops after 15 idle minutes, so the warm push starts a stopped runner. There is no
  command that empties its caches: for a cold run, delete the project's runner in the Console, then pass
  `--cold-reset manual`. The runner uses the Stacktape version configured in the Console, so publish the binary you
  measure as a release first.
- **Render:** create a Blueprint from the project's `render.yaml` in the Render dashboard and set `RENDER_API_KEY`.
  Render has no way to empty a build cache without starting a deploy; for a cold run, use "Clear build cache &
  deploy" on the previous commit, wait for it, then pass `--cold-reset manual`.
- **Heroku:** run `heroku login` and `heroku plugins:install @heroku-cli/plugin-builds`. `setup` creates the apps
  with `heroku create`. For the Git journey, connect each app to the GitHub repository in the Heroku dashboard and
  enable automatic deploys. The cold run empties the build cache with `heroku builds:cache:purge`. Heroku's GitHub
  integration builds only the repository root, so the five-service app has no Heroku Git push result.
- **Ravion:** in the Ravion dashboard, connect the GitHub repository and the AWS account, add one web module per
  service with its source directory and the default Railpack builder, and enable deploy on push. Set
  `RAVION_URL_API` (and `RAVION_URL_REPORTING` and so on for five services) to the service URLs. Ravion has no
  documented cache reset; pass `--cold-reset manual` after resetting it by hand.

## Files

| Path | What it is |
| --- | --- |
| `bench.mjs` | The runner: setup, package, deploy, push and remove |
| `lib.mjs` | The applications, the source edit, running commands, probes and the shared Dockerfile and workflow |
| `tools/*.mjs` | One module per tool: its configuration, commands, artifacts and addresses |
| `report.mjs` | Prints median, minimum and maximum per series |
| `fixtures/` | The test applications |
| `results/` | Measurements, one JSON object per run |

## Limits

- Each tool is measured with its own default deploy path, so the rollout guarantees differ. CDK and Serverless go
  through CloudFormation; Stacktape and CDK hotswap update code directly; SST uses Pulumi.
- A service counts as serving the new code at the first response with the new revision. During a rolling update,
  later responses can still come from an old task for a short time.
- Results from one machine, region and day are not a general ranking of the tools.
