#!/usr/bin/env node

/**
 * Quick test to verify MCP tools are activated in agents
 */

import { ClaudeCodeAgent } from './lib/claude-code-agent.js';

console.log('🧪 Testing MCP Tool Activation\n');

// Create an agent with verbose mode to see MCP config loading
const agent = new ClaudeCodeAgent({
  role: 'test-agent',
  systemPrompt: 'You are a test agent.',
  workingDir: process.cwd(),
  verbose: true,
  timeout: 30000
});

console.log('Agent created with:');
console.log(`  Working dir: ${agent.workingDir}`);
console.log(`  Session ID: ${agent.sessionId}\n`);

console.log('Testing agent query (should show MCP config loading)...\n');

// Simple query that should trigger MCP tool availability
agent.query('List all available tools you have access to. Include MCP tools if available.')
  .then(result => {
    console.log('\n✅ Query succeeded!');
    console.log('\nAgent response:');
    console.log(result.response || result);

    // Check if MCP tools are mentioned
    const responseStr = JSON.stringify(result);
    if (responseStr.includes('sn-tools') || responseStr.includes('trace_component')) {
      console.log('\n🎉 MCP tools are ACTIVE!');
    } else {
      console.log('\n⚠️  MCP tools may not be active (not mentioned in response)');
    }
  })
  .catch(error => {
    console.error('\n❌ Query failed:', error.message);
    console.error(error.stack);
  });
