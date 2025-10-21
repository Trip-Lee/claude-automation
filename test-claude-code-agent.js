/**
 * Quick test of ClaudeCodeAgent to debug the hanging issue
 */

import { ClaudeCodeAgent } from './lib/claude-code-agent.js';
import path from 'path';
import { homedir } from 'os';

const projectPath = path.join(homedir(), 'projects', 'test-project');

console.log('Testing ClaudeCodeAgent...\n');
console.log(`Project path: ${projectPath}\n`);

const agent = new ClaudeCodeAgent({
  role: 'architect',
  workingDir: projectPath,
  allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
  verbose: true // Enable verbose to see the command
});

const prompt = `Analyze this project. List the main Python files.`;

console.log('Sending prompt...\n');

try {
  const result = await agent.query(prompt);
  console.log('\n✅ Success!');
  console.log('Response:', result.response.substring(0, 200) + '...');
  console.log('Duration:', result.duration, 'ms');
  console.log('Cost:', result.cost);
} catch (error) {
  console.error('\n❌ Error:', error.message);
}
