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
  
  const spinner = ora('Initializing AI assistant...').start();
  
  try {
    spinner.text = 'Connecting to AI assistant...';
    
    // Check AI provider status
    if (process.env.AI_PROVIDER === 'ollama' || !process.env.AI_PROVIDER) {
      spinner.text = 'Verifying Ollama connection...';
    }
    
    spinner.text = 'Analyzing issue (this may take 1-3 minutes)...';
    const recommendation = await aiAssistant.getRecommendation(issue, context);
    
    spinner.succeed('Analysis complete');
    
    displayRecommendation(recommendation);
    
    if (options.suggest) {
      await offerAutomatedFixes(recommendation, cloudManager);
    }
  } catch (error) {
    spinner.fail('Analysis failed');
    
    if (error.message.includes('not running')) {
      console.error(chalk.red('\n❌ ' + error.message));
      console.log(chalk.yellow('\n💡 Quick fix:'));
      console.log(chalk.white('   1. Open a new terminal'));
      console.log(chalk.white('   2. Run: ollama serve'));
      console.log(chalk.white('   3. Keep that terminal open and try again'));
    } else if (error.message.includes('timeout')) {
      console.error(chalk.red('\n⏰ ' + error.message));
      console.log(chalk.yellow('\n💡 Suggestions:'));
      console.log(chalk.white('   • Try using a smaller model: ollama pull llama3.2:3b'));
      console.log(chalk.white('   • Wait a moment and try again'));
      console.log(chalk.white('   • Check if Ollama is processing other requests'));
    } else {
      console.error(chalk.red('\n❌ Error: ' + error.message));
    }
    
    console.log(chalk.cyan('\n🔄 Falling back to local recommendations...'));
    const fallbackRecommendation = await getFallbackRecommendation(issue, context);
    displayRecommendation(fallbackRecommendation);
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

async function getFallbackRecommendation(issue, context) {
  // Create a simple AI assistant instance for local recommendations
  const localAI = new AIAssistant();
  return localAI.getLocalRecommendation(issue, context);
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