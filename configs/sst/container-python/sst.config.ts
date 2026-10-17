/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app() {
    return { name: 'bmk-sst-container-python', home: 'aws', removal: 'remove', providers: { aws: { region: 'eu-west-1' } } };
  },
  async run() {
    const cluster = new sst.aws.Cluster('Cluster', { vpc: new sst.aws.Vpc('Vpc') });
    const api = new sst.aws.Service('Api', {
      cluster, cpu: '0.25 vCPU', memory: '0.5 GB', image: { context: '.' },
      loadBalancer: { ports: [{ listen: '80/http', forward: '3000/http' }], health: { '3000/http': { path: '/health' } } }
    });
    return { apiUrl: api.url };
  }
});
