# container-python/heroku

This branch is one test of the [deploy benchmarks](https://github.com/stacktape/deploy-benchmarks): the Python container API, deployed with Heroku.
It holds only that application and the tool's configuration, so it deploys as it is.

`node branches.mjs` on `main` generates this branch from `main`'s fixtures and tool modules. Don't edit it here: change `main` and generate the branches again.

## Tool version

Hosted by Heroku: the default stack and the official Node.js and Python buildpacks. Heroku doesn't offer a choice of buildpack version.

## Files

| Path | What it is |
| --- | --- |
| All files | The application, copied from [`fixtures/containers/python`](https://github.com/stacktape/deploy-benchmarks/blob/main/fixtures/containers/python) |

Heroku needs no configuration: the application already has a `Procfile` and runtime version files.

## Credentials

- `HEROKU_API_KEY`, or run `heroku login` once.
- The builds plugin: `heroku plugins:install @heroku-cli/heroku-builds`.

## Reproduce the measurement

You need Node.js 22 or newer, npm, Git, the Heroku CLI and a Heroku account. The apps run in Heroku's EU region (Dublin), the closest to `eu-west-1`, each on one Basic dyno (512 MB), which is always on. Run the harness from `main`, with the credentials above:

```sh
git clone https://github.com/stacktape/deploy-benchmarks && cd deploy-benchmarks
npm ci
node bench.mjs setup   heroku container-python             # write work/bmk-heroku-container-python/ and deploy it once (not measured)
node bench.mjs deploy  heroku container-python --runs 10   # deploy a code change from this machine
node report.mjs                                            # median, fastest and slowest run
node bench.mjs remove  heroku container-python             # delete everything setup created
```

`setup` writes the files of this branch to `work/bmk-heroku-container-python/` and commits them as the same commit that this branch has.

## Git push test

Each run is a pair: a first push with an empty build cache, then a second push 15 minutes after the first one finished. The clock starts when `git push` returns.

1. Fork the repository with all branches: untick "Copy the main branch only".
2. `node bench.mjs setup` creates the Heroku app. In the Heroku dashboard, connect it to your fork and this branch, and turn on automatic deploys.
3. The first push of each pair empties the build cache with `heroku builds:cache:purge`.
4. Run the commands below. The project in `work/` has the same commit as this branch, so its pushes continue your fork's branch.

```sh
export BENCH_FORK=https://github.com/<you>/deploy-benchmarks   # setup adds it as the project's origin
node bench.mjs setup heroku container-python                   # skip if you already ran it with BENCH_FORK set
node bench.mjs push heroku container-python --runs 10
node report.mjs
```

## Deploy it with the tool alone

From a checkout of this branch, without the harness:

```sh
heroku create --region eu --remote heroku-api
git push heroku-api HEAD:main
heroku ps:type web=basic --app <api-app-name>
# delete everything:
heroku apps:destroy --app <api-app-name> --confirm <api-app-name>
```

## Expected result

Each run appends one JSON line to `results/package.jsonl` or `results/deploy.jsonl`. Times are in milliseconds and sizes in bytes. Every line also records the tool version, the machine and the command log.

```js
{ "app": "container-python", "tool": "heroku", "journey": "cli", "run": 1, "change": "handlers", "changedTargets": 1, "readyMs": <time until the new code answers>, "commandMs": <deploy command duration>, "businessOk": true, "unchangedOk": true }
{ "app": "container-python", "tool": "heroku", "journey": "git-cold", "run": 1, "change": "handlers", "changedTargets": 1, "readyMs": <time until the new code answers>, "coldReset": "scripted", "build": <build records from the platform>, "businessOk": true, "unchangedOk": true }
{ "app": "container-python", "tool": "heroku", "journey": "git-warm", "run": 1, "change": "handlers", "changedTargets": 1, "readyMs": <time until the new code answers>, "build": <build records from the platform>, "businessOk": true, "unchangedOk": true }
```

`node report.mjs` prints the median with the fastest and slowest run of each series. Runs whose business check failed are listed and left out.

## Results

Pending. The results will be published in the [main README](https://github.com/stacktape/deploy-benchmarks#results) after the measurement runs on a dedicated EC2 machine.
