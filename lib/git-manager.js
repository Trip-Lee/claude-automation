/**
 * GitManager - Handles Git operations (clone, pull, branch management)
 *
 * All Git operations run on the HOST, not in containers.
 * This ensures GitHub tokens stay secure and never enter containers.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

export class GitManager {
  constructor() {
    // No initialization needed
  }

  /**
   * Pull latest changes from remote
   * @param {string} projectPath - Path to git repository
   * @param {string} branch - Branch name
   */
  async pull(projectPath, branch) {
    console.log(chalk.gray(`  Pulling latest from ${branch}...`));

    try {
      // Checkout the branch first
      await execAsync(`git checkout ${branch}`, { cwd: projectPath });

      // Pull latest changes
      const { stdout, stderr } = await execAsync(
        `git pull origin ${branch}`,
        { cwd: projectPath }
      );

      if (stderr && !stderr.includes('up-to-date') && !stderr.includes('Already up to date')) {
        console.log(chalk.yellow(stderr));
      }

      console.log(chalk.green(`  ✅ Up to date with ${branch}`));
      return stdout;
    } catch (error) {
      throw new Error(`Failed to pull ${branch}: ${error.message}`);
    }
  }

  /**
   * Create a new branch
   * @param {string} projectPath - Path to git repository
   * @param {string} branchName - Name of new branch
   */
  async createBranch(projectPath, branchName) {
    try {
      const { stdout } = await execAsync(
        `git checkout -b ${branchName}`,
        { cwd: projectPath }
      );
      return stdout;
    } catch (error) {
      throw new Error(`Failed to create branch ${branchName}: ${error.message}`);
    }
  }

  /**
   * Delete a branch
   * @param {string} projectPath - Path to git repository
   * @param {string} branchName - Branch to delete
   * @param {boolean} force - Force delete (default: false)
   */
  async deleteBranch(projectPath, branchName, force = false) {
    try {
      // Switch to main/master first
      await execAsync('git checkout main || git checkout master', { cwd: projectPath });

      // Delete the branch
      const flag = force ? '-D' : '-d';
      const { stdout } = await execAsync(
        `git branch ${flag} ${branchName}`,
        { cwd: projectPath }
      );
      return stdout;
    } catch (error) {
      throw new Error(`Failed to delete branch ${branchName}: ${error.message}`);
    }
  }

  /**
   * Get git status
   * @param {string} projectPath - Path to git repository
   * @returns {Promise<string>} - Git status output
   */
  async getStatus(projectPath) {
    try {
      const { stdout } = await execAsync('git status', { cwd: projectPath });
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get git status: ${error.message}`);
    }
  }

  /**
   * Get git diff
   * @param {string} projectPath - Path to git repository
   * @param {Object} options - Diff options
   * @param {boolean} options.staged - Show staged changes
   * @param {string} options.file - Specific file to diff
   * @returns {Promise<string>} - Git diff output
   */
  async getDiff(projectPath, options = {}) {
    try {
      let command = 'git diff';

      if (options.staged) {
        command += ' --staged';
      }

      if (options.file) {
        command += ` ${options.file}`;
      }

      const { stdout } = await execAsync(command, { cwd: projectPath });
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get git diff: ${error.message}`);
    }
  }

  /**
   * Stage files for commit
   * @param {string} projectPath - Path to git repository
   * @param {string|Array<string>} files - Files to stage (use '.' for all)
   */
  async add(projectPath, files = '.') {
    try {
      const fileList = Array.isArray(files) ? files.join(' ') : files;
      const { stdout } = await execAsync(
        `git add ${fileList}`,
        { cwd: projectPath }
      );
      return stdout;
    } catch (error) {
      throw new Error(`Failed to stage files: ${error.message}`);
    }
  }

  /**
   * Commit staged changes
   * @param {string} projectPath - Path to git repository
   * @param {string} message - Commit message
   */
  async commit(projectPath, message) {
    try {
      // Escape message for safe shell execution
      const escapedMessage = message.replace(/'/g, "'\\''");

      const { stdout } = await execAsync(
        `git commit -m '${escapedMessage}'`,
        { cwd: projectPath }
      );
      return stdout;
    } catch (error) {
      throw new Error(`Failed to commit: ${error.message}`);
    }
  }

  /**
   * Push branch to remote
   * @param {string} projectPath - Path to git repository
   * @param {string} branchName - Branch to push
   * @param {boolean} setUpstream - Set upstream tracking (default: true)
   */
  async push(projectPath, branchName, setUpstream = true) {
    try {
      const command = setUpstream
        ? `git push -u origin ${branchName}`
        : `git push origin ${branchName}`;

      const { stdout, stderr } = await execAsync(command, { cwd: projectPath });

      if (stderr && !stderr.includes('up-to-date')) {
        console.log(chalk.yellow(stderr));
      }

      return stdout;
    } catch (error) {
      throw new Error(`Failed to push ${branchName}: ${error.message}`);
    }
  }

  /**
   * Get current branch name
   * @param {string} projectPath - Path to git repository
   * @returns {Promise<string>} - Current branch name
   */
  async getCurrentBranch(projectPath) {
    try {
      const { stdout } = await execAsync(
        'git rev-parse --abbrev-ref HEAD',
        { cwd: projectPath }
      );
      return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error.message}`);
    }
  }

  /**
   * Check if repository has uncommitted changes
   * @param {string} projectPath - Path to git repository
   * @returns {Promise<boolean>} - True if there are uncommitted changes
   */
  async hasUncommittedChanges(projectPath) {
    try {
      const { stdout } = await execAsync(
        'git status --porcelain',
        { cwd: projectPath }
      );
      return stdout.trim().length > 0;
    } catch (error) {
      throw new Error(`Failed to check for uncommitted changes: ${error.message}`);
    }
  }

  /**
   * Get list of changed files
   * @param {string} projectPath - Path to git repository
   * @param {boolean} staged - Get staged files (default: false)
   * @returns {Promise<Array<string>>} - List of file paths
   */
  async getChangedFiles(projectPath, staged = false) {
    try {
      const command = staged
        ? 'git diff --staged --name-only'
        : 'git diff --name-only';

      const { stdout } = await execAsync(command, { cwd: projectPath });
      return stdout.trim().split('\n').filter(f => f.length > 0);
    } catch (error) {
      throw new Error(`Failed to get changed files: ${error.message}`);
    }
  }

  /**
   * Get commit log
   * @param {string} projectPath - Path to git repository
   * @param {Object} options - Log options
   * @param {number} options.limit - Number of commits to show
   * @param {string} options.format - Log format (default: oneline)
   * @returns {Promise<string>} - Git log output
   */
  async getLog(projectPath, options = {}) {
    try {
      let command = 'git log';

      if (options.limit) {
        command += ` -${options.limit}`;
      }

      if (options.format) {
        command += ` --format=${options.format}`;
      } else {
        command += ' --oneline';
      }

      const { stdout } = await execAsync(command, { cwd: projectPath });
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get git log: ${error.message}`);
    }
  }

  /**
   * Check if branch exists locally
   * @param {string} projectPath - Path to git repository
   * @param {string} branchName - Branch name to check
   * @returns {Promise<boolean>} - True if branch exists
   */
  async branchExists(projectPath, branchName) {
    try {
      const { stdout } = await execAsync(
        'git branch --list',
        { cwd: projectPath }
      );
      return stdout.includes(branchName);
    } catch (error) {
      throw new Error(`Failed to check if branch exists: ${error.message}`);
    }
  }

  /**
   * Detect merge conflicts with base branch
   * @param {string} projectPath - Path to git repository
   * @param {string} baseBranch - Base branch to check against (e.g., 'main')
   * @returns {Promise<Object>} - {hasConflicts: boolean, files: Array<string>}
   */
  async detectMergeConflicts(projectPath, baseBranch) {
    try {
      // Fetch latest from remote
      await execAsync('git fetch origin', { cwd: projectPath });

      // Try a dry-run merge
      const currentBranch = await this.getCurrentBranch(projectPath);

      try {
        await execAsync(
          `git merge --no-commit --no-ff origin/${baseBranch}`,
          { cwd: projectPath }
        );

        // No conflicts, abort the merge
        await execAsync('git merge --abort', { cwd: projectPath });

        return {
          hasConflicts: false,
          files: []
        };
      } catch (error) {
        // Merge failed, likely due to conflicts
        const { stdout } = await execAsync(
          'git diff --name-only --diff-filter=U',
          { cwd: projectPath }
        );

        // Abort the merge attempt
        await execAsync('git merge --abort', { cwd: projectPath });

        const conflictFiles = stdout.trim().split('\n').filter(f => f.length > 0);

        return {
          hasConflicts: conflictFiles.length > 0,
          files: conflictFiles
        };
      }
    } catch (error) {
      throw new Error(`Failed to detect merge conflicts: ${error.message}`);
    }
  }

  /**
   * Validate repository is clean and ready for new work
   * @param {string} projectPath - Path to git repository
   * @throws {Error} - If repository is not in a clean state
   */
  async validateCleanState(projectPath) {
    const hasChanges = await this.hasUncommittedChanges(projectPath);
    if (hasChanges) {
      throw new Error('Repository has uncommitted changes. Please commit or stash them first.');
    }
  }
}
