#!/usr/bin/env node

/**
 * Claude Multi-Agent Coding System - CLI Entry Point
 * Mobile-accessible AI-powered coding orchestration for Raspberry Pi
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { Orchestrator } from './lib/orchestrator.js';
import { getGlobalConfig } from './lib/global-config.js';
import dotenv from 'dotenv';
import path from 'path';

// Initialize global config and ensure directories exist
const globalConfig = getGlobalConfig();
globalConfig.ensureDirectories();

// Load environment variables from configured location
dotenv.config({ path: globalConfig.get('envFile') });

const program = new Command();

program
  .name('dev-tools')
  .description('Dev Tools - AI-powered development orchestration')
  .version('0.13.0');

// Task command - create a new coding task
program
  .command('task <project> <description>')
  .description('Create a new coding task')
  .action(async (project, description) => {
    try {
      console.log(chalk.blue.bold('\nClaude Multi-Agent System\n'));
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );
      await orchestrator.executeTask(project, description);
    } catch (error) {
      console.error(chalk.red('\nERROR:'), error.message);
      process.exit(1);
    }
  });

// Approve command - manually create PR (if auto-creation failed)
program
  .command('approve <taskId>')
  .description('Manually create PR for a task (use if auto-PR creation failed)')
  .action(async (taskId) => {
    try {
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );
      const pr = await orchestrator.approve(taskId);
      console.log(chalk.green(`\nPR created: ${pr.url}\n`));
    } catch (error) {
      console.error(chalk.red('\nERROR:'), error.message);
      process.exit(1);
    }
  });

// Reject command - reject task and cleanup (delete branch)
program
  .command('reject <taskId>')
  .description('Reject task and delete branch (use to discard unwanted changes)')
  .action(async (taskId) => {
    try {
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );
      await orchestrator.reject(taskId);
      console.log(chalk.yellow('\nTask rejected and cleaned up\n'));
    } catch (error) {
      console.error(chalk.red('\nERROR:'), error.message);
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
      console.error(chalk.red('\nERROR:'), error.message);
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
      console.error(chalk.red('\nERROR:'), error.message);
      process.exit(1);
    }
  });

// Monitor command - show system status
program
  .command('monitor')
  .description('Show system status')
  .action(async () => {
    console.log(chalk.blue('\nSystem Monitor\n'));
    console.log(chalk.yellow('WARNING: Monitor command not implemented yet'));
    console.log(chalk.gray('Coming in Phase 1: Week 8\n'));
    // TODO: Display system info: CPU, RAM, disk, Docker containers, active tasks
  });

// Add project command - interactive wizard
program
  .command('add-project <name>')
  .description('Add new project with GitHub validation (interactive)')
  .option('--no-github', 'Skip GitHub validation and repo creation')
  .action(async (name, options) => {
    try {
      const inquirer = (await import('inquirer')).default;
      const yaml = (await import('yaml')).default;
      const fs = await import('fs/promises');
      const path = await import('path');
      const { homedir } = await import('os');

      console.log(chalk.blue.bold(`\nAdding Project: ${name}\n`));

      // Check if project already exists
      const projectsDir = path.join(homedir(), '.claude-projects');
      const configPath = path.join(projectsDir, `${name}.yaml`);

      try {
        await fs.access(configPath);
        console.log(chalk.red(`ERROR: Project '${name}' already exists at ${configPath}\n`));
        process.exit(1);
      } catch {
        // Good, project doesn't exist yet
      }

      // Gather project information
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: 'Project description:',
          default: `Automated project: ${name}`
        },
        {
          type: 'input',
          name: 'localPath',
          message: 'Local project path:',
          default: path.join(homedir(), 'projects', name),
          validate: (input) => input.length > 0 || 'Path is required'
        },
        {
          type: 'confirm',
          name: 'hasGitHub',
          message: 'Use GitHub integration?',
          default: !options.noGithub,
          when: () => !options.noGithub
        },
        {
          type: 'input',
          name: 'githubRepo',
          message: 'GitHub repository (owner/repo):',
          when: (answers) => answers.hasGitHub,
          validate: (input) => {
            if (!input) return 'Repository is required for GitHub integration';
            if (!input.includes('/')) return 'Format must be: owner/repo';
            return true;
          }
        },
        {
          type: 'list',
          name: 'visibility',
          message: 'Repository visibility:',
          choices: ['public', 'private'],
          default: 'public',
          when: (answers) => answers.hasGitHub
        },
        {
          type: 'input',
          name: 'baseBranch',
          message: 'Base branch:',
          default: 'main'
        },
        {
          type: 'input',
          name: 'dockerImage',
          message: 'Docker image:',
          default: 'claude-python:latest'
        }
      ]);

      // Validate and create GitHub repo if needed
      if (answers.hasGitHub && process.env.GITHUB_TOKEN) {
        console.log(chalk.blue('\nValidating GitHub repository...\n'));

        const { GitHubClient } = await import('./lib/github-client.js');
        const githubClient = new GitHubClient(process.env.GITHUB_TOKEN);

        const fullRepoUrl = `github.com/${answers.githubRepo}`;
        const repoExists = await githubClient.checkRepoAccess(fullRepoUrl);

        if (!repoExists) {
          console.log(chalk.yellow(`WARNING: Repository '${answers.githubRepo}' not found\n`));

          const createRepo = await inquirer.prompt([{
            type: 'confirm',
            name: 'create',
            message: 'Would you like me to create this repository on GitHub?',
            default: true
          }]);

          if (createRepo.create) {
            const repoName = answers.githubRepo.split('/')[1];
            const user = await githubClient.getAuthenticatedUser();

            console.log(chalk.blue(`\nCreating repository '${repoName}' for ${user.login}...\n`));

            const newRepo = await githubClient.createRepository({
              name: repoName,
              description: answers.description,
              private: answers.visibility === 'private',
              autoInit: true
            });

            console.log(chalk.green(`Repository created: ${newRepo.url}\n`));

            // Ask if they want to clone it
            const clonePrompt = await inquirer.prompt([{
              type: 'confirm',
              name: 'clone',
              message: `Clone repository to ${answers.localPath}?`,
              default: true
            }]);

            if (clonePrompt.clone) {
              console.log(chalk.blue(`\nCloning repository...\n`));
              const { spawn } = await import('child_process');

              await new Promise((resolve, reject) => {
                const git = spawn('git', ['clone', newRepo.cloneUrl, answers.localPath]);
                git.on('close', (code) => {
                  if (code === 0) {
                    console.log(chalk.green(`Repository cloned to ${answers.localPath}\n`));
                    resolve();
                  } else {
                    reject(new Error('Git clone failed'));
                  }
                });
              });
            }
          } else {
            console.log(chalk.yellow('WARNING: Skipping repository creation. You\'ll need to create it manually.\n'));
          }
        } else {
          console.log(chalk.green(`Repository '${answers.githubRepo}' found and accessible\n`));
        }
      } else if (answers.hasGitHub && !process.env.GITHUB_TOKEN) {
        console.log(chalk.yellow('\nWARNING: GITHUB_TOKEN not set. Skipping validation.\n'));
        console.log(chalk.gray('Set GITHUB_TOKEN in .env to enable GitHub features\n'));
      }

      // Create project configuration
      const config = {
        name,
        repo: answers.githubRepo ? `github.com/${answers.githubRepo}` : 'local',
        base_branch: answers.baseBranch,
        pr: {
          title_prefix: `[${name}]`,
          auto_merge: false,
          reviewers: [],
          labels: ['automated']
        },
        docker: {
          image: answers.dockerImage,
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
      const yamlContent = yaml.stringify(config);
      await fs.writeFile(configPath, yamlContent);

      console.log(chalk.green.bold(`\nProject '${name}' configured!\n`));
      console.log(chalk.gray(`Config saved: ${configPath}\n`));
      console.log(chalk.cyan(`Next steps:`));
      console.log(chalk.gray(`  1. Review/edit config: ${configPath}`));
      console.log(chalk.gray(`  2. Run task: dev-tools task ${name} "<description>"\n`));

    } catch (error) {
      console.error(chalk.red('\nERROR: Failed to add project:'), error.message);
      process.exit(1);
    }
  });

// Cleanup command - remove all hanging Claude containers
program
  .command('cleanup')
  .description('Clean up all hanging Claude containers')
  .option('-a, --all', 'Clean up ALL Claude containers (including active ones)')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\nClaude Container Cleanup\n'));
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );

      if (options.all) {
        // Clean up ALL Claude containers (including active)
        const result = await orchestrator.cleanupAllClaudeContainers();
        if (result.cleaned > 0) {
          console.log(chalk.green(`\nCleanup complete: ${result.cleaned} container(s) removed\n`));
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
      console.error(chalk.red('\nERROR: Cleanup failed:'), error.message);
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
      console.error(chalk.red('\nERROR: Validation failed:'), error.message);
      process.exit(1);
    }
  });

// Test command - run unit tests
program
  .command('test')
  .description('Run unit tests')
  .option('--all', 'Run all tests (unit + smoke + validation)')
  .action(async (options) => {
    try {
      const { spawn } = await import('child_process');

      let testScript;
      let testName;

      if (options.all) {
        // Run all tests via npm script
        console.log(chalk.cyan.bold('\nRunning All Tests...\n'));
        const testProcess = spawn('npm', ['run', 'test:all'], {
          cwd: process.cwd(),
          stdio: 'inherit',
          shell: true
        });

        testProcess.on('close', (code) => {
          process.exit(code);
        });
      } else {
        // Run just unit tests
        console.log(chalk.cyan.bold('\nRunning Unit Tests...\n'));
        const testProcess = spawn('node', ['test/run-unit-tests.js'], {
          cwd: process.cwd(),
          stdio: 'inherit'
        });

        testProcess.on('close', (code) => {
          process.exit(code);
        });
      }

    } catch (error) {
      console.error(chalk.red('\nERROR: Test failed:'), error.message);
      process.exit(1);
    }
  });

// Cancel command - cancel a task and cleanup
program
  .command('cancel <taskId>')
  .description('Cancel task and cleanup (works for any status)')
  .action(async (taskId) => {
    try {
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );
      await orchestrator.cancel(taskId);
      console.log(chalk.yellow('\nTask cancelled and cleaned up\n'));
    } catch (error) {
      console.error(chalk.red('\nERROR:'), error.message);
      process.exit(1);
    }
  });

// Retry command - retry a failed task
program
  .command('retry <taskId>')
  .description('Retry a failed or rejected task')
  .action(async (taskId) => {
    try {
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );
      await orchestrator.retry(taskId);
    } catch (error) {
      console.error(chalk.red('\nERROR:'), error.message);
      process.exit(1);
    }
  });

// Diff command - show git diff for a task
program
  .command('diff <taskId>')
  .description('Show git diff for task changes')
  .option('--stat', 'Show diffstat only')
  .action(async (taskId, options) => {
    try {
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );
      await orchestrator.showDiff(taskId, options.stat);
    } catch (error) {
      console.error(chalk.red('\nERROR:'), error.message);
      process.exit(1);
    }
  });

// Workflow-driven interactive mode
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

    if (projectFiles.length === 0) {
      console.log(chalk.yellow('WARNING: No projects configured yet.\n'));

      const { createProject } = await inquirer.prompt([{
        type: 'confirm',
        name: 'createProject',
        message: 'Would you like to create your first project?',
        default: true
      }]);

      if (createProject) {
        const { projectName } = await inquirer.prompt([{
          type: 'input',
          name: 'projectName',
          message: 'Project name:',
          validate: (input) => input.length > 0 || 'Project name is required'
        }]);

        // Run add-project
        process.argv = ['node', 'cli.js', 'add-project', projectName];
        program.parse();
        return;
      } else {
        console.log(chalk.gray('\nRun "dev-tools add-project <name>" to add a project.\n'));
        process.exit(0);
      }
    }

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

    // Handle "Create New Project" selection
    let selectedProject = project;
    if (project === '__create_new__') {
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
    console.log(chalk.cyan.bold('\n✅ Task Completed!\n'));

    if (result.pr) {
      console.log(chalk.green.bold('Pull Request Created:\n'));
      console.log(chalk.cyan(`  ${result.pr.url}\n`));
      console.log(chalk.gray('Review and merge the PR in GitHub when ready.\n'));
    } else {
      console.log(chalk.yellow('Branch created but PR not created automatically.'));
      console.log(chalk.gray(`  Branch: ${result.branchName}`));
      console.log(chalk.gray(`  Create PR manually: dev-tools approve ${result.taskId}\n`));
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
