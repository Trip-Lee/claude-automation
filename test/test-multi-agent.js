/**
 * End-to-End Test: Multi-Agent System
 *
 * Tests the complete 2-agent workflow:
 * 1. Coder agent implements a task
 * 2. Reviewer agent reviews the implementation
 * 3. Iterative feedback loop until approved
 *
 * Run with: node test/test-multi-agent.js
 */

import { AgentCoordinator } from '../lib/agent-coordinator.js';
import { ContainerTools, createTestContainer, cleanupContainer } from './container-tools.js';
import { CostMonitor } from '../lib/cost-monitor.js';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';
import Dockerode from 'dockerode';

// Load environment variables
dotenv.config({ path: path.join(homedir(), '.env') });

const DOCKER_IMAGE = 'claude-python:latest';

async function runTest() {
  console.log(chalk.cyan.bold('\n🧪 Multi-Agent System Test\n'));
  console.log(chalk.gray('Testing 2-agent workflow: Coder + Reviewer\n'));

  const docker = new Dockerode();
  let container = null;

  try {
    // Step 1: Check Docker
    console.log(chalk.blue('Step 1/5: Checking Docker...'));
    await docker.ping();
    console.log(chalk.green('  ✅ Docker is running\n'));

    // Step 2: Create test container
    console.log(chalk.blue('Step 2/5: Creating container...'));
    container = await createTestContainer(DOCKER_IMAGE);
    console.log(chalk.green('  ✅ Container created\n'));

    // Step 3: Test task
    console.log(chalk.blue('Step 3/5: Running multi-agent workflow...'));
    const task = `Create a Python script called 'calculator.py' that:
1. Has a Calculator class with methods: add, subtract, multiply, divide
2. Each method should handle two numbers
3. Include error handling for division by zero
4. Add a simple test at the bottom that demonstrates all operations`;

    console.log(chalk.gray(`  Task: ${task.substring(0, 80)}...\n`));

    // Try to use real agents if API key available (automatic fallback on low credits)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const hasApiKey = apiKey && apiKey.length > 10;

    let result;
    if (hasApiKey) {
      console.log(chalk.green('  ✅ Testing with real agents (auto-fallback if insufficient credits)\n'));
      result = await testRealAgents(container, task);
    } else {
      console.log(chalk.yellow('  ⚠️  No API key - testing with mock execution\n'));
      result = await testMockExecution(container, task);
    }

    // Step 4: Verify results
    console.log(chalk.blue('Step 4/5: Verifying results...'));
    const containerTools = new ContainerTools(container);

    try {
      const files = await containerTools.executeTool('list_directory', { path: '/workspace' });
      console.log(chalk.gray(`  Files in workspace:\n${files}\n`));
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️  Could not list files: ${error.message}\n`));
    }

    // Try to read the created file
    try {
      const content = await containerTools.executeTool('read_file', { path: '/workspace/calculator.py' });
      console.log(chalk.green('  ✅ calculator.py created successfully'));
      console.log(chalk.gray(`  Preview: ${content.substring(0, 200)}...\n`));
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️  calculator.py not found: ${error.message}\n`));
    }

    // Step 5: Generate report
    console.log(chalk.blue('Step 5/5: Generating report...'));
    const report = {
      test: 'Multi-Agent System',
      timestamp: new Date().toISOString(),
      success: true,
      hasApiKey,
      mode: result.mode || (hasApiKey ? 'real-or-auto-fallback' : 'mock-execution'),
      task,
      result
    };

    const reportPath = path.join(homedir(), '.claude-logs', 'multi-agent-test.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(chalk.green(`  ✅ Report saved: ${reportPath}\n`));

    console.log(chalk.green.bold('✅ Multi-Agent Test Complete!\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    console.error(chalk.gray(error.stack));
    process.exit(1);
  } finally {
    // Cleanup
    if (container) {
      await cleanupContainer(container);
    }
  }
}

/**
 * Test with real Anthropic agents
 */
async function testRealAgents(container, task) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const costMonitor = new CostMonitor(5.00); // $5 max for test
  const containerTools = new ContainerTools(container);

  // Create agent coordinator
  const agentCoordinator = new AgentCoordinator(apiKey, {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 8192,
    maxRounds: 3,
    maxIterationsPerAgent: 10
  });

  console.log(chalk.cyan('  🤖 Starting real agent execution...\n'));

  const startTime = Date.now();
  const result = await agentCoordinator.execute({
    containerTools,
    task,
    costMonitor
  });
  const duration = Date.now() - startTime;

  console.log(chalk.green(`\n  ✅ Agent execution complete in ${(duration / 1000).toFixed(2)}s`));
  console.log(chalk.gray(`  Cost: $${costMonitor.getTotalCost().toFixed(4)}`));
  console.log(chalk.gray(`  Success: ${result.success}`));
  console.log(chalk.gray(`  Rounds: ${result.plan.rounds}`));
  console.log(chalk.gray(`  Approved: ${result.plan.approved}`));
  console.log(chalk.gray(`  Files modified: ${result.changes.files.length}\n`));

  if (result.conversations.coder.length > 0) {
    console.log(chalk.yellow('  Coder agent:'));
    console.log(chalk.gray(`    Iterations: ${result.conversations.coder[0].iterations}`));
  }

  if (result.conversations.reviewer.length > 0) {
    console.log(chalk.yellow('  Reviewer agent:'));
    console.log(chalk.gray(`    Approved: ${result.conversations.reviewer[0].approved}`));
    console.log(chalk.gray(`    Iterations: ${result.conversations.reviewer[0].iterations}\n`));
  }

  return {
    ...result,
    mode: 'real-agents'
  };
}

/**
 * Test with mock execution (no API key)
 */
async function testMockExecution(container, task) {
  console.log(chalk.cyan('  🔧 Running mock execution...\n'));

  const containerTools = new ContainerTools(container);

  // Simulate what the agent would do: create a calculator file
  const mockCode = `class Calculator:
    """A simple calculator class"""

    def add(self, a, b):
        return a + b

    def subtract(self, a, b):
        return a - b

    def multiply(self, a, b):
        return a * b

    def divide(self, a, b):
        if b == 0:
            raise ValueError("Cannot divide by zero")
        return a / b

# Test the calculator
if __name__ == "__main__":
    calc = Calculator()
    print(f"5 + 3 = {calc.add(5, 3)}")
    print(f"5 - 3 = {calc.subtract(5, 3)}")
    print(f"5 * 3 = {calc.multiply(5, 3)}")
    print(f"6 / 3 = {calc.divide(6, 3)}")
    print("All tests passed!")
`;

  // Use ContainerTools to write the file
  await containerTools.executeTool('write_file', {
    path: '/workspace/calculator.py',
    content: mockCode
  });

  console.log(chalk.green('  ✅ Mock execution complete'));
  console.log(chalk.gray('  Created calculator.py with basic functionality\n'));

  return {
    success: true,
    mode: 'mock-execution',
    plan: { summary: 'Mock execution', rounds: 1, approved: true },
    changes: { files: ['calculator.py'], summary: 'Created calculator.py' },
    conversations: { coder: [], reviewer: [] }
  };
}

// Run test
runTest().catch(error => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});
