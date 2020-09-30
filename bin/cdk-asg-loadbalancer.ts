#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkAsgLoadbalancerStack } from '../lib/cdk-asg-loadbalancer-stack';

const app = new cdk.App();
new CdkAsgLoadbalancerStack(app, 'CdkAsgLoadbalancerStack');
