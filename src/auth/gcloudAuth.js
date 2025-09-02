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

  async enableAPIs(projectId, forceReEnable = false, specificApis = null) {
    const requiredApis = specificApis || [
      'compute.googleapis.com',
      'storage-api.googleapis.com', 
      'cloudresourcemanager.googleapis.com',
      'logging.googleapis.com',
      'monitoring.googleapis.com'
    ];

    console.log(chalk.cyan('\n🔧 Checking GCP API status...\n'));
    
    const spinner = ora('Checking enabled APIs...').start();
    
    try {
      // Get list of enabled APIs
      const { stdout } = await execAsync(`gcloud services list --enabled --project=${projectId} --format=json`);
      const enabledServices = JSON.parse(stdout);
      const enabledApiNames = enabledServices.map(service => service.config.name);
      
      spinner.text = 'Analyzing API requirements...';
      
      // Find APIs that need to be enabled
      const apisToEnable = requiredApis.filter(api => {
        const isEnabled = enabledApiNames.includes(api);
        if (isEnabled && !forceReEnable) {
          this.logger.info(`API ${api} already enabled`);
          return false;
        }
        return true;
      });
      
      if (apisToEnable.length === 0) {
        spinner.succeed('All required APIs are already enabled');
        console.log(chalk.green('✅ No API changes needed\n'));
        return;
      }
      
      spinner.text = `Enabling ${apisToEnable.length} APIs...`;
      console.log(chalk.yellow(`\nEnabling ${apisToEnable.length} missing APIs:\n`));
      
      let enabledCount = 0;
      let failedCount = 0;
      
      for (const api of apisToEnable) {
        try {
          spinner.text = `Enabling ${api}...`;
          await execAsync(`gcloud services enable ${api} --project=${projectId}`);
          console.log(chalk.green(`  ✅ ${api}`));
          enabledCount++;
        } catch (error) {
          console.log(chalk.red(`  ❌ ${api} - ${error.message}`));
          this.logger.warn(`Failed to enable ${api}: ${error.message}`);
          failedCount++;
        }
      }
      
      if (enabledCount > 0) {
        spinner.succeed(`Successfully enabled ${enabledCount} APIs`);
      } else {
        spinner.warn('No APIs were enabled successfully');
      }
      
      if (failedCount > 0) {
        console.log(chalk.yellow(`\n⚠️  ${failedCount} APIs failed to enable. This may affect some functionality.`));
      }
      
      // Cache the API status to avoid re-checking soon
      await this.cacheApiStatus(projectId, enabledApiNames.concat(apisToEnable));
      
    } catch (error) {
      spinner.fail('Failed to check API status');
      console.log(chalk.red(`\n❌ Error checking APIs: ${error.message}`));
      console.log(chalk.yellow('💡 You may need to enable APIs manually in GCP Console\n'));
      throw error;
    }
  }

  async cacheApiStatus(projectId, enabledApis) {
    try {
      const cacheData = {
        projectId,
        enabledApis,
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };
      
      const cacheDir = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.rig-cli');
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      const cacheFile = path.join(cacheDir, 'api-cache.json');
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
      
    } catch (error) {
      // Cache failure is not critical, just log it
      this.logger.warn(`Failed to cache API status: ${error.message}`);
    }
  }

  async getCachedApiStatus(projectId) {
    try {
      const cacheFile = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.rig-cli', 'api-cache.json');
      
      if (!fs.existsSync(cacheFile)) {
        return null;
      }
      
      const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      
      // Check if cache is for the same project and not expired
      if (cacheData.projectId === projectId && Date.now() < cacheData.expiresAt) {
        return cacheData.enabledApis;
      }
      
      // Cache is stale, remove it
      fs.unlinkSync(cacheFile);
      return null;
      
    } catch (error) {
      // Cache read failure is not critical
      return null;
    }
  }

  async disableAPIs(projectId, apisToDisable, skipConfirmation = false) {
    if (!apisToDisable || apisToDisable.length === 0) {
      console.log(chalk.yellow('⚠️  No APIs specified to disable.\n'));
      return;
    }

    console.log(chalk.red('\n🚫 Disabling GCP APIs...\n'));

    // Get list of currently enabled APIs first
    const spinner = ora('Checking current API status...').start();
    
    try {
      const { stdout } = await execAsync(`gcloud services list --enabled --project=${projectId} --format=json`);
      const enabledServices = JSON.parse(stdout);
      const enabledApiNames = enabledServices.map(service => service.config.name);
      
      spinner.text = 'Validating APIs to disable...';
      
      // Filter to only APIs that are actually enabled
      const validApisToDisable = apisToDisable.filter(api => {
        const isEnabled = enabledApiNames.includes(api);
        if (!isEnabled) {
          console.log(chalk.yellow(`  ⚠️  ${api} is already disabled`));
        }
        return isEnabled;
      });

      if (validApisToDisable.length === 0) {
        spinner.succeed('No APIs need to be disabled');
        console.log(chalk.green('✅ All specified APIs are already disabled\n'));
        return;
      }

      spinner.stop();

      // Check for essential APIs and warn user
      const essentialApis = this.getEssentialApis();
      const essentialApisToDisable = validApisToDisable.filter(api => essentialApis.includes(api));
      
      if (essentialApisToDisable.length > 0 && !skipConfirmation) {
        console.log(chalk.red('⚠️  WARNING: You are about to disable essential APIs:'));
        essentialApisToDisable.forEach(api => {
          console.log(chalk.red(`  • ${api} - ${this.getApiDescription(api)}`));
        });
        console.log(chalk.yellow('\nDisabling these APIs may break Rig CLI functionality!\n'));
      }

      // Show what will be disabled
      console.log(chalk.white(`APIs to be disabled (${validApisToDisable.length}):\n`));
      validApisToDisable.forEach(api => {
        const isEssential = essentialApis.includes(api);
        const warning = isEssential ? chalk.red(' [ESSENTIAL - May break CLI]') : '';
        console.log(`  🚫 ${api}${warning}`);
        console.log(`     ${chalk.gray(this.getApiDescription(api))}`);
      });
      console.log();

      // Confirmation prompt (unless skipped)
      if (!skipConfirmation) {
        const { confirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: 'Are you sure you want to disable these APIs?',
            default: false
          }
        ]);

        if (!confirmed) {
          console.log(chalk.yellow('❌ API disabling cancelled by user\n'));
          return;
        }
      }

      // Disable APIs one by one
      const disableSpinner = ora('Disabling APIs...').start();
      let disabledCount = 0;
      let failedCount = 0;
      
      for (const api of validApisToDisable) {
        try {
          disableSpinner.text = `Disabling ${api}...`;
          await execAsync(`gcloud services disable ${api} --project=${projectId}`);
          console.log(chalk.red(`  🚫 ${api} disabled`));
          disabledCount++;
        } catch (error) {
          console.log(chalk.red(`  ❌ Failed to disable ${api}: ${error.message}`));
          this.logger.warn(`Failed to disable ${api}: ${error.message}`);
          failedCount++;
        }
      }

      if (disabledCount > 0) {
        disableSpinner.succeed(`Successfully disabled ${disabledCount} APIs`);
        console.log(chalk.green(`\n✅ ${disabledCount} APIs disabled successfully`));
      } else {
        disableSpinner.warn('No APIs were disabled successfully');
      }

      if (failedCount > 0) {
        console.log(chalk.yellow(`\n⚠️  ${failedCount} APIs failed to disable`));
      }

      // Clear API cache since status changed
      await this.clearApiCache();

      // Final warning if essential APIs were disabled
      if (essentialApisToDisable.length > 0) {
        console.log(chalk.red('\n⚠️  IMPORTANT: Essential APIs have been disabled.'));
        console.log(chalk.yellow('You can re-enable them with: rig api --enable ' + essentialApisToDisable.join(',')));
        console.log();
      }

    } catch (error) {
      spinner.fail('Failed to disable APIs');
      console.log(chalk.red(`\n❌ Error disabling APIs: ${error.message}`));
      throw error;
    }
  }

  async disableAllNonEssentialAPIs(projectId, skipConfirmation = false) {
    console.log(chalk.red('\n🚫 Disabling All Non-Essential APIs...\n'));

    const spinner = ora('Fetching enabled APIs...').start();

    try {
      const { stdout } = await execAsync(`gcloud services list --enabled --project=${projectId} --format=json`);
      const enabledServices = JSON.parse(stdout);
      const enabledApiNames = enabledServices.map(service => service.config.name);
      
      spinner.text = 'Identifying non-essential APIs...';
      
      const essentialApis = this.getEssentialApis();
      const nonEssentialApis = enabledApiNames.filter(api => !essentialApis.includes(api));
      
      spinner.stop();

      if (nonEssentialApis.length === 0) {
        console.log(chalk.green('✅ No non-essential APIs found to disable\n'));
        return;
      }

      console.log(chalk.white(`Found ${nonEssentialApis.length} non-essential APIs to disable:\n`));
      
      // Group APIs by category for better display
      const categorizedApis = this.categorizeApis(nonEssentialApis);
      
      for (const [category, apis] of Object.entries(categorizedApis)) {
        if (apis.length > 0) {
          console.log(chalk.cyan(category));
          apis.forEach(api => {
            console.log(`  🚫 ${api}`);
            console.log(`     ${chalk.gray(this.getApiDescription(api))}`);
          });
          console.log();
        }
      }

      // Confirmation
      if (!skipConfirmation) {
        console.log(chalk.yellow('⚠️  This will disable all non-essential APIs while keeping core functionality intact.'));
        console.log(chalk.white('Essential APIs that will remain enabled:'));
        essentialApis.forEach(api => {
          console.log(`  ✅ ${api}`);
        });
        console.log();

        const { confirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed', 
            message: `Disable ${nonEssentialApis.length} non-essential APIs?`,
            default: false
          }
        ]);

        if (!confirmed) {
          console.log(chalk.yellow('❌ Bulk API disabling cancelled by user\n'));
          return;
        }
      }

      // Disable all non-essential APIs
      await this.disableAPIs(projectId, nonEssentialApis, true);

    } catch (error) {
      spinner.fail('Failed to fetch API list');
      console.log(chalk.red(`\n❌ Error: ${error.message}`));
      throw error;
    }
  }

  getEssentialApis() {
    return [
      'compute.googleapis.com',
      'storage-api.googleapis.com',
      'cloudresourcemanager.googleapis.com',
      'logging.googleapis.com',
      'monitoring.googleapis.com',
      'servicemanagement.googleapis.com',
      'serviceusage.googleapis.com',
      'iam.googleapis.com'
    ];
  }

  getApiDescription(apiName) {
    const descriptions = {
      'compute.googleapis.com': 'Compute Engine API - Virtual machines and infrastructure',
      'storage-api.googleapis.com': 'Cloud Storage API - Object storage and file management',
      'cloudresourcemanager.googleapis.com': 'Resource Manager API - Project and resource management',
      'logging.googleapis.com': 'Cloud Logging API - Log collection and analysis',
      'monitoring.googleapis.com': 'Cloud Monitoring API - Metrics and alerting',
      'container.googleapis.com': 'Kubernetes Engine API - Container orchestration',
      'cloudsql.googleapis.com': 'Cloud SQL API - Managed relational databases',
      'bigquery.googleapis.com': 'BigQuery API - Data warehouse and analytics',
      'pubsub.googleapis.com': 'Pub/Sub API - Messaging and event streaming',
      'cloudkms.googleapis.com': 'Cloud KMS API - Key management and encryption',
      'servicemanagement.googleapis.com': 'Service Management API - API lifecycle management',
      'serviceusage.googleapis.com': 'Service Usage API - API consumption tracking',
      'iam.googleapis.com': 'Identity and Access Management API - User and permission management',
      'dns.googleapis.com': 'Cloud DNS API - Domain name resolution',
      'file.googleapis.com': 'Cloud Filestore API - Network attached storage',
      'run.googleapis.com': 'Cloud Run API - Serverless container platform',
      'functions.googleapis.com': 'Cloud Functions API - Serverless compute platform',
      'appengine.googleapis.com': 'App Engine API - Platform as a Service',
      'dataflow.googleapis.com': 'Cloud Dataflow API - Stream and batch processing',
      'aiplatform.googleapis.com': 'AI Platform API - Machine learning services'
    };
    
    return descriptions[apiName] || 'GCP service API';
  }

  categorizeApis(apis) {
    const categories = {
      '🖥️ Compute & Containers': [],
      '💾 Storage & Databases': [],
      '🌐 Networking': [],
      '📊 Data & Analytics': [],
      '🤖 AI & Machine Learning': [],
      '📦 Other Services': []
    };

    apis.forEach(api => {
      if (api.includes('compute') || api.includes('container') || api.includes('run') || api.includes('functions') || api.includes('appengine')) {
        categories['🖥️ Compute & Containers'].push(api);
      } else if (api.includes('storage') || api.includes('sql') || api.includes('file')) {
        categories['💾 Storage & Databases'].push(api);
      } else if (api.includes('network') || api.includes('dns')) {
        categories['🌐 Networking'].push(api);
      } else if (api.includes('bigquery') || api.includes('dataflow') || api.includes('pubsub')) {
        categories['📊 Data & Analytics'].push(api);
      } else if (api.includes('ai') || api.includes('ml') || api.includes('translate') || api.includes('aiplatform')) {
        categories['🤖 AI & Machine Learning'].push(api);
      } else {
        categories['📦 Other Services'].push(api);
      }
    });

    return categories;
  }

  async clearApiCache() {
    try {
      const cacheFile = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.rig-cli', 'api-cache.json');
      
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
        this.logger.info('API cache cleared');
      }
    } catch (error) {
      this.logger.warn(`Failed to clear API cache: ${error.message}`);
    }
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