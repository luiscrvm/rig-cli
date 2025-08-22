# DevOps Assistant CLI

An AI-powered CLI tool designed to help DevOps engineers manage cloud infrastructure across AWS, GCP, and Azure. This tool provides intelligent assistance for troubleshooting, monitoring, deployment, and infrastructure management.

## Features

### 🚀 Core Capabilities
- **Multi-Cloud Support**: Seamless management across AWS, GCP, and Azure
- **AI-Powered Assistance**: Intelligent troubleshooting and recommendations
- **Interactive Mode**: Guided DevOps operations with intuitive prompts
- **Real-time Monitoring**: Track infrastructure health and metrics
- **Cost Analysis**: Monitor and optimize cloud spending
- **Security Auditing**: Automated security checks and compliance monitoring
- **Automated Backups**: Schedule and manage infrastructure backups

### 🤖 AI Integration
- **Smart Troubleshooting**: AI analyzes issues and provides step-by-step solutions
- **Best Practice Recommendations**: Get suggestions based on DevOps best practices
- **Script Generation**: Automatically generate scripts for common tasks
- **Root Cause Analysis**: Deep dive into infrastructure problems

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd devops-cli

# Install dependencies
npm install

# Make the CLI globally available
npm link

# Initialize configuration
devops init
```

## Quick Start

### 1. Initial Setup
```bash
# Configure your cloud providers and AI assistant
devops init

# This will prompt you to:
# - Select cloud providers (AWS/GCP/Azure)
# - Enter credentials for each provider
# - Choose AI provider (OpenAI/Anthropic/Local)
```

### 2. Interactive Mode
```bash
# Start the interactive assistant
devops interactive

# Or use the shorthand
devops i
```

### 3. Quick Commands
```bash
# List AWS EC2 instances
devops cloud aws --list --type instances --region us-east-1

# Troubleshoot an issue with AI assistance
devops troubleshoot --issue "database connection timeout" --suggest

# Monitor services
devops monitor --metrics

# Run security audit
devops security --audit
```

## Command Reference

### `devops init`
Initialize and configure the CLI tool
```bash
devops init
```

### `devops cloud <provider>`
Manage cloud resources
```bash
# List resources
devops cloud aws --list --type instances --region us-east-1
devops cloud gcp --list --type storage
devops cloud azure --list

# Supported resource types:
# - instances (VMs/EC2)
# - storage (S3/Cloud Storage/Blob)
# - network (VPC/Networks)
# - database (RDS/Cloud SQL)
```

### `devops deploy`
Deploy infrastructure from configuration
```bash
# Deploy from config file
devops deploy --file infrastructure.yaml --env production

# Dry run to preview changes
devops deploy --file config.json --dry-run
```

### `devops monitor`
Monitor infrastructure health
```bash
# Show all services
devops monitor

# Monitor specific service with metrics
devops monitor --service webserver --metrics

# Show active alerts
devops monitor --alerts
```

### `devops troubleshoot`
AI-assisted troubleshooting
```bash
# Interactive troubleshooting
devops troubleshoot

# Direct issue analysis
devops troubleshoot --issue "high CPU usage on production server"

# Analyze logs
devops troubleshoot --logs

# Get AI suggestions
devops troubleshoot --issue "deployment failed" --suggest
```

### `devops backup`
Backup and restore operations
```bash
# Create backup
devops backup --create

# List backups
devops backup --list

# Restore from backup
devops backup --restore backup-id-123
```

### `devops security`
Security audit and compliance
```bash
# Run security audit
devops security --audit

# Check compliance
devops security --compliance CIS
devops security --compliance PCI

# Auto-fix security issues
devops security --fix
```

### `devops cost`
Cost analysis and optimization
```bash
# Analyze current costs
devops cost --analyze

# Get optimization recommendations
devops cost --optimize

# Set budget alerts
devops cost --budget 5000
```

## Configuration

### Environment Variables (.env)
```bash
# AWS Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=us-east-1

# GCP Configuration
GCP_PROJECT_ID=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json

# Azure Configuration
AZURE_SUBSCRIPTION_ID=your_subscription_id
AZURE_TENANT_ID=your_tenant_id
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret

# AI Configuration
AI_PROVIDER=openai
OPENAI_API_KEY=your_api_key
# or
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_api_key
```

### Config File (~/.devops-cli/config.json)
```json
{
  "providers": ["AWS", "GCP", "Azure"],
  "aiProvider": "openai",
  "defaultRegion": "us-east-1",
  "defaultEnvironment": "development"
}
```

## Use Cases

### 1. New Engineer Onboarding
Help new team members quickly understand and manage infrastructure:
```bash
# Start interactive mode for guided experience
devops interactive

# View all resources in the current environment
devops cloud aws --list

# Get help with specific issues
devops troubleshoot --issue "how to connect to production database"
```

### 2. Incident Response
Quickly diagnose and resolve production issues:
```bash
# Analyze the issue with AI
devops troubleshoot --issue "website is down" --logs --suggest

# Monitor affected services
devops monitor --service webserver --metrics

# Check recent changes
devops cloud aws --list --type instances --region us-east-1
```

### 3. Cost Optimization
Identify and reduce unnecessary cloud spending:
```bash
# Analyze current costs
devops cost --analyze

# Get AI recommendations
devops cost --optimize

# Set up budget alerts
devops cost --budget 10000
```

### 4. Security Compliance
Ensure infrastructure meets security standards:
```bash
# Run comprehensive audit
devops security --audit

# Check specific compliance
devops security --compliance HIPAA

# Auto-fix issues
devops security --fix
```

### 5. Disaster Recovery
Manage backups and recovery procedures:
```bash
# Create backup before major changes
devops backup --create

# List available backups
devops backup --list

# Restore if needed
devops backup --restore backup-2024-01-20
```

## Architecture

```
devops-cli/
├── src/
│   ├── index.js           # Main CLI entry point
│   ├── commands/          # CLI command implementations
│   │   ├── init.js
│   │   ├── cloud.js
│   │   ├── deploy.js
│   │   ├── monitor.js
│   │   ├── troubleshoot.js
│   │   ├── backup.js
│   │   ├── security.js
│   │   └── cost.js
│   ├── core/              # Core business logic
│   │   ├── cloudManager.js
│   │   ├── aiAssistant.js
│   │   └── interactive.js
│   ├── providers/         # Cloud provider implementations
│   │   ├── aws.js
│   │   ├── gcp.js
│   │   └── azure.js
│   └── utils/            # Utility functions
│       └── logger.js
├── tests/                # Test files
├── docs/                 # Documentation
├── scripts/              # Helper scripts
└── package.json
```

## AI Assistant Features

### Local Mode (No API Required)
The tool includes a local AI mode that provides recommendations based on:
- Common DevOps patterns and best practices
- Pre-configured troubleshooting workflows
- Template-based script generation
- Rule-based issue categorization

### API-Based AI (Enhanced Features)
When configured with OpenAI or Anthropic:
- Natural language understanding of complex issues
- Context-aware recommendations
- Custom script generation
- Advanced root cause analysis
- Learning from your infrastructure patterns

## Best Practices

1. **Always run `devops init` first** to properly configure credentials
2. **Use interactive mode** when learning or exploring features
3. **Enable logging** for audit trails and debugging
4. **Regular backups** before major infrastructure changes
5. **Security audits** should be run weekly in production
6. **Cost analysis** should be reviewed monthly
7. **Keep credentials secure** - never commit .env files

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   ```bash
   # Reconfigure credentials
   devops init
   ```

2. **Permission Denied**
   - Ensure your cloud credentials have necessary permissions
   - Check IAM roles and policies

3. **AI Assistant Not Working**
   - Verify API keys are correctly set
   - Switch to local mode if API is unavailable

4. **Resource Not Found**
   - Check region settings
   - Verify resource exists in specified location

## Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Security

- Credentials are stored locally and never transmitted to third parties
- AI providers only receive sanitized issue descriptions
- All cloud operations use official SDKs with secure connections
- Regular security audits are built into the tool

## License

MIT License - See LICENSE file for details

## Support

- GitHub Issues: Report bugs and request features
- Documentation: Check the docs/ folder
- Community: Join our Discord server

## Roadmap

- [ ] Kubernetes integration
- [ ] Terraform/CloudFormation support
- [ ] Slack/Teams notifications
- [ ] Custom plugin system
- [ ] Mobile app companion
- [ ] GraphQL API
- [ ] Multi-tenancy support
- [ ] Advanced analytics dashboard

---

Built with ❤️ for the DevOps community