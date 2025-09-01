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
      await generateCompleteStack(options, analysis, cloudManager, aiAssistant, logger);
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
  const generator = new TerraformGenerator(cloudManager, aiAssistant, logger);
  
  console.log(chalk.blue.bold('\n🏗️  TERRAFORM GENERATION'));
  console.log(chalk.blue('='.repeat(40)));

  if (options.module) {
    await generator.generateModule(options.module, analysis, options);
  } else {
    await generator.generateComplete(analysis, options);
  }
}

async function generateKubernetes(options, analysis, cloudManager, aiAssistant, logger) {
  const generator = new KubernetesGenerator(cloudManager, aiAssistant, logger);
  
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
  const generator = new DockerGenerator(aiAssistant, logger);
  
  console.log(chalk.magenta.bold('\n🐳 DOCKER GENERATION'));
  console.log(chalk.magenta('='.repeat(40)));

  await generator.generateConfigurations(analysis, options);
}

async function generateCICD(options, analysis, aiAssistant, logger) {
  const generator = new CICDGenerator(aiAssistant, logger);
  
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
  const generator = new MonitoringGenerator(cloudManager, aiAssistant, logger);
  
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

async function generateCompleteStack(options, analysis, cloudManager, aiAssistant, logger) {
  console.log(chalk.cyan.bold('\n🚀 COMPLETE STACK GENERATION'));
  console.log(chalk.cyan('='.repeat(50)));
  
  // Generate and display the infrastructure analysis report
  const report = await generateInfrastructureReport(analysis);
  
  // Display the report on screen
  console.log(report.display);
  
  // Save the report to markdown
  await saveInfrastructureReport(report.markdown, analysis.projectName);
  
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
  const components = await selectStackComponents(analysis);
  
  // Pass the enhanced analysis to each generator
  for (const component of components) {
    console.log(chalk.blue(`\n📦 Generating ${component}...`));
    
    switch (component) {
    case 'terraform':
      await generateTerraformWithServices(options, analysis, cloudManager, aiAssistant, logger);
      break;
    case 'kubernetes':
      await generateKubernetesWithServices(options, analysis, cloudManager, aiAssistant, logger);
      break;
    case 'docker':
      await generateDockerWithServices(options, analysis, aiAssistant, logger);
      break;
    case 'docker-compose':
      await generateDockerCompose(options, analysis, aiAssistant, logger);
      break;
    case 'cicd':
      await generateCICD(options, analysis, aiAssistant, logger);
      break;
    case 'monitoring':
      await generateMonitoring(options, analysis, cloudManager, aiAssistant, logger);
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
  const generator = new TerraformGenerator(cloudManager, aiAssistant);
  
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
  
  await generator.generate(enhancedOptions, analysis);
}

async function generateKubernetesWithServices(options, analysis, cloudManager, aiAssistant, logger) {
  const generator = new KubernetesGenerator(cloudManager, aiAssistant);
  
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
  
  await generator.generate(enhancedOptions, analysis);
}

async function generateDockerWithServices(options, analysis, aiAssistant, logger) {
  const generator = new DockerGenerator(aiAssistant);
  
  // Enhanced options with detected services
  const enhancedOptions = {
    ...options,
    techStack: analysis.techStack,
    packageManager: analysis.packageManager,
    ports: analysis.ports,
    envVariables: analysis.envVariables
  };
  
  await generator.generate(enhancedOptions, analysis);
}

async function generateDockerCompose(options, analysis, aiAssistant, logger) {
  const generator = new DockerGenerator(aiAssistant);
  
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