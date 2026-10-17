// Render native runtimes (no Dockerfile), Starter instances in Frankfurt, deployed from GitHub on every push.
// Render deploys only from a Git repository, so it has no CLI journey. `setup` creates the services of render.yaml
// through the Render API from the fork in BENCH_FORK; creating a Blueprint from render.yaml in the dashboard gives the
// same services. RENDER_API_KEY is needed for setup, URLs, cache resets and build times.
import { serviceDir, sleep, targetNames } from '../lib.mjs';

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`https://api.render.com/v1${path}`, {
    method,
    headers: { authorization: `Bearer ${process.env.RENDER_API_KEY}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body && JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Render API ${method} ${path}: HTTP ${response.status} ${await response.text()}`);
  return response.status === 204 ? undefined : response.json();
}
const service = async (name, s) => (await api(`/services?name=${encodeURIComponent(`${name}-${s}`)}`))[0]?.service;

// Frankfurt is Render's region closest to eu-west-1, where the AWS tools and the measuring machine run.
const REGION = 'frankfurt';

// Build and start commands from Render's Express and FastAPI guides.
const services = ({ app, name }) =>
  targetNames(app).map((s) => {
    const python = app.language === 'python';
    return {
      name: `${name}-${s}`,
      runtime: python ? 'python' : 'node',
      buildCommand: python ? 'pip install -r requirements.txt' : 'npm install',
      startCommand: python ? 'uvicorn app:app --host 0.0.0.0 --port $PORT' : 'npm start',
      // Changes outside rootDir do not deploy the service.
      rootDir: app.id === 'five-services' ? serviceDir(app, s) : undefined
    };
  });

const blueprint = (ctx) =>
  `services:\n${services(ctx)
    .map((s) =>
      [
        `  - type: web`,
        `    name: ${s.name}`,
        `    runtime: ${s.runtime}`,
        `    plan: starter`,
        `    region: ${REGION}`,
        `    buildCommand: ${s.buildCommand}`,
        `    startCommand: ${s.startCommand}`,
        `    healthCheckPath: /health`,
        ...(s.rootDir ? [`    rootDir: ${s.rootDir}`] : [])
      ].join('\n')
    )
    .join('\n')}\n`;

/** Waits until a deploy is live. Render reports build and update failures as final statuses. */
async function waitForDeploy(serviceId, deployId) {
  for (;;) {
    const { status } = await api(`/services/${serviceId}/deploys/${deployId}`);
    if (status === 'live') return;
    if (/failed|canceled|deactivated/.test(status)) throw new Error(`Render deploy ${deployId} of ${serviceId} ended as ${status}`);
    await sleep(5000);
  }
}

export default {
  apps: ['container-node', 'container-python', 'five-services'],
  remoteBuild: true,
  docs: {
    name: 'Render',
    account: 'a Render account',
    region: 'The services run in Render\'s Frankfurt region, the closest to `eu-west-1`.',
    version: "Hosted by Render: its native Node.js and Python runtimes on Starter instances (0.5 CPU, 512 MB). Render doesn't offer a choice of build image version.",
    credentials: [
      '`RENDER_API_KEY`: the harness creates the services, reads their URLs and build events and empties their build caches through the Render API.',
      "`BENCH_FORK`: the URL of your fork. Render's GitHub app must have access to it."
    ],
    gitPush: () => [
      "Install Render's GitHub app on your fork. With `BENCH_FORK` set, `node bench.mjs setup` creates the services of `render.yaml` through the Render API, deploying this branch of your fork on every push. A Blueprint created from `render.yaml` in the Render dashboard is the same.",
      'The first push of each pair starts with a "Clear build cache & deploy" of the previous commit through the Render API and waits until it is live.'
    ]
  },
  files: (ctx) => ({ 'render.yaml': blueprint(ctx) }),
  version: () => 'hosted',
  async provision(ctx) {
    const fork = process.env.BENCH_FORK;
    if (!fork) throw new Error('Set BENCH_FORK to the URL of your fork; Render deploys from it');
    const [{ owner }] = await api('/owners');
    await Promise.all(
      services(ctx).map(async (s) => {
        if ((await api(`/services?name=${encodeURIComponent(s.name)}`)).length) return; // Created by an earlier setup.
        const { service: created, deployId } = await api('/services', {
          method: 'POST',
          body: {
            type: 'web_service',
            name: s.name,
            ownerId: owner.id,
            repo: fork.replace(/\.git$/, ''),
            branch: ctx.branch,
            autoDeploy: 'yes',
            ...(s.rootDir ? { rootDir: s.rootDir } : {}),
            serviceDetails: {
              runtime: s.runtime,
              plan: 'starter',
              region: REGION,
              healthCheckPath: '/health',
              numInstances: 1,
              envSpecificDetails: { buildCommand: s.buildCommand, startCommand: s.startCommand }
            }
          }
        });
        await waitForDeploy(created.id, deployId);
      })
    );
  },
  async remove({ app, name }) {
    for (const s of targetNames(app)) {
      const found = await service(name, s);
      if (found) await api(`/services/${found.id}`, { method: 'DELETE' });
      if (await service(name, s)) throw new Error(`Render service ${name}-${s} still exists`);
    }
    return [];
  },
  addresses: async ({ app, name }) => Object.fromEntries(await Promise.all(targetNames(app).map(async (s) => [s, (await service(name, s)).serviceDetails.url]))),
  // "Clear build cache & deploy" of the current commit, as in the dashboard: Render has no call that only empties the
  // cache. The next push then builds without a cache.
  resetCache: ({ app, name }) =>
    Promise.all(
      app.changed.map(async (s) => {
        const { id } = await service(name, s);
        const deploy = await api(`/services/${id}/deploys`, { method: 'POST', body: { clearCache: 'clear' } });
        await waitForDeploy(id, deploy.id);
      })
    ),
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
