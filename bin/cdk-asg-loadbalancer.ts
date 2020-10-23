#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkAsgLoadbalancerStack } from '../lib/Infra/cdk-asg-loadbalancer-stack';

const app = new cdk.App();

new CdkAsgLoadbalancerStack(app, 'CdkAsgLoadbalancerStack' + '-' + app.node.tryGetContext('Suffix'),
  {
    env: {
      account: '093518319188',
      region: 'eu-west-2'
    }
  });
