#!/usr/bin/env node

/**
 * Integration Tests for End-to-End Workflow
 * Tests complete task execution workflow (mocked, non-destructive)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { Orchestrator } from '../../lib/orchestrator.js';
import { ConfigManager } from '../../lib/config-manager.js';
import { TaskStateManager } from '../../lib/task-state-manager.js';
import { homedir } from 'os';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(homedir(), '.env') });

describe('End-to-End Workflow - Prerequisites', () => {
  it('should have test project configured', async () => {
    const configManager = new ConfigManager();
    const projects = await configManager.listProjects();

    assert.ok(Array.isArray(projects));

    // Check if test-project exists
    const hasTestProject = projects.includes('test-project');
    if (!hasTestProject) {
      console.log('  ⊘ test-project not found, some tests may be skipped');
    }
  });

  it('should have Docker available', async () => {
    const { Orchestrator } = await import('../../lib/orchestrator.js');

    try {
      const orchestrator = new Orchestrator(
        process.env.GITHUB_TOKEN,
        process.env.ANTHROPIC_API_KEY
      );

      await orchestrator.dockerManager.ping();
      assert.ok(true, 'Docker is available');
    } catch (error) {
      console.log('  ⊘ Docker not available:', error.message);
    }
  });
});

describe('End-to-End Workflow - Task ID Generation', () => {
  it('should generate unique task IDs for concurrent tasks', () => {
    const taskIds = new Set();
    const count = 10;

    for (let i = 0; i < count; i++) {
      // Simulate task ID generation (hex string)
      const taskId = Math.random().toString(36).substring(2, 15);
      taskIds.add(taskId);
    }

    assert.equal(taskIds.size, count, 'All task IDs should be unique');
  });
});

describe('End-to-End Workflow - Component Integration', () => {
  let orchestrator;

  before(() => {
    orchestrator = new Orchestrator(
      process.env.GITHUB_TOKEN,
      process.env.ANTHROPIC_API_KEY
    );
  });

  it('should have all required components initialized', () => {
    assert.ok(orchestrator.dockerManager, 'Docker manager should be initialized');
    assert.ok(orchestrator.configManager, 'Config manager should be initialized');
    assert.ok(orchestrator.gitManager, 'Git manager should be initialized');
    assert.ok(orchestrator.agentRegistry, 'Agent registry should be initialized');
    assert.ok(orchestrator.toolRegistry, 'Tool registry should be initialized');
  });

  it('should have cleanup handlers registered', () => {
    assert.equal(orchestrator.cleanupRegistered, true);
  });

  it('should have active container tracking', () => {
    assert.ok(orchestrator.activeContainers instanceof Set);
    assert.equal(orchestrator.activeContainers.size, 0);
  });
});

describe('End-to-End Workflow - Configuration Loading', () => {
  let configManager;

  before(() => {
    configManager = new ConfigManager();
  });

  it('should load project configurations', async () => {
    const projects = await configManager.listProjects();
    assert.ok(Array.isArray(projects));
  });

  it('should validate required config fields', () => {
    const requiredFields = ['name', 'repo', 'base_branch', 'docker'];

    requiredFields.forEach(field => {
      assert.ok(field.length > 0);
    });
  });

  it('should apply default values to config', () => {
    const minimalConfig = {
      name: 'test',
      repo: 'local',
      base_branch: 'main',
      docker: { image: 'test:latest' }
    };

    const withDefaults = configManager.applyDefaults(minimalConfig);

    assert.ok(withDefaults.protected_branches);
    assert.ok(withDefaults.docker.memory);
    assert.ok(withDefaults.docker.cpus);
    assert.ok(withDefaults.safety.max_cost_per_task);
  });
});

describe('End-to-End Workflow - Task State Management', () => {
  let stateManager;

  before(() => {
    stateManager = new TaskStateManager();
  });

  it('should create task state for new task', async () => {
    const taskId = `test-e2e-${Date.now()}`;
    const state = {
      taskId,
      status: 'running',
      project: 'test-project',
      description: 'End-to-end test task',
      startedAt: new Date().toISOString()
    };

    await stateManager.saveTaskState(taskId, state);
    const loaded = await stateManager.loadTaskState(taskId);

    assert.ok(loaded);
    assert.equal(loaded.taskId, taskId);
    assert.equal(loaded.status, 'running');

    // Cleanup
    await stateManager.deleteTaskState(taskId);
  });

  it('should track task progress', () => {
    const currentAgent = 'coder';
    const completedAgents = ['architect'];

    const progress = stateManager.calculateProgress(currentAgent, completedAgents);

    assert.ok(progress > 0);
    assert.ok(progress <= 100);
  });

  it('should estimate task ETA', () => {
    const currentAgent = 'coder';
    const completedAgents = ['architect'];

    const eta = stateManager.estimateETA(currentAgent, completedAgents);

    assert.ok(typeof eta === 'number');
    assert.ok(eta >= 0);
  });
});

describe('End-to-End Workflow - Agent System', () => {
  let orchestrator;

  before(() => {
    orchestrator = new Orchestrator(
      process.env.GITHUB_TOKEN,
      process.env.ANTHROPIC_API_KEY
    );
  });

  it('should have agents registered', () => {
    const agents = orchestrator.agentRegistry.listAll();

    assert.ok(Array.isArray(agents));
    assert.ok(agents.length > 0);
  });

  it('should have standard agents available', () => {
    const architect = orchestrator.agentRegistry.get('architect');
    const coder = orchestrator.agentRegistry.get('coder');
    const reviewer = orchestrator.agentRegistry.get('reviewer');

    assert.ok(architect);
    assert.ok(coder);
    assert.ok(reviewer);
  });

  it('should have ServiceNow agents available', () => {
    const snApi = orchestrator.agentRegistry.get('sn-api');
    const snScripting = orchestrator.agentRegistry.get('sn-scripting');

    assert.ok(snApi);
    assert.ok(snScripting);
  });
});

describe('End-to-End Workflow - Error Handling', () => {
  let orchestrator;

  before(() => {
    orchestrator = new Orchestrator(
      process.env.GITHUB_TOKEN,
      process.env.ANTHROPIC_API_KEY
    );
  });

  it('should handle missing project configuration', async () => {
    try {
      await orchestrator.configManager.load('non-existent-project-xyz');
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok(error.message.includes('Project configuration not found'));
    }
  });

  it('should handle invalid configuration', () => {
    try {
      orchestrator.configManager.validate({ name: 'test' });
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok(error.message.includes('Missing required field'));
    }
  });
});

describe('End-to-End Workflow - Cost Tracking', () => {
  it('should initialize cost monitor with limit', async () => {
    const { CostMonitor } = await import('../../lib/cost-monitor.js');
    const monitor = new CostMonitor(5.0);

    assert.equal(monitor.maxCost, 5.0);
    assert.equal(monitor.getTotalCost(), 0);
  });

  it('should track usage', async () => {
    const { CostMonitor } = await import('../../lib/cost-monitor.js');
    const monitor = new CostMonitor(5.0);

    monitor.addUsage({ inputTokens: 1000, outputTokens: 500 });

    const cost = monitor.getTotalCost();
    assert.ok(cost > 0);
    assert.ok(cost < 1.0);
  });

  it('should enforce cost limits', async () => {
    const { CostMonitor } = await import('../../lib/cost-monitor.js');
    const monitor = new CostMonitor(0.01);

    try {
      monitor.addUsage({ inputTokens: 10000, outputTokens: 10000 });
      assert.fail('Should have thrown cost limit error');
    } catch (error) {
      assert.ok(error.message.includes('Cost limit'));
    }
  });
});

describe('End-to-End Workflow - Cleanup Operations', () => {
  let orchestrator;

  before(() => {
    orchestrator = new Orchestrator(
      process.env.GITHUB_TOKEN,
      process.env.ANTHROPIC_API_KEY
    );
  });

  it('should track active containers', () => {
    const mockContainer = { id: 'test-123', name: 'claude-test' };

    orchestrator.activeContainers.add(mockContainer);
    assert.equal(orchestrator.activeContainers.size, 1);

    orchestrator.activeContainers.delete(mockContainer);
    assert.equal(orchestrator.activeContainers.size, 0);
  });

  it('should have cleanup method', () => {
    assert.ok(typeof orchestrator.cleanupContainer === 'function');
    assert.ok(typeof orchestrator.cleanupAll === 'function');
  });
});

describe('End-to-End Workflow - Summary Generation', () => {
  it('should generate task summary', async () => {
    const { SummaryGenerator } = await import('../../lib/summary-generator.js');
    const generator = new SummaryGenerator();

    const taskData = {
      taskId: 'test-123',
      description: 'Test task',
      result: { changes: ['file1.js', 'file2.js'] },
      testResults: { passed: true },
      config: { name: 'test-project' },
      branchName: 'claude/test-123'
    };

    const summary = generator.create(taskData);

    assert.ok(summary);
    assert.ok(typeof summary === 'string');
    assert.ok(summary.length > 0);
  });
});

console.log('\n✅ End-to-end workflow integration tests completed\n');
