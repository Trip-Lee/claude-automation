#!/usr/bin/env node

/**
 * Claude Automation Installer
 *
 * Interactive installation wizard that:
 * 1. Validates system dependencies
 * 2. Creates configuration directories
 * 3. Sets up global config
 * 4. Prompts for API keys
 * 5. Creates .env file
 * 6. Links CLI commands
 */

import { SystemValidator } from './lib/system-validator.js';
import { getGlobalConfig } from './lib/global-config.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

console.log(chalk.bold.cyan('\n═══════════════════════════════════════════════════════════\n'));
console.log(chalk.bold.cyan('  🚀 Claude Automation Installation Wizard\n'));
console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════\n'));

async function main() {
  try {
    // Step 1: System Validation
    console.log(chalk.bold('Step 1: Validating System Dependencies\n'));
    const validator = new SystemValidator();
    const results = await validator.validateAll();

    if (!results.allPassed) {
      console.log(chalk.red('\n❌ Installation cannot continue with missing dependencies.'));
      console.log(chalk.yellow('Please fix the issues above and run the installer again.\n'));
      process.exit(1);
    }

    console.log(chalk.green('✅ All system dependencies validated!\n'));

    // Step 2: Initialize Global Config
    console.log(chalk.bold('Step 2: Setting Up Configuration\n'));
    const globalConfig = getGlobalConfig();

    // Update installation path
    globalConfig.updateInstallInfo({
      installPath: process.cwd(),
      installedAt: new Date().toISOString(),
      version: '0.13.0'
    });

    console.log(chalk.gray(`  Installation directory: ${process.cwd()}`));

    // Step 3: Create Directories
    console.log(chalk.bold('\nStep 3: Creating Directory Structure\n'));
    const dirResults = globalConfig.ensureDirectories();

    if (dirResults.created.length > 0) {
      console.log(chalk.green('  Created directories:'));
      dirResults.created.forEach(dir => {
        console.log(chalk.gray(`    - ${dir}`));
      });
    }

    if (dirResults.existing.length > 0) {
      console.log(chalk.gray('  Existing directories:'));
      dirResults.existing.forEach(dir => {
        console.log(chalk.gray(`    - ${dir}`));
      });
    }

    if (dirResults.failed.length > 0) {
      console.log(chalk.red('\n  Failed to create:'));
      dirResults.failed.forEach(({ dir, error }) => {
        console.log(chalk.red(`    - ${dir}: ${error}`));
      });
      console.log(chalk.red('\n❌ Installation failed due to directory creation errors.\n'));
      process.exit(1);
    }

    console.log(chalk.green('\n✅ Directory structure created!\n'));

    // Step 4: API Keys Configuration
    console.log(chalk.bold('Step 4: API Keys Configuration\n'));

    const envPath = globalConfig.get('envFile');
    let existingEnv = {};

    // Load existing .env if it exists
    if (existsSync(envPath)) {
      console.log(chalk.yellow(`  Found existing .env file at ${envPath}`));
      const content = readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          existingEnv[key.trim()] = valueParts.join('=').trim();
        }
      });
    }

    // Prompt for API keys
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'ANTHROPIC_API_KEY',
        message: 'Enter your Anthropic API Key (required):',
        default: existingEnv.ANTHROPIC_API_KEY || '',
        validate: (input) => {
          if (!input || input.trim() === '') {
            return 'Anthropic API Key is required for Claude Automation';
          }
          if (!input.startsWith('sk-ant-')) {
            return 'Anthropic API Key should start with "sk-ant-"';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'GITHUB_TOKEN',
        message: 'Enter your GitHub Personal Access Token (optional, recommended):',
        default: existingEnv.GITHUB_TOKEN || '',
        validate: (input) => {
          if (input && !input.startsWith('ghp_') && !input.startsWith('github_pat_')) {
            return 'GitHub token should start with "ghp_" or "github_pat_"';
          }
          return true;
        }
      }
    ]);

    // Create or update .env file
    const envContent = `# Claude Automation Configuration
# Generated: ${new Date().toISOString()}

# Required: Anthropic API Key for Claude
ANTHROPIC_API_KEY=${answers.ANTHROPIC_API_KEY}

# Optional: GitHub Personal Access Token (for PR creation, repo access)
${answers.GITHUB_TOKEN ? `GITHUB_TOKEN=${answers.GITHUB_TOKEN}` : '# GITHUB_TOKEN=your_token_here'}

# Optional: Docker defaults (can be overridden per-project)
# DEFAULT_DOCKER_MEMORY=4g
# DEFAULT_DOCKER_CPUS=2

# Optional: Safety defaults
# DEFAULT_MAX_COST=5.00
`;

    writeFileSync(envPath, envContent, 'utf8');
    console.log(chalk.green(`\n✅ Configuration saved to ${envPath}\n`));

    // Step 5: Link CLI Command
    console.log(chalk.bold('Step 5: Setting Up CLI Command\n'));

    try {
      // Check if already linked
      let needsLink = true;
      try {
        const linkedPath = execSync('which claude', { encoding: 'utf8' }).trim();
        if (linkedPath) {
          console.log(chalk.gray(`  CLI already linked: ${linkedPath}`));
          needsLink = false;
        }
      } catch (error) {
        // Not linked yet
      }

      if (needsLink) {
        console.log(chalk.gray('  Linking CLI command (may require sudo)...'));
        try {
          execSync('npm link', { stdio: 'inherit' });
          console.log(chalk.green('  ✅ CLI command "claude" is now available globally'));
        } catch (error) {
          console.log(chalk.yellow('  ⚠️  Could not automatically link CLI command'));
          console.log(chalk.gray('  You can manually link it later with: npm link'));
          console.log(chalk.gray(`  Or run directly: node ${join(process.cwd(), 'cli.js')}`));
        }
      }
    } catch (error) {
      console.log(chalk.yellow('  ⚠️  CLI linking skipped'));
    }

    // Step 6: Create Example Project Config
    console.log(chalk.bold('\nStep 6: Example Project Configuration\n'));

    const exampleConfigPath = join(globalConfig.get('configDir'), 'example-project.yaml');
    if (!existsSync(exampleConfigPath)) {
      const exampleConfig = `# Example Project Configuration for Claude Automation
# Copy this file and customize for your project

name: example-project
repo: github.com/your-username/your-repo
base_branch: main

protected_branches:
  - main
  - master
  - develop

docker:
  image: anthropics/claude-code-agent:latest
  memory: 4g
  cpus: 2
  network_mode: none

safety:
  max_cost_per_task: 5.00
  allow_dependency_changes: false
  require_manual_review: false
  backup_before_changes: false

# Optional: Tests, lint, security configurations
# tests:
#   command: npm test
#   timeout: 300
#
# lint:
#   command: npm run lint
#   autofix: true
`;

      writeFileSync(exampleConfigPath, exampleConfig, 'utf8');
      console.log(chalk.green(`  ✅ Example config created: ${exampleConfigPath}`));
      console.log(chalk.gray('  Copy and customize this for your projects'));
    } else {
      console.log(chalk.gray(`  Example config already exists: ${exampleConfigPath}`));
    }

    // Installation Complete!
    console.log(chalk.bold.green('\n═══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.green('  ✨ Installation Complete! ✨'));
    console.log(chalk.bold.green('═══════════════════════════════════════════════════════════\n'));

    console.log(chalk.bold('Quick Start:\n'));
    console.log(chalk.cyan('  1. Create a project config:'));
    console.log(chalk.gray(`     cp ${exampleConfigPath} ~/.claude-projects/my-project.yaml`));
    console.log(chalk.gray('     # Edit my-project.yaml with your project details\n'));

    console.log(chalk.cyan('  2. Run your first task:'));
    console.log(chalk.gray('     claude task my-project "Add documentation to README"\n'));

    console.log(chalk.cyan('  3. Or use workflow mode:'));
    console.log(chalk.gray('     claude\n'));

    console.log(chalk.bold('Documentation:\n'));
    console.log(chalk.gray('  - Installation Guide: INSTALLATION.md'));
    console.log(chalk.gray('  - User Guide: README.md'));
    console.log(chalk.gray('  - Changelog: docs/CHANGELOG.md\n'));

    console.log(chalk.bold('Configuration Locations:\n'));
    console.log(chalk.gray(`  - Global Config: ${globalConfig.configFile}`));
    console.log(chalk.gray(`  - Environment: ${envPath}`));
    console.log(chalk.gray(`  - Project Configs: ${globalConfig.get('configDir')}`));
    console.log(chalk.gray(`  - Tasks Data: ${globalConfig.get('tasksDir')}`));
    console.log(chalk.gray(`  - Logs: ${globalConfig.get('logsDir')}\n`));

    console.log(chalk.green('Happy coding! 🚀\n'));

  } catch (error) {
    console.error(chalk.red(`\n❌ Installation failed: ${error.message}\n`));
    console.error(chalk.gray(error.stack));
    process.exit(1);
  }
}

main();
