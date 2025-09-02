#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { config } from 'dotenv';
import { CloudManager } from './core/cloudManager.js';
import { AIAssistant } from './core/aiAssistant.js';
import { InteractiveMode } from './core/interactive.js';
import { Logger } from './utils/logger.js';

config();

const program = new Command();
const logger = new Logger();

console.log(chalk.cyan(figlet.textSync('Rig CLI', { horizontalLayout: 'full' })));

program
  .name('rig')
  .description('AI-powered Rig CLI for cloud infrastructure management')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize Rig CLI configuration')
  .action(async () => {
    const { initConfig } = await import('./commands/init.js');
    await initConfig();
  });

program
  .command('cloud <provider>')
  .description('Manage cloud resources (aws|gcp|azure)')
  .option('-l, --list', 'List resources')
  .option('-r, --region <region>', 'Specify region')
  .option('-t, --type <type>', 'Resource type (instances|storage|network)')
  .option('-v, --verbose', 'Show verbose output and command logs')
  .action(async (provider, options) => {
    const { manageCloud } = await import('./commands/cloud.js');
    await manageCloud(provider, options);
  });

program
  .command('deploy')
  .description('Deploy infrastructure from configuration')
  .option('-f, --file <file>', 'Configuration file (YAML/JSON)')
  .option('-e, --env <env>', 'Environment (dev|staging|prod)')
  .option('--dry-run', 'Preview changes without applying')
  .action(async (options) => {
    const { deploy } = await import('./commands/deploy.js');
    await deploy(options);
  });

program
  .command('monitor')
  .description('Monitor infrastructure health and metrics')
  .option('-s, --service <service>', 'Specific service to monitor')
  .option('-m, --metrics', 'Show detailed metrics')
  .option('-a, --alerts', 'Show active alerts')
  .action(async (options) => {
    const { monitor } = await import('./commands/monitor.js');
    await monitor(options);
  });

program
  .command('troubleshoot')
  .description('AI-assisted troubleshooting')
  .option('-i, --issue <issue>', 'Describe the issue')
  .option('-l, --logs', 'Analyze recent logs')
  .option('-s, --suggest', 'Get AI suggestions')
  .action(async (options) => {
    const { troubleshoot } = await import('./commands/troubleshoot.js');
    await troubleshoot(options);
  });

program
  .command('interactive')
  .alias('i')
  .description('Start interactive Rig assistant mode')
  .action(async () => {
    const interactive = new InteractiveMode();
    await interactive.start();
  });

program
  .command('backup')
  .description('Backup and restore operations')
  .option('-c, --create', 'Create backup')
  .option('-r, --restore <id>', 'Restore from backup')
  .option('-l, --list', 'List available backups')
  .action(async (options) => {
    const { backup } = await import('./commands/backup.js');
    await backup(options);
  });

program
  .command('security')
  .description('Security audit and compliance checks')
  .option('-s, --scan', 'Run vulnerability scan')
  .option('-c, --compliance', 'Check compliance with security standards')
  .option('-r, --report', 'Generate comprehensive security report')
  .action(async (options) => {
    const { security } = await import('./commands/security.js');
    await security(options);
  });

program
  .command('cost')
  .description('Cost analysis and optimization')
  .option('-a, --analyze', 'Analyze current costs')
  .option('-o, --optimize', 'Find cost optimization opportunities')
  .option('-f, --forecast', 'Generate cost forecasts')
  .option('-r, --report', 'Generate comprehensive cost report')
  .action(async (options) => {
    const { cost } = await import('./commands/cost.js');
    await cost(options);
  });

program
  .command('logs')
  .description('Explore local and cloud logs')
  .option('-l, --limit <number>', 'Limit number of log entries to display')
  .option('-e, --export <format>', 'Export logs to file (json|csv)')
  .option('--error', 'Show only error logs')
  .option('-r, --resource <id>', 'Filter logs for a specific resource')
  .option('--cloud', 'Fetch logs from GCP Cloud Logging instead of local logs')
  .option('--since <time>', 'Time range for cloud logs (e.g., 1h, 24h, 7d, 30d)')
  .option('--severity <level>', 'Minimum severity for cloud logs (DEBUG|INFO|WARNING|ERROR|CRITICAL)')
  .option('--project <id>', 'GCP project ID (uses current if not specified)')
  .option('--debug', 'Show raw log entry structure for debugging')
  .action(async (options) => {
    const { logsCommand } = await import('./commands/logs.js');
    await logsCommand(options);
  });

program
  .command('generate [type]')
  .description('Generate Infrastructure as Code configurations')
  .option('-o, --output <dir>', 'Output directory')
  .option('-f, --force', 'Overwrite existing files')
  .option('--analyze', 'Analyze project first')
  .option('--import', 'Import existing cloud resources')
  .action(async (type, options) => {
    const { generate } = await import('./commands/generate.js');
    await generate(type, options);
  });

program
  .command('create [prompt]')
  .description('AI-powered infrastructure creation from natural language')
  .option('-ai, --ai <prompt>', 'AI prompt describing what to create')
  .option('-o, --output <dir>', 'Output directory for generated infrastructure')
  .option('--no-cicd', 'Skip CI/CD pipeline generation')
  .action(async (prompt, options) => {
    const { create } = await import('./commands/create.js');
    await create(prompt, options);
  });

program.parse(process.argv);