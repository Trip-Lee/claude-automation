#!/usr/bin/env node

/**
 * Unit Tests for TaskStateManager
 * Tests state persistence, querying, and lifecycle management
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TaskStateManager } from '../../lib/task-state-manager.js';
import { promises as fs } from 'fs';
import path from 'path';
import { homedir } from 'os';

// Use a test-specific tasks directory
const TEST_TASKS_DIR = path.join(homedir(), '.claude-tasks-test');

describe('TaskStateManager - Initialization', () => {
  it('should initialize with global config', () => {
    const manager = new TaskStateManager();
    assert.ok(manager.tasksDir);
    assert.ok(manager.globalConfig);
  });
});

describe('TaskStateManager - State Persistence', () => {
  let manager;
  let testTaskId;

  before(async () => {
    manager = new TaskStateManager();
    // Override tasks directory for testing
    manager.tasksDir = TEST_TASKS_DIR;
    await fs.mkdir(TEST_TASKS_DIR, { recursive: true });
  });

  beforeEach(() => {
    testTaskId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  });

  after(async () => {
    // Cleanup test directory
    try {
      await fs.rm(TEST_TASKS_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should save task state to disk', async () => {
    const state = {
      taskId: testTaskId,
      status: 'running',
      project: 'test-project',
      description: 'Test task',
      startedAt: new Date().toISOString()
    };

    await manager.saveTaskState(testTaskId, state);

    // Verify file exists
    const statePath = path.join(TEST_TASKS_DIR, testTaskId, 'state.json');
    const exists = await fs.access(statePath).then(() => true).catch(() => false);
    assert.ok(exists, 'State file should exist');
  });

  it('should load task state from disk', async () => {
    const state = {
      taskId: testTaskId,
      status: 'running',
      project: 'test-project',
      description: 'Test task',
      startedAt: new Date().toISOString()
    };

    await manager.saveTaskState(testTaskId, state);
    const loaded = await manager.loadTaskState(testTaskId);

    assert.deepEqual(loaded, state);
  });

  it('should return null for non-existent task', async () => {
    const loaded = await manager.loadTaskState('non-existent-task-12345');
    assert.equal(loaded, null);
  });

  it('should update task state with partial updates', async () => {
    const initialState = {
      taskId: testTaskId,
      status: 'running',
      project: 'test-project'
    };

    await manager.saveTaskState(testTaskId, initialState);

    await manager.updateTaskState(testTaskId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    const updated = await manager.loadTaskState(testTaskId);
    assert.equal(updated.status, 'completed');
    assert.equal(updated.project, 'test-project'); // Original field preserved
    assert.ok(updated.completedAt);
    assert.ok(updated.updatedAt);
  });

  it('should create new state if updating non-existent task', async () => {
    await manager.updateTaskState(testTaskId, {
      status: 'running',
      project: 'test-project'
    });

    const state = await manager.loadTaskState(testTaskId);
    assert.ok(state);
    assert.equal(state.status, 'running');
    assert.ok(state.updatedAt);
  });
});

describe('TaskStateManager - Task Querying', () => {
  let manager;
  let testTasks;

  before(async () => {
    manager = new TaskStateManager();
    manager.tasksDir = TEST_TASKS_DIR;
    await fs.mkdir(TEST_TASKS_DIR, { recursive: true });

    // Create test tasks
    testTasks = [
      {
        taskId: 'task-1',
        status: 'running',
        project: 'project-a',
        pid: process.pid, // Use current process so it's running
        startedAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      },
      {
        taskId: 'task-2',
        status: 'completed',
        project: 'project-a',
        startedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        completedAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        taskId: 'task-3',
        status: 'running',
        project: 'project-b',
        pid: process.pid,
        startedAt: new Date(Date.now() - 1800000).toISOString() // 30 min ago
      },
      {
        taskId: 'task-4',
        status: 'failed',
        project: 'project-a',
        startedAt: new Date(Date.now() - 5400000).toISOString(), // 90 min ago
        completedAt: new Date(Date.now() - 4800000).toISOString()
      }
    ];

    for (const task of testTasks) {
      await manager.saveTaskState(task.taskId, task);
    }
  });

  after(async () => {
    try {
      await fs.rm(TEST_TASKS_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should get all tasks sorted by start time', async () => {
    const tasks = await manager.getAllTasks();

    assert.equal(tasks.length, 4);

    // Should be sorted newest first - verify task-3 is first (newest - 30 min ago)
    assert.equal(tasks[0].taskId, 'task-3');

    // Verify all tasks are present
    const taskIds = tasks.map(t => t.taskId);
    assert.ok(taskIds.includes('task-1'));
    assert.ok(taskIds.includes('task-2'));
    assert.ok(taskIds.includes('task-3'));
    assert.ok(taskIds.includes('task-4'));

    // Verify sorting: each task should be newer or equal to the next one
    for (let i = 0; i < tasks.length - 1; i++) {
      const current = new Date(tasks[i].startedAt);
      const next = new Date(tasks[i + 1].startedAt);
      assert.ok(current >= next, `Task ${tasks[i].taskId} should be newer than ${tasks[i + 1].taskId}`);
    }
  });

  it('should get only running tasks', async () => {
    const runningTasks = await manager.getRunningTasks();

    assert.equal(runningTasks.length, 2);
    assert.ok(runningTasks.every(t => t.status === 'running'));
  });

  it('should get tasks for specific project', async () => {
    const projectATasks = await manager.getProjectTasks('project-a');

    assert.equal(projectATasks.length, 3);
    assert.ok(projectATasks.every(t => t.project === 'project-a'));
  });

  it('should return empty array for non-existent project', async () => {
    const tasks = await manager.getProjectTasks('non-existent-project');
    assert.deepEqual(tasks, []);
  });

  it('should return empty array if tasks directory does not exist', async () => {
    const newManager = new TaskStateManager();
    newManager.tasksDir = path.join(TEST_TASKS_DIR, 'non-existent-dir');

    const tasks = await newManager.getAllTasks();
    assert.deepEqual(tasks, []);
  });
});

describe('TaskStateManager - Process Management', () => {
  let manager;

  before(() => {
    manager = new TaskStateManager();
  });

  it('should detect running process (current process)', () => {
    const isRunning = manager.isProcessRunning(process.pid);
    assert.equal(isRunning, true);
  });

  it('should detect non-existent process', () => {
    const isRunning = manager.isProcessRunning(999999);
    assert.equal(isRunning, false);
  });

  it('should sync task states and mark dead processes as interrupted', async () => {
    manager.tasksDir = TEST_TASKS_DIR;
    await fs.mkdir(TEST_TASKS_DIR, { recursive: true });

    // Create task with fake PID
    const taskId = `test-sync-${Date.now()}`;
    await manager.saveTaskState(taskId, {
      taskId,
      status: 'running',
      pid: 999999, // Non-existent process
      project: 'test-project',
      startedAt: new Date().toISOString()
    });

    await manager.syncTaskStates();

    const updated = await manager.loadTaskState(taskId);
    assert.equal(updated.status, 'interrupted');
    assert.ok(updated.error);
    assert.ok(updated.completedAt);

    // Cleanup
    await manager.deleteTaskState(taskId);
  });

  it('should not modify tasks with running processes', async () => {
    manager.tasksDir = TEST_TASKS_DIR;
    await fs.mkdir(TEST_TASKS_DIR, { recursive: true });

    const taskId = `test-running-${Date.now()}`;
    await manager.saveTaskState(taskId, {
      taskId,
      status: 'running',
      pid: process.pid, // Current process (running)
      project: 'test-project',
      startedAt: new Date().toISOString()
    });

    await manager.syncTaskStates();

    const updated = await manager.loadTaskState(taskId);
    assert.equal(updated.status, 'running'); // Should remain running

    // Cleanup
    await manager.deleteTaskState(taskId);
  });
});

describe('TaskStateManager - Task Deletion', () => {
  let manager;
  let testTaskId;

  before(async () => {
    manager = new TaskStateManager();
    manager.tasksDir = TEST_TASKS_DIR;
    await fs.mkdir(TEST_TASKS_DIR, { recursive: true });
  });

  beforeEach(async () => {
    testTaskId = `test-delete-${Date.now()}`;
    await manager.saveTaskState(testTaskId, {
      taskId: testTaskId,
      status: 'completed',
      project: 'test-project'
    });
  });

  after(async () => {
    try {
      await fs.rm(TEST_TASKS_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should delete task state', async () => {
    await manager.deleteTaskState(testTaskId);

    const state = await manager.loadTaskState(testTaskId);
    assert.equal(state, null);
  });

  it('should not error when deleting non-existent task', async () => {
    await manager.deleteTaskState('non-existent-task-xyz');
    // Should not throw
  });
});

describe('TaskStateManager - Cleanup Old Tasks', () => {
  let manager;

  before(async () => {
    manager = new TaskStateManager();
    manager.tasksDir = TEST_TASKS_DIR;
    await fs.mkdir(TEST_TASKS_DIR, { recursive: true });

    // Create old completed task (8 days ago)
    await manager.saveTaskState('old-task-1', {
      taskId: 'old-task-1',
      status: 'completed',
      project: 'test',
      startedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    });

    // Create recent completed task (3 days ago)
    await manager.saveTaskState('recent-task-1', {
      taskId: 'recent-task-1',
      status: 'completed',
      project: 'test',
      startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    });

    // Create running task (should never be deleted)
    await manager.saveTaskState('running-task-1', {
      taskId: 'running-task-1',
      status: 'running',
      project: 'test',
      pid: process.pid,
      startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    });
  });

  after(async () => {
    try {
      await fs.rm(TEST_TASKS_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should delete old completed tasks', async () => {
    const deletedCount = await manager.cleanupOldTasks(7);

    assert.equal(deletedCount, 1); // Only old-task-1 should be deleted

    const oldTask = await manager.loadTaskState('old-task-1');
    assert.equal(oldTask, null);

    const recentTask = await manager.loadTaskState('recent-task-1');
    assert.ok(recentTask);

    const runningTask = await manager.loadTaskState('running-task-1');
    assert.ok(runningTask);
  });

  it('should respect custom retention period', async () => {
    // Re-create old task
    await manager.saveTaskState('old-task-2', {
      taskId: 'old-task-2',
      status: 'completed',
      project: 'test',
      startedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
    });

    const deletedCount = await manager.cleanupOldTasks(3); // 3 days

    assert.ok(deletedCount >= 1);

    const task = await manager.loadTaskState('old-task-2');
    assert.equal(task, null);
  });
});

describe('TaskStateManager - Progress Calculation', () => {
  let manager;

  before(() => {
    manager = new TaskStateManager();
  });

  it('should calculate progress with no completed agents', () => {
    const progress = manager.calculateProgress('architect', []);
    assert.equal(progress, 10); // 20% / 2 = 10%
  });

  it('should calculate progress with completed agents', () => {
    const progress = manager.calculateProgress('coder', ['architect']);
    assert.equal(progress, 45); // 20% (architect) + 50% / 2 (coder)
  });

  it('should calculate progress at final stage', () => {
    const progress = manager.calculateProgress('reviewer', ['architect', 'coder']);
    assert.equal(progress, 80); // 20% + 50% + 20% / 2
  });

  it('should cap progress at 100%', () => {
    const progress = manager.calculateProgress('tester', ['architect', 'coder', 'reviewer', 'tester']);
    assert.equal(progress, 100);
  });
});

describe('TaskStateManager - ETA Estimation', () => {
  let manager;

  before(() => {
    manager = new TaskStateManager();
  });

  it('should estimate ETA for architect stage', () => {
    const eta = manager.estimateETA('architect', []);
    assert.ok(eta > 0);
    assert.ok(eta < 200); // Should be reasonable
  });

  it('should estimate ETA for coder stage', () => {
    const eta = manager.estimateETA('coder', ['architect']);
    assert.ok(eta > 0);
  });

  it('should estimate lower ETA when more agents completed', () => {
    const eta1 = manager.estimateETA('coder', []);
    const eta2 = manager.estimateETA('coder', ['architect']);

    assert.ok(eta2 < eta1); // More progress = less time remaining
  });
});

describe('TaskStateManager - Subtask Management', () => {
  let manager;
  let testTaskId;

  before(async () => {
    manager = new TaskStateManager();
    manager.tasksDir = TEST_TASKS_DIR;
    await fs.mkdir(TEST_TASKS_DIR, { recursive: true });
  });

  beforeEach(() => {
    testTaskId = `test-subtask-${Date.now()}`;
  });

  after(async () => {
    try {
      await fs.rm(TEST_TASKS_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should save and load subtask state', async () => {
    const subtaskId = 'subtask-1';
    const subtaskState = {
      subtaskId,
      status: 'running',
      description: 'Subtask 1',
      startedAt: new Date().toISOString()
    };

    await manager.saveSubtaskState(testTaskId, subtaskId, subtaskState);
    const loaded = await manager.loadSubtaskState(testTaskId, subtaskId);

    assert.deepEqual(loaded, subtaskState);
  });

  it('should return null for non-existent subtask', async () => {
    const loaded = await manager.loadSubtaskState(testTaskId, 'non-existent');
    assert.equal(loaded, null);
  });

  it('should get all subtasks for a task', async () => {
    const subtasks = [
      { subtaskId: 'sub-1', status: 'completed', startedAt: new Date(Date.now() - 2000).toISOString() },
      { subtaskId: 'sub-2', status: 'running', startedAt: new Date(Date.now() - 1000).toISOString() },
      { subtaskId: 'sub-3', status: 'pending', startedAt: new Date().toISOString() }
    ];

    for (const subtask of subtasks) {
      await manager.saveSubtaskState(testTaskId, subtask.subtaskId, subtask);
    }

    const loaded = await manager.getSubtasks(testTaskId);
    assert.equal(loaded.length, 3);

    // Should be sorted by startedAt
    assert.equal(loaded[0].subtaskId, 'sub-1');
    assert.equal(loaded[1].subtaskId, 'sub-2');
    assert.equal(loaded[2].subtaskId, 'sub-3');
  });

  it('should return empty array for task with no subtasks', async () => {
    const subtasks = await manager.getSubtasks('no-subtasks-task');
    assert.deepEqual(subtasks, []);
  });
});

describe('TaskStateManager - Formatting', () => {
  let manager;

  before(() => {
    manager = new TaskStateManager();
  });

  it('should format task summary for running task', () => {
    const task = {
      taskId: 'task-123',
      project: 'my-project',
      status: 'running',
      currentAgent: 'coder',
      progress: { percent: 45, eta: 120 },
      startedAt: new Date(Date.now() - 60000).toISOString() // 1 min ago
    };

    const summary = manager.formatTaskSummary(task);

    assert.equal(summary.id, 'task-123');
    assert.equal(summary.project, 'my-project');
    assert.equal(summary.status, 'running');
    assert.equal(summary.stage, 'coder');
    assert.equal(summary.progress, 45);
    assert.equal(summary.eta, 120);
    assert.ok(summary.duration >= 60);
  });

  it('should format task summary for completed task', () => {
    const task = {
      taskId: 'task-456',
      project: 'my-project',
      status: 'completed',
      startedAt: new Date(Date.now() - 300000).toISOString(), // 5 min ago
      completedAt: new Date().toISOString()
    };

    const summary = manager.formatTaskSummary(task);

    assert.equal(summary.status, 'completed');
    assert.ok(summary.duration >= 300);
  });

  it('should format parallel task summary', () => {
    const task = {
      taskId: 'parallel-task',
      project: 'my-project',
      status: 'running',
      startedAt: new Date().toISOString()
    };

    const subtasks = [
      { status: 'completed' },
      { status: 'completed' },
      { status: 'running' },
      { status: 'pending' }
    ];

    const summary = manager.formatParallelTaskSummary(task, subtasks);

    assert.equal(summary.parallel, true);
    assert.equal(summary.subtasks.total, 4);
    assert.equal(summary.subtasks.completed, 2);
    assert.equal(summary.subtasks.running, 1);
    assert.equal(summary.subtasks.progress, 50); // 2/4 = 50%
  });
});

console.log('\n✅ TaskStateManager unit tests completed\n');
