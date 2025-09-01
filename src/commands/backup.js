import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { CloudManager } from '../core/cloudManager.js';
import { Logger } from '../utils/logger.js';

export async function backup(options) {
  const logger = new Logger();
  const cloudManager = new CloudManager();

  console.log(chalk.green.bold('\n💾 BACKUP & RESTORE'));
  console.log(chalk.green('='.repeat(40)));

  try {
    // If no specific action, show interactive menu
    if (!options.create && !options.restore && !options.list) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📦 Create Backup - Backup current infrastructure', value: 'create' },
            { name: '📋 List Backups - Show available backups', value: 'list' },
            { name: '🔄 Restore Backup - Restore from backup', value: 'restore' },
            { name: '🗑️  Delete Backup - Remove old backup', value: 'delete' },
            { name: '⚙️  Backup Settings - Configure backup options', value: 'settings' }
          ]
        }
      ]);
      
      switch (action) {
      case 'create':
        options.create = true;
        break;
      case 'list':
        options.list = true;
        break;
      case 'restore':
        await selectAndRestoreBackup(cloudManager, logger);
        return;
      case 'delete':
        await selectAndDeleteBackup(cloudManager, logger);
        return;
      case 'settings':
        await showBackupSettings(logger);
        return;
      }
    }

    // Initialize cloud manager
    try {
      await cloudManager.initialize();
    } catch (error) {
      logger.warn('Cloud provider not configured. Using local backup mode.');
    }

    // Handle different backup actions
    if (options.create) {
      await createBackup(cloudManager, logger, options);
    } else if (options.restore) {
      await restoreBackup(cloudManager, logger, options.restore);
    } else if (options.list) {
      await listBackups(cloudManager, logger);
    }

    console.log(chalk.blue('\n💡 Backup Tips:'));
    console.log(chalk.gray('• Regular backups are essential for disaster recovery'));
    console.log(chalk.gray('• Test restore procedures periodically'));
    console.log(chalk.gray('• Store backups in multiple locations for redundancy'));

  } catch (error) {
    logger.error(`Backup operation failed: ${error.message}`);
    console.error(chalk.red(`❌ Backup error: ${error.message}`));
  }
}

async function createBackup(cloudManager, logger, options) {
  console.log(chalk.cyan('\n📦 CREATING BACKUP'));
  console.log(chalk.cyan('='.repeat(30)));

  // Prompt for backup type if not specified
  const { backupType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'backupType',
      message: 'What would you like to backup?',
      choices: [
        { name: '🏗️  Infrastructure Configuration - Backup Terraform, K8s configs', value: 'infrastructure' },
        { name: '☁️  Cloud Resources - Backup actual cloud resources', value: 'resources' },
        { name: '🔧 Application Configuration - Backup app configs and secrets', value: 'application' },
        { name: '📦 Complete Backup - Backup everything', value: 'complete' }
      ]
    }
  ]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `backup-${timestamp}`;
  const backupDir = path.join(process.cwd(), '.backups', backupId);

  const spinner = ora('Creating backup...').start();

  try {
    // Create backup directory
    fs.mkdirSync(backupDir, { recursive: true });

    const backupManifest = {
      id: backupId,
      timestamp: new Date().toISOString(),
      type: backupType,
      version: '1.0.0',
      metadata: {
        project: process.env.GCP_PROJECT_ID || 'unknown',
        region: process.env.GCP_REGION || 'unknown',
        creator: 'rig-cli'
      },
      contents: []
    };

    switch (backupType) {
    case 'infrastructure':
      await backupInfrastructure(backupDir, backupManifest, logger);
      break;
    case 'resources':
      await backupCloudResources(backupDir, backupManifest, cloudManager, logger);
      break;
    case 'application':
      await backupApplicationConfigs(backupDir, backupManifest, logger);
      break;
    case 'complete':
      await backupInfrastructure(backupDir, backupManifest, logger);
      await backupCloudResources(backupDir, backupManifest, cloudManager, logger);
      await backupApplicationConfigs(backupDir, backupManifest, logger);
      break;
    }

    // Save backup manifest
    const manifestPath = path.join(backupDir, 'backup-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(backupManifest, null, 2));

    spinner.succeed(`Backup created successfully: ${backupId}`);
    
    console.log(chalk.green('\n✅ Backup Complete!'));
    console.log(chalk.gray(`Backup ID: ${backupId}`));
    console.log(chalk.gray(`Location: ${backupDir}`));
    console.log(chalk.gray(`Type: ${backupType}`));
    console.log(chalk.gray(`Size: ${getDirectorySize(backupDir)} MB`));
    
    console.log(chalk.blue('\n📋 Backup Contents:'));
    backupManifest.contents.forEach(item => {
      console.log(chalk.gray(`• ${item.name} (${item.type})`));
    });

  } catch (error) {
    spinner.fail('Backup creation failed');
    throw error;
  }
}

async function backupInfrastructure(backupDir, manifest, logger) {
  const infraFiles = [
    { pattern: './terraform', type: 'terraform' },
    { pattern: './k8s', type: 'kubernetes' },
    { pattern: './kubernetes', type: 'kubernetes' },
    { pattern: './docker-compose.yml', type: 'docker' },
    { pattern: './Dockerfile', type: 'docker' },
    { pattern: './.github', type: 'cicd' },
    { pattern: './.gitlab-ci.yml', type: 'cicd' }
  ];

  for (const file of infraFiles) {
    if (fs.existsSync(file.pattern)) {
      const targetPath = path.join(backupDir, 'infrastructure', path.basename(file.pattern));
      await copyRecursive(file.pattern, targetPath);
      
      manifest.contents.push({
        name: path.basename(file.pattern),
        type: file.type,
        source: file.pattern,
        backup_path: targetPath
      });
    }
  }
}

async function backupCloudResources(backupDir, manifest, cloudManager, logger) {
  try {
    const resources = await cloudManager.listAllResources();
    
    if (resources && resources.length > 0) {
      const resourcesPath = path.join(backupDir, 'cloud-resources.json');
      fs.writeFileSync(resourcesPath, JSON.stringify(resources, null, 2));
      
      manifest.contents.push({
        name: 'cloud-resources.json',
        type: 'cloud-resources',
        source: 'cloud-api',
        backup_path: resourcesPath,
        resource_count: resources.reduce((sum, group) => sum + (group.items?.length || 0), 0)
      });
    }
  } catch (error) {
    logger.warn('Could not backup cloud resources: ' + error.message);
  }
}

async function backupApplicationConfigs(backupDir, manifest, logger) {
  const configFiles = [
    { pattern: '.env', type: 'environment' },
    { pattern: '.env.example', type: 'environment' },
    { pattern: 'config/', type: 'application-config' },
    { pattern: 'package.json', type: 'dependencies' },
    { pattern: 'requirements.txt', type: 'dependencies' },
    { pattern: 'Pipfile', type: 'dependencies' },
    { pattern: 'go.mod', type: 'dependencies' }
  ];

  for (const file of configFiles) {
    if (fs.existsSync(file.pattern)) {
      const targetPath = path.join(backupDir, 'application', path.basename(file.pattern));
      await copyRecursive(file.pattern, targetPath);
      
      manifest.contents.push({
        name: path.basename(file.pattern),
        type: file.type,
        source: file.pattern,
        backup_path: targetPath
      });
    }
  }
}

async function copyRecursive(source, target) {
  const stats = fs.statSync(source);
  
  if (stats.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    const files = fs.readdirSync(source);
    
    for (const file of files) {
      const sourcePath = path.join(source, file);
      const targetPath = path.join(target, file);
      await copyRecursive(sourcePath, targetPath);
    }
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

function getDirectorySize(dirPath) {
  let size = 0;
  
  function calculateSize(currentPath) {
    const stats = fs.statSync(currentPath);
    
    if (stats.isDirectory()) {
      const files = fs.readdirSync(currentPath);
      for (const file of files) {
        calculateSize(path.join(currentPath, file));
      }
    } else {
      size += stats.size;
    }
  }
  
  try {
    calculateSize(dirPath);
    return (size / (1024 * 1024)).toFixed(2);
  } catch (error) {
    return '0.00';
  }
}

async function listBackups(cloudManager, logger) {
  console.log(chalk.cyan('\n📋 AVAILABLE BACKUPS'));
  console.log(chalk.cyan('='.repeat(35)));

  const backupsDir = path.join(process.cwd(), '.backups');
  
  if (!fs.existsSync(backupsDir)) {
    console.log(chalk.yellow('⚠️  No backups found'));
    console.log(chalk.gray('Create your first backup with: `rig backup --create`'));
    return;
  }

  const spinner = ora('Loading backup list...').start();
  
  try {
    const backupDirs = fs.readdirSync(backupsDir)
      .filter(item => fs.statSync(path.join(backupsDir, item)).isDirectory());
    
    if (backupDirs.length === 0) {
      spinner.succeed('Backup scan completed');
      console.log(chalk.yellow('⚠️  No backups found'));
      return;
    }

    const backups = [];
    
    for (const backupDir of backupDirs) {
      const manifestPath = path.join(backupsDir, backupDir, 'backup-manifest.json');
      
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const dirSize = getDirectorySize(path.join(backupsDir, backupDir));
        
        backups.push({
          ...manifest,
          size: dirSize,
          path: path.join(backupsDir, backupDir)
        });
      }
    }

    spinner.succeed(`Found ${backups.length} backup${backups.length > 1 ? 's' : ''}`);
    
    console.log(chalk.blue('\n📦 Backup List:\n'));
    
    backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    backups.forEach((backup, index) => {
      const age = getTimeAgo(new Date(backup.timestamp));
      
      console.log(`${index + 1}. ${chalk.bold(backup.id)}`);
      console.log(`   Type: ${backup.type}`);
      console.log(`   Size: ${backup.size} MB`);
      console.log(`   Age: ${age}`);
      console.log(`   Contents: ${backup.contents.length} item${backup.contents.length > 1 ? 's' : ''}`);
      console.log(chalk.gray(`   Path: ${backup.path}\n`));
    });

  } catch (error) {
    spinner.fail('Failed to list backups');
    console.error(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function selectAndRestoreBackup(cloudManager, logger) {
  const backupsDir = path.join(process.cwd(), '.backups');
  
  if (!fs.existsSync(backupsDir)) {
    console.log(chalk.yellow('⚠️  No backups found to restore'));
    return;
  }

  // Get available backups
  const backupDirs = fs.readdirSync(backupsDir)
    .filter(item => fs.statSync(path.join(backupsDir, item)).isDirectory());
    
  if (backupDirs.length === 0) {
    console.log(chalk.yellow('⚠️  No backups available for restore'));
    return;
  }

  const backupChoices = backupDirs.map(dir => {
    const manifestPath = path.join(backupsDir, dir, 'backup-manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const age = getTimeAgo(new Date(manifest.timestamp));
      return {
        name: `${manifest.id} (${manifest.type}, ${age})`,
        value: manifest.id
      };
    }
    return { name: dir, value: dir };
  });

  const { selectedBackup } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedBackup',
      message: 'Select backup to restore:',
      choices: backupChoices.concat([{ name: '🔙 Cancel', value: 'cancel' }])
    }
  ]);

  if (selectedBackup === 'cancel') {
    return;
  }

  await restoreBackup(cloudManager, logger, selectedBackup);
}

async function restoreBackup(cloudManager, logger, backupId) {
  console.log(chalk.yellow(`\n🔄 RESTORING BACKUP: ${backupId}`));
  console.log(chalk.yellow('='.repeat(50)));

  const backupPath = path.join(process.cwd(), '.backups', backupId);
  const manifestPath = path.join(backupPath, 'backup-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(chalk.red(`❌ Backup not found: ${backupId}`));
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  console.log(chalk.blue('📋 Backup Information:'));
  console.log(chalk.gray(`ID: ${manifest.id}`));
  console.log(chalk.gray(`Type: ${manifest.type}`));
  console.log(chalk.gray(`Created: ${new Date(manifest.timestamp).toLocaleString()}`));
  console.log(chalk.gray(`Contents: ${manifest.contents.length} items`));

  const { confirmRestore } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmRestore',
      message: '⚠️  This will overwrite existing files. Continue?',
      default: false
    }
  ]);

  if (!confirmRestore) {
    console.log(chalk.yellow('🔙 Restore cancelled'));
    return;
  }

  const spinner = ora('Restoring backup...').start();

  try {
    let restoredCount = 0;

    for (const item of manifest.contents) {
      if (fs.existsSync(item.backup_path)) {
        // Determine restore target
        const restoreTarget = item.source || `./${item.name}`;
        
        if (item.type === 'cloud-resources') {
          // Skip cloud resources for now - would need cloud API calls
          continue;
        }

        await copyRecursive(item.backup_path, restoreTarget);
        restoredCount++;
      }
    }

    spinner.succeed(`Restore completed: ${restoredCount} items restored`);
    
    console.log(chalk.green('\n✅ Restore Complete!'));
    console.log(chalk.gray(`Backup: ${backupId}`));
    console.log(chalk.gray(`Items restored: ${restoredCount}/${manifest.contents.length}`));
    
    console.log(chalk.blue('\n🎯 Next Steps:'));
    console.log(chalk.gray('• Verify restored files are correct'));
    console.log(chalk.gray('• Test your application/infrastructure'));
    console.log(chalk.gray('• Update any environment-specific settings'));

  } catch (error) {
    spinner.fail('Restore failed');
    throw error;
  }
}

async function selectAndDeleteBackup(cloudManager, logger) {
  await listBackups(cloudManager, logger);
  
  const { backupId } = await inquirer.prompt([
    {
      type: 'input',
      name: 'backupId',
      message: 'Enter backup ID to delete (or press Enter to cancel):',
    }
  ]);

  if (!backupId) {
    console.log(chalk.yellow('🔙 Delete cancelled'));
    return;
  }

  const backupPath = path.join(process.cwd(), '.backups', backupId);
  
  if (!fs.existsSync(backupPath)) {
    console.error(chalk.red(`❌ Backup not found: ${backupId}`));
    return;
  }

  const { confirmDelete } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmDelete',
      message: `⚠️  Delete backup ${backupId}? This cannot be undone.`,
      default: false
    }
  ]);

  if (confirmDelete) {
    fs.rmSync(backupPath, { recursive: true, force: true });
    console.log(chalk.green(`✅ Backup deleted: ${backupId}`));
  } else {
    console.log(chalk.yellow('🔙 Delete cancelled'));
  }
}

async function showBackupSettings(logger) {
  console.log(chalk.blue('\n⚙️  BACKUP SETTINGS'));
  console.log(chalk.blue('='.repeat(30)));
  
  console.log(chalk.green('\n📁 Backup Location:'));
  console.log(chalk.gray(`• Local: ${path.join(process.cwd(), '.backups')}`));
  console.log(chalk.gray('• Cloud: Not configured'));
  
  console.log(chalk.green('\n🔄 Backup Schedule:'));
  console.log(chalk.gray('• Automatic: Disabled'));
  console.log(chalk.gray('• Manual: Available'));
  
  console.log(chalk.green('\n📦 Backup Types:'));
  console.log(chalk.gray('• Infrastructure configs (Terraform, K8s, Docker)'));
  console.log(chalk.gray('• Cloud resource metadata'));
  console.log(chalk.gray('• Application configuration files'));
  
  console.log(chalk.blue('\n💡 Recommendations:'));
  console.log(chalk.gray('• Create backups before major changes'));
  console.log(chalk.gray('• Test restore procedures regularly'));
  console.log(chalk.gray('• Store backups in multiple locations'));
  console.log(chalk.gray('• Use `rig backup --create` before deployments'));
}

function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
}

export default backup;