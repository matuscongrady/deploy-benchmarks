# container-python/stacktape

This branch is one test of the [deploy benchmarks](https://github.com/stacktape/deploy-benchmarks): the Python container API, deployed with Stacktape.
It holds only that application and the tool's configuration, so it deploys as it is.

`node branches.mjs` on `main` generates this branch from `main`'s fixtures and tool modules. Don't edit it here: change `main` and generate the branches again.

## Tool version

The Stacktape CLI built from source of [stacktape/stacktape](https://github.com/stacktape/stacktape) at commit [`d51f56ad`](https://github.com/stacktape/stacktape/commit/d51f56ad17b9a24056046d7af99bd3716afb30da), as described in the main README. Each result records the commit (`stacktapeCommit`).

## Files

| Path | What it is |
| --- | --- |
| `stacktape.yml` | The Stacktape configuration |
| Everything else | The application, copied from [`fixtures/containers/python`](https://github.com/stacktape/deploy-benchmarks/blob/main/fixtures/containers/python) |

## Credentials

- `AWS_PROFILE`: a profile for the disposable AWS account. The harness uses it to call the deployed code and read stack outputs.
- `STACKTAPE_API_KEY`, or run `stacktape login` once.
- `STACKTAPE_AWS_ACCOUNT`: the name of the AWS account connection in the Stacktape Console. Stacktape deploys with credentials from that connection, not with `AWS_PROFILE`, so check with `stacktape info:whoami` that both point to the same account.
- `STACKTAPE_BIN`: the path of the Stacktape binary to measure.

## Reproduce the measurement

You need Node.js 22 or newer, npm, Git, Docker with BuildKit, `zip`, the AWS CLI, a disposable AWS account and a Stacktape account with the AWS account connected. The AWS resources are created in `eu-west-1`. Run the harness from `main`, with the credentials above:

```sh
git clone https://github.com/stacktape/deploy-benchmarks && cd deploy-benchmarks
npm ci
node bench.mjs setup   stacktape container-python             # write work/bmk-stacktape-container-python/ and deploy it once (not measured)
node bench.mjs package stacktape container-python --runs 10   # record the image size
node bench.mjs deploy  stacktape container-python --runs 10   # deploy a code change from this machine
node report.mjs                                               # median, fastest and slowest run
node bench.mjs remove  stacktape container-python             # delete everything setup created
```

`setup` writes the files of this branch to `work/bmk-stacktape-container-python/` and commits them as the same commit that this branch has.

## Git push test

Each run is a pair: a first push with an empty build cache, then a second push 15 minutes after the first one finished. The clock starts when `git push` returns.

1. Fork the repository with all branches: untick "Copy the main branch only".
2. In the Stacktape Console, connect your fork and this branch to the project, with the stage `bmk` in `eu-west-1`. The Console runner builds in your AWS account with the Stacktape version set in the Console, so set the version you measure there.
3. To empty the runner's caches before each first push, delete the project's runner in the Console and pass `--cold-reset manual`.
4. The Console runner installs Stacktape from npm, so this test needs a published version. The pinned commit above is not published, so the qualification results have no Stacktape Git push test.
5. Run the commands below. The project in `work/` has the same commit as this branch, so its pushes continue your fork's branch.

```sh
export BENCH_FORK=https://github.com/<you>/deploy-benchmarks   # setup adds it as the project's origin
node bench.mjs setup stacktape container-python                # skip if you already ran it with BENCH_FORK set
node bench.mjs push stacktape container-python --runs 10 --cold-reset manual
node report.mjs
```

## Deploy it with the tool alone

From a checkout of this branch, without the harness:

```sh
stacktape deploy --stage bmk --region eu-west-1 --awsAccount <connection-name> --autoConfirmOperation
# delete everything:
stacktape delete --stage bmk --region eu-west-1 --awsAccount <connection-name> --autoConfirmOperation
```

## Expected result

Each run appends one JSON line to `results/package.jsonl` or `results/deploy.jsonl`. Times are in milliseconds and sizes in bytes. Every line also records the tool version, the machine and the command log.

```js
{ "app": "container-python", "tool": "stacktape", "bytes": <compressed image size>, "artifacts": [...] }
{ "app": "container-python", "tool": "stacktape", "journey": "cli", "run": 1, "change": "handlers", "changedTargets": 1, "readyMs": <time until the new code answers>, "commandMs": <deploy command duration>, "businessOk": true, "unchangedOk": true }
{ "app": "container-python", "tool": "stacktape", "journey": "git-cold", "run": 1, "change": "handlers", "changedTargets": 1, "readyMs": <time until the new code answers>, "coldReset": "manual", "businessOk": true, "unchangedOk": true }
{ "app": "container-python", "tool": "stacktape", "journey": "git-warm", "run": 1, "change": "handlers", "changedTargets": 1, "readyMs": <time until the new code answers>, "businessOk": true, "unchangedOk": true }
```

`node report.mjs` prints the median with the fastest and slowest run of each series. Runs whose business check failed are listed and left out.

## Results

Pending. The results will be published in the [main README](https://github.com/stacktape/deploy-benchmarks#results) after the measurement runs on a dedicated EC2 machine.
