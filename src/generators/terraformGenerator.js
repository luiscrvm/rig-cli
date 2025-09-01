import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

export class TerraformGenerator {
  constructor(cloudManager, aiAssistant, logger) {
    this.cloudManager = cloudManager;
    this.aiAssistant = aiAssistant;
    this.logger = logger;
    this.outputDir = path.join(process.cwd(), 'terraform');
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
    const projectName = analysis?.projectName || 'my-project';
    
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
  
  project_id   = var.project_id
  region       = var.region
  zone         = var.zone
  name_prefix  = local.name_prefix
  network_name = module.network.network_name
  common_tags  = local.common_tags
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
  default     = "${analysis?.projectName || 'my-project'}"
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
project_name = "${analysis?.projectName || 'my-project'}"
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

- **Project Name**: ${analysis?.projectName || 'Unknown'}
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

  async generateComputeModuleFromResources(moduleDir, items, options) {
    // Stub implementation for compute resources
    const mainTf = `# Compute module generated from existing resources
# TODO: Implement compute resource generation`;
    fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
  }

  async generateDatabaseModuleFromResources(moduleDir, items, options) {
    // Stub implementation for database resources  
    const mainTf = `# Database module generated from existing resources
# TODO: Implement database resource generation`;
    fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
  }

  async generateNetworkModuleFromResources(moduleDir, items, options) {
    // Stub implementation for network resources
    const mainTf = `# Network module generated from existing resources  
# TODO: Implement network resource generation`;
    fs.writeFileSync(path.join(moduleDir, 'main.tf'), mainTf);
  }

  // Helper methods
  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}