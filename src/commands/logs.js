import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { stringify } from 'csv-stringify/sync';

export async function logsCommand(options) {
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
  
  // Apply limit if specified
  let displayEntries = logEntries;
  if (options.limit) {
    const limit = parseInt(options.limit);
    if (!isNaN(limit) && limit > 0) {
      displayEntries = logEntries.slice(-limit);
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
  
  console.log(chalk.cyan(`\n📋 Displaying ${displayEntries.length} log entries${options.error ? ' (errors only)' : ''}:\n`));
  
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