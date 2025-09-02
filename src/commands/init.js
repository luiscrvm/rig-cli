import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import os from 'os';
import { GCloudAuth } from '../auth/gcloudAuth.js';
import { OllamaAI } from '../core/ollamaAI.js';

export async function initConfig() {
  console.log(chalk.cyan('\n🚀 Rig CLI Configuration\n'));

  const config = {
    providers: [],
    credentials: {}
  };

  // Step 1: Select cloud provider
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select cloud provider to configure:',
      choices: [
        { name: 'GCP (Google Cloud Platform)', value: 'gcp' },
        { name: 'AWS (Coming Soon)', value: 'aws', disabled: true },
        { name: 'Azure (Coming Soon)', value: 'azure', disabled: true }
      ]
    }
  ]);

  config.providers = [provider];

  // Step 2: Configure the selected provider
  let enableManagement = false;
  if (provider === 'gcp') {
    const gcpResult = await configureGCP();
    if (gcpResult) {
      config.credentials.gcp = gcpResult.gcpConfig;
      enableManagement = gcpResult.enableManagement;
    } else {
      console.log(chalk.red('GCP configuration failed. Please try again.'));
      return;
    }
  }
  // AWS and Azure configuration will be added later

  // Step 3: Configure AI provider
  const aiConfig = await configureAI();
  config.credentials.ai = aiConfig;

  // Step 4: Save configuration
  await saveConfiguration(config);

  if (enableManagement) {
    console.log(chalk.green('\n✅ Rig CLI configured with management capabilities!'));
    console.log(chalk.cyan('\nYou can now use:'));
    console.log(chalk.white('  rig cloud gcp --list --type instances'));
    console.log(chalk.white('  rig interactive                      # Full management mode'));
    console.log(chalk.white('  rig troubleshoot --issue "your issue"'));
    console.log(chalk.white('  rig monitor                          # Monitor resources'));
    console.log(chalk.white('  rig security --audit                 # Security audits'));
  } else {
    console.log(chalk.green('\n✅ Rig CLI ready in read-only mode!'));
    console.log(chalk.cyan('\nExploration commands:'));
    console.log(chalk.white('  rig cloud gcp --list --type instances  # View VMs'));
    console.log(chalk.white('  rig cloud gcp --list --type storage    # View storage'));
    console.log(chalk.white('  rig interactive                       # Explore safely'));
    console.log(chalk.white('  rig troubleshoot --issue "describe"    # Get help'));
    console.log(chalk.gray('\n💡 Run "rig init" again to enable management capabilities'));
  }

  // Ask if user wants to continue to interactive mode
  const { continueToInteractive } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'continueToInteractive',
      message: 'Would you like to start interactive mode now?',
      default: true
    }
  ]);

  if (continueToInteractive) {
    const { InteractiveMode } = await import('../core/interactive.js');
    const interactive = new InteractiveMode();
    await interactive.start();
  } else {
    console.log(chalk.cyan('\n👍 Configuration complete!'));
    console.log(chalk.white('You can now run any rig command:'));
    console.log(chalk.gray('  rig interactive         # Start interactive mode'));
    console.log(chalk.gray('  rig cloud gcp --list    # List resources'));
    console.log(chalk.gray('  rig --help              # Show all commands'));
    console.log(chalk.yellow('\n💡 The CLI will return to your shell prompt\n'));
  }
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
  let projectId;
  
  if (authInfo.authenticated) {
    console.log(chalk.green(`✓ Already authenticated as: ${authInfo.account}`));
    
    if (authInfo.project) {
      console.log(chalk.green(`✓ Current project: ${authInfo.project}`));
      
      const { authChoice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'authChoice',
          message: 'What would you like to do?',
          choices: [
            { name: `Use current authentication and project (${authInfo.project})`, value: 'current' },
            { name: 'Use current authentication but select different project', value: 'switch-project' },
            { name: 'Re-authenticate with different account', value: 'reauth' }
          ],
          default: 'current'
        }
      ]);

      if (authChoice === 'current') {
        projectId = authInfo.project;
        console.log(chalk.green(`✓ Using current project: ${projectId}`));
      } else if (authChoice === 'switch-project') {
        // Keep current authentication, but select different project
        console.log(chalk.cyan('\n🗂️  Fetching GCP projects for current account...\n'));
        const projects = await gcloudAuth.getProjects();
        
        projectId = await gcloudAuth.selectProject(projects);
        if (!projectId) {
          return null;
        }
        await gcloudAuth.setProject(projectId);
      } else if (authChoice === 'reauth') {
        // Re-authenticate with different account
        const authenticated = await gcloudAuth.authenticate();
        if (!authenticated) {
          return null;
        }
        
        // Get and select project after re-authentication
        console.log(chalk.cyan('\n🗂️  Fetching GCP projects...\n'));
        const projects = await gcloudAuth.getProjects();
        
        projectId = await gcloudAuth.selectProject(projects);
        if (!projectId) {
          return null;
        }
        await gcloudAuth.setProject(projectId);
      }
    } else {
      // Authenticated but no project set
      console.log(chalk.yellow('✓ Authenticated but no project selected'));
      
      console.log(chalk.cyan('\n🗂️  Fetching GCP projects...\n'));
      const projects = await gcloudAuth.getProjects();
      
      projectId = await gcloudAuth.selectProject(projects);
      if (!projectId) {
        return null;
      }
      await gcloudAuth.setProject(projectId);
    }
  } else {
    // Not authenticated, start authentication flow
    const authenticated = await gcloudAuth.authenticate();
    if (!authenticated) {
      return null;
    }

    // Get and select project after authentication
    console.log(chalk.cyan('\n🗂️  Fetching GCP projects...\n'));
    const projects = await gcloudAuth.getProjects();
    
    projectId = await gcloudAuth.selectProject(projects);
    if (!projectId) {
      return null;
    }
    await gcloudAuth.setProject(projectId);
  }

  // Default to read-only mode
  console.log(chalk.green('\n✅ Project connected in read-only mode'));
  console.log(chalk.cyan('📖 You can explore the project safely without making changes'));
  
  // Ask if user wants to enable management capabilities
  const { enableManagement } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enableManagement',
      message: 'Do you want to enable resource management capabilities? (create/modify/delete resources)',
      default: false
    }
  ]);

  let region = 'us-central1'; // Default region
  
  if (enableManagement) {
    console.log(chalk.yellow('\n⚠️  Enabling management mode - this will allow creating/modifying resources'));
    
    // Select default region
    const regionChoice = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'selectRegion',
        message: 'Do you want to select a specific default region?',
        default: false
      }
    ]);
    
    if (regionChoice.selectRegion) {
      region = await gcloudAuth.selectRegion();
    } else {
      console.log(chalk.green(`✓ Using default region: ${region}`));
    }

    // Enable required APIs for management
    const { enableAPIs } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enableAPIs',
        message: 'Enable required GCP APIs for resource management? (Compute, Storage, etc.)',
        default: true
      }
    ]);

    if (enableAPIs) {
      await gcloudAuth.enableAPIs(projectId);
    }
    
    console.log(chalk.green('\n🔧 Management mode enabled'));
  } else {
    console.log(chalk.cyan('\n👀 Read-only mode active'));
    console.log(chalk.gray('💡 You can enable management later by running: rig init'));
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

  return { gcpConfig, enableManagement };
}

async function configureAI() {
  console.log(chalk.yellow('\n🤖 Configuring AI Assistant\n'));

  const { configureMode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'configureMode',
      message: 'AI configuration mode:',
      choices: [
        { name: 'Configure single AI provider (default)', value: 'single' },
        { name: 'Configure multiple AI providers', value: 'multiple' },
        { name: 'None (Manual mode only)', value: 'none' }
      ]
    }
  ]);

  if (configureMode === 'none') {
    return { provider: 'none' };
  }

  const providers = {};
  let primaryProvider = null;

  if (configureMode === 'single') {
    const { aiProvider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'aiProvider',
        message: 'Select AI provider:',
        choices: [
          { name: 'Ollama (Local, Free)', value: 'ollama' },
          { name: 'OpenAI GPT-4', value: 'openai' },
          { name: 'Anthropic Claude', value: 'anthropic' }
        ]
      }
    ]);

    primaryProvider = aiProvider;
    const providerConfig = await configureAIProvider(aiProvider);
    if (providerConfig) {
      providers[aiProvider] = providerConfig;
    }
  } else {
    // Multiple provider configuration
    
    const { selectedProviders } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedProviders',
        message: 'Select AI providers to configure:',
        choices: [
          { name: 'Ollama (Local, Free)', value: 'ollama' },
          { name: 'OpenAI GPT-4', value: 'openai' },
          { name: 'Anthropic Claude', value: 'anthropic' }
        ],
        validate: input => input.length > 0 || 'Select at least one provider'
      }
    ]);

    // Configure each selected provider
    for (const provider of selectedProviders) {
      console.log(chalk.cyan(`\n📝 Configuring ${provider.charAt(0).toUpperCase() + provider.slice(1)}:`));
      const providerConfig = await configureAIProvider(provider);
      if (providerConfig) {
        providers[provider] = providerConfig;
      }
    }

    // Select primary provider
    if (selectedProviders.length > 1) {
      const { primary } = await inquirer.prompt([
        {
          type: 'list',
          name: 'primary',
          message: 'Select primary/default AI provider:',
          choices: selectedProviders.map(p => ({
            name: p.charAt(0).toUpperCase() + p.slice(1),
            value: p
          }))
        }
      ]);
      primaryProvider = primary;
    } else {
      primaryProvider = selectedProviders[0];
    }
  }

  return { 
    provider: primaryProvider, 
    providers: providers,
    configured: Object.keys(providers)
  };
}

async function configureAIProvider(provider) {
  if (provider === 'ollama') {
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
          return { model: modelName };
        }
        return null;
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
        
        return { model: selectedModel };
      }
    } else {
      console.log(chalk.yellow('\n⚠️  Ollama is not running.'));
      console.log(chalk.cyan('To use Ollama:'));
      console.log('  1. Install from: https://ollama.ai');
      console.log('  2. Run: ollama serve');
      console.log('  3. Pull a model: ollama pull llama3.2:3b\n');
      return null;
    }
  } else if (provider === 'openai') {
    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter OpenAI API key:',
        mask: '*',
        validate: input => input.length > 0 || 'API key is required'
      }
    ]);
    return { apiKey: apiKey };
  } else if (provider === 'anthropic') {
    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter Anthropic API key:',
        mask: '*',
        validate: input => input.length > 0 || 'API key is required'
      }
    ]);
    return { apiKey: apiKey };
  }
  return null;
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

  // Use new .env management system
  const gcloudAuth = new GCloudAuth();
  const envUpdates = {};

  // Set primary AI provider
  envUpdates.AI_PROVIDER = config.credentials.ai.provider || 'none';

  // Add all configured AI providers
  if (config.credentials.ai.providers) {
    for (const [provider, providerConfig] of Object.entries(config.credentials.ai.providers)) {
      if (provider === 'ollama' && providerConfig.model) {
        envUpdates.OLLAMA_MODEL = providerConfig.model;
      } else if (provider === 'openai' && providerConfig.apiKey) {
        envUpdates.OPENAI_API_KEY = providerConfig.apiKey;
      } else if (provider === 'anthropic' && providerConfig.apiKey) {
        envUpdates.ANTHROPIC_API_KEY = providerConfig.apiKey;
      }
    }
  } else {
    // Legacy single provider configuration
    if (config.credentials.ai.provider === 'ollama' && config.credentials.ai.model) {
      envUpdates.OLLAMA_MODEL = config.credentials.ai.model;
    } else if (config.credentials.ai.provider === 'openai' && config.credentials.ai.apiKey) {
      envUpdates.OPENAI_API_KEY = config.credentials.ai.apiKey;
    } else if (config.credentials.ai.provider === 'anthropic' && config.credentials.ai.apiKey) {
      envUpdates.ANTHROPIC_API_KEY = config.credentials.ai.apiKey;
    }
  }

  await gcloudAuth.updateEnvFile(envUpdates);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}