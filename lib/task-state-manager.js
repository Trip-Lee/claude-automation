/**
 * TaskStateManager - Manages task state persistence for background execution
 * 
 * Handles:
 * - Task state files in ~/.claude-tasks/
 * - Reading/writing task metadata
 * - Querying running/completed tasks
 * - Cleanup of old task data
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getGlobalConfig } from './global-config.js';

export class TaskStateManager {
  constructor() {
    this.globalConfig = getGlobalConfig();
    this.tasksDir = this.globalConfig.get('tasksDir');
  }

  /**
   * Save task state to disk
   */
  async saveTaskState(taskId, state) {
    const taskDir = path.join(this.tasksDir, taskId);
    await fs.mkdir(taskDir, { recursive: true });
    
    const statePath = path.join(taskDir, 'state.json');
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }

  /**
   * Load task state from disk
   */
  async loadTaskState(taskId) {
    try {
      const statePath = path.join(this.tasksDir, taskId, 'state.json');
      const data = await fs.readFile(statePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Update task state (partial update)
   */
  async updateTaskState(taskId, updates) {
    const currentState = await this.loadTaskState(taskId) || {};
    const newState = {
      ...currentState,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await this.saveTaskState(taskId, newState);
  }

  /**
   * Get all tasks
   */
  async getAllTasks() {
    try {
      const entries = await fs.readdir(this.tasksDir, { withFileTypes: true });
      const tasks = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const state = await this.loadTaskState(entry.name);
          if (state) {
            tasks.push(state);
          }
        }
      }

      return tasks.sort((a, b) => 
        new Date(b.startedAt) - new Date(a.startedAt)
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Get running tasks only
   */
  async getRunningTasks() {
    const allTasks = await this.getAllTasks();
    return allTasks.filter(task => task.status === 'running');
  }

  /**
   * Get tasks for a specific project
   */
  async getProjectTasks(projectName) {
    const allTasks = await this.getAllTasks();
    return allTasks.filter(task => task.project === projectName);
  }

  /**
   * Check if process is still running
   */
  isProcessRunning(pid) {
    try {
      // Sending signal 0 checks if process exists without killing it
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sync task states with actual process status
   * Marks tasks as 'interrupted' if process died
   */
  async syncTaskStates() {
    const runningTasks = await this.getRunningTasks();
    
    for (const task of runningTasks) {
      if (task.pid && !this.isProcessRunning(task.pid)) {
        await this.updateTaskState(task.taskId, {
          status: 'interrupted',
          error: 'Process died (system reboot or crash)',
          completedAt: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Delete task state
   */
  async deleteTaskState(taskId) {
    const taskDir = path.join(this.tasksDir, taskId);
    await fs.rm(taskDir, { recursive: true, force: true });
  }

  /**
   * Clean up old completed tasks (older than 7 days)
   */
  async cleanupOldTasks(daysToKeep = 7) {
    const allTasks = await this.getAllTasks();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let deletedCount = 0;

    for (const task of allTasks) {
      if (task.status !== 'running') {
        const completedAt = new Date(task.completedAt || task.startedAt);
        if (completedAt < cutoffDate) {
          await this.deleteTaskState(task.taskId);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  }

  /**
   * Generate task summary for display
   */
  formatTaskSummary(task) {
    const duration = task.completedAt 
      ? Math.round((new Date(task.completedAt) - new Date(task.startedAt)) / 1000)
      : Math.round((Date.now() - new Date(task.startedAt)) / 1000);

    return {
      id: task.taskId,
      project: task.project,
      status: task.status,
      stage: task.currentAgent || '-',
      progress: task.progress?.percent || 0,
      eta: task.progress?.eta || '-',
      duration,
      started: task.startedAt
    };
  }

  /**
   * Calculate progress percentage based on current stage
   */
  calculateProgress(currentAgent, completedAgents = []) {
    const stageWeights = {
      architect: 20,
      coder: 50,
      reviewer: 20,
      tester: 10
    };

    let totalProgress = 0;
    
    // Add completed stages
    for (const agent of completedAgents) {
      totalProgress += stageWeights[agent] || 0;
    }

    // Add partial progress for current stage (assume halfway)
    if (currentAgent && !completedAgents.includes(currentAgent)) {
      totalProgress += (stageWeights[currentAgent] || 0) / 2;
    }

    return Math.min(totalProgress, 100);
  }

  /**
   * Estimate time remaining based on historical data
   */
  estimateETA(currentAgent, completedAgents = []) {
    // Historical averages (in seconds)
    const averageDurations = {
      architect: 30,
      coder: 100,
      reviewer: 20,
      tester: 30,
      security: 25
    };

    let remainingTime = 0;

    // Add time for current stage (assume halfway done)
    if (currentAgent) {
      remainingTime += (averageDurations[currentAgent] || 30) / 2;
    }

    // Add time for remaining stages (simple estimate)
    const allStages = ['architect', 'coder', 'reviewer'];
    const remainingStages = allStages.filter(
      stage => !completedAgents.includes(stage) && stage !== currentAgent
    );

    for (const stage of remainingStages) {
      remainingTime += averageDurations[stage] || 30;
    }

    return Math.round(remainingTime);
  }

  /**
   * Save subtask state to disk
   * @param {string} taskId - Parent task ID
   * @param {string} subtaskId - Subtask ID
   * @param {Object} state - Subtask state
   */
  async saveSubtaskState(taskId, subtaskId, state) {
    const subtasksDir = path.join(this.tasksDir, taskId, 'subtasks');
    await fs.mkdir(subtasksDir, { recursive: true });

    const subtaskPath = path.join(subtasksDir, `${subtaskId}.json`);
    await fs.writeFile(subtaskPath, JSON.stringify(state, null, 2));
  }

  /**
   * Load subtask state from disk
   * @param {string} taskId - Parent task ID
   * @param {string} subtaskId - Subtask ID
   * @returns {Object|null} Subtask state or null if not found
   */
  async loadSubtaskState(taskId, subtaskId) {
    try {
      const subtaskPath = path.join(this.tasksDir, taskId, 'subtasks', `${subtaskId}.json`);
      const data = await fs.readFile(subtaskPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all subtasks for a task
   * @param {string} taskId - Parent task ID
   * @returns {Array} Array of subtask states
   */
  async getSubtasks(taskId) {
    try {
      const subtasksDir = path.join(this.tasksDir, taskId, 'subtasks');
      const files = await fs.readdir(subtasksDir);

      const subtasks = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(
            path.join(subtasksDir, file),
            'utf8'
          );
          subtasks.push(JSON.parse(data));
        }
      }

      return subtasks.sort((a, b) =>
        new Date(a.startedAt) - new Date(b.startedAt)
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Format parallel task summary
   * @param {Object} task - Task state
   * @param {Array} subtasks - Array of subtask states
   * @returns {Object} Formatted summary
   */
  formatParallelTaskSummary(task, subtasks) {
    const completedSubtasks = subtasks.filter(s => s.status === 'completed').length;
    const failedSubtasks = subtasks.filter(s => s.status === 'failed').length;
    const runningSubtasks = subtasks.filter(s => s.status === 'running').length;

    return {
      ...this.formatTaskSummary(task),
      parallel: true,
      subtasks: {
        total: subtasks.length,
        completed: completedSubtasks,
        failed: failedSubtasks,
        running: runningSubtasks,
        progress: subtasks.length > 0
          ? Math.round((completedSubtasks / subtasks.length) * 100)
          : 0
      }
    };
  }
}
