import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import os from 'os';

export async function initConfig() {
  console.log(chalk.cyan('\n🚀 DevOps CLI Configuration\n'));

  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'providers',
      message: 'Select cloud providers to configure:',
      choices: ['AWS', 'GCP', 'Azure'],
      validate: (input) => input.length > 0 || 'Please select at least one provider'
    },
    {
      type: 'list',
      name: 'aiProvider',
      message: 'Select AI assistant provider:',
      choices: [
        { name: 'OpenAI (GPT-4)', value: 'openai' },
        { name: 'Anthropic (Claude)', value: 'anthropic' },
        { name: 'Local (No API needed)', value: 'local' }
      ]
    }
  ]);

  const config = {
    providers: answers.providers,
    aiProvider: answers.aiProvider,
    credentials: {}
  };

  for (const provider of answers.providers) {
    console.log(chalk.yellow(`\nConfiguring ${provider}:`));
    
    if (provider === 'AWS') {
      const awsCreds = await inquirer.prompt([
        {
          type: 'input',
          name: 'accessKeyId',
          message: 'AWS Access Key ID:',
          validate: input => input.length > 0 || 'Access Key ID is required'
        },
        {
          type: 'password',
          name: 'secretAccessKey',
          message: 'AWS Secret Access Key:',
          mask: '*',
          validate: input => input.length > 0 || 'Secret Access Key is required'
        },
        {
          type: 'input',
          name: 'region',
          message: 'Default AWS Region:',
          default: 'us-east-1'
        }
      ]);
      config.credentials.aws = awsCreds;
    }

    if (provider === 'GCP') {
      const gcpCreds = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectId',
          message: 'GCP Project ID:',
          validate: input => input.length > 0 || 'Project ID is required'
        },
        {
          type: 'input',
          name: 'keyFile',
          message: 'Path to service account key file:',
          validate: input => {
            if (!input) return 'Key file path is required';
            if (!fs.existsSync(input)) return 'File does not exist';
            return true;
          }
        }
      ]);
      config.credentials.gcp = gcpCreds;
    }

    if (provider === 'Azure') {
      const azureCreds = await inquirer.prompt([
        {
          type: 'input',
          name: 'subscriptionId',
          message: 'Azure Subscription ID:',
          validate: input => input.length > 0 || 'Subscription ID is required'
        },
        {
          type: 'input',
          name: 'tenantId',
          message: 'Azure Tenant ID:',
          validate: input => input.length > 0 || 'Tenant ID is required'
        },
        {
          type: 'input',
          name: 'clientId',
          message: 'Azure Client ID:',
          validate: input => input.length > 0 || 'Client ID is required'
        },
        {
          type: 'password',
          name: 'clientSecret',
          message: 'Azure Client Secret:',
          mask: '*',
          validate: input => input.length > 0 || 'Client Secret is required'
        }
      ]);
      config.credentials.azure = azureCreds;
    }
  }

  if (answers.aiProvider !== 'local') {
    console.log(chalk.yellow(`\nConfiguring ${answers.aiProvider} AI:`));
    
    const aiCreds = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: `${answers.aiProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key:`,
        mask: '*',
        validate: input => input.length > 0 || 'API Key is required'
      }
    ]);
    config.credentials.ai = aiCreds;
  }

  const { saveLocation } = await inquirer.prompt([
    {
      type: 'list',
      name: 'saveLocation',
      message: 'Where to save configuration?',
      choices: [
        { name: 'Environment file (.env)', value: 'env' },
        { name: 'Config file (devops-config.json)', value: 'json' },
        { name: 'Both', value: 'both' }
      ]
    }
  ]);

  if (saveLocation === 'env' || saveLocation === 'both') {
    await saveEnvFile(config);
  }

  if (saveLocation === 'json' || saveLocation === 'both') {
    await saveJsonConfig(config);
  }

  console.log(chalk.green('\n✅ Configuration saved successfully!'));
  console.log(chalk.cyan('\nYou can now use the DevOps CLI with:'));
  console.log(chalk.white('  devops cloud aws --list'));
  console.log(chalk.white('  devops interactive'));
  console.log(chalk.white('  devops troubleshoot --issue "connection timeout"'));
  console.log();
}

async function saveEnvFile(config) {
  let envContent = '# DevOps CLI Configuration\n\n';

  if (config.credentials.aws) {
    envContent += '# AWS Configuration\n';
    envContent += `AWS_ACCESS_KEY_ID=${config.credentials.aws.accessKeyId}\n`;
    envContent += `AWS_SECRET_ACCESS_KEY=${config.credentials.aws.secretAccessKey}\n`;
    envContent += `AWS_DEFAULT_REGION=${config.credentials.aws.region}\n\n`;
  }

  if (config.credentials.gcp) {
    envContent += '# GCP Configuration\n';
    envContent += `GCP_PROJECT_ID=${config.credentials.gcp.projectId}\n`;
    envContent += `GOOGLE_APPLICATION_CREDENTIALS=${config.credentials.gcp.keyFile}\n\n`;
  }

  if (config.credentials.azure) {
    envContent += '# Azure Configuration\n';
    envContent += `AZURE_SUBSCRIPTION_ID=${config.credentials.azure.subscriptionId}\n`;
    envContent += `AZURE_TENANT_ID=${config.credentials.azure.tenantId}\n`;
    envContent += `AZURE_CLIENT_ID=${config.credentials.azure.clientId}\n`;
    envContent += `AZURE_CLIENT_SECRET=${config.credentials.azure.clientSecret}\n\n`;
  }

  if (config.credentials.ai) {
    envContent += '# AI Configuration\n';
    envContent += `AI_PROVIDER=${config.aiProvider}\n`;
    if (config.aiProvider === 'openai') {
      envContent += `OPENAI_API_KEY=${config.credentials.ai.apiKey}\n`;
    } else {
      envContent += `ANTHROPIC_API_KEY=${config.credentials.ai.apiKey}\n`;
    }
  }

  const envPath = path.join(process.cwd(), '.env');
  fs.writeFileSync(envPath, envContent);
  console.log(chalk.green(`  ✓ Created .env file`));
}

async function saveJsonConfig(config) {
  const configPath = path.join(os.homedir(), '.devops-cli', 'config.json');
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const sanitizedConfig = {
    providers: config.providers,
    aiProvider: config.aiProvider,
    configured: true,
    configuredAt: new Date().toISOString()
  };

  fs.writeFileSync(configPath, JSON.stringify(sanitizedConfig, null, 2));
  console.log(chalk.green(`  ✓ Created config file at ${configPath}`));
}