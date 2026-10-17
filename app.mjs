import { App, CfnOutput, Stack } from 'aws-cdk-lib';
import { Cluster, ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';

const app = new App();
const stack = new Stack(app, 'bmk-cdk-five-services', { env: { region: 'eu-west-1' } });
const cluster = new Cluster(stack, 'Cluster');

const api = new ApplicationLoadBalancedFargateService(stack, 'api', {
  cluster, cpu: 256, memoryLimitMiB: 512,
  taskImageOptions: { image: ContainerImage.fromAsset('api'), containerPort: 3000 }
});
api.targetGroup.configureHealthCheck({ path: '/health' });
new CfnOutput(stack, 'apiUrl', { value: `http://${api.loadBalancer.loadBalancerDnsName}` });

const reporting = new ApplicationLoadBalancedFargateService(stack, 'reporting', {
  cluster, cpu: 256, memoryLimitMiB: 512,
  taskImageOptions: { image: ContainerImage.fromAsset('reporting'), containerPort: 3000 }
});
reporting.targetGroup.configureHealthCheck({ path: '/health' });
new CfnOutput(stack, 'reportingUrl', { value: `http://${reporting.loadBalancer.loadBalancerDnsName}` });

const inventory = new ApplicationLoadBalancedFargateService(stack, 'inventory', {
  cluster, cpu: 256, memoryLimitMiB: 512,
  taskImageOptions: { image: ContainerImage.fromAsset('inventory'), containerPort: 3000 }
});
inventory.targetGroup.configureHealthCheck({ path: '/health' });
new CfnOutput(stack, 'inventoryUrl', { value: `http://${inventory.loadBalancer.loadBalancerDnsName}` });

const webhooks = new ApplicationLoadBalancedFargateService(stack, 'webhooks', {
  cluster, cpu: 256, memoryLimitMiB: 512,
  taskImageOptions: { image: ContainerImage.fromAsset('webhooks'), containerPort: 3000 }
});
webhooks.targetGroup.configureHealthCheck({ path: '/health' });
new CfnOutput(stack, 'webhooksUrl', { value: `http://${webhooks.loadBalancer.loadBalancerDnsName}` });

const notifications = new ApplicationLoadBalancedFargateService(stack, 'notifications', {
  cluster, cpu: 256, memoryLimitMiB: 512,
  taskImageOptions: { image: ContainerImage.fromAsset('notifications'), containerPort: 3000 }
});
notifications.targetGroup.configureHealthCheck({ path: '/health' });
new CfnOutput(stack, 'notificationsUrl', { value: `http://${notifications.loadBalancer.loadBalancerDnsName}` });
