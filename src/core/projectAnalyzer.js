import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CloudManager } from './cloudManager.js';
import { Logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export class ProjectAnalyzer {
  constructor(cloudManager = null) {
    this.logger = new Logger();
    this.cloudManager = cloudManager || new CloudManager();
    this.projectRoot = process.cwd();
  }

  async analyzeProject() {
    // Get cloud provider configuration
    const cloudConfig = await this.getCloudConfiguration();
    
    const analysis = {
      projectRoot: this.projectRoot,
      projectName: path.basename(this.projectRoot),
      timestamp: new Date().toISOString(),
      cloud: cloudConfig,
      projectType: null,
      techStack: [],
      packageManager: null,
      dependencies: [],
      infrastructure: null,
      recommendations: [],
      generateSuggestions: [],
      hasDocker: false,
      hasKubernetes: false,
      hasTerraform: false,
      hasCI: false,
      needsOrchestration: false
    };

    // Analyze project structure
    await this.analyzeProjectStructure(analysis);
    
    // Analyze package files
    await this.analyzePackageFiles(analysis);
    
    // Analyze existing infrastructure files
    await this.analyzeInfrastructureFiles(analysis);
    
    // Get cloud infrastructure if available
    await this.analyzeCloudInfrastructure(analysis);
    
    // Generate recommendations
    this.generateRecommendations(analysis);
    
    // Generate suggestions for what to create
    this.generateSuggestions(analysis);

    return analysis;
  }

  async getCloudConfiguration() {
    const config = {
      provider: null,
      projectId: null,
      region: null,
      account: null
    };

    try {
      // Try to get GCP configuration from environment
      config.provider = 'gcp';
      config.projectId = process.env.GCP_PROJECT_ID;
      config.region = process.env.GCP_REGION || 'us-central1';
      config.account = process.env.GCP_ACCOUNT;

      // Validate GCP configuration
      if (config.projectId) {
        this.logger.info(`Using GCP project: ${config.projectId} in region: ${config.region}`);
      } else {
        this.logger.warn('GCP project ID not found. Run `rig init` to configure.');
        config.projectId = 'your-gcp-project-id';
        config.region = 'us-central1';
      }
    } catch (error) {
      this.logger.warn('Could not load cloud configuration:', error.message);
      config.provider = 'gcp';
      config.projectId = 'your-gcp-project-id';
      config.region = 'us-central1';
    }

    return config;
  }

  async analyzeProjectStructure(analysis) {
    const files = await this.getDirectoryContents();
    
    // Check for common project types
    if (files.includes('package.json')) {
      analysis.projectType = 'Node.js';
      analysis.techStack.push('JavaScript/Node.js');
      analysis.packageManager = files.includes('yarn.lock') ? 'yarn' : 'npm';
    }
    
    if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
      analysis.projectType = analysis.projectType ? 'Full-stack' : 'Python';
      analysis.techStack.push('Python');
      analysis.packageManager = 'pip';
    }
    
    if (files.includes('pom.xml') || files.includes('build.gradle')) {
      analysis.projectType = analysis.projectType ? 'Full-stack' : 'Java';
      analysis.techStack.push('Java');
      analysis.packageManager = files.includes('pom.xml') ? 'maven' : 'gradle';
    }
    
    if (files.includes('go.mod')) {
      analysis.projectType = analysis.projectType ? 'Full-stack' : 'Go';
      analysis.techStack.push('Go');
      analysis.packageManager = 'go mod';
    }
    
    if (files.includes('Cargo.toml')) {
      analysis.projectType = analysis.projectType ? 'Full-stack' : 'Rust';
      analysis.techStack.push('Rust');
      analysis.packageManager = 'cargo';
    }

    // Check for framework indicators
    await this.detectFrameworks(analysis);
    
    // Check for existing infrastructure tooling
    analysis.hasDocker = files.includes('Dockerfile') || files.includes('docker-compose.yml');
    analysis.hasKubernetes = files.some(file => file.endsWith('.yaml') || file.endsWith('.yml')) 
                           && await this.hasKubernetesFiles();
    analysis.hasTerraform = files.some(file => file.endsWith('.tf'));
    analysis.hasCI = files.includes('.github') || files.includes('.gitlab-ci.yml') || files.includes('Jenkinsfile');
    
    // Determine if orchestration is needed
    analysis.needsOrchestration = analysis.techStack.length > 1 || 
                                 analysis.projectType === 'Full-stack' ||
                                 await this.isLargeProject();
  }

  async analyzePackageFiles(analysis) {
    try {
      // Analyze package.json if it exists
      if (fs.existsSync(path.join(this.projectRoot, 'package.json'))) {
        const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
        analysis.dependencies = Object.keys(packageJson.dependencies || {})
          .concat(Object.keys(packageJson.devDependencies || {}));
        
        // Detect popular frameworks/libraries
        if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
          analysis.techStack.push('React');
        }
        if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
          analysis.techStack.push('Vue.js');
        }
        if (packageJson.dependencies?.angular || packageJson.devDependencies?.angular) {
          analysis.techStack.push('Angular');
        }
        if (packageJson.dependencies?.express) {
          analysis.techStack.push('Express.js');
        }
        if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
          analysis.techStack.push('Next.js');
        }
      }
      
      // Analyze requirements.txt if it exists
      if (fs.existsSync(path.join(this.projectRoot, 'requirements.txt'))) {
        const requirements = fs.readFileSync(path.join(this.projectRoot, 'requirements.txt'), 'utf8');
        analysis.dependencies.push(...requirements.split('\n')
          .filter(line => line.trim() && !line.startsWith('#'))
          .map(line => line.split('==')[0].split('>=')[0].split('~=')[0].trim()));
        
        // Detect Python frameworks
        if (requirements.includes('django')) {
          analysis.techStack.push('Django');
        }
        if (requirements.includes('flask')) {
          analysis.techStack.push('Flask');
        }
        if (requirements.includes('fastapi')) {
          analysis.techStack.push('FastAPI');
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to analyze package files: ${error.message}`);
    }
  }

  async analyzeInfrastructureFiles(analysis) {
    try {
      const infraFiles = [];
      
      // Look for common infrastructure files
      const commonFiles = [
        'terraform/', '*.tf', 'terragrunt.hcl',
        'kubernetes/', 'k8s/', '*.yaml', '*.yml',
        'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile',
        '.github/workflows/', '.gitlab-ci.yml', 'Jenkinsfile',
        'ansible/', 'playbook.yml', 'inventory.yml',
        'helm/', 'charts/'
      ];
      
      for (const pattern of commonFiles) {
        if (await this.fileExists(pattern)) {
          infraFiles.push(pattern);
        }
      }
      
      analysis.existingInfrastructure = infraFiles;
      
      // Analyze Terraform files if they exist
      if (analysis.hasTerraform) {
        analysis.terraformModules = await this.analyzeTerraformFiles();
      }
      
    } catch (error) {
      this.logger.warn(`Failed to analyze infrastructure files: ${error.message}`);
    }
  }

  async analyzeCloudInfrastructure(analysis) {
    try {
      // Get current cloud resources only if cloud manager is properly initialized
      let resources = null;
      if (analysis.cloud.projectId && analysis.cloud.projectId !== 'your-gcp-project-id') {
        try {
          resources = await this.cloudManager.listAllResources();
        } catch (error) {
          this.logger.warn('Could not fetch cloud resources:', error.message);
        }
      } else {
        this.logger.info('Skipping cloud resource analysis - no project configured');
      }
      
      let totalResources = 0;
      let estimatedCost = 0;
      const resourceTypes = [];
      
      if (resources) {
        for (const resourceGroup of resources) {
          if (resourceGroup.items?.length > 0) {
            totalResources += resourceGroup.items.length;
            resourceTypes.push(resourceGroup.type);
            
            // Simple cost estimation (expand this based on your cost command logic)
            estimatedCost += this.estimateResourceGroupCost(resourceGroup);
          }
        }
      }
      
      if (totalResources > 0) {
        analysis.infrastructure = {
          provider: 'GCP', // Currently only GCP is implemented
          resourceCount: totalResources,
          resourceTypes: resourceTypes,
          estimatedCost: Math.round(estimatedCost),
          resources: resources
        };
      }
    } catch (error) {
      this.logger.warn(`Failed to analyze cloud infrastructure: ${error.message}`);
    }
  }

  generateRecommendations(analysis) {
    const recommendations = [];
    
    // Docker recommendations
    if (!analysis.hasDocker) {
      recommendations.push('Add Docker containerization for consistent deployment');
    }
    
    // Kubernetes recommendations
    if (!analysis.hasKubernetes && analysis.needsOrchestration) {
      recommendations.push('Consider Kubernetes for container orchestration');
    }
    
    // Terraform recommendations
    if (analysis.infrastructure && !analysis.hasTerraform) {
      recommendations.push('Generate Terraform modules to manage existing infrastructure as code');
    }
    
    // CI/CD recommendations
    if (!analysis.hasCI) {
      recommendations.push('Set up CI/CD pipeline for automated deployment');
    }
    
    // Security recommendations
    if (analysis.dependencies?.some(dep => dep.includes('express') || dep.includes('flask'))) {
      recommendations.push('Add security configurations and policies for web application');
    }
    
    // Monitoring recommendations
    if (analysis.infrastructure && analysis.infrastructure.resourceCount > 3) {
      recommendations.push('Implement monitoring and alerting for infrastructure');
    }
    
    analysis.recommendations = recommendations;
  }

  generateSuggestions(analysis) {
    const suggestions = [];
    
    if (analysis.infrastructure && !analysis.hasTerraform) {
      suggestions.push({
        command: 'rig generate terraform --import',
        description: 'Generate Terraform modules for existing infrastructure'
      });
    }
    
    if (!analysis.hasDocker) {
      suggestions.push({
        command: 'rig generate docker',
        description: 'Create Dockerfile and docker-compose configuration'
      });
    }
    
    if (analysis.needsOrchestration && !analysis.hasKubernetes) {
      suggestions.push({
        command: 'rig generate kubernetes',
        description: 'Generate Kubernetes manifests for container deployment'
      });
    }
    
    if (!analysis.hasCI) {
      suggestions.push({
        command: 'rig generate cicd --github',
        description: 'Create GitHub Actions workflow for CI/CD'
      });
    }
    
    if (analysis.infrastructure) {
      suggestions.push({
        command: 'rig generate monitoring',
        description: 'Set up monitoring stack with Prometheus and Grafana'
      });
    }
    
    if (analysis.techStack.length > 0) {
      suggestions.push({
        command: 'rig generate security-configs',
        description: 'Generate security policies and configurations'
      });
    }
    
    analysis.generateSuggestions = suggestions;
  }

  // Helper methods
  async getDirectoryContents() {
    try {
      return fs.readdirSync(this.projectRoot);
    } catch (error) {
      return [];
    }
  }

  async detectFrameworks(analysis) {
    try {
      // Check for framework-specific files and directories
      const files = await this.getDirectoryContents();
      
      if (files.includes('angular.json')) {
        analysis.techStack.push('Angular');
      }
      if (files.includes('vue.config.js')) {
        analysis.techStack.push('Vue.js');
      }
      if (files.includes('next.config.js')) {
        analysis.techStack.push('Next.js');
      }
      if (files.includes('nuxt.config.js')) {
        analysis.techStack.push('Nuxt.js');
      }
    } catch (error) {
      // Ignore errors in framework detection
    }
  }

  async hasKubernetesFiles() {
    try {
      const { stdout } = await execAsync('find . -name "*.yaml" -o -name "*.yml" | head -5');
      const files = stdout.trim().split('\n').filter(Boolean);
      
      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          if (content.includes('apiVersion:') && content.includes('kind:')) {
            return true;
          }
        } catch (error) {
          // Skip files we can't read
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async isLargeProject() {
    try {
      const { stdout } = await execAsync('find . -type f -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.java" -o -name "*.go" -o -name "*.rs" | wc -l');
      const fileCount = parseInt(stdout.trim());
      return fileCount > 20; // Consider it large if more than 20 source files
    } catch (error) {
      return false;
    }
  }

  async fileExists(pattern) {
    try {
      if (pattern.includes('*')) {
        const { stdout } = await execAsync(`ls ${pattern} 2>/dev/null || true`);
        return stdout.trim().length > 0;
      } else {
        return fs.existsSync(path.join(this.projectRoot, pattern));
      }
    } catch (error) {
      return false;
    }
  }

  async analyzeTerraformFiles() {
    try {
      const { stdout } = await execAsync('find . -name "*.tf" | head -10');
      const tfFiles = stdout.trim().split('\n').filter(Boolean);
      
      const modules = [];
      for (const file of tfFiles) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          // Simple parsing - look for resource and module blocks
          const resourceMatches = content.match(/resource\s+"([^"]+)"/g) || [];
          const moduleMatches = content.match(/module\s+"([^"]+)"/g) || [];
          
          modules.push({
            file: file,
            resources: resourceMatches.length,
            modules: moduleMatches.length
          });
        } catch (error) {
          // Skip files we can't read
        }
      }
      return modules;
    } catch (error) {
      return [];
    }
  }

  estimateResourceGroupCost(resourceGroup) {
    // Simple cost estimation - you can expand this
    const costMap = {
      instances: 25, // Average per instance
      storage: 2,    // Average per bucket
      databases: 50, // Average per database
      networks: 5,   // Average per network
      'load-balancers': 20 // Average per load balancer
    };
    
    return (costMap[resourceGroup.type] || 10) * (resourceGroup.items?.length || 0);
  }
}