#!/usr/bin/env node

/**
 * Integration Tests for Background Task Lifecycle
 * Tests background task spawning, monitoring, and state management
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { TaskStateManager } from '../../lib/task-state-manager.js';
import { promises as fs } from 'fs';
import path from 'path';
import { homedir } from 'os';

describe('Background Task Lifecycle - State Persistence', () => {
  let stateManager;
  let testTaskId;

  before(() => {
    stateManager = new TaskStateManager();
    testTaskId = `bg-test-${Date.now()}`;
  });

  it('should save initial background task state', async () => {
    const initialState = {
      taskId: testTaskId,
      project: 'test-project',
      description: 'Background test task',
      status: 'running',
      pid: process.pid,
      startedAt: new Date().toISOString(),
      currentAgent: 'architect',
      completedAgents: [],
      progress: { percent: 0, eta: 180 }
    };

    await stateManager.saveTaskState(testTaskId, initialState);

    const loaded = await stateManager.loadTaskState(testTaskId);
    assert.ok(loaded);
    assert.equal(loaded.taskId, testTaskId);
    assert.equal(loaded.status, 'running');
    assert.equal(loaded.pid, process.pid);
  });

  it('should update task state during execution', async () => {
    await stateManager.updateTaskState(testTaskId, {
      currentAgent: 'coder',
      completedAgents: ['architect'],
      progress: { percent: 45, eta: 90 }
    });

    const loaded = await stateManager.loadTaskState(testTaskId);
    assert.equal(loaded.currentAgent, 'coder');
    assert.ok(loaded.completedAgents.includes('architect'));
    assert.equal(loaded.progress.percent, 45);
  });

  it('should update task to completed state', async () => {
    await stateManager.updateTaskState(testTaskId, {
      status: 'completed',
      currentAgent: 'reviewer',
      completedAgents: ['architect', 'coder', 'reviewer'],
      completedAt: new Date().toISOString(),
      progress: { percent: 100, eta: 0 },
      result: {
        branchName: 'claude/test-123',
        changes: ['file1.js', 'file2.js'],
        cost: 0.15
      }
    });

    const loaded = await stateManager.loadTaskState(testTaskId);
    assert.equal(loaded.status, 'completed');
    assert.ok(loaded.completedAt);
    assert.ok(loaded.result);
    assert.equal(loaded.result.cost, 0.15);

    // Cleanup
    await stateManager.deleteTaskState(testTaskId);
  });
});

describe('Background Task Lifecycle - Process Tracking', () => {
  let stateManager;

  before(() => {
    stateManager = new TaskStateManager();
  });

  it('should detect running processes', () => {
    const isRunning = stateManager.isProcessRunning(process.pid);
    assert.equal(isRunning, true);
  });

  it('should detect dead processes', () => {
    const isRunning = stateManager.isProcessRunning(999999);
    assert.equal(isRunning, false);
  });

  it('should sync task states and mark dead processes', async () => {
    const deadTaskId = `dead-task-${Date.now()}`;

    await stateManager.saveTaskState(deadTaskId, {
      taskId: deadTaskId,
      status: 'running',
      pid: 999999, // Non-existent process
      project: 'test',
      startedAt: new Date().toISOString()
    });

    await stateManager.syncTaskStates();

    const updated = await stateManager.loadTaskState(deadTaskId);
    assert.equal(updated.status, 'interrupted');
    assert.ok(updated.error);
    assert.ok(updated.completedAt);

    // Cleanup
    await stateManager.deleteTaskState(deadTaskId);
  });
});

describe('Background Task Lifecycle - Task Queries', () => {
  let stateManager;
  let runningTaskId;
  let completedTaskId;

  before(async () => {
    stateManager = new TaskStateManager();

    runningTaskId = `running-${Date.now()}`;
    completedTaskId = `completed-${Date.now()}`;

    await stateManager.saveTaskState(runningTaskId, {
      taskId: runningTaskId,
      status: 'running',
      pid: process.pid,
      project: 'test-project',
      startedAt: new Date().toISOString()
    });

    await stateManager.saveTaskState(completedTaskId, {
      taskId: completedTaskId,
      status: 'completed',
      project: 'test-project',
      startedAt: new Date(Date.now() - 60000).toISOString(),
      completedAt: new Date().toISOString()
    });
  });

  it('should get running tasks only', async () => {
    const runningTasks = await stateManager.getRunningTasks();

    const ourTask = runningTasks.find(t => t.taskId === runningTaskId);
    assert.ok(ourTask, 'Should find our running task');
    assert.ok(runningTasks.every(t => t.status === 'running'));
  });

  it('should get tasks by project', async () => {
    const projectTasks = await stateManager.getProjectTasks('test-project');

    const running = projectTasks.find(t => t.taskId === runningTaskId);
    const completed = projectTasks.find(t => t.taskId === completedTaskId);

    assert.ok(running);
    assert.ok(completed);
    assert.ok(projectTasks.every(t => t.project === 'test-project'));
  });

  it('should cleanup test tasks', async () => {
    await stateManager.deleteTaskState(runningTaskId);
    await stateManager.deleteTaskState(completedTaskId);

    const running = await stateManager.loadTaskState(runningTaskId);
    const completed = await stateManager.loadTaskState(completedTaskId);

    assert.equal(running, null);
    assert.equal(completed, null);
  });
});

describe('Background Task Lifecycle - Progress Tracking', () => {
  let stateManager;

  before(() => {
    stateManager = new TaskStateManager();
  });

  it('should calculate progress from agent stages', () => {
    const stages = [
      { currentAgent: 'architect', completedAgents: [], expected: 10 },
      { currentAgent: 'coder', completedAgents: ['architect'], expected: 45 },
      { currentAgent: 'reviewer', completedAgents: ['architect', 'coder'], expected: 80 }
    ];

    for (const stage of stages) {
      const progress = stateManager.calculateProgress(
        stage.currentAgent,
        stage.completedAgents
      );
      assert.equal(progress, stage.expected);
    }
  });

  it('should estimate ETA based on remaining stages', () => {
    const eta1 = stateManager.estimateETA('architect', []);
    const eta2 = stateManager.estimateETA('coder', ['architect']);
    const eta3 = stateManager.estimateETA('reviewer', ['architect', 'coder']);

    assert.ok(eta1 > eta2, 'ETA should decrease as work progresses');
    assert.ok(eta2 > eta3, 'ETA should decrease as work progresses');
  });

  it('should format task summary with progress', () => {
    const task = {
      taskId: 'test-123',
      project: 'my-project',
      status: 'running',
      currentAgent: 'coder',
      progress: { percent: 45, eta: 120 },
      startedAt: new Date(Date.now() - 60000).toISOString()
    };

    const summary = stateManager.formatTaskSummary(task);

    assert.equal(summary.id, 'test-123');
    assert.equal(summary.status, 'running');
    assert.equal(summary.progress, 45);
    assert.equal(summary.eta, 120);
    assert.ok(summary.duration >= 60);
  });
});

describe('Background Task Lifecycle - Error States', () => {
  let stateManager;

  before(() => {
    stateManager = new TaskStateManager();
  });

  it('should handle failed task state', async () => {
    const failedTaskId = `failed-${Date.now()}`;

    await stateManager.saveTaskState(failedTaskId, {
      taskId: failedTaskId,
      status: 'failed',
      project: 'test',
      startedAt: new Date(Date.now() - 120000).toISOString(),
      completedAt: new Date().toISOString(),
      error: {
        message: 'Docker container failed',
        stack: 'Error: Docker container failed\n  at ...'
      }
    });

    const loaded = await stateManager.loadTaskState(failedTaskId);
    assert.equal(loaded.status, 'failed');
    assert.ok(loaded.error);
    assert.ok(loaded.error.message.includes('Docker'));

    await stateManager.deleteTaskState(failedTaskId);
  });

  it('should handle cancelled task state', async () => {
    const cancelledTaskId = `cancelled-${Date.now()}`;

    await stateManager.saveTaskState(cancelledTaskId, {
      taskId: cancelledTaskId,
      status: 'cancelled',
      project: 'test',
      startedAt: new Date(Date.now() - 30000).toISOString(),
      completedAt: new Date().toISOString()
    });

    const loaded = await stateManager.loadTaskState(cancelledTaskId);
    assert.equal(loaded.status, 'cancelled');

    await stateManager.deleteTaskState(cancelledTaskId);
  });
});

describe('Background Task Lifecycle - Log File Tracking', () => {
  let stateManager;

  before(() => {
    stateManager = new TaskStateManager();
  });

  it('should include log file path in task state', async () => {
    const taskId = `log-test-${Date.now()}`;
    const logFile = path.join(homedir(), '.claude-logs', `${taskId}.log`);

    await stateManager.saveTaskState(taskId, {
      taskId,
      status: 'running',
      project: 'test',
      startedAt: new Date().toISOString(),
      logFile
    });

    const loaded = await stateManager.loadTaskState(taskId);
    assert.ok(loaded.logFile);
    assert.ok(loaded.logFile.includes(taskId));

    await stateManager.deleteTaskState(taskId);
  });
});

describe('Background Task Lifecycle - Subtask Management', () => {
  let stateManager;
  let parentTaskId;

  before(() => {
    stateManager = new TaskStateManager();
    parentTaskId = `parent-${Date.now()}`;
  });

  it('should save subtask state', async () => {
    const subtaskId = 'subtask-1';

    await stateManager.saveSubtaskState(parentTaskId, subtaskId, {
      subtaskId,
      taskId: parentTaskId,
      status: 'running',
      role: 'coder',
      description: 'Implement feature X',
      startedAt: new Date().toISOString()
    });

    const loaded = await stateManager.loadSubtaskState(parentTaskId, subtaskId);
    assert.ok(loaded);
    assert.equal(loaded.subtaskId, subtaskId);
    assert.equal(loaded.role, 'coder');
  });

  it('should get all subtasks for parent task', async () => {
    const subtask2Id = 'subtask-2';
    const subtask3Id = 'subtask-3';

    await stateManager.saveSubtaskState(parentTaskId, subtask2Id, {
      subtaskId: subtask2Id,
      status: 'completed',
      startedAt: new Date(Date.now() - 1000).toISOString()
    });

    await stateManager.saveSubtaskState(parentTaskId, subtask3Id, {
      subtaskId: subtask3Id,
      status: 'pending',
      startedAt: new Date().toISOString()
    });

    const subtasks = await stateManager.getSubtasks(parentTaskId);
    assert.ok(Array.isArray(subtasks));
    assert.ok(subtasks.length >= 3);

    // Cleanup
    await stateManager.deleteTaskState(parentTaskId);
  });
});

console.log('\n✅ Background task lifecycle integration tests completed\n');
