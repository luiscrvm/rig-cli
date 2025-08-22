import axios from 'axios';
import { Logger } from '../utils/logger.js';
import { OllamaAI } from './ollamaAI.js';

export class AIAssistant {
  constructor() {
    this.logger = new Logger();
    this.provider = process.env.AI_PROVIDER || 'ollama';
    this.apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    this.context = [];
    
    if (this.provider === 'ollama') {
      this.ollama = new OllamaAI();
    }
    
    // Log the current AI provider configuration
    this.logger.info(`AI Provider configured: ${this.provider}`);
  }

  async getRecommendation(issue, context = {}) {
    try {
      if (this.provider === 'ollama') {
        return await this.ollama.analyzeInfrastructure(issue, context);
      } else if (this.provider === 'openai') {
        const prompt = this.buildPrompt(issue, context);
        return await this.callOpenAI(prompt);
      } else if (this.provider === 'anthropic') {
        const prompt = this.buildPrompt(issue, context);
        return await this.callAnthropic(prompt);
      } else {
        return this.getLocalRecommendation(issue, context);
      }
    } catch (error) {
      this.logger.error(`AI Assistant error: ${error.message}`);
      return this.getLocalRecommendation(issue, context);
    }
  }

  buildPrompt(issue, context) {
    return `
      As a DevOps expert, analyze the following issue and provide recommendations:
      
      Issue: ${issue}
      
      Context:
      - Cloud Provider: ${context.provider || 'Not specified'}
      - Resource Type: ${context.resourceType || 'Not specified'}
      - Environment: ${context.environment || 'Not specified'}
      - Recent Errors: ${JSON.stringify(context.errors || [])}
      
      Please provide:
      1. Root cause analysis
      2. Step-by-step solution
      3. Prevention measures
      4. Best practices
    `;
  }

  async callOpenAI(prompt) {
    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are Rig, an expert infrastructure and DevOps assistant. Help with GCP, AWS, Azure, Kubernetes, Docker, CI/CD, and infrastructure as code. Provide concise, practical advice focusing on best practices and security.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 180000 // 3 minutes timeout
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      if (error.response?.status === 401) {
        this.logger.error('OpenAI API key is invalid or expired');
        throw new Error('Invalid OpenAI API key. Please check your credentials.');
      } else if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.error?.message || 'Bad request';
        this.logger.error(`OpenAI API error (400): ${errorMsg}`);
        throw new Error(`OpenAI API error: ${errorMsg}. The model '${process.env.OPENAI_MODEL || 'gpt-4o-mini'}' may not be available. Try setting OPENAI_MODEL=gpt-4o-mini in your .env file.`);
      } else if (error.message.includes('timeout')) {
        this.logger.error('OpenAI request timed out');
        throw new Error('Request timed out. Please try again.');
      } else {
        this.logger.error(`OpenAI API error: ${error.message}`);
        throw error;
      }
    }
  }

  async callAnthropic(prompt) {
    try {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        messages: [{ 
          role: 'user', 
          content: prompt 
        }],
        system: 'You are Rig, an expert infrastructure and DevOps assistant. Help with GCP, AWS, Azure, Kubernetes, Docker, CI/CD, and infrastructure as code. Provide concise, practical advice focusing on best practices and security.',
        max_tokens: 2000,
        temperature: 0.7
      }, {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: 180000 // 3 minutes timeout
      });

      return response.data.content[0].text;
    } catch (error) {
      if (error.response?.status === 401) {
        this.logger.error('Anthropic API key is invalid or expired');
        throw new Error('Invalid Anthropic API key. Please check your credentials.');
      } else if (error.message.includes('timeout')) {
        this.logger.error('Anthropic request timed out');
        throw new Error('Request timed out. Please try again.');
      } else {
        this.logger.error(`Anthropic API error: ${error.message}`);
        throw error;
      }
    }
  }

  getLocalRecommendation(issue, context) {
    const recommendations = {
      'connection': {
        title: 'Connection Issues',
        steps: [
          '1. Check network connectivity',
          '2. Verify security groups and firewall rules',
          '3. Check service health status',
          '4. Verify credentials and permissions',
          '5. Review recent configuration changes'
        ],
        prevention: [
          'Implement monitoring and alerting',
          'Use connection pooling',
          'Set up retry mechanisms',
          'Maintain updated documentation'
        ]
      },
      'performance': {
        title: 'Performance Issues',
        steps: [
          '1. Analyze resource utilization (CPU, Memory, I/O)',
          '2. Check for bottlenecks in the system',
          '3. Review application logs for slow queries',
          '4. Verify auto-scaling configurations',
          '5. Consider caching strategies'
        ],
        prevention: [
          'Set up performance monitoring',
          'Implement load testing',
          'Use CDN for static content',
          'Optimize database queries'
        ]
      },
      'deployment': {
        title: 'Deployment Issues',
        steps: [
          '1. Verify deployment configuration',
          '2. Check dependency versions',
          '3. Review deployment logs',
          '4. Validate environment variables',
          '5. Test rollback procedures'
        ],
        prevention: [
          'Use CI/CD pipelines',
          'Implement blue-green deployments',
          'Maintain staging environments',
          'Use infrastructure as code'
        ]
      },
      'security': {
        title: 'Security Issues',
        steps: [
          '1. Review security group configurations',
          '2. Check IAM roles and permissions',
          '3. Scan for vulnerabilities',
          '4. Review access logs',
          '5. Verify encryption settings'
        ],
        prevention: [
          'Regular security audits',
          'Implement least privilege principle',
          'Use secrets management tools',
          'Enable logging and monitoring'
        ]
      }
    };

    const category = this.categorizeIssue(issue);
    const recommendation = recommendations[category] || recommendations['connection'];

    return {
      category: recommendation.title,
      analysis: `Based on the issue description, this appears to be a ${category} issue.`,
      steps: recommendation.steps,
      prevention: recommendation.prevention,
      additionalResources: [
        'Check cloud provider documentation',
        'Review system logs',
        'Consult team runbooks'
      ]
    };
  }

  categorizeIssue(issue) {
    const keywords = {
      connection: ['timeout', 'connection', 'refused', 'unreachable', 'network'],
      performance: ['slow', 'performance', 'latency', 'cpu', 'memory', 'load'],
      deployment: ['deploy', 'build', 'ci/cd', 'pipeline', 'release'],
      security: ['permission', 'denied', 'unauthorized', 'security', 'access']
    };

    const issueLower = issue.toLowerCase();
    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => issueLower.includes(word))) {
        return category;
      }
    }
    return 'connection';
  }

  async checkHealth() {
    try {
      if (this.provider === 'ollama') {
        return await this.ollama.checkOllamaHealth();
      } else if (this.provider === 'openai') {
        // Simple check to verify API key validity
        if (!this.apiKey) {
          throw new Error('OpenAI API key not configured');
        }
        return true;
      } else if (this.provider === 'anthropic') {
        // Simple check to verify API key validity
        if (!this.apiKey) {
          throw new Error('Anthropic API key not configured');
        }
        return true;
      }
      return true;
    } catch (error) {
      this.logger.error(`AI health check failed: ${error.message}`);
      return false;
    }
  }

  async generateScript(task, provider, language = 'bash') {
    if (this.provider === 'ollama') {
      return await this.ollama.generateScript(task, language);
    } else if (this.provider === 'openai' || this.provider === 'anthropic') {
      const prompt = `Generate a ${language} script for the following infrastructure task:
${task}

Requirements:
- Include error handling
- Add helpful comments
- Follow best practices
- Make it production-ready
- Use gcloud CLI commands where appropriate

Provide only the script code without explanations.`;
      
      if (this.provider === 'openai') {
        return await this.callOpenAI(prompt);
      } else {
        return await this.callAnthropic(prompt);
      }
    }
    
    const templates = {
      'backup-database': {
        bash: `#!/bin/bash
# Database Backup Script
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="$1"
BACKUP_DIR="/backups"

echo "Starting backup of $DB_NAME..."
mysqldump -u root -p $DB_NAME > "$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql"
gzip "$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql"
echo "Backup completed: ${DB_NAME}_${TIMESTAMP}.sql.gz"`,
        python: `#!/usr/bin/env python3
import subprocess
import datetime
import sys

db_name = sys.argv[1] if len(sys.argv) > 1 else "database"
timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
backup_file = f"/backups/{db_name}_{timestamp}.sql"

print(f"Starting backup of {db_name}...")
subprocess.run(["mysqldump", "-u", "root", "-p", db_name], stdout=open(backup_file, "w"))
subprocess.run(["gzip", backup_file])
print(f"Backup completed: {backup_file}.gz")`
      },
      'health-check': {
        bash: `#!/bin/bash
# Health Check Script
SERVICES=("nginx" "mysql" "redis")

for service in "\${SERVICES[@]}"; do
  if systemctl is-active --quiet $service; then
    echo "✓ $service is running"
  else
    echo "✗ $service is not running"
    systemctl start $service
  fi
done`,
        python: `#!/usr/bin/env python3
import subprocess

services = ["nginx", "mysql", "redis"]

for service in services:
    result = subprocess.run(["systemctl", "is-active", service], capture_output=True, text=True)
    if result.returncode == 0:
        print(f"✓ {service} is running")
    else:
        print(f"✗ {service} is not running")
        subprocess.run(["systemctl", "start", service])`
      }
    };

    return templates[task]?.[language] || this.generateGenericScript(task, language);
  }

  generateGenericScript(task, language) {
    if (language === 'bash') {
      return `#!/bin/bash
# Auto-generated script for: ${task}
echo "Executing task: ${task}"
# Add your implementation here`;
    } else {
      return `#!/usr/bin/env python3
# Auto-generated script for: ${task}
print(f"Executing task: ${task}")
# Add your implementation here`;
    }
  }
}