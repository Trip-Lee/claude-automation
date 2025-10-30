/**
 * ParallelAgentManager - Coordinates execution of multiple agents simultaneously
 *
 * Responsibilities:
 * - Spawn multiple agents in parallel
 * - Track progress from all agents
 * - Handle agent failures gracefully
 * - Aggregate results
 * - Clean up resources
 */

import chalk from 'chalk';
import { TaskStateManager } from './task-state-manager.js';

export class ParallelAgentManager {
  constructor(orchestrator, taskId) {
    this.orchestrator = orchestrator;
    this.taskId = taskId;
    this.activeSubtasks = new Map();
    this.stateManager = new TaskStateManager();
    this.progressInterval = null;
  }

  /**
   * Execute multiple agents in parallel
   * @param {string} mainBranch - Main task branch name
   * @param {string} project - Project name
   * @param {Array} parts - Array of task parts from decomposer
   * @returns {Object} Aggregated results
   */
  async executeParallel(mainBranch, project, parts) {
    console.log(chalk.bold.cyan(`\n⚡ Parallel Execution Mode\n`));
    console.log(chalk.gray(`Spawning ${parts.length} agents in parallel...\n`));

    const startTime = Date.now();

    try {
      // Start progress monitoring
      this.startProgressMonitoring();

      // Spawn all subtasks in parallel
      const subtaskPromises = parts.map((part, index) =>
        this.executeSubtask(mainBranch, project, part, index)
      );

      // Wait for all subtasks to complete
      const results = await Promise.allSettled(subtaskPromises);

      // Stop progress monitoring
      this.stopProgressMonitoring();

      // Analyze results
      const { successful, failed } = this.analyzeResults(results);

      // Calculate totals
      const totalCost = successful.reduce((sum, r) => sum + (r.cost || 0), 0);
      const totalDuration = Math.max(...successful.map(r => r.duration || 0), 0);

      // Report summary
      console.log(chalk.bold.cyan('\n\n📊 Parallel Execution Summary\n'));
      console.log(chalk.green(`  ✓ Successful: ${successful.length}/${parts.length}`));

      if (failed.length > 0) {
        console.log(chalk.red(`  ✗ Failed: ${failed.length}/${parts.length}`));
        for (const failure of failed) {
          console.log(chalk.red(`    - ${failure.subtaskId}: ${failure.error}`));
        }
      }

      console.log(chalk.gray(`  Total Cost: $${totalCost.toFixed(4)}`));
      console.log(chalk.gray(`  Total Duration: ${totalDuration}s\n`));

      // If any failed, throw error
      if (failed.length > 0) {
        throw new ParallelExecutionError(
          `${failed.length} of ${parts.length} parallel tasks failed`,
          failed
        );
      }

      return {
        mainBranch,
        results: successful,
        totalCost,
        totalDuration,
        parallelParts: parts.length
      };

    } finally {
      this.stopProgressMonitoring();
    }
  }

  /**
   * Execute a single subtask
   * @param {string} baseBranch - Base branch to create subtask branch from
   * @param {string} project - Project name
   * @param {Object} part - Task part specification
   * @param {number} index - Part index
   * @returns {Object} Subtask result
   */
  async executeSubtask(baseBranch, project, part, index) {
    const subtaskId = `${this.taskId}-part${index + 1}`;
    const branchName = `task-${subtaskId}`;

    console.log(chalk.cyan(`\n[${subtaskId}] Starting ${part.role} agent`));
    console.log(chalk.gray(`  Branch: ${branchName}`));
    console.log(chalk.gray(`  Task: ${part.description}`));

    const startTime = Date.now();
    let container = null;

    try {
      // Initialize subtask state
      this.activeSubtasks.set(subtaskId, {
        id: subtaskId,
        branch: branchName,
        role: part.role,
        description: part.description,
        status: 'initializing',
        progress: 0,
        startTime
      });

      // Save subtask state to disk
      await this.stateManager.saveSubtaskState(this.taskId, subtaskId, {
        subtaskId,
        taskId: this.taskId,
        branch: branchName,
        role: part.role,
        description: part.description,
        status: 'running',
        startedAt: new Date().toISOString()
      });

      // Create subtask branch from main branch
      console.log(chalk.gray(`[${subtaskId}]   Creating branch from ${baseBranch}...`));
      await this.orchestrator.git.createBranch(branchName, baseBranch);

      this.updateSubtaskState(subtaskId, { status: 'spawning_container', progress: 10 });

      // Spawn Docker container
      console.log(chalk.gray(`[${subtaskId}]   Spawning Docker container...`));
      container = await this.orchestrator.dockerManager.create({
        name: `claude-${subtaskId}`,
        memory: '4g',
        cpus: 2
      });

      await this.orchestrator.dockerManager.start(container);

      this.updateSubtaskState(subtaskId, {
        status: 'executing',
        progress: 20,
        containerId: container.id
      });

      // Create agent for this role
      console.log(chalk.gray(`[${subtaskId}]   Executing ${part.role} agent...`));
      const agent = this.orchestrator.createAgent(part.role);

      // Execute agent
      const result = await agent.execute({
        container,
        branch: branchName,
        task: part.description,
        files: part.files
      });

      const duration = (Date.now() - startTime) / 1000;

      // Update final state
      this.updateSubtaskState(subtaskId, {
        status: 'completed',
        progress: 100
      });

      await this.stateManager.saveSubtaskState(this.taskId, subtaskId, {
        subtaskId,
        taskId: this.taskId,
        branch: branchName,
        role: part.role,
        description: part.description,
        status: 'completed',
        completedAt: new Date().toISOString(),
        cost: result.cost || 0,
        duration
      });

      console.log(chalk.green(`[${subtaskId}] ✓ Completed in ${duration.toFixed(1)}s`));

      return {
        subtaskId,
        branch: branchName,
        role: part.role,
        success: true,
        cost: result.cost || 0,
        duration,
        result
      };

    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;

      // Update error state
      this.updateSubtaskState(subtaskId, {
        status: 'failed',
        error: error.message
      });

      await this.stateManager.saveSubtaskState(this.taskId, subtaskId, {
        subtaskId,
        taskId: this.taskId,
        branch: branchName,
        role: part.role,
        description: part.description,
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: error.message,
        duration
      });

      console.log(chalk.red(`[${subtaskId}] ✗ Failed: ${error.message}`));

      throw error;

    } finally {
      // Cleanup container
      if (container) {
        try {
          console.log(chalk.gray(`[${subtaskId}]   Cleaning up container...`));
          await this.orchestrator.dockerManager.stop(container);
          await this.orchestrator.dockerManager.remove(container);
        } catch (cleanupError) {
          console.warn(chalk.yellow(`[${subtaskId}]   Container cleanup warning: ${cleanupError.message}`));
        }
      }
    }
  }

  /**
   * Update subtask state in memory
   * @param {string} subtaskId - Subtask ID
   * @param {Object} updates - State updates
   */
  updateSubtaskState(subtaskId, updates) {
    const current = this.activeSubtasks.get(subtaskId) || {};
    this.activeSubtasks.set(subtaskId, {
      ...current,
      ...updates,
      updatedAt: Date.now()
    });
  }

  /**
   * Start monitoring progress of all subtasks
   */
  startProgressMonitoring() {
    // Report progress every 10 seconds
    this.progressInterval = setInterval(() => {
      this.reportProgress();
    }, 10000);
  }

  /**
   * Stop monitoring progress
   */
  stopProgressMonitoring() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Report current progress of all subtasks
   */
  reportProgress() {
    if (this.activeSubtasks.size === 0) {
      return;
    }

    console.log(chalk.bold.cyan('\n📊 Progress Update\n'));

    for (const [id, subtask] of this.activeSubtasks) {
      const elapsed = ((Date.now() - subtask.startTime) / 1000).toFixed(0);

      let statusIcon = '⏳';
      let statusColor = chalk.yellow;

      if (subtask.status === 'completed') {
        statusIcon = '✓';
        statusColor = chalk.green;
      } else if (subtask.status === 'failed') {
        statusIcon = '✗';
        statusColor = chalk.red;
      }

      console.log(
        statusColor(`  ${statusIcon} ${id}: ${subtask.status} (${subtask.progress}%) - ${elapsed}s`)
      );
    }

    console.log();
  }

  /**
   * Analyze Promise.allSettled results
   * @param {Array} results - Results from Promise.allSettled
   * @returns {Object} Categorized results
   */
  analyzeResults(results) {
    const successful = [];
    const failed = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        // Extract subtaskId from error if available
        const subtaskId = result.reason?.subtaskId || 'unknown';
        failed.push({
          subtaskId,
          error: result.reason?.message || String(result.reason)
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Get current state of all subtasks
   * @returns {Array} Array of subtask states
   */
  getSubtaskStates() {
    return Array.from(this.activeSubtasks.values());
  }

  /**
   * Cancel all running subtasks
   */
  async cancelAll() {
    console.log(chalk.yellow('\nCanceling all parallel subtasks...'));

    for (const [id, subtask] of this.activeSubtasks) {
      if (subtask.status !== 'completed' && subtask.status !== 'failed') {
        console.log(chalk.gray(`  Canceling ${id}...`));

        // Update state
        this.updateSubtaskState(id, { status: 'cancelled' });

        // Cleanup container if exists
        if (subtask.containerId) {
          try {
            const container = { id: subtask.containerId };
            await this.orchestrator.dockerManager.stop(container);
            await this.orchestrator.dockerManager.remove(container);
          } catch (error) {
            console.warn(chalk.yellow(`    Warning: ${error.message}`));
          }
        }
      }
    }
  }
}

/**
 * Custom error for parallel execution failures
 */
export class ParallelExecutionError extends Error {
  constructor(message, failures) {
    super(message);
    this.name = 'ParallelExecutionError';
    this.failures = failures;
  }
}
