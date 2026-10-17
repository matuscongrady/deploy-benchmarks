# container-python/cdk-hotswap

This branch is one test of the [deploy benchmarks](https://github.com/stacktape/deploy-benchmarks): the Python container API, deployed with AWS CDK with hotswap.
It holds only that application and the tool's configuration, so it deploys as it is.

`node branches.mjs` on `main` generates this branch from `main`'s fixtures and tool modules. Don't edit it here: change `main` and generate the branches again.

## Tool version

AWS CDK CLI 2.1145.0 with aws-cdk-lib 2.273.0, constructs 10.8.1 and esbuild 0.28.2, all installed by `npm ci`.

## Files

| Path | What it is |
| --- | --- |
| `cdk.json` | Tells the CDK CLI to run `app.mjs` |
| `app.mjs` | The CDK app: one stack with the functions or services |
| `Dockerfile` | The Dockerfile that the tool builds |
| `.dockerignore` | What the Docker build leaves out |
| `package.json`, `package-lock.json` | The application's manifest, with the tool added as a pinned devDependency |
| Everything else | The application, copied from [`fixtures/containers/python`](https://github.com/stacktape/deploy-benchmarks/blob/main/fixtures/containers/python) |

## Credentials

- `AWS_PROFILE`: a profile for the disposable AWS account. `cdk bootstrap` runs once during setup.

## Reproduce the measurement

You need Node.js 22 or newer, npm, Git, Docker with BuildKit, `zip`, the AWS CLI and a disposable AWS account. The AWS resources are created in `eu-west-1`. Run the harness from `main`, with the credentials above:

```sh
git clone https://github.com/stacktape/deploy-benchmarks && cd deploy-benchmarks
npm ci
node bench.mjs setup   cdk-hotswap container-python             # write work/bmk-cdk-hotswap-container-python/ and deploy it once (not measured)
node bench.mjs package cdk-hotswap container-python --runs 10   # record the image size
node bench.mjs deploy  cdk-hotswap container-python --runs 10   # deploy a code change from this machine
node report.mjs                                                 # median, fastest and slowest run
node bench.mjs remove  cdk-hotswap container-python             # delete everything setup created
```

`setup` writes the files of this branch to `work/bmk-cdk-hotswap-container-python/` and commits them as the same commit that this branch has.

## Deploy it with the tool alone

From a checkout of this branch, without the harness:

```sh
npm ci
npx cdk bootstrap
npx cdk deploy --require-approval never
# after a code change:
npx cdk deploy --require-approval never --hotswap
# delete everything:
npx cdk destroy --force
```

## Expected result

Each run appends one JSON line to `results/package.jsonl` or `results/deploy.jsonl`. Times are in milliseconds and sizes in bytes. Every line also records the tool version, the machine and the command log.

```js
{ "app": "container-python", "tool": "cdk-hotswap", "bytes": <compressed image size>, "artifacts": [...] }
{ "app": "container-python", "tool": "cdk-hotswap", "journey": "cli", "run": 1, "change": "handlers", "changedTargets": 1, "readyMs": <time until the new code answers>, "commandMs": <deploy command duration>, "businessOk": true, "unchangedOk": true }
```

`node report.mjs` prints the median with the fastest and slowest run of each series. Runs whose business check failed are listed and left out.

## Results

Pending. The results will be published in the [main README](https://github.com/stacktape/deploy-benchmarks#results) after the measurement runs on a dedicated EC2 machine.
