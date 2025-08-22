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
  }

  async getProvider(name) {
    const provider = this.providers[name.toLowerCase()];
    if (!provider) {
      throw new Error(`Unsupported cloud provider: ${name}`);
    }
    return provider;
  }

  async listResources(provider, type, region) {
    try {
      const cloudProvider = await this.getProvider(provider);
      return await cloudProvider.listResources(type, region);
    } catch (error) {
      this.logger.error(`Failed to list resources: ${error.message}`);
      throw error;
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
}