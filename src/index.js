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
  .option('-a, --audit', 'Run security audit')
  .option('-c, --compliance <standard>', 'Check compliance (CIS|PCI|HIPAA)')
  .option('-f, --fix', 'Auto-fix security issues')
  .action(async (options) => {
    const { security } = await import('./commands/security.js');
    await security(options);
  });

program
  .command('cost')
  .description('Cost analysis and optimization')
  .option('-a, --analyze', 'Analyze current costs')
  .option('-o, --optimize', 'Get optimization recommendations')
  .option('-b, --budget <amount>', 'Set budget alerts')
  .action(async (options) => {
    const { costAnalysis } = await import('./commands/cost.js');
    await costAnalysis(options);
  });

program.parse(process.argv);