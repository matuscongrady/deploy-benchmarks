/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app() {
    return { name: 'bmk-sst-lambda-1', home: 'aws', removal: 'remove', providers: { aws: { region: 'eu-west-1' } } };
  },
  async run() {
    new sst.aws.Function('Report', { handler: 'handlers/report.handler', runtime: 'nodejs22.x', memory: '512 MB', timeout: '30 seconds', nodejs: { install: ['pdfkit'] } });
  }
});
