import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { stringify } from 'csv-stringify/sync';
import { exec } from 'child_process';
import { promisify } from 'util';
import ora from 'ora';
import { config } from 'dotenv';

config();
const execAsync = promisify(exec);

export async function logsCommand(options) {
  // If --cloud flag is set, fetch from GCP Cloud Logging
  if (options.cloud) {
    return await fetchCloudLogs(options);
  }
  
  // Otherwise, use local logs
  const logsDir = path.join(process.cwd(), 'logs');
  const combinedLogPath = path.join(logsDir, 'combined.log');
  const errorLogPath = path.join(logsDir, 'error.log');
  
  // Check if logs directory exists
  if (!fs.existsSync(logsDir)) {
    console.log(chalk.yellow('No logs directory found. Logs will be created when you run commands.'));
    return;
  }
  
  // Determine which log file to read
  let logPath = combinedLogPath;
  if (options.error) {
    logPath = errorLogPath;
  }
  
  if (!fs.existsSync(logPath)) {
    console.log(chalk.yellow(`No ${options.error ? 'error' : 'combined'} log file found.`));
    return;
  }
  
  // Read log file
  const logContent = fs.readFileSync(logPath, 'utf-8');
  const lines = logContent.split('\n').filter(line => line.trim() !== '');
  
  // Parse log entries
  const logEntries = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      logEntries.push(entry);
    } catch (e) {
      // If line is not valid JSON, skip it
      continue;
    }
  }
  
  // Filter by resource if specified
  let filteredEntries = logEntries;
  if (options.resource) {
    filteredEntries = logEntries.filter(entry => {
      // Check if the resource ID appears in the message
      if (entry.message && entry.message.includes(options.resource)) {
        return true;
      }
      
      // Check other fields for the resource ID
      for (const [key, value] of Object.entries(entry)) {
        if (key !== 'message' && value && 
            typeof value === 'string' && 
            value.includes(options.resource)) {
          return true;
        }
        // Check nested objects
        if (typeof value === 'object' && value !== null) {
          const jsonStr = JSON.stringify(value);
          if (jsonStr.includes(options.resource)) {
            return true;
          }
        }
      }
      
      return false;
    });
    
    if (filteredEntries.length === 0) {
      console.log(chalk.yellow(`No log entries found for resource: ${options.resource}`));
      return;
    }
  }
  
  // Apply limit if specified
  let displayEntries = filteredEntries;
  if (options.limit) {
    const limit = parseInt(options.limit);
    if (!isNaN(limit) && limit > 0) {
      displayEntries = filteredEntries.slice(-limit);
    }
  }
  
  // Export to file if requested
  if (options.export) {
    exportLogs(displayEntries, options.export);
    return;
  }
  
  // Display logs in console
  if (displayEntries.length === 0) {
    console.log(chalk.yellow('No log entries found.'));
    return;
  }
  
  let filterDescription = '';
  if (options.error) filterDescription += ' (errors only)';
  if (options.resource) filterDescription += ` for resource: ${options.resource}`;
  
  console.log(chalk.cyan(`\n📋 Displaying ${displayEntries.length} log entries${filterDescription}:\n`));
  
  for (const entry of displayEntries) {
    displayLogEntry(entry);
  }
  
  console.log(chalk.gray(`\n✨ Total entries displayed: ${displayEntries.length}`));
}

function displayLogEntry(entry) {
  const timestamp = entry.timestamp || 'N/A';
  const level = entry.level || 'info';
  const message = entry.message || '';
  
  let levelColor = chalk.gray;
  switch(level.toLowerCase()) {
  case 'error':
    levelColor = chalk.red;
    break;
  case 'warn':
  case 'warning':
    levelColor = chalk.yellow;
    break;
  case 'info':
    levelColor = chalk.blue;
    break;
  case 'debug':
    levelColor = chalk.gray;
    break;
  default:
    levelColor = chalk.white;
  }
  
  console.log(`${chalk.gray(timestamp)} ${levelColor(`[${level.toUpperCase()}]`)} ${message}`);
  
  // Display additional fields if present
  const excludeFields = ['timestamp', 'level', 'message'];
  const additionalFields = Object.keys(entry).filter(key => !excludeFields.includes(key));
  
  if (additionalFields.length > 0) {
    for (const field of additionalFields) {
      console.log(chalk.gray(`  ${field}: ${JSON.stringify(entry[field])}`));
    }
  }
}

function exportLogs(entries, format) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  let filename;
  let content;
  
  switch(format.toLowerCase()) {
  case 'json': {
    filename = `logs-export-${timestamp}.json`;
    content = JSON.stringify(entries, null, 2);
    break;
  }
  case 'csv': {
    filename = `logs-export-${timestamp}.csv`;
    // Determine all unique fields across all entries
    const allFields = new Set();
    entries.forEach(entry => {
      Object.keys(entry).forEach(key => allFields.add(key));
    });
    
    const fields = Array.from(allFields);
    const csvData = entries.map(entry => {
      const row = {};
      fields.forEach(field => {
        row[field] = entry[field] || '';
      });
      return row;
    });
    
    content = stringify(csvData, {
      header: true,
      columns: fields
    });
    break;
  }
  default:
    console.log(chalk.red(`Unsupported export format: ${format}. Use 'json' or 'csv'.`));
    return;
  }
  
  const exportPath = path.join(process.cwd(), filename);
  fs.writeFileSync(exportPath, content);
  console.log(chalk.green(`✅ Logs exported to: ${exportPath}`));
  console.log(chalk.gray(`   Total entries: ${entries.length}`));
}

async function fetchCloudLogs(options) {
  if (!process.env.GCP_PROJECT_ID) {
    console.log(chalk.red('GCP project not configured. Run "rig init" first.'));
    return;
  }

  const spinner = ora('Fetching logs from GCP Cloud Logging...').start();
  
  try {
    // Build gcloud command
    let command = 'gcloud logging read';
    
    // Add filters
    const filters = [];
    
    // Add severity filter
    if (options.error) {
      filters.push('severity>=ERROR');
    } else if (options.severity) {
      // Map severity levels to GCP format
      const severityMap = {
        'DEBUG': 'DEBUG',
        'INFO': 'INFO',
        'WARNING': 'WARNING',
        'ERROR': 'ERROR',
        'CRITICAL': 'CRITICAL'
      };
      const severity = severityMap[options.severity.toUpperCase()] || options.severity.toUpperCase();
      filters.push(`severity>=${severity}`);
    }
    
    // Add resource filter
    if (options.resource) {
      // Support both resource type and resource name filtering
      if (options.resource.includes('.')) {
        // Looks like a service name (e.g., compute.googleapis.com)
        filters.push(`resource.type="${options.resource}"`);
      } else {
        // General resource filter in log text
        filters.push(`textPayload:"${options.resource}" OR jsonPayload.resource:"${options.resource}"`);
      }
    }
    
    // Add time filter (last 24 hours by default)
    const timeFilter = options.since || '24h';
    // Convert time format to ISO timestamp
    const now = new Date();
    const timeValue = parseInt(timeFilter.slice(0, -1));
    const timeUnit = timeFilter.slice(-1);
    
    let pastTime = new Date(now);
    switch(timeUnit.toLowerCase()) {
    case 'h':
      pastTime.setHours(now.getHours() - timeValue);
      break;
    case 'd':
      pastTime.setDate(now.getDate() - timeValue);
      break;
    case 'm':
      pastTime.setMinutes(now.getMinutes() - timeValue);
      break;
    case 's':
      pastTime.setSeconds(now.getSeconds() - timeValue);
      break;
    default:
      pastTime.setHours(now.getHours() - 24); // Default to 24 hours
    }
    
    filters.push(`timestamp>="${pastTime.toISOString()}"`);
    
    // Combine filters
    if (filters.length > 0) {
      command += ` '${filters.join(' AND ')}'`;
    }
    
    // Add limit
    const limit = options.limit || 100;
    command += ` --limit=${limit}`;
    
    // Add format
    command += ' --format=json';
    
    // Add project (use option or environment variable)
    const projectId = options.project || process.env.GCP_PROJECT_ID;
    command += ` --project=${projectId}`;
    
    spinner.text = 'Executing Cloud Logging query...';
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('WARNING')) {
      spinner.fail('Failed to fetch cloud logs');
      console.error(chalk.red(`Error: ${stderr}`));
      
      // Provide specific guidance for permission errors
      if (stderr.includes('PERMISSION_DENIED')) {
        console.log(chalk.yellow('\n🔐 Permission Issue Detected'));
        console.log(chalk.gray('Your account needs the following IAM roles to access Cloud Logging:'));
        console.log(chalk.gray('• Logging/Logs Viewer (roles/logging.viewer)'));
        console.log(chalk.gray('• Logging/Private Logs Viewer (roles/logging.privateLogViewer)'));
        console.log(chalk.gray('\nTo fix this issue:'));
        console.log(chalk.cyan('1. Ask your GCP admin to grant you logging permissions'));
        console.log(chalk.cyan('2. Or use a service account with proper permissions'));
        console.log(chalk.cyan('3. Or switch to local logs: rig logs (without --cloud flag)'));
        
        console.log(chalk.yellow('\n💡 Alternative Solutions:'));
        console.log(chalk.gray('• Use local logs: rig logs --error --limit 50'));
        console.log(chalk.gray('• Switch GCP project: rig init (to reconfigure)'));
        console.log(chalk.gray('• Check current project: gcloud config get-value project'));
      }
      
      return;
    }
    
    spinner.succeed('Logs fetched successfully');
    
    // Parse the logs
    let logEntries = [];
    if (stdout.trim()) {
      try {
        logEntries = JSON.parse(stdout);
      } catch (e) {
        console.error(chalk.red('Failed to parse log entries'));
        return;
      }
    }
    
    if (logEntries.length === 0) {
      console.log(chalk.yellow('No log entries found in Cloud Logging.'));
      return;
    }
    
    // Transform GCP log format to our format
    const transformedEntries = logEntries.map(entry => {
      // Extract message content from various possible fields
      let message = '';
      
      if (entry.textPayload) {
        message = entry.textPayload;
      } else if (entry.jsonPayload) {
        // Try common message fields
        if (entry.jsonPayload.message) {
          message = entry.jsonPayload.message;
        } else if (entry.jsonPayload.msg) {
          message = entry.jsonPayload.msg;
        } else if (entry.jsonPayload.description) {
          message = entry.jsonPayload.description;
        } else if (entry.jsonPayload.summary) {
          message = entry.jsonPayload.summary;
        } else {
          // Show the entire JSON payload if no specific message field
          message = JSON.stringify(entry.jsonPayload, null, 2);
        }
      } else if (entry.protoPayload) {
        // For audit logs and other proto payloads
        if (entry.protoPayload.methodName) {
          message = `${entry.protoPayload.methodName}`;
          if (entry.protoPayload.resourceName) {
            message += ` on ${entry.protoPayload.resourceName}`;
          }
          if (entry.protoPayload.request) {
            message += ` | Request: ${JSON.stringify(entry.protoPayload.request)}`;
          }
        } else {
          message = JSON.stringify(entry.protoPayload, null, 2);
        }
      } else {
        message = 'No message content';
      }

      return {
        timestamp: entry.timestamp || entry.receiveTimestamp,
        level: entry.severity || 'INFO',
        message: message,
        resource: entry.resource?.type || 'unknown',
        labels: entry.labels || {},
        logName: entry.logName?.split('/').pop() || 'unknown',
        originalEntry: entry // Keep original for debugging
      };
    });
    
    // Export if requested
    if (options.export) {
      exportLogs(transformedEntries, options.export);
      return;
    }
    
    // Display logs
    let filterDescription = ' from GCP Cloud Logging';
    if (options.error) filterDescription += ' (errors only)';
    if (options.resource) filterDescription += ` for resource: ${options.resource}`;
    
    console.log(chalk.cyan(`\n📋 Displaying ${transformedEntries.length} log entries${filterDescription}:\n`));
    
    for (const entry of transformedEntries) {
      displayCloudLogEntry(entry, options.debug);
    }
    
    console.log(chalk.gray(`\n✨ Total entries displayed: ${transformedEntries.length}`));
    
  } catch (error) {
    spinner.fail('Failed to fetch cloud logs');
    console.error(chalk.red('Error:', error.message));
    
    if (error.message.includes('gcloud: command not found')) {
      console.log(chalk.yellow('\n⚠️  Google Cloud SDK is not installed.'));
      console.log(chalk.white('Install it from: https://cloud.google.com/sdk/docs/install'));
    }
  }
}

function displayCloudLogEntry(entry, debug = false) {
  const timestamp = entry.timestamp || 'N/A';
  const level = entry.level || 'INFO';
  const message = entry.message || '';
  const resource = entry.resource || '';
  const logName = entry.logName || '';
  
  let levelColor = chalk.gray;
  switch(level.toUpperCase()) {
  case 'CRITICAL':
  case 'ALERT':
  case 'EMERGENCY':
  case 'ERROR':
    levelColor = chalk.red;
    break;
  case 'WARNING':
    levelColor = chalk.yellow;
    break;
  case 'NOTICE':
  case 'INFO':
    levelColor = chalk.blue;
    break;
  case 'DEBUG':
    levelColor = chalk.gray;
    break;
  default:
    levelColor = chalk.white;
  }
  
  console.log(`${chalk.gray(timestamp)} ${levelColor(`[${level}]`)} ${chalk.cyan(`[${resource}]`)}`);
  
  // Display message with proper formatting
  if (message) {
    // Check if message is JSON and format it nicely
    if (message.startsWith('{') || message.startsWith('[')) {
      try {
        const parsed = JSON.parse(message);
        console.log(chalk.white('  Message:'));
        console.log(chalk.gray('    ' + JSON.stringify(parsed, null, 4).split('\n').join('\n    ')));
      } catch (e) {
        console.log(chalk.white(`  Message: ${message}`));
      }
    } else {
      console.log(chalk.white(`  Message: ${message}`));
    }
  }
  
  // Display additional metadata
  if (logName && logName !== 'unknown') {
    console.log(chalk.gray(`  Log: ${logName}`));
  }
  
  if (entry.labels && Object.keys(entry.labels).length > 0) {
    console.log(chalk.gray(`  Labels: ${JSON.stringify(entry.labels)}`));
  }
  
  // Show raw entry structure if debug mode is enabled
  if (debug && entry.originalEntry) {
    console.log(chalk.yellow('  Raw Entry:'));
    console.log(chalk.gray('    ' + JSON.stringify(entry.originalEntry, null, 4).split('\n').join('\n    ')));
  }
  
  console.log(''); // Add spacing between entries
}