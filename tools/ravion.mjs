// Ravion, building with its default Railpack builder and deploying to ECS in the connected AWS account.
// Ravion deploys from a Git repository, so it has no CLI journey. Setup by hand in the Ravion dashboard: connect the
// GitHub repository and AWS account, add one web module per service with its source directory and the default
// builder, and enable deploy on push. Set RAVION_URL_<SERVICE> (for example RAVION_URL_API) to each service URL.
import { capture, targetNames } from '../lib.mjs';

const ravion = (...args) => JSON.parse(capture(['ravion', ...args, '--json']));

export default {
  apps: ['container-node', 'container-python', 'five-services'],
  remoteBuild: true,
  docs: {
    name: 'Ravion',
    account: ['the Ravion CLI', 'a Ravion account with a disposable AWS account connected'],
    region: 'Deploy the services to `eu-west-1`.',
    configNote: 'Ravion needs no configuration: its default builder, Railpack, detects the runtime and start command from the source.',
    version: 'Hosted by Ravion, building with its default builder (Railpack) and deploying to ECS in your AWS account. The harness reads build records with the Ravion CLI, and each result records its version.',
    credentials: ['Run `ravion login` once.', '`RAVION_URL_API`, and for five services also `RAVION_URL_REPORTING`, `RAVION_URL_INVENTORY`, `RAVION_URL_WEBHOOKS` and `RAVION_URL_NOTIFICATIONS`: the URL of each service.'],
    gitPush: ({ id }) => [
      'In Ravion, connect your fork and your AWS account.',
      `Add ${id === 'five-services' ? 'one web module per service, with the service directory as its source directory' : 'one web module with the repository root as its source directory'} and the default builder, and turn on deploy on push for this branch.`,
      'Set the `RAVION_URL_*` variables to the service URLs.',
      'Ravion has no command that empties its build cache. Reset it by hand before each first push and pass `--cold-reset manual`.'
    ]
  },
  files: () => ({}), // Railpack detects the runtime, dependencies and start command from the source.
  version: () => capture(['ravion', '--version']),
  remove: () => {
    throw new Error('Delete the Ravion project and its modules in the Ravion dashboard');
  },
  addresses: ({ app }) => Object.fromEntries(targetNames(app).map((s) => [s, process.env[`RAVION_URL_${s.toUpperCase()}`]])),
  // Ravion has no documented command that clears its build cache; run cold pushes with --cold-reset manual.
  // Build duration of the build steps of pipeline runs started after the push. Steps report `completedAt`, as in the
  // pipeline runs we inspected; not yet checked in a measured run.
  buildInfo: ({ pushedAt }) =>
    ravion('pipeline', 'run', 'list')
      .filter((run) => Date.parse(run.createdAt) >= Date.parse(pushedAt))
      .map((run) => {
        const steps = (ravion('pipeline', 'run', 'get', run.id).steps ?? []).filter((step) => /build/i.test(step.name));
        return { run: run.id, buildMs: steps.reduce((sum, step) => sum + Date.parse(step.completedAt) - Date.parse(step.startedAt), 0), bytes: null };
      })
};
