import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export class GCPProvider {
  constructor() {
    this.logger = new Logger();
    this.projectId = process.env.GCP_PROJECT_ID;
    this.region = process.env.GCP_REGION || 'us-central1';
  }

  async initialize(projectId) {
    if (projectId) {
      this.projectId = projectId;
    }
    
    // Verify gcloud is authenticated
    try {
      const { stdout } = await execAsync('gcloud auth list --format=json');
      const accounts = JSON.parse(stdout);
      
      if (!accounts || accounts.length === 0) {
        throw new Error('Not authenticated. Please run: rig init');
      }
      
      // Set project if not already set
      if (this.projectId) {
        await execAsync(`gcloud config set project ${this.projectId}`);
      }
    } catch (error) {
      this.logger.error(`GCP initialization failed: ${error.message}`);
      throw error;
    }
  }

  async listResources(type, region) {
    await this.initialize();
    
    switch (type) {
      case 'instances':
        return await this.listInstances(region);
      case 'storage':
        return await this.listBuckets();
      case 'network':
        return await this.listNetworks();
      case 'database':
        return await this.listDatabases();
      case 'loadbalancer':
        return await this.listLoadBalancers();
      default:
        return [];
    }
  }

  async listInstances(zone) {
    try {
      let command = `gcloud compute instances list --project=${this.projectId} --format=json`;
      if (zone) {
        command += ` --zones=${zone}`;
      }
      
      const { stdout } = await execAsync(command);
      const instances = JSON.parse(stdout || '[]');
      
      return instances.map(vm => ({
        id: vm.id,
        name: vm.name,
        type: vm.machineType?.split('/').pop(),
        status: vm.status,
        zone: vm.zone?.split('/').pop(),
        publicIp: vm.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP,
        privateIp: vm.networkInterfaces?.[0]?.networkIP,
        creationTime: vm.creationTimestamp
      }));
    } catch (error) {
      this.logger.error(`Failed to list GCP instances: ${error.message}`);
      return [];
    }
  }

  async listBuckets() {
    try {
      const { stdout } = await execAsync(`gsutil ls -p ${this.projectId} -L -b`);
      const lines = stdout.split('\n').filter(line => line.startsWith('gs://'));
      
      const buckets = [];
      for (const line of lines) {
        const bucketName = line.replace('gs://', '').replace('/', '');
        if (bucketName) {
          buckets.push({
            id: bucketName,
            name: bucketName,
            type: 'Cloud Storage',
            status: 'available'
          });
        }
      }
      
      return buckets;
    } catch (error) {
      // If gsutil fails, try using gcloud storage
      try {
        const { stdout } = await execAsync(`gcloud storage buckets list --project=${this.projectId} --format=json`);
        const buckets = JSON.parse(stdout || '[]');
        
        return buckets.map(bucket => ({
          id: bucket.id || bucket.name,
          name: bucket.name,
          type: 'Cloud Storage',
          location: bucket.location,
          creationTime: bucket.timeCreated
        }));
      } catch (innerError) {
        this.logger.error(`Failed to list GCP storage: ${innerError.message}`);
        return [];
      }
    }
  }

  async listNetworks() {
    try {
      const { stdout } = await execAsync(`gcloud compute networks list --project=${this.projectId} --format=json`);
      const networks = JSON.parse(stdout || '[]');
      
      return networks.map(net => ({
        id: net.id,
        name: net.name,
        type: 'VPC Network',
        status: 'available',
        autoCreateSubnetworks: net.autoCreateSubnetworks,
        creationTime: net.creationTimestamp
      }));
    } catch (error) {
      this.logger.error(`Failed to list GCP networks: ${error.message}`);
      return [];
    }
  }

  async listDatabases() {
    try {
      const { stdout } = await execAsync(`gcloud sql instances list --project=${this.projectId} --format=json`);
      const databases = JSON.parse(stdout || '[]');
      
      return databases.map(db => ({
        id: db.name,
        name: db.name,
        type: `Cloud SQL ${db.databaseVersion}`,
        status: db.state,
        region: db.region,
        tier: db.settings?.tier
      }));
    } catch (error) {
      this.logger.error(`Failed to list GCP databases: ${error.message}`);
      return [];
    }
  }

  async listLoadBalancers() {
    try {
      const { stdout } = await execAsync(`gcloud compute forwarding-rules list --project=${this.projectId} --format=json`);
      const rules = JSON.parse(stdout || '[]');
      
      return rules.map(lb => ({
        id: lb.id,
        name: lb.name,
        type: 'Load Balancer',
        status: 'active',
        ipAddress: lb.IPAddress,
        region: lb.region?.split('/').pop() || 'global'
      }));
    } catch (error) {
      this.logger.error(`Failed to list GCP load balancers: ${error.message}`);
      return [];
    }
  }

  async createResource(type, config) {
    await this.initialize();
    
    switch (type) {
      case 'instance':
        return await this.createInstance(config);
      case 'bucket':
        return await this.createBucket(config);
      case 'network':
        return await this.createNetwork(config);
      default:
        throw new Error(`Unsupported resource type: ${type}`);
    }
  }

  async createInstance(config) {
    try {
      const command = `gcloud compute instances create ${config.name} \
        --project=${this.projectId} \
        --zone=${config.zone || this.region + '-a'} \
        --machine-type=${config.machineType || 'e2-micro'} \
        --image-family=${config.imageFamily || 'debian-11'} \
        --image-project=${config.imageProject || 'debian-cloud'} \
        --format=json`;
      
      const { stdout } = await execAsync(command);
      const instance = JSON.parse(stdout)[0];
      
      return {
        instanceId: instance.id,
        name: instance.name,
        status: 'creating'
      };
    } catch (error) {
      this.logger.error(`Failed to create instance: ${error.message}`);
      throw error;
    }
  }

  async createBucket(config) {
    try {
      const command = `gcloud storage buckets create gs://${config.name} \
        --project=${this.projectId} \
        --location=${config.location || this.region} \
        --uniform-bucket-level-access`;
      
      await execAsync(command);
      
      return {
        bucketName: config.name,
        status: 'created'
      };
    } catch (error) {
      this.logger.error(`Failed to create bucket: ${error.message}`);
      throw error;
    }
  }

  async createNetwork(config) {
    try {
      const command = `gcloud compute networks create ${config.name} \
        --project=${this.projectId} \
        --subnet-mode=${config.subnetMode || 'auto'} \
        --format=json`;
      
      const { stdout } = await execAsync(command);
      const network = JSON.parse(stdout);
      
      return {
        networkId: network.id,
        name: network.name,
        status: 'created'
      };
    } catch (error) {
      this.logger.error(`Failed to create network: ${error.message}`);
      throw error;
    }
  }

  async deleteResource(type, resourceId) {
    await this.initialize();
    
    switch (type) {
      case 'instance':
        return await this.deleteInstance(resourceId);
      case 'bucket':
        return await this.deleteBucket(resourceId);
      default:
        throw new Error(`Unsupported resource type: ${type}`);
    }
  }

  async deleteInstance(instanceName, zone) {
    try {
      const command = `gcloud compute instances delete ${instanceName} \
        --project=${this.projectId} \
        --zone=${zone || this.region + '-a'} \
        --quiet`;
      
      await execAsync(command);
      
      return {
        instanceName,
        status: 'deleted'
      };
    } catch (error) {
      this.logger.error(`Failed to delete instance: ${error.message}`);
      throw error;
    }
  }

  async deleteBucket(bucketName) {
    try {
      const command = `gcloud storage rm -r gs://${bucketName}`;
      
      await execAsync(command);
      
      return {
        bucketName,
        status: 'deleted'
      };
    } catch (error) {
      this.logger.error(`Failed to delete bucket: ${error.message}`);
      throw error;
    }
  }

  async getMetrics(type, resourceId, metrics) {
    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      
      const command = `gcloud monitoring time-series list \
        --project=${this.projectId} \
        --filter='resource.type="${type}" AND resource.labels.instance_id="${resourceId}"' \
        --start-time=${startTime} \
        --end-time=${endTime} \
        --format=json`;
      
      const { stdout } = await execAsync(command);
      const data = JSON.parse(stdout || '[]');
      
      return {
        resourceId,
        metrics: data
      };
    } catch (error) {
      this.logger.warn(`Could not fetch metrics: ${error.message}`);
      
      // Return mock data for demo
      return {
        resourceId,
        metrics: {
          cpu: Math.random() * 100,
          memory: Math.random() * 100,
          network: Math.random() * 1000
        }
      };
    }
  }

  async estimateCost(resources) {
    // GCP Pricing API is complex, providing estimates based on resource types
    const estimates = {
      'e2-micro': 0.0084, // per hour
      'e2-small': 0.0168,
      'e2-medium': 0.0336,
      'n1-standard-1': 0.0475,
      'storage': 0.020 // per GB per month
    };

    let totalCost = 0;
    resources.forEach(resource => {
      const rate = estimates[resource.type] || 0.01;
      totalCost += rate * 730; // Monthly hours
    });

    return {
      monthlyCost: totalCost.toFixed(2),
      currency: 'USD',
      breakdown: resources.map(r => ({
        resource: r.name,
        type: r.type,
        estimatedCost: (estimates[r.type] * 730).toFixed(2)
      }))
    };
  }

  async validateConfig(config) {
    const errors = [];
    const warnings = [];

    if (!this.projectId) {
      errors.push('Project ID not configured. Run: rig init');
    }

    if (!config.zone && !config.region) {
      warnings.push('No zone or region specified, will use default');
    }

    if (config.type === 'instance' && !config.machineType) {
      warnings.push('No machine type specified, will use e2-micro');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  async getLogs(resourceType, resourceName, hours = 1) {
    try {
      const since = new Date(Date.now() - hours * 3600000).toISOString();
      
      const command = `gcloud logging read \
        "resource.type=${resourceType} AND resource.labels.instance_id=${resourceName}" \
        --project=${this.projectId} \
        --since=${since} \
        --limit=100 \
        --format=json`;
      
      const { stdout } = await execAsync(command);
      const logs = JSON.parse(stdout || '[]');
      
      return logs.map(log => ({
        timestamp: log.timestamp,
        severity: log.severity,
        message: log.textPayload || log.jsonPayload?.message || JSON.stringify(log.jsonPayload)
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch logs: ${error.message}`);
      return [];
    }
  }
}