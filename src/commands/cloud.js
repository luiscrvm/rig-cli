import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { CloudManager } from '../core/cloudManager.js';

export async function manageCloud(provider, options) {
  const cloudManager = new CloudManager();
  
  // Set verbose mode globally if requested
  if (options.verbose) {
    process.env.RIG_VERBOSE = 'true';
    console.log(chalk.gray('🔍 Verbose mode enabled\n'));
  }
  
  if (options.list) {
    await listResources(cloudManager, provider, options);
  } else {
    console.log(chalk.yellow('\nUse --list to view resources'));
    console.log(chalk.cyan('Example: rig cloud gcp --list --type instances --region us-central1\n'));
  }
}

async function listResources(cloudManager, provider, options) {
  const resourceType = options.type; // No default - list all if not specified
  const region = options.region; // Don't default to any region - pull from entire project
  
  if (options.verbose) {
    console.log(chalk.gray(`📋 Resource query details:`));
    console.log(chalk.gray(`   Provider: ${provider}`));
    console.log(chalk.gray(`   Type: ${resourceType || 'all resource types'}`));
    console.log(chalk.gray(`   Region: ${region || 'all regions/zones'}`));
    console.log();
  }
  
  const spinner = ora(`Fetching ${provider} ${resourceType || 'resources'}${region ? ` in ${region}` : ' from project'}...`).start();
  
  try {
    // Add timeout to prevent infinite hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out after 30 seconds')), 30000);
    });
    
    let resources = [];
    
    if (resourceType) {
      // Fetch specific resource type
      const resourcePromise = cloudManager.listResources(provider, resourceType, region);
      resources = await Promise.race([resourcePromise, timeoutPromise]);
    } else {
      // Discover all available resources in the project
      const resourcePromise = cloudManager.listResources(provider, null, region, true);
      resources = await Promise.race([resourcePromise, timeoutPromise]);
    }
    
    if (resources.length === 0) {
      spinner.warn('No resources found or access denied');
      console.log(chalk.yellow('\nNo resources found.'));
      console.log(chalk.gray('This could be due to:'));
      console.log(chalk.gray('  • No resources of this type exist'));
      console.log(chalk.gray('  • Insufficient permissions to list resources'));
      console.log(chalk.gray('  • Resources exist in a different region'));
      if (options.verbose) {
        console.log(chalk.gray('  • Try running with --verbose to see more details'));
      }
      console.log(chalk.cyan('\n💡 Try enabling APIs or checking permissions in GCP Console\n'));
      return;
    }

    spinner.succeed(`Found ${resources.length} resource${resources.length !== 1 ? 's' : ''}`);

    const table = new Table({
      head: resourceType ? ['Name', 'ID', 'Type', 'Status', 'Details'] : ['Name', 'ID', 'Resource Type', 'Status', 'Details'],
      style: {
        head: ['cyan']
      }
    });

    resources.forEach(resource => {
      table.push([
        resource.name || 'N/A',
        resource.id,
        resource.type || resource.resourceType || 'Unknown',
        getStatusColor(resource.status || resource.state),
        getResourceDetails(resource)
      ]);
    });

    console.log('\n' + table.toString() + '\n');
  } catch (error) {
    spinner.fail('Failed to fetch resources');
    console.log(chalk.red(`\n❌ Error: ${error.message}`));
    
    if (options.verbose) {
      console.log(chalk.gray('\n🔍 Verbose Error Details:'));
      console.log(chalk.gray(`Error type: ${error.constructor.name}`));
      if (error.stack) {
        console.log(chalk.gray(`Stack trace: ${error.stack.split('\n').slice(0, 3).join('\n')}`));
      }
    }
    
    // Provide helpful suggestions based on the error
    if (error.message.includes('API not enabled')) {
      console.log(chalk.yellow('\n💡 Try these alternatives while the API is being enabled:'));
      if (resourceType === 'instances') {
        console.log(chalk.cyan('  rig cloud gcp --list --type storage    # Cloud Storage buckets'));
        console.log(chalk.cyan('  rig cloud gcp --list --type network    # VPC networks'));
      } else if (resourceType === 'storage') {
        console.log(chalk.cyan('  rig cloud gcp --list --type instances  # Compute instances'));
        console.log(chalk.cyan('  rig cloud gcp --list --type network    # VPC networks'));
      } else if (resourceType) {
        console.log(chalk.cyan('  rig cloud gcp --list                   # Try all resource types'));
        console.log(chalk.cyan('  rig cloud gcp --list --type storage    # Cloud Storage buckets'));
        console.log(chalk.cyan('  rig cloud gcp --list --type network    # VPC networks'));
      } else {
        console.log(chalk.gray('Some APIs may not be enabled. Enable them in GCP Console and try again.'));
      }
      console.log(chalk.gray('\n  Or enable the API in GCP Console and try again'));
    } else if (error.message.includes('Permission denied')) {
      console.log(chalk.yellow('\n💡 Try these alternatives:'));
      console.log(chalk.cyan('  rig cloud gcp --list --type storage    # If you have storage access'));
      console.log(chalk.cyan('  rig cloud gcp --list --type network    # If you have network access'));
      console.log(chalk.gray('\n  Or contact your GCP admin for the required permissions'));
    } else {
      console.log(chalk.yellow('\n💡 You can still try other resource types or commands'));
    }
    console.log();
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