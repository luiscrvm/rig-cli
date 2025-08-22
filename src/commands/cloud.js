import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { CloudManager } from '../core/cloudManager.js';

export async function manageCloud(provider, options) {
  const cloudManager = new CloudManager();
  
  if (options.list) {
    await listResources(cloudManager, provider, options);
  } else {
    console.log(chalk.yellow('\nUse --list to view resources'));
    console.log(chalk.cyan('Example: devops cloud aws --list --type instances --region us-east-1\n'));
  }
}

async function listResources(cloudManager, provider, options) {
  const spinner = ora(`Fetching ${provider} resources...`).start();
  
  try {
    const resourceType = options.type || 'instances';
    const region = options.region || 'us-east-1';
    
    const resources = await cloudManager.listResources(provider, resourceType, region);
    
    spinner.succeed(`Found ${resources.length} ${resourceType}`);
    
    if (resources.length === 0) {
      console.log(chalk.yellow('\nNo resources found.\n'));
      return;
    }

    const table = new Table({
      head: ['Name', 'ID', 'Type', 'Status', 'Details'],
      style: {
        head: ['cyan']
      }
    });

    resources.forEach(resource => {
      table.push([
        resource.name || 'N/A',
        resource.id,
        resource.type || resourceType,
        getStatusColor(resource.status || resource.state),
        getResourceDetails(resource)
      ]);
    });

    console.log('\n' + table.toString() + '\n');
  } catch (error) {
    spinner.fail('Failed to fetch resources');
    console.error(chalk.red(error.message));
  }
}

function getStatusColor(status) {
  const statusLower = status?.toLowerCase() || 'unknown';
  
  if (statusLower.includes('running') || statusLower.includes('available') || statusLower.includes('active')) {
    return chalk.green(status);
  } else if (statusLower.includes('stopped') || statusLower.includes('terminated')) {
    return chalk.red(status);
  } else if (statusLower.includes('pending') || statusLower.includes('creating')) {
    return chalk.yellow(status);
  }
  
  return chalk.gray(status);
}

function getResourceDetails(resource) {
  const details = [];
  
  if (resource.publicIp) details.push(`Public: ${resource.publicIp}`);
  if (resource.privateIp) details.push(`Private: ${resource.privateIp}`);
  if (resource.location) details.push(`Location: ${resource.location}`);
  if (resource.creationDate) details.push(`Created: ${new Date(resource.creationDate).toLocaleDateString()}`);
  
  return details.join(', ') || 'N/A';
}