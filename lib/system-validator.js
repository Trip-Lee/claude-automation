/**
 * SystemValidator - Validates system dependencies and requirements
 *
 * Checks for:
 * - Node.js version
 * - Docker installation and status
 * - Git installation
 * - GitHub CLI (optional)
 * - Required directories and permissions
 */

import { execSync } from 'child_process';
import { existsSync, accessSync, constants } from 'fs';
import chalk from 'chalk';

export class SystemValidator {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  /**
   * Run all validation checks
   * @returns {Promise<Object>} Validation results
   */
  async validateAll() {
    console.log(chalk.bold('\n🔍 Validating System Requirements...\n'));

    await this.checkNodeVersion();
    await this.checkDocker();
    await this.checkGit();
    await this.checkGitHubCLI();

    return this.getResults();
  }

  /**
   * Check Node.js version
   */
  async checkNodeVersion() {
    try {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0]);

      if (major >= 20) {
        this.pass(`Node.js ${version} (>= 20.0.0 required)`);
      } else {
        this.fail(
          `Node.js ${version} is too old`,
          'Upgrade to Node.js 20.0.0 or later: https://nodejs.org/'
        );
      }
    } catch (error) {
      this.fail('Node.js check failed', error.message);
    }
  }

  /**
   * Check Docker installation and daemon status
   */
  async checkDocker() {
    try {
      // Check if docker command exists
      const version = execSync('docker --version', { encoding: 'utf8' }).trim();
      this.pass(`Docker installed: ${version}`);

      // Check if docker daemon is running
      try {
        execSync('docker info', { stdio: 'ignore' });
        this.pass('Docker daemon is running');
      } catch (error) {
        this.fail(
          'Docker daemon is not running',
          'Start Docker: sudo systemctl start docker'
        );
      }
    } catch (error) {
      this.fail(
        'Docker is not installed',
        'Install Docker: https://docs.docker.com/engine/install/'
      );
    }
  }

  /**
   * Check Git installation
   */
  async checkGit() {
    try {
      const version = execSync('git --version', { encoding: 'utf8' }).trim();
      this.pass(`Git installed: ${version}`);
    } catch (error) {
      this.fail(
        'Git is not installed',
        'Install Git: sudo apt install git'
      );
    }
  }

  /**
   * Check GitHub CLI (optional but recommended)
   */
  async checkGitHubCLI() {
    try {
      const version = execSync('gh --version', { encoding: 'utf8' }).trim().split('\n')[0];
      this.pass(`GitHub CLI installed: ${version}`);

      // Check if authenticated
      try {
        execSync('gh auth status', { stdio: 'ignore' });
        this.pass('GitHub CLI is authenticated');
      } catch (error) {
        this.warn(
          'GitHub CLI is not authenticated',
          'Run: gh auth login'
        );
      }
    } catch (error) {
      this.warn(
        'GitHub CLI is not installed (optional)',
        'Install: sudo apt install gh (recommended for easier GitHub integration)'
      );
    }
  }

  /**
   * Check if a directory exists and is writable
   * @param {string} dirPath - Directory path to check
   * @param {string} name - Directory description
   */
  checkDirectory(dirPath, name) {
    try {
      if (existsSync(dirPath)) {
        // Check if writable
        accessSync(dirPath, constants.W_OK);
        this.pass(`${name} exists and is writable`);
        return true;
      } else {
        this.warn(
          `${name} does not exist`,
          `Will be created at: ${dirPath}`
        );
        return false;
      }
    } catch (error) {
      this.fail(
        `${name} is not writable`,
        `Check permissions: ${dirPath}`
      );
      return false;
    }
  }

  /**
   * Check environment variables
   * @param {string} varName - Environment variable name
   * @param {boolean} required - Whether the variable is required
   */
  checkEnvVar(varName, required = true) {
    const value = process.env[varName];

    if (value) {
      this.pass(`${varName} is set`);
      return true;
    } else {
      if (required) {
        this.fail(
          `${varName} is not set`,
          `Add to ~/.env: ${varName}=your_value_here`
        );
      } else {
        this.warn(
          `${varName} is not set (optional)`,
          `Add to ~/.env if needed: ${varName}=your_value_here`
        );
      }
      return false;
    }
  }

  /**
   * Record a passed check
   */
  pass(message) {
    this.results.passed.push(message);
    console.log(chalk.green(`  ✅ ${message}`));
  }

  /**
   * Record a failed check
   */
  fail(message, solution) {
    this.results.failed.push({ message, solution });
    console.log(chalk.red(`  ❌ ${message}`));
    if (solution) {
      console.log(chalk.gray(`     → ${solution}`));
    }
  }

  /**
   * Record a warning
   */
  warn(message, solution) {
    this.results.warnings.push({ message, solution });
    console.log(chalk.yellow(`  ⚠️  ${message}`));
    if (solution) {
      console.log(chalk.gray(`     → ${solution}`));
    }
  }

  /**
   * Get validation results
   * @returns {Object} Results with pass/fail counts
   */
  getResults() {
    const allPassed = this.results.failed.length === 0;

    console.log(chalk.bold('\n📊 Validation Summary:\n'));
    console.log(chalk.green(`  ✅ Passed: ${this.results.passed.length}`));
    console.log(chalk.yellow(`  ⚠️  Warnings: ${this.results.warnings.length}`));
    console.log(chalk.red(`  ❌ Failed: ${this.results.failed.length}`));

    if (allPassed) {
      console.log(chalk.green.bold('\n✨ All required dependencies are met!\n'));
    } else {
      console.log(chalk.red.bold('\n❌ Some required dependencies are missing. Please fix the issues above.\n'));
    }

    return {
      passed: this.results.passed,
      warnings: this.results.warnings,
      failed: this.results.failed,
      allPassed
    };
  }

  /**
   * Quick validation (just checks, no output)
   * @returns {Promise<boolean>} True if all checks pass
   */
  static async quickCheck() {
    try {
      // Node version
      const major = parseInt(process.version.slice(1).split('.')[0]);
      if (major < 20) return false;

      // Docker
      execSync('docker info', { stdio: 'ignore' });

      // Git
      execSync('git --version', { stdio: 'ignore' });

      return true;
    } catch (error) {
      return false;
    }
  }
}

export default SystemValidator;
