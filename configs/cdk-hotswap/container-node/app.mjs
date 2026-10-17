import { App, CfnOutput, Stack } from 'aws-cdk-lib';
import { Cluster, ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';

const app = new App();
const stack = new Stack(app, 'bmk-cdk-hotswap-container-node', { env: { region: 'eu-west-1' } });
const cluster = new Cluster(stack, 'Cluster');

const api = new ApplicationLoadBalancedFargateService(stack, 'api', {
  cluster, cpu: 256, memoryLimitMiB: 512,
  taskImageOptions: { image: ContainerImage.fromAsset('.'), containerPort: 3000 }
});
api.targetGroup.configureHealthCheck({ path: '/health' });
new CfnOutput(stack, 'apiUrl', { value: `http://${api.loadBalancer.loadBalancerDnsName}` });
