#!/usr/bin/env node

/**
 * Claude Multi-Agent Coding System - CLI Entry Point
 * Mobile-accessible AI-powered coding orchestration for Raspberry Pi
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { createWriteStream } from 'fs';
import { Orchestrator } from './lib/orchestrator.js';
import { TaskStateManager } from './lib/task-state-manager.js';
import { getGlobalConfig } from './lib/global-config.js';
import dotenv from 'dotenv';
import path from 'path';
import { homedir } from 'os';

// Initialize global config and ensure directories exist
const globalConfig = getGlobalConfig();
globalConfig.ensureDirectories();

// Load environment variables from configured location
dotenv.config({ path: globalConfig.get('envFile') });

const program = new Command();

/**
 * Enhanced error display with actionable suggestions
 */
function displayError(error, context = {}) {
  console.error(chalk.red('\nERROR:'), error.message);

  // Provide context-specific suggestions
  if (error.message.includes('GITHUB_TOKEN')) {
    console.log(chalk.yellow('\nSuggestion:'));
    console.log(chalk.gray('  1. Check if GitHub CLI is authenticated: gh auth status'));
    console.log(chalk.gray('  2. Set GITHUB_TOKEN in ~/.env or environment'));
    console.log(chalk.gray('  3. Generate token at: https://github.com/settings/tokens\n'));
  } else if (error.message.includes('ANTHROPIC_API_KEY')) {
    console.log(chalk.yellow('\nSuggestion:'));
    console.log(chalk.gray('  1. Set ANTHROPIC_API_KEY in ~/.env'));
    console.log(chalk.gray('  2. Get API key at: https://console.anthropic.com/\n'));
  } else if (error.message.includes('Docker') || error.message.includes('docker')) {
    console.log(chalk.yellow('\nSuggestion:'));
    console.log(chalk.gray('  1. Check Docker is running: docker ps'));
    console.log(chalk.gray('  2. Start Docker: sudo systemctl start docker'));
    console.log(chalk.gray('  3. Add user to docker group: sudo usermod -aG docker $USER\n'));
  } else if (error.message.includes('Project') && error.message.includes('not found')) {
    console.log(chalk.yellow('\nSuggestion:'));
    console.log(chalk.gray('  1. Check project config exists in ~/.claude-projects/'));
    console.log(chalk.gray('  2. Run dev-tools without args to create a project'));
    console.log(chalk.gray('  3. Check project name spelling\n'));
  } else if (error.message.includes('repository') || error.message.includes('repo')) {
    console.log(chalk.yellow('\nSuggestion:'));
    console.log(chalk.gray('  1. Check repository URL in project config'));
    console.log(chalk.gray('  2. Verify GitHub authentication: gh auth status'));
    console.log(chalk.gray('  3. Check repository exists and you have access\n'));
  } else if (error.message.includes('permission') || error.message.includes('Permission')) {
    console.log(chalk.yellow('\nSuggestion:'));
    console.log(chalk.gray('  1. Check file/directory permissions'));
    console.log(chalk.gray('  2. Verify you own the project directory'));
    console.log(chalk.gray('  3. Run with appropriate user permissions\n'));
  } else if (context.command) {
    console.log(chalk.yellow('\nFor help:'));
    console.log(chalk.gray(`  dev-tools ${context.command} --help\n`));
  }
}

program
  .name('dev-tools')
  .description('Dev Tools - AI-powered development orchestration')
  .version('0.14.0');

// Task command - create a new coding task
program
  .command('task <project> <description>')
  .description('Create a new coding task')
  .option('-b, --background', 'Run task in background')
  .action(async (project, description, options) => {
    try {
      // Background execution mode
      if (options.background) {
        const stateManager = new TaskStateManager();

        // Check parallel task limit
        const running = await stateManager.getRunningTasks();
        const maxParallel = globalConfig.get('maxParallelTasks') || 10;

        if (running.length >= maxParallel) {
          console.error(chalk.red(`\nERROR: Maximum parallel tasks limit reached (${maxParallel})`));
          console.log(chalk.yellow(`   ${running.length} tasks currently running`));
          console.log(chalk.gray('\nRunning tasks:'));
          for (const task of running.slice(0, 5)) {
            console.log(chalk.gray(`  - ${task.taskId}: ${task.project} (${task.currentAgent || 'starting'})`));
          }
          if (running.length > 5) {
            console.log(chalk.gray(`  ... and ${running.length - 5} more`));
          }
          console.log(chalk.yellow(`\nView status: dev-tools status`));
          process.exit(1);
        }

        // Generate task ID
        const taskId = randomBytes(6).toString('hex');

        // Create log file
        const logsDir = globalConfig.get('logsDir');
        const logPath = path.join(logsDir, `${taskId}.log`);
        const logStream = createWriteStream(logPath);

        // Spawn detached background process
        const workerPath = path.join(globalConfig.getInstallPath(), 'background-worker.js');
        const child = spawn('node', [
          workerPath,
          taskId,
          project,
          description
        ], {
          detached: true,
          stdio: ['ignore', logStream, logStream],
          env: process.env
        });

        child.unref();

        // Save initial task state
        await stateManager.saveTaskState(taskId, {
          taskId,
          project,
          description,
          status: 'running',
          pid: child.pid,
          startedAt: new Date().toISOString(),
          logFile: logPath,
          currentAgent: null,
          completedAgents: [],
          progress: {
            percent: 0,
            eta: null
          }
        });

        // Display task info
        console.log(chalk.green.bold('\n✓ Background task started\n'));
        console.log(chalk.gray('Task Details:'));
        console.log(chalk.cyan(`  ID:       ${taskId}`));
        console.log(chalk.cyan(`  Project:  ${project}`));
        console.log(chalk.cyan(`  PID:      ${child.pid}`));
        console.log(chalk.gray(`\n  Log:      ${logPath}`));
        console.log(chalk.gray('\nMonitoring:'));
        console.log(chalk.white(`  View logs:    dev-tools logs ${taskId}`));
        console.log(chalk.white(`  Follow logs:  dev-tools logs -f ${taskId}`));
        console.log(chalk.white(`  Check status: dev-tools status`));
        console.log(chalk.white(`  Cancel task:  dev-tools cancel ${taskId}`));
        console.log();

        process.exit(0);
      }

      // Normal foreground execution
      console.log(chalk.blue.bold('\nClaude Multi-Agent System\n'));
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );
      await orchestrator.executeTask(project, description);
    } catch (error) {
      displayError(error, { command: 'task' });
      process.exit(1);
    }
  });

// Run command - process tasks from inbox folder
program
  .command('run [project]')
  .description('Process tasks from inbox folder (~/.claude-tasks/tasks/)')
  .option('-p, --parallel', 'Execute tasks in parallel (default: sequential)')
  .option('-c, --concurrency <n>', 'Max concurrent tasks when parallel', '3')
  .option('--continue-on-error', 'Continue if a task fails')
  .option('--dry-run', 'Show tasks without executing')
  .action(async (project, options) => {
    try {
      const { TaskListProcessor } = await import('./lib/task-list-processor.js');

      console.log(chalk.cyan.bold('\nClaude Task Runner\n'));

      // Create orchestrator
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );

      // Create processor with options
      const processor = new TaskListProcessor(orchestrator, {
        parallel: options.parallel,
        concurrency: parseInt(options.concurrency) || 3,
        continueOnError: options.continueOnError,
        dryRun: options.dryRun
      });

      // Scan inbox
      console.log(chalk.gray('Scanning ~/.claude-tasks/tasks/...\n'));
      const taskFiles = await processor.scanInbox();

      if (taskFiles.length === 0) {
        console.log(chalk.yellow('No task files found in inbox.\n'));
        console.log(chalk.gray('Drop task files (.txt, .md, .json, .xml) into:'));
        console.log(chalk.gray('  ~/.claude-tasks/tasks/\n'));
        return;
      }

      // Show files found
      console.log(chalk.white(`Found ${taskFiles.length} task file(s):\n`));
      for (let i = 0; i < taskFiles.length; i++) {
        const file = taskFiles[i];
        const tasks = await processor.parseFile(file.path);
        const marker = i === 0 ? chalk.green('→') : chalk.gray(' ');
        console.log(`  ${marker} ${file.name} (${tasks.length} tasks)`);
      }
      console.log();

      // Get project name if not provided
      let projectName = project;
      if (!projectName) {
        const { ConfigManager } = await import('./lib/config-manager.js');
        const configManager = new ConfigManager();
        const projects = await configManager.listProjects();

        if (projects.length === 0) {
          console.log(chalk.red('ERROR: No projects configured.\n'));
          console.log(chalk.gray('Please create a project configuration first.\n'));
          process.exit(1);
        }

        if (projects.length === 1) {
          projectName = projects[0];
          console.log(chalk.gray(`Using project: ${projectName}\n`));
        } else {
          const { selectedProject } = await inquirer.prompt([{
            type: 'list',
            name: 'selectedProject',
            message: 'Select project:',
            choices: projects
          }]);
          projectName = selectedProject;
          console.log();
        }
      }

      // Process files one at a time
      for (let i = 0; i < taskFiles.length; i++) {
        const file = taskFiles[i];

        console.log(chalk.cyan.bold(`\nProcessing: ${file.name}`));
        console.log(chalk.gray('─'.repeat(50)));

        const result = await processor.processFile(projectName, file.path);

        // Show summary
        console.log(processor.generateSummary(result));

        // Move to completed (unless dry-run)
        if (!options.dryRun && result.successful > 0) {
          const destPath = await processor.moveToCompleted(file.path);
          console.log(chalk.green(`\n✓ File moved to: ${destPath}\n`));
        }

        // Ask to continue to next file
        if (i < taskFiles.length - 1) {
          const nextFile = taskFiles[i + 1];
          const { continueNext } = await inquirer.prompt([{
            type: 'confirm',
            name: 'continueNext',
            message: `Continue with next file (${nextFile.name})?`,
            default: true
          }]);

          if (!continueNext) {
            console.log(chalk.gray('\nStopping. Remaining files left in inbox.\n'));
            break;
          }
        }
      }

      console.log(chalk.green.bold('\nTask processing complete!\n'));

    } catch (error) {
      displayError(error, { command: 'run' });
      process.exit(1);
    }
  });

// Status command - show running background tasks
program
  .command('status [project]')
  .description('Show running background tasks (optionally filter by project)')
  .action(async (project) => {
    try {
      const stateManager = new TaskStateManager();

      console.log(chalk.gray('Loading task status...'));

      // Sync states first (mark dead processes as interrupted)
      await stateManager.syncTaskStates();

      // Get tasks
      let tasks;
      if (project) {
        tasks = await stateManager.getProjectTasks(project);
        tasks = tasks.filter(t => t.status === 'running');
      } else {
        tasks = await stateManager.getRunningTasks();
      }

      if (tasks.length === 0) {
        if (project) {
          console.log(chalk.yellow(`\nNo running tasks for project: ${project}\n`));
        } else {
          console.log(chalk.yellow('\nNo running tasks\n'));
        }
        return;
      }

      // Helper function to format time ago
      const formatTimeAgo = (isoString) => {
        const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
      };

      // Display header
      console.log(chalk.bold.cyan('\n Running Background Tasks\n'));
      if (project) {
        console.log(chalk.gray(`Filtered by project: ${project}\n`));
      }

      // Display table header
      console.log(
        chalk.gray(
          'ID          '.padEnd(14) +
          'Project     '.padEnd(14) +
          'Stage       '.padEnd(12) +
          'Progress'.padEnd(10) +
          'ETA   '.padEnd(8) +
          'Started'
        )
      );
      console.log(chalk.gray('─'.repeat(70)));

      // Display each task
      for (const task of tasks) {
        const summary = stateManager.formatTaskSummary(task);
        const id = summary.id.substring(0, 12).padEnd(14);
        const proj = (summary.project.substring(0, 12)).padEnd(14);
        const stage = (summary.stage.substring(0, 10)).padEnd(12);
        const progress = `${summary.progress}%`.padEnd(10);
        const eta = summary.eta !== '-' ? `${summary.eta}s`.padEnd(8) : '-'.padEnd(8);
        const started = formatTimeAgo(summary.started);

        console.log(`${chalk.cyan(id)}${chalk.white(proj)}${chalk.yellow(stage)}${chalk.green(progress)}${chalk.blue(eta)}${chalk.gray(started)}`);
      }

      console.log(chalk.gray('\n' + '─'.repeat(70)));
      console.log(chalk.gray(`\nTotal: ${tasks.length} running task${tasks.length !== 1 ? 's' : ''}`));
      console.log(chalk.gray('\nCommands:'));
      console.log(chalk.white(`  View logs:   dev-tools logs <taskId>`));
      console.log(chalk.white(`  Cancel task: dev-tools cancel <taskId>`));
      console.log();

    } catch (error) {
      console.error(chalk.red('\nERROR:'), error.message);
      process.exit(1);
    }
  });

// Logs command - view or follow task logs
program
  .command('logs <taskId>')
  .description('View logs for a background task')
  .option('-f, --follow', 'Follow log output in real-time (like tail -f)')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(async (taskId, options) => {
    try {
      const stateManager = new TaskStateManager();
      const task = await stateManager.loadTaskState(taskId);

      if (!task) {
        console.error(chalk.red(`\nERROR: Task not found: ${taskId}\n`));
        process.exit(1);
      }

      const logPath = task.logFile || path.join(globalConfig.get('logsDir'), `${taskId}.log`);

      // Check if log file exists
      const { existsSync } = await import('fs');
      if (!existsSync(logPath)) {
        console.error(chalk.red(`\nERROR: Log file not found: ${logPath}\n`));
        process.exit(1);
      }

      console.log(chalk.gray(`\nTask: ${task.project} - ${task.description}`));
      console.log(chalk.gray(`Status: ${task.status}`));
      console.log(chalk.gray(`Log file: ${logPath}\n`));

      if (options.follow) {
        console.log(chalk.yellow('Following logs (press Ctrl+C to stop)...\n'));

        // Stream logs in real-time using tail -f
        const tail = spawn('tail', ['-f', logPath], { stdio: 'inherit' });

        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
          tail.kill();
          console.log(chalk.gray('\n\nStopped following logs\n'));
          process.exit(0);
        });

        // Handle tail exit
        tail.on('close', (code) => {
          process.exit(code);
        });

      } else {
        // Show last N lines using tail -n
        const tail = spawn('tail', ['-n', options.lines, logPath], { stdio: 'inherit' });

        tail.on('close', (code) => {
          console.log(); // Add newline at end
          process.exit(code);
        });
      }

    } catch (error) {
      console.error(chalk.red('\nERROR:'), error.message);
      process.exit(1);
    }
  });

// Cancel command - gracefully cancel a running background task
program
  .command('cancel [taskId]')
  .description('Cancel a running background task')
  .action(async (taskId) => {
    try {
      const stateManager = new TaskStateManager();

      // If no taskId provided, show interactive selection
      if (!taskId) {
        const running = await stateManager.getRunningTasks();

        if (running.length === 0) {
          console.log(chalk.yellow('\nNo running tasks to cancel\n'));
          return;
        }

        const choices = running.map(t => ({
          name: `${t.taskId.substring(0, 12)} - ${t.project} (${t.currentAgent || 'starting'})`,
          value: t.taskId
        }));

        const answer = await inquirer.prompt([{
          type: 'list',
          name: 'taskId',
          message: 'Select task to cancel:',
          choices
        }]);

        taskId = answer.taskId;
      }

      // Load task
      const task = await stateManager.loadTaskState(taskId);

      if (!task) {
        console.error(chalk.red(`\nERROR: Task not found: ${taskId}\n`));
        process.exit(1);
      }

      if (task.status !== 'running') {
        console.log(chalk.yellow(`\nWARNING: Task ${taskId} is not running (status: ${task.status})\n`));
        return;
      }

      console.log(chalk.yellow(`\nCanceling task ${taskId}...`));
      console.log(chalk.gray(`  Project: ${task.project}`));
      console.log(chalk.gray(`  PID: ${task.pid}`));

      // Try graceful shutdown first (SIGTERM)
      try {
        console.log(chalk.gray('\n  Sending SIGTERM (graceful shutdown)...'));
        process.kill(task.pid, 'SIGTERM');

        // Wait 5 seconds for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check if still running
        if (stateManager.isProcessRunning(task.pid)) {
          console.log(chalk.yellow('  Graceful shutdown timed out'));
          console.log(chalk.gray('  Sending SIGKILL (force kill)...'));
          process.kill(task.pid, 'SIGKILL');

          // Wait a bit for force kill to take effect
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.log(chalk.green('  Process stopped gracefully'));
        }

        // Update task state
        await stateManager.updateTaskState(taskId, {
          status: 'cancelled',
          completedAt: new Date().toISOString()
        });

        console.log(chalk.green(`\n✓ Task ${taskId} cancelled\n`));

      } catch (error) {
        if (error.code === 'ESRCH') {
          // Process already dead
          console.log(chalk.gray('  Process already stopped'));
          await stateManager.updateTaskState(taskId, {
            status: 'cancelled',
            completedAt: new Date().toISOString()
          });
          console.log(chalk.green(`\nSUCCESS: Task ${taskId} cancelled\n`));
        } else {
          console.error(chalk.red(`\nERROR: Failed to cancel task: ${error.message}\n`));
          process.exit(1);
        }
      }

    } catch (error) {
      console.error(chalk.red('\nERROR:'), error.message);
      process.exit(1);
    }
  });

// Simplified interactive mode
async function runWorkflow() {
  const inquirer = (await import('inquirer')).default;
  const fs = await import('fs/promises');
  const yaml = (await import('yaml')).default;

  console.log(chalk.cyan.bold('\nClaude Multi-Agent Coding System\n'));
  console.log(chalk.gray('Workflow: Project -> Task -> Execute -> Approve\n'));

  try {
    // Step 1: Load available projects
    const projectsDir = path.join(homedir(), '.claude-projects');
    let projectFiles = [];

    try {
      projectFiles = await fs.readdir(projectsDir);
      projectFiles = projectFiles.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    } catch {
      // No projects directory
    }

    let selectedProject = null;
    let needsProjectCreation = false;

    if (projectFiles.length === 0) {
      console.log(chalk.yellow('No projects configured yet.\n'));

      const { createProject } = await inquirer.prompt([{
        type: 'confirm',
        name: 'createProject',
        message: 'Would you like to create your first project?',
        default: true
      }]);

      if (!createProject) {
        console.log(chalk.gray('\nPlease create a project configuration file in ~/.claude-projects/\n'));
        process.exit(0);
      }

      needsProjectCreation = true;
    } else {
      // Step 2: Select project from dropdown
      const projectChoices = projectFiles.map(f => {
        const name = f.replace(/\.(yaml|yml)$/, '');
        return { name: `  ${name}`, value: name };
      });

      // Add "Create New Project" option
      projectChoices.push(
        { name: '─────────────────', value: 'separator', disabled: true },
        { name: '+ Create New Project', value: '__create_new__' }
      );

      const { project } = await inquirer.prompt([{
        type: 'list',
        name: 'project',
        message: 'Select project:',
        choices: projectChoices
      }]);

      if (project === '__create_new__') {
        needsProjectCreation = true;
      } else {
        selectedProject = project;
      }
    }

    // Handle project creation
    if (needsProjectCreation) {
      console.log(chalk.blue('\nCreating New Project\n'));

      // Get project name
      const { newProjectName } = await inquirer.prompt([{
        type: 'input',
        name: 'newProjectName',
        message: 'Project name:',
        validate: (input) => {
          if (!input || input.length === 0) return 'Project name is required';
          if (!/^[a-zA-Z0-9_-]+$/.test(input)) return 'Only letters, numbers, hyphens, and underscores allowed';
          if (projectFiles.includes(`${input}.yaml`)) return `Project '${input}' already exists`;
          return true;
        }
      }]);

      // Get basic project details (minimal - no GitHub yet)
      const { description, localPath, baseBranch, dockerImage } = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: 'Project description:',
          default: `Automated project: ${newProjectName}`
        },
        {
          type: 'input',
          name: 'localPath',
          message: 'Local project path:',
          default: path.join(homedir(), 'projects', newProjectName)
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
          message: 'Docker image:',
          choices: ['claude-python:latest', 'claude-node:latest'],
          default: 'claude-python:latest'
        }
      ]);

      // Ask for GitHub repo (but don't create it yet)
      const { githubRepo } = await inquirer.prompt([{
        type: 'input',
        name: 'githubRepo',
        message: 'GitHub repository (owner/repo):',
        validate: (input) => {
          if (!input) return 'Repository is required';
          if (!input.includes('/')) return 'Format must be: owner/repo';
          return true;
        }
      }]);

      // Create project configuration (no GitHub repo creation yet)
      const config = {
        name: newProjectName,
        repo: `github.com/${githubRepo}`,
        base_branch: baseBranch,
        pr: {
          title_prefix: `[${newProjectName}]`,
          auto_merge: false,
          reviewers: [],
          labels: ['automated']
        },
        docker: {
          image: dockerImage,
          memory: '1g',
          cpus: 2,
          network_mode: 'none'
        },
        tests: {
          command: '',
          timeout: 30,
          required: false
        },
        security: {
          secrets_scanning: true,
          dependency_check: true
        },
        safety: {
          max_cost_per_task: 2.0,
          max_duration: 300,
          max_file_size: 1048576
        }
      };

      // Save configuration
      await fs.mkdir(projectsDir, { recursive: true });
      const configPath = path.join(projectsDir, `${newProjectName}.yaml`);
      const yamlContent = yaml.stringify(config);
      await fs.writeFile(configPath, yamlContent);

      console.log(chalk.green(`\nProject '${newProjectName}' configured!\n`));
      console.log(chalk.gray(`Config saved: ${configPath}`));
      console.log(chalk.yellow(`\nNote: GitHub repo will be validated/created in the next step.\n`));

      selectedProject = newProjectName;
    }

    // Step 3: Enter task description
    const { description } = await inquirer.prompt([{
      type: 'input',
      name: 'description',
      message: 'What would you like me to do?',
      validate: (input) => input.length > 0 || 'Task description is required'
    }]);

    console.log(chalk.blue('\nTask submitted!\n'));
    console.log(chalk.gray(`  Project: ${selectedProject}`));
    console.log(chalk.gray(`  Task: ${description}\n`));

    // Step 4: Validate GitHub repo
    const configPath = path.join(projectsDir, `${selectedProject}.yaml`);
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = yaml.parse(configContent);

    if (config.repo && config.repo !== 'local' && process.env.GITHUB_TOKEN) {
      console.log(chalk.blue('Validating GitHub repository...\n'));

      const { GitHubClient } = await import('./lib/github-client.js');
      const githubClient = new GitHubClient(process.env.GITHUB_TOKEN);

      const repoExists = await githubClient.checkRepoAccess(config.repo);

      if (!repoExists) {
        console.log(chalk.yellow(`WARNING: Repository not found: ${config.repo}\n`));

        const { createRepo } = await inquirer.prompt([{
          type: 'confirm',
          name: 'createRepo',
          message: 'Would you like to create this repository on GitHub?',
          default: true
        }]);

        if (createRepo) {
          const [, repoPath] = config.repo.split('github.com/');
          const repoName = repoPath.split('/')[1];

          console.log(chalk.blue(`\nCreating repository '${repoName}'...\n`));

          const newRepo = await githubClient.createRepository({
            name: repoName,
            description: `Project: ${selectedProject}`,
            private: false,
            autoInit: true
          });

          console.log(chalk.green(`Repository created: ${newRepo.url}\n`));

          // Clone the repo
          const localPath = path.join(homedir(), 'projects', selectedProject);
          console.log(chalk.blue(`Cloning to ${localPath}...\n`));

          const { spawn } = await import('child_process');
          await new Promise((resolve, reject) => {
            const git = spawn('git', ['clone', newRepo.cloneUrl, localPath]);
            git.on('close', (code) => {
              if (code === 0) {
                console.log(chalk.green(`Repository cloned!\n`));
                resolve();
              } else {
                reject(new Error('Git clone failed'));
              }
            });
          });
        } else {
          console.log(chalk.yellow('\nWARNING: Continuing without GitHub repository.\n'));
        }
      } else {
        console.log(chalk.green(`Repository validated\n`));
      }
    }

    // Step 5: Execute task
    console.log(chalk.blue.bold('Executing Task...\n'));

    const orchestrator = new Orchestrator(
      process.env.GITHUB_TOKEN,
      process.env.ANTHROPIC_API_KEY
    );

    const result = await orchestrator.executeTask(selectedProject, description);

    // Step 6: Display results
    console.log(chalk.cyan.bold('\nSUCCESS: Task Completed!\n'));

    if (result.pr) {
      console.log(chalk.green.bold('Pull Request Created:\n'));
      console.log(chalk.cyan(`  ${result.pr.url}\n`));
      console.log(chalk.gray('Review and merge the PR in GitHub when ready.\n'));
    } else {
      console.log(chalk.yellow('Branch created but PR not created automatically.'));
      console.log(chalk.gray(`  Branch: ${result.branchName}`));
      console.log(chalk.gray(`  Task ID: ${result.taskId}\n`));
    }

    // Step 7: Auto cleanup containers
    console.log(chalk.blue('Cleaning up containers...\n'));
    await orchestrator.cleanupAll();

    console.log(chalk.green.bold('Workflow Complete!\n'));

  } catch (error) {
    console.error(chalk.red('\nERROR: Workflow error:'), error.message);
    process.exit(1);
  }
}

// Check if no command provided - run workflow
if (process.argv.length === 2) {
  runWorkflow().catch(error => {
    console.error(chalk.red('\nERROR:'), error.message);
    process.exit(1);
  });
} else {
  // Parse command line arguments normally
  program.parse();
}
