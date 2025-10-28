#!/usr/bin/env node

/**
 * Unit Test Runner
 * Runs all unit tests in test/unit/ directory
 */

import { spawn } from 'child_process';
import { readdir } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(chalk.cyan.bold('\n🧪 Running Unit Tests\n'));

const unitTestDir = join(__dirname, 'unit');

async function runTests() {
  try {
    // Find all test files
    const files = await readdir(unitTestDir);
    const testFiles = files.filter(f => f.endsWith('.test.js'));

    if (testFiles.length === 0) {
      console.log(chalk.yellow('No test files found in test/unit/\n'));
      process.exit(0);
    }

    console.log(chalk.gray(`Found ${testFiles.length} test file(s)\n`));

    // Run tests with Node's test runner
    const testPaths = testFiles.map(f => join(unitTestDir, f));

    const testProcess = spawn('node', ['--test', ...testPaths], {
      stdio: 'inherit'
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green.bold('\n✅ All unit tests passed!\n'));
      } else {
        console.log(chalk.red.bold('\n❌ Some unit tests failed\n'));
      }
      process.exit(code);
    });

  } catch (error) {
    console.error(chalk.red('\n❌ Error running tests:'), error.message);
    process.exit(1);
  }
}

runTests();
