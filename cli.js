#!/usr/bin/env node

/**
 * Claude Multi-Agent Coding System - CLI Entry Point
 * Mobile-accessible AI-powered coding orchestration for Raspberry Pi
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { Orchestrator } from './lib/orchestrator.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
      const orchestrator = new Orchestrator();
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
      const orchestrator = new Orchestrator();
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
      const orchestrator = new Orchestrator();
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
      const orchestrator = new Orchestrator();
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
      const orchestrator = new Orchestrator();
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

// Parse command line arguments
program.parse();
