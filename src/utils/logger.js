import winston from 'winston';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export class Logger {
  constructor() {
    const logDir = path.join(process.cwd(), 'logs');
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: path.join(logDir, 'error.log'), 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: path.join(logDir, 'combined.log') 
        })
      ]
    });

    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }
  }

  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
    if (process.env.NODE_ENV !== 'production') {
      console.error(chalk.red(`[ERROR] ${message}`));
    }
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
    if (process.env.NODE_ENV !== 'production') {
      console.warn(chalk.yellow(`[WARN] ${message}`));
    }
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  success(message) {
    this.info(message);
    if (process.env.NODE_ENV !== 'production') {
      console.log(chalk.green(`✓ ${message}`));
    }
  }
}