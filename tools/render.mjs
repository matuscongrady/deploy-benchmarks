// Render native runtimes (no Dockerfile), Starter instances, deployed from GitHub on every push.
// Render deploys only from a Git repository, so it has no CLI journey. Setup by hand: push the project to GitHub and
// create a Blueprint from its render.yaml in the Render dashboard. RENDER_API_KEY is needed for URLs and build times.
import { serviceDir, targetNames } from '../lib.mjs';

async function api(path) {
  const response = await fetch(`https://api.render.com/v1${path}`, { headers: { authorization: `Bearer ${process.env.RENDER_API_KEY}` } });
  if (!response.ok) throw new Error(`Render API ${path}: HTTP ${response.status}`);
  return response.json();
}
const service = async (name, s) => (await api(`/services?name=${encodeURIComponent(`${name}-${s}`)}`))[0].service;

// Build and start commands from Render's Express and FastAPI guides.
const blueprint = ({ app, name }) =>
  `services:\n${targetNames(app)
    .map((s) => {
      const python = app.language === 'python';
      const lines = [
        `  - type: web`,
        `    name: ${name}-${s}`,
        `    runtime: ${python ? 'python' : 'node'}`,
        `    plan: starter`,
        `    buildCommand: ${python ? 'pip install -r requirements.txt' : 'npm install'}`,
        `    startCommand: ${python ? 'uvicorn app:app --host 0.0.0.0 --port $PORT' : 'npm start'}`,
        `    healthCheckPath: /health`
      ];
      if (app.id === 'five-services') lines.push(`    rootDir: ${serviceDir(app, s)}`); // Changes outside rootDir do not deploy it.
      return lines.join('\n');
    })
    .join('\n')}\n`;

export default {
  apps: ['container-node', 'container-python', 'five-services'],
  remoteBuild: true,
  docs: {
    name: 'Render',
    account: 'a Render account',
    region: 'Render runs the services in its default region.',
    version: "Hosted by Render: its native Node.js and Python runtimes on Starter instances. Render doesn't offer a choice of build image version.",
    credentials: ['`RENDER_API_KEY`: the harness reads service URLs and build events through the Render API.'],
    gitPush: () => [
      'In the Render dashboard, create a Blueprint from your fork and this branch. Render reads `render.yaml` and deploys.',
      'Render has no command that only empties the build cache. Before each first push, use "Clear build cache & deploy" on the previous commit, wait for that deploy to finish, and pass `--cold-reset manual`.'
    ]
  },
  files: (ctx) => ({ 'render.yaml': blueprint(ctx) }),
  version: () => 'hosted',
  remove: () => {
    throw new Error('Delete the Blueprint and its services in the Render dashboard');
  },
  addresses: async ({ app, name }) => Object.fromEntries(await Promise.all(targetNames(app).map(async (s) => [s, (await service(name, s)).serviceDetails.url]))),
  // Render keeps a build cache per service and has no command that clears it without starting a deploy. For a cold
  // push, use "Clear build cache & deploy" on the previous commit in the dashboard, then run with --cold-reset manual.
  // Build duration from the service's build_started and build_ended events. Render does not report an artifact size.
  buildInfo: ({ app, name, pushedAt }) =>
    Promise.all(
      app.changed.map(async (s) => {
        const { id } = await service(name, s);
        const events = (await api(`/services/${id}/events?startTime=${encodeURIComponent(pushedAt)}&limit=50`)).map((e) => e.event);
        const time = (type) => Date.parse(events.filter((e) => e.type === type).at(-1)?.timestamp);
        return { service: s, buildMs: time('build_ended') - time('build_started'), bytes: null };
      })
    )
};
