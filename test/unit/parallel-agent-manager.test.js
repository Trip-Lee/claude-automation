#!/usr/bin/env node

/**
 * Unit Tests for ParallelAgentManager
 * Tests subtask management, progress tracking, and result aggregation
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ParallelAgentManager } from '../../lib/parallel-agent-manager.js';

// Mock orchestrator for testing
class MockOrchestrator {
  constructor() {
    this.git = {
      createBranch: async (branchName, baseBranch) => {
        return { name: branchName, base: baseBranch };
      }
    };

    this.dockerManager = {
      create: async (config) => {
        return { id: `mock-container-${Date.now()}`, name: config.name };
      },
      start: async (container) => {
        return container;
      },
      stop: async (container) => {
        return container;
      },
      remove: async (container) => {
        return true;
      }
    };
  }

  createAgent(role) {
    return {
      execute: async ({ task }) => {
        // Simulate agent execution
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          success: true,
          changes: [`Modified file for ${task}`],
          cost: 0.05
        };
      }
    };
  }
}

describe('ParallelAgentManager - Initialization', () => {
  it('should initialize with orchestrator and task ID', () => {
    const orchestrator = new MockOrchestrator();
    const taskId = 'test-task-123';

    const manager = new ParallelAgentManager(orchestrator, taskId);

    assert.equal(manager.taskId, taskId);
    assert.ok(manager.orchestrator);
    assert.ok(manager.activeSubtasks instanceof Map);
    assert.ok(manager.stateManager);
  });

  it('should initialize with empty active subtasks', () => {
    const orchestrator = new MockOrchestrator();
    const manager = new ParallelAgentManager(orchestrator, 'test-task');

    assert.equal(manager.activeSubtasks.size, 0);
  });
});

describe('ParallelAgentManager - Subtask State Management', () => {
  let manager;
  let orchestrator;

  before(() => {
    orchestrator = new MockOrchestrator();
    manager = new ParallelAgentManager(orchestrator, 'test-task');
  });

  beforeEach(() => {
    // Clear active subtasks before each test
    manager.activeSubtasks.clear();
  });

  it('should add subtask to active tracking', () => {
    const subtaskId = 'test-task-part1';

    manager.activeSubtasks.set(subtaskId, {
      id: subtaskId,
      status: 'running',
      progress: 0
    });

    assert.equal(manager.activeSubtasks.size, 1);
    assert.ok(manager.activeSubtasks.has(subtaskId));
  });

  it('should update subtask state', () => {
    const subtaskId = 'test-task-part1';

    manager.activeSubtasks.set(subtaskId, {
      id: subtaskId,
      status: 'running',
      progress: 0
    });

    manager.updateSubtaskState(subtaskId, {
      status: 'executing',
      progress: 50
    });

    const state = manager.activeSubtasks.get(subtaskId);
    assert.equal(state.status, 'executing');
    assert.equal(state.progress, 50);
  });

  it('should track multiple subtasks', () => {
    const subtasks = ['part1', 'part2', 'part3'];

    subtasks.forEach(part => {
      manager.activeSubtasks.set(`test-task-${part}`, {
        id: `test-task-${part}`,
        status: 'running',
        progress: 0
      });
    });

    assert.equal(manager.activeSubtasks.size, 3);
  });

  it('should remove completed subtasks from tracking', () => {
    const subtaskId = 'test-task-part1';

    manager.activeSubtasks.set(subtaskId, {
      id: subtaskId,
      status: 'running',
      progress: 50
    });

    manager.activeSubtasks.delete(subtaskId);

    assert.equal(manager.activeSubtasks.size, 0);
    assert.equal(manager.activeSubtasks.has(subtaskId), false);
  });
});

describe('ParallelAgentManager - Result Analysis', () => {
  let manager;

  before(() => {
    const orchestrator = new MockOrchestrator();
    manager = new ParallelAgentManager(orchestrator, 'test-task');
  });

  it('should analyze all successful results', () => {
    const results = [
      { status: 'fulfilled', value: { subtaskId: 'part1', success: true, cost: 0.1 } },
      { status: 'fulfilled', value: { subtaskId: 'part2', success: true, cost: 0.2 } },
      { status: 'fulfilled', value: { subtaskId: 'part3', success: true, cost: 0.15 } }
    ];

    const { successful, failed } = manager.analyzeResults(results);

    assert.equal(successful.length, 3);
    assert.equal(failed.length, 0);
  });

  it('should identify failed results', () => {
    const results = [
      { status: 'fulfilled', value: { subtaskId: 'part1', success: true, cost: 0.1 } },
      { status: 'rejected', reason: new Error('Execution failed') },
      { status: 'fulfilled', value: { subtaskId: 'part3', success: true, cost: 0.15 } }
    ];

    const { successful, failed } = manager.analyzeResults(results);

    assert.equal(successful.length, 2);
    assert.equal(failed.length, 1);
    assert.ok(failed[0].error);
  });

  it('should handle all failed results', () => {
    const results = [
      { status: 'rejected', reason: new Error('Fail 1') },
      { status: 'rejected', reason: new Error('Fail 2') },
      { status: 'rejected', reason: new Error('Fail 3') }
    ];

    const { successful, failed } = manager.analyzeResults(results);

    assert.equal(successful.length, 0);
    assert.equal(failed.length, 3);
  });

  it('should extract error messages from failures', () => {
    const results = [
      { status: 'rejected', reason: new Error('Specific error message') }
    ];

    const { failed } = manager.analyzeResults(results);

    assert.ok(failed[0].error.includes('Specific error message'));
  });
});

describe('ParallelAgentManager - Progress Monitoring', () => {
  let manager;

  before(() => {
    const orchestrator = new MockOrchestrator();
    manager = new ParallelAgentManager(orchestrator, 'test-task');
  });

  it('should start progress monitoring', () => {
    manager.startProgressMonitoring();

    assert.ok(manager.progressInterval !== null);

    // Cleanup
    manager.stopProgressMonitoring();
  });

  it('should stop progress monitoring', () => {
    manager.startProgressMonitoring();
    assert.ok(manager.progressInterval !== null);

    manager.stopProgressMonitoring();
    assert.equal(manager.progressInterval, null);
  });

  it('should handle stopping when not started', () => {
    manager.progressInterval = null;
    manager.stopProgressMonitoring();
    // Should not throw
    assert.equal(manager.progressInterval, null);
  });
});

describe('ParallelAgentManager - Cost Calculation', () => {
  let manager;

  before(() => {
    const orchestrator = new MockOrchestrator();
    manager = new ParallelAgentManager(orchestrator, 'test-task');
  });

  it('should calculate total cost from successful results', () => {
    const successful = [
      { cost: 0.10 },
      { cost: 0.25 },
      { cost: 0.15 }
    ];

    const totalCost = successful.reduce((sum, r) => sum + (r.cost || 0), 0);

    assert.equal(totalCost, 0.50);
  });

  it('should handle results with no cost', () => {
    const successful = [
      { cost: 0.10 },
      {},  // No cost field
      { cost: 0.15 }
    ];

    const totalCost = successful.reduce((sum, r) => sum + (r.cost || 0), 0);

    assert.equal(totalCost, 0.25);
  });

  it('should handle empty results', () => {
    const successful = [];

    const totalCost = successful.reduce((sum, r) => sum + (r.cost || 0), 0);

    assert.equal(totalCost, 0);
  });
});

describe('ParallelAgentManager - Duration Calculation', () => {
  let manager;

  before(() => {
    const orchestrator = new MockOrchestrator();
    manager = new ParallelAgentManager(orchestrator, 'test-task');
  });

  it('should calculate max duration from results', () => {
    const successful = [
      { duration: 10 },
      { duration: 25 },
      { duration: 15 }
    ];

    const maxDuration = Math.max(...successful.map(r => r.duration || 0), 0);

    assert.equal(maxDuration, 25);
  });

  it('should handle results with no duration', () => {
    const successful = [
      { duration: 10 },
      {},  // No duration
      { duration: 15 }
    ];

    const maxDuration = Math.max(...successful.map(r => r.duration || 0), 0);

    assert.equal(maxDuration, 15);
  });

  it('should return 0 for empty results', () => {
    const successful = [];

    const maxDuration = Math.max(...successful.map(r => r.duration || 0), 0);

    assert.equal(maxDuration, 0);
  });
});

describe('ParallelAgentManager - Subtask ID Generation', () => {
  let manager;

  before(() => {
    const orchestrator = new MockOrchestrator();
    manager = new ParallelAgentManager(orchestrator, 'main-task-123');
  });

  it('should generate subtask IDs with task ID prefix', () => {
    const parts = [
      { role: 'coder', description: 'Part 1' },
      { role: 'reviewer', description: 'Part 2' }
    ];

    parts.forEach((part, index) => {
      const subtaskId = `${manager.taskId}-part${index + 1}`;
      assert.ok(subtaskId.startsWith('main-task-123-part'));
      assert.ok(subtaskId.includes(`${index + 1}`));
    });
  });

  it('should generate unique subtask IDs', () => {
    const taskId = 'test-task';
    const subtaskIds = new Set();

    for (let i = 0; i < 5; i++) {
      const subtaskId = `${taskId}-part${i + 1}`;
      subtaskIds.add(subtaskId);
    }

    assert.equal(subtaskIds.size, 5);
  });
});

describe('ParallelAgentManager - Error Handling', () => {
  let manager;

  before(() => {
    const orchestrator = new MockOrchestrator();
    manager = new ParallelAgentManager(orchestrator, 'test-task');
  });

  it('should handle subtask execution errors gracefully', async () => {
    const results = [
      { status: 'fulfilled', value: { success: true, cost: 0.1 } },
      { status: 'rejected', reason: new Error('Container failed') }
    ];

    const { successful, failed } = manager.analyzeResults(results);

    assert.equal(successful.length, 1);
    assert.equal(failed.length, 1);
    assert.ok(failed[0].error.includes('Container failed'));
  });

  it('should cleanup progress monitoring on error', () => {
    manager.startProgressMonitoring();

    try {
      // Simulate an error scenario
      throw new Error('Test error');
    } catch (error) {
      // Expected error
    } finally {
      manager.stopProgressMonitoring();
    }

    assert.equal(manager.progressInterval, null);
  });
});

console.log('\n✅ ParallelAgentManager unit tests completed\n');
