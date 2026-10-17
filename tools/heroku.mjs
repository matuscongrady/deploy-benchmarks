// Heroku (Cedar) with the official Node.js and Python buildpacks. Each service is its own Heroku app.
// Needs a logged-in Heroku CLI and the builds plugin: `heroku plugins:install @heroku-cli/plugin-builds`.
// CLI deploy: `git push` to Heroku's Git remote. Git push journey: Heroku's GitHub integration with automatic
// deploys, connected by hand in the Heroku dashboard. It builds only the repository root, so not five-services.
import { capture, targetNames } from '../lib.mjs';

const remote = (service) => `heroku-${service}`;
const appName = (dir, service) => capture(['git', 'remote', 'get-url', remote(service)], dir).match(/([^/]+)\.git$/)[1];
const info = (dir, service) => JSON.parse(capture(['heroku', 'apps:info', '--app', appName(dir, service), '--json'], dir));

export default {
  apps: ['container-node', 'container-python', 'five-services'],
  remoteBuild: true,
  docs: {
    name: 'Heroku',
    account: ['the Heroku CLI', 'a Heroku account'],
    region: 'Heroku runs the apps in its default region.',
    configNote: 'Heroku needs no configuration: the application already has a `Procfile` and runtime version files.',
    version: "Hosted by Heroku: the default stack and the official Node.js and Python buildpacks. Heroku doesn't offer a choice of buildpack version.",
    credentials: ['`HEROKU_API_KEY`, or run `heroku login` once.', 'The builds plugin: `heroku plugins:install @heroku-cli/plugin-builds`.'],
    gitPush: ({ id }) =>
      id === 'five-services'
        ? undefined // Heroku's GitHub integration builds only the repository root.
        : [
            '`node bench.mjs setup` creates the Heroku app. In the Heroku dashboard, connect it to your fork and this branch, and turn on automatic deploys.',
            'The first push of each pair empties the build cache with `heroku builds:cache:purge`.'
          ]
  },
  files: () => ({}), // The fixtures already contain a Procfile and runtime version files.
  version: () => capture(['heroku', '--version']).split(' ')[0],
  // `heroku create` picks a free app name and adds a Git remote. The default stack and dyno type are kept.
  setup: ({ app }) => targetNames(app).map((s) => ['heroku', 'create', '--remote', remote(s)]),
  // A service in a subdirectory is pushed with `git subtree push`, because Heroku builds the repository root.
  deploy: ({ app }, targets = app.changed) =>
    targets.map((s) => (app.id === 'five-services' ? ['git', 'subtree', 'push', '--prefix', s, remote(s), 'main'] : ['git', 'push', remote(s), 'HEAD:main'])),
  remove: ({ app, dir, docs }) =>
    targetNames(app).map((s) => {
      const name = docs ? `<${s}-app-name>` : appName(dir, s);
      return ['heroku', 'apps:destroy', '--app', name, '--confirm', name];
    }),
  addresses: ({ app, dir }) => Object.fromEntries(targetNames(app).map((s) => [s, info(dir, s).app.web_url])),
  resetCache: ({ app, dir, run }) => Promise.all(app.changed.map((s) => run(['heroku', 'builds:cache:purge', '--app', appName(dir, s), '--confirm', appName(dir, s)]))),
  // Build duration and compressed slug size of the newest build of each changed app.
  buildInfo: ({ app, dir }) =>
    app.changed.map((s) => {
      const [build] = JSON.parse(capture(['heroku', 'builds', '--app', appName(dir, s), '--json', '--num', '1'], dir));
      return { service: s, buildMs: Date.parse(build.updated_at) - Date.parse(build.created_at), bytes: info(dir, s).app.slug_size };
    })
};
