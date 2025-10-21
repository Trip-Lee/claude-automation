/**
 * SummaryGenerator - Generates detailed human-readable summaries
 *
 * Creates formatted summaries for task completion that are:
 * - Mobile-friendly (concise, clear formatting)
 * - Informative (all key details visible)
 * - Actionable (next steps clearly stated)
 */

import chalk from 'chalk';

export class SummaryGenerator {
  constructor() {
    // No initialization needed
  }

  /**
   * Create a task summary
   * @param {Object} data - Task completion data
   * @param {string} data.taskId - Unique task identifier
   * @param {string} data.description - Task description
   * @param {Object} data.result - Agent execution result
   * @param {Object} data.testResults - Test execution results
   * @param {Object} data.config - Project configuration
   * @param {string} data.branchName - Git branch name
   * @returns {string} - Formatted summary text
   */
  create({ taskId, description, result, testResults, config, branchName }) {
    const lines = [];

    // Header
    lines.push('═'.repeat(70));
    lines.push(chalk.bold.green(`TASK COMPLETE: ${this.truncate(description, 60)}`));
    lines.push('═'.repeat(70));
    lines.push('');

    // Overview section
    lines.push(chalk.cyan.bold('📊 OVERVIEW'));
    lines.push('─'.repeat(70));
    lines.push(`Task ID:         ${taskId}`);
    lines.push(`Project:         ${config.name}`);
    lines.push(`Branch:          ${branchName}`);
    lines.push(`Cost:            $${result.cost?.toFixed(4) || '0.0000'}`);
    if (result.duration) {
      lines.push(`Duration:        ${this.formatDuration(result.duration)}`);
    }
    lines.push('');

    // Changes section
    if (result.changes) {
      lines.push(chalk.cyan.bold('📝 CHANGES'));
      lines.push('─'.repeat(70));

      if (result.changes.files) {
        lines.push(`Files modified:  ${result.changes.files.length}`);
        result.changes.files.forEach(file => {
          lines.push(`  • ${file}`);
        });
        lines.push('');
      }

      if (result.changes.summary) {
        lines.push(result.changes.summary);
        lines.push('');
      } else {
        lines.push('Run `git diff` to see detailed changes');
        lines.push('');
      }
    }

    // Test results section
    lines.push(chalk.cyan.bold('🧪 TEST RESULTS'));
    lines.push('─'.repeat(70));
    if (testResults && testResults.passed !== undefined) {
      if (testResults.passed) {
        lines.push(chalk.green('✅ All tests passed'));
        if (testResults.count) {
          lines.push(`   ${testResults.count} test(s) ran successfully`);
        }
      } else {
        lines.push(chalk.red('❌ Tests failed'));
        if (testResults.output) {
          lines.push('');
          lines.push(this.indent(testResults.output, 3));
        }
      }
    } else {
      lines.push(chalk.yellow('⚠️  No tests configured'));
    }
    lines.push('');

    // Agent reasoning section (if available)
    if (result.plan || result.reasoning) {
      lines.push(chalk.cyan.bold('🤖 AGENT REASONING'));
      lines.push('─'.repeat(70));

      if (result.plan?.summary) {
        lines.push(result.plan.summary);
      } else if (result.reasoning) {
        lines.push(result.reasoning);
      } else {
        lines.push('Task executed successfully');
      }
      lines.push('');
    }

    // Code quality section (if available)
    if (result.quality) {
      lines.push(chalk.cyan.bold('✨ CODE QUALITY'));
      lines.push('─'.repeat(70));

      if (result.quality.linting !== undefined) {
        lines.push(`Linting:  ${result.quality.linting ? chalk.green('✅ Pass') : chalk.red('❌ Fail')}`);
      }
      if (result.quality.coverage !== undefined) {
        lines.push(`Coverage: ${result.quality.coverage}%`);
      }
      lines.push('');
    }

    // Next steps
    lines.push(chalk.cyan.bold('📋 NEXT STEPS'));
    lines.push('─'.repeat(70));
    lines.push(chalk.green('✅ To approve and create PR:'));
    lines.push(chalk.white(`   claude approve ${taskId}`));
    lines.push('');
    lines.push(chalk.red('❌ To reject and cleanup:'));
    lines.push(chalk.white(`   claude reject ${taskId}`));
    lines.push('');
    lines.push(chalk.blue('ℹ️  To view diff:'));
    lines.push(chalk.white(`   cd ${config.name} && git diff`));
    lines.push('');

    // Footer
    lines.push('═'.repeat(70));
    lines.push(chalk.gray(`Generated: ${new Date().toISOString()}`));
    lines.push('═'.repeat(70));

    return lines.join('\n');
  }

  /**
   * Create a minimal summary (for notifications, etc.)
   * @param {Object} data - Task data
   * @returns {string} - Brief summary
   */
  createMinimal({ taskId, description, success, cost }) {
    const status = success ? '✅ Complete' : '❌ Failed';
    return `${status}: ${this.truncate(description, 50)} (${taskId}, $${cost.toFixed(4)})`;
  }

  /**
   * Create an error summary
   * @param {Object} data - Error data
   * @returns {string} - Formatted error summary
   */
  createError({ taskId, description, error, stage }) {
    const lines = [];

    lines.push('═'.repeat(70));
    lines.push(chalk.bold.red(`TASK FAILED: ${this.truncate(description, 60)}`));
    lines.push('═'.repeat(70));
    lines.push('');

    lines.push(chalk.red.bold('❌ ERROR'));
    lines.push('─'.repeat(70));
    lines.push(`Task ID:  ${taskId}`);
    lines.push(`Stage:    ${stage || 'Unknown'}`);
    lines.push('');
    lines.push(chalk.red('Error Message:'));
    lines.push(this.indent(error.message, 2));
    lines.push('');

    if (error.stack) {
      lines.push(chalk.red('Stack Trace:'));
      lines.push(this.indent(error.stack, 2));
      lines.push('');
    }

    lines.push(chalk.cyan.bold('📋 NEXT STEPS'));
    lines.push('─'.repeat(70));
    lines.push('1. Review the error message above');
    lines.push('2. Check the task logs for more details');
    lines.push('3. Fix the issue and retry the task');
    lines.push('');

    lines.push('═'.repeat(70));

    return lines.join('\n');
  }

  /**
   * Create a PR description
   * @param {Object} data - Task data
   * @returns {string} - GitHub-flavored markdown for PR
   */
  createPRDescription({ description, result, testResults, taskId }) {
    const lines = [];

    lines.push('## Task');
    lines.push(description);
    lines.push('');

    if (result.plan?.summary || result.summary) {
      lines.push('## Summary');
      lines.push(result.plan?.summary || result.summary);
      lines.push('');
    }

    if (result.changes) {
      lines.push('## Changes');
      if (result.changes.files && result.changes.files.length > 0) {
        result.changes.files.forEach(file => {
          lines.push(`- ${file}`);
        });
      } else if (result.changes.summary) {
        lines.push(result.changes.summary);
      } else {
        lines.push('See files changed in this PR');
      }
      lines.push('');
    }

    lines.push('## Test Results');
    if (testResults && testResults.passed) {
      lines.push('✅ All tests passed');
    } else if (testResults && !testResults.passed) {
      lines.push('⚠️ Tests failed - review needed');
    } else {
      lines.push('ℹ️ No tests configured');
    }
    lines.push('');

    if (result.cost !== undefined) {
      lines.push('## Cost');
      lines.push(`$${result.cost.toFixed(4)}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('*Generated by Claude Multi-Agent System*');
    lines.push(`*Task ID: ${taskId}*`);

    return lines.join('\n');
  }

  /**
   * Truncate text to maximum length
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} - Truncated text
   */
  truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Indent text
   * @param {string} text - Text to indent
   * @param {number} spaces - Number of spaces
   * @returns {string} - Indented text
   */
  indent(text, spaces) {
    const prefix = ' '.repeat(spaces);
    return text.split('\n').map(line => prefix + line).join('\n');
  }

  /**
   * Format duration in human-readable format
   * @param {number} ms - Duration in milliseconds
   * @returns {string} - Formatted duration
   */
  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else if (ms < 3600000) {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    } else {
      const hours = Math.floor(ms / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Generate a status report
   * @param {Array} tasks - Array of task objects
   * @returns {string} - Status report
   */
  createStatusReport(tasks) {
    const lines = [];

    lines.push(chalk.cyan.bold('\n📊 Task Status Report\n'));
    lines.push('─'.repeat(70));

    if (tasks.length === 0) {
      lines.push('No tasks found');
      lines.push('');
      return lines.join('\n');
    }

    tasks.forEach(task => {
      const status = task.status === 'completed' ? chalk.green('✅') :
                     task.status === 'failed' ? chalk.red('❌') :
                     chalk.yellow('⏳');

      lines.push(`${status} ${task.taskId}`);
      lines.push(`   ${this.truncate(task.description, 60)}`);
      lines.push(`   Branch: ${task.branchName}, Cost: $${task.cost?.toFixed(4) || '0.0000'}`);
      lines.push('');
    });

    lines.push('─'.repeat(70));

    return lines.join('\n');
  }
}
