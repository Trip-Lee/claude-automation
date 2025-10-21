#!/usr/bin/env node

/**
 * Validation Suite - Comprehensive system validation
 *
 * Purpose: Full validation of all system components and workflows
 * Run before releases or when making significant changes
 *
 * Test Categories:
 * 1. Infrastructure (Docker, Git, Config)
 * 2. Agent System (Architect, Coder, Reviewer)
 * 3. Error Handling (Timeout, Retry, Messages)
 * 4. Cleanup System (Success, Error, Interrupt)
 * 5. File Operations (Read, Write, Edit)
 * 6. Cost Tracking
 */

import chalk from 'chalk';
import { Orchestrator } from '../lib/orchestrator.js';
import { DockerManager } from '../lib/docker-manager.js';
import { ConfigManager } from '../lib/config-manager.js';
import { GitManager } from '../lib/git-manager.js';
import { ClaudeCodeAgent } from '../lib/claude-code-agent.js';
import { CostMonitor } from '../lib/cost-monitor.js';
import { homedir } from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(homedir(), '.env') });

console.log(chalk.cyan.bold('\n🔬 VALIDATION SUITE - Comprehensive System Tests\n'));

const startTime = Date.now();
let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

// Test categories
const categories = {
  infrastructure: { passed: 0, failed: 0, skipped: 0 },
  agents: { passed: 0, failed: 0, skipped: 0 },
  errorHandling: { passed: 0, failed: 0, skipped: 0 },
  cleanup: { passed: 0, failed: 0, skipped: 0 },
  fileOps: { passed: 0, failed: 0, skipped: 0 },
  costTracking: { passed: 0, failed: 0, skipped: 0 }
};

// Helper to run a test
async function runTest(category, name, testFn, { skip = false, timeout = 60000 } = {}) {
  const displayName = `${category.toUpperCase()}: ${name}`;
  process.stdout.write(chalk.gray(`  ${displayName}... `));

  if (skip) {
    console.log(chalk.yellow('⊘ SKIPPED'));
    testsSkipped++;
    categories[category].skipped++;
    return { passed: false, skipped: true };
  }

  try {
    // Run test with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Test timeout')), timeout)
    );

    await Promise.race([testFn(), timeoutPromise]);

    console.log(chalk.green('✅'));
    testsPassed++;
    categories[category].passed++;
    return { passed: true, skipped: false };
  } catch (error) {
    console.log(chalk.red('❌'));
    console.log(chalk.red(`    Error: ${error.message}`));
    if (error.stack && process.env.VERBOSE) {
      console.log(chalk.gray(`    ${error.stack.split('\n').slice(1, 3).join('\n')}`));
    }
    testsFailed++;
    categories[category].failed++;
    return { passed: false, skipped: false, error };
  }
}

// Main validation suite
async function runValidationSuite() {
  let dockerManager;
  let configManager;
  let gitManager;
  let testContainer;
  const testContainers = [];

  console.log(chalk.cyan('═'.repeat(70)));
  console.log(chalk.cyan('CATEGORY 1: INFRASTRUCTURE TESTS'));
  console.log(chalk.cyan('═'.repeat(70) + '\n'));

  try {
    // === INFRASTRUCTURE TESTS ===

    await runTest('infrastructure', 'Docker daemon accessible', async () => {
      dockerManager = new DockerManager();
      await dockerManager.ping();
    });

    await runTest('infrastructure', 'Docker Python image exists', async () => {
      // Check if image exists
      const { spawn } = await import('child_process');
      await new Promise((resolve, reject) => {
        const checkImage = spawn('docker', ['images', 'claude-python:latest', '--format', '{{.Repository}}']);
        let output = '';

        checkImage.stdout.on('data', (data) => {
          output += data.toString();
        });

        checkImage.on('close', (code) => {
          if (code !== 0 || !output.includes('claude-python')) {
            reject(new Error('claude-python:latest image not found'));
          } else {
            resolve();
          }
        });
      });
    });

    await runTest('infrastructure', 'Configuration system initializes', async () => {
      configManager = new ConfigManager();
      const projects = await configManager.listProjects();
      if (!Array.isArray(projects)) {
        throw new Error('Configuration system not working');
      }
    });

    await runTest('infrastructure', 'Test project configuration exists', async () => {
      const config = await configManager.load('test-project');
      if (!config || !config.name) {
        throw new Error('test-project configuration not found');
      }
    });

    await runTest('infrastructure', 'Test project directory exists', async () => {
      const testProjectPath = path.join(homedir(), 'projects', 'test-project');
      await fs.access(testProjectPath);
      await fs.access(path.join(testProjectPath, 'main.py'));
      await fs.access(path.join(testProjectPath, 'test_main.py'));
    });

    await runTest('infrastructure', 'Git operations work', async () => {
      gitManager = new GitManager();
      const testProjectPath = path.join(homedir(), 'projects', 'test-project');
      const status = await gitManager.status(testProjectPath);
      if (!status.branch) {
        throw new Error('Git status failed');
      }
    });

    console.log(chalk.cyan('\n' + '═'.repeat(70)));
    console.log(chalk.cyan('CATEGORY 2: FILE OPERATIONS TESTS'));
    console.log(chalk.cyan('═'.repeat(70) + '\n'));

    // === FILE OPERATIONS TESTS ===

    const containerResult = await runTest('fileOps', 'Container creation', async () => {
      const testProjectPath = path.join(homedir(), 'projects', 'test-project');

      testContainer = await dockerManager.create({
        name: `validation-${Date.now()}`,
        image: 'claude-python:latest',
        memory: '512m',
        cpus: 1,
        volumes: {
          [testProjectPath]: '/workspace'
        }
      });

      testContainers.push(testContainer);

      if (!testContainer) {
        throw new Error('Container creation failed');
      }
    });

    if (containerResult.passed) {
      await runTest('fileOps', 'List files in container', async () => {
        const output = await dockerManager.exec(testContainer, 'ls -la /workspace');
        if (!output.includes('main.py') || !output.includes('test_main.py')) {
          throw new Error('Expected files not found');
        }
      });

      await runTest('fileOps', 'Read file in container', async () => {
        const output = await dockerManager.exec(testContainer, 'cat /workspace/main.py');
        if (!output.includes('def greet') || !output.includes('def add_numbers')) {
          throw new Error('Expected content not found');
        }
      });

      await runTest('fileOps', 'Write file in container (temp)', async () => {
        // Write to /tmp to avoid git changes
        await dockerManager.exec(testContainer, 'echo "validation test" > /tmp/test.txt');

        const output = await dockerManager.exec(testContainer, 'cat /tmp/test.txt');
        if (!output.includes('validation test')) {
          throw new Error('File write failed');
        }
      });

      await runTest('fileOps', 'Execute Python in container', async () => {
        const output = await dockerManager.exec(
          testContainer,
          'python3 -c "print(2 + 2)"'
        );
        if (!output.includes('4')) {
          throw new Error('Python execution failed');
        }
      });

      await runTest('fileOps', 'Run pytest in container', async () => {
        const output = await dockerManager.exec(
          testContainer,
          'cd /workspace && python3 -m pytest test_main.py -v'
        );
        if (!output.includes('passed') && !output.includes('PASSED')) {
          throw new Error('Tests did not pass');
        }
      });
    }

    console.log(chalk.cyan('\n' + '═'.repeat(70)));
    console.log(chalk.cyan('CATEGORY 3: CLEANUP SYSTEM TESTS'));
    console.log(chalk.cyan('═'.repeat(70) + '\n'));

    // === CLEANUP SYSTEM TESTS ===

    if (testContainer) {
      await runTest('cleanup', 'Container stop', async () => {
        await dockerManager.stop(testContainer);
        // Container is stopped, that's all we need to verify
      });

      await runTest('cleanup', 'Container remove', async () => {
        await dockerManager.remove(testContainer);
        // Container is removed, that's all we need to verify
      });
    }

    await runTest('cleanup', 'Orchestrator cleanup registration', async () => {
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );

      // Should have registered cleanup handlers
      if (!orchestrator.cleanupRegistered) {
        throw new Error('Cleanup handlers not registered');
      }
    });

    await runTest('cleanup', 'Active container tracking', async () => {
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );

      // Should have Set for tracking
      if (!(orchestrator.activeContainers instanceof Set)) {
        throw new Error('Active containers not tracked');
      }
    });

    console.log(chalk.cyan('\n' + '═'.repeat(70)));
    console.log(chalk.cyan('CATEGORY 4: ERROR HANDLING TESTS'));
    console.log(chalk.cyan('═'.repeat(70) + '\n'));

    // === ERROR HANDLING TESTS ===

    await runTest('errorHandling', 'ClaudeCodeAgent has timeout', async () => {
      const agent = new ClaudeCodeAgent({ role: 'coder' });
      if (!agent.timeout || agent.timeout < 1000) {
        throw new Error('Timeout not configured');
      }
    });

    await runTest('errorHandling', 'ClaudeCodeAgent has retry logic', async () => {
      const agent = new ClaudeCodeAgent({ role: 'coder' });
      if (!agent.maxRetries || agent.maxRetries < 1) {
        throw new Error('Retry logic not configured');
      }
      if (!agent.retryDelay) {
        throw new Error('Retry delay not configured');
      }
    });

    await runTest('errorHandling', 'Error classification works', async () => {
      const agent = new ClaudeCodeAgent({ role: 'coder' });

      // Test retryable errors
      const retryable = agent._isRetryableError(new Error('rate limit exceeded'));
      if (!retryable) {
        throw new Error('Rate limit error should be retryable');
      }

      // Test non-retryable errors
      const nonRetryable = agent._isRetryableError(new Error('permission denied'));
      if (nonRetryable) {
        throw new Error('Permission error should not be retryable');
      }
    });

    console.log(chalk.cyan('\n' + '═'.repeat(70)));
    console.log(chalk.cyan('CATEGORY 5: COST TRACKING TESTS'));
    console.log(chalk.cyan('═'.repeat(70) + '\n'));

    // === COST TRACKING TESTS ===

    await runTest('costTracking', 'CostMonitor initializes', async () => {
      const costMonitor = new CostMonitor(5.0);
      if (costMonitor.maxCost !== 5.0) {
        throw new Error('Cost limit not set correctly');
      }
    });

    await runTest('costTracking', 'CostMonitor tracks usage', async () => {
      const costMonitor = new CostMonitor(5.0);
      costMonitor.addUsage({ inputTokens: 1000, outputTokens: 500 });

      const cost = costMonitor.getTotalCost();
      if (cost <= 0) {
        throw new Error('Cost not tracked');
      }
    });

    await runTest('costTracking', 'CostMonitor enforces limit', async () => {
      const costMonitor = new CostMonitor(0.01);

      try {
        // Add usage that exceeds limit
        costMonitor.addUsage({ inputTokens: 10000, outputTokens: 10000 });
        throw new Error('Should have thrown cost limit error');
      } catch (error) {
        if (!error.message.includes('Cost limit')) {
          throw new Error('Wrong error type thrown');
        }
      }
    });

    console.log(chalk.cyan('\n' + '═'.repeat(70)));
    console.log(chalk.cyan('CATEGORY 6: AGENT SYSTEM TESTS (OPTIONAL)'));
    console.log(chalk.cyan('═'.repeat(70) + '\n'));

    // === AGENT SYSTEM TESTS (Optional - require Claude CLI) ===

    const hasClaudeCLI = await (async () => {
      try {
        const { spawn } = await import('child_process');
        await new Promise((resolve, reject) => {
          const check = spawn('which', ['claude']);
          check.on('close', (code) => {
            if (code === 0) resolve();
            else reject();
          });
        });
        return true;
      } catch {
        return false;
      }
    })();

    await runTest('agents', 'Claude Code CLI available', async () => {
      if (!hasClaudeCLI) {
        throw new Error('Claude CLI not found in PATH');
      }
    }, { skip: !hasClaudeCLI });

    await runTest('agents', 'ClaudeCodeAgent initializes', async () => {
      const agent = new ClaudeCodeAgent({ role: 'architect' });
      if (!agent.sessionId || !agent.role) {
        throw new Error('Agent not initialized correctly');
      }
    });

    await runTest('agents', 'Agent system prompts defined', async () => {
      const agent = new ClaudeCodeAgent({ role: 'coder' });
      const prompt = agent.getCoderSystemPrompt();
      if (!prompt || prompt.length < 50) {
        throw new Error('System prompt not defined');
      }
    });

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(chalk.cyan('\n' + '═'.repeat(70)));
    console.log(chalk.cyan('VALIDATION SUITE SUMMARY'));
    console.log(chalk.cyan('═'.repeat(70) + '\n'));

    // Category breakdown
    console.log(chalk.bold('Results by Category:\n'));
    for (const [category, results] of Object.entries(categories)) {
      const total = results.passed + results.failed + results.skipped;
      const emoji = results.failed === 0 ? '✅' : '❌';
      console.log(`${emoji} ${category.padEnd(20)} ${results.passed}/${total} passed ${results.skipped > 0 ? `(${results.skipped} skipped)` : ''}`);
    }

    console.log(chalk.cyan('\n' + '─'.repeat(70) + '\n'));

    console.log(`${chalk.green('✅ Passed:')} ${testsPassed}`);
    console.log(`${chalk.red('❌ Failed:')} ${testsFailed}`);
    console.log(`${chalk.yellow('⊘  Skipped:')} ${testsSkipped}`);
    console.log(`⏱️  Duration: ${duration}s`);

    if (testsFailed === 0) {
      console.log(chalk.green.bold('\n✅ ALL VALIDATION TESTS PASSED - System is fully functional!\n'));
      process.exit(0);
    } else {
      console.log(chalk.red.bold(`\n❌ ${testsFailed} VALIDATION TEST(S) FAILED - System has issues!\n`));
      console.log(chalk.yellow('Fix failed tests before deploying to production.\n'));
      process.exit(1);
    }

  } catch (error) {
    console.log(chalk.red.bold('\n💥 VALIDATION SUITE CRASHED\n'));
    console.log(chalk.red(`Error: ${error.message}`));
    console.log(chalk.gray(error.stack));

    // Cleanup attempt
    if (testContainers.length > 0) {
      try {
        console.log(chalk.yellow('\nAttempting cleanup...'));
        for (const container of testContainers) {
          try {
            await dockerManager.stop(container);
            await dockerManager.remove(container);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        console.log(chalk.green('Cleanup completed'));
      } catch (cleanupError) {
        console.log(chalk.red('Cleanup failed'));
      }
    }

    process.exit(1);
  }
}

// Run validation suite
runValidationSuite();
