/**
 * BranchMerger - Merges multiple agent branches into a main branch
 *
 * Responsibilities:
 * - Merge all subtask branches into main branch sequentially
 * - Detect merge conflicts
 * - Provide detailed conflict information
 * - Handle cleanup of temporary branches
 */

import chalk from 'chalk';
import { execSync } from 'child_process';

export class BranchMerger {
  constructor(git, projectPath) {
    this.git = git;
    this.projectPath = projectPath;
  }

  /**
   * Merge all subtask branches into main branch
   * @param {string} mainBranch - Target branch to merge into
   * @param {Array} subtaskResults - Results from parallel execution
   * @returns {Object} Merge summary
   */
  async mergeAll(mainBranch, subtaskResults) {
    console.log(chalk.bold.cyan(`\n🔀 Merging Branches\n`));
    console.log(chalk.gray(`Target branch: ${mainBranch}`));
    console.log(chalk.gray(`Subtask branches: ${subtaskResults.length}\n`));

    const mergedBranches = [];
    const conflicts = [];

    for (const result of subtaskResults) {
      try {
        console.log(chalk.cyan(`Merging ${result.branch} → ${mainBranch}...`));

        // Attempt merge
        await this.mergeBranch(mainBranch, result.branch);

        mergedBranches.push({
          branch: result.branch,
          subtaskId: result.subtaskId,
          success: true
        });

        console.log(chalk.green(`  ✓ Merged successfully\n`));

      } catch (error) {
        if (error.isConflict) {
          // Merge conflict
          conflicts.push({
            branch: result.branch,
            subtaskId: result.subtaskId,
            files: error.files,
            message: error.message
          });

          console.log(chalk.red(`  ✗ Merge conflict detected\n`));
        } else {
          // Other error
          throw error;
        }
      }
    }

    // If we have conflicts, abort and report
    if (conflicts.length > 0) {
      throw new MergeConflictError(
        `Merge conflicts detected in ${conflicts.length} branch(es)`,
        conflicts
      );
    }

    console.log(chalk.green(`\n✓ All ${mergedBranches.length} branches merged successfully\n`));

    return {
      mergedCount: mergedBranches.length,
      merged: mergedBranches
    };
  }

  /**
   * Merge one branch into another
   * @param {string} targetBranch - Branch to merge into
   * @param {string} sourceBranch - Branch to merge from
   */
  async mergeBranch(targetBranch, sourceBranch) {
    try {
      // Checkout target branch
      await this.git.checkout(targetBranch);

      // Attempt merge
      const mergeCommand = `git merge --no-ff -m "Merge ${sourceBranch} into ${targetBranch}" ${sourceBranch}`;
      execSync(mergeCommand, {
        cwd: this.projectPath,
        stdio: 'pipe',
        encoding: 'utf8'
      });

    } catch (error) {
      // Check if this is a merge conflict
      if (error.message.includes('CONFLICT') || error.message.includes('Automatic merge failed')) {
        // Get list of conflicted files
        const conflictedFiles = this.getConflictedFiles();

        // Abort the merge
        try {
          execSync('git merge --abort', {
            cwd: this.projectPath,
            stdio: 'pipe'
          });
        } catch (abortError) {
          console.warn(chalk.yellow('Warning: Could not abort merge'));
        }

        // Throw conflict error
        const conflictError = new Error(`Merge conflict in files: ${conflictedFiles.join(', ')}`);
        conflictError.isConflict = true;
        conflictError.files = conflictedFiles;
        throw conflictError;
      }

      // Some other git error
      throw error;
    }
  }

  /**
   * Get list of files with merge conflicts
   * @returns {Array} List of conflicted file paths
   */
  getConflictedFiles() {
    try {
      const output = execSync('git diff --name-only --diff-filter=U', {
        cwd: this.projectPath,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      return output
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    } catch (error) {
      return [];
    }
  }

  /**
   * Clean up temporary branches after successful merge
   * @param {Array} branches - Array of branch names to delete
   */
  async cleanupBranches(branches) {
    console.log(chalk.gray('\nCleaning up temporary branches...'));

    for (const branch of branches) {
      try {
        await this.git.deleteBranch(branch);
        console.log(chalk.gray(`  Deleted ${branch}`));
      } catch (error) {
        console.warn(chalk.yellow(`  Warning: Could not delete ${branch}: ${error.message}`));
      }
    }
  }

  /**
   * Visualize merge conflicts for user
   * @param {Object} conflicts - Conflict information
   * @returns {string} Formatted conflict report
   */
  formatConflicts(conflicts) {
    let report = chalk.bold.red('\n⚠️  MERGE CONFLICTS DETECTED\n\n');

    report += chalk.gray(`${conflicts.length} branch(es) have conflicts that require manual resolution:\n\n`);

    for (const conflict of conflicts) {
      report += chalk.red(`Branch: ${conflict.branch}\n`);
      report += chalk.gray(`Subtask: ${conflict.subtaskId}\n`);
      report += chalk.yellow(`Conflicted files:\n`);

      for (const file of conflict.files) {
        report += chalk.yellow(`  - ${file}\n`);
      }

      report += '\n';
    }

    report += chalk.gray('To resolve:\n');
    report += chalk.gray('1. Manually merge the conflicted branches\n');
    report += chalk.gray('2. Run the task again with sequential execution\n');
    report += chalk.gray('3. Or split the task differently to avoid conflicts\n');

    return report;
  }
}

/**
 * Custom error for merge conflicts
 */
export class MergeConflictError extends Error {
  constructor(message, conflicts) {
    super(message);
    this.name = 'MergeConflictError';
    this.conflicts = conflicts;
    this.isConflict = true;
  }
}
