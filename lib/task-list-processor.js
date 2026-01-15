/**
 * TaskListProcessor - Process task lists from various file formats
 *
 * Supports:
 * - Plain text/markdown (numbered lists)
 * - JSON (ServiceNow compatible)
 * - XML (ServiceNow export format)
 */

import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { homedir } from 'os';
import { getGlobalConfig } from './global-config.js';

/**
 * @typedef {Object} NormalizedTask
 * @property {string} id - External ID or generated
 * @property {string} title - Short task title
 * @property {string} description - Full task description
 * @property {string} [priority] - Priority level
 * @property {string[]} [acceptanceCriteria] - Acceptance criteria list
 * @property {Object} [metadata] - Original source metadata
 */

/**
 * @typedef {Object} TaskResult
 * @property {string} taskId - Claude task ID
 * @property {string} externalId - Original ID from file
 * @property {string} branchName - Git branch created
 * @property {string} [prUrl] - Pull request URL
 * @property {string} status - 'completed' | 'failed' | 'skipped'
 * @property {number} cost - API cost
 * @property {number} duration - Execution time (ms)
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} BatchResult
 * @property {string} batchId - Unique batch identifier
 * @property {string} sourceFile - Original file path
 * @property {number} totalTasks - Total tasks in batch
 * @property {number} successful - Successfully completed
 * @property {number} failed - Failed tasks
 * @property {number} skipped - Skipped tasks
 * @property {TaskResult[]} results - Individual results
 * @property {number} totalCost - Aggregate API cost
 * @property {number} totalDuration - Total execution time (ms)
 */

export class TaskListProcessor {
  constructor(orchestrator, options = {}) {
    this.orchestrator = orchestrator;
    this.globalConfig = getGlobalConfig();
    this.options = {
      parallel: false,
      concurrency: 3,
      continueOnError: false,
      dryRun: false,
      ...options
    };

    // Inbox and completed folders (from global config)
    this.inboxDir = this.globalConfig.get('tasksInboxDir') ||
      path.join(homedir(), '.claude-tasks', 'tasks');
    this.completedDir = this.globalConfig.get('tasksCompletedDir') ||
      path.join(homedir(), '.claude-tasks', 'completed');
  }

  /**
   * Ensure inbox and completed directories exist
   */
  async ensureDirectories() {
    await fs.mkdir(this.inboxDir, { recursive: true });
    await fs.mkdir(this.completedDir, { recursive: true });
  }

  /**
   * Scan inbox folder for task files
   * @returns {Promise<Array<{path: string, name: string, mtime: Date}>>}
   */
  async scanInbox() {
    await this.ensureDirectories();

    try {
      const files = await fs.readdir(this.inboxDir);
      const taskFiles = [];

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (['.txt', '.md', '.json', '.xml'].includes(ext)) {
          const filePath = path.join(this.inboxDir, file);
          const stat = await fs.stat(filePath);
          taskFiles.push({
            path: filePath,
            name: file,
            mtime: stat.mtime
          });
        }
      }

      // Sort by modification time (oldest first)
      taskFiles.sort((a, b) => a.mtime - b.mtime);

      return taskFiles;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Detect file format from extension and content
   * @param {string} filePath - File path
   * @param {string} content - File content
   * @returns {string} Format: 'text' | 'json' | 'xml'
   */
  detectFormat(filePath, content) {
    const ext = path.extname(filePath).toLowerCase();

    // Check by extension first
    if (ext === '.json') return 'json';
    if (ext === '.xml') return 'xml';
    if (ext === '.md' || ext === '.txt') return 'text';

    // Content sniffing for ambiguous cases
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
    if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) return 'xml';

    return 'text';
  }

  /**
   * Parse a task file
   * @param {string} filePath - Path to task file
   * @returns {Promise<NormalizedTask[]>}
   */
  async parseFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const format = this.detectFormat(filePath, content);

    switch (format) {
      case 'json':
        return this.parseJson(content);
      case 'xml':
        return this.parseXml(content);
      case 'text':
      default:
        return this.parseText(content);
    }
  }

  /**
   * Parse numbered list format (text/markdown)
   * Format:
   *   1. Task title
   *      Description line 1
   *      Description line 2
   *
   *   2. Another task
   *      More description
   *
   * @param {string} content - File content
   * @returns {NormalizedTask[]}
   */
  parseText(content) {
    const tasks = [];
    const lines = content.split('\n');

    let currentTask = null;
    let descriptionLines = [];

    for (const line of lines) {
      // Match numbered task start: "1." or "1)" at start of line
      const taskMatch = line.match(/^(\d+)[.)]\s+(.+)/);

      if (taskMatch) {
        // Save previous task
        if (currentTask) {
          currentTask.description = this.cleanDescription(descriptionLines);
          if (currentTask.title || currentTask.description) {
            tasks.push(currentTask);
          }
        }

        // Start new task
        const taskNum = taskMatch[1];
        const title = taskMatch[2].trim();

        currentTask = {
          id: `task-${taskNum}`,
          title: title,
          description: ''
        };
        descriptionLines = [];
      } else if (currentTask) {
        // Accumulate description lines (strip leading whitespace for indented lines)
        descriptionLines.push(line);
      }
    }

    // Don't forget the last task
    if (currentTask) {
      currentTask.description = this.cleanDescription(descriptionLines);
      if (currentTask.title || currentTask.description) {
        tasks.push(currentTask);
      }
    }

    return tasks;
  }

  /**
   * Clean up description text
   * @param {string[]} lines - Description lines
   * @returns {string}
   */
  cleanDescription(lines) {
    // Remove leading/trailing empty lines
    while (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }

    // Find minimum indentation (excluding empty lines)
    let minIndent = Infinity;
    for (const line of lines) {
      if (line.trim() !== '') {
        const match = line.match(/^(\s*)/);
        if (match) {
          minIndent = Math.min(minIndent, match[1].length);
        }
      }
    }

    // Remove common indentation
    if (minIndent > 0 && minIndent < Infinity) {
      lines = lines.map(line => line.slice(minIndent));
    }

    return lines.join('\n').trim();
  }

  /**
   * Parse JSON format
   * Supports:
   *   { "tasks": [...] }
   *   [...]
   *
   * @param {string} content - File content
   * @returns {NormalizedTask[]}
   */
  parseJson(content) {
    const data = JSON.parse(content);

    // Handle array directly or nested under 'tasks'
    const taskArray = Array.isArray(data) ? data : (data.tasks || []);

    return taskArray.map((task, index) => {
      // Build description with acceptance criteria
      let description = task.description || task.short_description || '';

      if (task.acceptance_criteria) {
        const criteria = Array.isArray(task.acceptance_criteria)
          ? task.acceptance_criteria
          : [task.acceptance_criteria];

        if (criteria.length > 0) {
          description += '\n\nAcceptance Criteria:\n';
          description += criteria.map(c => `- ${c}`).join('\n');
        }
      }

      return {
        id: task.id || task.number || task.sys_id || `task-${index + 1}`,
        title: task.title || task.short_description || `Task ${index + 1}`,
        description: description.trim(),
        priority: task.priority,
        acceptanceCriteria: task.acceptance_criteria,
        metadata: {
          story_points: task.story_points,
          state: task.state,
          original: task
        }
      };
    });
  }

  /**
   * Parse XML format (ServiceNow export)
   * Supports: rm_story, incident, task, change_request elements
   *
   * @param {string} content - File content
   * @returns {NormalizedTask[]}
   */
  parseXml(content) {
    const tasks = [];

    // Match story/task elements with various ServiceNow types
    const elementTypes = ['rm_story', 'incident', 'task', 'change_request', 'sc_req_item'];
    const elementRegex = new RegExp(
      `<(${elementTypes.join('|')})>([\\s\\S]*?)</\\1>`,
      'g'
    );

    let match;
    while ((match = elementRegex.exec(content)) !== null) {
      const elementContent = match[2];

      // Extract fields using simple regex
      const extractField = (field) => {
        const fieldMatch = elementContent.match(
          new RegExp(`<${field}>([\\s\\S]*?)</${field}>`)
        );
        if (fieldMatch) {
          // Decode XML entities
          return fieldMatch[1]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .trim();
        }
        return '';
      };

      const number = extractField('number');
      const shortDesc = extractField('short_description');
      const description = extractField('description');
      const acceptanceCriteria = extractField('acceptance_criteria');
      const state = extractField('state');
      const sysId = extractField('sys_id');
      const priority = extractField('priority');

      // Skip closed/resolved items (state > 3 typically means closed in ServiceNow)
      if (state && parseInt(state) > 3) {
        continue;
      }

      // Build full description
      let fullDescription = description || shortDesc;
      if (acceptanceCriteria) {
        fullDescription += '\n\nAcceptance Criteria:\n' + acceptanceCriteria;
      }

      tasks.push({
        id: number || sysId || `task-${tasks.length + 1}`,
        title: shortDesc || `Task ${tasks.length + 1}`,
        description: fullDescription.trim(),
        priority: priority,
        metadata: {
          sys_id: sysId,
          state: state,
          type: match[1]
        }
      });
    }

    return tasks;
  }

  /**
   * Build full task description for orchestrator
   * @param {NormalizedTask} task - Normalized task
   * @returns {string}
   */
  buildTaskDescription(task) {
    let desc = task.title;

    if (task.description && task.description !== task.title) {
      desc += '\n\n' + task.description;
    }

    if (task.id && !task.id.startsWith('task-')) {
      desc = `[${task.id}] ${desc}`;
    }

    return desc;
  }

  /**
   * Process a single task file
   * @param {string} projectName - Target project
   * @param {string} filePath - Path to task file
   * @returns {Promise<BatchResult>}
   */
  async processFile(projectName, filePath) {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const startTime = Date.now();

    // Parse tasks
    const tasks = await this.parseFile(filePath);

    if (tasks.length === 0) {
      return {
        batchId,
        sourceFile: filePath,
        totalTasks: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        results: [],
        totalCost: 0,
        totalDuration: 0
      };
    }

    // Execute tasks
    let results;
    if (this.options.parallel) {
      results = await this.executeParallel(projectName, tasks);
    } else {
      results = await this.executeSequential(projectName, tasks);
    }

    // Aggregate results
    const successful = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0);

    return {
      batchId,
      sourceFile: filePath,
      totalTasks: tasks.length,
      successful,
      failed,
      skipped,
      results,
      totalCost,
      totalDuration: Date.now() - startTime
    };
  }

  /**
   * Execute tasks sequentially
   * @param {string} projectName - Target project
   * @param {NormalizedTask[]} tasks - Tasks to execute
   * @returns {Promise<TaskResult[]>}
   */
  async executeSequential(projectName, tasks) {
    const results = [];

    console.log(chalk.cyan(`\nProcessing ${tasks.length} tasks sequentially...\n`));

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      console.log(chalk.blue(`[${i + 1}/${tasks.length}] ${task.title}`));

      if (this.options.dryRun) {
        console.log(chalk.gray(`  (dry run - skipping execution)`));
        results.push({
          externalId: task.id,
          status: 'skipped',
          cost: 0,
          duration: 0
        });
        continue;
      }

      const taskStart = Date.now();

      try {
        const description = this.buildTaskDescription(task);
        const result = await this.orchestrator.executeTask(projectName, description);

        console.log(chalk.green(`  ✓ Branch: ${result.branchName}`));
        if (result.pr?.url) {
          console.log(chalk.cyan(`    PR: ${result.pr.url}`));
        }

        results.push({
          taskId: result.taskId,
          externalId: task.id,
          branchName: result.branchName,
          prUrl: result.pr?.url,
          status: 'completed',
          cost: result.cost || 0,
          duration: Date.now() - taskStart
        });

      } catch (error) {
        console.log(chalk.red(`  ✗ Failed: ${error.message}`));

        results.push({
          externalId: task.id,
          status: 'failed',
          error: error.message,
          cost: 0,
          duration: Date.now() - taskStart
        });

        if (!this.options.continueOnError) {
          console.log(chalk.yellow('\nStopping due to error.'));
          console.log(chalk.gray('Use --continue-on-error to continue after failures.\n'));

          // Mark remaining tasks as skipped
          for (let j = i + 1; j < tasks.length; j++) {
            results.push({
              externalId: tasks[j].id,
              status: 'skipped',
              cost: 0,
              duration: 0
            });
          }
          break;
        }
      }
    }

    return results;
  }

  /**
   * Execute tasks in parallel with concurrency limit
   * @param {string} projectName - Target project
   * @param {NormalizedTask[]} tasks - Tasks to execute
   * @returns {Promise<TaskResult[]>}
   */
  async executeParallel(projectName, tasks) {
    const concurrency = this.options.concurrency;
    const results = [];

    console.log(chalk.cyan(`\nProcessing ${tasks.length} tasks in parallel (concurrency: ${concurrency})...\n`));

    if (this.options.dryRun) {
      console.log(chalk.gray('(dry run - skipping execution)\n'));
      return tasks.map(task => ({
        externalId: task.id,
        status: 'skipped',
        cost: 0,
        duration: 0
      }));
    }

    // Process in chunks
    for (let i = 0; i < tasks.length; i += concurrency) {
      const chunk = tasks.slice(i, i + concurrency);
      const chunkNum = Math.floor(i / concurrency) + 1;
      const totalChunks = Math.ceil(tasks.length / concurrency);

      console.log(chalk.blue(`\nChunk ${chunkNum}/${totalChunks}:`));

      const chunkPromises = chunk.map(async (task, idx) => {
        const globalIdx = i + idx + 1;
        const taskStart = Date.now();

        try {
          console.log(chalk.gray(`  [${globalIdx}] Starting: ${task.title}`));

          const description = this.buildTaskDescription(task);
          const result = await this.orchestrator.executeTask(projectName, description);

          console.log(chalk.green(`  [${globalIdx}] ✓ ${task.id}`));

          return {
            taskId: result.taskId,
            externalId: task.id,
            branchName: result.branchName,
            prUrl: result.pr?.url,
            status: 'completed',
            cost: result.cost || 0,
            duration: Date.now() - taskStart
          };
        } catch (error) {
          console.log(chalk.red(`  [${globalIdx}] ✗ ${task.id}: ${error.message}`));

          return {
            externalId: task.id,
            status: 'failed',
            error: error.message,
            cost: 0,
            duration: Date.now() - taskStart
          };
        }
      });

      const chunkResults = await Promise.allSettled(chunkPromises);
      results.push(...chunkResults.map(r => {
        if (r.status === 'fulfilled') {
          return r.value;
        }
        // Handle unexpected rejection (should not happen due to try-catch)
        return {
          externalId: 'unknown',
          status: 'failed',
          error: r.reason?.message || String(r.reason),
          cost: 0,
          duration: 0
        };
      }));

      // Check for early exit
      if (!this.options.continueOnError) {
        const failed = results.filter(r => r.status === 'failed');
        if (failed.length > 0) {
          console.log(chalk.yellow('\nStopping batch due to error.'));

          // Mark remaining tasks as skipped
          const remaining = tasks.slice(i + concurrency);
          for (const task of remaining) {
            results.push({
              externalId: task.id,
              status: 'skipped',
              cost: 0,
              duration: 0
            });
          }
          break;
        }
      }
    }

    return results;
  }

  /**
   * Move processed file to completed folder
   * @param {string} filePath - Source file path
   */
  async moveToCompleted(filePath) {
    await this.ensureDirectories();

    const fileName = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const destName = `${timestamp}_${fileName}`;
    const destPath = path.join(this.completedDir, destName);

    await fs.rename(filePath, destPath);

    return destPath;
  }

  /**
   * Generate summary report
   * @param {BatchResult} result - Batch execution result
   * @returns {string}
   */
  generateSummary(result) {
    const lines = [];

    lines.push('');
    lines.push(chalk.cyan.bold('═'.repeat(60)));
    lines.push(chalk.cyan.bold('  BATCH EXECUTION SUMMARY'));
    lines.push(chalk.cyan.bold('═'.repeat(60)));
    lines.push('');

    lines.push(chalk.white(`  Batch ID:      ${result.batchId}`));
    lines.push(chalk.white(`  Source:        ${path.basename(result.sourceFile)}`));
    lines.push(chalk.white(`  Total Tasks:   ${result.totalTasks}`));
    lines.push(chalk.green(`  Completed:     ${result.successful}`));
    if (result.failed > 0) {
      lines.push(chalk.red(`  Failed:        ${result.failed}`));
    }
    if (result.skipped > 0) {
      lines.push(chalk.yellow(`  Skipped:       ${result.skipped}`));
    }
    lines.push('');

    lines.push(chalk.gray(`  Total Cost:    $${result.totalCost.toFixed(4)}`));
    lines.push(chalk.gray(`  Duration:      ${this.formatDuration(result.totalDuration)}`));
    lines.push('');

    // List branches created
    const branches = result.results.filter(r => r.branchName);
    if (branches.length > 0) {
      lines.push(chalk.blue('  Branches Created:'));
      for (const r of branches) {
        lines.push(chalk.gray(`    • ${r.branchName}`));
      }
      lines.push('');
    }

    // List PRs created
    const prs = result.results.filter(r => r.prUrl);
    if (prs.length > 0) {
      lines.push(chalk.blue('  Pull Requests:'));
      for (const r of prs) {
        lines.push(chalk.cyan(`    • ${r.prUrl}`));
      }
      lines.push('');
    }

    // List failures
    const failures = result.results.filter(r => r.status === 'failed');
    if (failures.length > 0) {
      lines.push(chalk.red('  Failed Tasks:'));
      for (const r of failures) {
        lines.push(chalk.red(`    • ${r.externalId}: ${r.error}`));
      }
      lines.push('');
    }

    lines.push(chalk.cyan.bold('═'.repeat(60)));

    return lines.join('\n');
  }

  /**
   * Format duration in human-readable form
   * @param {number} ms - Duration in milliseconds
   * @returns {string}
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
}
