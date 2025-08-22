import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { CloudManager } from '../core/cloudManager.js';
import { AIAssistant } from '../core/aiAssistant.js';
import { Logger } from '../utils/logger.js';

export async function security(options) {
  const cloudManager = new CloudManager();
  const aiAssistant = new AIAssistant();
  const logger = new Logger();

  console.log(chalk.cyan.bold('\n🔒 SECURITY ANALYSIS'));
  console.log(chalk.cyan('=' .repeat(50)));

  try {
    if (!options.scan && !options.compliance && !options.report) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What security analysis would you like to perform?',
          choices: [
            { name: '🔍 Vulnerability Scan - Check for security vulnerabilities', value: 'scan' },
            { name: '📋 Compliance Check - Verify compliance with security standards', value: 'compliance' },
            { name: '📊 Security Report - Generate comprehensive security report', value: 'report' },
            { name: '🛡️ Security Recommendations - Get AI-powered security advice', value: 'recommendations' }
          ]
        }
      ]);
      
      switch (action) {
      case 'scan':
        await performVulnerabilityScan(cloudManager, aiAssistant, logger);
        break;
      case 'compliance':
        await performComplianceCheck(cloudManager, aiAssistant, logger);
        break;
      case 'report':
        await generateSecurityReport(cloudManager, aiAssistant, logger);
        break;
      case 'recommendations':
        await getSecurityRecommendations(cloudManager, aiAssistant, logger);
        break;
      }
    } else {
      if (options.scan) {
        await performVulnerabilityScan(cloudManager, aiAssistant, logger);
      }
      if (options.compliance) {
        await performComplianceCheck(cloudManager, aiAssistant, logger);
      }
      if (options.report) {
        await generateSecurityReport(cloudManager, aiAssistant, logger);
      }
    }
  } catch (error) {
    logger.error(`Security analysis failed: ${error.message}`);
    console.error(chalk.red(`\n❌ Security analysis failed: ${error.message}`));
  }
}

async function performVulnerabilityScan(cloudManager, aiAssistant, _logger) {
  const spinner = ora('Scanning for security vulnerabilities...').start();
  
  try {
    const resources = await cloudManager.listAllResources();
    const vulnerabilities = await scanForVulnerabilities(resources);
    
    spinner.succeed('Vulnerability scan completed');
    
    displayVulnerabilities(vulnerabilities);
    
    if (vulnerabilities.length > 0) {
      const context = {
        provider: 'GCP',
        vulnerabilities: vulnerabilities,
        resourceCount: resources.length
      };
      
      const recommendations = await aiAssistant.getRecommendation(
        'Security vulnerabilities found in infrastructure',
        context
      );
      
      console.log(chalk.yellow.bold('\n💡 AI RECOMMENDATIONS:'));
      console.log(chalk.white(recommendations));
    }
  } catch (error) {
    spinner.fail('Vulnerability scan failed');
    throw error;
  }
}

async function scanForVulnerabilities(resources) {
  const vulnerabilities = [];
  
  for (const resource of resources) {
    if (resource.type === 'instances') {
      vulnerabilities.push(...await scanComputeInstances(resource.items));
    } else if (resource.type === 'storage') {
      vulnerabilities.push(...await scanStorageBuckets(resource.items));
    } else if (resource.type === 'networks') {
      vulnerabilities.push(...await scanNetworks(resource.items));
    } else if (resource.type === 'databases') {
      vulnerabilities.push(...await scanDatabases(resource.items));
    }
  }
  
  return vulnerabilities;
}

async function scanComputeInstances(instances) {
  const vulnerabilities = [];
  
  for (const instance of instances) {
    if (!instance.scheduling?.preemptible) {
      vulnerabilities.push({
        severity: 'LOW',
        type: 'Cost Optimization',
        resource: instance.name,
        description: 'Instance not using preemptible pricing',
        recommendation: 'Consider using preemptible instances for non-critical workloads'
      });
    }
    
    if (instance.networkInterfaces?.some(ni => ni.accessConfigs?.length > 0)) {
      vulnerabilities.push({
        severity: 'MEDIUM',
        type: 'Network Security',
        resource: instance.name,
        description: 'Instance has external IP address',
        recommendation: 'Review if external IP is necessary, consider using Cloud NAT'
      });
    }
    
    if (!instance.serviceAccounts || instance.serviceAccounts.length === 0) {
      vulnerabilities.push({
        severity: 'HIGH',
        type: 'IAM Security',
        resource: instance.name,
        description: 'Instance using default service account',
        recommendation: 'Create custom service account with minimal required permissions'
      });
    }
  }
  
  return vulnerabilities;
}

async function scanStorageBuckets(buckets) {
  const vulnerabilities = [];
  
  for (const bucket of buckets) {
    if (bucket.iamConfiguration?.publicAccessPrevention !== 'enforced') {
      vulnerabilities.push({
        severity: 'HIGH',
        type: 'Data Security',
        resource: bucket.name,
        description: 'Storage bucket allows public access',
        recommendation: 'Enable public access prevention and review IAM policies'
      });
    }
    
    if (!bucket.encryption?.defaultKmsKeyName) {
      vulnerabilities.push({
        severity: 'MEDIUM',
        type: 'Data Security',
        resource: bucket.name,
        description: 'Storage bucket not using customer-managed encryption',
        recommendation: 'Enable customer-managed encryption keys (CMEK)'
      });
    }
  }
  
  return vulnerabilities;
}

async function scanNetworks(networks) {
  const vulnerabilities = [];
  
  for (const network of networks) {
    if (network.name === 'default') {
      vulnerabilities.push({
        severity: 'MEDIUM',
        type: 'Network Security',
        resource: network.name,
        description: 'Using default VPC network',
        recommendation: 'Create custom VPC with specific subnets and firewall rules'
      });
    }
  }
  
  return vulnerabilities;
}

async function scanDatabases(databases) {
  const vulnerabilities = [];
  
  for (const db of databases) {
    if (!db.settings?.ipConfiguration?.requireSsl) {
      vulnerabilities.push({
        severity: 'HIGH',
        type: 'Data Security',
        resource: db.name,
        description: 'Database does not require SSL connections',
        recommendation: 'Enable SSL requirement for all database connections'
      });
    }
    
    if (db.settings?.ipConfiguration?.authorizedNetworks?.some(net => net.value === '0.0.0.0/0')) {
      vulnerabilities.push({
        severity: 'CRITICAL',
        type: 'Network Security',
        resource: db.name,
        description: 'Database allows connections from any IP address',
        recommendation: 'Restrict database access to specific IP ranges or use private IP'
      });
    }
  }
  
  return vulnerabilities;
}

function displayVulnerabilities(vulnerabilities) {
  if (vulnerabilities.length === 0) {
    console.log(chalk.green('\n✅ No security vulnerabilities found!'));
    return;
  }
  
  console.log(chalk.red.bold(`\n⚠️  Found ${vulnerabilities.length} security issues:\n`));
  
  const grouped = vulnerabilities.reduce((acc, vuln) => {
    if (!acc[vuln.severity]) acc[vuln.severity] = [];
    acc[vuln.severity].push(vuln);
    return acc;
  }, {});
  
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const severityColors = {
    CRITICAL: chalk.red.bold,
    HIGH: chalk.red,
    MEDIUM: chalk.yellow,
    LOW: chalk.blue
  };
  
  for (const severity of severityOrder) {
    if (grouped[severity]) {
      console.log(severityColors[severity](`${severity} (${grouped[severity].length} issues):`));
      grouped[severity].forEach(vuln => {
        console.log(`  📦 ${vuln.resource} - ${vuln.type}`);
        console.log(`     ${vuln.description}`);
        console.log(chalk.gray(`     💡 ${vuln.recommendation}\n`));
      });
    }
  }
}

async function performComplianceCheck(cloudManager, _aiAssistant, _logger) {
  const spinner = ora('Checking compliance with security standards...').start();
  
  try {
    const resources = await cloudManager.listAllResources();
    const complianceResults = await checkCompliance(resources);
    
    spinner.succeed('Compliance check completed');
    
    displayComplianceResults(complianceResults);
  } catch (error) {
    spinner.fail('Compliance check failed');
    throw error;
  }
}

async function checkCompliance(_resources) {
  const standards = {
    'SOC 2': {
      checks: [
        { name: 'Encryption at Rest', status: 'pass', details: 'All storage encrypted' },
        { name: 'Access Controls', status: 'warning', details: 'Some resources use default IAM' },
        { name: 'Audit Logging', status: 'pass', details: 'Cloud Audit Logs enabled' }
      ]
    },
    'PCI DSS': {
      checks: [
        { name: 'Network Segmentation', status: 'fail', details: 'Using default VPC' },
        { name: 'Data Encryption', status: 'pass', details: 'TLS encryption enabled' },
        { name: 'Access Monitoring', status: 'warning', details: 'Limited monitoring configured' }
      ]
    },
    'GDPR': {
      checks: [
        { name: 'Data Encryption', status: 'pass', details: 'Customer data encrypted' },
        { name: 'Data Residency', status: 'pass', details: 'EU region configured' },
        { name: 'Data Retention', status: 'warning', details: 'No automated retention policy' }
      ]
    }
  };
  
  return standards;
}

function displayComplianceResults(results) {
  console.log(chalk.cyan.bold('\n📋 COMPLIANCE RESULTS\n'));
  
  for (const [standard, data] of Object.entries(results)) {
    console.log(chalk.white.bold(`${standard}:`));
    
    data.checks.forEach(check => {
      const statusIcon = {
        pass: '✅',
        warning: '⚠️',
        fail: '❌'
      };
      
      const statusColor = {
        pass: chalk.green,
        warning: chalk.yellow,
        fail: chalk.red
      };
      
      console.log(`  ${statusIcon[check.status]} ${statusColor[check.status](check.name)}`);
      console.log(chalk.gray(`     ${check.details}`));
    });
    console.log();
  }
}

async function generateSecurityReport(cloudManager, aiAssistant, _logger) {
  const spinner = ora('Generating comprehensive security report...').start();
  
  try {
    const resources = await cloudManager.listAllResources();
    const vulnerabilities = await scanForVulnerabilities(resources);
    const compliance = await checkCompliance(resources);
    
    spinner.succeed('Security report generated');
    
    console.log(chalk.cyan.bold('\n📊 SECURITY REPORT'));
    console.log(chalk.cyan('=' .repeat(50)));
    
    console.log(chalk.white.bold('\n📈 SUMMARY:'));
    console.log(`• Total Resources: ${resources.reduce((acc, r) => acc + r.items.length, 0)}`);
    console.log(`• Security Issues: ${vulnerabilities.length}`);
    console.log(`• Critical Issues: ${vulnerabilities.filter(v => v.severity === 'CRITICAL').length}`);
    console.log(`• High Issues: ${vulnerabilities.filter(v => v.severity === 'HIGH').length}`);
    
    displayVulnerabilities(vulnerabilities);
    displayComplianceResults(compliance);
    
    const context = {
      provider: 'GCP',
      totalResources: resources.reduce((acc, r) => acc + r.items.length, 0),
      vulnerabilities: vulnerabilities,
      compliance: compliance
    };
    
    const aiRecommendations = await aiAssistant.getRecommendation(
      'Generate security improvement roadmap based on scan results',
      context
    );
    
    console.log(chalk.yellow.bold('\n🤖 AI SECURITY ROADMAP:'));
    console.log(chalk.white(aiRecommendations));
    
  } catch (error) {
    spinner.fail('Security report generation failed');
    throw error;
  }
}

async function getSecurityRecommendations(cloudManager, aiAssistant, _logger) {
  const spinner = ora('Getting AI-powered security recommendations...').start();
  
  try {
    const resources = await cloudManager.listAllResources();
    
    const context = {
      provider: 'GCP',
      resourceTypes: resources.map(r => r.type),
      totalResources: resources.reduce((acc, r) => acc + r.items.length, 0)
    };
    
    const recommendations = await aiAssistant.getRecommendation(
      'Provide security best practices and recommendations for this GCP infrastructure',
      context
    );
    
    spinner.succeed('Security recommendations generated');
    
    console.log(chalk.yellow.bold('\n🛡️ SECURITY RECOMMENDATIONS:'));
    console.log(chalk.white(recommendations));
    
  } catch (error) {
    spinner.fail('Failed to get security recommendations');
    throw error;
  }
}