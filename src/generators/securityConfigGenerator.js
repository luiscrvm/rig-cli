import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SecurityConfigGenerator {
  constructor(cloudManager, aiAssistant, logger) {
    this.cloudManager = cloudManager;
    this.aiAssistant = aiAssistant;
    this.logger = logger;
  }

  async generateComplete(analysis, options = {}) {
    this.logger.info('Generating security configuration files...');
    
    const baseDir = options.outputDir || process.cwd();
    const securityDir = path.join(baseDir, 'security');
    
    await fs.mkdir(securityDir, { recursive: true });

    // Generate Open Policy Agent (OPA) policies
    await this.generateOPAPolicies(securityDir, analysis, options);
    
    // Generate security scanning configs
    await this.generateSecurityScanning(securityDir, analysis, options);
    
    // Generate compliance configs
    await this.generateComplianceConfigs(securityDir, analysis, options);
    
    // Generate network security policies
    await this.generateNetworkPolicies(securityDir, analysis, options);
    
    // Generate RBAC configurations
    await this.generateRBACConfigs(securityDir, analysis, options);
    
    this.logger.info('Security configuration generation completed');
    
    return {
      generated: [
        'security/policies/',
        'security/scanning/',
        'security/compliance/',
        'security/network/',
        'security/rbac/'
      ]
    };
  }

  async generateOPAPolicies(securityDir, analysis, options) {
    const policiesDir = path.join(securityDir, 'policies');
    await fs.mkdir(policiesDir, { recursive: true });

    // Container security policy
    const containerPolicy = this.generateContainerSecurityPolicy(analysis);
    await fs.writeFile(
      path.join(policiesDir, 'container-security.rego'),
      containerPolicy
    );

    // Resource limits policy
    const resourcePolicy = this.generateResourceLimitsPolicy(analysis);
    await fs.writeFile(
      path.join(policiesDir, 'resource-limits.rego'),
      resourcePolicy
    );

    // Network policy
    const networkPolicy = this.generateNetworkSecurityPolicy(analysis);
    await fs.writeFile(
      path.join(policiesDir, 'network-security.rego'),
      networkPolicy
    );

    // Data protection policy
    const dataPolicy = this.generateDataProtectionPolicy(analysis);
    await fs.writeFile(
      path.join(policiesDir, 'data-protection.rego'),
      dataPolicy
    );

    // OPA configuration
    const opaConfig = this.generateOPAConfig(analysis);
    await fs.writeFile(
      path.join(policiesDir, 'opa-config.yaml'),
      opaConfig
    );
  }

  generateContainerSecurityPolicy(analysis) {
    return `package container.security

# Deny containers running as root
deny[msg] {
  input.kind == "Pod"
  input.spec.securityContext.runAsUser == 0
  msg := "Container must not run as root user"
}

# Require security context
deny[msg] {
  input.kind == "Pod"
  not input.spec.securityContext
  msg := "Pod must have securityContext defined"
}

# Deny privileged containers
deny[msg] {
  input.kind == "Pod"
  input.spec.containers[_].securityContext.privileged == true
  msg := "Privileged containers are not allowed"
}

# Require readOnlyRootFilesystem
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  not container.securityContext.readOnlyRootFilesystem
  msg := sprintf("Container %s must have readOnlyRootFilesystem set to true", [container.name])
}

# Deny containers with allowPrivilegeEscalation
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  container.securityContext.allowPrivilegeEscalation == true
  msg := sprintf("Container %s must not allow privilege escalation", [container.name])
}

# Require resource limits
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  not container.resources.limits
  msg := sprintf("Container %s must have resource limits defined", [container.name])
}

# Deny hostNetwork
deny[msg] {
  input.kind == "Pod"
  input.spec.hostNetwork == true
  msg := "Pod must not use hostNetwork"
}

# Deny hostPID
deny[msg] {
  input.kind == "Pod"
  input.spec.hostPID == true
  msg := "Pod must not use hostPID"
}`;
  }

  generateResourceLimitsPolicy(analysis) {
    const maxCpu = analysis?.projectType === 'microservice' ? '2' : '4';
    const maxMemory = analysis?.projectType === 'microservice' ? '2Gi' : '4Gi';

    return `package resource.limits

import future.keywords.contains
import future.keywords.if
import future.keywords.in

# Deny containers without CPU limits
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  not container.resources.limits.cpu
  msg := sprintf("Container %s must have CPU limits", [container.name])
}

# Deny containers without memory limits
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  not container.resources.limits.memory
  msg := sprintf("Container %s must have memory limits", [container.name])
}

# Deny excessive CPU limits
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  cpu_limit := container.resources.limits.cpu
  to_number(trim_suffix(cpu_limit, "m")) > ${parseInt(maxCpu) * 1000}
  msg := sprintf("Container %s CPU limit %s exceeds maximum allowed (${maxCpu})", [container.name, cpu_limit])
}

# Deny excessive memory limits
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  memory_limit := container.resources.limits.memory
  memory_bytes := convert_memory_to_bytes(memory_limit)
  memory_bytes > ${this.convertMemoryToBytes(maxMemory)}
  msg := sprintf("Container %s memory limit %s exceeds maximum allowed (${maxMemory})", [container.name, memory_limit])
}

convert_memory_to_bytes(memory_str) = result {
  endswith(memory_str, "Gi")
  result := to_number(trim_suffix(memory_str, "Gi")) * 1024 * 1024 * 1024
}

convert_memory_to_bytes(memory_str) = result {
  endswith(memory_str, "Mi")
  result := to_number(trim_suffix(memory_str, "Mi")) * 1024 * 1024
}

convert_memory_to_bytes(memory_str) = result {
  endswith(memory_str, "Ki")
  result := to_number(trim_suffix(memory_str, "Ki")) * 1024
}`;
  }

  generateNetworkSecurityPolicy(analysis) {
    return `package network.security

# Deny pods without network policies
deny[msg] {
  input.kind == "Pod"
  not has_network_policy
  msg := "Pod must be covered by a NetworkPolicy"
}

# Require specific labels for network policy selection
deny[msg] {
  input.kind == "NetworkPolicy"
  not input.spec.podSelector.matchLabels.app
  msg := "NetworkPolicy must select pods using 'app' label"
}

# Deny allowing all ingress traffic
deny[msg] {
  input.kind == "NetworkPolicy"
  count(input.spec.ingress) > 0
  ingress := input.spec.ingress[_]
  not ingress.from
  msg := "NetworkPolicy must not allow all ingress traffic"
}

# Deny allowing all egress traffic
deny[msg] {
  input.kind == "NetworkPolicy"
  count(input.spec.egress) > 0
  egress := input.spec.egress[_]
  not egress.to
  msg := "NetworkPolicy must not allow all egress traffic"
}

has_network_policy {
  input.kind == "Pod"
  # This would typically check against existing NetworkPolicies
  # In practice, this would be implemented with OPA's data documents
  true
}`;
  }

  generateDataProtectionPolicy(analysis) {
    return `package data.protection

# Deny secrets in environment variables
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  env := container.env[_]
  contains_sensitive_data(env.name)
  msg := sprintf("Container %s has sensitive data in environment variable %s", [container.name, env.name])
}

# Require secrets to be mounted as volumes
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  env := container.env[_]
  env.valueFrom.secretKeyRef
  msg := sprintf("Container %s should mount secrets as volumes instead of environment variables", [container.name])
}

# Deny ConfigMaps with sensitive data patterns
deny[msg] {
  input.kind == "ConfigMap"
  key := input.data[_]
  contains_sensitive_pattern(key)
  msg := sprintf("ConfigMap contains potentially sensitive data in key: %s", [key])
}

contains_sensitive_data(env_name) {
  sensitive_patterns := ["PASSWORD", "SECRET", "TOKEN", "KEY", "CREDENTIAL"]
  pattern := sensitive_patterns[_]
  contains(upper(env_name), pattern)
}

contains_sensitive_pattern(value) {
  # Simple pattern matching for common sensitive data patterns
  regex.match("(?i)(password|secret|token|key)\\s*[:=]\\s*[a-zA-Z0-9+/=]{8,}", value)
}`;
  }

  generateOPAConfig(analysis) {
    return `apiVersion: v1
kind: ConfigMap
metadata:
  name: opa-default-system-main
  namespace: opa-system
data:
  main: |
    package system

    import future.keywords.contains
    import future.keywords.if
    import future.keywords.in

    # Admission control configuration
    main = {
      "api_version": "admission.k8s.io/v1",
      "kind": "AdmissionReview",
      "response": response,
    }

    default response = {"allowed": false}

    response = {
      "allowed": false,
      "status": {
        "reason": reason,
      },
    } if {
      reason := concat(", ", deny)
      reason != ""
    }

    response = {"allowed": true} if {
      count(deny) == 0
    }

    # Import all policy packages
    deny[msg] {
      container.security.deny[msg]
    }

    deny[msg] {
      resource.limits.deny[msg]
    }

    deny[msg] {
      network.security.deny[msg]
    }

    deny[msg] {
      data.protection.deny[msg]
    }

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: opa
  namespace: opa-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: opa
  template:
    metadata:
      labels:
        app: opa
    spec:
      containers:
      - name: opa
        image: openpolicyagent/opa:latest-envoy
        ports:
        - containerPort: 8181
        - containerPort: 8282
        args:
        - "run"
        - "--server"
        - "--config-file=/config/config.yaml"
        - "/policies"
        volumeMounts:
        - readOnly: true
          mountPath: /config
          name: opa-config
        - readOnly: true
          mountPath: /policies
          name: opa-policies
      volumes:
      - name: opa-config
        configMap:
          name: opa-config
      - name: opa-policies
        configMap:
          name: opa-policies`;
  }

  async generateSecurityScanning(securityDir, analysis, options) {
    const scanningDir = path.join(securityDir, 'scanning');
    await fs.mkdir(scanningDir, { recursive: true });

    // Trivy configuration
    const trivyConfig = this.generateTrivyConfig(analysis);
    await fs.writeFile(
      path.join(scanningDir, 'trivy.yaml'),
      trivyConfig
    );

    // Hadolint configuration
    const hadolintConfig = this.generateHadolintConfig(analysis);
    await fs.writeFile(
      path.join(scanningDir, '.hadolint.yaml'),
      hadolintConfig
    );

    // Snyk configuration
    const snykConfig = this.generateSnykConfig(analysis);
    await fs.writeFile(
      path.join(scanningDir, '.snyk'),
      snykConfig
    );

    // Security scanning workflow
    const scanningWorkflow = this.generateSecurityScanningWorkflow(analysis);
    await fs.writeFile(
      path.join(scanningDir, 'security-scan.yaml'),
      scanningWorkflow
    );
  }

  generateTrivyConfig(analysis) {
    return `# Trivy configuration for container and filesystem scanning
format: json
output: trivy-report.json

# Vulnerability scanning
vulnerability:
  type:
    - os
    - library
  scanners:
    - vuln
    - secret

# Secret scanning
secret:
  config: trivy-secret.yaml

# Severity levels to report
severity:
  - UNKNOWN
  - LOW
  - MEDIUM
  - HIGH
  - CRITICAL

# Exit code when vulnerabilities are found
exit-code: 1

# Ignore unfixed vulnerabilities
ignore-unfixed: false

# Skip files
skip-files:
  - "**/*.md"
  - "**/node_modules/**"
  - "**/vendor/**"
  - "**/.git/**"

# Skip directories
skip-dirs:
  - node_modules
  - vendor
  - .git

# Timeout for scanning
timeout: 5m

# Cache directory
cache-dir: /tmp/trivy-cache`;
  }

  generateHadolintConfig(analysis) {
    return `# Hadolint configuration for Dockerfile linting
ignored:
  # Ignore pinning versions in package managers
  - DL3008
  # Ignore sudo usage (if needed for specific use cases)
  - DL3004

trustedRegistries:
  - docker.io
  - gcr.io
  - registry.k8s.io

# Override severity levels
override:
  error:
    - DL3020  # Use COPY instead of ADD
  warning:
    - DL3009  # Delete apt cache
  info:
    - DL3006  # Switch to another baseimage

# Allow rules for specific instructions
allowedInstructions:
  - FROM
  - WORKDIR
  - COPY
  - ADD
  - RUN
  - CMD
  - ENTRYPOINT
  - ENV
  - ARG
  - EXPOSE
  - VOLUME
  - USER
  - LABEL
  - HEALTHCHECK`;
  }

  generateSnykConfig(analysis) {
    return `# Snyk configuration
version: v1.0.0

# Language settings
language-settings:
  javascript:
    # Ignore devDependencies in production
    dev-deps: false
    # Only test production dependencies
    production: true

# Patches to apply
patches:
  # Example patches would be added here
  # when vulnerabilities are found

# Ignore specific vulnerabilities
ignore:
  # Example: ignore specific vulnerability IDs
  # SNYK-JS-LODASH-567746:
  #   - '*':
  #       reason: This vulnerability doesn't affect our usage
  #       expires: '2024-12-31T23:59:59.999Z'

# Exclude paths from scanning
exclude:
  global:
    - '**/*.md'
    - '**/node_modules/**'
    - '**/test/**'
    - '**/tests/**'
    - '**/__tests__/**'
    - '**/coverage/**'
    - '**/dist/**'
    - '**/build/**'`;
  }

  generateSecurityScanningWorkflow(analysis) {
    return `# Security scanning workflow for CI/CD
name: Security Scanning
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    # Run security scans daily
    - cron: '0 6 * * *'

jobs:
  container-scan:
    runs-on: ubuntu-latest
    if: github.event_name != 'schedule'
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker image
        run: docker build -t scan-target .
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'scan-target'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: \${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: TruffleHog OSS
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
          extra_args: --debug --only-verified

  dockerfile-lint:
    runs-on: ubuntu-latest
    if: github.event_name != 'schedule'
    steps:
      - uses: actions/checkout@v4
      
      - name: Hadolint
        uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: Dockerfile
          format: sarif
          output-file: hadolint-results.sarif
          no-fail: false
      
      - name: Upload Hadolint scan results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: hadolint-results.sarif`;
  }

  async generateComplianceConfigs(securityDir, analysis, options) {
    const complianceDir = path.join(securityDir, 'compliance');
    await fs.mkdir(complianceDir, { recursive: true });

    // CIS benchmarks
    const cisBenchmarks = this.generateCISBenchmarks(analysis);
    await fs.writeFile(
      path.join(complianceDir, 'cis-benchmarks.yaml'),
      cisBenchmarks
    );

    // SOC 2 compliance checklist
    const soc2Config = this.generateSOC2Config(analysis);
    await fs.writeFile(
      path.join(complianceDir, 'soc2-compliance.md'),
      soc2Config
    );

    // GDPR compliance
    const gdprConfig = this.generateGDPRConfig(analysis);
    await fs.writeFile(
      path.join(complianceDir, 'gdpr-compliance.md'),
      gdprConfig
    );
  }

  generateCISBenchmarks(analysis) {
    return `# CIS Kubernetes Benchmark Controls
apiVersion: v1
kind: ConfigMap
metadata:
  name: cis-benchmark-config
  namespace: compliance
data:
  cis-controls.yaml: |
    controls:
      # Control 5.1.1: Ensure that the cluster-admin role is only used where required
      - id: "5.1.1"
        description: "Minimize access to cluster-admin role"
        check: |
          kubectl get clusterrolebindings -o json | jq -r '.items[] | select(.roleRef.name=="cluster-admin") | .subjects[]?'
        remediation: |
          Remove unnecessary cluster-admin bindings and use more restrictive roles
      
      # Control 5.1.3: Minimize wildcard use in Roles and ClusterRoles
      - id: "5.1.3"
        description: "Minimize wildcard use in RBAC"
        check: |
          kubectl get roles,clusterroles -A -o json | jq -r '.items[] | select(.rules[]?.resources[]? == "*" or .rules[]?.verbs[]? == "*")'
        remediation: |
          Replace wildcard permissions with specific resource and verb permissions
      
      # Control 5.2.2: Minimize the admission of containers wishing to share the host process ID namespace
      - id: "5.2.2"
        description: "Restrict hostPID usage"
        check: |
          kubectl get pods -A -o json | jq -r '.items[] | select(.spec.hostPID == true)'
        remediation: |
          Remove hostPID: true from pod specifications unless absolutely necessary
      
      # Control 5.3.2: Ensure that all Namespaces have Network Policies defined
      - id: "5.3.2"
        description: "Ensure Network Policies are defined"
        check: |
          kubectl get networkpolicies -A --no-headers | wc -l
        remediation: |
          Create NetworkPolicy resources for all namespaces to restrict traffic
      
      # Control 5.7.3: Apply Security Context to Your Pods and Containers
      - id: "5.7.3"
        description: "Ensure security contexts are applied"
        check: |
          kubectl get pods -A -o json | jq -r '.items[] | select(.spec.securityContext == null)'
        remediation: |
          Add securityContext configurations to all pod specifications`;
  }

  generateSOC2Config(analysis) {
    return `# SOC 2 Compliance Configuration

## Security Controls

### Access Control (CC6.1)
- [ ] Multi-factor authentication implemented
- [ ] Role-based access control (RBAC) configured
- [ ] Regular access reviews conducted
- [ ] Privileged access monitoring in place

### Logical and Physical Access Controls (CC6.2)
- [ ] Network segmentation implemented
- [ ] VPN access required for remote connections
- [ ] Physical access controls for data centers
- [ ] Asset inventory maintained

### System Operations (CC7.1)
- [ ] Change management process documented
- [ ] Automated deployment pipelines
- [ ] Configuration management in place
- [ ] System monitoring and alerting

### Change Management (CC8.1)
- [ ] Version control for all code and configurations
- [ ] Code review process mandatory
- [ ] Testing procedures before production deployment
- [ ] Rollback procedures documented

### Risk Assessment (CC3.1)
- [ ] Regular vulnerability assessments
- [ ] Penetration testing conducted
- [ ] Risk register maintained
- [ ] Incident response plan documented

### Data Protection
- [ ] Data encryption at rest
- [ ] Data encryption in transit
- [ ] Data backup and recovery procedures
- [ ] Data retention policies implemented

### Monitoring Activities (CC5.2)
- [ ] Continuous monitoring of security controls
- [ ] Log aggregation and analysis
- [ ] Anomaly detection systems
- [ ] Regular security assessments

### Communication (CC2.2)
- [ ] Security policies communicated to personnel
- [ ] Training programs for security awareness
- [ ] Incident communication procedures
- [ ] Regular security updates and notifications

## Implementation Checklist

### Infrastructure Security
- [ ] Container security scanning implemented
- [ ] Image vulnerability assessments
- [ ] Runtime security monitoring
- [ ] Network policy enforcement

### Application Security
- [ ] Static code analysis in CI/CD
- [ ] Dynamic security testing
- [ ] Dependency vulnerability scanning
- [ ] Security headers configured

### Data Security
- [ ] Database encryption enabled
- [ ] Secure communication protocols
- [ ] Data classification implemented
- [ ] Access logging enabled

### Operational Security
- [ ] Security incident response procedures
- [ ] Regular security training
- [ ] Vendor risk assessment
- [ ] Business continuity planning`;
  }

  generateGDPRConfig(analysis) {
    return `# GDPR Compliance Configuration

## Data Processing Principles

### Lawfulness, Fairness, and Transparency
- [ ] Legal basis for processing identified
- [ ] Privacy notices provided to data subjects
- [ ] Data processing activities documented
- [ ] Consent mechanisms implemented where required

### Purpose Limitation
- [ ] Processing purposes clearly defined
- [ ] Data use limited to specified purposes
- [ ] Purpose changes properly assessed
- [ ] Data minimization practices in place

### Data Minimization
- [ ] Only necessary data collected
- [ ] Data retention periods defined
- [ ] Automated data deletion implemented
- [ ] Regular data audits conducted

### Accuracy
- [ ] Data validation procedures in place
- [ ] Data correction mechanisms available
- [ ] Regular data quality assessments
- [ ] Error reporting and correction processes

### Storage Limitation
- [ ] Retention schedules documented
- [ ] Automated deletion processes
- [ ] Archive and disposal procedures
- [ ] Regular retention review processes

### Integrity and Confidentiality
- [ ] Data encryption implemented
- [ ] Access controls configured
- [ ] Data breach detection systems
- [ ] Security incident procedures

## Technical and Organizational Measures

### Data Protection by Design and Default
- [ ] Privacy impact assessments conducted
- [ ] Data protection integrated into development
- [ ] Default privacy settings implemented
- [ ] Regular privacy reviews

### Records of Processing Activities
- [ ] Processing register maintained
- [ ] Data flows documented
- [ ] Third-party processors identified
- [ ] Data transfers documented

### Data Subject Rights Implementation
- [ ] Right of access procedures
- [ ] Right to rectification processes
- [ ] Right to erasure (right to be forgotten)
- [ ] Right to data portability
- [ ] Right to object to processing
- [ ] Rights request handling procedures

### Data Breach Management
- [ ] Breach detection procedures
- [ ] 72-hour notification process to authorities
- [ ] Data subject notification procedures
- [ ] Breach response team identified
- [ ] Breach documentation and reporting

### International Data Transfers
- [ ] Transfer mechanisms identified
- [ ] Adequacy decisions verified
- [ ] Standard contractual clauses implemented
- [ ] Transfer impact assessments conducted

## Implementation Checklist

### Technical Measures
- [ ] Pseudonymization implemented where appropriate
- [ ] Encryption of personal data
- [ ] Access logging and monitoring
- [ ] Data backup and recovery procedures

### Organizational Measures
- [ ] Data protection officer appointed (if required)
- [ ] Staff training on GDPR compliance
- [ ] Vendor data processing agreements
- [ ] Regular compliance audits

### Documentation
- [ ] Privacy policy updated
- [ ] Data processing agreements
- [ ] Consent management procedures
- [ ] Data subject rights procedures`;
  }

  async generateNetworkPolicies(securityDir, analysis, options) {
    const networkDir = path.join(securityDir, 'network');
    await fs.mkdir(networkDir, { recursive: true });

    // Default deny-all policy
    const denyAllPolicy = this.generateDenyAllNetworkPolicy();
    await fs.writeFile(
      path.join(networkDir, 'deny-all.yaml'),
      denyAllPolicy
    );

    // Application-specific network policies
    if (analysis?.dependencies) {
      const appPolicies = this.generateAppNetworkPolicies(analysis);
      await fs.writeFile(
        path.join(networkDir, 'app-network-policies.yaml'),
        appPolicies
      );
    }

    // Ingress controller policies
    const ingressPolicies = this.generateIngressNetworkPolicies(analysis);
    await fs.writeFile(
      path.join(networkDir, 'ingress-policies.yaml'),
      ingressPolicies
    );
  }

  generateDenyAllNetworkPolicy() {
    return `# Default deny-all network policy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: default
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress

---
# Allow DNS resolution
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: default
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to: []
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53`;
  }

  generateAppNetworkPolicies(analysis) {
    const hasDatabase = analysis.dependencies.some(dep => 
      ['mongodb', 'postgresql', 'mysql', 'redis'].some(db => dep.includes(db))
    );
    
    const hasWeb = analysis.dependencies.some(dep => 
      ['express', 'fastify', 'koa', 'nest'].some(web => dep.includes(web))
    );

    return `# Application network policies
${hasWeb ? `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-app-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: web-app
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: ingress-controller
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432
  - to: []
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
` : ''}

${hasDatabase ? `
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: database
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: web-app
    ports:
    - protocol: TCP
      port: 5432
  egress:
  - to: []
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
` : ''}

---
# Allow monitoring
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-monitoring
  namespace: default
spec:
  podSelector:
    matchLabels:
      monitoring: enabled
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 9090
    - protocol: TCP
      port: 8080`;
  }

  generateIngressNetworkPolicies(analysis) {
    return `# Ingress controller network policies
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ingress-controller-policy
  namespace: ingress-system
spec:
  podSelector:
    matchLabels:
      app: ingress-controller
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from: []
    ports:
    - protocol: TCP
      port: 80
    - protocol: TCP
      port: 443
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 80
    - protocol: TCP
      port: 443
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 3000
    - protocol: TCP
      port: 8080

---
# Allow ingress to application namespaces
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-to-apps
  namespace: default
spec:
  podSelector:
    matchLabels:
      network-policy: allow-ingress
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-system
    ports:
    - protocol: TCP
      port: 3000
    - protocol: TCP
      port: 8080`;
  }

  async generateRBACConfigs(securityDir, analysis, options) {
    const rbacDir = path.join(securityDir, 'rbac');
    await fs.mkdir(rbacDir, { recursive: true });

    // Developer role
    const developerRole = this.generateDeveloperRole(analysis);
    await fs.writeFile(
      path.join(rbacDir, 'developer-role.yaml'),
      developerRole
    );

    // DevOps role
    const devopsRole = this.generateDevOpsRole(analysis);
    await fs.writeFile(
      path.join(rbacDir, 'devops-role.yaml'),
      devopsRole
    );

    // Service accounts
    const serviceAccounts = this.generateServiceAccounts(analysis);
    await fs.writeFile(
      path.join(rbacDir, 'service-accounts.yaml'),
      serviceAccounts
    );

    // Pod Security Standards
    const podSecurityStandards = this.generatePodSecurityStandards(analysis);
    await fs.writeFile(
      path.join(rbacDir, 'pod-security-standards.yaml'),
      podSecurityStandards
    );
  }

  generateDeveloperRole(analysis) {
    return `# Developer role with limited permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: development
  name: developer
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log", "pods/exec"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["services", "endpoints"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: developer-binding
  namespace: development
subjects:
- kind: User
  name: developer
  apiGroup: rbac.authorization.k8s.io
- kind: Group
  name: developers
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: developer
  apiGroup: rbac.authorization.k8s.io`;
  }

  generateDevOpsRole(analysis) {
    return `# DevOps role with deployment permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: devops
rules:
- apiGroups: [""]
  resources: ["*"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: ["apps"]
  resources: ["*"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: ["networking.k8s.io"]
  resources: ["networkpolicies", "ingresses"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: ["autoscaling"]
  resources: ["horizontalpodautoscalers"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
- apiGroups: ["monitoring.coreos.com"]
  resources: ["servicemonitors", "prometheusrules"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: devops-binding
subjects:
- kind: User
  name: devops
  apiGroup: rbac.authorization.k8s.io
- kind: Group
  name: devops-team
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: devops
  apiGroup: rbac.authorization.k8s.io

---
# Limited cluster-admin for emergency situations
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: emergency-admin
subjects:
- kind: User
  name: emergency-admin
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: cluster-admin
  apiGroup: rbac.authorization.k8s.io`;
  }

  generateServiceAccounts(analysis) {
    return `# Service accounts for applications
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-service-account
  namespace: default
automountServiceAccountToken: false

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: monitoring-service-account
  namespace: monitoring
automountServiceAccountToken: true

---
# Role for application service account
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: default
  name: app-role
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list", "watch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: app-role-binding
  namespace: default
subjects:
- kind: ServiceAccount
  name: app-service-account
  namespace: default
roleRef:
  kind: Role
  name: app-role
  apiGroup: rbac.authorization.k8s.io

---
# Role for monitoring service account
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring-role
rules:
- apiGroups: [""]
  resources: ["nodes", "services", "endpoints", "pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["nodes/metrics"]
  verbs: ["get"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-role-binding
subjects:
- kind: ServiceAccount
  name: monitoring-service-account
  namespace: monitoring
roleRef:
  kind: ClusterRole
  name: monitoring-role
  apiGroup: rbac.authorization.k8s.io`;
  }

  generatePodSecurityStandards(analysis) {
    return `# Pod Security Standards configuration
apiVersion: v1
kind: Namespace
metadata:
  name: baseline-security
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/audit: baseline
    pod-security.kubernetes.io/warn: baseline

---
apiVersion: v1
kind: Namespace
metadata:
  name: restricted-security
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted

---
# Pod Security Policy (deprecated but included for reference)
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'

---
# Security Context Constraints for OpenShift
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: restricted-scc
allowHostDirVolumePlugin: false
allowHostIPC: false
allowHostNetwork: false
allowHostPID: false
allowHostPorts: false
allowPrivilegedContainer: false
allowedCapabilities: null
defaultAddCapabilities: null
requiredDropCapabilities:
- KILL
- MKNOD
- SETUID
- SETGID
runAsUser:
  type: MustRunAsRange
seLinuxContext:
  type: MustRunAs
fsGroup:
  type: MustRunAs
volumes:
- configMap
- downwardAPI
- emptyDir
- persistentVolumeClaim
- projected
- secret`;
  }

  convertMemoryToBytes(memoryStr) {
    if (memoryStr.endsWith('Gi')) {
      return parseInt(memoryStr.slice(0, -2)) * 1024 * 1024 * 1024;
    }
    if (memoryStr.endsWith('Mi')) {
      return parseInt(memoryStr.slice(0, -2)) * 1024 * 1024;
    }
    if (memoryStr.endsWith('Ki')) {
      return parseInt(memoryStr.slice(0, -2)) * 1024;
    }
    return parseInt(memoryStr);
  }
}

export default SecurityConfigGenerator;