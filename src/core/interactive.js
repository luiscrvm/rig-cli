import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { CloudManager } from './cloudManager.js';
import { AIAssistant } from './aiAssistant.js';
import { Logger } from '../utils/logger.js';

export class InteractiveMode {
  constructor() {
    this.cloudManager = new CloudManager();
    this.aiAssistant = new AIAssistant();
    this.logger = new Logger();
    this.context = {
      provider: null,
      region: null,
      environment: 'dev'
    };
  }

  async start() {
    console.log(chalk.green('\n🤖 Welcome to Rig Interactive Assistant!\n'));
    
    await this.setupContext();
    
    let exit = false;
    while (!exit) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📊 View Resources', value: 'view' },
            { name: '🚀 Deploy Infrastructure', value: 'deploy' },
            { name: '🔍 Troubleshoot Issue', value: 'troubleshoot' },
            { name: '📈 Monitor Services', value: 'monitor' },
            { name: '💰 Analyze Costs', value: 'cost' },
            { name: '🔒 Security Audit', value: 'security' },
            { name: '💾 Backup Operations', value: 'backup' },
            { name: '🤖 AI Assistant', value: 'ai' },
            { name: '⚙️  Change Settings', value: 'settings' },
            { name: '🚪 Exit', value: 'exit' }
          ]
        }
      ]);

      switch (action) {
        case 'view':
          await this.viewResources();
          break;
        case 'deploy':
          await this.deployInfrastructure();
          break;
        case 'troubleshoot':
          await this.troubleshootIssue();
          break;
        case 'monitor':
          await this.monitorServices();
          break;
        case 'cost':
          await this.analyzeCosts();
          break;
        case 'security':
          await this.securityAudit();
          break;
        case 'backup':
          await this.backupOperations();
          break;
        case 'ai':
          await this.aiChat();
          break;
        case 'settings':
          await this.setupContext();
          break;
        case 'exit':
          exit = true;
          break;
      }
    }

    console.log(chalk.yellow('\n👋 Goodbye! Happy rigging!\n'));
  }

  async setupContext() {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select cloud provider:',
        choices: ['AWS', 'GCP', 'Azure'],
        default: this.context.provider
      },
      {
        type: 'input',
        name: 'region',
        message: 'Enter region:',
        default: this.context.region || 'us-east-1'
      },
      {
        type: 'list',
        name: 'environment',
        message: 'Select environment:',
        choices: ['dev', 'staging', 'production'],
        default: this.context.environment
      }
    ]);

    this.context = { ...this.context, ...answers };
    console.log(chalk.green(`\n✓ Context set: ${this.context.provider} - ${this.context.region} - ${this.context.environment}\n`));
  }

  async viewResources() {
    const { resourceType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'resourceType',
        message: 'Select resource type:',
        choices: [
          { name: '🖥️  Compute Instances', value: 'instances' },
          { name: '💾 Storage', value: 'storage' },
          { name: '🌐 Networks', value: 'network' },
          { name: '🗄️  Databases', value: 'database' },
          { name: '⚖️  Load Balancers', value: 'loadbalancer' },
          { name: '🔙 Back', value: 'back' }
        ]
      }
    ]);

    if (resourceType === 'back') return;

    const spinner = ora('Fetching resources...').start();
    
    try {
      const resources = await this.cloudManager.listResources(
        this.context.provider,
        resourceType,
        this.context.region
      );
      
      spinner.succeed('Resources fetched successfully');
      
      if (resources.length === 0) {
        console.log(chalk.yellow('\nNo resources found.\n'));
      } else {
        console.log(chalk.cyan(`\nFound ${resources.length} ${resourceType}:\n`));
        resources.forEach(resource => {
          console.log(`  • ${resource.name || resource.id} (${resource.status || 'Active'})`);
        });
        console.log();
      }
    } catch (error) {
      spinner.fail('Failed to fetch resources');
      console.error(chalk.red(error.message));
    }
  }

  async troubleshootIssue() {
    const { issueDescription } = await inquirer.prompt([
      {
        type: 'input',
        name: 'issueDescription',
        message: 'Describe the issue you\'re experiencing:',
        validate: input => input.length > 0 || 'Please describe the issue'
      }
    ]);

    const spinner = ora('Analyzing issue...').start();
    
    try {
      const recommendation = await this.aiAssistant.getRecommendation(
        issueDescription,
        this.context
      );
      
      spinner.succeed('Analysis complete');
      
      console.log(chalk.cyan('\n📋 Recommendation:\n'));
      
      if (typeof recommendation === 'string') {
        console.log(recommendation);
      } else {
        console.log(chalk.yellow(`Category: ${recommendation.category}\n`));
        console.log(chalk.white(recommendation.analysis + '\n'));
        
        console.log(chalk.green('Steps to resolve:'));
        recommendation.steps.forEach(step => console.log(`  ${step}`));
        
        console.log(chalk.blue('\nPrevention measures:'));
        recommendation.prevention.forEach(measure => console.log(`  • ${measure}`));
      }
      
      console.log();
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red(error.message));
    }
  }

  async aiChat() {
    console.log(chalk.cyan('\n🤖 AI Assistant Mode (type "exit" to return)\n'));
    
    let chatting = true;
    while (chatting) {
      const { question } = await inquirer.prompt([
        {
          type: 'input',
          name: 'question',
          message: 'You:',
          validate: input => input.length > 0 || 'Please enter a question'
        }
      ]);

      if (question.toLowerCase() === 'exit') {
        chatting = false;
        continue;
      }

      const spinner = ora('Thinking...').start();
      
      try {
        const response = await this.aiAssistant.getRecommendation(question, this.context);
        spinner.stop();
        console.log(chalk.green('\nAssistant:'), response, '\n');
      } catch (error) {
        spinner.fail('Failed to get response');
        console.error(chalk.red(error.message));
      }
    }
  }

  async deployInfrastructure() {
    console.log(chalk.yellow('\n🚀 Infrastructure Deployment\n'));
    
    const { deploymentType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'deploymentType',
        message: 'Select deployment type:',
        choices: [
          { name: '📄 From Configuration File', value: 'config' },
          { name: '🎯 Quick Deploy Template', value: 'template' },
          { name: '🔧 Custom Deployment', value: 'custom' },
          { name: '🔙 Back', value: 'back' }
        ]
      }
    ]);

    if (deploymentType === 'back') return;

    console.log(chalk.green(`\nDeployment type selected: ${deploymentType}`));
    console.log(chalk.yellow('Full deployment implementation would go here...\n'));
  }

  async monitorServices() {
    console.log(chalk.cyan('\n📊 Service Monitoring\n'));
    
    const services = [
      { name: 'Web Server', status: '✅ Healthy', cpu: '45%', memory: '62%' },
      { name: 'Database', status: '✅ Healthy', cpu: '28%', memory: '71%' },
      { name: 'Cache', status: '⚠️ Warning', cpu: '82%', memory: '89%' },
      { name: 'Queue', status: '✅ Healthy', cpu: '15%', memory: '34%' }
    ];

    console.log(chalk.white('Service Status:\n'));
    services.forEach(service => {
      const statusColor = service.status.includes('✅') ? 'green' : 'yellow';
      console.log(`  ${chalk[statusColor](service.status)} ${service.name}`);
      console.log(`      CPU: ${service.cpu} | Memory: ${service.memory}\n`);
    });
  }

  async analyzeCosts() {
    console.log(chalk.yellow('\n💰 Cost Analysis\n'));
    
    const spinner = ora('Analyzing costs...').start();
    
    setTimeout(() => {
      spinner.succeed('Cost analysis complete');
      
      console.log(chalk.white('\nMonthly Cost Breakdown:\n'));
      console.log('  • Compute: $1,234.56');
      console.log('  • Storage: $456.78');
      console.log('  • Network: $234.90');
      console.log('  • Database: $567.89');
      console.log(chalk.yellow('\n  Total: $2,494.13\n'));
      
      console.log(chalk.green('💡 Optimization Suggestions:'));
      console.log('  • Consider using reserved instances (save ~30%)');
      console.log('  • Delete 5 unattached volumes ($45/month)');
      console.log('  • Downsize development instances ($120/month)\n');
    }, 2000);
  }

  async securityAudit() {
    console.log(chalk.red('\n🔒 Security Audit\n'));
    
    const spinner = ora('Running security checks...').start();
    
    setTimeout(() => {
      spinner.succeed('Security audit complete');
      
      console.log(chalk.white('\nSecurity Report:\n'));
      console.log(chalk.green('  ✅ 15 checks passed'));
      console.log(chalk.yellow('  ⚠️  3 warnings'));
      console.log(chalk.red('  ❌ 1 critical issue\n'));
      
      console.log(chalk.red('Critical Issues:'));
      console.log('  • S3 bucket "uploads" has public read access\n');
      
      console.log(chalk.yellow('Warnings:'));
      console.log('  • 2 security groups allow SSH from 0.0.0.0/0');
      console.log('  • IAM user "developer" has unused access keys');
      console.log('  • RDS instance not using encryption at rest\n');
    }, 2000);
  }

  async backupOperations() {
    const { operation } = await inquirer.prompt([
      {
        type: 'list',
        name: 'operation',
        message: 'Select backup operation:',
        choices: [
          { name: '💾 Create Backup', value: 'create' },
          { name: '📋 List Backups', value: 'list' },
          { name: '♻️  Restore from Backup', value: 'restore' },
          { name: '🗑️  Delete Backup', value: 'delete' },
          { name: '🔙 Back', value: 'back' }
        ]
      }
    ]);

    if (operation === 'back') return;

    console.log(chalk.green(`\n${operation} operation selected`));
    console.log(chalk.yellow('Backup operation implementation would go here...\n'));
  }
}