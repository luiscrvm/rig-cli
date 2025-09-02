import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs';
import { AIAssistant } from '../core/aiAssistant.js';
import { CloudManager } from '../core/cloudManager.js';
import { ProjectAnalyzer } from '../core/projectAnalyzer.js';
import { Logger } from '../utils/logger.js';
import { TerraformGenerator } from '../generators/terraformGenerator.js';
import { KubernetesGenerator } from '../generators/kubernetesGenerator.js';
import { DockerGenerator } from '../generators/dockerGenerator.js';
import { CICDGenerator } from '../generators/cicdGenerator.js';

export async function create(prompt, options) {
  const logger = new Logger();
  const aiAssistant = new AIAssistant();
  const cloudManager = new CloudManager();
  const projectAnalyzer = new ProjectAnalyzer(cloudManager);

  console.log(chalk.cyan.bold('\n🤖 AI-POWERED INFRASTRUCTURE CREATOR'));
  console.log(chalk.cyan('='.repeat(50)));

  try {
    // Get the prompt either from command line or interactive
    let userPrompt = prompt;
    if (!userPrompt && !options.ai) {
      const { inputPrompt } = await inquirer.prompt([
        {
          type: 'input',
          name: 'inputPrompt',
          message: 'What would you like to create?',
          default: 'dev and prod environments for my application'
        }
      ]);
      userPrompt = inputPrompt;
    } else if (options.ai && !userPrompt) {
      userPrompt = options.ai;
    }

    console.log(chalk.blue('\n📊 Analyzing project and requirements...'));
    
    // Analyze current project
    const spinner = ora('Analyzing project structure...').start();
    const analysis = await projectAnalyzer.analyzeProject();
    
    // Initialize cloud manager if configured
    const hasCloudConfig = process.env.GCP_PROJECT_ID && process.env.GCP_PROJECT_ID !== 'your-gcp-project-id';
    if (hasCloudConfig) {
      await cloudManager.initialize();
      analysis.cloudProvider = cloudManager.provider;
      analysis.cloudProject = process.env.GCP_PROJECT_ID;
    }
    
    spinner.succeed('Project analysis completed');

    // Interpret user intent with AI
    spinner.start('Understanding your requirements...');
    const interpretation = await interpretUserIntent(userPrompt, analysis, aiAssistant);
    spinner.succeed('Requirements analyzed');

    // Show interpretation to user
    console.log(chalk.yellow.bold('\n📝 Understanding:'));
    console.log(chalk.white(`• Intent: ${interpretation.intent}`));
    console.log(chalk.white(`• Environments: ${interpretation.environments.join(', ')}`));
    console.log(chalk.white(`• Components: ${interpretation.components.join(', ')}`));
    
    if (interpretation.specifications) {
      console.log(chalk.white('\n📋 Specifications:'));
      Object.entries(interpretation.specifications).forEach(([key, value]) => {
        console.log(chalk.gray(`  • ${key}: ${value}`));
      });
    }

    // Confirm with user
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Would you like to proceed with this configuration?',
        default: true
      }
    ]);

    if (!proceed) {
      console.log(chalk.yellow('\n❌ Creation cancelled'));
      return;
    }

    // Generate infrastructure based on interpretation
    await generateInfrastructure(interpretation, analysis, options, {
      cloudManager,
      aiAssistant,
      logger
    });

    console.log(chalk.green.bold('\n✅ Infrastructure created successfully!'));
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('1. Review the generated configurations'));
    console.log(chalk.gray('2. Customize values in terraform.tfvars or environment-specific files'));
    console.log(chalk.gray('3. Run terraform init && terraform plan to preview changes'));
    console.log(chalk.gray('4. Deploy with terraform apply or kubectl apply'));

  } catch (error) {
    logger.error(`Create command failed: ${error.message}`);
    console.error(chalk.red(`\n❌ Creation failed: ${error.message}`));
    
    if (error.message.includes('API')) {
      console.log(chalk.yellow('\n💡 Tip: Make sure your AI provider is configured:'));
      console.log(chalk.gray('   Set OPENAI_API_KEY or ANTHROPIC_API_KEY in your .env file'));
    }
  }
}

async function interpretUserIntent(prompt, analysis, aiAssistant) {
  // Build context for AI
  const context = {
    userRequest: prompt,
    projectInfo: {
      type: analysis.projectType,
      techStack: analysis.techStack,
      dependencies: analysis.dependencies,
      hasDocker: analysis.hasDocker,
      hasKubernetes: analysis.hasKubernetes,
      cloudProvider: analysis.cloudProvider || 'GCP'
    }
  };

  // Create a structured prompt for AI
  const aiPrompt = `
You are an infrastructure architect assistant. Analyze the user's request and project context to determine what infrastructure should be created.

User Request: "${prompt}"

Project Context:
- Project Type: ${context.projectInfo.type || 'Unknown'}
- Tech Stack: ${context.projectInfo.techStack?.join(', ') || 'Unknown'}
- Cloud Provider: ${context.projectInfo.cloudProvider}
- Has Docker: ${context.projectInfo.hasDocker}
- Has Kubernetes: ${context.projectInfo.hasKubernetes}

Please provide a JSON response with the following structure:
{
  "intent": "Brief description of what the user wants",
  "environments": ["dev", "staging", "prod"],
  "components": ["compute", "database", "storage", "networking", "monitoring"],
  "specifications": {
    "compute": "Instance types and scaling requirements",
    "database": "Database type and configuration",
    "storage": "Storage requirements",
    "networking": "Network configuration",
    "security": "Security requirements",
    "monitoring": "Monitoring and logging needs"
  },
  "infrastructure_type": "terraform|kubernetes|docker|mixed",
  "recommendations": ["Additional suggestions"]
}

Focus on practical, production-ready configurations appropriate for the project type.
`;

  try {
    const response = await aiAssistant.getRecommendation(aiPrompt, context);
    
    // Parse AI response
    let interpretation;
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        interpretation = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback to default interpretation
        interpretation = createDefaultInterpretation(prompt, analysis);
      }
    } catch (parseError) {
      // If parsing fails, use default interpretation
      interpretation = createDefaultInterpretation(prompt, analysis);
    }

    return interpretation;
  } catch (error) {
    // If AI fails, use rule-based interpretation
    console.log(chalk.yellow('\n⚠️  Using rule-based analysis (AI unavailable)'));
    return createDefaultInterpretation(prompt, analysis);
  }
}

function createDefaultInterpretation(prompt, analysis) {
  const lowerPrompt = prompt.toLowerCase();
  
  // Detect environments
  const environments = [];
  if (lowerPrompt.includes('dev')) environments.push('dev');
  if (lowerPrompt.includes('staging')) environments.push('staging');
  if (lowerPrompt.includes('prod')) environments.push('prod');
  if (environments.length === 0) {
    environments.push('dev', 'prod'); // Default to dev and prod
  }

  // Detect components based on keywords
  const components = [];
  if (lowerPrompt.includes('database') || lowerPrompt.includes('db')) {
    components.push('database');
  }
  if (lowerPrompt.includes('storage') || lowerPrompt.includes('bucket')) {
    components.push('storage');
  }
  if (lowerPrompt.includes('network') || lowerPrompt.includes('vpc')) {
    components.push('networking');
  }
  if (lowerPrompt.includes('monitor') || lowerPrompt.includes('logging')) {
    components.push('monitoring');
  }
  if (lowerPrompt.includes('compute') || lowerPrompt.includes('server') || lowerPrompt.includes('instance')) {
    components.push('compute');
  }
  
  // Default components if none specified
  if (components.length === 0) {
    components.push('compute', 'storage', 'networking');
    if (analysis.hasDatabase || analysis.dependencies?.some(d => d.includes('sql') || d.includes('mongo'))) {
      components.push('database');
    }
  }

  // Determine infrastructure type
  let infrastructureType = 'terraform';
  if (lowerPrompt.includes('kubernetes') || lowerPrompt.includes('k8s')) {
    infrastructureType = 'kubernetes';
  } else if (lowerPrompt.includes('docker')) {
    infrastructureType = 'docker';
  } else if (analysis.hasKubernetes) {
    infrastructureType = 'mixed';
  }

  return {
    intent: `Create ${environments.join(' and ')} environments with ${components.join(', ')}`,
    environments,
    components,
    specifications: {
      compute: environments.includes('prod') ? 'Production-grade instances with auto-scaling' : 'Cost-optimized instances',
      database: components.includes('database') ? 'Managed database service with backups' : null,
      storage: components.includes('storage') ? 'Object storage with lifecycle policies' : null,
      networking: 'VPC with public and private subnets',
      security: 'Firewall rules, IAM policies, and encryption',
      monitoring: components.includes('monitoring') ? 'Logging, metrics, and alerting' : 'Basic logging'
    },
    infrastructure_type: infrastructureType,
    recommendations: [
      'Consider adding CI/CD pipelines for automated deployment',
      'Implement infrastructure as code best practices',
      'Set up monitoring and alerting for production'
    ]
  };
}

async function generateInfrastructure(interpretation, analysis, options, services) {
  const { cloudManager, aiAssistant, logger } = services;
  
  // Determine output directory structure
  const baseOutputDir = options.output || path.join(process.cwd(), 'infrastructure');
  
  console.log(chalk.blue.bold('\n🏗️  Generating Infrastructure...'));
  console.log(chalk.gray(`Output directory: ${baseOutputDir}`));

  // Create base directory
  if (!fs.existsSync(baseOutputDir)) {
    fs.mkdirSync(baseOutputDir, { recursive: true });
  }

  // Generate based on infrastructure type
  switch (interpretation.infrastructure_type) {
  case 'terraform':
    await generateTerraformEnvironments(interpretation, analysis, baseOutputDir, services);
    break;
  case 'kubernetes':
    await generateKubernetesEnvironments(interpretation, analysis, baseOutputDir, services);
    break;
  case 'docker':
    await generateDockerEnvironments(interpretation, analysis, baseOutputDir, services);
    break;
  case 'mixed':
    await generateMixedInfrastructure(interpretation, analysis, baseOutputDir, services);
    break;
  default:
    await generateTerraformEnvironments(interpretation, analysis, baseOutputDir, services);
  }

  // Generate CI/CD if not explicitly excluded
  if (!options.noCicd && (interpretation.components.includes('cicd') || interpretation.environments.includes('prod'))) {
    console.log(chalk.yellow('\n🔄 Generating CI/CD pipelines...'));
    const cicdOutputDir = path.join(baseOutputDir, 'cicd');
    const cicdGenerator = new CICDGenerator(aiAssistant, logger, cicdOutputDir);
    await cicdGenerator.generateGitHubActions(analysis, options);
  }

  // Create README with instructions
  await createInfrastructureReadme(interpretation, baseOutputDir, analysis);
}

async function generateTerraformEnvironments(interpretation, analysis, baseOutputDir, services) {
  const { cloudManager, aiAssistant, logger } = services;
  
  for (const env of interpretation.environments) {
    console.log(chalk.blue(`\n📦 Generating Terraform for ${env} environment...`));
    
    const envDir = path.join(baseOutputDir, 'terraform', env);
    const generator = new TerraformGenerator(cloudManager, aiAssistant, logger, envDir);
    
    // Enhance analysis with environment-specific settings
    const envAnalysis = {
      ...analysis,
      environment: env,
      specifications: interpretation.specifications,
      components: interpretation.components
    };
    
    // Generate with environment-specific configurations
    await generateEnvironmentSpecificTerraform(generator, envAnalysis, env, interpretation);
  }
}

async function generateEnvironmentSpecificTerraform(generator, analysis, environment, interpretation) {
  const envConfig = getEnvironmentConfig(environment, interpretation);
  
  // Create environment-specific main.tf
  const mainTf = `# Terraform configuration for ${environment} environment
# Generated by Rig CLI AI Create

terraform {
  required_version = ">= 1.0"
  
  backend "gcs" {
    bucket = "${analysis.cloudProject}-terraform-state"
    prefix = "env/${environment}"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Environment-specific modules
${interpretation.components.includes('networking') ? `
module "networking" {
  source = "../../modules/networking"
  
  environment = "${environment}"
  project_id  = var.project_id
  region      = var.region
  
  # Environment-specific network configuration
  vpc_cidr = var.vpc_cidr
  public_subnet_cidr = var.public_subnet_cidr
  private_subnet_cidr = var.private_subnet_cidr
}` : ''}

${interpretation.components.includes('compute') ? `
module "compute" {
  source = "../../modules/compute"
  
  environment = "${environment}"
  project_id  = var.project_id
  region      = var.region
  
  # Instance configuration
  instance_type = var.instance_type
  instance_count = var.instance_count
  
  # Auto-scaling for production
  enable_autoscaling = ${environment === 'prod' ? 'true' : 'false'}
  min_instances = ${environment === 'prod' ? '2' : '1'}
  max_instances = ${environment === 'prod' ? '10' : '3'}
  
  # Network dependencies
  vpc_id = ${interpretation.components.includes('networking') ? 'module.networking.vpc_id' : 'var.vpc_id'}
  subnet_id = ${interpretation.components.includes('networking') ? 'module.networking.private_subnet_id' : 'var.subnet_id'}
}` : ''}

${interpretation.components.includes('database') ? `
module "database" {
  source = "../../modules/database"
  
  environment = "${environment}"
  project_id  = var.project_id
  region      = var.region
  
  # Database configuration
  database_type = var.database_type
  database_version = var.database_version
  tier = "${environment === 'prod' ? 'db-n1-standard-2' : 'db-f1-micro'}"
  
  # High availability for production
  availability_type = "${environment === 'prod' ? 'REGIONAL' : 'ZONAL'}"
  backup_enabled = ${environment === 'prod' ? 'true' : 'false'}
  
  # Network dependencies
  vpc_id = ${interpretation.components.includes('networking') ? 'module.networking.vpc_id' : 'var.vpc_id'}
}` : ''}

${interpretation.components.includes('storage') ? `
module "storage" {
  source = "../../modules/storage"
  
  environment = "${environment}"
  project_id  = var.project_id
  
  # Storage configuration
  bucket_name = "\${var.project_id}-${environment}-storage"
  storage_class = "${environment === 'prod' ? 'MULTI_REGIONAL' : 'REGIONAL'}"
  
  # Lifecycle policies
  lifecycle_age = ${environment === 'prod' ? '90' : '30'}
  versioning_enabled = ${environment === 'prod' ? 'true' : 'false'}
}` : ''}

${interpretation.components.includes('monitoring') ? `
module "monitoring" {
  source = "../../modules/monitoring"
  
  environment = "${environment}"
  project_id  = var.project_id
  
  # Monitoring configuration
  enable_logging = true
  enable_metrics = true
  enable_alerting = ${environment === 'prod' ? 'true' : 'false'}
  
  # Alert channels for production
  notification_emails = ${environment === 'prod' ? 'var.alert_emails' : '[]'}
}` : ''}
`;

  // Create environment-specific variables
  const variablesTf = `# Variables for ${environment} environment

variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "${analysis.cloudProject || 'your-project-id'}"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "${analysis.region || 'us-central1'}"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "${environment}"
}

${interpretation.components.includes('networking') ? `
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "${envConfig.vpc_cidr}"
}

variable "public_subnet_cidr" {
  description = "CIDR block for public subnet"
  type        = string
  default     = "${envConfig.public_subnet_cidr}"
}

variable "private_subnet_cidr" {
  description = "CIDR block for private subnet"
  type        = string
  default     = "${envConfig.private_subnet_cidr}"
}` : ''}

${interpretation.components.includes('compute') ? `
variable "instance_type" {
  description = "Instance type for compute resources"
  type        = string
  default     = "${envConfig.instance_type}"
}

variable "instance_count" {
  description = "Number of instances"
  type        = number
  default     = ${envConfig.instance_count}
}` : ''}

${interpretation.components.includes('database') ? `
variable "database_type" {
  description = "Type of database (postgres, mysql, etc.)"
  type        = string
  default     = "postgres"
}

variable "database_version" {
  description = "Database version"
  type        = string
  default     = "13"
}` : ''}

${environment === 'prod' && interpretation.components.includes('monitoring') ? `
variable "alert_emails" {
  description = "Email addresses for alerts"
  type        = list(string)
  default     = []
}` : ''}
`;

  // Create terraform.tfvars.example
  const tfvarsExample = `# ${environment.toUpperCase()} Environment Configuration
# Copy this file to terraform.tfvars and update values

project_id = "${analysis.cloudProject || 'your-project-id'}"
region     = "${analysis.region || 'us-central1'}"

${interpretation.components.includes('compute') ? `
# Compute Configuration
instance_type  = "${envConfig.instance_type}"
instance_count = ${envConfig.instance_count}` : ''}

${interpretation.components.includes('database') ? `
# Database Configuration
database_type    = "postgres"
database_version = "13"` : ''}

${environment === 'prod' && interpretation.components.includes('monitoring') ? `
# Monitoring Configuration
alert_emails = ["ops@example.com", "dev@example.com"]` : ''}
`;

  // Create outputs.tf
  const outputsTf = `# Outputs for ${environment} environment

${interpretation.components.includes('compute') ? `
output "instance_ips" {
  description = "IP addresses of compute instances"
  value       = module.compute.instance_ips
}` : ''}

${interpretation.components.includes('database') ? `
output "database_connection_name" {
  description = "Database connection name"
  value       = module.database.connection_name
  sensitive   = true
}` : ''}

${interpretation.components.includes('storage') ? `
output "storage_bucket_url" {
  description = "Storage bucket URL"
  value       = module.storage.bucket_url
}` : ''}

output "environment" {
  description = "Environment name"
  value       = var.environment
}
`;

  // Ensure directory exists and write files
  const envDir = generator.outputDir;
  if (!fs.existsSync(envDir)) {
    fs.mkdirSync(envDir, { recursive: true });
  }

  fs.writeFileSync(path.join(envDir, 'main.tf'), mainTf);
  fs.writeFileSync(path.join(envDir, 'variables.tf'), variablesTf);
  fs.writeFileSync(path.join(envDir, 'terraform.tfvars.example'), tfvarsExample);
  fs.writeFileSync(path.join(envDir, 'outputs.tf'), outputsTf);

  // Generate shared modules if this is the first environment
  if (!fs.existsSync(path.join(envDir, '../../modules'))) {
    await generateSharedModules(generator, interpretation, analysis);
  }
}

function getEnvironmentConfig(environment, interpretation) {
  const configs = {
    dev: {
      vpc_cidr: '10.0.0.0/16',
      public_subnet_cidr: '10.0.1.0/24',
      private_subnet_cidr: '10.0.2.0/24',
      instance_type: 'e2-micro',
      instance_count: 1
    },
    staging: {
      vpc_cidr: '10.1.0.0/16',
      public_subnet_cidr: '10.1.1.0/24',
      private_subnet_cidr: '10.1.2.0/24',
      instance_type: 'e2-small',
      instance_count: 2
    },
    prod: {
      vpc_cidr: '10.2.0.0/16',
      public_subnet_cidr: '10.2.1.0/24',
      private_subnet_cidr: '10.2.2.0/24',
      instance_type: 'n2-standard-2',
      instance_count: 3
    }
  };

  return configs[environment] || configs.dev;
}

async function generateSharedModules(generator, interpretation, analysis) {
  const modulesBaseDir = path.join(generator.outputDir, '../../modules');
  
  // Generate each required module
  for (const component of interpretation.components) {
    const moduleDir = path.join(modulesBaseDir, component);
    if (!fs.existsSync(moduleDir)) {
      fs.mkdirSync(moduleDir, { recursive: true });
    }

    // Generate module files based on component type
    switch (component) {
    case 'networking':
      await createNetworkingModule(moduleDir);
      break;
    case 'compute':
      await createComputeModule(moduleDir, analysis);
      break;
    case 'database':
      await createDatabaseModule(moduleDir);
      break;
    case 'storage':
      await createStorageModule(moduleDir);
      break;
    case 'monitoring':
      await createMonitoringModule(moduleDir);
      break;
    }
  }
}

async function createNetworkingModule(moduleDir) {
  const mainTf = `# Networking Module

resource "google_compute_network" "vpc" {
  name                    = "\${var.project_id}-\${var.environment}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "public" {
  name          = "\${var.project_id}-\${var.environment}-public"
  network       = google_compute_network.vpc.id
  ip_cidr_range = var.public_subnet_cidr
  region        = var.region
}

resource "google_compute_subnetwork" "private" {
  name          = "\${var.project_id}-\${var.environment}-private"
  network       = google_compute_network.vpc.id
  ip_cidr_range = var.private_subnet_cidr
  region        = var.region
  
  private_ip_google_access = true
}

resource "google_compute_firewall" "allow_internal" {
  name    = "\${var.project_id}-\${var.environment}-allow-internal"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [var.vpc_cidr]
}

resource "google_compute_firewall" "allow_http" {
  name    = "\${var.project_id}-\${var.environment}-allow-http"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["http-server", "https-server"]
}
`;

  const variablesTf = `variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
}

variable "public_subnet_cidr" {
  description = "CIDR block for public subnet"
  type        = string
}

variable "private_subnet_cidr" {
  description = "CIDR block for private subnet"
  type        = string
}
`;

  const outputsTf = `output "vpc_id" {
  value = google_compute_network.vpc.id
}

output "vpc_name" {
  value = google_compute_network.vpc.name
}

output "public_subnet_id" {
  value = google_compute_subnetwork.public.id
}

output "private_subnet_id" {
  value = google_compute_subnetwork.private.id
}
`;

  fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
  fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
  fs.writeFileSync(path.join(moduleDir, 'outputs.tf'), outputsTf);
}

async function createComputeModule(moduleDir, analysis) {
  const isWebApp = analysis.techStack?.includes('React') || analysis.techStack?.includes('Next.js') || analysis.techStack?.includes('Express');
  
  const mainTf = `# Compute Module

resource "google_compute_instance_template" "app" {
  name_prefix  = "\${var.project_id}-\${var.environment}-"
  machine_type = var.instance_type
  region       = var.region

  disk {
    source_image = "debian-cloud/debian-11"
    auto_delete  = true
    boot         = true
  }

  network_interface {
    network    = var.vpc_id
    subnetwork = var.subnet_id
    
    access_config {
      // Ephemeral public IP
    }
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    apt-get update
    apt-get install -y docker.io
    
    # Pull and run application container
    docker pull gcr.io/\${var.project_id}/app:\${var.environment}
    docker run -d -p 80:${isWebApp ? '3000' : '8080'} gcr.io/\${var.project_id}/app:\${var.environment}
  EOF

  tags = ["http-server", "https-server", var.environment]

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_instance_group_manager" "app" {
  name               = "\${var.project_id}-\${var.environment}-igm"
  base_instance_name = "\${var.project_id}-\${var.environment}-app"
  zone               = "\${var.region}-a"

  version {
    instance_template = google_compute_instance_template.app.id
  }

  target_size = var.instance_count

  named_port {
    name = "http"
    port = ${isWebApp ? '3000' : '8080'}
  }
}

# Auto-scaling for production-like environments
resource "google_compute_autoscaler" "app" {
  count = var.enable_autoscaling ? 1 : 0
  
  name   = "\${var.project_id}-\${var.environment}-autoscaler"
  zone   = "\${var.region}-a"
  target = google_compute_instance_group_manager.app.id

  autoscaling_policy {
    max_replicas    = var.max_instances
    min_replicas    = var.min_instances
    cooldown_period = 60

    cpu_utilization {
      target = 0.7
    }
  }
}

# Load Balancer
resource "google_compute_global_address" "app" {
  name = "\${var.project_id}-\${var.environment}-ip"
}

resource "google_compute_health_check" "app" {
  name               = "\${var.project_id}-\${var.environment}-health-check"
  check_interval_sec = 5
  timeout_sec        = 5

  tcp_health_check {
    port = ${isWebApp ? '3000' : '8080'}
  }
}

resource "google_compute_backend_service" "app" {
  name          = "\${var.project_id}-\${var.environment}-backend"
  health_checks = [google_compute_health_check.app.id]

  backend {
    group = google_compute_instance_group_manager.app.instance_group
  }
}

resource "google_compute_url_map" "app" {
  name            = "\${var.project_id}-\${var.environment}-urlmap"
  default_service = google_compute_backend_service.app.id
}

resource "google_compute_target_http_proxy" "app" {
  name    = "\${var.project_id}-\${var.environment}-proxy"
  url_map = google_compute_url_map.app.id
}

resource "google_compute_global_forwarding_rule" "app" {
  name       = "\${var.project_id}-\${var.environment}-forwarding-rule"
  target     = google_compute_target_http_proxy.app.id
  port_range = "80"
  ip_address = google_compute_global_address.app.address
}
`;

  const variablesTf = `variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
}

variable "instance_type" {
  description = "Instance type"
  type        = string
}

variable "instance_count" {
  description = "Number of instances"
  type        = number
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID"
  type        = string
}

variable "enable_autoscaling" {
  description = "Enable auto-scaling"
  type        = bool
  default     = false
}

variable "min_instances" {
  description = "Minimum number of instances"
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 10
}
`;

  const outputsTf = `output "instance_ips" {
  value = google_compute_global_address.app.address
}

output "load_balancer_ip" {
  value = google_compute_global_address.app.address
}

output "instance_group" {
  value = google_compute_instance_group_manager.app.instance_group
}
`;

  fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
  fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
  fs.writeFileSync(path.join(moduleDir, 'outputs.tf'), outputsTf);
}

async function createDatabaseModule(moduleDir) {
  const mainTf = `# Database Module

resource "google_sql_database_instance" "main" {
  name             = "\${var.project_id}-\${var.environment}-db"
  database_version = "\${upper(var.database_type)}_\${var.database_version}"
  region           = var.region

  settings {
    tier              = var.tier
    availability_type = var.availability_type

    backup_configuration {
      enabled                        = var.backup_enabled
      start_time                     = "03:00"
      point_in_time_recovery_enabled = var.availability_type == "REGIONAL" ? true : false
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_id
    }

    database_flags {
      name  = "max_connections"
      value = var.environment == "prod" ? "100" : "50"
    }
  }

  deletion_protection = var.environment == "prod" ? true : false
}

resource "google_sql_database" "database" {
  name     = var.database_name
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "users" {
  name     = var.database_user
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

resource "random_password" "db_password" {
  length  = 16
  special = true
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "\${var.project_id}-\${var.environment}-db-password"

  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret = google_secret_manager_secret.db_password.id

  secret_data = random_password.db_password.result
}
`;

  const variablesTf = `variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
}

variable "database_type" {
  description = "Database type (postgres, mysql)"
  type        = string
  default     = "postgres"
}

variable "database_version" {
  description = "Database version"
  type        = string
  default     = "13"
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "app"
}

variable "database_user" {
  description = "Database user"
  type        = string
  default     = "appuser"
}

variable "tier" {
  description = "Database tier"
  type        = string
  default     = "db-f1-micro"
}

variable "availability_type" {
  description = "Availability type (ZONAL or REGIONAL)"
  type        = string
  default     = "ZONAL"
}

variable "backup_enabled" {
  description = "Enable backups"
  type        = bool
  default     = false
}

variable "vpc_id" {
  description = "VPC ID for private IP"
  type        = string
}
`;

  const outputsTf = `output "connection_name" {
  value     = google_sql_database_instance.main.connection_name
  sensitive = true
}

output "database_ip" {
  value = google_sql_database_instance.main.private_ip_address
}

output "database_name" {
  value = google_sql_database.database.name
}

output "database_user" {
  value = google_sql_user.users.name
}

output "password_secret_id" {
  value = google_secret_manager_secret.db_password.secret_id
}
`;

  fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
  fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
  fs.writeFileSync(path.join(moduleDir, 'outputs.tf'), outputsTf);
}

async function createStorageModule(moduleDir) {
  const mainTf = `# Storage Module

resource "google_storage_bucket" "main" {
  name          = var.bucket_name
  location      = var.storage_class == "MULTI_REGIONAL" ? "US" : var.region
  storage_class = var.storage_class

  versioning {
    enabled = var.versioning_enabled
  }

  lifecycle_rule {
    condition {
      age = var.lifecycle_age
    }
    action {
      type = "Delete"
    }
  }

  lifecycle_rule {
    condition {
      age = 7
      with_state = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  uniform_bucket_level_access = true
}

# IAM for application access
resource "google_storage_bucket_iam_member" "app_access" {
  bucket = google_storage_bucket.main.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:\${var.project_id}@appspot.gserviceaccount.com"
}
`;

  const variablesTf = `variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "bucket_name" {
  description = "Storage bucket name"
  type        = string
}

variable "storage_class" {
  description = "Storage class"
  type        = string
  default     = "REGIONAL"
}

variable "lifecycle_age" {
  description = "Days before deletion"
  type        = number
  default     = 30
}

variable "versioning_enabled" {
  description = "Enable versioning"
  type        = bool
  default     = false
}
`;

  const outputsTf = `output "bucket_name" {
  value = google_storage_bucket.main.name
}

output "bucket_url" {
  value = google_storage_bucket.main.url
}

output "bucket_self_link" {
  value = google_storage_bucket.main.self_link
}
`;

  fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
  fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
  fs.writeFileSync(path.join(moduleDir, 'outputs.tf'), outputsTf);
}

async function createMonitoringModule(moduleDir) {
  const mainTf = `# Monitoring Module

# Log sink for centralized logging
resource "google_logging_project_sink" "main" {
  name        = "\${var.project_id}-\${var.environment}-sink"
  destination = "storage.googleapis.com/\${google_storage_bucket.logs.name}"
  
  filter = var.environment == "prod" ? "" : "severity >= WARNING"

  unique_writer_identity = true
}

resource "google_storage_bucket" "logs" {
  name          = "\${var.project_id}-\${var.environment}-logs"
  location      = "US"
  storage_class = "NEARLINE"

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
}

# Monitoring alerts for production
resource "google_monitoring_alert_policy" "high_cpu" {
  count = var.enable_alerting ? 1 : 0

  display_name = "\${var.project_id}-\${var.environment}-high-cpu"
  combiner     = "OR"

  conditions {
    display_name = "CPU usage above 80%"

    condition_threshold {
      filter          = "metric.type=\\"compute.googleapis.com/instance/cpu/utilization\\" resource.type=\\"gce_instance\\""
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.notification_channels
}

resource "google_monitoring_alert_policy" "high_memory" {
  count = var.enable_alerting ? 1 : 0

  display_name = "\${var.project_id}-\${var.environment}-high-memory"
  combiner     = "OR"

  conditions {
    display_name = "Memory usage above 90%"

    condition_threshold {
      filter          = "metric.type=\\"agent.googleapis.com/memory/percent_used\\" resource.type=\\"gce_instance\\""
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 90

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.notification_channels
}

# Dashboard
resource "google_monitoring_dashboard" "main" {
  dashboard_json = jsonencode({
    displayName = "\${var.project_id}-\${var.environment}-dashboard"
    
    gridLayout = {
      widgets = [
        {
          title = "CPU Utilization"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\\"compute.googleapis.com/instance/cpu/utilization\\" resource.type=\\"gce_instance\\""
                }
              }
            }]
          }
        },
        {
          title = "Memory Usage"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\\"agent.googleapis.com/memory/percent_used\\" resource.type=\\"gce_instance\\""
                }
              }
            }]
          }
        }
      ]
    }
  })
}
`;

  const variablesTf = `variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "enable_logging" {
  description = "Enable logging"
  type        = bool
  default     = true
}

variable "enable_metrics" {
  description = "Enable metrics"
  type        = bool
  default     = true
}

variable "enable_alerting" {
  description = "Enable alerting"
  type        = bool
  default     = false
}

variable "notification_channels" {
  description = "Notification channel IDs"
  type        = list(string)
  default     = []
}

variable "notification_emails" {
  description = "Email addresses for notifications"
  type        = list(string)
  default     = []
}
`;

  const outputsTf = `output "log_sink_name" {
  value = google_logging_project_sink.main.name
}

output "log_bucket_name" {
  value = google_storage_bucket.logs.name
}

output "dashboard_id" {
  value = google_monitoring_dashboard.main.id
}
`;

  fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
  fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
  fs.writeFileSync(path.join(moduleDir, 'outputs.tf'), outputsTf);
}

async function generateKubernetesEnvironments(interpretation, analysis, baseOutputDir, services) {
  const { cloudManager, aiAssistant, logger } = services;
  
  const k8sDir = path.join(baseOutputDir, 'kubernetes');
  const generator = new KubernetesGenerator(cloudManager, aiAssistant, logger, k8sDir);
  
  // Enhanced analysis for Kubernetes
  const k8sAnalysis = {
    ...analysis,
    environments: interpretation.environments,
    components: interpretation.components,
    specifications: interpretation.specifications
  };
  
  await generator.generateComplete(k8sAnalysis, {});
}

async function generateDockerEnvironments(interpretation, analysis, baseOutputDir, services) {
  const { aiAssistant, logger } = services;
  
  const dockerDir = path.join(baseOutputDir, 'docker');
  const generator = new DockerGenerator(aiAssistant, logger, dockerDir);
  
  await generator.generateConfigurations(analysis, {});
}

async function generateMixedInfrastructure(interpretation, analysis, baseOutputDir, services) {
  // Generate both Terraform for cloud infrastructure and Kubernetes for application deployment
  await generateTerraformEnvironments(interpretation, analysis, baseOutputDir, services);
  await generateKubernetesEnvironments(interpretation, analysis, baseOutputDir, services);
  await generateDockerEnvironments(interpretation, analysis, baseOutputDir, services);
}

async function createInfrastructureReadme(interpretation, baseOutputDir, analysis) {
  const readme = `# Infrastructure Configuration
Generated by Rig CLI AI Create

## Overview
${interpretation.intent}

### Environments
${interpretation.environments.map(env => `- ${env}`).join('\n')}

### Components
${interpretation.components.map(comp => `- ${comp}`).join('\n')}

## Project Information
- **Type**: ${analysis.projectType || 'Unknown'}
- **Tech Stack**: ${analysis.techStack?.join(', ') || 'Unknown'}
- **Cloud Provider**: ${analysis.cloudProvider || 'GCP'}

## Directory Structure
\`\`\`
${baseOutputDir}/
${interpretation.infrastructure_type === 'terraform' || interpretation.infrastructure_type === 'mixed' ? `├── terraform/
${interpretation.environments.map(env => `│   ├── ${env}/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── terraform.tfvars.example`).join('\n')}
│   └── modules/
${interpretation.components.map(comp => `│       ├── ${comp}/`).join('\n')}` : ''}
${interpretation.infrastructure_type === 'kubernetes' || interpretation.infrastructure_type === 'mixed' ? `├── kubernetes/
│   ├── base/
│   └── overlays/
${interpretation.environments.map(env => `│       ├── ${env}/`).join('\n')}` : ''}
${interpretation.infrastructure_type === 'docker' || interpretation.infrastructure_type === 'mixed' ? `├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml` : ''}
└── cicd/
    └── .github/workflows/
\`\`\`

## Getting Started

### Prerequisites
- Terraform >= 1.0 (if using Terraform)
- kubectl (if using Kubernetes)
- Docker (if using containers)
- GCloud CLI configured with appropriate permissions

### Deployment Steps

${interpretation.infrastructure_type === 'terraform' || interpretation.infrastructure_type === 'mixed' ? `#### Terraform Deployment
1. Navigate to the environment directory:
   \`\`\`bash
   cd terraform/dev  # or staging/prod
   \`\`\`

2. Copy and customize the terraform.tfvars:
   \`\`\`bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your values
   \`\`\`

3. Initialize Terraform:
   \`\`\`bash
   terraform init
   \`\`\`

4. Review the plan:
   \`\`\`bash
   terraform plan
   \`\`\`

5. Apply the configuration:
   \`\`\`bash
   terraform apply
   \`\`\`
` : ''}

${interpretation.infrastructure_type === 'kubernetes' || interpretation.infrastructure_type === 'mixed' ? `#### Kubernetes Deployment
1. Apply the base configuration:
   \`\`\`bash
   kubectl apply -k kubernetes/base
   \`\`\`

2. Apply environment-specific overlays:
   \`\`\`bash
   kubectl apply -k kubernetes/overlays/dev  # or staging/prod
   \`\`\`
` : ''}

${interpretation.infrastructure_type === 'docker' || interpretation.infrastructure_type === 'mixed' ? `#### Docker Deployment
1. Build the Docker image:
   \`\`\`bash
   docker build -t myapp:latest docker/
   \`\`\`

2. Run with docker-compose:
   \`\`\`bash
   docker-compose -f docker/docker-compose.yml up -d
   \`\`\`
` : ''}

## Environment Configuration

${interpretation.environments.map(env => `### ${env.charAt(0).toUpperCase() + env.slice(1)} Environment
- **Purpose**: ${env === 'prod' ? 'Production workloads' : env === 'staging' ? 'Pre-production testing' : 'Development and testing'}
- **Scaling**: ${env === 'prod' ? 'Auto-scaling enabled' : 'Manual scaling'}
- **Backup**: ${env === 'prod' ? 'Automated backups enabled' : 'Manual backups'}
- **Monitoring**: ${env === 'prod' ? 'Full monitoring and alerting' : 'Basic monitoring'}
`).join('\n')}

## Security Considerations
- All environments use private subnets for compute resources
- Databases are not publicly accessible
- Secrets are managed through Secret Manager
- Firewall rules restrict access to necessary ports only
- ${interpretation.environments.includes('prod') ? 'Production uses encrypted storage and backups' : 'Non-production uses standard security settings'}

## Cost Optimization
- Development uses minimal resources
- Staging mimics production but with reduced redundancy
- Production uses auto-scaling to optimize costs
- Storage lifecycle policies automatically clean up old data

## Monitoring and Alerts
${interpretation.components.includes('monitoring') ? `- Centralized logging to Cloud Storage
- Metrics dashboards for all environments
- Production alerts for high CPU and memory usage
- Custom alerts can be configured in the monitoring module` : `- Basic logging enabled
- Consider adding monitoring module for production environments`}

## CI/CD Integration
The generated GitHub Actions workflows provide:
- Automated testing on pull requests
- Security scanning
- Deployment to respective environments
- Manual approval for production deployments

## Recommendations
${interpretation.recommendations.map(rec => `- ${rec}`).join('\n')}

## Support
For issues or questions:
- Review the generated configurations
- Check the Rig CLI documentation
- Run \`rig troubleshoot\` for common issues

---
Generated with Rig CLI - AI-Powered Infrastructure Creator
`;

  fs.writeFileSync(path.join(baseOutputDir, 'README.md'), readme);
}