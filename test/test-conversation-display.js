/**
 * Test Conversation Display
 *
 * Demonstrates how agent conversations are displayed to the user
 */

import { AgentCoordinator } from '../lib/agent-coordinator.js';
import chalk from 'chalk';

console.log(chalk.cyan.bold('\n🧪 Agent Conversation Display Demo\n'));

// Create a mock conversation (simulates what real agents would produce)
const mockConversations = {
  coder: [
    {
      plan: `I'll implement the multiply function in main.py.

Here's my plan:
1. Add the multiply(a, b) function
2. Add proper documentation
3. Add test cases in test_main.py
4. Verify everything works`,
      iterations: 3
    },
    {
      plan: `I'll fix the issues the reviewer found:
1. Add error handling for non-numeric inputs
2. Improve the docstring
3. Add more comprehensive tests`,
      iterations: 2
    }
  ],
  reviewer: [
    {
      approved: false,
      feedback: `I found a few issues:

1. The multiply function doesn't handle non-numeric inputs
2. The docstring could be more descriptive
3. Need more test cases for edge cases (negative numbers, zero, etc.)

Please fix these before approval.`,
      iterations: 2
    },
    {
      approved: true,
      feedback: null,
      iterations: 1
    }
  ]
};

// Create an agent coordinator (we just need it for the formatting method)
const agentCoordinator = new AgentCoordinator('dummy-key');

// Display the formatted conversation
console.log(chalk.gray('This is what you\'ll see when real agents work together:\n'));
const transcript = agentCoordinator.formatConversations(mockConversations);
console.log(transcript);

console.log(chalk.cyan('\n📝 Key Features:\n'));
console.log(chalk.white('✓ Real-time updates as agents work'));
console.log(chalk.white('✓ See what tools agents are using'));
console.log(chalk.white('✓ View coder\'s plans and reasoning'));
console.log(chalk.white('✓ See reviewer\'s feedback'));
console.log(chalk.white('✓ Track iterations and rounds'));
console.log(chalk.white('✓ Full transcript saved to file\n'));

console.log(chalk.gray('When you run with --real flag, you\'ll see:'));
console.log(chalk.gray('  - "Coder says: <plan preview>"'));
console.log(chalk.gray('  - "→ Using tools: write_file, execute_command"'));
console.log(chalk.gray('  - "Reviewer says: <feedback preview>"'));
console.log(chalk.gray('  - Full conversation transcript at the end\n'));

console.log(chalk.green('✅ Conversation display is ready!\n'));
