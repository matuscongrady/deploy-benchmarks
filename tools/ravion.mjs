// Ravion, building with its default Railpack builder and deploying to ECS in the connected AWS account.
// Ravion deploys from a Git repository, so it has no CLI journey. Setup by hand in the Ravion dashboard: connect the
// GitHub repository and AWS account, add one web module per service with its source directory and the default
// builder, and enable deploy on push. Set RAVION_URL_<SERVICE> (for example RAVION_URL_API) to each service URL.
import { capture, targetNames } from '../lib.mjs';

const ravion = (...args) => JSON.parse(capture(['ravion', ...args, '--json']));

export default {
  apps: ['node', 'python', 'five-services'],
  files: () => ({}), // Railpack detects the runtime, dependencies and start command from the source.
  version: () => capture(['ravion', '--version']),
  remove: () => {
    throw new Error('Delete the Ravion project and its modules in the Ravion dashboard');
  },
  addresses: ({ app }) => Object.fromEntries(targetNames(app).map((s) => [s, process.env[`RAVION_URL_${s.toUpperCase()}`]])),
  // Ravion has no documented command that clears its build cache; run cold pushes with --cold-reset manual.
  // Build duration of the build steps of pipeline runs started after the push. Not yet checked against a real run.
  buildInfo: ({ pushedAt }) =>
    ravion('pipeline', 'run', 'list')
      .filter((run) => Date.parse(run.createdAt) >= Date.parse(pushedAt))
      .map((run) => {
        const steps = (ravion('pipeline', 'run', 'get', run.id).steps ?? []).filter((step) => /build/i.test(step.name));
        return { run: run.id, buildMs: steps.reduce((sum, step) => sum + Date.parse(step.finishedAt) - Date.parse(step.startedAt), 0), bytes: null };
      })
};
