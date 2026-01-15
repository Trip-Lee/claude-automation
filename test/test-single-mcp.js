#!/usr/bin/env node

/**
 * Run a single ServiceNow test to verify MCP metrics collection
 */

import { ComponentBackendTestRunner, COMPONENT_BACKEND_TESTS } from './test/servicenow-component-backend-tests.js';
import chalk from 'chalk';

console.log(chalk.cyan.bold('🧪 Testing MCP Metrics Collection\n'));
console.log('Running: SN-CB-001 (Trace Component to Backend Tables)\n');
console.log('This will verify:');
console.log('  ✓ MCP tools are used by agents');
console.log('  ✓ Progressive context building triggers if needed');
console.log('  ✓ MCP metrics are captured and reported');
console.log('  ✓ mcp-metrics.json is saved\n');

const runner = new ComponentBackendTestRunner();

// Run just the first test
const firstTest = COMPONENT_BACKEND_TESTS[0];

runner.initialize()
  .then(() => runner.runTest(firstTest))
  .then(result => {
    console.log(chalk.cyan.bold('\n📊 Test Complete!\n'));

    // Check for MCP metrics
    if (result.mcpMetrics) {
      console.log(chalk.green('✅ MCP Metrics Captured:\n'));
      console.log('  Tool calls:', result.mcpMetrics.tool_calls);
      console.log('  Avg response size:', result.mcpMetrics.average_response_size_kb, 'KB');
      console.log('  Truncated responses:', result.mcpMetrics.truncated_responses);

      if (result.mcpMetrics.by_tool) {
        console.log('\n  By tool:');
        for (const [tool, metrics] of Object.entries(result.mcpMetrics.by_tool)) {
          console.log(`    ${tool}: ${metrics.calls} calls, ${metrics.avg_size_kb} KB avg`);
        }
      }
    } else {
      console.log(chalk.yellow('⚠️  No MCP metrics captured (tools may not have been used)'));
    }

    // Check for mcp-metrics.json file
    import('fs').then(fs => {
      const metricsPath = `test-outputs/${firstTest.id}/mcp-metrics.json`;
      if (fs.existsSync(metricsPath)) {
        console.log(chalk.green(`\n✅ MCP metrics file saved: ${metricsPath}`));
      } else {
        console.log(chalk.yellow(`\n⚠️  MCP metrics file not found: ${metricsPath}`));
      }
    });
  })
  .catch(error => {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    console.error(error.stack);
    process.exit(1);
  });
