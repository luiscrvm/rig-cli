import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

export class KubernetesGenerator {
  constructor(cloudManager, aiAssistant, logger) {
    this.cloudManager = cloudManager;
    this.aiAssistant = aiAssistant;
    this.logger = logger;
    this.outputDir = path.join(process.cwd(), 'k8s');
  }

  async generateComplete(analysis, options) {
    const spinner = ora('Generating complete Kubernetes configuration...').start();
    
    try {
      // Create output directory structure
      this.ensureDirectoryExists(this.outputDir);
      this.ensureDirectoryExists(path.join(this.outputDir, 'base'));
      this.ensureDirectoryExists(path.join(this.outputDir, 'overlays', 'dev'));
      this.ensureDirectoryExists(path.join(this.outputDir, 'overlays', 'staging'));
      this.ensureDirectoryExists(path.join(this.outputDir, 'overlays', 'prod'));
      
      // Detect applications from analysis
      const apps = this.detectApplications(analysis);
      
      // Generate manifests for each application
      for (const app of apps) {
        await this.generateAppManifests(app.name, analysis, { ...options, appConfig: app });
      }
      
      // Generate common resources
      await this.generateNamespaces(analysis);
      await this.generateNetworkPolicies(analysis);
      await this.generateKustomization(analysis, apps);
      
      // Generate README
      await this.generateReadme(analysis, apps);
      
      spinner.succeed('Kubernetes configuration generated successfully');
      
      console.log(chalk.green('\n✅ Generated Kubernetes files:'));
      console.log(chalk.gray(`📁 ${this.outputDir}/`));
      console.log(chalk.gray('├── base/'));
      console.log(chalk.gray('│   ├── namespace.yaml'));
      console.log(chalk.gray('│   ├── network-policies.yaml'));
      console.log(chalk.gray('│   └── kustomization.yaml'));
      console.log(chalk.gray('├── overlays/'));
      console.log(chalk.gray('│   ├── dev/'));
      console.log(chalk.gray('│   ├── staging/'));
      console.log(chalk.gray('│   └── prod/'));
      apps.forEach(app => {
        console.log(chalk.gray(`├── ${app.name}/`));
        console.log(chalk.gray('│   ├── deployment.yaml'));
        console.log(chalk.gray('│   ├── service.yaml'));
        console.log(chalk.gray('│   └── configmap.yaml'));
      });
      console.log(chalk.gray('└── README.md'));
      
    } catch (error) {
      spinner.fail('Kubernetes generation failed');
      throw error;
    }
  }

  async generateAppManifests(appName, analysis, options) {
    const appDir = path.join(this.outputDir, appName);
    this.ensureDirectoryExists(appDir);
    
    const spinner = ora(`Generating manifests for ${appName}...`).start();
    
    try {
      const appConfig = options.appConfig || this.generateAppConfig(appName, analysis);
      
      // Generate deployment
      await this.generateDeployment(appDir, appName, appConfig);
      
      // Generate service
      await this.generateService(appDir, appName, appConfig);
      
      // Generate configmap
      await this.generateConfigMap(appDir, appName, appConfig);
      
      // Generate ingress if needed
      if (appConfig.needsIngress) {
        await this.generateIngress(appDir, appName, appConfig, analysis);
      }
      
      // Generate HPA if needed
      if (appConfig.needsHPA) {
        await this.generateHPA(appDir, appName, appConfig);
      }
      
      spinner.succeed(`Manifests for ${appName} generated successfully`);
      
    } catch (error) {
      spinner.fail(`Failed to generate manifests for ${appName}`);
      throw error;
    }
  }

  async generateHelmChart(analysis, options) {
    const chartDir = path.join(process.cwd(), 'helm-chart');
    this.ensureDirectoryExists(chartDir);
    this.ensureDirectoryExists(path.join(chartDir, 'templates'));
    
    const spinner = ora('Generating Helm chart...').start();
    
    try {
      const chartName = analysis?.projectName || 'my-app';
      
      // Generate Chart.yaml
      await this.generateChartYaml(chartDir, chartName, analysis);
      
      // Generate values.yaml
      await this.generateValuesYaml(chartDir, analysis);
      
      // Generate templates
      await this.generateHelmTemplates(chartDir, analysis);
      
      spinner.succeed('Helm chart generated successfully');
      
      console.log(chalk.green('\n✅ Generated Helm chart:'));
      console.log(chalk.gray(`📁 ${chartDir}/`));
      console.log(chalk.gray('├── Chart.yaml'));
      console.log(chalk.gray('├── values.yaml'));
      console.log(chalk.gray('└── templates/'));
      console.log(chalk.gray('    ├── deployment.yaml'));
      console.log(chalk.gray('    ├── service.yaml'));
      console.log(chalk.gray('    └── ingress.yaml'));
      
    } catch (error) {
      spinner.fail('Helm chart generation failed');
      throw error;
    }
  }

  detectApplications(analysis) {
    const apps = [];
    
    // Get project name from GCP project or package.json
    const projectName = this.getProjectName(analysis);
    
    // Detect applications based on project analysis
    if (analysis?.techStack?.includes('React') || analysis?.techStack?.includes('Vue.js') || analysis?.techStack?.includes('Angular')) {
      apps.push({
        name: `${projectName}-frontend`,
        type: 'web',
        port: 3000,
        needsIngress: true,
        needsHPA: true
      });
    }
    
    if (analysis?.techStack?.includes('Express.js') || analysis?.techStack?.includes('FastAPI') || analysis?.techStack?.includes('Django')) {
      apps.push({
        name: `${projectName}-backend`,
        type: 'api',
        port: analysis?.techStack?.includes('Express.js') ? 3000 : 8000,
        needsIngress: true,
        needsHPA: true
      });
    }
    
    if (analysis?.dependencies?.some(dep => dep.includes('redis'))) {
      apps.push({
        name: `${projectName}-redis`,
        type: 'cache',
        port: 6379,
        needsIngress: false,
        needsHPA: false
      });
    }
    
    // For Node.js projects without specific framework detection
    if (apps.length === 0 && analysis?.techStack?.includes('Node.js')) {
      apps.push({
        name: `${projectName}-api`,
        type: 'api',
        port: 8080,
        needsIngress: true,
        needsHPA: true
      });
    }
    
    // Default app if none detected
    if (apps.length === 0) {
      apps.push({
        name: projectName,
        type: 'web',
        port: 8080,
        needsIngress: true,
        needsHPA: true
      });
    }
    
    return apps;
  }

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

  generateAppConfig(appName, analysis) {
    return {
      name: appName,
      type: 'web',
      port: 8080,
      replicas: 3,
      needsIngress: true,
      needsHPA: true,
      resources: {
        requests: { cpu: '100m', memory: '128Mi' },
        limits: { cpu: '500m', memory: '512Mi' }
      }
    };
  }

  async generateDeployment(appDir, appName, appConfig) {
    const deployment = `# Deployment for ${appName}
# Generated by Rig CLI

apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${appName}
  labels:
    app: ${appName}
    generated-by: rig-cli
spec:
  replicas: ${appConfig.replicas || 3}
  selector:
    matchLabels:
      app: ${appName}
  template:
    metadata:
      labels:
        app: ${appName}
    spec:
      containers:
      - name: ${appName}
        image: ${appName}:latest
        ports:
        - containerPort: ${appConfig.port}
          name: http
        env:
        - name: PORT
          value: "${appConfig.port}"
        - name: NODE_ENV
          value: "production"
        envFrom:
        - configMapRef:
            name: ${appName}-config
        resources:
          requests:
            cpu: ${appConfig.resources?.requests?.cpu || '100m'}
            memory: ${appConfig.resources?.requests?.memory || '128Mi'}
          limits:
            cpu: ${appConfig.resources?.limits?.cpu || '500m'}
            memory: ${appConfig.resources?.limits?.memory || '512Mi'}
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
        securityContext:
          allowPrivilegeEscalation: false
          runAsNonRoot: true
          runAsUser: 1000
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
      securityContext:
        fsGroup: 1000
        runAsNonRoot: true
---`;
    
    fs.writeFileSync(path.join(appDir, 'deployment.yaml'), deployment);
  }

  async generateService(appDir, appName, appConfig) {
    const service = `# Service for ${appName}
# Generated by Rig CLI

apiVersion: v1
kind: Service
metadata:
  name: ${appName}
  labels:
    app: ${appName}
    generated-by: rig-cli
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: ${appConfig.port}
    protocol: TCP
    name: http
  selector:
    app: ${appName}
---`;
    
    fs.writeFileSync(path.join(appDir, 'service.yaml'), service);
  }

  async generateConfigMap(appDir, appName, appConfig) {
    const configMap = `# ConfigMap for ${appName}
# Generated by Rig CLI

apiVersion: v1
kind: ConfigMap
metadata:
  name: ${appName}-config
  labels:
    app: ${appName}
    generated-by: rig-cli
data:
  # Application configuration
  APP_NAME: "${appName}"
  LOG_LEVEL: "info"
  
  # Add your configuration here
  # DATABASE_URL: "postgresql://user:pass@host:5432/db"
  # REDIS_URL: "redis://redis:6379"
---`;
    
    fs.writeFileSync(path.join(appDir, 'configmap.yaml'), configMap);
  }

  async generateIngress(appDir, appName, appConfig, analysis) {
    const domain = analysis?.cloud?.projectId ? `${appName}.${analysis.cloud.projectId}.com` : `${appName}.your-domain.com`;
    
    const ingress = `# Ingress for ${appName}
# Generated by Rig CLI

apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${appName}
  labels:
    app: ${appName}
    generated-by: rig-cli
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - ${domain}
    secretName: ${appName}-tls
  rules:
  - host: ${domain}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ${appName}
            port:
              number: 80
---`;
    
    fs.writeFileSync(path.join(appDir, 'ingress.yaml'), ingress);
  }

  async generateHPA(appDir, appName, appConfig) {
    const hpa = `# HorizontalPodAutoscaler for ${appName}
# Generated by Rig CLI

apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${appName}
  labels:
    app: ${appName}
    generated-by: rig-cli
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${appName}
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 30
---`;
    
    fs.writeFileSync(path.join(appDir, 'hpa.yaml'), hpa);
  }

  async generateNamespaces(analysis) {
    const projectName = this.getProjectName(analysis);
    const namespaces = `# Namespaces
# Generated by Rig CLI

apiVersion: v1
kind: Namespace
metadata:
  name: ${projectName}
  labels:
    generated-by: rig-cli
    project: ${projectName}
---
apiVersion: v1
kind: Namespace
metadata:
  name: ${projectName}-staging
  labels:
    generated-by: rig-cli
    project: ${projectName}
---
apiVersion: v1
kind: Namespace
metadata:
  name: ${projectName}-prod
  labels:
    generated-by: rig-cli
    project: ${projectName}
---`;
    
    fs.writeFileSync(path.join(this.outputDir, 'base', 'namespace.yaml'), namespaces);
  }

  async generateNetworkPolicies(analysis) {
    const projectName = this.getProjectName(analysis);
    const networkPolicies = `# Network Policies
# Generated by Rig CLI

apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: ${projectName}
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: ${analysis?.projectName || 'default'}
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to: []
    ports:
    - protocol: UDP
      port: 53
---`;
    
    fs.writeFileSync(path.join(this.outputDir, 'base', 'network-policies.yaml'), networkPolicies);
  }

  async generateKustomization(analysis, apps) {
    const projectName = this.getProjectName(analysis);
    const baseKustomization = `# Kustomization for base
# Generated by Rig CLI

apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- namespace.yaml
- network-policies.yaml
${apps.map(app => `- ../${app.name}/`).join('\n')}

commonLabels:
  project: ${projectName}
  generated-by: rig-cli
`;
    
    fs.writeFileSync(path.join(this.outputDir, 'base', 'kustomization.yaml'), baseKustomization);
    
    // Generate overlay kustomizations
    ['dev', 'staging', 'prod'].forEach(env => {
      const overlayKustomization = `# Kustomization for ${env}
# Generated by Rig CLI

apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: ${analysis?.projectName || 'default'}${env === 'dev' ? '' : '-' + env}

resources:
- ../../base

commonLabels:
  environment: ${env}

${env === 'prod' ? `
replicas:
${apps.map(app => `- name: ${app.name}\n  count: 5`).join('\n')}
` : ''}`;
      
      fs.writeFileSync(path.join(this.outputDir, 'overlays', env, 'kustomization.yaml'), overlayKustomization);
    });
  }

  async generateReadme(analysis, apps) {
    const readme = `# Kubernetes Configuration

This Kubernetes configuration was generated by Rig CLI for your ${analysis?.projectName || 'project'}.

## Applications

${apps.map(app => `- **${app.name}**: ${app.type} application running on port ${app.port}`).join('\n')}

## Structure

\`\`\`
k8s/
├── base/                    # Base configuration
│   ├── namespace.yaml      # Namespace definitions
│   ├── network-policies.yaml # Network policies
│   └── kustomization.yaml  # Base kustomization
├── overlays/               # Environment-specific overlays
│   ├── dev/               # Development environment
│   ├── staging/           # Staging environment
│   └── prod/              # Production environment
${apps.map(app => `├── ${app.name}/              # ${app.name} application manifests`).join('\n')}
└── README.md              # This file
\`\`\`

## Deployment

### Using kubectl with Kustomize

\`\`\`bash
# Deploy to development
kubectl apply -k overlays/dev

# Deploy to staging
kubectl apply -k overlays/staging

# Deploy to production
kubectl apply -k overlays/prod
\`\`\`

### Using Helm (if Helm chart was generated)

\`\`\`bash
# Install/upgrade release
helm upgrade --install my-app ./helm-chart

# Install with custom values
helm upgrade --install my-app ./helm-chart -f values-prod.yaml
\`\`\`

## Prerequisites

1. A running Kubernetes cluster
2. kubectl configured to access your cluster
3. NGINX Ingress Controller (for ingress resources)
4. cert-manager (for TLS certificates)

## Security Features

- Non-root containers with read-only root filesystem
- Resource limits and requests defined
- Network policies for traffic control
- Security contexts configured
- Liveness and readiness probes

## Monitoring & Scaling

- Horizontal Pod Autoscaler configured for web applications
- Resource-based scaling on CPU and memory
- Health checks for application monitoring

## Customization

1. Update image names in deployment.yaml files
2. Modify resource limits based on your needs
3. Update ingress hostnames
4. Configure environment-specific values in overlays

## Generated by Rig CLI

This configuration was automatically generated by Rig CLI.
- Run \`rig generate kubernetes\` to regenerate
- Run \`rig security --scan\` to check for security issues
- Run \`rig generate monitoring\` to add observability
`;
    
    fs.writeFileSync(path.join(this.outputDir, 'README.md'), readme);
  }

  // Helm chart generation methods
  async generateChartYaml(chartDir, chartName, analysis) {
    const chartYaml = `# Helm Chart for ${chartName}
# Generated by Rig CLI

apiVersion: v2
name: ${chartName}
description: A Helm chart for ${chartName}
type: application
version: 0.1.0
appVersion: "1.0.0"

keywords:
  - ${chartName}
  ${analysis?.techStack?.map(tech => `- ${tech.toLowerCase()}`).join('\n  ') || ''}

maintainers:
  - name: Rig CLI
    url: https://github.com/your-org/rig-cli

sources:
  - https://github.com/your-org/${chartName}
`;
    
    fs.writeFileSync(path.join(chartDir, 'Chart.yaml'), chartYaml);
  }

  async generateValuesYaml(chartDir, analysis) {
    const apps = this.detectApplications(analysis);
    const mainApp = apps[0] || { name: 'app', port: 8080 };
    
    const valuesYaml = `# Default values for ${analysis?.projectName || 'app'}
# Generated by Rig CLI

replicaCount: 3

image:
  repository: ${mainApp.name}
  pullPolicy: IfNotPresent
  tag: "latest"

service:
  type: ClusterIP
  port: 80
  targetPort: ${mainApp.port}

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: ${mainApp.name}.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ${mainApp.name}-tls
      hosts:
        - ${mainApp.name}.example.com

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

nodeSelector: {}

tolerations: []

affinity: {}

securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000

podSecurityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
    - ALL
`;
    
    fs.writeFileSync(path.join(chartDir, 'values.yaml'), valuesYaml);
  }

  async generateHelmTemplates(chartDir, analysis) {
    const templatesDir = path.join(chartDir, 'templates');
    
    // Generate deployment template
    const deploymentTemplate = `# Deployment template
# Generated by Rig CLI

apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "chart.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "chart.selectorLabels" . | nindent 8 }}
    spec:
      securityContext:
        {{- toYaml .Values.securityContext | nindent 8 }}
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            {{- toYaml .Values.podSecurityContext | nindent 12 }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /health
              port: http
          readinessProbe:
            httpGet:
              path: /ready
              port: http
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
`;
    
    fs.writeFileSync(path.join(templatesDir, 'deployment.yaml'), deploymentTemplate);
  }

  // Helper methods
  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}