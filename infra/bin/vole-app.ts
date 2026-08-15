#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { VoleStack } from '../lib/vole-stack';

const app = new App();
new VoleStack(app, 'VoleStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
app.synth();
