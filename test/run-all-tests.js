#!/usr/bin/env node

/**
 * Unified Test Runner
 * Runs ALL tests in the claude-automation test suite:
 * - Unit tests (fast, focused)
 * - Integration tests (moderate, component interaction)
 * - Stress tests (long, performance validation)
 * - ServiceNow agent tests (very long, full end-to-end workflows)
 */

import { spawn } from 'child_process';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(chalk.cyan.bold('\n🧪 UNIFIED TEST SUITE - Complete System Validation\n'));
console.log(chalk.gray('This will run ALL tests including long-running ServiceNow agent tests\n'));

const testCategories = [
  {
    name: 'Unit Tests',
    description: 'Fast, focused tests of individual components',
    script: 'test:unit',
    estimatedTime: '30-60 seconds',
    required: true
  },
  {
    name: 'Smoke Tests',
    description: 'Quick sanity checks of core functionality',
    script: 'test:smoke',
    estimatedTime: '10-20 seconds',
    required: true
  },
  {
    name: 'Validation Suite',
    description: 'Infrastructure and integration validation',
    script: 'test:validate',
    estimatedTime: '3-5 seconds',
    required: true
  },
  {
    name: 'Stress Tests',
    description: 'Performance and load testing',
    script: 'test:stress',
    estimatedTime: '5-15 minutes',
    required: false
  },
  {
    name: 'ServiceNow Capability Tests',
    description: 'AI agent capability validation (10 tests)',
    command: 'node',
    args: ['test/servicenow-capability-tests.js'],
    estimatedTime: '45-90 minutes',
    required: false,
    cost: '$3-6 USD'
  },
  {
    name: 'ServiceNow Component-Backend Tests',
    description: 'Component-backend integration validation (6 tests)',
    command: 'node',
    args: ['test/servicenow-component-backend-tests.js'],
    estimatedTime: '40-60 minutes',
    required: false,
    cost: '$2-4 USD'
  }
];

const results = {
  passed: [],
  failed: [],
  skipped: [],
  startTime: Date.now()
};

async function runTestCategory(category) {
  const categoryStart = Date.now();

  console.log(chalk.bold(`\n${'═'.repeat(70)}`));
  console.log(chalk.bold(`${category.name.toUpperCase()}`));
  console.log(chalk.bold(`${'═'.repeat(70)}`));
  console.log(chalk.gray(`${category.description}`));
  console.log(chalk.yellow(`Estimated time: ${category.estimatedTime}`));
  if (category.cost) {
    console.log(chalk.yellow(`Estimated cost: ${category.cost}`));
  }
  console.log();

  return new Promise((resolve) => {
    let command, args;

    if (category.script) {
      command = 'npm';
      args = ['run', category.script];
    } else {
      command = category.command;
      args = category.args;
    }

    const testProcess = spawn(command, args, {
      stdio: 'inherit',
      cwd: join(__dirname, '..')
    });

    testProcess.on('close', (code) => {
      const duration = ((Date.now() - categoryStart) / 1000).toFixed(1);

      if (code === 0) {
        console.log(chalk.green.bold(`\n✅ ${category.name} PASSED (${duration}s)\n`));
        results.passed.push({ name: category.name, duration });
        resolve(true);
      } else {
        console.log(chalk.red.bold(`\n❌ ${category.name} FAILED (${duration}s)\n`));
        results.failed.push({ name: category.name, duration, exitCode: code });
        resolve(false);
      }
    });

    testProcess.on('error', (error) => {
      console.log(chalk.red.bold(`\n❌ ${category.name} ERROR: ${error.message}\n`));
      results.failed.push({ name: category.name, error: error.message });
      resolve(false);
    });
  });
}

async function main() {
  // Check for --quick flag to skip long-running tests
  const quickMode = process.argv.includes('--quick');
  const includeServiceNow = process.argv.includes('--servicenow');

  if (quickMode) {
    console.log(chalk.yellow('🚀 Quick mode enabled - skipping long-running tests\n'));
  }

  if (includeServiceNow) {
    console.log(chalk.yellow('🔧 ServiceNow tests enabled - this will take 90-150 minutes\n'));
  }

  // Run tests in sequence
  for (const category of testCategories) {
    // Skip optional tests in quick mode
    if (quickMode && !category.required) {
      console.log(chalk.gray(`⊘ Skipping ${category.name} (quick mode)\n`));
      results.skipped.push(category.name);
      continue;
    }

    // Skip ServiceNow tests unless explicitly enabled
    if (category.name.includes('ServiceNow') && !includeServiceNow) {
      console.log(chalk.gray(`⊘ Skipping ${category.name} (use --servicenow to enable)\n`));
      results.skipped.push(category.name);
      continue;
    }

    await runTestCategory(category);
  }

  // Print summary
  console.log(chalk.bold(`\n${'═'.repeat(70)}`));
  console.log(chalk.bold('TEST SUITE SUMMARY'));
  console.log(chalk.bold(`${'═'.repeat(70)}\n`));

  const totalDuration = ((Date.now() - results.startTime) / 1000).toFixed(1);

  if (results.passed.length > 0) {
    console.log(chalk.green.bold(`✅ Passed: ${results.passed.length}`));
    results.passed.forEach(r => {
      console.log(chalk.green(`   - ${r.name} (${r.duration}s)`));
    });
    console.log();
  }

  if (results.failed.length > 0) {
    console.log(chalk.red.bold(`❌ Failed: ${results.failed.length}`));
    results.failed.forEach(r => {
      console.log(chalk.red(`   - ${r.name} (${r.duration}s)${r.exitCode ? ` [exit ${r.exitCode}]` : ''}`));
    });
    console.log();
  }

  if (results.skipped.length > 0) {
    console.log(chalk.gray.bold(`⊘  Skipped: ${results.skipped.length}`));
    results.skipped.forEach(name => {
      console.log(chalk.gray(`   - ${name}`));
    });
    console.log();
  }

  console.log(chalk.cyan(`⏱️  Total Duration: ${totalDuration}s`));
  console.log();

  // Usage hints
  if (results.skipped.length > 0 && !includeServiceNow) {
    console.log(chalk.yellow('💡 Tip: Use --servicenow to run ServiceNow agent tests (long)'));
  }
  if (!quickMode) {
    console.log(chalk.yellow('💡 Tip: Use --quick to skip long-running tests'));
  }
  console.log();

  // Exit with appropriate code
  if (results.failed.length > 0) {
    console.log(chalk.red.bold('❌ SOME TESTS FAILED\n'));
    process.exit(1);
  } else {
    console.log(chalk.green.bold('✅ ALL TESTS PASSED\n'));
    process.exit(0);
  }
}

main().catch(error => {
  console.error(chalk.red('\n💥 Fatal error running tests:'));
  console.error(chalk.red(error.stack));
  process.exit(1);
});
