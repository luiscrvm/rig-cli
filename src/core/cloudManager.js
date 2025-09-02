// import { AWSProvider } from '../providers/aws.js';
import { GCPProvider } from '../providers/gcp.js';
// import { AzureProvider } from '../providers/azure.js';
import { Logger } from '../utils/logger.js';

export class CloudManager {
  constructor() {
    this.logger = new Logger();
    this.providers = {
      // aws: new AWSProvider(),
      gcp: new GCPProvider(),
      // azure: new AzureProvider()
    };
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      // Check if we have GCP configuration
      const hasGcpConfig = process.env.GCP_PROJECT_ID && process.env.GCP_PROJECT_ID !== 'your-gcp-project-id';
      
      if (hasGcpConfig) {
        // Verify gcloud CLI is available and authenticated
        const gcpProvider = this.providers.gcp;
        await gcpProvider.initialize(process.env.GCP_PROJECT_ID);
        this.initialized = true;
        return true;
      } else {
        // No valid configuration found
        throw new Error('No cloud provider configuration found');
      }
    } catch (error) {
      this.initialized = false;
      throw error;
    }
  }

  async getProvider(name) {
    const provider = this.providers[name.toLowerCase()];
    if (!provider) {
      throw new Error(`Unsupported cloud provider: ${name}`);
    }
    return provider;
  }

  async listResources(provider, type, region, silent = false) {
    try {
      const cloudProvider = await this.getProvider(provider);
      return await cloudProvider.listResources(type, region, silent);
    } catch (error) {
      // Only log errors if not in silent mode
      if (!silent) {
        this.logger.error(`Failed to list resources: ${error.message}`);
      }
      
      // If this is a permission error or API not enabled error, only propagate if not in silent mode
      if (!silent && (error.message.includes('❌ Permission denied') || error.message.includes('❌ ') && error.message.includes('API not enabled'))) {
        throw error;
      }
      
      // For other errors or silent mode, return empty array to allow graceful degradation
      return [];
    }
  }

  async createResource(provider, type, config) {
    try {
      const cloudProvider = await this.getProvider(provider);
      return await cloudProvider.createResource(type, config);
    } catch (error) {
      this.logger.error(`Failed to create resource: ${error.message}`);
      throw error;
    }
  }

  async deleteResource(provider, type, resourceId) {
    try {
      const cloudProvider = await this.getProvider(provider);
      return await cloudProvider.deleteResource(type, resourceId);
    } catch (error) {
      this.logger.error(`Failed to delete resource: ${error.message}`);
      throw error;
    }
  }

  async getResourceMetrics(provider, type, resourceId, metrics) {
    try {
      const cloudProvider = await this.getProvider(provider);
      return await cloudProvider.getMetrics(type, resourceId, metrics);
    } catch (error) {
      this.logger.error(`Failed to get metrics: ${error.message}`);
      throw error;
    }
  }

  async estimateCost(provider, resources) {
    try {
      const cloudProvider = await this.getProvider(provider);
      return await cloudProvider.estimateCost(resources);
    } catch (error) {
      this.logger.error(`Failed to estimate cost: ${error.message}`);
      throw error;
    }
  }

  async validateConfiguration(provider, config) {
    try {
      const cloudProvider = await this.getProvider(provider);
      return await cloudProvider.validateConfig(config);
    } catch (error) {
      this.logger.error(`Configuration validation failed: ${error.message}`);
      throw error;
    }
  }

  async listAllResources(provider = 'gcp', region = null) {
    try {
      const resourceTypes = ['instances', 'storage', 'networks', 'databases', 'load-balancers'];
      const allResources = [];
      
      for (const type of resourceTypes) {
        try {
          const resources = await this.listResources(provider, type, region, true);
          allResources.push({
            type: type,
            items: resources || []
          });
        } catch (error) {
          allResources.push({
            type: type,
            items: [],
            error: error.message
          });
        }
      }
      
      return allResources;
    } catch (error) {
      this.logger.error(`Failed to list all resources: ${error.message}`);
      throw error;
    }
  }

  async validateResourceConsistency(provider = 'gcp', region = null) {
    try {
      const resources = await this.listAllResources(provider, region);
      const summary = {
        totalResources: 0,
        totalCost: 0,
        byType: {},
        hasErrors: false,
        errors: []
      };

      for (const resourceGroup of resources) {
        summary.byType[resourceGroup.type] = {
          count: resourceGroup.items.length,
          hasError: !!resourceGroup.error
        };
        
        summary.totalResources += resourceGroup.items.length;
        
        if (resourceGroup.error) {
          summary.hasErrors = true;
          summary.errors.push({
            type: resourceGroup.type,
            error: resourceGroup.error
          });
        }
      }
      
      return summary;
    } catch (error) {
      this.logger.error(`Resource validation failed: ${error.message}`);
      throw error;
    }
  }
}