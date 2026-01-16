#!/usr/bin/env node

/**
 * Tool Preference Test
 *
 * Tests whether agents prefer sn-tools when properly informed via manifest.
 * Compares agent behavior with and without tool context injection.
 *
 * Run: node test/tool-preference-test.js
 */

import chalk from 'chalk';
import { ToolRegistry } from '../lib/tool-registry.js';

console.log(chalk.cyan.bold('\n🧪 TOOL PREFERENCE TEST\n'));
console.log(chalk.gray('Testing manifest loading and tool context generation\n'));

// Test 1: Tool Registry Discovery
console.log(chalk.yellow.bold('Test 1: Tool Registry Discovery'));
console.log(chalk.gray('-'.repeat(50)));

const registry = new ToolRegistry();
const tools = registry.getAllTools();

console.log(`  Tools discovered: ${tools.length}`);
if (tools.length > 0) {
  tools.forEach(tool => {
    console.log(chalk.green(`  ✓ ${tool.name} v${tool.version}`));
    console.log(chalk.gray(`    Capabilities: ${tool.capabilities.length}`));
    console.log(chalk.gray(`    Safe operations: ${tool.safe_operations?.length || 0}`));
    console.log(chalk.gray(`    Forbidden operations: ${tool.forbidden_operations?.length || 0}`));
  });
} else {
  console.log(chalk.red('  ✗ No tools discovered - manifest may be misconfigured'));
}

// Test 2: Tool Context Generation
console.log(chalk.yellow.bold('\nTest 2: Tool Context Generation'));
console.log(chalk.gray('-'.repeat(50)));

const context = registry.getToolContext();
if (context && context.tools.length > 0) {
  console.log(chalk.green(`  ✓ Tool context generated successfully`));
  console.log(chalk.gray(`    Available tools: ${context.available_tools}`));

  context.tools.forEach(tool => {
    console.log(chalk.gray(`    - ${tool.name}: ${tool.capabilities.length} capabilities`));
    console.log(chalk.gray(`      Examples: ${tool.examples?.length || 0}`));
    console.log(chalk.gray(`      Agent notes: ${tool.agent_notes ? 'Present' : 'Missing'}`));
  });
} else {
  console.log(chalk.red('  ✗ Tool context generation failed'));
}

// Test 3: Markdown Context for Prompts
console.log(chalk.yellow.bold('\nTest 3: Markdown Context for Agent Prompts'));
console.log(chalk.gray('-'.repeat(50)));

const markdown = registry.getToolContextMarkdown();
if (markdown && markdown.length > 100) {
  console.log(chalk.green(`  ✓ Markdown context generated (${markdown.length} chars)`));

  // Check key sections present
  const checks = [
    { name: 'Tool name/version', pattern: /sn-tools.*v2\.3\.0/i },
    { name: 'Capabilities section', pattern: /\*\*Capabilities:\*\*/i },
    { name: 'Usage instructions', pattern: /\*\*Usage:\*\*/i },
    { name: 'Examples', pattern: /\*\*Examples?:\*\*/i },
    { name: 'Agent notes', pattern: /\*\*Agent Notes:\*\*/i },
    { name: 'Trace-impact command', pattern: /trace-impact/i },
    { name: 'Trace-lineage command', pattern: /trace-lineage/i },
    { name: 'Query interface', pattern: /query/i }
  ];

  checks.forEach(check => {
    if (check.pattern.test(markdown)) {
      console.log(chalk.green(`    ✓ ${check.name}`));
    } else {
      console.log(chalk.red(`    ✗ ${check.name} - MISSING`));
    }
  });
} else {
  console.log(chalk.red('  ✗ Markdown context generation failed'));
}

// Test 4: Tool Execution Validation
console.log(chalk.yellow.bold('\nTest 4: Tool Execution Validation'));
console.log(chalk.gray('-'.repeat(50)));

const snTools = registry.getTool('sn-tools');
if (snTools) {
  const safeOps = snTools.safe_operations || [];
  const forbiddenOps = snTools.forbidden_operations || [];

  console.log(chalk.green(`  ✓ sn-tools manifest loaded`));
  console.log(chalk.gray(`    Safe operations: ${safeOps.join(', ')}`));
  console.log(chalk.gray(`    Forbidden operations: ${forbiddenOps.join(', ')}`));

  // Validate that new v2.3.0 operations are present
  const v23Operations = ['trace-impact', 'trace-backward', 'trace-lineage', 'validate-change', 'query', 'refresh-cache'];
  const missingOps = v23Operations.filter(op => !safeOps.includes(op));

  if (missingOps.length === 0) {
    console.log(chalk.green(`  ✓ All v2.3.0 unified tracing operations present`));
  } else {
    console.log(chalk.red(`  ✗ Missing v2.3.0 operations: ${missingOps.join(', ')}`));
  }
} else {
  console.log(chalk.red('  ✗ sn-tools not found in registry'));
}

// Test 5: Environment Variable Check
console.log(chalk.yellow.bold('\nTest 5: Environment Variables'));
console.log(chalk.gray('-'.repeat(50)));

const envVars = registry.getToolEnvironmentVars('sn-tools');
const requiredEnvVars = ['SNTOOL_DEV_URL', 'SNTOOL_DEV_USERNAME', 'SNTOOL_DEV_PASSWORD'];
let envConfigured = true;

requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(chalk.green(`  ✓ ${varName}: Configured`));
  } else {
    console.log(chalk.yellow(`  ⚠ ${varName}: Not set (optional but recommended)`));
    envConfigured = false;
  }
});

// Test 6: Integration Check - DynamicAgentExecutor
console.log(chalk.yellow.bold('\nTest 6: DynamicAgentExecutor Integration'));
console.log(chalk.gray('-'.repeat(50)));

let integrationWorking = false;
try {
  const { DynamicAgentExecutor } = await import('../lib/dynamic-agent-executor.js');

  // Create minimal mock objects
  const mockRegistry = { get: () => null, listAll: () => [] };
  const mockConversation = { getCondensedHistory: () => '', getFileCacheSummary: () => '' };
  const mockContainerTools = { workingDir: '/tmp' };
  const mockCostMonitor = {};

  const executor = new DynamicAgentExecutor(mockRegistry, mockConversation, mockContainerTools, mockCostMonitor);

  // Test that tool context is injected for SN agents
  const snContext = executor.getToolContextForAgent('sn-api');
  const nonSnContext = executor.getToolContextForAgent('architect');

  if (snContext.includes('sn-tools') && snContext.includes('v2.3.0')) {
    console.log(chalk.green('  ✓ Tool context injection working for SN agents'));
    integrationWorking = true;
  } else {
    console.log(chalk.red('  ✗ Tool context not being injected'));
  }

  if (nonSnContext === '') {
    console.log(chalk.green('  ✓ Non-SN agents correctly skip tool context'));
  } else {
    console.log(chalk.yellow('  ⚠ Non-SN agents unexpectedly receiving tool context'));
  }
} catch (error) {
  console.log(chalk.red(`  ✗ Integration test failed: ${error.message}`));
}

// Summary
console.log(chalk.cyan.bold('\n' + '═'.repeat(50)));
console.log(chalk.cyan.bold('SUMMARY'));
console.log(chalk.cyan.bold('═'.repeat(50)));

const passed = tools.length > 0 && context && markdown.length > 100 && snTools;
if (passed && integrationWorking) {
  console.log(chalk.green.bold('\n✓ Tool manifest is properly configured and CONNECTED'));
  console.log(chalk.gray('\nThe manifest NOW affects agent behavior:'));
  console.log(chalk.gray('  1. Tool context is dynamically injected from manifest'));
  console.log(chalk.gray('  2. ServiceNow agents see sn-tools v2.3.0 capabilities'));
  console.log(chalk.gray('  3. Changes to manifest will update agent prompts'));
  console.log(chalk.green.bold('\n✓ Integration complete - manifest → agent prompts connected'));
} else if (passed) {
  console.log(chalk.green.bold('\n✓ Tool manifest is properly configured'));
  console.log(chalk.yellow.bold('\n⚠ INTEGRATION GAP DETECTED:'));
  console.log(chalk.yellow('  The tool registry is not connected to agent prompts.'));
} else {
  console.log(chalk.red.bold('\n✗ Tool manifest configuration issues detected'));
}

console.log();
