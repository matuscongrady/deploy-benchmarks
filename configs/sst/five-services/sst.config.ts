/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app() {
    return { name: 'bmk-sst-five-services', home: 'aws', removal: 'remove', providers: { aws: { region: 'eu-west-1' } } };
  },
  async run() {
    const cluster = new sst.aws.Cluster('Cluster', { vpc: new sst.aws.Vpc('Vpc') });
    const api = new sst.aws.Service('Api', {
      cluster, cpu: '0.25 vCPU', memory: '0.5 GB', image: { context: 'api' },
      loadBalancer: { ports: [{ listen: '80/http', forward: '3000/http' }], health: { '3000/http': { path: '/health' } } }
    });
    const reporting = new sst.aws.Service('Reporting', {
      cluster, cpu: '0.25 vCPU', memory: '0.5 GB', image: { context: 'reporting' },
      loadBalancer: { ports: [{ listen: '80/http', forward: '3000/http' }], health: { '3000/http': { path: '/health' } } }
    });
    const inventory = new sst.aws.Service('Inventory', {
      cluster, cpu: '0.25 vCPU', memory: '0.5 GB', image: { context: 'inventory' },
      loadBalancer: { ports: [{ listen: '80/http', forward: '3000/http' }], health: { '3000/http': { path: '/health' } } }
    });
    const webhooks = new sst.aws.Service('Webhooks', {
      cluster, cpu: '0.25 vCPU', memory: '0.5 GB', image: { context: 'webhooks' },
      loadBalancer: { ports: [{ listen: '80/http', forward: '3000/http' }], health: { '3000/http': { path: '/health' } } }
    });
    const notifications = new sst.aws.Service('Notifications', {
      cluster, cpu: '0.25 vCPU', memory: '0.5 GB', image: { context: 'notifications' },
      loadBalancer: { ports: [{ listen: '80/http', forward: '3000/http' }], health: { '3000/http': { path: '/health' } } }
    });
    return { apiUrl: api.url, reportingUrl: reporting.url, inventoryUrl: inventory.url, webhooksUrl: webhooks.url, notificationsUrl: notifications.url };
  }
});
