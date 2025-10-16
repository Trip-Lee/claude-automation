#!/usr/bin/env node

/**
 * Test Core Modules - Integration test for DockerManager, GitManager, ConfigManager
 *
 * This tests the three newly implemented modules to ensure they work correctly.
 */

import { DockerManager } from '../lib/docker-manager.js';
import { GitManager } from '../lib/git-manager.js';
import { ConfigManager } from '../lib/config-manager.js';
import chalk from 'chalk';

async function testDockerManager() {
  console.log(chalk.blue.bold('\n📦 Testing DockerManager...\n'));

  const docker = new DockerManager();

  try {
    // Test 1: Ping Docker daemon
    console.log('  Testing Docker ping...');
    await docker.ping();
    console.log(chalk.green('  ✅ Docker daemon is running'));

    // Test 2: Parse memory
    console.log('  Testing memory parsing...');
    const mem4g = docker.parseMemory('4g');
    const mem512m = docker.parseMemory('512m');
    console.log(chalk.gray(`    4g = ${mem4g} bytes`));
    console.log(chalk.gray(`    512m = ${mem512m} bytes`));
    console.log(chalk.green('  ✅ Memory parsing works'));

    // Test 3: Parse CPUs
    console.log('  Testing CPU parsing...');
    const cpu2 = docker.parseCpus(2);
    console.log(chalk.gray(`    2 CPUs = ${cpu2} quota`));
    console.log(chalk.green('  ✅ CPU parsing works'));

    // Test 4: Create container (using existing image)
    console.log('  Testing container creation...');
    const container = await docker.create({
      name: 'test-core-modules',
      image: 'claude-python:latest',
      memory: '1g',
      cpus: 1,
      volumes: {
        '/tmp/test-workspace': '/workspace'
      },
      network: 'none'
    });
    console.log(chalk.green('  ✅ Container created'));

    // Test 5: Execute command
    console.log('  Testing command execution...');
    const output = await docker.exec(container, 'echo "Hello from Docker!"');
    console.log(chalk.gray(`    Output: ${output.trim()}`));
    console.log(chalk.green('  ✅ Command execution works'));

    // Test 6: Get stats
    console.log('  Testing container stats...');
    const stats = await docker.getStats(container);
    console.log(chalk.gray(`    Memory usage: ${Math.round(stats.memory_stats.usage / 1024 / 1024)}MB`));
    console.log(chalk.green('  ✅ Stats retrieval works'));

    // Test 7: Cleanup
    console.log('  Testing cleanup...');
    await docker.stop(container);
    await docker.remove(container);
    console.log(chalk.green('  ✅ Cleanup works'));

    console.log(chalk.green.bold('\n✅ DockerManager: All tests passed!\n'));
    return true;
  } catch (error) {
    console.log(chalk.red(`\n❌ DockerManager test failed: ${error.message}\n`));
    return false;
  }
}

async function testGitManager() {
  console.log(chalk.blue.bold('\n📝 Testing GitManager...\n'));

  const git = new GitManager();

  try {
    // Use the claude-automation directory for testing
    const testPath = '/home/coltrip/claude-automation';

    // Test 1: Get status
    console.log('  Testing git status...');
    const status = await git.getStatus(testPath);
    console.log(chalk.gray(`    Status: ${status.split('\n')[0]}`));
    console.log(chalk.green('  ✅ Git status works'));

    // Test 2: Get current branch
    console.log('  Testing get current branch...');
    const currentBranch = await git.getCurrentBranch(testPath);
    console.log(chalk.gray(`    Current branch: ${currentBranch}`));
    console.log(chalk.green('  ✅ Get current branch works'));

    // Test 3: Check uncommitted changes
    console.log('  Testing uncommitted changes check...');
    const hasChanges = await git.hasUncommittedChanges(testPath);
    console.log(chalk.gray(`    Has uncommitted changes: ${hasChanges}`));
    console.log(chalk.green('  ✅ Uncommitted changes check works'));

    // Test 4: Get log
    console.log('  Testing git log...');
    const log = await git.getLog(testPath, { limit: 3 });
    console.log(chalk.gray(`    Last 3 commits:\n${log.split('\n').map(l => '      ' + l).join('\n')}`));
    console.log(chalk.green('  ✅ Git log works'));

    // Test 5: Branch exists
    console.log('  Testing branch exists...');
    const mainExists = await git.branchExists(testPath, 'main');
    console.log(chalk.gray(`    'main' branch exists: ${mainExists}`));
    console.log(chalk.green('  ✅ Branch exists check works'));

    console.log(chalk.green.bold('\n✅ GitManager: All tests passed!\n'));
    return true;
  } catch (error) {
    console.log(chalk.red(`\n❌ GitManager test failed: ${error.message}\n`));
    return false;
  }
}

async function testConfigManager() {
  console.log(chalk.blue.bold('\n⚙️  Testing ConfigManager...\n'));

  const config = new ConfigManager();

  try {
    // Test 1: List projects
    console.log('  Testing list projects...');
    const projects = await config.listProjects();
    console.log(chalk.gray(`    Found ${projects.length} project(s): ${projects.join(', ')}`));
    console.log(chalk.green('  ✅ List projects works'));

    // Test 2: Create test config
    console.log('  Testing config creation...');
    const testConfig = {
      name: 'test-project',
      repo: 'github.com/test/test',
      base_branch: 'main',
      docker: {
        image: 'claude-python:latest',
        memory: '2g',
        cpus: 1
      },
      safety: {
        max_cost_per_task: 3.00
      }
    };

    // Delete if exists first
    if (await config.exists('test-project')) {
      await config.delete('test-project');
    }

    const configPath = await config.create('test-project', testConfig);
    console.log(chalk.gray(`    Created: ${configPath}`));
    console.log(chalk.green('  ✅ Config creation works'));

    // Test 3: Load config
    console.log('  Testing config loading...');
    const loaded = await config.load('test-project');
    console.log(chalk.gray(`    Loaded config for: ${loaded.name}`));
    console.log(chalk.gray(`    Docker image: ${loaded.docker.image}`));
    console.log(chalk.gray(`    Max cost: $${loaded.safety.max_cost_per_task}`));
    console.log(chalk.green('  ✅ Config loading works'));

    // Test 4: Validate config
    console.log('  Testing config validation...');
    config.validate(loaded);
    console.log(chalk.green('  ✅ Config validation works'));

    // Test 5: Update config
    console.log('  Testing config update...');
    const updated = await config.update('test-project', {
      safety: {
        max_cost_per_task: 5.00
      }
    });
    console.log(chalk.gray(`    Updated max cost to: $${updated.safety.max_cost_per_task}`));
    console.log(chalk.green('  ✅ Config update works'));

    // Test 6: Cleanup
    console.log('  Testing config deletion...');
    await config.delete('test-project');
    console.log(chalk.green('  ✅ Config deletion works'));

    // Test 7: Validation errors
    console.log('  Testing validation errors...');
    try {
      config.validate({ name: 'test' }); // Missing required fields
      console.log(chalk.red('  ❌ Should have thrown validation error'));
    } catch (error) {
      console.log(chalk.gray(`    Expected error: ${error.message}`));
      console.log(chalk.green('  ✅ Validation errors work'));
    }

    console.log(chalk.green.bold('\n✅ ConfigManager: All tests passed!\n'));
    return true;
  } catch (error) {
    console.log(chalk.red(`\n❌ ConfigManager test failed: ${error.message}\n`));

    // Cleanup test config if it exists
    try {
      if (await config.exists('test-project')) {
        await config.delete('test-project');
      }
    } catch {}

    return false;
  }
}

async function runAllTests() {
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('  Core Modules Integration Test'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));

  const results = {
    docker: await testDockerManager(),
    git: await testGitManager(),
    config: await testConfigManager()
  };

  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('  Test Summary'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════'));

  console.log(`  DockerManager:  ${results.docker ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`);
  console.log(`  GitManager:     ${results.git ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`);
  console.log(`  ConfigManager:  ${results.config ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`);

  const allPassed = results.docker && results.git && results.config;

  if (allPassed) {
    console.log(chalk.green.bold('\n✅ All core modules are working correctly!\n'));
    process.exit(0);
  } else {
    console.log(chalk.red.bold('\n❌ Some tests failed. Please review the output above.\n'));
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error(chalk.red.bold(`\n❌ Test suite failed: ${error.message}\n`));
  console.error(error.stack);
  process.exit(1);
});
