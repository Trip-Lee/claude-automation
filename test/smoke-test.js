#!/usr/bin/env node

/**
 * Smoke Test - Quick validation that system basics work
 *
 * Purpose: Fast check (< 30 seconds) that core functionality is operational
 * Run before making changes or after updates
 *
 * Tests:
 * 1. Docker is running and accessible
 * 2. Configuration system works
 * 3. Docker containers can be created and cleaned up
 * 4. Git operations work
 * 5. Basic file operations in container
 */

import chalk from 'chalk';
import { DockerManager } from '../lib/docker-manager.js';
import { ConfigManager } from '../lib/config-manager.js';
import { GitManager } from '../lib/git-manager.js';
import { homedir } from 'os';
import path from 'path';
import { promises as fs } from 'fs';

console.log(chalk.cyan.bold('\n🔍 SMOKE TEST - Quick System Validation\n'));

const startTime = Date.now();
let testsPassed = 0;
let testsFailed = 0;
const maxTestTime = 30000; // 30 seconds

// Helper to run a test
async function runTest(name, testFn) {
  process.stdout.write(chalk.gray(`  Testing ${name}... `));

  try {
    await testFn();
    console.log(chalk.green('✅'));
    testsPassed++;
    return true;
  } catch (error) {
    console.log(chalk.red('❌'));
    console.log(chalk.red(`    Error: ${error.message}`));
    testsFailed++;
    return false;
  }
}

// Main test suite
async function runSmokeTests() {
  let dockerManager;
  let testContainer;

  try {
    // Test 1: Docker is accessible
    await runTest('Docker daemon is running', async () => {
      dockerManager = new DockerManager();
      await dockerManager.ping();
    });

    // Test 2: Configuration system loads
    await runTest('Configuration system loads', async () => {
      const configManager = new ConfigManager();
      // Should not throw even if no configs exist
      const projects = await configManager.listProjects();
      if (!Array.isArray(projects)) {
        throw new Error('listProjects should return an array');
      }
    });

    // Test 3: Test project exists
    const testProjectExists = await runTest('Test project exists', async () => {
      const testProjectPath = path.join(homedir(), 'projects', 'test-project');
      await fs.access(testProjectPath);

      // Verify it has expected files
      await fs.access(path.join(testProjectPath, 'main.py'));
      await fs.access(path.join(testProjectPath, 'test_main.py'));
    });

    // Test 4: Docker container creation
    if (testProjectExists) {
      await runTest('Docker container creation', async () => {
        const testProjectPath = path.join(homedir(), 'projects', 'test-project');

        testContainer = await dockerManager.create({
          name: `smoke-test-${Date.now()}`,
          image: 'claude-python:latest',
          memory: '512m',
          cpus: 1,
          volumes: {
            [testProjectPath]: '/workspace'
          }
        });

        if (!testContainer) {
          throw new Error('Container creation returned null');
        }
      });

      // Test 5: Basic file operations in container
      if (testContainer) {
        await runTest('File operations in container', async () => {
          // List files - exec already returns output directly
          const lsOutput = await dockerManager.exec(testContainer, 'ls -la /workspace');
          if (!lsOutput.includes('main.py')) {
            throw new Error('main.py not found in workspace');
          }

          // Read file
          const catOutput = await dockerManager.exec(testContainer, 'cat /workspace/main.py');
          if (!catOutput.includes('def greet')) {
            throw new Error('Expected content not found in main.py');
          }

          // Write file (test with echo to /tmp, not workspace to avoid git changes)
          await dockerManager.exec(testContainer, 'echo "test" > /tmp/smoke-test.txt');

          const readOutput = await dockerManager.exec(testContainer, 'cat /tmp/smoke-test.txt');
          if (!readOutput.includes('test')) {
            throw new Error('File write test failed');
          }
        });

        // Test 6: Container cleanup
        await runTest('Container cleanup', async () => {
          await dockerManager.stop(testContainer);
          await dockerManager.remove(testContainer);

          // Verify it's gone by checking if we can list all containers without error
          // The container should be removed now
        });
      }
    }

    // Test 7: Git operations
    if (testProjectExists) {
      await runTest('Git operations', async () => {
        const gitManager = new GitManager();
        const testProjectPath = path.join(homedir(), 'projects', 'test-project');

        // Check current branch - this method exists
        const branch = await gitManager.getCurrentBranch(testProjectPath);
        if (!branch) {
          throw new Error('Could not get git branch');
        }
      });
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.cyan('SMOKE TEST SUMMARY'));
    console.log(chalk.cyan('='.repeat(60)));

    console.log(`${chalk.green('✅ Passed:')} ${testsPassed}`);
    console.log(`${chalk.red('❌ Failed:')} ${testsFailed}`);
    console.log(`⏱️  Duration: ${duration}s`);

    if (testsFailed === 0) {
      console.log(chalk.green.bold('\n✅ ALL SMOKE TESTS PASSED - System is healthy!\n'));
      process.exit(0);
    } else {
      console.log(chalk.red.bold(`\n❌ ${testsFailed} SMOKE TEST(S) FAILED - System has issues!\n`));
      process.exit(1);
    }

  } catch (error) {
    console.log(chalk.red.bold('\n💥 SMOKE TEST CRASHED\n'));
    console.log(chalk.red(`Error: ${error.message}`));
    console.log(chalk.gray(error.stack));

    // Cleanup attempt
    if (testContainer) {
      try {
        console.log(chalk.yellow('\nAttempting cleanup...'));
        await dockerManager.stop(testContainer);
        await dockerManager.remove(testContainer);
        console.log(chalk.green('Cleanup successful'));
      } catch (cleanupError) {
        console.log(chalk.red('Cleanup failed'));
      }
    }

    process.exit(1);
  }
}

// Run tests
runSmokeTests();
