import { EC2Client, DescribeInstancesCommand, RunInstancesCommand, TerminateInstancesCommand } from '@aws-sdk/client-ec2';
import { S3Client, ListBucketsCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { IAMClient, ListUsersCommand } from '@aws-sdk/client-iam';
import { Logger } from '../utils/logger.js';

export class AWSProvider {
  constructor() {
    this.logger = new Logger();
    this.ec2Client = null;
    this.s3Client = null;
    this.iamClient = null;
  }

  async initialize(region = 'us-east-1') {
    const config = {
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    };

    this.ec2Client = new EC2Client(config);
    this.s3Client = new S3Client(config);
    this.iamClient = new IAMClient(config);
  }

  async listResources(type, region) {
    if (!this.ec2Client) await this.initialize(region);

    switch (type) {
    case 'instances':
      return await this.listInstances();
    case 'storage':
      return await this.listStorage();
    case 'network':
      return await this.listNetworks();
    case 'database':
      return await this.listDatabases();
    default:
      throw new Error(`Unsupported resource type: ${type}`);
    }
  }

  async listInstances() {
    try {
      const command = new DescribeInstancesCommand({});
      const response = await this.ec2Client.send(command);
      
      const instances = [];
      for (const reservation of response.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          instances.push({
            id: instance.InstanceId,
            name: instance.Tags?.find(t => t.Key === 'Name')?.Value || instance.InstanceId,
            type: instance.InstanceType,
            state: instance.State.Name,
            publicIp: instance.PublicIpAddress,
            privateIp: instance.PrivateIpAddress,
            launchTime: instance.LaunchTime
          });
        }
      }
      
      return instances;
    } catch (error) {
      this.logger.error(`Failed to list EC2 instances: ${error.message}`);
      return [];
    }
  }

  async listStorage() {
    try {
      const command = new ListBucketsCommand({});
      const response = await this.s3Client.send(command);
      
      return response.Buckets?.map(bucket => ({
        id: bucket.Name,
        name: bucket.Name,
        type: 'S3 Bucket',
        creationDate: bucket.CreationDate
      })) || [];
    } catch (error) {
      this.logger.error(`Failed to list S3 buckets: ${error.message}`);
      return [];
    }
  }

  async listNetworks() {
    return [
      { id: 'vpc-1', name: 'Default VPC', type: 'VPC', status: 'available' },
      { id: 'subnet-1', name: 'Public Subnet', type: 'Subnet', status: 'available' },
      { id: 'igw-1', name: 'Internet Gateway', type: 'IGW', status: 'attached' }
    ];
  }

  async listDatabases() {
    return [
      { id: 'db-1', name: 'production-db', type: 'RDS MySQL', status: 'available' },
      { id: 'db-2', name: 'staging-db', type: 'RDS PostgreSQL', status: 'available' }
    ];
  }

  async createResource(type, config) {
    if (!this.ec2Client) await this.initialize(config.region);

    switch (type) {
    case 'instance':
      return await this.createInstance(config);
    case 'bucket':
      return await this.createBucket(config);
    default:
      throw new Error(`Unsupported resource type: ${type}`);
    }
  }

  async createInstance(config) {
    try {
      const params = {
        ImageId: config.imageId || 'ami-0c55b159cbfafe1f0',
        InstanceType: config.instanceType || 't2.micro',
        MinCount: 1,
        MaxCount: 1,
        KeyName: config.keyName,
        SecurityGroupIds: config.securityGroups,
        SubnetId: config.subnetId,
        TagSpecifications: [
          {
            ResourceType: 'instance',
            Tags: [
              { Key: 'Name', Value: config.name || 'DevOps-Instance' },
              { Key: 'Environment', Value: config.environment || 'dev' }
            ]
          }
        ]
      };

      const command = new RunInstancesCommand(params);
      const response = await this.ec2Client.send(command);
      
      return {
        instanceId: response.Instances[0].InstanceId,
        status: 'launching'
      };
    } catch (error) {
      this.logger.error(`Failed to create instance: ${error.message}`);
      throw error;
    }
  }

  async createBucket(config) {
    try {
      const command = new CreateBucketCommand({
        Bucket: config.name,
        ACL: config.acl || 'private'
      });
      
      await this.s3Client.send(command);
      
      return {
        bucketName: config.name,
        status: 'created'
      };
    } catch (error) {
      this.logger.error(`Failed to create bucket: ${error.message}`);
      throw error;
    }
  }

  async deleteResource(type, resourceId) {
    if (!this.ec2Client) await this.initialize();

    switch (type) {
    case 'instance':
      return await this.terminateInstance(resourceId);
    default:
      throw new Error(`Unsupported resource type: ${type}`);
    }
  }

  async terminateInstance(instanceId) {
    try {
      const command = new TerminateInstancesCommand({
        InstanceIds: [instanceId]
      });
      
      const response = await this.ec2Client.send(command);
      
      return {
        instanceId,
        status: 'terminating'
      };
    } catch (error) {
      this.logger.error(`Failed to terminate instance: ${error.message}`);
      throw error;
    }
  }

  async getMetrics(type, resourceId, metrics) {
    return {
      resourceId,
      metrics: {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        network: Math.random() * 1000
      }
    };
  }

  async estimateCost(resources) {
    const costs = {
      't2.micro': 0.0116,
      't2.small': 0.023,
      't2.medium': 0.0464,
      's3.standard': 0.023
    };

    let totalCost = 0;
    resources.forEach(resource => {
      totalCost += (costs[resource.type] || 0.01) * 730;
    });

    return {
      monthlyCost: totalCost.toFixed(2),
      currency: 'USD'
    };
  }

  async validateConfig(config) {
    const errors = [];
    const warnings = [];

    if (!config.region) {
      errors.push('Region is required');
    }

    if (!config.instanceType && config.type === 'instance') {
      warnings.push('Instance type not specified, will use t2.micro');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}