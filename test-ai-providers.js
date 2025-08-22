#!/usr/bin/env node

import { AIAssistant } from './src/core/aiAssistant.js';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testAIProvider() {
  console.log(chalk.cyan('🧪 Testing AI Provider Integration...\n'));
  
  const aiAssistant = new AIAssistant();
  const provider = process.env.AI_PROVIDER || 'ollama';
  
  console.log(chalk.yellow(`Testing provider: ${provider}`));
  
  try {
    // Test 1: Health check
    console.log(chalk.yellow('\n1. Checking AI provider health...'));
    const isHealthy = await aiAssistant.checkHealth();
    if (isHealthy) {
      console.log(chalk.green('✓ AI provider is healthy'));
    } else {
      console.log(chalk.red('✗ AI provider health check failed'));
      return;
    }
    
    // Test 2: Get recommendation
    console.log(chalk.yellow('\n2. Testing infrastructure analysis...'));
    const issue = "website is responding slowly";
    const context = {
      provider: 'GCP',
      environment: 'Production',
      resourceType: 'Compute Engine'
    };
    
    console.log(chalk.gray('Analyzing issue (this may take 1-3 minutes)...'));
    const recommendation = await aiAssistant.getRecommendation(issue, context);
    
    console.log(chalk.green('\n✓ Analysis complete!\n'));
    console.log(chalk.cyan('📋 AI Analysis Result:'));
    console.log(chalk.white('='.repeat(60)));
    
    if (typeof recommendation === 'string') {
      console.log(recommendation);
    } else {
      if (recommendation.category) {
        console.log(chalk.yellow(`Category: ${recommendation.category}`));
      }
      if (recommendation.analysis) {
        console.log(chalk.white(`\nAnalysis:\n${recommendation.analysis}`));
      }
      if (recommendation.steps) {
        console.log(chalk.green('\nResolution Steps:'));
        recommendation.steps.forEach(step => console.log(`  ${step}`));
      }
      if (recommendation.prevention) {
        console.log(chalk.blue('\nPrevention Measures:'));
        recommendation.prevention.forEach(measure => console.log(`  • ${measure}`));
      }
    }
    console.log(chalk.white('='.repeat(60)));
    
    // Test 3: Generate script (if supported)
    if (provider !== 'none') {
      console.log(chalk.yellow('\n3. Testing script generation...'));
      const script = await aiAssistant.generateScript('backup-database', 'gcp', 'bash');
      
      if (script) {
        console.log(chalk.green('\n✓ Script generation successful!'));
        console.log(chalk.cyan('\nGenerated Script Preview (first 10 lines):'));
        const lines = script.split('\n').slice(0, 10);
        lines.forEach(line => console.log(chalk.gray(line)));
        if (script.split('\n').length > 10) {
          console.log(chalk.gray('... [truncated]'));
        }
      }
    }
    
    console.log(chalk.green('\n✅ All tests passed successfully!'));
    console.log(chalk.cyan(`\n${provider} provider is working correctly.`));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    
    if (error.message.includes('API key')) {
      console.log(chalk.yellow('\n💡 Make sure your API key is set in the .env file:'));
      if (provider === 'openai') {
        console.log(chalk.white('   OPENAI_API_KEY=your-api-key-here'));
      } else if (provider === 'anthropic') {
        console.log(chalk.white('   ANTHROPIC_API_KEY=your-api-key-here'));
      }
    } else if (error.message.includes('not running')) {
      console.log(chalk.yellow('\n💡 Ollama is not running. Start it with:'));
      console.log(chalk.white('   ollama serve'));
    } else if (error.message.includes('timeout')) {
      console.log(chalk.yellow('\n💡 Request timed out. This might be due to:'));
      console.log(chalk.white('   • Large model taking time to respond'));
      console.log(chalk.white('   • Network connectivity issues'));
      console.log(chalk.white('   • API service temporarily unavailable'));
    }
    
    console.log(chalk.cyan('\n📝 Current configuration:'));
    console.log(chalk.white(`   AI_PROVIDER=${provider}`));
    if (provider === 'ollama') {
      console.log(chalk.white(`   OLLAMA_MODEL=${process.env.OLLAMA_MODEL || 'not set'}`));
      console.log(chalk.white(`   OLLAMA_HOST=${process.env.OLLAMA_HOST || 'http://localhost:11434'}`));
    } else if (provider === 'openai') {
      const hasKey = process.env.OPENAI_API_KEY ? 'configured' : 'not configured';
      console.log(chalk.white(`   OPENAI_API_KEY=${hasKey}`));
      console.log(chalk.white(`   OPENAI_MODEL=${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`));
    } else if (provider === 'anthropic') {
      const hasKey = process.env.ANTHROPIC_API_KEY ? 'configured' : 'not configured';
      console.log(chalk.white(`   ANTHROPIC_API_KEY=${hasKey}`));
      console.log(chalk.white(`   ANTHROPIC_MODEL=${process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'}`));
    }
  }
}

// Run the test
testAIProvider().catch(console.error);