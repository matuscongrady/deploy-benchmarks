// AWS CDK deploying changes with `cdk deploy --hotswap`. CDK documents hotswap for development stacks only: it
// updates the Lambda code or ECS service directly and leaves the CloudFormation stack drifted. Reported separately.
// Hotswap cannot create a stack, so the untimed first deploy is a normal `cdk deploy`.
import cdk from './cdk.mjs';

export default { ...cdk, firstDeploy: cdk.deploy, deploy: () => [...cdk.deploy(), '--hotswap'], gitDeploy: undefined };
