#!/usr/bin/env node

/**
 * Execution Context Simulation Test
 *
 * Tests the execution context injection and tracking WITHOUT making actual API calls.
 * This verifies the logic works correctly by simulating agent execution flow.
 */

import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(chalk.cyan.bold('\n🔬 EXECUTION CONTEXT SIMULATION TEST\n'));
console.log(chalk.gray('Testing execution context injection and tracking logic\n'));

// Import the DynamicAgentExecutor to test its behavior
async function loadExecutor() {
  // We need to mock the dependencies
  const { DynamicAgentExecutor } = await import('../lib/dynamic-agent-executor.js');
  return DynamicAgentExecutor;
}

// Mock registry
const mockRegistry = {
  get: (name) => ({
    name,
    description: `Mock ${name} agent`,
    metadata: { icon: '🤖', color: 'cyan' },
    factory: () => ({
      executeWithTools: async () => ({
        response: 'Mock response',
        cost: 0.01,
        totalDuration: 1000
      })
    })
  }),
  listAll: () => [
    { name: 'sn-api' },
    { name: 'sn-scripting' },
    { name: 'reviewer' }
  ]
};

// Mock conversation
const mockConversation = {
  getCondensedHistory: () => 'Previous context...',
  getFileCacheSummary: () => 'No files cached yet.',
  add: () => {}
};

// Mock container tools
const mockContainerTools = {
  workingDir: '/tmp/test'
};

// Mock cost monitor
const mockCostMonitor = {
  addCost: () => {}
};

// Test 1: Verify execution context is discovered for SN agents
async function testDiscovery() {
  console.log(chalk.yellow('\n📋 Test 1: Execution Context Discovery\n'));

  try {
    const DynamicAgentExecutor = await loadExecutor();

    const executor = new DynamicAgentExecutor(
      mockRegistry,
      mockConversation,
      mockContainerTools,
      mockCostMonitor,
      { verbose: false }
    );

    // Call getAvailableExecutionContext directly
    const context = executor.getAvailableExecutionContext();

    const hasContext = context.includes('Execution Context Available');
    const hasTable = context.includes('x_cadso_automate_email');

    console.log(chalk.gray(`  Context discovered: ${hasContext}`));
    console.log(chalk.gray(`  Contains target table: ${hasTable}`));

    if (hasContext && hasTable) {
      console.log(chalk.green(`  ✓ Discovered execution context for x_cadso_automate_email`));
      console.log(chalk.green('\n  Result: PASS'));
      return { name: 'Discovery', passed: true };
    } else {
      console.log(chalk.red(`  ✗ Did not discover expected context`));
      console.log(chalk.red('\n  Result: FAIL'));
      return { name: 'Discovery', passed: false };
    }
  } catch (err) {
    console.log(chalk.red(`  ✗ Error: ${err.message}`));
    return { name: 'Discovery', passed: false, error: err.message };
  }
}

// Test 2: Verify context is injected for ServiceNow agents
async function testInjection() {
  console.log(chalk.yellow('\n📋 Test 2: Context Injection for SN Agents\n'));

  try {
    const DynamicAgentExecutor = await loadExecutor();

    const executor = new DynamicAgentExecutor(
      mockRegistry,
      mockConversation,
      mockContainerTools,
      mockCostMonitor,
      { verbose: false }
    );

    // Test with SN agent - should inject
    const snContext = executor.getToolContextForAgent('sn-scripting');
    const hasInjection = snContext.includes('Execution Context Available');

    // Test with non-SN agent - should NOT inject
    const nonSnContext = executor.getToolContextForAgent('reviewer');
    const noInjection = !nonSnContext.includes('Execution Context Available');

    console.log(chalk.gray(`  SN agent has context: ${hasInjection}`));
    console.log(chalk.gray(`  Non-SN agent no context: ${noInjection}`));

    if (hasInjection && noInjection) {
      console.log(chalk.green(`  ✓ Context correctly injected for SN agents only`));
      console.log(chalk.green('\n  Result: PASS'));
      return { name: 'Injection', passed: true };
    } else {
      console.log(chalk.red(`  ✗ Injection logic failed`));
      console.log(chalk.red('\n  Result: FAIL'));
      return { name: 'Injection', passed: false };
    }
  } catch (err) {
    console.log(chalk.red(`  ✗ Error: ${err.message}`));
    return { name: 'Injection', passed: false, error: err.message };
  }
}

// Test 3: Verify tracking captures queries
async function testTracking() {
  console.log(chalk.yellow('\n📋 Test 3: Usage Tracking\n'));

  try {
    const DynamicAgentExecutor = await loadExecutor();

    const executor = new DynamicAgentExecutor(
      mockRegistry,
      mockConversation,
      mockContainerTools,
      mockCostMonitor,
      { verbose: false }
    );

    // Simulate agent response that contains execution context queries
    const mockResponse = `
      I'll first check what happens when creating this record.

      Running: npm run cache-query -- x_cadso_automate_email insert

      The execution context shows:
      - 11 Business Rules will fire
      - Risk level is HIGH
      - Tables affected: x_cadso_automate_email_send

      Based on this context, I'll proceed carefully...
    `;

    // Track the usage
    const queries = executor.trackExecutionContextUsage('sn-scripting', mockResponse);

    const foundQuery = queries.length > 0;
    const correctTable = queries.some(q => q.table === 'x_cadso_automate_email');

    console.log(chalk.gray(`  Found queries: ${queries.length}`));
    console.log(chalk.gray(`  Correct table detected: ${correctTable}`));

    if (foundQuery && correctTable) {
      console.log(chalk.green(`  ✓ Tracking correctly detected execution context usage`));
      console.log(chalk.green('\n  Result: PASS'));
      return { name: 'Tracking', passed: true };
    } else {
      console.log(chalk.red(`  ✗ Tracking failed to detect usage`));
      console.log(chalk.red('\n  Result: FAIL'));
      return { name: 'Tracking', passed: false };
    }
  } catch (err) {
    console.log(chalk.red(`  ✗ Error: ${err.message}`));
    return { name: 'Tracking', passed: false, error: err.message };
  }
}

// Test 4: Verify summary generation
async function testSummary() {
  console.log(chalk.yellow('\n📋 Test 4: Summary Generation\n'));

  try {
    const DynamicAgentExecutor = await loadExecutor();

    const executor = new DynamicAgentExecutor(
      mockRegistry,
      mockConversation,
      mockContainerTools,
      mockCostMonitor,
      { verbose: false }
    );

    // Trigger discovery and injection
    executor.getToolContextForAgent('sn-api');

    // Simulate usage tracking
    executor.trackExecutionContextUsage('sn-api', 'npm run cache-query -- x_cadso_automate_email insert');

    // Get summary
    const summary = executor.getExecutionContextSummary();

    console.log(chalk.gray(`  Tables available: ${summary.tablesAvailable}`));
    console.log(chalk.gray(`  Agents injected: ${summary.agentsInjected}`));
    console.log(chalk.gray(`  Agents queried: ${summary.agentsQueried}`));
    console.log(chalk.gray(`  Usage rate: ${summary.usageRate}`));

    const hasSummary = summary.tablesAvailable > 0;
    const hasUsageRate = summary.usageRate !== 'N/A';

    if (hasSummary && hasUsageRate) {
      console.log(chalk.green(`  ✓ Summary generation working correctly`));
      console.log(chalk.green('\n  Result: PASS'));
      return { name: 'Summary', passed: true };
    } else {
      console.log(chalk.red(`  ✗ Summary incomplete`));
      console.log(chalk.red('\n  Result: FAIL'));
      return { name: 'Summary', passed: false };
    }
  } catch (err) {
    console.log(chalk.red(`  ✗ Error: ${err.message}`));
    return { name: 'Summary', passed: false, error: err.message };
  }
}

// Test 5: Verify prompt building includes context
async function testPromptBuilding() {
  console.log(chalk.yellow('\n📋 Test 5: Prompt Building with Context\n'));

  try {
    const DynamicAgentExecutor = await loadExecutor();

    const executor = new DynamicAgentExecutor(
      mockRegistry,
      mockConversation,
      mockContainerTools,
      mockCostMonitor,
      { verbose: false }
    );

    // Build a prompt for an SN agent
    const prompt = executor.buildAgentPrompt('sn-scripting', mockRegistry.get('sn-scripting'), {
      task: 'Create a new email record on x_cadso_automate_email'
    });

    const hasExecutionContext = prompt.includes('Execution Context Available');
    const hasTable = prompt.includes('x_cadso_automate_email');
    const hasCacheQuery = prompt.includes('cache-query');

    console.log(chalk.gray(`  Prompt has execution context: ${hasExecutionContext}`));
    console.log(chalk.gray(`  Prompt mentions table: ${hasTable}`));
    console.log(chalk.gray(`  Prompt has cache-query command: ${hasCacheQuery}`));

    if (hasExecutionContext && hasTable && hasCacheQuery) {
      console.log(chalk.green(`  ✓ Prompt includes execution context correctly`));
      console.log(chalk.green('\n  Result: PASS'));
      return { name: 'Prompt Building', passed: true };
    } else {
      console.log(chalk.red(`  ✗ Prompt missing context`));
      console.log(chalk.red('\n  Result: FAIL'));
      return { name: 'Prompt Building', passed: false };
    }
  } catch (err) {
    console.log(chalk.red(`  ✗ Error: ${err.message}`));
    return { name: 'Prompt Building', passed: false, error: err.message };
  }
}

// Run all tests
async function runTests() {
  const startTime = Date.now();
  const results = [];

  results.push(await testDiscovery());
  results.push(await testInjection());
  results.push(await testTracking());
  results.push(await testSummary());
  results.push(await testPromptBuilding());

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Summary
  console.log(chalk.cyan.bold('\n' + '═'.repeat(60)));
  console.log(chalk.cyan.bold('                    TEST SUMMARY'));
  console.log(chalk.cyan.bold('═'.repeat(60) + '\n'));

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const icon = result.passed ? chalk.green('✓') : chalk.red('✗');
    console.log(`  ${icon} ${result.name}`);
    if (result.passed) passed++;
    else failed++;
  }

  console.log(chalk.gray(`\n  Duration: ${duration}s`));
  console.log(chalk.gray(`  Passed: ${passed}/${results.length}`));

  if (failed === 0) {
    console.log(chalk.green.bold('\n  ✓ ALL TESTS PASSED\n'));
    console.log(chalk.cyan('  Execution context system is ready for agent testing!\n'));
  } else {
    console.log(chalk.red.bold(`\n  ✗ ${failed} TEST(S) FAILED\n`));
  }

  return { passed, failed, results };
}

// Execute
runTests().catch(console.error);
