#!/usr/bin/env node

/**
 * Dev-Tools - Interactive CLI for Claude Multi-Agent System
 * Beautiful, user-friendly interface for managing projects and tasks
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { Orchestrator } from './lib/orchestrator.js';
import { ConfigManager } from './lib/config-manager.js';
import dotenv from 'dotenv';
import { homedir } from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import ora from 'ora';

// Load environment variables
dotenv.config({ path: path.join(homedir(), '.env') });

// ASCII Art Banner
function showBanner() {
  console.clear();
  console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ██████╗ ███████╗██╗   ██╗      ████████╗ ██████╗  ██████╗ ██╗  ║
║   ██╔══██╗██╔════╝██║   ██║      ╚══██╔══╝██╔═══██╗██╔═══██╗██║  ║
║   ██║  ██║█████╗  ██║   ██║█████╗   ██║   ██║   ██║██║   ██║██║  ║
║   ██║  ██║██╔══╝  ╚██╗ ██╔╝╚════╝   ██║   ██║   ██║██║   ██║██║  ║
║   ██████╔╝███████╗ ╚████╔╝          ██║   ╚██████╔╝╚██████╔╝███████╗║
║   ╚═════╝ ╚══════╝  ╚═══╝           ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝║
║                                                                   ║
║            Claude Multi-Agent Development Assistant              ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
  `));
  console.log(chalk.gray('          AI-Powered Coding • Multi-Agent Collaboration\n'));
}

/**
 * Main interactive flow
 */
async function main() {
  try {
    showBanner();

    const configManager = new ConfigManager();

    // Step 1: Project Selection
    const projectAnswer = await promptProjectSelection(configManager);

    if (projectAnswer.action === 'create-new') {
      // Create new project wizard
      const newProject = await createNewProject(configManager);
      if (!newProject) {
        console.log(chalk.yellow('\n⚠️  Project creation cancelled\n'));
        return;
      }
      projectAnswer.project = newProject.name;
    } else if (projectAnswer.action === 'exit') {
      console.log(chalk.cyan('\n👋 Goodbye!\n'));
      return;
    }

    const selectedProject = projectAnswer.project;

    // Step 2: Load project config
    const spinner = ora('Loading project configuration...').start();
    let config;
    try {
      config = await configManager.load(selectedProject);
      spinner.succeed(`Project loaded: ${chalk.cyan(selectedProject)}`);
    } catch (error) {
      spinner.fail(`Failed to load project: ${error.message}`);
      return;
    }

    // Display project info
    console.log(chalk.gray(`\n  Repository: ${config.repo}`));
    console.log(chalk.gray(`  Base branch: ${config.base_branch}`));
    console.log(chalk.gray(`  Docker image: ${config.docker.image}\n`));

    // Step 3: Task Input
    const taskAnswer = await promptTaskInput();

    if (!taskAnswer.description.trim()) {
      console.log(chalk.red('\n❌ Task description cannot be empty\n'));
      return;
    }

    // Step 4: Advanced Options (optional)
    const advancedAnswer = await promptAdvancedOptions();

    // Step 5: Confirmation
    const confirmAnswer = await confirmExecution({
      project: selectedProject,
      task: taskAnswer.description,
      interactive: advancedAnswer.interactive,
      maxCost: advancedAnswer.maxCost
    });

    if (!confirmAnswer.confirmed) {
      console.log(chalk.yellow('\n⚠️  Task cancelled\n'));
      return;
    }

    // Step 6: Execute Task
    console.log(chalk.green.bold('\n✨ Starting task execution...\n'));

    const orchestrator = new Orchestrator(
      process.env.GITHUB_TOKEN,
      process.env.ANTHROPIC_API_KEY
    );

    const taskOptions = {
      interactive: advancedAnswer.interactive
    };

    // Only set maxCost if using Anthropic API
    if (advancedAnswer.maxCost !== null) {
      taskOptions.maxCost = advancedAnswer.maxCost;
    }

    await orchestrator.executeTask(selectedProject, taskAnswer.description, taskOptions);

    // Success!
    console.log(chalk.green.bold('\n🎉 Task completed successfully!\n'));

  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }
}

/**
 * Prompt for project selection
 */
async function promptProjectSelection(configManager) {
  const projects = await configManager.listProjects();

  const choices = [
    ...projects.map(name => ({
      name: `📁 ${name}`,
      value: name,
      short: name
    })),
    new inquirer.Separator(),
    {
      name: chalk.green('➕ Create New Project'),
      value: 'create-new',
      short: 'New Project'
    },
    {
      name: chalk.gray('🚪 Exit'),
      value: 'exit',
      short: 'Exit'
    }
  ];

  if (projects.length === 0) {
    console.log(chalk.yellow('⚠️  No projects configured yet\n'));

    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'createFirst',
        message: 'Would you like to create your first project?',
        default: true
      }
    ]);

    if (answer.createFirst) {
      return { action: 'create-new' };
    } else {
      return { action: 'exit' };
    }
  }

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'project',
      message: 'Select a project to work on:',
      choices,
      pageSize: 15,
      loop: false
    }
  ]);

  if (answer.project === 'create-new' || answer.project === 'exit') {
    return { action: answer.project };
  }

  return { project: answer.project };
}

/**
 * Prompt for task description
 */
async function promptTaskInput() {
  console.log(chalk.cyan('\n📝 Task Description\n'));
  console.log(chalk.gray('  Examples:'));
  console.log(chalk.white('    • "Add a login page with authentication"'));
  console.log(chalk.white('    • "Fix the bug in the user registration flow"'));
  console.log(chalk.white('    • "Refactor the API layer for better performance"'));
  console.log(chalk.white('    • "Add unit tests for the shopping cart module"\n'));

  const answer = await inquirer.prompt([
    {
      type: 'editor',
      name: 'description',
      message: 'Describe the task (opens your default editor):',
      default: '',
      validate: (input) => {
        if (!input || !input.trim()) {
          return 'Task description cannot be empty';
        }
        return true;
      }
    }
  ]);

  return answer;
}

/**
 * Prompt for advanced options
 */
async function promptAdvancedOptions() {
  // Interactive mode is always enabled
  const options = {
    interactive: true,
    maxCost: null
  };

  // Only ask about cost if using Anthropic API (not Claude Code CLI)
  const usingAnthropicAPI = !!process.env.ANTHROPIC_API_KEY;

  if (!usingAnthropicAPI) {
    // Using Claude Code CLI - no cost limit needed
    console.log(chalk.gray('\n  ℹ️  Using Claude Code CLI (no API cost limit needed)\n'));
    return options;
  }

  // Using Anthropic API - ask about cost limit
  console.log(chalk.yellow('\n  ⚠️  Using Anthropic API (pay-per-token pricing)\n'));

  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'setCostLimit',
      message: 'Set a maximum cost limit for this task?',
      default: true
    }
  ]);

  if (answer.setCostLimit) {
    const costAnswer = await inquirer.prompt([
      {
        type: 'number',
        name: 'maxCost',
        message: 'Maximum cost per task (USD):',
        default: 5.0,
        validate: (input) => {
          if (input <= 0) {
            return 'Cost must be greater than 0';
          }
          if (input > 50) {
            return 'Maximum cost is $50 per task';
          }
          return true;
        }
      }
    ]);
    options.maxCost = costAnswer.maxCost;
  }

  return options;
}

/**
 * Confirmation prompt
 */
async function confirmExecution(details) {
  const usingAnthropicAPI = !!process.env.ANTHROPIC_API_KEY;

  console.log(chalk.cyan('\n📋 Task Summary\n'));
  console.log(chalk.white('  Project:     ') + chalk.cyan(details.project));
  console.log(chalk.white('  Task:        ') + chalk.gray(details.task.substring(0, 80) + (details.task.length > 80 ? '...' : '')));
  console.log(chalk.white('  Mode:        ') + chalk.green('Interactive'));

  if (usingAnthropicAPI) {
    console.log(chalk.white('  Backend:     ') + chalk.yellow('Anthropic API'));
    if (details.maxCost) {
      console.log(chalk.white('  Max Cost:    ') + chalk.yellow(`$${details.maxCost.toFixed(2)}`));
    } else {
      console.log(chalk.white('  Max Cost:    ') + chalk.gray('No limit'));
    }
  } else {
    console.log(chalk.white('  Backend:     ') + chalk.cyan('Claude Code CLI (Pro/Max subscription)'));
  }

  console.log('');

  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Start execution?',
      default: true
    }
  ]);

  return answer;
}

/**
 * Create new project wizard
 */
async function createNewProject(configManager) {
  console.log(chalk.cyan.bold('\n✨ New Project Wizard\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      validate: (input) => {
        if (!input || !input.trim()) {
          return 'Project name is required';
        }
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Project name must be lowercase letters, numbers, and hyphens only';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'repo',
      message: 'GitHub repository (e.g., github.com/user/repo):',
      validate: (input) => {
        if (!input || !input.trim()) {
          return 'Repository is required';
        }
        if (!input.includes('github.com')) {
          return 'Must be a GitHub repository URL';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'baseBranch',
      message: 'Base branch:',
      default: 'main'
    },
    {
      type: 'list',
      name: 'dockerImage',
      message: 'Docker image for development:',
      choices: [
        { name: '🐍 Python (claude-python:latest)', value: 'claude-python:latest' },
        { name: '📦 Node.js (claude-node:latest)', value: 'claude-node:latest' },
        { name: '🔧 Custom', value: 'custom' }
      ]
    },
    {
      type: 'input',
      name: 'customImage',
      message: 'Custom Docker image:',
      when: (answers) => answers.dockerImage === 'custom',
      validate: (input) => input ? true : 'Custom image name is required'
    },
    {
      type: 'input',
      name: 'testCommand',
      message: 'Test command (leave empty if no tests):',
      default: ''
    },
    {
      type: 'confirm',
      name: 'requirePR',
      message: 'Require pull request for changes?',
      default: true
    }
  ]);

  // Build config object
  const projectConfig = {
    name: answers.name,
    repo: answers.repo,
    base_branch: answers.baseBranch,
    protected_branches: [answers.baseBranch],
    requires_pr: answers.requirePR,
    auto_merge: false,
    require_pr_approval: true,
    docker: {
      image: answers.customImage || answers.dockerImage,
      memory: '4g',
      cpus: 2,
      network_mode: 'none'
    },
    tests: answers.testCommand ? {
      command: answers.testCommand,
      coverage_required: false,
      min_coverage: 80
    } : null,
    safety: {
      max_cost_per_task: 5.0,
      allow_dependency_changes: false,
      require_manual_review: false,
      backup_before_changes: false
    }
  };

  // Confirm before saving
  console.log(chalk.cyan('\n📋 Project Configuration\n'));
  console.log(chalk.gray(JSON.stringify(projectConfig, null, 2)));
  console.log('');

  const confirmAnswer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'save',
      message: 'Save this project configuration?',
      default: true
    }
  ]);

  if (!confirmAnswer.save) {
    return null;
  }

  // Save config
  const spinner = ora('Saving project configuration...').start();

  try {
    await configManager.create(answers.name, projectConfig);
    spinner.succeed(`Project created: ${chalk.cyan(answers.name)}`);

    // Check if project directory exists
    const projectPath = path.join(homedir(), 'projects', answers.name);
    try {
      await fs.access(projectPath);
      console.log(chalk.green(`  ✅ Project directory found: ${projectPath}`));
    } catch {
      console.log(chalk.yellow(`  ⚠️  Project directory not found: ${projectPath}`));
      console.log(chalk.gray(`     Clone your repository to this location\n`));
    }

    return projectConfig;
  } catch (error) {
    spinner.fail(`Failed to save project: ${error.message}`);
    return null;
  }
}

// Run the CLI
main().catch((error) => {
  console.error(chalk.red(`\n💥 Fatal error: ${error.message}\n`));
  process.exit(1);
});
