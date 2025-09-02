import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { CloudManager } from '../core/cloudManager.js';
import { AIAssistant } from '../core/aiAssistant.js';
import { Logger } from '../utils/logger.js';
import { ProjectAnalyzer } from '../core/projectAnalyzer.js';
import { TerraformGenerator } from '../generators/terraformGenerator.js';
import { KubernetesGenerator } from '../generators/kubernetesGenerator.js';
import { CICDGenerator } from '../generators/cicdGenerator.js';
import { MonitoringGenerator } from '../generators/monitoringGenerator.js';
import { SecurityConfigGenerator } from '../generators/securityConfigGenerator.js';
import { DockerGenerator } from '../generators/dockerGenerator.js';

export async function generate(type, options) {
  const logger = new Logger();
  const cloudManager = new CloudManager();
  const aiAssistant = new AIAssistant();
  const projectAnalyzer = new ProjectAnalyzer(cloudManager);

  console.log(chalk.green.bold('\n🏗️  INFRASTRUCTURE GENERATOR'));
  console.log(chalk.green('='.repeat(50)));

  try {
    if (!type) {
      const { selectedType } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedType',
          message: 'What would you like to generate?',
          choices: [
            { name: '🏗️  Terraform - Infrastructure as Code modules', value: 'terraform' },
            { name: '⚡ Kubernetes - Container orchestration manifests', value: 'kubernetes' },
            { name: '🐳 Docker - Containerization configurations', value: 'docker' },
            { name: '🔄 CI/CD - Continuous integration pipelines', value: 'cicd' },
            { name: '📊 Monitoring - Observability and alerting configs', value: 'monitoring' },
            { name: '🛡️  Security Configs - Policy as Code and security templates', value: 'security-configs' },
            { name: '🔍 Project Analysis - Analyze current project structure', value: 'analyze' },
            { name: '📦 Complete Stack - Generate full infrastructure stack', value: 'stack' }
          ]
        }
      ]);
      type = selectedType;
    }

    // Initialize cloud manager and check authentication (only if we have configuration)
    const hasCloudConfig = process.env.GCP_PROJECT_ID && process.env.GCP_PROJECT_ID !== 'your-gcp-project-id';
    
    if (hasCloudConfig) {
      const authSpinner = ora('Initializing cloud provider connection...').start();
      try {
        await cloudManager.initialize();
        authSpinner.succeed(`Cloud provider connection established (Project: ${process.env.GCP_PROJECT_ID})`);
      } catch (error) {
        authSpinner.fail('Failed to initialize cloud provider');
        logger.warn(`Cloud provider authentication failed: ${error.message}`);
        logger.info('Generated files will use configured project values but cloud resource import may not work.');
      }
    }

    // Analyze project first if needed
    let analysis = null;
    if (options.analyze !== false && type !== 'analyze') {
      const spinner = ora('Analyzing current project and infrastructure...').start();
      analysis = await projectAnalyzer.analyzeProject();
      spinner.succeed('Project analysis completed');
    }

    switch (type) {
    case 'terraform':
      await generateTerraform(options, analysis, cloudManager, aiAssistant, logger);
      break;
    case 'kubernetes':
    case 'k8s':
      await generateKubernetes(options, analysis, cloudManager, aiAssistant, logger);
      break;
    case 'docker':
      await generateDocker(options, analysis, aiAssistant, logger);
      break;
    case 'cicd':
      await generateCICD(options, analysis, aiAssistant, logger);
      break;
    case 'monitoring':
      await generateMonitoring(options, analysis, cloudManager, aiAssistant, logger);
      break;
    case 'security-configs':
      await generateSecurityConfigs(options, analysis, cloudManager, aiAssistant, logger);
      break;
    case 'analyze':
      await analyzeProject(projectAnalyzer, logger);
      break;
    case 'stack':
      await generateCompleteStack(options, cloudManager, aiAssistant, logger);
      break;
    default:
      console.log(chalk.red(`Unknown generation type: ${type}`));
      console.log(chalk.yellow('Available types: terraform, kubernetes, docker, cicd, monitoring, security-configs, analyze, stack'));
    }
  } catch (error) {
    logger.error(`Infrastructure generation failed: ${error.message}`);
    console.error(chalk.red(`\n❌ Generation failed: ${error.message}`));
  }
}

async function generateTerraform(options, analysis, cloudManager, aiAssistant, logger) {
  const outputDir = options.output ? path.resolve(options.output) : null;
  const generator = new TerraformGenerator(cloudManager, aiAssistant, logger, outputDir);
  
  console.log(chalk.blue.bold('\n🏗️  TERRAFORM GENERATION'));
  console.log(chalk.blue('='.repeat(40)));

  if (options.module) {
    await generator.generateModule(options.module, analysis, options);
  } else {
    await generator.generateComplete(analysis, options);
  }
}

async function generateKubernetes(options, analysis, cloudManager, aiAssistant, logger) {
  const outputDir = options.output ? path.resolve(options.output) : null;
  const generator = new KubernetesGenerator(cloudManager, aiAssistant, logger, outputDir);
  
  console.log(chalk.cyan.bold('\n⚡ KUBERNETES GENERATION'));
  console.log(chalk.cyan('='.repeat(40)));

  if (options.helm) {
    await generator.generateHelmChart(analysis, options);
  } else if (options.app) {
    await generator.generateAppManifests(options.app, analysis, options);
  } else {
    await generator.generateComplete(analysis, options);
  }
}

async function generateDocker(options, analysis, aiAssistant, logger) {
  const outputDir = options.output ? path.resolve(options.output) : null;
  const generator = new DockerGenerator(aiAssistant, logger, outputDir);
  
  console.log(chalk.magenta.bold('\n🐳 DOCKER GENERATION'));
  console.log(chalk.magenta('='.repeat(40)));

  await generator.generateConfigurations(analysis, options);
}

async function generateCICD(options, analysis, aiAssistant, logger) {
  const outputDir = options.output ? path.resolve(options.output) : null;
  const generator = new CICDGenerator(aiAssistant, logger, outputDir);
  
  console.log(chalk.yellow.bold('\n🔄 CI/CD GENERATION'));
  console.log(chalk.yellow('='.repeat(40)));

  if (options.github) {
    await generator.generateGitHubActions(analysis, options);
  } else if (options.gitlab) {
    await generator.generateGitLabCI(analysis, options);
  } else {
    await generator.generateInteractive(analysis, options);
  }
}

async function generateMonitoring(options, analysis, cloudManager, aiAssistant, logger) {
  const outputDir = options.output ? path.resolve(options.output) : null;
  const generator = new MonitoringGenerator(cloudManager, aiAssistant, logger, outputDir);
  
  console.log(chalk.red.bold('\n📊 MONITORING GENERATION'));
  console.log(chalk.red('='.repeat(40)));

  if (options.prometheus) {
    await generator.generatePrometheus(analysis, options);
  } else if (options.grafana) {
    await generator.generateGrafana(analysis, options);
  } else {
    await generator.generateComplete(analysis, options);
  }
}

async function generateSecurityConfigs(options, analysis, cloudManager, aiAssistant, logger) {
  const generator = new SecurityConfigGenerator(cloudManager, aiAssistant, logger);
  
  // Add the resolved output directory to options
  if (options.output) {
    options.outputDir = path.resolve(options.output);
  }
  
  console.log(chalk.red.bold('\n🛡️  SECURITY CONFIG GENERATION'));
  console.log(chalk.red('='.repeat(40)));
  console.log(chalk.gray('Note: This generates security configuration files, not security analysis'));
  console.log(chalk.gray('For security analysis, use: rig security\n'));

  if (options.policies) {
    await generator.generatePolicies(analysis, options);
  } else if (options.compliance) {
    await generator.generateComplianceConfigs(options.compliance, analysis, options);
  } else {
    await generator.generateComplete(analysis, options);
  }
}

async function analyzeProject(projectAnalyzer, logger) {
  console.log(chalk.green.bold('\n🔍 PROJECT ANALYSIS'));
  console.log(chalk.green('='.repeat(40)));

  const spinner = ora('Analyzing project structure and dependencies...').start();
  
  try {
    const analysis = await projectAnalyzer.analyzeProject();
    spinner.succeed('Analysis completed');

    console.log(chalk.white.bold('\n📋 PROJECT OVERVIEW:'));
    console.log(`• Project Type: ${chalk.cyan(analysis.projectType || 'Unknown')}`);
    console.log(`• Technology Stack: ${chalk.cyan(analysis.techStack?.join(', ') || 'Unknown')}`);
    console.log(`• Package Manager: ${chalk.cyan(analysis.packageManager || 'Unknown')}`);
    console.log(`• Dependencies: ${chalk.cyan(analysis.dependencies?.length || 0)} found`);
    
    if (analysis.infrastructure) {
      console.log(chalk.white.bold('\n☁️  INFRASTRUCTURE:'));
      console.log(`• Provider: ${chalk.cyan(analysis.infrastructure.provider || 'Unknown')}`);
      console.log(`• Resources: ${chalk.cyan(analysis.infrastructure.resourceCount || 0)}`);
      console.log(`• Estimated Monthly Cost: ${chalk.green('$' + (analysis.infrastructure.estimatedCost || 0))}`);
    }

    if (analysis.recommendations?.length > 0) {
      console.log(chalk.yellow.bold('\n💡 RECOMMENDATIONS:'));
      analysis.recommendations.forEach(rec => {
        console.log(`• ${rec}`);
      });
    }

    if (analysis.generateSuggestions?.length > 0) {
      console.log(chalk.blue.bold('\n🎯 SUGGESTED GENERATIONS:'));
      analysis.generateSuggestions.forEach(suggestion => {
        console.log(`• ${chalk.blue(suggestion.command)} - ${suggestion.description}`);
      });
    }
  } catch (error) {
    spinner.fail('Analysis failed');
    throw error;
  }
}

async function generateCompleteStack(options, cloudManager, aiAssistant, logger) {
  console.log(chalk.cyan.bold('\n🚀 COMPLETE STACK GENERATION'));
  console.log(chalk.cyan('='.repeat(50)));
  
  // Analyze the cloud project infrastructure
  const cloudAnalysis = await analyzeCloudInfrastructure(cloudManager, logger);
  
  // Generate and display the infrastructure analysis report
  const report = await generateCloudInfrastructureReport(cloudAnalysis);
  
  // Display the report on screen
  console.log(report.display);
  
  // Save the report to markdown
  await saveInfrastructureReport(report.markdown, cloudAnalysis.projectName);
  
  // Ask user if they want to proceed with generation
  const { proceedWithGeneration } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceedWithGeneration',
      message: '\nWould you like to proceed with infrastructure generation based on this analysis?',
      default: true
    }
  ]);
  
  if (!proceedWithGeneration) {
    console.log(chalk.yellow('\n📝 Analysis report saved to infra-reports/'));
    console.log(chalk.gray('Review the report and run "rig generate stack" when ready.'));
    return;
  }

  // Auto-select components based on analysis
  const components = await selectCloudStackComponents(cloudAnalysis);
  
  // Pass the enhanced analysis to each generator
  for (const component of components) {
    console.log(chalk.blue(`\n📦 Generating ${component}...`));
    
    switch (component) {
    case 'terraform':
      await generateTerraformFromCloud(options, cloudAnalysis, cloudManager, aiAssistant, logger);
      break;
    case 'kubernetes':
      await generateKubernetesFromCloud(options, cloudAnalysis, cloudManager, aiAssistant, logger);
      break;
    case 'docker':
      await generateDockerFromCloud(options, cloudAnalysis, aiAssistant, logger);
      break;
    case 'docker-compose':
      await generateDockerComposeFromCloud(options, cloudAnalysis, aiAssistant, logger);
      break;
    case 'cicd':
      await generateCICD(options, cloudAnalysis, aiAssistant, logger);
      break;
    case 'monitoring':
      await generateMonitoring(options, cloudAnalysis, cloudManager, aiAssistant, logger);
      break;
    }
  }

  console.log(chalk.green.bold('\n✅ Complete stack generation finished!'));
  console.log(chalk.gray('Review the generated files and customize as needed.'));
  
  // Display next steps
  console.log(chalk.yellow.bold('\n📝 NEXT STEPS:'));
  console.log('  1. Review generated configurations');
  console.log('  2. Update environment variables');
  console.log('  3. Test locally with docker-compose');
  console.log('  4. Deploy with terraform apply');
}

async function selectStackComponents(analysis) {
  const availableComponents = [
    { name: '🏗️  Terraform Infrastructure', value: 'terraform', checked: true },
    { name: '🐳 Docker Configurations', value: 'docker', checked: !analysis.hasDocker },
    { name: '🐋 Docker Compose Stack', value: 'docker-compose', checked: analysis.databases.length > 0 || analysis.caches.length > 0 },
    { name: '⚡ Kubernetes Manifests', value: 'kubernetes', checked: analysis?.needsOrchestration === true },
    { name: '🔄 CI/CD Pipelines', value: 'cicd', checked: !analysis.hasCI },
    { name: '📊 Monitoring Stack', value: 'monitoring', checked: analysis.ports.length > 0 || analysis.runningServices.length > 0 }
  ];

  const { components } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'components',
      message: 'Select components to generate:',
      choices: availableComponents,
      validate: (answer) => {
        if (answer.length < 1) {
          return 'You must choose at least one component.';
        }
        return true;
      }
    }
  ]);

  return components;
}

async function generateTerraformWithServices(options, analysis, cloudManager, aiAssistant, logger) {
  const generator = new TerraformGenerator(cloudManager, aiAssistant, logger);
  
  // Enhanced options with detected services
  const enhancedOptions = {
    ...options,
    databases: analysis.databases,
    caches: analysis.caches,
    queues: analysis.queues,
    storage: analysis.storage,
    ports: analysis.ports,
    services: analysis.runningServices
  };
  
  await generator.generateComplete(analysis, enhancedOptions);
}

async function generateKubernetesWithServices(options, analysis, cloudManager, aiAssistant, logger) {
  const generator = new KubernetesGenerator(cloudManager, aiAssistant, logger);
  
  // Enhanced options with detected services
  const enhancedOptions = {
    ...options,
    databases: analysis.databases,
    caches: analysis.caches,
    queues: analysis.queues,
    ports: analysis.ports,
    services: analysis.runningServices,
    envVariables: analysis.envVariables
  };
  
  await generator.generateComplete(analysis, enhancedOptions);
}

async function generateDockerWithServices(options, analysis, aiAssistant, logger) {
  const generator = new DockerGenerator(aiAssistant, logger);
  
  // Enhanced options with detected services
  const enhancedOptions = {
    ...options,
    techStack: analysis.techStack,
    packageManager: analysis.packageManager,
    ports: analysis.ports,
    envVariables: analysis.envVariables
  };
  
  await generator.generateConfigurations(analysis, enhancedOptions);
}

async function generateDockerCompose(options, analysis, aiAssistant, logger) {
  const generator = new DockerGenerator(aiAssistant, logger);
  
  // Generate a complete docker-compose.yml with all detected services
  const composeConfig = {
    version: '3.8',
    services: {}
  };
  
  // Add main application
  composeConfig.services.app = {
    build: '.',
    ports: analysis.ports.map(p => `${p.host}:${p.container}`),
    environment: Object.keys(analysis.envVariables).filter(k => !k.includes('PASSWORD') && !k.includes('SECRET')),
    depends_on: []
  };
  
  // Add databases
  for (const db of analysis.databases) {
    if (db.type === 'postgresql') {
      composeConfig.services.postgres = {
        image: 'postgres:15',
        environment: ['POSTGRES_DB=app', 'POSTGRES_USER=admin', 'POSTGRES_PASSWORD=password'],
        volumes: ['postgres_data:/var/lib/postgresql/data'],
        ports: ['5432:5432']
      };
      composeConfig.services.app.depends_on.push('postgres');
    } else if (db.type === 'mysql') {
      composeConfig.services.mysql = {
        image: 'mysql:8',
        environment: ['MYSQL_DATABASE=app', 'MYSQL_ROOT_PASSWORD=password'],
        volumes: ['mysql_data:/var/lib/mysql'],
        ports: ['3306:3306']
      };
      composeConfig.services.app.depends_on.push('mysql');
    } else if (db.type === 'mongodb') {
      composeConfig.services.mongo = {
        image: 'mongo:6',
        volumes: ['mongo_data:/data/db'],
        ports: ['27017:27017']
      };
      composeConfig.services.app.depends_on.push('mongo');
    }
  }
  
  // Add caches
  for (const cache of analysis.caches) {
    if (cache.type === 'redis') {
      composeConfig.services.redis = {
        image: 'redis:7-alpine',
        ports: ['6379:6379'],
        volumes: ['redis_data:/data']
      };
      composeConfig.services.app.depends_on.push('redis');
    }
  }
  
  // Add queues
  for (const queue of analysis.queues) {
    if (queue.type === 'rabbitmq') {
      composeConfig.services.rabbitmq = {
        image: 'rabbitmq:3-management',
        ports: ['5672:5672', '15672:15672'],
        volumes: ['rabbitmq_data:/var/lib/rabbitmq']
      };
      composeConfig.services.app.depends_on.push('rabbitmq');
    }
  }
  
  // Add volumes
  composeConfig.volumes = {};
  if (composeConfig.services.postgres) composeConfig.volumes.postgres_data = {};
  if (composeConfig.services.mysql) composeConfig.volumes.mysql_data = {};
  if (composeConfig.services.mongo) composeConfig.volumes.mongo_data = {};
  if (composeConfig.services.redis) composeConfig.volumes.redis_data = {};
  if (composeConfig.services.rabbitmq) composeConfig.volumes.rabbitmq_data = {};
  
  // Write docker-compose.yml
  const composeYaml = yaml.dump(composeConfig);
  fs.writeFileSync('docker-compose.generated.yml', composeYaml);
  
  console.log(chalk.green('✅ Generated docker-compose.generated.yml with all detected services'));
}

async function generateInfrastructureReport(analysis) {
  const report = {
    display: '',
    markdown: ''
  };
  
  // Build display report (for console)
  let display = chalk.white.bold('\n📊 INFRASTRUCTURE ANALYSIS REPORT\n');
  display += chalk.gray('='.repeat(50)) + '\n';
  
  // Project Overview
  display += chalk.yellow.bold('\n🏗️  PROJECT OVERVIEW\n');
  display += `  • Project: ${chalk.cyan(analysis.projectName)}\n`;
  display += `  • Type: ${chalk.cyan(analysis.projectType || 'Not detected')}\n`;
  display += `  • Tech Stack: ${chalk.cyan(analysis.techStack.join(', ') || 'Not detected')}\n`;
  display += `  • Package Manager: ${chalk.cyan(analysis.packageManager || 'Not detected')}\n`;
  
  // Detected Services
  display += chalk.yellow.bold('\n🔍 DETECTED SERVICES\n');
  
  if (analysis.databases.length > 0) {
    display += chalk.blue('  Databases:\n');
    analysis.databases.forEach(db => {
      display += `    • ${db.type}${db.package ? ` (${db.package})` : ''}\n`;
    });
  }
  
  if (analysis.caches.length > 0) {
    display += chalk.magenta('  Caching:\n');
    analysis.caches.forEach(cache => {
      display += `    • ${cache.type}${cache.package ? ` (${cache.package})` : ''}\n`;
    });
  }
  
  if (analysis.queues.length > 0) {
    display += chalk.yellow('  Message Queues:\n');
    analysis.queues.forEach(queue => {
      display += `    • ${queue.type}${queue.package ? ` (${queue.package})` : ''}\n`;
    });
  }
  
  if (analysis.storage.length > 0) {
    display += chalk.green('  Storage:\n');
    analysis.storage.forEach(storage => {
      display += `    • ${storage.type}${storage.package ? ` (${storage.package})` : ''}\n`;
    });
  }
  
  if (analysis.ports.length > 0) {
    display += chalk.cyan('  Exposed Ports:\n');
    analysis.ports.forEach(port => {
      display += `    • ${port.host}${port.process ? ` (${port.process})` : ''}\n`;
    });
  }
  
  // Environment Configuration
  if (Object.keys(analysis.envVariables).length > 0) {
    display += chalk.yellow.bold('\n🔐 ENVIRONMENT CONFIGURATION\n');
    const envKeys = Object.keys(analysis.envVariables).filter(k => 
      !k.includes('PASSWORD') && !k.includes('SECRET') && !k.includes('KEY')
    );
    display += `  • ${envKeys.length} environment variables detected\n`;
    display += `  • Sensitive variables masked\n`;
  }
  
  // Existing Infrastructure
  display += chalk.yellow.bold('\n📦 EXISTING INFRASTRUCTURE\n');
  display += `  • Docker: ${analysis.hasDocker ? chalk.green('✓') : chalk.red('✗')}\n`;
  display += `  • Kubernetes: ${analysis.hasKubernetes ? chalk.green('✓') : chalk.red('✗')}\n`;
  display += `  • Terraform: ${analysis.hasTerraform ? chalk.green('✓') : chalk.red('✗')}\n`;
  display += `  • CI/CD: ${analysis.hasCI ? chalk.green('✓') : chalk.red('✗')}\n`;
  
  // Cloud Resources
  if (analysis.infrastructure) {
    display += chalk.yellow.bold('\n☁️  CLOUD RESOURCES\n');
    display += `  • Provider: ${chalk.cyan(analysis.infrastructure.provider)}\n`;
    display += `  • Total Resources: ${chalk.cyan(analysis.infrastructure.resourceCount)}\n`;
    display += `  • Resource Types: ${chalk.cyan(analysis.infrastructure.resourceTypes.join(', '))}\n`;
    display += `  • Estimated Monthly Cost: ${chalk.green('$' + analysis.infrastructure.estimatedCost)}\n`;
  }
  
  // Recommendations
  if (analysis.recommendations.length > 0) {
    display += chalk.yellow.bold('\n💡 RECOMMENDATIONS\n');
    analysis.recommendations.forEach((rec, i) => {
      display += `  ${i + 1}. ${rec}\n`;
    });
  }
  
  report.display = display;
  
  // Build markdown report
  let markdown = '# Infrastructure Analysis Report\n\n';
  markdown += `**Generated:** ${new Date().toISOString()}\n`;
  markdown += `**Project:** ${analysis.projectName}\n\n`;
  
  markdown += '## Project Overview\n\n';
  markdown += `- **Type:** ${analysis.projectType || 'Not detected'}\n`;
  markdown += `- **Technology Stack:** ${analysis.techStack.join(', ') || 'Not detected'}\n`;
  markdown += `- **Package Manager:** ${analysis.packageManager || 'Not detected'}\n`;
  markdown += `- **Dependencies:** ${analysis.dependencies.length} packages\n\n`;
  
  markdown += '## Detected Services\n\n';
  
  if (analysis.databases.length > 0) {
    markdown += '### Databases\n';
    analysis.databases.forEach(db => {
      markdown += `- ${db.type}${db.package ? ` (via ${db.package})` : ''}\n`;
    });
    markdown += '\n';
  }
  
  if (analysis.caches.length > 0) {
    markdown += '### Caching\n';
    analysis.caches.forEach(cache => {
      markdown += `- ${cache.type}${cache.package ? ` (via ${cache.package})` : ''}\n`;
    });
    markdown += '\n';
  }
  
  if (analysis.queues.length > 0) {
    markdown += '### Message Queues\n';
    analysis.queues.forEach(queue => {
      markdown += `- ${queue.type}${queue.package ? ` (via ${queue.package})` : ''}\n`;
    });
    markdown += '\n';
  }
  
  if (analysis.storage.length > 0) {
    markdown += '### Storage\n';
    analysis.storage.forEach(storage => {
      markdown += `- ${storage.type}${storage.package ? ` (via ${storage.package})` : ''}\n`;
    });
    markdown += '\n';
  }
  
  if (analysis.ports.length > 0) {
    markdown += '### Exposed Ports\n';
    markdown += '| Port | Container Port | Process |\n';
    markdown += '|------|---------------|--------|\n';
    analysis.ports.forEach(port => {
      markdown += `| ${port.host} | ${port.container} | ${port.process || 'N/A'} |\n`;
    });
    markdown += '\n';
  }
  
  markdown += '## Infrastructure Status\n\n';
  markdown += '| Component | Status |\n';
  markdown += '|-----------|--------|\n';
  markdown += `| Docker | ${analysis.hasDocker ? '✅ Configured' : '❌ Not found'} |\n`;
  markdown += `| Kubernetes | ${analysis.hasKubernetes ? '✅ Configured' : '❌ Not found'} |\n`;
  markdown += `| Terraform | ${analysis.hasTerraform ? '✅ Configured' : '❌ Not found'} |\n`;
  markdown += `| CI/CD | ${analysis.hasCI ? '✅ Configured' : '❌ Not found'} |\n\n`;
  
  if (analysis.infrastructure) {
    markdown += '## Cloud Resources\n\n';
    markdown += `- **Provider:** ${analysis.infrastructure.provider}\n`;
    markdown += `- **Total Resources:** ${analysis.infrastructure.resourceCount}\n`;
    markdown += `- **Resource Types:** ${analysis.infrastructure.resourceTypes.join(', ')}\n`;
    markdown += `- **Estimated Monthly Cost:** $${analysis.infrastructure.estimatedCost}\n\n`;
  }
  
  if (analysis.recommendations.length > 0) {
    markdown += '## Recommendations\n\n';
    analysis.recommendations.forEach((rec, i) => {
      markdown += `${i + 1}. ${rec}\n`;
    });
    markdown += '\n';
  }
  
  markdown += '## Next Steps\n\n';
  markdown += '1. Review this analysis report\n';
  markdown += '2. Run `rig generate stack` to generate complete infrastructure\n';
  markdown += '3. Customize generated configurations as needed\n';
  markdown += '4. Deploy using the generated scripts\n\n';
  
  markdown += '---\n';
  markdown += '*Generated by Rig CLI Infrastructure Analyzer*\n';
  
  report.markdown = markdown;
  
  return report;
}

async function saveInfrastructureReport(markdown, projectName) {
  const reportsDir = path.join(process.cwd(), 'infra-reports');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
    console.log(chalk.green(`\n✅ Created infra-reports/ directory`));
  }
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `${projectName}-analysis-${timestamp}.md`;
  const filepath = path.join(reportsDir, filename);
  
  // Save the report
  fs.writeFileSync(filepath, markdown);
  
  console.log(chalk.green(`\n📝 Report saved to: ${chalk.cyan(`infra-reports/${filename}`)}`));
}

async function analyzeCloudInfrastructure(cloudManager, logger) {
  const spinner = ora('Analyzing cloud infrastructure...').start();
  
  try {
    // Get cloud configuration
    const cloudConfig = {
      provider: 'GCP',
      projectId: process.env.GCP_PROJECT_ID,
      region: process.env.GCP_REGION || 'us-central1',
      account: process.env.GCP_ACCOUNT
    };
    
    // Get all cloud resources
    const resources = await cloudManager.listAllResources();
    
    // Analyze resources
    const analysis = {
      projectName: cloudConfig.projectId || 'unknown-project',
      cloudProvider: cloudConfig.provider,
      region: cloudConfig.region,
      timestamp: new Date().toISOString(),
      resources: resources || [],
      totalResources: 0,
      resourcesByType: {},
      estimatedMonthlyCost: 0,
      databases: [],
      compute: [],
      storage: [],
      networks: [],
      loadBalancers: [],
      recommendations: []
    };
    
    // Process resources by type
    if (resources) {
      for (const resourceGroup of resources) {
        if (resourceGroup.items && resourceGroup.items.length > 0) {
          analysis.totalResources += resourceGroup.items.length;
          analysis.resourcesByType[resourceGroup.type] = resourceGroup.items.length;
          
          // Categorize resources
          switch (resourceGroup.type) {
          case 'instances':
            analysis.compute.push(...resourceGroup.items);
            break;
          case 'databases':
            analysis.databases.push(...resourceGroup.items);
            break;
          case 'storage':
            analysis.storage.push(...resourceGroup.items);
            break;
          case 'networks':
            analysis.networks.push(...resourceGroup.items);
            break;
          case 'load-balancers':
            analysis.loadBalancers.push(...resourceGroup.items);
            break;
          }
          
          // Estimate costs
          analysis.estimatedMonthlyCost += estimateResourceGroupCost(resourceGroup);
        }
      }
    }
    
    // Generate recommendations
    analysis.recommendations = generateCloudRecommendations(analysis);
    
    spinner.succeed('Cloud infrastructure analysis completed');
    return analysis;
    
  } catch (error) {
    spinner.fail('Failed to analyze cloud infrastructure');
    logger.error(`Cloud analysis error: ${error.message}`);
    
    // Return basic analysis with error info
    return {
      projectName: process.env.GCP_PROJECT_ID || 'unknown-project',
      cloudProvider: 'GCP',
      region: process.env.GCP_REGION || 'us-central1',
      timestamp: new Date().toISOString(),
      resources: [],
      totalResources: 0,
      resourcesByType: {},
      estimatedMonthlyCost: 0,
      databases: [],
      compute: [],
      storage: [],
      networks: [],
      loadBalancers: [],
      recommendations: ['Unable to analyze cloud resources. Please check authentication and permissions.'],
      error: error.message
    };
  }
}

async function generateCloudInfrastructureReport(analysis) {
  const report = {
    display: '',
    markdown: ''
  };
  
  // Build display report (for console)
  let display = chalk.white.bold('\n📊 CLOUD INFRASTRUCTURE ANALYSIS REPORT\n');
  display += chalk.gray('='.repeat(60)) + '\n';
  
  // Project Overview
  display += chalk.yellow.bold('\n☁️  CLOUD PROJECT OVERVIEW\n');
  display += `  • Project ID: ${chalk.cyan(analysis.projectName)}\n`;
  display += `  • Provider: ${chalk.cyan(analysis.cloudProvider)}\n`;
  display += `  • Region: ${chalk.cyan(analysis.region)}\n`;
  display += `  • Total Resources: ${chalk.cyan(analysis.totalResources)}\n`;
  display += `  • Estimated Monthly Cost: ${chalk.green('$' + analysis.estimatedMonthlyCost)}\n`;
  
  // Resource Breakdown
  if (analysis.totalResources > 0) {
    display += chalk.yellow.bold('\n📦 RESOURCE BREAKDOWN\n');
    
    if (analysis.compute.length > 0) {
      display += chalk.blue(`  Compute Instances: ${analysis.compute.length}\n`);
      analysis.compute.forEach(instance => {
        display += chalk.gray(`    • ${instance.name} (${instance.status || 'unknown'})\n`);
      });
    }
    
    if (analysis.databases.length > 0) {
      display += chalk.green(`  Databases: ${analysis.databases.length}\n`);
      analysis.databases.forEach(db => {
        display += chalk.gray(`    • ${db.name} (${db.engine || 'unknown'})\n`);
      });
    }
    
    if (analysis.storage.length > 0) {
      display += chalk.magenta(`  Storage Buckets: ${analysis.storage.length}\n`);
      analysis.storage.forEach(bucket => {
        display += chalk.gray(`    • ${bucket.name}\n`);
      });
    }
    
    if (analysis.networks.length > 0) {
      display += chalk.cyan(`  Networks: ${analysis.networks.length}\n`);
      analysis.networks.forEach(network => {
        display += chalk.gray(`    • ${network.name}\n`);
      });
    }
    
    if (analysis.loadBalancers.length > 0) {
      display += chalk.yellow(`  Load Balancers: ${analysis.loadBalancers.length}\n`);
      analysis.loadBalancers.forEach(lb => {
        display += chalk.gray(`    • ${lb.name}\n`);
      });
    }
    
  } else {
    display += chalk.yellow.bold('\n📦 RESOURCE BREAKDOWN\n');
    display += chalk.gray('  • No resources found or unable to access resources\n');
  }
  
  // Cost Breakdown
  if (analysis.estimatedMonthlyCost > 0) {
    display += chalk.yellow.bold('\n💰 ESTIMATED COSTS\n');
    Object.entries(analysis.resourcesByType).forEach(([type, count]) => {
      const cost = estimateResourceTypeCost(type, count);
      display += `  • ${type}: $${cost}/month (${count} resources)\n`;
    });
  }
  
  // Recommendations
  if (analysis.recommendations.length > 0) {
    display += chalk.yellow.bold('\n💡 RECOMMENDATIONS\n');
    analysis.recommendations.forEach((rec, i) => {
      display += `  ${i + 1}. ${rec}\n`;
    });
  }
  
  if (analysis.error) {
    display += chalk.red.bold('\n⚠️  ANALYSIS WARNINGS\n');
    display += `  • ${analysis.error}\n`;
  }
  
  report.display = display;
  
  // Build markdown report
  let markdown = '# Cloud Infrastructure Analysis Report\n\n';
  markdown += `**Generated:** ${analysis.timestamp}\n`;
  markdown += `**Project:** ${analysis.projectName}\n`;
  markdown += `**Provider:** ${analysis.cloudProvider}\n`;
  markdown += `**Region:** ${analysis.region}\n\n`;
  
  markdown += '## Infrastructure Overview\n\n';
  markdown += `- **Total Resources:** ${analysis.totalResources}\n`;
  markdown += `- **Estimated Monthly Cost:** $${analysis.estimatedMonthlyCost}\n\n`;
  
  if (analysis.totalResources > 0) {
    markdown += '## Resource Breakdown\n\n';
    
    if (analysis.compute.length > 0) {
      markdown += `### Compute Instances (${analysis.compute.length})\n`;
      markdown += '| Name | Status | Type |\n|------|--------|------|\n';
      analysis.compute.forEach(instance => {
        markdown += `| ${instance.name} | ${instance.status || 'Unknown'} | ${instance.machineType || 'Unknown'} |\n`;
      });
      markdown += '\n';
    }
    
    if (analysis.databases.length > 0) {
      markdown += `### Databases (${analysis.databases.length})\n`;
      markdown += '| Name | Engine | Status |\n|------|--------|--------|\n';
      analysis.databases.forEach(db => {
        markdown += `| ${db.name} | ${db.engine || 'Unknown'} | ${db.status || 'Unknown'} |\n`;
      });
      markdown += '\n';
    }
    
    if (analysis.storage.length > 0) {
      markdown += `### Storage (${analysis.storage.length})\n`;
      markdown += '| Name | Location | Storage Class |\n|------|----------|---------------|\n';
      analysis.storage.forEach(bucket => {
        markdown += `| ${bucket.name} | ${bucket.location || 'Unknown'} | ${bucket.storageClass || 'Unknown'} |\n`;
      });
      markdown += '\n';
    }
    
    if (analysis.networks.length > 0) {
      markdown += `### Networks (${analysis.networks.length})\n`;
      analysis.networks.forEach(network => {
        markdown += `- ${network.name}\n`;
      });
      markdown += '\n';
    }
  }
  
  if (analysis.recommendations.length > 0) {
    markdown += '## Recommendations\n\n';
    analysis.recommendations.forEach((rec, i) => {
      markdown += `${i + 1}. ${rec}\n`;
    });
    markdown += '\n';
  }
  
  markdown += '## Next Steps\n\n';
  markdown += '1. Review this cloud infrastructure analysis\n';
  markdown += '2. Select components to generate based on existing resources\n';
  markdown += '3. Generate Terraform to manage infrastructure as code\n';
  markdown += '4. Set up monitoring and CI/CD for deployments\n\n';
  
  markdown += '---\n';
  markdown += '*Generated by Rig CLI Cloud Infrastructure Analyzer*\n';
  
  report.markdown = markdown;
  return report;
}

async function selectCloudStackComponents(analysis) {
  const availableComponents = [
    { name: '🏗️  Terraform Infrastructure (Import Existing)', value: 'terraform', checked: true },
    { name: '⚡ Kubernetes Manifests', value: 'kubernetes', checked: analysis.compute.length > 0 },
    { name: '🐳 Docker Configurations', value: 'docker', checked: analysis.compute.length > 0 },
    { name: '🔄 CI/CD Pipelines', value: 'cicd', checked: true },
    { name: '📊 Monitoring Stack', value: 'monitoring', checked: analysis.totalResources > 0 }
  ];

  const { components } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'components',
      message: 'Select components to generate based on your cloud infrastructure:',
      choices: availableComponents,
      validate: (answer) => {
        if (answer.length < 1) {
          return 'You must choose at least one component.';
        }
        return true;
      }
    }
  ]);

  return components;
}

function generateCloudRecommendations(analysis) {
  const recommendations = [];
  
  if (analysis.totalResources === 0) {
    recommendations.push('No cloud resources found. Consider creating compute instances or databases.');
    return recommendations;
  }
  
  if (analysis.totalResources > 0) {
    recommendations.push('Generate Terraform modules to manage existing infrastructure as code');
  }
  
  if (analysis.compute.length > 0) {
    recommendations.push('Set up Kubernetes manifests for container orchestration');
    recommendations.push('Configure monitoring and logging for compute instances');
  }
  
  if (analysis.databases.length > 0) {
    recommendations.push('Implement database backup and disaster recovery strategies');
  }
  
  if (analysis.storage.length > 0) {
    recommendations.push('Review storage lifecycle policies and access controls');
  }
  
  if (analysis.estimatedMonthlyCost > 100) {
    recommendations.push('Review resource usage and consider cost optimization strategies');
  }
  
  recommendations.push('Set up CI/CD pipelines for automated deployments');
  
  return recommendations;
}

function estimateResourceGroupCost(resourceGroup) {
  const costMap = {
    instances: 50,     // Average per instance
    storage: 5,        // Average per bucket
    databases: 75,     // Average per database
    networks: 10,      // Average per network
    'load-balancers': 25 // Average per load balancer
  };
  
  return (costMap[resourceGroup.type] || 15) * (resourceGroup.items?.length || 0);
}

function estimateResourceTypeCost(type, count) {
  const costMap = {
    instances: 50,
    storage: 5,
    databases: 75,
    networks: 10,
    'load-balancers': 25
  };
  
  return (costMap[type] || 15) * count;
}

// Simplified cloud-focused generation functions
async function generateTerraformFromCloud(options, cloudAnalysis, cloudManager, aiAssistant, logger) {
  const generator = new TerraformGenerator(cloudManager, aiAssistant, logger);
  await generator.generateComplete(cloudAnalysis, { ...options, import: true });
}

async function generateKubernetesFromCloud(options, cloudAnalysis, cloudManager, aiAssistant, logger) {
  const generator = new KubernetesGenerator(cloudManager, aiAssistant, logger);
  await generator.generateComplete(cloudAnalysis, options);
}

async function generateDockerFromCloud(options, cloudAnalysis, aiAssistant, logger) {
  const generator = new DockerGenerator(aiAssistant, logger);
  await generator.generateConfigurations(cloudAnalysis, options);
}

async function generateDockerComposeFromCloud(options, cloudAnalysis, aiAssistant, logger) {
  // Generate basic docker-compose for cloud services
  const composeConfig = {
    version: '3.8',
    services: {
      app: {
        build: '.',
        ports: ['8080:8080'],
        environment: [
          'NODE_ENV=production',
          `GCP_PROJECT_ID=${cloudAnalysis.projectName}`,
          `GCP_REGION=${cloudAnalysis.region}`
        ]
      }
    }
  };
  
  const composeYaml = yaml.dump(composeConfig);
  fs.writeFileSync('docker-compose.generated.yml', composeYaml);
  
  console.log(chalk.green('✅ Generated docker-compose.generated.yml for cloud deployment'));
}