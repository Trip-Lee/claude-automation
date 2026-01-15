#!/usr/bin/env node

/**
 * Workflow Test Runner
 *
 * Tests a single ServiceNow test using the conversation-based workflow approach.
 * This validates whether conversation context management improves test results.
 */

import { WorkflowExecutor } from '../lib/workflow-executor.js';
import { getWorkflow } from '../lib/servicenow-workflows.js';
import { AgentRegistry } from '../lib/agent-registry.js';
import { registerServiceNowAgents } from '../lib/servicenow-agents.js';
import chalk from 'chalk';

async function runWorkflowTest(testId) {
  console.log(chalk.cyan.bold(`\n🔬 WORKFLOW TEST: ${testId}\n`));

  // Get workflow definition
  const workflow = getWorkflow(testId);
  if (!workflow) {
    console.error(chalk.red(`❌ No workflow defined for ${testId}`));
    console.error(chalk.yellow(`   Available workflows: SN-CB-001, SN-CB-002, SN-CB-006`));
    process.exit(1);
  }

  console.log(chalk.white(`Workflow: ${workflow.name}`));
  console.log(chalk.white(`Steps: ${workflow.steps.length}`));
  console.log(chalk.white(`Deliverable: ${workflow.deliverable}\n`));

  // Initialize agent registry
  const registry = new AgentRegistry();
  registerServiceNowAgents(registry);

  // Get agent (use sn-scripting for ServiceNow tasks)
  const agentConfig = registry.get('sn-scripting');
  if (!agentConfig) {
    console.error(chalk.red(`❌ Agent not found: sn-scripting`));
    process.exit(1);
  }

  // Create agent instance
  const agent = agentConfig.factory({
    workingDir: process.cwd(),
    testMode: true,
    verbose: true,
    timeout: 15 * 60 * 1000, // 15 minutes
    maxRetries: 2
  });

  console.log(chalk.gray(`Agent: ${agentConfig.name} (${agentConfig.description})`));
  console.log(chalk.gray(`Session ID: ${agent.sessionId}\n`));

  // Create workflow executor
  const executor = new WorkflowExecutor({
    verbose: true,
    workingDir: process.cwd(),
    enableCaching: true
  });

  // Execute workflow
  const startTime = Date.now();

  try {
    console.log(chalk.cyan('─'.repeat(60)));
    console.log(chalk.cyan.bold('STARTING WORKFLOW EXECUTION'));
    console.log(chalk.cyan('─'.repeat(60)) + '\n');

    const result = await executor.executeWorkflow(agent, workflow);

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log('\n' + chalk.cyan('─'.repeat(60)));
    console.log(chalk.cyan.bold('WORKFLOW EXECUTION COMPLETE'));
    console.log(chalk.cyan('─'.repeat(60)) + '\n');

    if (result.success) {
      console.log(chalk.green.bold(`✅ SUCCESS`));
      console.log(chalk.white(`Duration: ${duration}s`));
      console.log(chalk.white(`Steps completed: ${result.steps.length}`));

      if (result.stats) {
        console.log(chalk.white(`\nContext Stats:`));
        console.log(chalk.white(`  - Total messages: ${result.stats.totalMessages}`));
        console.log(chalk.white(`  - Cached messages: ${result.stats.cachedMessages}`));
        console.log(chalk.white(`  - sn-tools outputs captured: ${result.stats.snToolsOutputsCaptured}`));
        console.log(chalk.white(`  - Turn count: ${result.stats.turnCount}`));
      }

      console.log(chalk.white(`\nDeliverable: ${workflow.deliverable}`));
      console.log(chalk.gray(`Check the file to see if it includes:`));
      console.log(chalk.gray(`  - sn-tools command outputs`));
      console.log(chalk.gray(`  - Security Analysis section`));
      console.log(chalk.gray(`  - Performance Analysis section`));
      console.log(chalk.gray(`  - Dependencies documentation`));

    } else {
      console.log(chalk.red.bold(`❌ FAILED`));
      console.log(chalk.red(`Error: ${result.error}`));
      console.log(chalk.white(`Duration: ${duration}s`));
      console.log(chalk.white(`Steps failed: ${result.stepsFailed || 1}`));
    }

  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log('\n' + chalk.red('─'.repeat(60)));
    console.log(chalk.red.bold('WORKFLOW EXECUTION FAILED'));
    console.log(chalk.red('─'.repeat(60)) + '\n');
    console.error(chalk.red(`❌ Error: ${error.message}`));
    console.log(chalk.white(`Duration: ${duration}s`));
    process.exit(1);
  }
}

// Parse command line arguments
const testId = process.argv[2] || 'SN-CB-001';

console.log(chalk.gray('Starting workflow test runner...'));
console.log(chalk.gray(`Test ID: ${testId}\n`));

runWorkflowTest(testId)
  .then(() => {
    console.log(chalk.green('\n✅ Test runner completed successfully'));
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red('\n❌ Test runner failed:'), error);
    process.exit(1);
  });
