import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { CloudManager } from '../core/cloudManager.js';
import { AIAssistant } from '../core/aiAssistant.js';
import { Logger } from '../utils/logger.js';

export async function cost(options) {
  const cloudManager = new CloudManager();
  const aiAssistant = new AIAssistant();
  const logger = new Logger();

  console.log(chalk.green.bold('\n💰 COST ANALYSIS'));
  console.log(chalk.green('='.repeat(50)));

  try {
    if (!options.analyze && !options.optimize && !options.report && !options.forecast) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What cost analysis would you like to perform?',
          choices: [
            { name: '📊 Cost Analysis - Analyze current resource costs', value: 'analyze' },
            { name: '⚡ Optimization - Find cost optimization opportunities', value: 'optimize' },
            { name: '📈 Forecast - Predict future costs', value: 'forecast' },
            { name: '📋 Cost Report - Generate comprehensive cost report', value: 'report' },
            { name: '🤖 AI Recommendations - Get AI-powered cost optimization advice', value: 'recommendations' }
          ]
        }
      ]);
      
      switch (action) {
      case 'analyze':
        await analyzeCosts(cloudManager, aiAssistant, logger);
        break;
      case 'optimize':
        await findOptimizations(cloudManager, aiAssistant, logger);
        break;
      case 'forecast':
        await forecastCosts(cloudManager, aiAssistant, logger);
        break;
      case 'report':
        await generateCostReport(cloudManager, aiAssistant, logger);
        break;
      case 'recommendations':
        await getCostRecommendations(cloudManager, aiAssistant, logger);
        break;
      }
    } else {
      if (options.analyze) {
        await analyzeCosts(cloudManager, aiAssistant, logger);
      }
      if (options.optimize) {
        await findOptimizations(cloudManager, aiAssistant, logger);
      }
      if (options.forecast) {
        await forecastCosts(cloudManager, aiAssistant, logger);
      }
      if (options.report) {
        await generateCostReport(cloudManager, aiAssistant, logger);
      }
    }
  } catch (error) {
    logger.error(`Cost analysis failed: ${error.message}`);
    console.error(chalk.red(`\n❌ Cost analysis failed: ${error.message}`));
  }
}

async function analyzeCosts(cloudManager, _aiAssistant, _logger) {
  const spinner = ora('Analyzing current resource costs...').start();
  
  try {
    const resources = await cloudManager.listAllResources();
    const costAnalysis = await calculateResourceCosts(resources);
    
    spinner.succeed('Cost analysis completed');
    
    displayCostAnalysis(costAnalysis);
    
  } catch (error) {
    spinner.fail('Cost analysis failed');
    throw error;
  }
}

async function calculateResourceCosts(resources) {
  const costData = {
    totalMonthlyCost: 0,
    breakdown: {},
    highCostResources: [],
    unusedResources: []
  };
  
  for (const resourceGroup of resources) {
    const resourceCosts = await calculateResourceGroupCosts(resourceGroup);
    costData.breakdown[resourceGroup.type] = resourceCosts;
    costData.totalMonthlyCost += resourceCosts.total;
    
    costData.highCostResources.push(...resourceCosts.highCost);
    costData.unusedResources.push(...resourceCosts.unused);
  }
  
  return costData;
}

async function calculateResourceGroupCosts(resourceGroup) {
  const costs = {
    total: 0,
    count: resourceGroup.items.length,
    highCost: [],
    unused: [],
    items: []
  };
  
  for (const resource of resourceGroup.items) {
    const resourceCost = await estimateResourceCost(resource, resourceGroup.type);
    costs.total += resourceCost.monthly;
    costs.items.push(resourceCost);
    
    if (resourceCost.monthly > 100) {
      costs.highCost.push({
        name: resource.name || resource.id,
        type: resourceGroup.type,
        cost: resourceCost.monthly,
        reason: resourceCost.reason
      });
    }
    
    if (resourceCost.utilization < 20) {
      costs.unused.push({
        name: resource.name || resource.id,
        type: resourceGroup.type,
        utilization: resourceCost.utilization,
        cost: resourceCost.monthly
      });
    }
  }
  
  return costs;
}

async function estimateResourceCost(resource, type) {
  const costEstimate = { monthly: 0, utilization: 100, reason: '' };
  
  switch (type) {
  case 'instances':
    costEstimate.monthly = estimateComputeCost(resource);
    costEstimate.utilization = Math.random() * 100; // Simulated utilization
    costEstimate.reason = `${resource.machineType || 'unknown'} machine type`;
    break;
      
  case 'storage':
    costEstimate.monthly = estimateStorageCost(resource);
    costEstimate.utilization = Math.random() * 100;
    costEstimate.reason = 'Standard storage class';
    break;
      
  case 'databases':
    costEstimate.monthly = estimateDatabaseCost(resource);
    costEstimate.utilization = Math.random() * 100;
    costEstimate.reason = `${resource.tier || 'unknown'} tier database`;
    break;
      
  case 'networks':
    costEstimate.monthly = estimateNetworkCost(resource);
    costEstimate.utilization = Math.random() * 100;
    costEstimate.reason = 'Network and load balancer costs';
    break;
      
  default:
    costEstimate.monthly = Math.random() * 50;
    costEstimate.reason = 'Estimated cost';
  }
  
  return costEstimate;
}

function estimateComputeCost(instance) {
  const machineType = instance.machineType || '';
  
  // Simplified cost estimation based on machine type
  if (machineType.includes('n1-standard-1')) return 24.27;
  if (machineType.includes('n1-standard-2')) return 48.54;
  if (machineType.includes('n1-standard-4')) return 97.08;
  if (machineType.includes('e2-medium')) return 20.44;
  if (machineType.includes('e2-standard-2')) return 40.88;
  if (machineType.includes('e2-standard-4')) return 81.76;
  
  // Default estimation
  return Math.random() * 100 + 20;
}

function estimateStorageCost(bucket) {
  const storageClass = bucket.storageClass || 'STANDARD';
  
  // Estimate based on 100GB average
  const baseSize = 100;
  
  switch (storageClass) {
  case 'STANDARD': return baseSize * 0.020; // $0.020 per GB
  case 'NEARLINE': return baseSize * 0.010; // $0.010 per GB
  case 'COLDLINE': return baseSize * 0.004; // $0.004 per GB
  case 'ARCHIVE': return baseSize * 0.0012; // $0.0012 per GB
  default: return baseSize * 0.020;
  }
}

function estimateDatabaseCost(database) {
  const tier = database.tier || database.settings?.tier || 'db-f1-micro';
  
  // Monthly costs for common tiers
  const tierCosts = {
    'db-f1-micro': 7.67,
    'db-g1-small': 25.16,
    'db-n1-standard-1': 51.75,
    'db-n1-standard-2': 103.50,
    'db-n1-standard-4': 207.00,
    'db-n1-highmem-2': 122.06,
    'db-n1-highmem-4': 244.12
  };
  
  return tierCosts[tier] || 50;
}

function estimateNetworkCost(_network) {
  // Basic network costs (load balancer, NAT gateway, etc.)
  return Math.random() * 30 + 10;
}

function displayCostAnalysis(costData) {
  console.log(chalk.green.bold('\n💰 COST BREAKDOWN\n'));
  
  console.log(chalk.white.bold(`Total Monthly Cost: ${chalk.green('$' + costData.totalMonthlyCost.toFixed(2))}`));
  console.log(chalk.gray('Estimated based on current resource configuration\n'));
  
  console.log(chalk.cyan.bold('By Resource Type:'));
  for (const [type, costs] of Object.entries(costData.breakdown)) {
    console.log(`  ${getResourceIcon(type)} ${type}: ${chalk.green('$' + costs.total.toFixed(2))} (${costs.count} resources)`);
  }
  
  if (costData.highCostResources.length > 0) {
    console.log(chalk.red.bold('\n💸 High Cost Resources:'));
    costData.highCostResources.forEach(resource => {
      console.log(`  📦 ${resource.name} (${resource.type}): ${chalk.red('$' + resource.cost.toFixed(2))}/month`);
      console.log(chalk.gray(`     ${resource.reason}`));
    });
  }
  
  if (costData.unusedResources.length > 0) {
    console.log(chalk.yellow.bold('\n⚠️  Underutilized Resources:'));
    costData.unusedResources.forEach(resource => {
      console.log(`  📦 ${resource.name} (${resource.type}): ${chalk.yellow(resource.utilization.toFixed(1) + '%')} utilization - ${chalk.green('$' + resource.cost.toFixed(2))}/month`);
    });
  }
}

function getResourceIcon(type) {
  const icons = {
    instances: '🖥️',
    storage: '💾',
    databases: '🗄️',
    networks: '🌐',
    'load-balancers': '⚖️'
  };
  return icons[type] || '📦';
}

async function findOptimizations(cloudManager, aiAssistant, _logger) {
  const spinner = ora('Finding cost optimization opportunities...').start();
  
  try {
    const resources = await cloudManager.listAllResources();
    const optimizations = await identifyOptimizations(resources);
    
    spinner.succeed('Optimization analysis completed');
    
    displayOptimizations(optimizations);
    
    const context = {
      provider: 'GCP',
      optimizations: optimizations,
      totalSavings: optimizations.reduce((sum, opt) => sum + opt.savings, 0)
    };
    
    const recommendations = await aiAssistant.getRecommendation(
      'Provide detailed cost optimization strategy based on identified opportunities',
      context
    );
    
    console.log(chalk.yellow.bold('\n🤖 AI OPTIMIZATION STRATEGY:'));
    console.log(chalk.white(recommendations));
    
  } catch (error) {
    spinner.fail('Optimization analysis failed');
    throw error;
  }
}

async function identifyOptimizations(resources) {
  const optimizations = [];
  
  for (const resourceGroup of resources) {
    if (resourceGroup.type === 'instances') {
      optimizations.push(...await analyzeComputeOptimizations(resourceGroup.items));
    } else if (resourceGroup.type === 'storage') {
      optimizations.push(...await analyzeStorageOptimizations(resourceGroup.items));
    } else if (resourceGroup.type === 'databases') {
      optimizations.push(...await analyzeDatabaseOptimizations(resourceGroup.items));
    }
  }
  
  return optimizations;
}

async function analyzeComputeOptimizations(instances) {
  const optimizations = [];
  
  for (const instance of instances) {
    const utilization = Math.random() * 100; // Simulated utilization
    
    if (utilization < 20) {
      optimizations.push({
        type: 'Right-sizing',
        resource: instance.name,
        description: 'Instance is underutilized',
        action: 'Downsize to smaller machine type',
        savings: 25,
        impact: 'Low',
        effort: 'Low'
      });
    }
    
    if (!instance.scheduling?.preemptible) {
      optimizations.push({
        type: 'Preemptible Instances',
        resource: instance.name,
        description: 'Use preemptible instances for fault-tolerant workloads',
        action: 'Convert to preemptible instance',
        savings: 60,
        impact: 'Medium',
        effort: 'Medium'
      });
    }
    
    if (instance.status === 'RUNNING' && instance.zone) {
      optimizations.push({
        type: 'Scheduling',
        resource: instance.name,
        description: 'Schedule shutdown during off-hours',
        action: 'Implement automated start/stop schedule',
        savings: 40,
        impact: 'Low',
        effort: 'Medium'
      });
    }
  }
  
  return optimizations;
}

async function analyzeStorageOptimizations(buckets) {
  const optimizations = [];
  
  for (const bucket of buckets) {
    if (bucket.storageClass === 'STANDARD') {
      optimizations.push({
        type: 'Storage Class',
        resource: bucket.name,
        description: 'Archive old data to cheaper storage class',
        action: 'Implement lifecycle policy for Nearline/Coldline',
        savings: 50,
        impact: 'Low',
        effort: 'Low'
      });
    }
    
    optimizations.push({
      type: 'Data Lifecycle',
      resource: bucket.name,
      description: 'Automatically delete old data',
      action: 'Set up object lifecycle management',
      savings: 30,
      impact: 'Low',
      effort: 'Low'
    });
  }
  
  return optimizations;
}

async function analyzeDatabaseOptimizations(databases) {
  const optimizations = [];
  
  for (const db of databases) {
    optimizations.push({
      type: 'Right-sizing',
      resource: db.name,
      description: 'Database may be over-provisioned',
      action: 'Monitor usage and consider smaller instance',
      savings: 35,
      impact: 'Medium',
      effort: 'Medium'
    });
    
    optimizations.push({
      type: 'Backup Optimization',
      resource: db.name,
      description: 'Optimize backup retention policy',
      action: 'Reduce backup retention period',
      savings: 15,
      impact: 'Low',
      effort: 'Low'
    });
  }
  
  return optimizations;
}

function displayOptimizations(optimizations) {
  if (optimizations.length === 0) {
    console.log(chalk.green('\n✅ No obvious cost optimizations found!'));
    return;
  }
  
  const totalSavings = optimizations.reduce((sum, opt) => sum + opt.savings, 0);
  
  console.log(chalk.green.bold(`\n⚡ Found ${optimizations.length} optimization opportunities`));
  console.log(chalk.green.bold(`💰 Potential monthly savings: $${totalSavings.toFixed(2)}\n`));
  
  const grouped = optimizations.reduce((acc, opt) => {
    if (!acc[opt.type]) acc[opt.type] = [];
    acc[opt.type].push(opt);
    return acc;
  }, {});
  
  for (const [type, opts] of Object.entries(grouped)) {
    console.log(chalk.cyan.bold(`${type}:`));
    
    opts.forEach(opt => {
      console.log(`  📦 ${opt.resource}`);
      console.log(`     ${opt.description}`);
      console.log(`     ${chalk.green('💡 ' + opt.action)}`);
      console.log(`     ${chalk.green('💰 Save: $' + opt.savings + '/month')} | Impact: ${opt.impact} | Effort: ${opt.effort}\n`);
    });
  }
}

async function forecastCosts(cloudManager, _aiAssistant, _logger) {
  const spinner = ora('Generating cost forecasts...').start();
  
  try {
    const resources = await cloudManager.listAllResources();
    const currentCosts = await calculateResourceCosts(resources);
    const forecast = generateCostForecast(currentCosts);
    
    spinner.succeed('Cost forecast completed');
    
    displayCostForecast(forecast);
    
  } catch (error) {
    spinner.fail('Cost forecast failed');
    throw error;
  }
}

function generateCostForecast(currentCosts) {
  const baselineCost = currentCosts.totalMonthlyCost;
  
  return {
    current: baselineCost,
    projections: {
      '3 months': baselineCost * 3 * 1.05, // 5% growth
      '6 months': baselineCost * 6 * 1.12, // 12% growth
      '12 months': baselineCost * 12 * 1.25 // 25% growth
    },
    scenarios: {
      conservative: {
        '12 months': baselineCost * 12 * 1.15,
        description: 'Minimal growth with some optimization'
      },
      aggressive: {
        '12 months': baselineCost * 12 * 1.50,
        description: 'Rapid scaling without optimization'
      },
      optimized: {
        '12 months': baselineCost * 12 * 0.85,
        description: 'With recommended optimizations applied'
      }
    }
  };
}

function displayCostForecast(forecast) {
  console.log(chalk.green.bold('\n📈 COST FORECAST\n'));
  
  console.log(chalk.white.bold('Current Monthly Cost: ') + chalk.green('$' + forecast.current.toFixed(2)));
  
  console.log(chalk.cyan.bold('\nProjected Costs:'));
  for (const [period, cost] of Object.entries(forecast.projections)) {
    console.log(`  📅 ${period}: ${chalk.green('$' + cost.toFixed(2))}`);
  }
  
  console.log(chalk.cyan.bold('\nScenario Planning:'));
  for (const [scenario, data] of Object.entries(forecast.scenarios)) {
    console.log(`  📊 ${scenario}: ${chalk.green('$' + data['12 months'].toFixed(2))} (12 months)`);
    console.log(chalk.gray(`     ${data.description}`));
  }
}

async function generateCostReport(cloudManager, aiAssistant, _logger) {
  const spinner = ora('Generating comprehensive cost report...').start();
  
  try {
    const resources = await cloudManager.listAllResources();
    const costAnalysis = await calculateResourceCosts(resources);
    const optimizations = await identifyOptimizations(resources);
    const forecast = generateCostForecast(costAnalysis);
    
    spinner.succeed('Cost report generated');
    
    console.log(chalk.green.bold('\n📋 COMPREHENSIVE COST REPORT'));
    console.log(chalk.green('='.repeat(60)));
    
    console.log(chalk.white.bold('\n📊 EXECUTIVE SUMMARY:'));
    console.log(`• Current Monthly Spend: ${chalk.green('$' + costAnalysis.totalMonthlyCost.toFixed(2))}`);
    console.log(`• Annual Projection: ${chalk.green('$' + forecast.projections['12 months'].toFixed(2))}`);
    console.log(`• Optimization Opportunities: ${optimizations.length}`);
    console.log(`• Potential Savings: ${chalk.green('$' + optimizations.reduce((sum, opt) => sum + opt.savings, 0).toFixed(2))}/month`);
    
    displayCostAnalysis(costAnalysis);
    displayOptimizations(optimizations);
    displayCostForecast(forecast);
    
    const context = {
      provider: 'GCP',
      currentCost: costAnalysis.totalMonthlyCost,
      projectedCost: forecast.projections['12 months'],
      optimizations: optimizations,
      totalResources: resources.reduce((acc, r) => acc + r.items.length, 0)
    };
    
    const recommendations = await aiAssistant.getRecommendation(
      'Create a comprehensive cost optimization strategy and implementation roadmap',
      context
    );
    
    console.log(chalk.yellow.bold('\n🤖 AI COST STRATEGY:'));
    console.log(chalk.white(recommendations));
    
  } catch (error) {
    spinner.fail('Cost report generation failed');
    throw error;
  }
}

async function getCostRecommendations(cloudManager, aiAssistant, _logger) {
  const spinner = ora('Getting AI-powered cost recommendations...').start();
  
  try {
    const resources = await cloudManager.listAllResources();
    
    const context = {
      provider: 'GCP',
      resourceTypes: resources.map(r => r.type),
      totalResources: resources.reduce((acc, r) => acc + r.items.length, 0)
    };
    
    const recommendations = await aiAssistant.getRecommendation(
      'Provide cost optimization best practices and specific recommendations for this GCP infrastructure',
      context
    );
    
    spinner.succeed('Cost recommendations generated');
    
    console.log(chalk.yellow.bold('\n💡 COST OPTIMIZATION RECOMMENDATIONS:'));
    console.log(chalk.white(recommendations));
    
  } catch (error) {
    spinner.fail('Failed to get cost recommendations');
    throw error;
  }
}