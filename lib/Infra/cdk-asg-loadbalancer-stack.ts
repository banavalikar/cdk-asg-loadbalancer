import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as Codedeploy from '@aws-cdk/aws-codedeploy';
import { AutoScalingGroup } from '@aws-cdk/aws-autoscaling';
import { Protocol, SubnetType, Vpc, WindowsVersion } from '@aws-cdk/aws-ec2';
import { Aws, CfnOutput } from '@aws-cdk/core';
import { ApplicationProtocol } from '@aws-cdk/aws-elasticloadbalancingv2';
import { ServerDeploymentConfig } from '@aws-cdk/aws-codedeploy';
import * as s3 from '@aws-cdk/aws-s3'; 
import * as codepipeline from '@aws-cdk/aws-codepipeline'; 
import * as codepipelineactions from '@aws-cdk/aws-codepipeline-actions';

//file system
import * as fs from 'fs';
import { stringLike } from '@aws-cdk/assert';
import { countReset } from 'console';
import { SSL_OP_MICROSOFT_BIG_SSLV3_BUFFER } from 'constants';
import { Action, CodeBuildAction, S3SourceAction } from '@aws-cdk/aws-codepipeline-actions';
import { env } from 'process';


export class CdkAsgLoadbalancerStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    env.region = 'eu-west-2';

    //Permissions
    const instanceRole = new iam.Role(this,'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    instanceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2RoleforSSM'));

    //VPC
    const ssVpc = new ec2.Vpc(this, 'VPC');

    const httpPort = new ec2.Port({
      protocol: ec2.Protocol.TCP,
      fromPort: 80,
      toPort: 80,
      stringRepresentation: '80-80'
    });

    const rdpPort = new ec2.Port({
      protocol: ec2.Protocol.TCP,
      fromPort: 3389,
      toPort: 3389,
      stringRepresentation: '3389-3389'
    });

    //Security

    const lbSg = new ec2.SecurityGroup(this, 'lbSg', {
      vpc: ssVpc,
      allowAllOutbound: true,
      description: "Security group for the load balancer",
    });

    lbSg.addIngressRule(ec2.Peer.anyIpv4(), httpPort);

    const instanceSg = new ec2.SecurityGroup(this, 'instanceSg', {
      vpc: ssVpc,
      allowAllOutbound: true,
      description: "Security group for the EC2 instance",
    });

    instanceSg.addIngressRule(lbSg, httpPort);
    instanceSg.addIngressRule(ec2.Peer.anyIpv4(), rdpPort);

    //Auto scaling
    const ssAsg = new autoscaling.AutoScalingGroup(this, 'ssAsg',{
      vpc: ssVpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2,ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestWindows(WindowsVersion.WINDOWS_SERVER_2019_ENGLISH_CORE_CONTAINERSLATEST),
      maxCapacity: 3,
      minCapacity: 1,
      desiredCapacity: 2,
      role: instanceRole,
      vpcSubnets: {subnetType: SubnetType.PUBLIC},
      associatePublicIpAddress: true
    });

    //userdata
    var boot:string;
    boot = fs.readFileSync('assets/boot.ps1','utf-8');

    ssAsg.addUserData(boot);
    ssAsg.addSecurityGroup(instanceSg);

    //Load balancing
    const ssLb = new elbv2.ApplicationLoadBalancer(this, 'ssLb', {
      vpc: ssVpc,
      internetFacing: true,
      securityGroup: lbSg
    });

    const ssListener = ssLb.addListener('ssListener', {
      port: 80,
      open: true,
    })
    
    const ssTg = ssListener.addTargets('ssTg', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      targets: [ssAsg]
    });

    //Output
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: ssLb.loadBalancerDnsName
    });

    const ssApp = new Codedeploy.ServerApplication(this, 'ssApp',{
      applicationName: 'DefaultApplication'
    })

    //CodeDeploy
    const ssSdg = new Codedeploy.ServerDeploymentGroup(this, 'CodeDeploymentGroup', {
      application: ssApp,
      loadBalancer: Codedeploy.LoadBalancer.application(ssTg),
      deploymentConfig: ServerDeploymentConfig.ONE_AT_A_TIME,
      autoScalingGroups: [ssAsg],
      installAgent: false,
    });

    //s3 bucket to store our code
    const ssBucket = s3.Bucket.fromBucketAttributes(this, 'SourceBucket', {
      bucketName: 'source-bucket-for-index-app',
    });
    // const ssBucket = new s3.Bucket(this,'DeploymentBucket',{
    //   versioned: true
    // });

    const ssPipeline = new codepipeline.Pipeline(this, 'DefaultPipeline',{
      
    });
    const ssSourceOutput = new codepipeline.Artifact();
    const ssSourceAction = new codepipelineactions.S3SourceAction({
      bucket: ssBucket,
      bucketKey: 'deployment/source.zip',
      actionName: 'S3Source',
      output: ssSourceOutput,
     })

    ssPipeline.addStage({
      stageName: 'Source',
      actions: [ssSourceAction],
    });

      const ssDeployStage = ssPipeline.addStage({
      stageName: 'Deploy',
      //Deploy website from s3 bucket DeploymentBucket
      actions: [
        new codepipelineactions.CodeDeployServerDeployAction({
          actionName: 'Website',
          input: ssSourceOutput,
          deploymentGroup: ssSdg
        }),
      ]
    });

  }
}
