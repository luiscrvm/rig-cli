import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export class GCloudAuth {
  constructor() {
    this.logger = new Logger();
  }

  async checkGCloudInstalled() {
    try {
      const { stdout } = await execAsync('gcloud --version');
      const version = stdout.split('\n')[0];
      this.logger.info(`gcloud SDK found: ${version}`);
      return true;
    } catch (error) {
      console.log(chalk.red('\n❌ gcloud SDK is not installed'));
      console.log(chalk.yellow('Please install it from: https://cloud.google.com/sdk/docs/install'));
      return false;
    }
  }

  async checkAuthentication() {
    try {
      const { stdout } = await execAsync('gcloud auth list --format=json');
      const accounts = JSON.parse(stdout);
      
      if (!accounts || accounts.length === 0) {
        return { authenticated: false, account: null };
      }

      const activeAccount = accounts.find(acc => acc.status === 'ACTIVE');
      if (activeAccount) {
        return { authenticated: true, account: activeAccount.account };
      }

      return { authenticated: false, account: null };
    } catch (error) {
      this.logger.error(`Failed to check authentication: ${error.message}`);
      return { authenticated: false, account: null };
    }
  }

  async checkBrowserAvailability() {
    try {
      const { platform } = process;
      let testCommand;
      
      switch (platform) {
      case 'darwin': // macOS
        testCommand = 'which open';
        break;
      case 'win32': // Windows
        testCommand = 'where start';
        break;
      default: // Linux and others
        testCommand = 'which xdg-open';
        break;
      }
      
      await execAsync(testCommand);
      return true;
    } catch (error) {
      return false;
    }
  }

  async authenticate() {
    console.log(chalk.cyan('\n🔐 Starting GCloud authentication...\n'));
    
    // Check if browser is available
    const browserAvailable = await this.checkBrowserAvailability();
    if (!browserAvailable) {
      console.log(chalk.yellow('⚠️  Browser tools not available. Browser authentication may not work automatically.'));
    }
    
    const { authMethod } = await inquirer.prompt([
      {
        type: 'list',
        name: 'authMethod',
        message: 'Select authentication method:',
        choices: [
          { 
            name: browserAvailable ? 'Browser login (Recommended)' : 'Browser login (Manual URL opening)', 
            value: 'browser' 
          },
          { name: 'Service account key file', value: 'service-account' },
          { name: 'Application default credentials', value: 'adc' }
        ]
      }
    ]);

    try {
      switch (authMethod) {
      case 'browser':
        return await this.browserAuth();
      case 'service-account':
        return await this.serviceAccountAuth();
      case 'adc':
        return await this.adcAuth();
      }
    } catch (error) {
      console.error(chalk.red(`Authentication failed: ${error.message}`));
      return false;
    }
  }

  async browserAuth() {
    const spinner = ora('Opening browser for authentication...').start();
    
    try {
      console.log(chalk.yellow('\nA browser window will open for authentication.'));
      console.log(chalk.yellow('Please complete the login process.\n'));
      
      // Try with browser launch first
      const { stdout, stderr } = await execAsync('gcloud auth login');
      
      spinner.succeed('Authentication successful');
      
      const authInfo = await this.checkAuthentication();
      if (authInfo.authenticated) {
        console.log(chalk.green(`✓ Authenticated as: ${authInfo.account}`));
        return true;
      }
      
      return false;
    } catch (error) {
      spinner.fail('Browser authentication failed');
      
      // Fallback to manual authentication
      console.log(chalk.yellow('\n⚠️  Browser authentication failed. Trying alternative method...'));
      return await this.fallbackBrowserAuth();
    }
  }

  async fallbackBrowserAuth() {
    try {
      console.log(chalk.cyan('\n🔐 Alternative Browser Authentication'));
      console.log(chalk.yellow('Opening authentication URL manually...'));
      
      // Use no-launch-browser to get the URL for manual opening
      const { stdout, stderr } = await execAsync('gcloud auth login --no-launch-browser', {
        timeout: 30000 // 30 second timeout
      });
      
      // Extract the auth URL from the output
      const urlMatch = stdout.match(/https:\/\/accounts\.google\.com\/o\/oauth2\/auth[^\s]+/);
      if (urlMatch) {
        const authUrl = urlMatch[0];
        console.log(chalk.white('\n🌐 Please open this URL in your browser:'));
        console.log(chalk.blue(authUrl));
        
        // Try to open the URL in the default browser
        await this.openUrlInBrowser(authUrl);
      }
      
      console.log(chalk.yellow('\n⏳ Waiting for authentication to complete...'));
      
      // Wait for user to complete authentication
      const { completed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'completed',
          message: 'Have you completed the authentication in your browser?',
          default: true
        }
      ]);
      
      if (completed) {
        const authInfo = await this.checkAuthentication();
        if (authInfo.authenticated) {
          console.log(chalk.green(`✓ Authenticated as: ${authInfo.account}`));
          return true;
        } else {
          console.log(chalk.red('❌ Authentication not detected. Please try again.'));
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error(chalk.red(`\n❌ Authentication failed: ${error.message}`));
      
      console.log(chalk.yellow('\n💡 Manual authentication steps:'));
      console.log(chalk.white('1. Run: gcloud auth login'));
      console.log(chalk.white('2. Complete the browser authentication'));
      console.log(chalk.white('3. Return to this CLI'));
      
      const { retry } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'retry',
          message: 'Would you like to check authentication status now?',
          default: true
        }
      ]);
      
      if (retry) {
        const authInfo = await this.checkAuthentication();
        return authInfo.authenticated;
      }
      
      return false;
    }
  }

  async openUrlInBrowser(url) {
    try {
      const { exec } = await import('child_process');
      const { platform } = process;
      
      let command;
      switch (platform) {
      case 'darwin': // macOS
        command = `open "${url}"`;
        break;
      case 'win32': // Windows
        command = `start "" "${url}"`;
        break;
      default: // Linux and others
        command = `xdg-open "${url}"`;
        break;
      }
      
      exec(command, (error) => {
        if (error) {
          console.log(chalk.yellow('⚠️  Could not automatically open browser. Please open the URL manually.'));
        } else {
          console.log(chalk.green('✓ Browser opened automatically'));
        }
      });
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not automatically open browser. Please open the URL manually.'));
    }
  }

  async serviceAccountAuth() {
    const { keyPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'keyPath',
        message: 'Enter path to service account key file:',
        validate: input => {
          if (!input) return 'Path is required';
          if (!fs.existsSync(input)) return 'File does not exist';
          try {
            const content = fs.readFileSync(input, 'utf8');
            JSON.parse(content);
            return true;
          } catch {
            return 'Invalid JSON key file';
          }
        }
      }
    ]);

    const spinner = ora('Activating service account...').start();
    
    try {
      await execAsync(`gcloud auth activate-service-account --key-file="${keyPath}"`);
      spinner.succeed('Service account activated');
      
      process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
      
      return true;
    } catch (error) {
      spinner.fail('Failed to activate service account');
      throw error;
    }
  }

  async adcAuth() {
    const spinner = ora('Setting up application default credentials...').start();
    
    try {
      // First try with browser launch
      await execAsync('gcloud auth application-default login');
      spinner.succeed('Application default credentials configured');
      return true;
    } catch (error) {
      spinner.fail('Failed to configure application default credentials');
      
      // Fallback to manual process
      try {
        console.log(chalk.yellow('\n⚠️  Trying alternative method...'));
        
        const { stdout } = await execAsync('gcloud auth application-default login --no-launch-browser', {
          timeout: 30000
        });
        
        // Extract the auth URL from the output
        const urlMatch = stdout.match(/https:\/\/accounts\.google\.com\/o\/oauth2\/auth[^\s]+/);
        if (urlMatch) {
          const authUrl = urlMatch[0];
          console.log(chalk.white('\n🌐 Please open this URL in your browser:'));
          console.log(chalk.blue(authUrl));
          
          // Try to open the URL in the default browser
          await this.openUrlInBrowser(authUrl);
        }
        
        const { completed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'completed',
            message: 'Have you completed the authentication in your browser?',
            default: true
          }
        ]);
        
        return completed;
      } catch (fallbackError) {
        console.log(chalk.yellow('\n💡 Please run the following command manually:'));
        console.log(chalk.white('gcloud auth application-default login'));
        
        const { completed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'completed',
            message: 'Have you completed the authentication?',
            default: false
          }
        ]);
        
        return completed;
      }
    }
  }

  async getProjects() {
    try {
      const { stdout } = await execAsync('gcloud projects list --format=json');
      const projects = JSON.parse(stdout);
      
      return projects.map(p => ({
        id: p.projectId,
        name: p.name,
        number: p.projectNumber,
        state: p.lifecycleState
      }));
    } catch (error) {
      this.logger.error(`Failed to get projects: ${error.message}`);
      return [];
    }
  }

  async selectProject(projects) {
    if (projects.length === 0) {
      console.log(chalk.yellow('\nNo projects found. Please create a project in GCP console.'));
      return null;
    }

    const { projectId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'projectId',
        message: 'Select a GCP project:',
        choices: projects.map(p => ({
          name: `${p.name} (${p.id})`,
          value: p.id
        }))
      }
    ]);

    return projectId;
  }

  async setProject(projectId) {
    const spinner = ora(`Setting project to ${projectId}...`).start();
    
    try {
      await execAsync(`gcloud config set project ${projectId}`);
      spinner.succeed(`Project set to ${projectId}`);
      return true;
    } catch (error) {
      spinner.fail('Failed to set project');
      throw error;
    }
  }

  async getCurrentProject() {
    try {
      const { stdout } = await execAsync('gcloud config get-value project');
      return stdout.trim();
    } catch (error) {
      return null;
    }
  }

  async getRegions() {
    try {
      const { stdout } = await execAsync('gcloud compute regions list --format=json');
      const regions = JSON.parse(stdout);
      
      return regions.map(r => ({
        name: r.name,
        description: r.description || r.name
      }));
    } catch (error) {
      this.logger.warn('Could not fetch regions, using defaults');
      return [
        { name: 'us-central1', description: 'Iowa' },
        { name: 'us-east1', description: 'South Carolina' },
        { name: 'us-west1', description: 'Oregon' },
        { name: 'europe-west1', description: 'Belgium' },
        { name: 'asia-southeast1', description: 'Singapore' }
      ];
    }
  }

  async selectRegion() {
    const regions = await this.getRegions();
    
    const { region } = await inquirer.prompt([
      {
        type: 'list',
        name: 'region',
        message: 'Select default region:',
        choices: regions.map(r => ({
          name: `${r.name} - ${r.description}`,
          value: r.name
        })),
        default: 'us-central1'
      }
    ]);

    return region;
  }

  async enableAPIs(projectId) {
    console.log(chalk.cyan('\n🔧 Enabling required GCP APIs...\n'));
    
    const apis = [
      'compute.googleapis.com',
      'storage-api.googleapis.com',
      'cloudresourcemanager.googleapis.com',
      'logging.googleapis.com',
      'monitoring.googleapis.com'
    ];

    const spinner = ora('Enabling APIs...').start();
    
    for (const api of apis) {
      try {
        spinner.text = `Enabling ${api}...`;
        await execAsync(`gcloud services enable ${api} --project=${projectId}`);
      } catch (error) {
        this.logger.warn(`Failed to enable ${api}: ${error.message}`);
      }
    }
    
    spinner.succeed('APIs enabled');
  }

  async getAuthInfo() {
    const authStatus = await this.checkAuthentication();
    const currentProject = await this.getCurrentProject();
    
    return {
      authenticated: authStatus.authenticated,
      account: authStatus.account,
      project: currentProject
    };
  }

  async saveCredentials(config) {
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      
      // Remove old GCP configuration
      envContent = envContent.split('\n')
        .filter(line => !line.startsWith('GCP_PROJECT_ID') && 
                       !line.startsWith('GOOGLE_APPLICATION_CREDENTIALS') &&
                       !line.startsWith('GCP_REGION'))
        .join('\n');
    }

    // Add new configuration
    const gcpConfig = `
# Rig CLI Configuration
# GCP Configuration (using gcloud SDK)
GCP_PROJECT_ID=${config.projectId}
GCP_REGION=${config.region}
GCP_ACCOUNT=${config.account}
# Authentication handled by gcloud SDK
`;

    envContent = gcpConfig + envContent;
    fs.writeFileSync(envPath, envContent.trim() + '\n');
    
    console.log(chalk.green('\n✓ Configuration saved to .env file'));
  }
}