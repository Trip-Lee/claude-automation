#!/usr/bin/env node

/**
 * Claude Multi-Agent Coding System - CLI Entry Point
 * Mobile-accessible AI-powered coding orchestration for Raspberry Pi
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { Orchestrator } from './lib/orchestrator.js';
import dotenv from 'dotenv';
import { homedir } from 'os';
import path from 'path';

// Load environment variables from home directory
dotenv.config({ path: path.join(homedir(), '.env') });

const program = new Command();

program
  .name('claude')
  .description('Claude Multi-Agent Coding System')
  .version('1.0.0');

// Task command - create a new coding task
program
  .command('task <project> <description>')
  .description('Create a new coding task')
  .action(async (project, description) => {
    try {
      console.log(chalk.blue.bold('\n🚀 Claude Multi-Agent System\n'));
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );
      await orchestrator.executeTask(project, description);
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Approve command - approve task and create PR
program
  .command('approve <taskId>')
  .description('Approve task and create PR')
  .action(async (taskId) => {
    try {
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );
      const pr = await orchestrator.approve(taskId);
      console.log(chalk.green(`\n✅ PR created: ${pr.url}\n`));
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Reject command - reject task and cleanup
program
  .command('reject <taskId>')
  .description('Reject task and cleanup')
  .action(async (taskId) => {
    try {
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );
      await orchestrator.reject(taskId);
      console.log(chalk.yellow('\n✅ Task rejected and cleaned up\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Status command - check task status
program
  .command('status [taskId]')
  .description('Check task status')
  .action(async (taskId) => {
    try {
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );
      await orchestrator.showStatus(taskId);
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// List projects command
program
  .command('list-projects')
  .description('List all configured projects')
  .action(async () => {
    try {
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );
      await orchestrator.listProjects();
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Monitor command - show system status
program
  .command('monitor')
  .description('Show system status')
  .action(async () => {
    console.log(chalk.blue('\n📊 System Monitor\n'));
    console.log(chalk.yellow('⚠️  Monitor command not implemented yet'));
    console.log(chalk.gray('Coming in Phase 1: Week 8\n'));
    // TODO: Display system info: CPU, RAM, disk, Docker containers, active tasks
  });

// Add project command - interactive wizard
program
  .command('add-project <name>')
  .description('Add new project (interactive)')
  .action(async (name) => {
    console.log(chalk.blue(`\n📁 Adding project: ${name}\n`));
    console.log(chalk.yellow('⚠️  Add-project command not implemented yet'));
    console.log(chalk.gray('Coming in Phase 3: Week 21\n'));
    // TODO: Interactive wizard for project configuration
  });

// Cleanup command - remove all hanging Claude containers
program
  .command('cleanup')
  .description('Clean up all hanging Claude containers')
  .option('-a, --all', 'Clean up ALL Claude containers (including active ones)')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n🧹 Claude Container Cleanup\n'));
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );

      if (options.all) {
        // Clean up ALL Claude containers (including active)
        const result = await orchestrator.cleanupAllClaudeContainers();
        if (result.cleaned > 0) {
          console.log(chalk.green(`\n✅ Cleanup complete: ${result.cleaned} container(s) removed\n`));
        } else {
          console.log(chalk.gray('\nNo Claude containers found to clean up.\n'));
        }
      } else {
        // Clean up only tracked active containers
        await orchestrator.cleanupAll();
        if (orchestrator.activeContainers.size === 0) {
          console.log(chalk.gray('\nNo active containers to clean up.'));
          console.log(chalk.gray('Use --all flag to clean up all Claude containers.\n'));
        }
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Cleanup failed:'), error.message);
      process.exit(1);
    }
  });

// Validate command - run system validation tests
program
  .command('validate')
  .description('Validate system health and functionality')
  .option('--smoke', 'Run quick smoke tests only (<30s)')
  .option('--full', 'Run comprehensive validation suite')
  .action(async (options) => {
    try {
      const { spawn } = await import('child_process');

      // Determine which test to run
      let testScript;
      let testName;

      if (options.smoke) {
        testScript = './test/smoke-test.js';
        testName = 'Smoke Tests';
      } else if (options.full) {
        testScript = './test/validation-suite.js';
        testName = 'Full Validation Suite';
      } else {
        // Default: run smoke tests
        testScript = './test/smoke-test.js';
        testName = 'Smoke Tests (Quick)';
        console.log(chalk.gray('Tip: Use --full for comprehensive validation\n'));
      }

      // Run the test script
      const testProcess = spawn('node', [testScript], {
        cwd: process.cwd(),
        stdio: 'inherit'
      });

      testProcess.on('close', (code) => {
        process.exit(code);
      });

    } catch (error) {
      console.error(chalk.red('\n❌ Validation failed:'), error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
