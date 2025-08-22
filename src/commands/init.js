import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import os from 'os';
import ora from 'ora';
import { GCloudAuth } from '../auth/gcloudAuth.js';
import { OllamaAI } from '../core/ollamaAI.js';

export async function initConfig() {
  console.log(chalk.cyan('\n🚀 Rig CLI Configuration\n'));

  const config = {
    providers: [],
    credentials: {}
  };

  // Step 1: Select cloud providers
  const { providers } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'providers',
      message: 'Select cloud providers to configure:',
      choices: [
        { name: 'GCP (Google Cloud Platform)', value: 'gcp' },
        { name: 'AWS (Coming Soon)', value: 'aws', disabled: true },
        { name: 'Azure (Coming Soon)', value: 'azure', disabled: true }
      ],
      validate: input => input.length > 0 || 'Please select at least one provider'
    }
  ]);

  config.providers = providers;

  // Step 2: Configure each selected provider
  for (const provider of providers) {
    if (provider === 'gcp') {
      const gcpConfig = await configureGCP();
      if (gcpConfig) {
        config.credentials.gcp = gcpConfig;
      } else {
        console.log(chalk.red('GCP configuration failed. Please try again.'));
        return;
      }
    }
    // AWS and Azure configuration will be added later
  }

  // Step 3: Configure AI provider
  const aiConfig = await configureAI();
  config.credentials.ai = aiConfig;

  // Step 4: Save configuration
  await saveConfiguration(config);

  console.log(chalk.green('\n✅ Rig CLI configured successfully!'));
  console.log(chalk.cyan('\nYou can now use:'));
  console.log(chalk.white('  rig cloud gcp --list'));
  console.log(chalk.white('  rig interactive'));
  console.log(chalk.white('  rig troubleshoot --issue "your issue"'));
  console.log();
}

async function configureGCP() {
  console.log(chalk.yellow('\n📋 Configuring Google Cloud Platform\n'));

  const gcloudAuth = new GCloudAuth();

  // Check if gcloud is installed
  const isInstalled = await gcloudAuth.checkGCloudInstalled();
  if (!isInstalled) {
    return null;
  }

  // Check current authentication status
  const authInfo = await gcloudAuth.getAuthInfo();
  
  if (authInfo.authenticated) {
    console.log(chalk.green(`✓ Already authenticated as: ${authInfo.account}`));
    
    if (authInfo.project) {
      console.log(chalk.green(`✓ Current project: ${authInfo.project}`));
      
      const { useCurrentAuth } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useCurrentAuth',
          message: 'Use current authentication and project?',
          default: true
        }
      ]);

      if (!useCurrentAuth) {
        const authenticated = await gcloudAuth.authenticate();
        if (!authenticated) {
          return null;
        }
      }
    }
  } else {
    // Not authenticated, start authentication flow
    const authenticated = await gcloudAuth.authenticate();
    if (!authenticated) {
      return null;
    }
  }

  // Get and select project
  console.log(chalk.cyan('\n🗂️  Fetching GCP projects...\n'));
  const projects = await gcloudAuth.getProjects();
  
  let projectId = await gcloudAuth.getCurrentProject();
  if (!projectId || projects.length > 1) {
    projectId = await gcloudAuth.selectProject(projects);
    if (!projectId) {
      return null;
    }
    await gcloudAuth.setProject(projectId);
  }

  // Select default region
  const region = await gcloudAuth.selectRegion();

  // Enable required APIs
  const { enableAPIs } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enableAPIs',
      message: 'Enable required GCP APIs? (Compute, Storage, Logging, etc.)',
      default: true
    }
  ]);

  if (enableAPIs) {
    await gcloudAuth.enableAPIs(projectId);
  }

  // Get final auth info
  const finalAuthInfo = await gcloudAuth.getAuthInfo();

  const gcpConfig = {
    projectId,
    region,
    account: finalAuthInfo.account,
    authenticated: true
  };

  // Save to .env
  await gcloudAuth.saveCredentials(gcpConfig);

  return gcpConfig;
}

async function configureAI() {
  console.log(chalk.yellow('\n🤖 Configuring AI Assistant\n'));

  const { aiProvider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'aiProvider',
      message: 'Select AI provider:',
      choices: [
        { name: 'Ollama (Local, Free)', value: 'ollama' },
        { name: 'OpenAI GPT-4', value: 'openai' },
        { name: 'Anthropic Claude', value: 'anthropic' },
        { name: 'None (Manual mode only)', value: 'none' }
      ]
    }
  ]);

  const config = { provider: aiProvider };

  if (aiProvider === 'ollama') {
    const ollama = new OllamaAI();
    const isRunning = await ollama.checkOllamaInstalled();
    
    if (isRunning) {
      console.log(chalk.green('✓ Ollama is running'));
      
      const models = await ollama.getAvailableModels();
      if (models.length === 0) {
        console.log(chalk.yellow('\nNo models found. You need to pull a model first.'));
        console.log(chalk.cyan('Recommended models:'));
        console.log('  • llama3.2:3b - Fast and efficient (2GB)');
        console.log('  • mistral:7b - Balanced performance (4GB)');
        console.log('  • qwen2.5-coder:7b - Optimized for code (4GB)\n');
        
        const { pullModel } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'pullModel',
            message: 'Would you like to pull a model now?',
            default: true
          }
        ]);

        if (pullModel) {
          const { modelName } = await inquirer.prompt([
            {
              type: 'list',
              name: 'modelName',
              message: 'Select model to pull:',
              choices: [
                { name: 'llama3.2:3b (2GB, fastest)', value: 'llama3.2:3b' },
                { name: 'mistral:7b (4GB, balanced)', value: 'mistral:7b' },
                { name: 'qwen2.5-coder:7b (4GB, best for code)', value: 'qwen2.5-coder:7b' },
                { name: 'mixtral:8x7b (26GB, most capable)', value: 'mixtral:8x7b' }
              ]
            }
          ]);

          await ollama.pullModel(modelName);
          config.model = modelName;
        }
      } else {
        console.log(chalk.green(`✓ Found ${models.length} model(s)`));
        
        const { selectedModel } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedModel',
            message: 'Select default model:',
            choices: models.map(m => ({
              name: `${m.name} (${formatBytes(m.size)})`,
              value: m.name
            }))
          }
        ]);
        
        config.model = selectedModel;
      }
    } else {
      console.log(chalk.yellow('\n⚠️  Ollama is not running.'));
      console.log(chalk.cyan('To use Ollama:'));
      console.log('  1. Install from: https://ollama.ai');
      console.log('  2. Run: ollama serve');
      console.log('  3. Pull a model: ollama pull llama3.2:3b\n');
    }
  } else if (aiProvider === 'openai') {
    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter OpenAI API key:',
        mask: '*',
        validate: input => input.length > 0 || 'API key is required'
      }
    ]);
    config.apiKey = apiKey;
  } else if (aiProvider === 'anthropic') {
    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter Anthropic API key:',
        mask: '*',
        validate: input => input.length > 0 || 'API key is required'
      }
    ]);
    config.apiKey = apiKey;
  }

  return config;
}

async function saveConfiguration(config) {
  // Save to home directory config
  const configDir = path.join(os.homedir(), '.rig-cli');
  const configPath = path.join(configDir, 'config.json');

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const configData = {
    providers: config.providers,
    aiProvider: config.credentials.ai.provider,
    configured: true,
    configuredAt: new Date().toISOString()
  };

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));

  // Update .env file
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Add AI configuration to .env
  if (config.credentials.ai.provider === 'ollama') {
    envContent += `\n# AI Configuration\nAI_PROVIDER=ollama\n`;
    if (config.credentials.ai.model) {
      envContent += `OLLAMA_MODEL=${config.credentials.ai.model}\n`;
    }
  } else if (config.credentials.ai.provider === 'openai') {
    envContent += `\n# AI Configuration\nAI_PROVIDER=openai\nOPENAI_API_KEY=${config.credentials.ai.apiKey}\n`;
  } else if (config.credentials.ai.provider === 'anthropic') {
    envContent += `\n# AI Configuration\nAI_PROVIDER=anthropic\nANTHROPIC_API_KEY=${config.credentials.ai.apiKey}\n`;
  }

  fs.writeFileSync(envPath, envContent.trim() + '\n');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}