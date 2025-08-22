#!/usr/bin/env node

import { OllamaAI } from './src/core/ollamaAI.js';
import chalk from 'chalk';

async function testOllama() {
  console.log(chalk.cyan('🧪 Testing Ollama integration...\n'));
  
  const ollama = new OllamaAI();
  
  try {
    console.log(chalk.yellow('1. Checking Ollama health...'));
    await ollama.checkOllamaHealth();
    console.log(chalk.green('✓ Ollama is healthy\n'));
    
    console.log(chalk.yellow('2. Ensuring model is available...'));
    const model = await ollama.ensureModel();
    console.log(chalk.green(`✓ Using model: ${model}\n`));
    
    console.log(chalk.yellow('3. Testing infrastructure analysis...'));
    const issue = "website seems to be down";
    const context = {
      provider: 'GCP',
      project: 'test-project',
      environment: 'Production'
    };
    
    console.log(chalk.gray('Analyzing issue (this may take 1-3 minutes)...'));
    const result = await ollama.analyzeInfrastructure(issue, context);
    
    console.log(chalk.green('\n✓ Analysis complete!\n'));
    console.log(chalk.cyan('📋 AI Analysis Result:'));
    console.log(chalk.white('='.repeat(60)));
    console.log(result);
    console.log(chalk.white('='.repeat(60)));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    
    if (error.message.includes('timeout')) {
      console.log(chalk.yellow('\n💡 This indicates the model took too long to respond.'));
      console.log(chalk.white('   The timeout has been increased to 3 minutes in the fix.'));
    }
  }
}

testOllama().catch(console.error);