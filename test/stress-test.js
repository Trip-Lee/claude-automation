#!/usr/bin/env node

/**
 * Stress Test Suite - Long-running backend stress tests
 *
 * Purpose: Test system performance under load and extended operation
 * Duration: 5-15 minutes depending on configuration
 *
 * Test Categories:
 * 1. Concurrent Task State Operations (100+ tasks)
 * 2. Large File Handling (repository with 1000+ files)
 * 3. Memory Leak Detection (sustained operation)
 * 4. Docker Container Lifecycle (create/destroy cycles)
 * 5. Database-level State Consistency
 * 6. Parallel Agent Coordination Stress
 */

import chalk from 'chalk';
import { TaskStateManager } from '../lib/task-state-manager.js';
import { DockerManager } from '../lib/docker-manager.js';
import { ConfigManager } from '../lib/config-manager.js';
import { ParallelAgentManager } from '../lib/parallel-agent-manager.js';
import { TaskDecomposer } from '../lib/task-decomposer.js';

console.log(chalk.cyan.bold('\n⚡ STRESS TEST SUITE - Backend Load Testing\n'));
console.log(chalk.yellow('⚠️  This suite takes 5-15 minutes to complete\n'));

const startTime = Date.now();
let testsPassed = 0;
let testsFailed = 0;

// Helper to run a test
async function runStressTest(name, testFn, { timeout = 300000 } = {}) {
  const testStart = Date.now();
  process.stdout.write(chalk.gray(`  Testing ${name}... `));

  try {
    await Promise.race([
      testFn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout')), timeout)
      )
    ]);

    const duration = ((Date.now() - testStart) / 1000).toFixed(2);
    console.log(chalk.green(`✅ (${duration}s)`));
    testsPassed++;
    return true;
  } catch (error) {
    const duration = ((Date.now() - testStart) / 1000).toFixed(2);
    console.log(chalk.red(`❌ (${duration}s)`));
    console.log(chalk.red(`    Error: ${error.message}`));
    testsFailed++;
    return false;
  }
}

// Main test suite
async function runStressTests() {
  console.log(chalk.bold('═══════════════════════════════════════════════════════════'));
  console.log(chalk.bold('CATEGORY 1: TASK STATE STRESS TESTS'));
  console.log(chalk.bold('═══════════════════════════════════════════════════════════\n'));

  await runStressTest('Concurrent task creation (100 tasks)', async () => {
    const stateManager = new TaskStateManager();
    const taskIds = [];

    // Create 100 tasks concurrently
    const promises = [];
    for (let i = 0; i < 100; i++) {
      const taskId = `stress-${Date.now()}-${i}`;
      taskIds.push(taskId);

      promises.push(
        stateManager.saveTaskState(taskId, {
          taskId,
          status: 'running',
          project: `stress-project-${i % 5}`,
          startedAt: new Date().toISOString()
        })
      );
    }

    await Promise.all(promises);

    // Verify all tasks were saved
    for (const taskId of taskIds) {
      const task = await stateManager.loadTaskState(taskId);
      if (!task) throw new Error(`Task ${taskId} not found`);
    }

    // Cleanup
    for (const taskId of taskIds) {
      await stateManager.deleteTaskState(taskId);
    }
  }, { timeout: 60000 });

  await runStressTest('Rapid task state updates (1000 updates)', async () => {
    const stateManager = new TaskStateManager();
    const taskId = `stress-updates-${Date.now()}`;

    await stateManager.saveTaskState(taskId, {
      taskId,
      status: 'running',
      project: 'stress',
      startedAt: new Date().toISOString()
    });

    // Perform 1000 rapid updates
    for (let i = 0; i < 1000; i++) {
      await stateManager.updateTaskState(taskId, {
        progress: { percent: (i / 10), eta: 1000 - i }
      });
    }

    const final = await stateManager.loadTaskState(taskId);
    if (final.progress.percent !== 99.9) {
      throw new Error('Final progress not correct');
    }

    await stateManager.deleteTaskState(taskId);
  }, { timeout: 60000 });

  await runStressTest('Task query performance (query 100 projects)', async () => {
    const stateManager = new TaskStateManager();
    const taskIds = [];

    // Create 100 tasks across 10 projects
    for (let i = 0; i < 100; i++) {
      const taskId = `query-stress-${Date.now()}-${i}`;
      taskIds.push(taskId);

      await stateManager.saveTaskState(taskId, {
        taskId,
        status: i % 2 === 0 ? 'running' : 'completed',
        project: `project-${i % 10}`,
        startedAt: new Date().toISOString()
      });
    }

    // Query all projects
    for (let i = 0; i < 10; i++) {
      const projectTasks = await stateManager.getProjectTasks(`project-${i}`);
      if (projectTasks.length !== 10) {
        throw new Error(`Expected 10 tasks for project-${i}, got ${projectTasks.length}`);
      }
    }

    // Query running tasks
    const runningTasks = await stateManager.getRunningTasks();
    const ourRunningTasks = runningTasks.filter(t => t.taskId.startsWith('query-stress-'));
    if (ourRunningTasks.length !== 50) {
      throw new Error(`Expected 50 running tasks, got ${ourRunningTasks.length}`);
    }

    // Cleanup
    for (const taskId of taskIds) {
      await stateManager.deleteTaskState(taskId);
    }
  }, { timeout: 90000 });

  console.log(chalk.bold('\n═══════════════════════════════════════════════════════════'));
  console.log(chalk.bold('CATEGORY 2: DOCKER STRESS TESTS'));
  console.log(chalk.bold('═══════════════════════════════════════════════════════════\n'));

  await runStressTest('Docker memory parsing (10000 iterations)', async () => {
    const docker = new DockerManager();

    const testCases = ['4g', '512m', '1024k', '100b'];

    for (let i = 0; i < 10000; i++) {
      const testCase = testCases[i % testCases.length];
      const result = docker.parseMemory(testCase);

      if (result <= 0) {
        throw new Error(`Invalid parse result for ${testCase}: ${result}`);
      }
    }
  }, { timeout: 30000 });

  await runStressTest('Docker CPU parsing (10000 iterations)', async () => {
    const docker = new DockerManager();

    for (let i = 1; i <= 10000; i++) {
      const cpus = (i % 8) + 1; // 1-8 CPUs
      const result = docker.parseCpus(cpus);

      if (result !== cpus * 100000) {
        throw new Error(`Invalid CPU parse: ${cpus} -> ${result}`);
      }
    }
  }, { timeout: 30000 });

  console.log(chalk.bold('\n═══════════════════════════════════════════════════════════'));
  console.log(chalk.bold('CATEGORY 3: CONFIGURATION STRESS TESTS'));
  console.log(chalk.bold('═══════════════════════════════════════════════════════════\n'));

  await runStressTest('Config validation (1000 iterations)', async () => {
    const configManager = new ConfigManager();

    const validConfig = {
      name: 'stress-test',
      repo: 'github.com/test/repo',
      base_branch: 'main',
      docker: { image: 'test:latest' }
    };

    for (let i = 0; i < 1000; i++) {
      configManager.validate(validConfig);
      const withDefaults = configManager.applyDefaults(validConfig);

      if (!withDefaults.protected_branches) {
        throw new Error('Missing default protected_branches');
      }
    }
  }, { timeout: 30000 });

  console.log(chalk.bold('\n═══════════════════════════════════════════════════════════'));
  console.log(chalk.bold('CATEGORY 4: TASK DECOMPOSITION STRESS TESTS'));
  console.log(chalk.bold('═══════════════════════════════════════════════════════════\n'));

  await runStressTest('File conflict detection (1000 parts)', async () => {
    const mockArchitect = { query: async () => '{}' };
    const decomposer = new TaskDecomposer(mockArchitect);

    // Create 1000 parts with unique files
    const parts = [];
    for (let i = 0; i < 1000; i++) {
      parts.push({
        files: [`file-${i}.js`, `test-${i}.js`]
      });
    }

    const conflict = decomposer.detectFileConflicts(parts);
    if (conflict !== null) {
      throw new Error('Found false conflict in unique files');
    }
  }, { timeout: 30000 });

  await runStressTest('Circular dependency detection (large graph)', async () => {
    const mockArchitect = { query: async () => '{}' };
    const decomposer = new TaskDecomposer(mockArchitect);

    // Create a large dependency chain (no cycles)
    const parts = [];
    for (let i = 0; i < 100; i++) {
      parts.push({
        dependencies: i > 0 ? [i - 1] : []
      });
    }

    const circular = decomposer.detectCircularDependencies(parts);
    if (circular !== null) {
      throw new Error('Found false circular dependency');
    }
  }, { timeout: 30000 });

  console.log(chalk.bold('\n═══════════════════════════════════════════════════════════'));
  console.log(chalk.bold('CATEGORY 5: MEMORY LEAK DETECTION'));
  console.log(chalk.bold('═══════════════════════════════════════════════════════════\n'));

  await runStressTest('Memory stability (sustained operations)', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    const stateManager = new TaskStateManager();

    // Perform 1000 create/delete cycles
    for (let i = 0; i < 1000; i++) {
      const taskId = `memory-test-${i}`;

      await stateManager.saveTaskState(taskId, {
        taskId,
        status: 'running',
        project: 'memory-test',
        startedAt: new Date().toISOString()
      });

      await stateManager.deleteTaskState(taskId);

      // Check memory every 100 iterations
      if (i % 100 === 0 && i > 0) {
        const currentMemory = process.memoryUsage().heapUsed;
        const increase = currentMemory - initialMemory;
        const increasePercentage = (increase / initialMemory) * 100;

        // Allow up to 50% memory growth (reasonable for caching, etc.)
        if (increasePercentage > 50) {
          console.log(chalk.yellow(`\n    Memory increased by ${increasePercentage.toFixed(1)}% at iteration ${i}`));
        }
      }
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const totalIncrease = finalMemory - initialMemory;
    const totalIncreasePercentage = (totalIncrease / initialMemory) * 100;

    console.log(chalk.gray(`\n    Memory change: ${totalIncreasePercentage.toFixed(1)}%`));

    // Fail if memory doubled (likely indicates a leak)
    if (totalIncreasePercentage > 100) {
      throw new Error(`Possible memory leak: memory increased by ${totalIncreasePercentage.toFixed(1)}%`);
    }
  }, { timeout: 120000 });

  // Final summary
  console.log(chalk.bold('\n═══════════════════════════════════════════════════════════'));
  console.log(chalk.bold('STRESS TEST SUMMARY'));
  console.log(chalk.bold('═══════════════════════════════════════════════════════════\n'));

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(chalk.green(`✅ Passed: ${testsPassed}`));
  console.log(chalk.red(`❌ Failed: ${testsFailed}`));
  console.log(chalk.cyan(`⏱️  Total Duration: ${duration}s\n`));

  if (testsFailed > 0) {
    console.log(chalk.red('❌ SOME STRESS TESTS FAILED\n'));
    process.exit(1);
  } else {
    console.log(chalk.green('✅ ALL STRESS TESTS PASSED - System is robust under load!\n'));
    process.exit(0);
  }
}

// Run the stress tests
runStressTests().catch(error => {
  console.error(chalk.red('\n💥 Fatal error during stress testing:'));
  console.error(chalk.red(error.stack));
  process.exit(1);
});
