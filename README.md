# five-services/heroku

This branch is one test of the [deploy benchmarks](https://github.com/stacktape/deploy-benchmarks): five Node.js container services, of which the change edits three, deployed with Heroku.
It holds only that application and the tool's configuration, so it deploys as it is.

`node branches.mjs` on `main` generates this branch from `main`'s fixtures and tool modules. Don't edit it here: change `main` and generate the branches again.

## Tool version

Hosted by Heroku: the default stack and the official Node.js and Python buildpacks. Heroku doesn't offer a choice of buildpack version.

## Files

| Path | What it is |
| --- | --- |
| All files | The application, copied from [`fixtures/containers/five-services`](https://github.com/stacktape/deploy-benchmarks/blob/main/fixtures/containers/five-services) |

Heroku needs no configuration: the application already has a `Procfile` and runtime version files.

## Credentials

- `HEROKU_API_KEY`, or run `heroku login` once.
- The builds plugin: `heroku plugins:install @heroku-cli/heroku-builds`.

## Reproduce the measurement

You need Node.js 22 or newer, npm, Git, the Heroku CLI and a Heroku account. The apps run in Heroku's EU region (Dublin), the closest to `eu-west-1`, each on one Basic dyno (512 MB), which is always on. Run the harness from `main`, with the credentials above:

```sh
git clone https://github.com/stacktape/deploy-benchmarks && cd deploy-benchmarks
npm ci
node bench.mjs setup   heroku five-services             # write work/bmk-heroku-five-services/ and deploy it once (not measured)
node bench.mjs deploy  heroku five-services --runs 10   # deploy a code change from this machine
node report.mjs                                         # median, fastest and slowest run
node bench.mjs remove  heroku five-services             # delete everything setup created
```

`setup` writes the files of this branch to `work/bmk-heroku-five-services/` and commits them as the same commit that this branch has.

## Deploy it with the tool alone

From a checkout of this branch, without the harness:

```sh
heroku create --region eu --remote heroku-api
heroku create --region eu --remote heroku-reporting
heroku create --region eu --remote heroku-inventory
heroku create --region eu --remote heroku-webhooks
heroku create --region eu --remote heroku-notifications
git subtree push --prefix api heroku-api main
git subtree push --prefix reporting heroku-reporting main
git subtree push --prefix inventory heroku-inventory main
git subtree push --prefix webhooks heroku-webhooks main
git subtree push --prefix notifications heroku-notifications main
heroku ps:type web=basic --app <api-app-name>
heroku ps:type web=basic --app <reporting-app-name>
heroku ps:type web=basic --app <inventory-app-name>
heroku ps:type web=basic --app <webhooks-app-name>
heroku ps:type web=basic --app <notifications-app-name>
# delete everything:
heroku apps:destroy --app <api-app-name> --confirm <api-app-name>
heroku apps:destroy --app <reporting-app-name> --confirm <reporting-app-name>
heroku apps:destroy --app <inventory-app-name> --confirm <inventory-app-name>
heroku apps:destroy --app <webhooks-app-name> --confirm <webhooks-app-name>
heroku apps:destroy --app <notifications-app-name> --confirm <notifications-app-name>
```

## Expected result

Each run appends one JSON line to `results/package.jsonl` or `results/deploy.jsonl`. Times are in milliseconds and sizes in bytes. Every line also records the tool version, the machine and the command log.

```js
{ "app": "five-services", "tool": "heroku", "journey": "cli", "run": 1, "change": "handlers", "changedTargets": 3, "readyMs": <time until the new code answers>, "commandMs": <deploy command duration>, "businessOk": true, "unchangedOk": true }
```

`node report.mjs` prints the median with the fastest and slowest run of each series. Runs whose business check failed are listed and left out.

## Results

Pending. The results will be published in the [main README](https://github.com/stacktape/deploy-benchmarks#results) after the measurement runs on a dedicated EC2 machine.
