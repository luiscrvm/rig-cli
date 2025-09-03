import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

export class TerraformGenerator {
  constructor(cloudManager, aiAssistant, logger, outputDir = null) {
    this.cloudManager = cloudManager;
    this.aiAssistant = aiAssistant;
    this.logger = logger;
    this.outputDir = outputDir || path.join(process.cwd(), 'terraform');
  }

  async generateComplete(analysis, options) {
    const spinner = ora('Generating complete Terraform configuration...').start();
    
    try {
      // Create output directory
      this.ensureDirectoryExists(this.outputDir);
      
      // Generate main configuration files
      await this.generateMainFiles(analysis, options);
      
      // Generate modules based on existing infrastructure
      if (analysis?.infrastructure?.resources) {
        await this.generateFromInfrastructure(analysis.infrastructure.resources, options);
      }
      
      // Generate variables and outputs
      await this.generateVariables(analysis);
      await this.generateOutputs(analysis);
      
      // Generate terraform.tfvars.example
      await this.generateTfvarsExample(analysis);
      
      // Generate README
      await this.generateReadme(analysis);
      
      spinner.succeed('Terraform configuration generated successfully');
      
      console.log(chalk.green('\n✅ Generated Terraform files:'));
      console.log(chalk.gray(`📁 ${this.outputDir}/`));
      console.log(chalk.gray('├── main.tf'));
      console.log(chalk.gray('├── variables.tf'));
      console.log(chalk.gray('├── outputs.tf'));
      console.log(chalk.gray('├── versions.tf'));
      console.log(chalk.gray('├── terraform.tfvars.example'));
      console.log(chalk.gray('├── README.md'));
      console.log(chalk.gray('└── modules/'));
      
      if (options.import) {
        console.log(chalk.yellow('\n💡 Don\'t forget to run terraform import commands for existing resources!'));
        console.log(chalk.gray('Check the generated README.md for import statements.'));
      }
      
    } catch (error) {
      spinner.fail('Terraform generation failed');
      throw error;
    }
  }

  async generateModule(moduleName, analysis, options) {
    const moduleDir = path.join(this.outputDir, 'modules', moduleName);
    this.ensureDirectoryExists(moduleDir);
    
    const spinner = ora(`Generating ${moduleName} module...`).start();
    
    try {
      switch (moduleName) {
      case 'vpc':
      case 'network':
        await this.generateVPCModule(moduleDir, analysis);
        break;
      case 'compute':
      case 'instances':
        await this.generateComputeModule(moduleDir, analysis);
        break;
      case 'database':
      case 'sql':
        await this.generateDatabaseModule(moduleDir, analysis);
        break;
      case 'storage':
        await this.generateStorageModule(moduleDir, analysis);
        break;
      case 'iam':
        await this.generateIAMModule(moduleDir, analysis);
        break;
      default:
        throw new Error(`Unknown module type: ${moduleName}`);
      }
      
      spinner.succeed(`${moduleName} module generated successfully`);
      console.log(chalk.green(`✅ Module generated at: ${moduleDir}`));
      
    } catch (error) {
      spinner.fail(`${moduleName} module generation failed`);
      throw error;
    }
  }

  async generateFromInfrastructure(resources, options) {
    const modulesDir = path.join(this.outputDir, 'modules');
    this.ensureDirectoryExists(modulesDir);
    
    for (const resourceGroup of resources) {
      if (resourceGroup.items && resourceGroup.items.length > 0) {
        const moduleDir = path.join(modulesDir, resourceGroup.type);
        this.ensureDirectoryExists(moduleDir);
        
        switch (resourceGroup.type) {
        case 'instances':
          await this.generateComputeModuleFromResources(moduleDir, resourceGroup.items, options);
          break;
        case 'storage':
          await this.generateStorageModuleFromResources(moduleDir, resourceGroup.items, options);
          break;
        case 'databases':
          await this.generateDatabaseModuleFromResources(moduleDir, resourceGroup.items, options);
          break;
        case 'networks':
          await this.generateVPCModuleFromResources(moduleDir, resourceGroup.items, options);
          break;
        }
      }
    }
  }

  async generateMainFiles(analysis, options) {
    // Generate main.tf
    const mainTf = this.generateMainTf(analysis);
    fs.writeFileSync(path.join(this.outputDir, 'main.tf'), mainTf);
    
    // Generate versions.tf
    const versionsTf = this.generateVersionsTf();
    fs.writeFileSync(path.join(this.outputDir, 'versions.tf'), versionsTf);
  }

  generateMainTf(analysis) {
    const provider = analysis?.infrastructure?.provider?.toLowerCase() || 'google';
    const projectId = analysis?.cloud?.projectId || 'your-gcp-project-id';
    const region = analysis?.cloud?.region || 'us-central1';
    const projectName = this.getProjectName(analysis);
    
    return `# Main Terraform configuration for ${projectName}
# Generated by Rig CLI
# Project: ${projectId}
# Region: ${region}

terraform {
  required_version = ">= 1.0"
  
  backend "gcs" {
    bucket = var.terraform_state_bucket
    prefix = "terraform/state"
  }
}

provider "${provider}" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Local values for common tags and naming
locals {
  common_tags = {
    Environment   = var.environment
    Project       = var.project_name
    ManagedBy     = "terraform"
    GeneratedBy   = "rig-cli"
    CreatedDate   = formatdate("YYYY-MM-DD", timestamp())
  }
  
  name_prefix = "\${var.project_name}-\${var.environment}"
}

# Data sources
data "google_client_config" "default" {}

data "google_project" "project" {
  project_id = var.project_id
}

# Module calls will be added here based on your infrastructure
${this.generateModuleCalls(analysis)}`;
  }

  generateModuleCalls(analysis) {
    if (!analysis?.infrastructure?.resources) {
      return '# Add module calls here for your infrastructure components';
    }
    
    let moduleCalls = '';
    
    for (const resourceGroup of analysis.infrastructure.resources) {
      if (resourceGroup.items && resourceGroup.items.length > 0) {
        switch (resourceGroup.type) {
        case 'networks':
          moduleCalls += `
# VPC/Network module
module "network" {
  source = "./modules/networks"
  
  project_id   = var.project_id
  region       = var.region
  name_prefix  = local.name_prefix
  common_tags  = local.common_tags
}
`;
          break;
        case 'instances':
          moduleCalls += `
# Compute instances module
module "compute" {
  source = "./modules/instances"
  
  project_id         = var.project_id
  region             = var.region
  zone               = var.zone
  name_prefix        = local.name_prefix
  network_name       = module.network.network_name
  subnetwork_name    = module.network.subnet_names[0]
  instance_count     = var.instance_count
  machine_type       = var.machine_type
  common_tags        = local.common_tags
  
  depends_on = [module.network]
}
`;
          break;
        case 'storage':
          moduleCalls += `
# Storage buckets module
module "storage" {
  source = "./modules/storage"
  
  project_id   = var.project_id
  region       = var.region
  name_prefix  = local.name_prefix
  common_tags  = local.common_tags
}
`;
          break;
        }
      }
    }
    
    return moduleCalls || '# No existing infrastructure found to generate modules';
  }

  generateVersionsTf() {
    return `# Terraform and provider version constraints
# Generated by Rig CLI

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}`;
  }

  async generateVariables(analysis) {
    const variablesTf = `# Variable definitions
# Generated by Rig CLI

variable "project_id" {
  description = "The GCP project ID"
  type        = string
  default     = "${analysis?.cloud?.projectId || 'your-gcp-project-id'}"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "${this.getProjectName(analysis)}"
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "${analysis?.cloud?.region || 'us-central1'}"
}

variable "zone" {
  description = "The GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "terraform_state_bucket" {
  description = "GCS bucket for Terraform state"
  type        = string
}

${this.generateInfrastructureVariables(analysis)}`;

    fs.writeFileSync(path.join(this.outputDir, 'variables.tf'), variablesTf);
  }

  generateInfrastructureVariables(analysis) {
    if (!analysis?.infrastructure?.resources) {
      return '';
    }

    let variables = '';
    
    for (const resourceGroup of analysis.infrastructure.resources) {
      if (resourceGroup.items && resourceGroup.items.length > 0) {
        switch (resourceGroup.type) {
        case 'instances':
          variables += `
# Compute variables
variable "machine_type" {
  description = "Machine type for compute instances"
  type        = string
  default     = "e2-medium"
}

variable "instance_count" {
  description = "Number of compute instances"
  type        = number
  default     = ${resourceGroup.items.length}

  validation {
    condition     = var.instance_count >= 0 && var.instance_count <= 100
    error_message = "Instance count must be between 0 and 100."
  }
}
`;
          break;
        }
      }
    }
    
    return variables;
  }

  async generateOutputs(analysis) {
    const outputsTf = `# Output values
# Generated by Rig CLI

output "project_id" {
  description = "The GCP project ID"
  value       = var.project_id
}

output "region" {
  description = "The GCP region"
  value       = var.region
}

${this.generateInfrastructureOutputs(analysis)}`;

    fs.writeFileSync(path.join(this.outputDir, 'outputs.tf'), outputsTf);
  }

  generateInfrastructureOutputs(analysis) {
    if (!analysis?.infrastructure?.resources) {
      return '';
    }

    let outputs = '';
    
    for (const resourceGroup of analysis.infrastructure.resources) {
      if (resourceGroup.items && resourceGroup.items.length > 0) {
        switch (resourceGroup.type) {
        case 'networks':
          outputs += `
# Network outputs
output "network_name" {
  description = "Name of the VPC network"
  value       = module.network.network_name
}

output "network_self_link" {
  description = "Self link of the VPC network"
  value       = module.network.network_self_link
}
`;
          break;
        case 'instances':
          outputs += `
# Compute outputs
output "instance_names" {
  description = "Names of the compute instances"
  value       = module.compute.instance_names
}

output "instance_ips" {
  description = "IP addresses of the compute instances"
  value       = module.compute.instance_ips
}
`;
          break;
        }
      }
    }
    
    return outputs;
  }

  async generateTfvarsExample(analysis) {
    const tfvarsExample = `# Example terraform.tfvars file
# Copy this to terraform.tfvars and fill in your values
# Generated by Rig CLI

# Required variables
project_id              = "${analysis?.cloud?.projectId || 'your-gcp-project-id'}"
terraform_state_bucket  = "${analysis?.cloud?.projectId || 'your-gcp-project'}-terraform-state"

# Optional variables
project_name = "${this.getProjectName(analysis)}"
environment  = "dev"
region      = "${analysis?.cloud?.region || 'us-central1'}"
zone        = "${analysis?.cloud?.region || 'us-central1'}-a"

${this.generateInfrastructureTfvars(analysis)}`;

    fs.writeFileSync(path.join(this.outputDir, 'terraform.tfvars.example'), tfvarsExample);
  }

  generateInfrastructureTfvars(analysis) {
    let tfvars = '';
    
    if (analysis?.infrastructure?.resources) {
      tfvars += '\n# Infrastructure-specific variables\n';
      
      for (const resourceGroup of analysis.infrastructure.resources) {
        if (resourceGroup.items && resourceGroup.items.length > 0) {
          switch (resourceGroup.type) {
          case 'instances':
            tfvars += `machine_type = "e2-medium"\ninstance_count = ${resourceGroup.items.length}\n`;
            break;
          }
        }
      }
    }
    
    return tfvars;
  }

  async generateReadme(analysis) {
    const readme = `# Terraform Infrastructure

This Terraform configuration was generated by Rig CLI and manages your GCP infrastructure.

## Project Information

- **Project Name**: ${this.getProjectName(analysis)}
- **Technology Stack**: ${analysis?.techStack?.join(', ') || 'Unknown'}
- **Generated**: ${new Date().toISOString()}

## Prerequisites

1. Install [Terraform](https://www.terraform.io/downloads.html) >= 1.0
2. Install and configure [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
3. Authenticate with GCP: \`gcloud auth application-default login\`

## Quick Start

1. Copy the example variables file:
   \`\`\`bash
   cp terraform.tfvars.example terraform.tfvars
   \`\`\`

2. Edit \`terraform.tfvars\` with your values

3. Initialize Terraform:
   \`\`\`bash
   terraform init
   \`\`\`

4. Plan the changes:
   \`\`\`bash
   terraform plan
   \`\`\`

5. Apply the configuration:
   \`\`\`bash
   terraform apply
   \`\`\`

## Modules

This configuration uses the following modules:

${this.generateModuleDocumentation(analysis)}

## State Management

This configuration uses Google Cloud Storage for remote state management. Make sure to:

1. Create a GCS bucket for Terraform state
2. Update the bucket name in \`main.tf\`
3. Enable versioning on the bucket

${this.generateImportCommands(analysis)}

## Generated by Rig CLI

This infrastructure configuration was automatically generated by Rig CLI.
- Run \`rig generate terraform\` to regenerate
- Run \`rig security --scan\` to check for security issues
- Run \`rig cost --analyze\` to analyze costs
`;

    fs.writeFileSync(path.join(this.outputDir, 'README.md'), readme);
  }

  generateModuleDocumentation(analysis) {
    if (!analysis?.infrastructure?.resources) {
      return '- No modules generated (no existing infrastructure found)';
    }

    let docs = '';
    for (const resourceGroup of analysis.infrastructure.resources) {
      if (resourceGroup.items && resourceGroup.items.length > 0) {
        docs += `- **${resourceGroup.type}**: Manages ${resourceGroup.items.length} ${resourceGroup.type}\n`;
      }
    }
    return docs || '- No modules documented';
  }

  generateImportCommands(analysis) {
    if (!analysis?.infrastructure?.resources) {
      return '';
    }

    let importSection = '\n## Import Existing Resources\n\n';
    importSection += 'If you have existing resources, import them with these commands:\n\n```bash\n';
    
    for (const resourceGroup of analysis.infrastructure.resources) {
      if (resourceGroup.items && resourceGroup.items.length > 0) {
        resourceGroup.items.forEach((item, index) => {
          switch (resourceGroup.type) {
          case 'instances':
            importSection += `terraform import module.compute.google_compute_instance.instances[${index}] ${item.name}\n`;
            break;
          case 'storage':
            importSection += `terraform import module.storage.google_storage_bucket.buckets[${index}] ${item.name}\n`;
            break;
          }
        });
      }
    }
    
    importSection += '```\n';
    return importSection;
  }

  // Module generation methods
  async generateVPCModuleFromResources(moduleDir, networks, options) {
    const mainTf = `# VPC/Network module
# Generated by Rig CLI

resource "google_compute_network" "networks" {
  count                   = length(var.network_names)
  name                    = var.network_names[count.index]
  auto_create_subnetworks = false
  routing_mode           = "REGIONAL"
}

resource "google_compute_subnetwork" "subnets" {
  count         = length(var.network_names)
  name          = "\${var.network_names[count.index]}-subnet"
  ip_cidr_range = var.subnet_cidrs[count.index]
  region        = var.region
  network       = google_compute_network.networks[count.index].id
}

resource "google_compute_firewall" "allow_internal" {
  count   = length(var.network_names)
  name    = "\${var.network_names[count.index]}-allow-internal"
  network = google_compute_network.networks[count.index].name

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

  source_ranges = [var.subnet_cidrs[count.index]]
}`;

    const variablesTf = `variable "network_names" {
  description = "Names of the VPC networks"
  type        = list(string)
  default     = [${networks.map(n => `"${n.name}"`).join(', ')}]
}

variable "subnet_cidrs" {
  description = "CIDR blocks for subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "region" {
  description = "GCP region"
  type        = string
}`;

    const outputsTf = `output "network_names" {
  description = "Names of the created networks"
  value       = google_compute_network.networks[*].name
}

output "network_self_links" {
  description = "Self links of the created networks"
  value       = google_compute_network.networks[*].self_link
}

output "subnet_names" {
  description = "Names of the created subnets"
  value       = google_compute_subnetwork.subnets[*].name
}`;

    fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
    fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
    fs.writeFileSync(path.join(moduleDir, 'outputs.tf'), outputsTf);
  }

  async generateStorageModuleFromResources(moduleDir, items, options) {
    // Generate Terraform module for existing storage resources
    const mainTf = `# Storage module generated from existing resources
resource "google_storage_bucket" "bucket" {
  count    = length(var.bucket_names)
  name     = var.bucket_names[count.index]
  location = var.region
  
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
  
  versioning {
    enabled = true
  }
}`;
    
    fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
    
    const variablesTf = `variable "bucket_names" {
  description = "List of bucket names"
  type        = list(string)
  default     = ${JSON.stringify(items.map(item => item.name || 'bucket'), null, 2)}
}

variable "region" {
  description = "GCP region"
  type        = string
}`;
    
    fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
  }

  async generateComputeModule(moduleDir, analysis) {
    const mainTf = `# Compute instances module
# Generated by Rig CLI

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

resource "google_compute_instance_template" "main" {
  name_prefix    = "\${var.name_prefix}-template-"
  machine_type   = var.machine_type
  region         = var.region

  disk {
    source_image = var.source_image
    auto_delete  = true
    boot         = true
    disk_type    = var.disk_type
    disk_size_gb = var.disk_size_gb
  }

  network_interface {
    network    = var.network_name
    subnetwork = var.subnetwork_name
    
    access_config {
      // Ephemeral IP
    }
  }

  service_account {
    email  = var.service_account_email
    scopes = var.service_account_scopes
  }

  metadata = merge(var.metadata, {
    enable-oslogin = "TRUE"
  })

  tags = var.tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_instance_group_manager" "main" {
  name               = "\${var.name_prefix}-igm"
  zone               = var.zone
  base_instance_name = var.name_prefix

  version {
    instance_template = google_compute_instance_template.main.id
  }

  target_size = var.instance_count

  named_port {
    name = "http"
    port = var.http_port
  }

  auto_healing_policies {
    health_check      = google_compute_health_check.main.id
    initial_delay_sec = var.health_check_delay
  }
}

resource "google_compute_health_check" "main" {
  name               = "\${var.name_prefix}-health-check"
  check_interval_sec = 5
  timeout_sec        = 5

  tcp_health_check {
    port = var.http_port
  }
}

# Individual instances for when you need them
resource "google_compute_instance" "instances" {
  count        = var.create_individual_instances ? var.instance_count : 0
  name         = "\${var.name_prefix}-\${count.index + 1}"
  machine_type = var.machine_type
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = var.source_image
      type  = var.disk_type
      size  = var.disk_size_gb
    }
  }

  network_interface {
    network    = var.network_name
    subnetwork = var.subnetwork_name
    
    access_config {
      // Ephemeral IP
    }
  }

  service_account {
    email  = var.service_account_email
    scopes = var.service_account_scopes
  }

  metadata = merge(var.metadata, {
    enable-oslogin = "TRUE"
  })

  tags = var.tags
}`;

    const variablesTf = `# Variables for compute module
# Generated by Rig CLI

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "zone" {
  description = "GCP zone"
  type        = string
}

variable "network_name" {
  description = "Name of the VPC network"
  type        = string
}

variable "subnetwork_name" {
  description = "Name of the subnetwork"
  type        = string
  default     = ""
}

variable "machine_type" {
  description = "Machine type for instances"
  type        = string
  default     = "e2-medium"
}

variable "instance_count" {
  description = "Number of instances"
  type        = number
  default     = 1

  validation {
    condition     = var.instance_count >= 0 && var.instance_count <= 100
    error_message = "Instance count must be between 0 and 100."
  }
}

variable "source_image" {
  description = "Source image for instances"
  type        = string
  default     = "projects/ubuntu-os-cloud/global/images/family/ubuntu-2004-lts"
}

variable "disk_type" {
  description = "Type of persistent disk"
  type        = string
  default     = "pd-standard"

  validation {
    condition     = contains(["pd-standard", "pd-ssd", "pd-balanced"], var.disk_type)
    error_message = "Disk type must be pd-standard, pd-ssd, or pd-balanced."
  }
}

variable "disk_size_gb" {
  description = "Size of persistent disk in GB"
  type        = number
  default     = 20

  validation {
    condition     = var.disk_size_gb >= 10 && var.disk_size_gb <= 1000
    error_message = "Disk size must be between 10 and 1000 GB."
  }
}

variable "service_account_email" {
  description = "Service account email for instances"
  type        = string
  default     = ""
}

variable "service_account_scopes" {
  description = "Service account scopes for instances"
  type        = list(string)
  default     = [
    "https://www.googleapis.com/auth/cloud-platform"
  ]
}

variable "metadata" {
  description = "Metadata for instances"
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Network tags for instances"
  type        = list(string)
  default     = ["web", "http-server"]
}

variable "http_port" {
  description = "HTTP port for health checks"
  type        = number
  default     = 80
}

variable "health_check_delay" {
  description = "Initial delay for health checks (seconds)"
  type        = number
  default     = 300
}

variable "create_individual_instances" {
  description = "Create individual instances instead of managed instance group"
  type        = bool
  default     = false
}

variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}`;

    const outputsTf = `# Outputs for compute module
# Generated by Rig CLI

output "instance_template_id" {
  description = "ID of the instance template"
  value       = google_compute_instance_template.main.id
}

output "instance_group_manager_id" {
  description = "ID of the instance group manager"
  value       = google_compute_instance_group_manager.main.id
}

output "health_check_id" {
  description = "ID of the health check"
  value       = google_compute_health_check.main.id
}

output "instance_names" {
  description = "Names of individual instances"
  value       = google_compute_instance.instances[*].name
}

output "instance_ips" {
  description = "External IP addresses of individual instances"
  value       = google_compute_instance.instances[*].network_interface.0.access_config.0.nat_ip
}

output "instance_internal_ips" {
  description = "Internal IP addresses of individual instances"
  value       = google_compute_instance.instances[*].network_interface.0.network_ip
}

output "instance_self_links" {
  description = "Self links of individual instances"
  value       = google_compute_instance.instances[*].self_link
}`;

    fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
    fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
    fs.writeFileSync(path.join(moduleDir, 'outputs.tf'), outputsTf);
  }

  async generateComputeModuleFromResources(moduleDir, items, options) {
    const mainTf = `# Compute instances module from existing resources
# Generated by Rig CLI

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

resource "google_compute_instance" "instances" {
  count        = length(var.instance_names)
  name         = var.instance_names[count.index]
  machine_type = var.machine_type
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = var.source_image
      type  = var.disk_type
      size  = var.disk_size_gb
    }
  }

  network_interface {
    network    = var.network_name
    subnetwork = var.subnetwork_name
    
    access_config {
      // Ephemeral IP
    }
  }

  service_account {
    email  = var.service_account_email
    scopes = var.service_account_scopes
  }

  metadata = merge(var.metadata, {
    enable-oslogin = "TRUE"
  })

  tags = var.tags

  labels = var.common_tags
}`;

    const variablesTf = `# Variables for compute module from existing resources
# Generated by Rig CLI

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "instance_names" {
  description = "Names of the instances"
  type        = list(string)
  default     = [${items.map(item => `"${item.name || 'instance'}"`).join(', ')}]
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "zone" {
  description = "GCP zone"
  type        = string
}

variable "network_name" {
  description = "Name of the VPC network"
  type        = string
}

variable "subnetwork_name" {
  description = "Name of the subnetwork"
  type        = string
  default     = ""
}

variable "machine_type" {
  description = "Machine type for instances"
  type        = string
  default     = "${items[0]?.machineType || 'e2-medium'}"
}

variable "source_image" {
  description = "Source image for instances"
  type        = string
  default     = "projects/ubuntu-os-cloud/global/images/family/ubuntu-2004-lts"
}

variable "disk_type" {
  description = "Type of persistent disk"
  type        = string
  default     = "pd-standard"
}

variable "disk_size_gb" {
  description = "Size of persistent disk in GB"
  type        = number
  default     = 20
}

variable "service_account_email" {
  description = "Service account email for instances"
  type        = string
  default     = ""
}

variable "service_account_scopes" {
  description = "Service account scopes for instances"
  type        = list(string)
  default     = [
    "https://www.googleapis.com/auth/cloud-platform"
  ]
}

variable "metadata" {
  description = "Metadata for instances"
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Network tags for instances"
  type        = list(string)
  default     = ["web", "http-server"]
}

variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}`;

    const outputsTf = `# Outputs for compute module from existing resources
# Generated by Rig CLI

output "instance_names" {
  description = "Names of the instances"
  value       = google_compute_instance.instances[*].name
}

output "instance_ips" {
  description = "External IP addresses of the instances"
  value       = google_compute_instance.instances[*].network_interface.0.access_config.0.nat_ip
}

output "instance_internal_ips" {
  description = "Internal IP addresses of the instances"
  value       = google_compute_instance.instances[*].network_interface.0.network_ip
}

output "instance_self_links" {
  description = "Self links of the instances"
  value       = google_compute_instance.instances[*].self_link
}

output "instance_zones" {
  description = "Zones of the instances"
  value       = google_compute_instance.instances[*].zone
}`;

    fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
    fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
    fs.writeFileSync(path.join(moduleDir, 'outputs.tf'), outputsTf);
  }

  async generateVPCModule(moduleDir, analysis) {
    const mainTf = `# VPC/Network module
# Generated by Rig CLI

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

resource "google_compute_network" "main" {
  name                    = "\${var.name_prefix}-vpc"
  auto_create_subnetworks = false
  routing_mode           = "REGIONAL"
}

resource "google_compute_subnetwork" "main" {
  name          = "\${var.name_prefix}-subnet"
  ip_cidr_range = var.subnet_cidr
  region        = var.region
  network       = google_compute_network.main.id
  
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = var.pods_cidr
  }
  
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = var.services_cidr
  }
}

resource "google_compute_firewall" "allow_internal" {
  name    = "\${var.name_prefix}-allow-internal"
  network = google_compute_network.main.name

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

  source_ranges = [var.subnet_cidr, var.pods_cidr, var.services_cidr]
}

resource "google_compute_firewall" "allow_http" {
  name    = "\${var.name_prefix}-allow-http"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["80", "8080", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web", "http-server"]
}

resource "google_compute_firewall" "allow_ssh" {
  name    = "\${var.name_prefix}-allow-ssh"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.ssh_source_ranges
  target_tags   = ["ssh"]
}`;

    const variablesTf = `# Variables for VPC module
# Generated by Rig CLI

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "subnet_cidr" {
  description = "CIDR block for the main subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "pods_cidr" {
  description = "CIDR block for Kubernetes pods (secondary range)"
  type        = string
  default     = "10.1.0.0/16"
}

variable "services_cidr" {
  description = "CIDR block for Kubernetes services (secondary range)"
  type        = string
  default     = "10.2.0.0/16"
}

variable "ssh_source_ranges" {
  description = "Source IP ranges allowed for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}`;

    const outputsTf = `# Outputs for VPC module
# Generated by Rig CLI

output "network_name" {
  description = "Name of the VPC network"
  value       = google_compute_network.main.name
}

output "network_self_link" {
  description = "Self link of the VPC network"
  value       = google_compute_network.main.self_link
}

output "subnet_names" {
  description = "Names of the subnets"
  value       = [google_compute_subnetwork.main.name]
}

output "subnet_self_links" {
  description = "Self links of the subnets"
  value       = [google_compute_subnetwork.main.self_link]
}

output "subnet_cidr" {
  description = "CIDR block of the main subnet"
  value       = google_compute_subnetwork.main.ip_cidr_range
}`;

    fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
    fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
    fs.writeFileSync(path.join(moduleDir, 'outputs.tf'), outputsTf);
  }

  async generateStorageModule(moduleDir, analysis) {
    const mainTf = `# Storage module
# Generated by Rig CLI

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

resource "google_storage_bucket" "main" {
  name     = "\${var.name_prefix}-storage"
  location = var.region
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = var.enable_versioning
  }
  
  lifecycle_rule {
    condition {
      age = var.lifecycle_age_days
    }
    action {
      type = "Delete"
    }
  }
  
  lifecycle_rule {
    condition {
      age                = var.nearline_age_days
      matches_storage_class = ["STANDARD"]
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
}

resource "google_storage_bucket_iam_member" "storage_admin" {
  bucket = google_storage_bucket.main.name
  role   = "roles/storage.admin"
  member = "serviceAccount:\${var.service_account_email}"
  
  condition {
    title       = "Storage Admin Access"
    description = "Access for application service account"
    expression  = "request.time < timestamp('2025-12-31T23:59:59Z')"
  }
}`;

    const variablesTf = `# Variables for storage module
# Generated by Rig CLI

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "enable_versioning" {
  description = "Enable bucket versioning"
  type        = bool
  default     = true
}

variable "lifecycle_age_days" {
  description = "Age in days for lifecycle deletion"
  type        = number
  default     = 90
}

variable "nearline_age_days" {
  description = "Age in days to move to nearline storage"
  type        = number
  default     = 30
}

variable "service_account_email" {
  description = "Service account email for bucket access"
  type        = string
  default     = ""
}`;

    const outputsTf = `# Outputs for storage module
# Generated by Rig CLI

output "bucket_name" {
  description = "Name of the storage bucket"
  value       = google_storage_bucket.main.name
}

output "bucket_url" {
  description = "URL of the storage bucket"
  value       = google_storage_bucket.main.url
}

output "bucket_self_link" {
  description = "Self link of the storage bucket"
  value       = google_storage_bucket.main.self_link
}`;

    fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
    fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
    fs.writeFileSync(path.join(moduleDir, 'outputs.tf'), outputsTf);
  }

  async generateDatabaseModule(moduleDir, analysis) {
    const mainTf = `# Database module (Cloud SQL)
# Generated by Rig CLI

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

resource "random_password" "db_password" {
  length  = 16
  special = true
}

resource "google_sql_database_instance" "main" {
  name             = "\${var.name_prefix}-db"
  database_version = var.database_version
  region          = var.region
  
  settings {
    tier = var.database_tier
    
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      location                       = var.region
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_self_link
      require_ssl     = true
    }
    
    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"
    }
  }
  
  deletion_protection = var.deletion_protection
}

resource "google_sql_database" "main" {
  name     = var.database_name
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "main" {
  name     = var.database_user
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}`;

    const variablesTf = `# Variables for database module
# Generated by Rig CLI

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "network_self_link" {
  description = "Self link of the VPC network"
  type        = string
}

variable "database_version" {
  description = "Database version"
  type        = string
  default     = "POSTGRES_15"
  
  validation {
    condition     = contains(["POSTGRES_15", "POSTGRES_14", "MYSQL_8_0"], var.database_version)
    error_message = "Database version must be POSTGRES_15, POSTGRES_14, or MYSQL_8_0."
  }
}

variable "database_tier" {
  description = "Database instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "database_name" {
  description = "Name of the database"
  type        = string
  default     = "app_db"
}

variable "database_user" {
  description = "Database user name"
  type        = string
  default     = "app_user"
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}`;

    const outputsTf = `# Outputs for database module
# Generated by Rig CLI

output "instance_name" {
  description = "Name of the database instance"
  value       = google_sql_database_instance.main.name
}

output "instance_connection_name" {
  description = "Connection name of the database instance"
  value       = google_sql_database_instance.main.connection_name
}

output "database_name" {
  description = "Name of the database"
  value       = google_sql_database.main.name
}

output "database_user" {
  description = "Database user name"
  value       = google_sql_user.main.name
}

output "private_ip" {
  description = "Private IP address of the database instance"
  value       = google_sql_database_instance.main.private_ip_address
}`;

    fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
    fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
    fs.writeFileSync(path.join(moduleDir, 'outputs.tf'), outputsTf);
  }

  async generateIAMModule(moduleDir, analysis) {
    const mainTf = `# IAM module
# Generated by Rig CLI

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

resource "google_service_account" "app" {
  account_id   = "\${var.name_prefix}-app"
  display_name = "Application Service Account"
  description  = "Service account for application resources"
}

resource "google_project_iam_member" "app_roles" {
  for_each = toset(var.app_roles)
  
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:\${google_service_account.app.email}"
}

resource "google_service_account_key" "app" {
  service_account_id = google_service_account.app.name
  public_key_type    = "TYPE_X509_PEM_FILE"
}`;

    const variablesTf = `# Variables for IAM module
# Generated by Rig CLI

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "app_roles" {
  description = "IAM roles for the application service account"
  type        = list(string)
  default     = [
    "roles/storage.objectViewer",
    "roles/cloudsql.client",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter"
  ]
}`;

    const outputsTf = `# Outputs for IAM module
# Generated by Rig CLI

output "service_account_email" {
  description = "Email of the application service account"
  value       = google_service_account.app.email
}

output "service_account_key" {
  description = "Key for the application service account"
  value       = google_service_account_key.app.private_key
  sensitive   = true
}`;

    fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
    fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
    fs.writeFileSync(path.join(moduleDir, 'outputs.tf'), outputsTf);
  }

  async generateDatabaseModuleFromResources(moduleDir, items, options) {
    const mainTf = `# Database module from existing resources
# Generated by Rig CLI

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

resource "google_sql_database_instance" "instances" {
  count            = length(var.database_names)
  name             = var.database_names[count.index]
  database_version = var.database_version
  region          = var.region
  
  settings {
    tier = var.database_tier
    
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      location                       = var.region
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }
    
    ip_configuration {
      ipv4_enabled    = var.enable_public_ip
      private_network = var.network_self_link
      require_ssl     = true
    }
  }
  
  deletion_protection = var.deletion_protection
}`;

    const variablesTf = `# Variables for database module from existing resources
# Generated by Rig CLI

variable "database_names" {
  description = "Names of the database instances"
  type        = list(string)
  default     = [${items.map(item => `"${item.name || 'db-instance'}"`).join(', ')}]
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "network_self_link" {
  description = "Self link of the VPC network"
  type        = string
  default     = ""
}

variable "database_version" {
  description = "Database version"
  type        = string
  default     = "POSTGRES_15"
}

variable "database_tier" {
  description = "Database instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "enable_public_ip" {
  description = "Enable public IP for database"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}`;

    const outputsTf = `# Outputs for database module from existing resources
# Generated by Rig CLI

output "instance_names" {
  description = "Names of the database instances"
  value       = google_sql_database_instance.instances[*].name
}

output "instance_connection_names" {
  description = "Connection names of the database instances"
  value       = google_sql_database_instance.instances[*].connection_name
}

output "private_ips" {
  description = "Private IP addresses of the database instances"
  value       = google_sql_database_instance.instances[*].private_ip_address
}`;

    fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
    fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
    fs.writeFileSync(path.join(moduleDir, 'outputs.tf'), outputsTf);
  }

  async generateNetworkModuleFromResources(moduleDir, items, options) {
    const mainTf = `# Network module from existing resources
# Generated by Rig CLI

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

resource "google_compute_network" "networks" {
  count                   = length(var.network_names)
  name                    = var.network_names[count.index]
  auto_create_subnetworks = false
  routing_mode           = "REGIONAL"
}

resource "google_compute_subnetwork" "subnets" {
  count         = length(var.network_names)
  name          = "\${var.network_names[count.index]}-subnet"
  ip_cidr_range = var.subnet_cidrs[count.index]
  region        = var.region
  network       = google_compute_network.networks[count.index].id
}

resource "google_compute_firewall" "allow_internal" {
  count   = length(var.network_names)
  name    = "\${var.network_names[count.index]}-allow-internal"
  network = google_compute_network.networks[count.index].name

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

  source_ranges = [var.subnet_cidrs[count.index]]
}`;

    const variablesTf = `# Variables for network module from existing resources
# Generated by Rig CLI

variable "network_names" {
  description = "Names of the VPC networks"
  type        = list(string)
  default     = [${items.map(n => `"${n.name || 'network'}"`).join(', ')}]
}

variable "subnet_cidrs" {
  description = "CIDR blocks for subnets"
  type        = list(string)
  default     = [${items.map((_, i) => `"10.${i + 1}.0.0/24"`).join(', ')}]
}

variable "region" {
  description = "GCP region"
  type        = string
}`;

    const outputsTf = `# Outputs for network module from existing resources
# Generated by Rig CLI

output "network_names" {
  description = "Names of the created networks"
  value       = google_compute_network.networks[*].name
}

output "network_self_links" {
  description = "Self links of the created networks"
  value       = google_compute_network.networks[*].self_link
}

output "subnet_names" {
  description = "Names of the created subnets"
  value       = google_compute_subnetwork.subnets[*].name
}`;

    fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
    fs.writeFileSync(path.join(moduleDir, 'variables.tf'), variablesTf);
    fs.writeFileSync(path.join(moduleDir, 'outputs.tf'), outputsTf);
  }

  // Helper methods
  getProjectName(analysis) {
    // Prefer GCP project name if available
    if (analysis?.infrastructure?.projectName) {
      return analysis.infrastructure.projectName;
    }
    
    // Get from environment variable (GCP project)
    const gcpProject = process.env.GCP_PROJECT_ID;
    if (gcpProject) {
      return gcpProject;
    }
    
    // Try to get from package.json name, but avoid CLI tool names
    if (analysis?.projectName && 
        analysis.projectName !== 'devops-cli' && 
        analysis.projectName !== 'rig-cli') {
      return analysis.projectName;
    }
    
    // Fallback to current directory name only if it's not the CLI tool
    const dirName = path.basename(process.cwd());
    if (dirName !== 'devops-cli' && dirName !== 'rig-cli') {
      return dirName;
    }
    
    // Final fallback
    return 'my-app';
  }

  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}