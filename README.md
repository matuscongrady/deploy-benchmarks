# container-python/ravion

This branch is one test of the [deploy benchmarks](https://github.com/stacktape/deploy-benchmarks): the Python container API, deployed with Ravion.
It holds only that application and the tool's configuration, so it deploys as it is.

`node branches.mjs` on `main` generates this branch from `main`'s fixtures and tool modules. Don't edit it here: change `main` and generate the branches again.

## Tool version

Hosted by Ravion: Railpack builds on a one-off EC2 Spot builder in your AWS account, deployed to ECS Fargate there. The harness reads build records with the Ravion CLI, and each result records its version.

## Files

| Path | What it is |
| --- | --- |
| All files | The application, copied from [`fixtures/containers/python`](https://github.com/stacktape/deploy-benchmarks/blob/main/fixtures/containers/python) |

The Ravion configuration lives in your Ravion project, not in this branch. The [Ravion section of the main README](https://github.com/stacktape/deploy-benchmarks#ravion) lists it. Railpack detects the runtime, dependencies and start command from the source.

## Credentials

- Run `ravion login` once.
- AWS credentials for the connected account, for example `AWS_PROFILE`: the harness empties the build cache in ECR and reads image sizes from ECR.
- `RAVION_URL_API`, and for five services also `RAVION_URL_REPORTING`, `RAVION_URL_INVENTORY`, `RAVION_URL_WEBHOOKS` and `RAVION_URL_NOTIFICATIONS`: the URL of each service.

## Reproduce the measurement

You need Node.js 22 or newer, npm, Git, the Ravion CLI, the AWS CLI and a Ravion account with a disposable AWS account connected. Deploy the services to `eu-west-1`. Ravion deploys only from Git, so this test is the Git push test below.

## Git push test

Each run is a pair: a first push with an empty build cache, then a second push 15 minutes after the first one finished. The clock starts when `git push` returns.

1. Fork the repository with all branches: untick "Copy the main branch only".
2. In Ravion, connect your AWS account, and install Ravion's GitHub app on your fork in Settings / Git connections.
3. Create the Ravion project described in the main README: a network, an ECS cluster, one web module with the repository root as its source directory, and one pipeline that builds and deploys every push to this branch.
4. Set the `RAVION_URL_*` variables to the service URLs.
5. The first push of each pair empties the build cache: it deletes the `buildcache` and `railpack` tags from each changed service's ECR repository.
6. Run the commands below. The project in `work/` has the same commit as this branch, so its pushes continue your fork's branch.

```sh
git clone https://github.com/stacktape/deploy-benchmarks && cd deploy-benchmarks
npm ci
export BENCH_FORK=https://github.com/<you>/deploy-benchmarks   # setup adds it as the project's origin
node bench.mjs setup ravion container-python                   # write the project to work/ and check the deployed service
node bench.mjs push ravion container-python --runs 10
node report.mjs
```

## Expected result

Each run appends one JSON line to `results/package.jsonl` or `results/deploy.jsonl`. Times are in milliseconds and sizes in bytes. Every line also records the tool version, the machine and the command log.

```js
{ "app": "container-python", "tool": "ravion", "journey": "git-cold", "run": 1, "change": "handlers", "changedTargets": 1, "readyMs": <time until the new code answers>, "coldReset": "scripted", "build": <build records from the platform>, "businessOk": true, "unchangedOk": true }
{ "app": "container-python", "tool": "ravion", "journey": "git-warm", "run": 1, "change": "handlers", "changedTargets": 1, "readyMs": <time until the new code answers>, "build": <build records from the platform>, "businessOk": true, "unchangedOk": true }
```

`node report.mjs` prints the median with the fastest and slowest run of each series. Runs whose business check failed are listed and left out.

## Results

Pending. The results will be published in the [main README](https://github.com/stacktape/deploy-benchmarks#results) after the measurement runs on a dedicated EC2 machine.
