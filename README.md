# lambda-5/sst

This branch is one test of the [deploy benchmarks](https://github.com/stacktape/deploy-benchmarks): the Lambda backend with 5 functions, deployed with SST.
It holds only that application and the tool's configuration, so it deploys as it is.

`node branches.mjs` on `main` generates this branch from `main`'s fixtures and tool modules. Don't edit it here: change `main` and generate the branches again.

## Tool version

SST 4.17.2, installed by `npm ci`. `sst install` adds its AWS provider during setup.

## Files

| Path | What it is |
| --- | --- |
| `sst.config.ts` | The SST configuration |
| `.github/workflows/deploy.yml` | The GitHub Actions workflow that the Git push test uses |
| `package.json`, `package-lock.json` | The application's manifest, with the tool added as a pinned devDependency |
| Everything else | The application, copied from [`fixtures/lambdas`](https://github.com/stacktape/deploy-benchmarks/blob/main/fixtures/lambdas) |

## Credentials

- `AWS_PROFILE`: a profile for the disposable AWS account.

## Reproduce the measurement

You need Node.js 22 or newer, npm, Git, Docker with BuildKit, `zip`, the AWS CLI and a disposable AWS account. The AWS resources are created in `eu-west-1`. Run the harness from `main`, with the credentials above:

```sh
git clone https://github.com/stacktape/deploy-benchmarks && cd deploy-benchmarks
npm ci
node bench.mjs setup   sst lambda-5                             # write work/bmk-sst-lambda-5/ and deploy it once (not measured)
node bench.mjs package sst lambda-5 --runs 10                   # package from an empty build cache
node bench.mjs package sst lambda-5 --runs 10 --warm            # package after a source change
node bench.mjs deploy  sst lambda-5 --runs 10                   # deploy a code change from this machine
node bench.mjs deploy  sst lambda-5 --runs 10 --change shared   # change the shared service package instead
node report.mjs                                                 # median, fastest and slowest run
node bench.mjs remove  sst lambda-5                             # delete everything setup created
```

`setup` writes the files of this branch to `work/bmk-sst-lambda-5/` and commits them as the same commit that this branch has.

## Git push test

Each run is a pair: a first push with an empty build cache, then a second push 15 minutes after the first one finished. The clock starts when `git push` returns.

1. Fork the repository with all branches: untick "Copy the main branch only".
2. Turn on GitHub Actions in your fork. This branch's `.github/workflows/deploy.yml` deploys every push to the branch.
3. Add the repository secret `AWS_ROLE_ARN`. `AWS_ROLE_ARN` is a role in the disposable account that the fork can assume through GitHub OIDC.
4. Sign `gh` in to an account that can manage the fork's Actions caches (`gh auth login` or `GH_TOKEN`). The first push of each pair deletes them with `gh cache delete --all`.
5. Run the commands below. The project in `work/` has the same commit as this branch, so its pushes continue your fork's branch.

```sh
export BENCH_FORK=https://github.com/<you>/deploy-benchmarks   # setup adds it as the project's origin
node bench.mjs setup sst lambda-5                              # skip if you already ran it with BENCH_FORK set
node bench.mjs push sst lambda-5 --runs 10
node report.mjs
```

## Deploy it with the tool alone

From a checkout of this branch, without the harness:

```sh
npm ci
npx sst install
npx sst deploy --stage bmk
# delete everything:
npx sst remove --stage bmk
```

## Expected result

Each run appends one JSON line to `results/package.jsonl` or `results/deploy.jsonl`. Times are in milliseconds and sizes in bytes. Every line also records the tool version, the machine and the command log.

```js
{ "app": "lambda-5", "tool": "sst", "cache": "clean", "run": 1, "ms": <packaging time>, "bytes": <upload size>, "artifacts": [{ "file": "...", "bytes": ... }] }
{ "app": "lambda-5", "tool": "sst", "journey": "cli", "run": 1, "change": "handlers", "changedTargets": 5, "readyMs": <time until the new code answers>, "commandMs": <deploy command duration>, "businessOk": true, "unchangedOk": true }
{ "app": "lambda-5", "tool": "sst", "journey": "git-cold", "run": 1, "change": "handlers", "changedTargets": 5, "readyMs": <time until the new code answers>, "coldReset": "scripted", "businessOk": true, "unchangedOk": true }
{ "app": "lambda-5", "tool": "sst", "journey": "git-warm", "run": 1, "change": "handlers", "changedTargets": 5, "readyMs": <time until the new code answers>, "businessOk": true, "unchangedOk": true }
```

`node report.mjs` prints the median with the fastest and slowest run of each series. Runs whose business check failed are listed and left out.

## Results

Pending. The results will be published in the [main README](https://github.com/stacktape/deploy-benchmarks#results) after the measurement runs on a dedicated EC2 machine.
