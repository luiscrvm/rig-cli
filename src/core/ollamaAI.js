import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export class OllamaAI {
  constructor() {
    this.logger = new Logger();
    this.baseURL = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || null;
  }

  async checkOllamaInstalled() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`, { timeout: 2000 });
      return true;
    } catch (error) {
      console.log(chalk.yellow('\n⚠️  Ollama is not running or not installed'));
      console.log(chalk.cyan('Install Ollama from: https://ollama.ai'));
      console.log(chalk.cyan('Then run: ollama serve'));
      return false;
    }
  }

  async checkOllamaHealth() {
    try {
      await axios.get(`${this.baseURL}/api/tags`, { timeout: 5000 });
      return true;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Ollama service is not running. Please start it with: ollama serve');
      }
      throw new Error(`Ollama health check failed: ${error.message}`);
    }
  }

  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`);
      return response.data.models || [];
    } catch (error) {
      this.logger.error(`Failed to get Ollama models: ${error.message}`);
      return [];
    }
  }

  async pullModel(modelName) {
    console.log(chalk.cyan(`\n📥 Pulling model ${modelName}...`));
    console.log(chalk.yellow('This may take a few minutes depending on the model size.\n'));
    
    try {
      // Use streaming to show progress
      const response = await axios.post(
        `${this.baseURL}/api/pull`,
        { name: modelName },
        {
          responseType: 'stream',
          timeout: 0 // No timeout for large downloads
        }
      );

      return new Promise((resolve, reject) => {
        let lastStatus = '';
        
        response.data.on('data', (chunk) => {
          try {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            for (const line of lines) {
              const data = JSON.parse(line);
              if (data.status && data.status !== lastStatus) {
                process.stdout.write(`\r${data.status}`);
                lastStatus = data.status;
              }
              if (data.completed && data.total) {
                const percent = Math.round((data.completed / data.total) * 100);
                process.stdout.write(`\rDownloading: ${percent}%`);
              }
            }
          } catch (e) {
            // Ignore JSON parse errors for incomplete chunks
          }
        });

        response.data.on('end', () => {
          console.log(chalk.green('\n✓ Model pulled successfully'));
          resolve(true);
        });

        response.data.on('error', (error) => {
          console.error(chalk.red(`\n✗ Failed to pull model: ${error.message}`));
          reject(error);
        });
      });
    } catch (error) {
      console.error(chalk.red(`Failed to pull model: ${error.message}`));
      return false;
    }
  }

  async selectModel(models) {
    if (!models || models.length === 0) {
      console.log(chalk.yellow('\nNo models found locally.'));
      console.log(chalk.cyan('Recommended models for infrastructure tasks:'));
      console.log('  • llama3.2:3b - Fast and efficient (2GB)');
      console.log('  • mistral:7b - Balanced performance (4GB)');
      console.log('  • mixtral:8x7b - Advanced capabilities (26GB)');
      console.log('  • qwen2.5-coder:7b - Optimized for code (4GB)');
      
      return null;
    }

    // Sort models by size (smaller first for better UX)
    models.sort((a, b) => a.size - b.size);
    
    return models[0].name; // Return first available model
  }

  async ensureModel() {
    const models = await this.getAvailableModels();
    
    if (models.length > 0) {
      this.model = await this.selectModel(models);
      console.log(chalk.green(`\n✓ Using model: ${this.model}`));
      return this.model;
    }

    // No models available, suggest pulling one
    console.log(chalk.yellow('\nNo Ollama models found. Please pull a model first:'));
    console.log(chalk.white('  ollama pull llama3.2:3b'));
    console.log(chalk.white('  ollama pull mistral:7b'));
    console.log(chalk.white('  ollama pull qwen2.5-coder:7b'));
    
    return null;
  }

  async generate(prompt, context = {}) {
    if (!this.model) {
      this.model = await this.ensureModel();
      if (!this.model) {
        throw new Error('No Ollama model available');
      }
    }

    try {
      const systemPrompt = `You are Rig, an expert infrastructure and DevOps assistant. 
You help with GCP, AWS, and Azure cloud platforms, Kubernetes, Docker, CI/CD, and infrastructure as code.
Provide concise, practical advice and solutions. Focus on best practices and security.`;

      // Check if Ollama is responding first
      await this.checkOllamaHealth();

      const response = await axios.post(
        `${this.baseURL}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          system: systemPrompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 2000,
            num_predict: 2000,
            num_ctx: 4096
          }
        },
        {
          timeout: 180000 // Increased to 3 minutes
        }
      );

      return response.data.response;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        this.logger.error('Ollama is not running. Please start Ollama with: ollama serve');
        throw new Error('Ollama service is not running. Please start it with: ollama serve');
      } else if (error.message.includes('timeout')) {
        this.logger.error('Ollama request timed out. The model might be too large or busy.');
        throw new Error('Request timed out. Try using a smaller model or wait for current requests to complete.');
      } else {
        this.logger.error(`Ollama generation failed: ${error.message}`);
        throw error;
      }
    }
  }

  async chat(messages, context = {}) {
    if (!this.model) {
      this.model = await this.ensureModel();
      if (!this.model) {
        throw new Error('No Ollama model available');
      }
    }

    try {
      // Check if Ollama is responding first
      await this.checkOllamaHealth();

      const response = await axios.post(
        `${this.baseURL}/api/chat`,
        {
          model: this.model,
          messages: messages,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: 2000,
            num_ctx: 4096
          }
        },
        {
          timeout: 180000 // Increased to 3 minutes
        }
      );

      return response.data.message.content;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        this.logger.error('Ollama is not running. Please start Ollama with: ollama serve');
        throw new Error('Ollama service is not running. Please start it with: ollama serve');
      } else if (error.message.includes('timeout')) {
        this.logger.error('Ollama request timed out. The model might be too large or busy.');
        throw new Error('Request timed out. Try using a smaller model or wait for current requests to complete.');
      } else {
        this.logger.error(`Ollama chat failed: ${error.message}`);
        throw error;
      }
    }
  }

  async analyzeInfrastructure(issue, context) {
    const prompt = `
Analyze this infrastructure issue:
${issue}

Context:
- Cloud Provider: ${context.provider || 'GCP'}
- Project: ${context.project || 'Unknown'}
- Region: ${context.region || 'Unknown'}
- Environment: ${context.environment || 'Unknown'}

Provide:
1. Root cause analysis
2. Step-by-step solution
3. Prevention measures
4. Relevant GCP/cloud commands if applicable
`;

    return await this.generate(prompt, context);
  }

  async generateScript(task, language = 'bash') {
    const prompt = `
Generate a ${language} script for the following infrastructure task:
${task}

Requirements:
- Include error handling
- Add helpful comments
- Follow best practices
- Make it production-ready
- Use gcloud CLI commands where appropriate

Provide only the script code without explanations.
`;

    return await this.generate(prompt);
  }

  async suggestOptimizations(resources) {
    const prompt = `
Analyze these cloud resources and suggest optimizations:
${JSON.stringify(resources, null, 2)}

Focus on:
1. Cost optimization
2. Performance improvements
3. Security enhancements
4. Scalability recommendations

Provide specific, actionable recommendations.
`;

    return await this.generate(prompt);
  }
}