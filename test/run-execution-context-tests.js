#!/usr/bin/env node

/**
 * Run only the Execution Context tests (SN-CB-007, SN-CB-008, SN-CB-009)
 */

import chalk from 'chalk';
import { COMPONENT_BACKEND_TESTS, ComponentBackendTestRunner } from './servicenow-component-backend-tests.js';

async function main() {
  console.log(chalk.cyan.bold('\n🔬 EXECUTION CONTEXT TESTS ONLY\n'));

  // Filter to only execution-context tests
  const executionContextTests = COMPONENT_BACKEND_TESTS.filter(t =>
    t.testCategory === 'execution-context' ||
    t.id === 'SN-CB-007' ||
    t.id === 'SN-CB-008' ||
    t.id === 'SN-CB-009'
  );

  console.log(chalk.gray(`Found ${executionContextTests.length} execution context tests:\n`));
  executionContextTests.forEach(t => {
    console.log(chalk.gray(`  - ${t.id}: ${t.name}`));
  });
  console.log();

  const runner = new ComponentBackendTestRunner();
  await runner.initialize();
  await runner.runTestSuite(executionContextTests, false);
}

main().catch(error => {
  console.error(chalk.red(`\nFatal error: ${error.message}`));
  console.error(error.stack);
  process.exit(1);
});
