import chalk from 'chalk';
import inquirer from 'inquirer';
import { GCloudAuth } from '../auth/gcloudAuth.js';
import { Logger } from '../utils/logger.js';

export async function apiCommand(options) {
  const gcloudAuth = new GCloudAuth();
  const logger = new Logger();

  console.log(chalk.green.bold('\n🔧 GCP API MANAGEMENT'));
  console.log(chalk.green('='.repeat(50)));

  try {
    // Check if gcloud is installed and authenticated
    const isInstalled = await gcloudAuth.checkGCloudInstalled();
    if (!isInstalled) {
      return;
    }

    const authInfo = await gcloudAuth.getAuthInfo();
    if (!authInfo.authenticated) {
      console.log(chalk.red('\n❌ Not authenticated with gcloud. Please run "rig init" first.\n'));
      return;
    }

    if (!authInfo.project) {
      console.log(chalk.red('\n❌ No GCP project selected. Please run "rig init" to select a project.\n'));
      return;
    }

    console.log(chalk.cyan(`\nProject: ${authInfo.project}`));
    console.log(chalk.cyan(`Account: ${authInfo.account}\n`));

    if (!options.enable && !options.disable && !options.disableAll && !options.list && !options.check) {
      // Interactive mode
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📋 List currently enabled APIs', value: 'list' },
            { name: '🔍 Check required API status', value: 'check' },
            { name: '⚡ Enable specific APIs', value: 'enable' },
            { name: '🚫 Disable specific APIs', value: 'disable' },
            { name: '🚫 Disable all non-essential APIs', value: 'disable-all' },
            { name: '🔄 Force re-enable all required APIs', value: 'force' },
            { name: '🧹 Clear API cache', value: 'clear-cache' }
          ]
        }
      ]);

      switch (action) {
      case 'list':
        await listEnabledApis(gcloudAuth, authInfo.project);
        break;
      case 'check':
        await checkRequiredApis(gcloudAuth, authInfo.project);
        break;
      case 'enable':
        await interactiveEnableApis(gcloudAuth, authInfo.project);
        break;
      case 'disable':
        await interactiveDisableApis(gcloudAuth, authInfo.project);
        break;
      case 'disable-all':
        await gcloudAuth.disableAllNonEssentialAPIs(authInfo.project, options.yes);
        break;
      case 'force':
        await gcloudAuth.enableAPIs(authInfo.project, true);
        break;
      case 'clear-cache':
        await clearApiCache(gcloudAuth);
        break;
      }
    } else {
      // Command line options
      if (options.list) {
        await listEnabledApis(gcloudAuth, authInfo.project);
      }
      
      if (options.check) {
        await checkRequiredApis(gcloudAuth, authInfo.project);
      }
      
      if (options.enable) {
        const apis = options.enable.split(',').map(api => api.trim());
        await gcloudAuth.enableAPIs(authInfo.project, options.force, apis);
      }

      if (options.disable) {
        const apis = options.disable.split(',').map(api => api.trim());
        await gcloudAuth.disableAPIs(authInfo.project, apis, options.yes);
      }

      if (options.disableAll) {
        await gcloudAuth.disableAllNonEssentialAPIs(authInfo.project, options.yes);
      }
    }

  } catch (error) {
    logger.error(`API management failed: ${error.message}`);
    console.error(chalk.red(`\n❌ API management failed: ${error.message}`));
  }
}

async function listEnabledApis(gcloudAuth, projectId) {
  const { execAsync } = await import('util');
  const { promisify } = await import('util');
  const exec = promisify((await import('child_process')).exec);

  try {
    console.log(chalk.cyan('\n📋 Currently Enabled APIs:\n'));
    
    const { stdout } = await exec(`gcloud services list --enabled --project=${projectId} --format=json`);
    const enabledServices = JSON.parse(stdout);
    
    if (enabledServices.length === 0) {
      console.log(chalk.yellow('No APIs are currently enabled.\n'));
      return;
    }

    // Group APIs by category for better display
    const categories = {
      compute: [],
      storage: [],
      networking: [],
      data: [],
      ai: [],
      other: []
    };

    enabledServices.forEach(service => {
      const name = service.config.name;
      const title = service.config.title;
      
      if (name.includes('compute') || name.includes('container')) {
        categories.compute.push({ name, title });
      } else if (name.includes('storage') || name.includes('cloudsql')) {
        categories.storage.push({ name, title });
      } else if (name.includes('network') || name.includes('dns')) {
        categories.networking.push({ name, title });
      } else if (name.includes('bigquery') || name.includes('dataflow') || name.includes('logging')) {
        categories.data.push({ name, title });
      } else if (name.includes('ai') || name.includes('ml') || name.includes('translate')) {
        categories.ai.push({ name, title });
      } else {
        categories.other.push({ name, title });
      }
    });

    // Display categorized APIs
    const categoryNames = {
      compute: '🖥️ Compute & Containers',
      storage: '💾 Storage & Databases', 
      networking: '🌐 Networking',
      data: '📊 Data & Analytics',
      ai: '🤖 AI & Machine Learning',
      other: '📦 Other Services'
    };

    for (const [key, apis] of Object.entries(categories)) {
      if (apis.length > 0) {
        console.log(chalk.white.bold(categoryNames[key]));
        apis.forEach(api => {
          console.log(`  • ${chalk.green(api.name)} - ${api.title}`);
        });
        console.log();
      }
    }

    console.log(chalk.white(`Total: ${enabledServices.length} APIs enabled\n`));

  } catch (error) {
    console.log(chalk.red(`\n❌ Failed to list APIs: ${error.message}\n`));
  }
}

async function checkRequiredApis(gcloudAuth, projectId) {
  const requiredApis = [
    'compute.googleapis.com',
    'storage-api.googleapis.com',
    'cloudresourcemanager.googleapis.com', 
    'logging.googleapis.com',
    'monitoring.googleapis.com'
  ];

  const { execAsync } = await import('util');
  const { promisify } = await import('util');
  const exec = promisify((await import('child_process')).exec);

  try {
    console.log(chalk.cyan('\n🔍 Required API Status:\n'));
    
    const { stdout } = await exec(`gcloud services list --enabled --project=${projectId} --format=json`);
    const enabledServices = JSON.parse(stdout);
    const enabledApiNames = enabledServices.map(service => service.config.name);

    const apiDescriptions = {
      'compute.googleapis.com': 'Compute Engine API - Virtual machines and infrastructure',
      'storage-api.googleapis.com': 'Cloud Storage API - Object storage and file management',
      'cloudresourcemanager.googleapis.com': 'Resource Manager API - Project and resource management',
      'logging.googleapis.com': 'Cloud Logging API - Log collection and analysis',
      'monitoring.googleapis.com': 'Cloud Monitoring API - Metrics and alerting'
    };

    requiredApis.forEach(api => {
      const isEnabled = enabledApiNames.includes(api);
      const status = isEnabled ? chalk.green('✅ Enabled') : chalk.red('❌ Disabled');
      const description = apiDescriptions[api] || 'Required for CLI functionality';
      
      console.log(`${status} ${chalk.white(api)}`);
      console.log(`   ${chalk.gray(description)}\n`);
    });

    const enabledCount = requiredApis.filter(api => enabledApiNames.includes(api)).length;
    const disabledCount = requiredApis.length - enabledCount;

    if (disabledCount > 0) {
      console.log(chalk.yellow(`⚠️  ${disabledCount} required APIs are disabled. Run "rig api --enable" to enable them.\n`));
    } else {
      console.log(chalk.green('🎉 All required APIs are enabled!\n'));
    }

  } catch (error) {
    console.log(chalk.red(`\n❌ Failed to check API status: ${error.message}\n`));
  }
}

async function interactiveEnableApis(gcloudAuth, projectId) {
  const availableApis = [
    { name: 'compute.googleapis.com', description: 'Compute Engine API' },
    { name: 'storage-api.googleapis.com', description: 'Cloud Storage API' },
    { name: 'cloudresourcemanager.googleapis.com', description: 'Resource Manager API' },
    { name: 'logging.googleapis.com', description: 'Cloud Logging API' },
    { name: 'monitoring.googleapis.com', description: 'Cloud Monitoring API' },
    { name: 'container.googleapis.com', description: 'Kubernetes Engine API' },
    { name: 'cloudsql.googleapis.com', description: 'Cloud SQL API' },
    { name: 'bigquery.googleapis.com', description: 'BigQuery API' },
    { name: 'pubsub.googleapis.com', description: 'Pub/Sub API' },
    { name: 'cloudkms.googleapis.com', description: 'Cloud KMS API' }
  ];

  const { apisToEnable } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'apisToEnable',
      message: 'Select APIs to enable:',
      choices: availableApis.map(api => ({
        name: `${api.name} - ${api.description}`,
        value: api.name
      })),
      validate: input => {
        if (input.length === 0) {
          return 'Please select at least one API to enable.';
        }
        return true;
      }
    }
  ]);

  if (apisToEnable.length > 0) {
    await gcloudAuth.enableAPIs(projectId, false, apisToEnable);
  }
}

async function interactiveDisableApis(gcloudAuth, projectId) {
  const { execAsync } = await import('util');
  const { promisify } = await import('util');
  const exec = promisify((await import('child_process')).exec);

  try {
    console.log(chalk.red('\n🚫 Interactive API Disabling\n'));
    
    // Get currently enabled APIs
    const { stdout } = await exec(`gcloud services list --enabled --project=${projectId} --format=json`);
    const enabledServices = JSON.parse(stdout);
    
    if (enabledServices.length === 0) {
      console.log(chalk.yellow('No APIs are currently enabled.\n'));
      return;
    }

    const essentialApis = gcloudAuth.getEssentialApis();
    
    // Create choices with warnings for essential APIs
    const apiChoices = enabledServices.map(service => {
      const isEssential = essentialApis.includes(service.config.name);
      const warning = isEssential ? chalk.red(' [ESSENTIAL - May break CLI]') : '';
      
      return {
        name: `${service.config.name} - ${service.config.title}${warning}`,
        value: service.config.name
      };
    });

    const { apisToDisable } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'apisToDisable',
        message: 'Select APIs to disable (use arrow keys and spacebar):',
        choices: apiChoices,
        validate: input => {
          if (input.length === 0) {
            return 'Please select at least one API to disable.';
          }
          return true;
        }
      }
    ]);

    if (apisToDisable.length > 0) {
      // Check if user selected essential APIs
      const selectedEssential = apisToDisable.filter(api => essentialApis.includes(api));
      
      if (selectedEssential.length > 0) {
        console.log(chalk.red('\n⚠️  WARNING: You selected essential APIs that may break Rig CLI functionality:'));
        selectedEssential.forEach(api => {
          console.log(chalk.red(`  • ${api}`));
        });
        console.log();

        const { confirmEssential } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmEssential',
            message: 'Do you still want to disable these essential APIs?',
            default: false
          }
        ]);

        if (!confirmEssential) {
          console.log(chalk.yellow('❌ API disabling cancelled\n'));
          return;
        }
      }

      await gcloudAuth.disableAPIs(projectId, apisToDisable, false);
    }

  } catch (error) {
    console.log(chalk.red(`\n❌ Failed to get API list: ${error.message}\n`));
  }
}

async function clearApiCache(gcloudAuth) {
  try {
    const { unlink, existsSync } = await import('fs');
    const path = await import('path');
    
    const cacheFile = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.rig-cli', 'api-cache.json');
    
    if (existsSync(cacheFile)) {
      unlink(cacheFile, (err) => {
        if (err) {
          console.log(chalk.red(`\n❌ Failed to clear cache: ${err.message}\n`));
        } else {
          console.log(chalk.green('\n✅ API cache cleared successfully\n'));
        }
      });
    } else {
      console.log(chalk.yellow('\n💡 No API cache found to clear\n'));
    }
  } catch (error) {
    console.log(chalk.red(`\n❌ Failed to clear cache: ${error.message}\n`));
  }
}