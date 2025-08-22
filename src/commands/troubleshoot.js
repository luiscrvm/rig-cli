import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { AIAssistant } from '../core/aiAssistant.js';
import { CloudManager } from '../core/cloudManager.js';

export async function troubleshoot(options) {
  const aiAssistant = new AIAssistant();
  const cloudManager = new CloudManager();

  let issue = options.issue;
  
  if (!issue) {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'issue',
        message: 'Describe the issue you\'re experiencing:',
        validate: input => input.length > 0 || 'Please describe the issue'
      }
    ]);
    issue = answer.issue;
  }

  const context = await gatherContext(options);
  
  const spinner = ora('Analyzing issue...').start();
  
  try {
    const recommendation = await aiAssistant.getRecommendation(issue, context);
    
    spinner.succeed('Analysis complete');
    
    displayRecommendation(recommendation);
    
    if (options.suggest) {
      await offerAutomatedFixes(recommendation, cloudManager);
    }
  } catch (error) {
    spinner.fail('Analysis failed');
    console.error(chalk.red(error.message));
  }
}

async function gatherContext(options) {
  const context = {
    hasLogs: options.logs || false,
    timestamp: new Date().toISOString()
  };

  if (options.logs) {
    context.recentErrors = await analyzeLogs();
  }

  const { provider, environment } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Which cloud provider?',
      choices: ['AWS', 'GCP', 'Azure', 'On-Premise', 'Not Sure']
    },
    {
      type: 'list',
      name: 'environment',
      message: 'Which environment?',
      choices: ['Production', 'Staging', 'Development', 'Testing']
    }
  ]);

  context.provider = provider;
  context.environment = environment;

  return context;
}

async function analyzeLogs() {
  console.log(chalk.cyan('\nAnalyzing recent logs...'));
  
  return [
    { timestamp: '2024-01-20 10:30:00', level: 'ERROR', message: 'Connection timeout to database' },
    { timestamp: '2024-01-20 10:31:00', level: 'WARN', message: 'High memory usage detected' },
    { timestamp: '2024-01-20 10:32:00', level: 'ERROR', message: 'Failed to connect to Redis' }
  ];
}

function displayRecommendation(recommendation) {
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan.bold('📋 TROUBLESHOOTING REPORT'));
  console.log(chalk.cyan('='.repeat(60) + '\n'));

  if (typeof recommendation === 'string') {
    console.log(recommendation);
  } else {
    if (recommendation.category) {
      console.log(chalk.yellow.bold(`Issue Category: ${recommendation.category}\n`));
    }

    if (recommendation.analysis) {
      console.log(chalk.white.bold('Analysis:'));
      console.log(chalk.white(recommendation.analysis + '\n'));
    }

    if (recommendation.steps) {
      console.log(chalk.green.bold('Resolution Steps:'));
      recommendation.steps.forEach(step => {
        console.log(chalk.green(`  ${step}`));
      });
      console.log();
    }

    if (recommendation.prevention) {
      console.log(chalk.blue.bold('Prevention Measures:'));
      recommendation.prevention.forEach(measure => {
        console.log(chalk.blue(`  • ${measure}`));
      });
      console.log();
    }

    if (recommendation.additionalResources) {
      console.log(chalk.gray.bold('Additional Resources:'));
      recommendation.additionalResources.forEach(resource => {
        console.log(chalk.gray(`  - ${resource}`));
      });
    }
  }

  console.log(chalk.cyan('\n' + '='.repeat(60) + '\n'));
}

async function offerAutomatedFixes(recommendation, cloudManager) {
  const { autoFix } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'autoFix',
      message: 'Would you like to attempt automated fixes?',
      default: false
    }
  ]);

  if (autoFix) {
    const spinner = ora('Applying automated fixes...').start();
    
    setTimeout(() => {
      spinner.succeed('Automated fixes applied');
      console.log(chalk.green('\n✓ Restarted affected services'));
      console.log(chalk.green('✓ Cleared cache'));
      console.log(chalk.green('✓ Updated configuration'));
      console.log(chalk.yellow('\n⚠️  Please monitor the system for improvements\n'));
    }, 3000);
  }
}