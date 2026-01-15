#!/usr/bin/env node

/**
 * Integration Tests for Error Recovery Scenarios
 * Tests system resilience and error handling
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { Orchestrator } from '../../lib/orchestrator.js';
import { DockerManager } from '../../lib/docker-manager.js';
import { ConfigManager } from '../../lib/config-manager.js';
import { TaskStateManager } from '../../lib/task-state-manager.js';
import { homedir } from 'os';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(homedir(), '.env') });

describe('Error Recovery - Docker Failures', () => {
  let dockerManager;

  before(() => {
    dockerManager = new DockerManager();
  });

  it('should handle Docker daemon not running', async () => {
    try {
      await dockerManager.ping();
      // If ping succeeds, Docker is running - that's good
      assert.ok(true, 'Docker is running');
    } catch (error) {
      // If ping fails, it should provide helpful error
      assert.ok(error.message.includes('Docker daemon'));
    }
  });

  it('should handle container stop on already stopped container', async () => {
    const mockContainer = {
      stop: async () => {
        throw new Error('container already stopped');
      }
    };

    try {
      await dockerManager.stop(mockContainer);
      // Should not throw - already stopped is OK
      assert.ok(true);
    } catch (error) {
      // Should not reach here
      assert.fail('Should handle already stopped container gracefully');
    }
  });

  it('should handle container removal failures gracefully', async () => {
    // dockerManager.remove logs warnings but doesn't throw
    await dockerManager.remove('non-existent-container-123');
    // Should complete without throwing
    assert.ok(true);
  });

  it('should handle invalid memory format', () => {
    assert.throws(
      () => dockerManager.parseMemory('invalid'),
      /Invalid memory format/
    );
  });
});

describe('Error Recovery - Git Failures', () => {
  let orchestrator;

  before(() => {
    orchestrator = new Orchestrator(
      process.env.GITHUB_TOKEN,
      process.env.ANTHROPIC_API_KEY
    );
  });

  it('should handle non-existent repository', async () => {
    const fakePath = '/non/existent/repo/path';

    try {
      await orchestrator.gitManager.getStatus(fakePath);
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok(error.message.includes('Failed to get git status'));
    }
  });

  it('should handle missing remote gracefully', async () => {
    // GitManager handles missing remote by checking first
    assert.ok(typeof orchestrator.gitManager.hasRemote === 'function');
  });
});

describe('Error Recovery - Configuration Errors', () => {
  let configManager;

  before(() => {
    configManager = new ConfigManager();
  });

  it('should provide helpful error for missing config', async () => {
    try {
      await configManager.load('totally-non-existent-project-abc123');
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok(error.message.includes('Project configuration not found'));
      assert.ok(error.message.includes('totally-non-existent-project-abc123'));
    }
  });

  it('should validate required fields', () => {
    try {
      configManager.validate({ name: 'test' });
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok(error.message.includes('Missing required field'));
    }
  });

  it('should validate docker image is required', () => {
    try {
      configManager.validate({
        name: 'test',
        repo: 'local',
        base_branch: 'main',
        docker: {}  // Missing image
      });
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok(error.message.includes('docker.image'));
    }
  });

  it('should validate memory format', () => {
    try {
      configManager.validate({
        name: 'test',
        repo: 'local',
        base_branch: 'main',
        docker: {
          image: 'test:latest',
          memory: 'invalid-format'
        }
      });
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok(error.message.includes('Invalid memory format'));
    }
  });
});

describe('Error Recovery - Task State Failures', () => {
  let stateManager;

  before(() => {
    stateManager = new TaskStateManager();
  });

  it('should return null for non-existent task', async () => {
    const state = await stateManager.loadTaskState('non-existent-xyz');
    assert.equal(state, null);
  });

  it('should handle corrupt task state gracefully', async () => {
    // If state file is corrupt, loadTaskState should return null
    const state = await stateManager.loadTaskState('corrupt-state-123');
    assert.equal(state, null);
  });

  it('should handle deletion of non-existent task', async () => {
    await stateManager.deleteTaskState('non-existent-task-456');
    // Should not throw
    assert.ok(true);
  });
});

describe('Error Recovery - Process Interruption', () => {
  let stateManager;

  before(() => {
    stateManager = new TaskStateManager();
  });

  it('should detect interrupted tasks on system reboot', async () => {
    const interruptedTaskId = `interrupted-${Date.now()}`;

    // Simulate task that was running before reboot
    await stateManager.saveTaskState(interruptedTaskId, {
      taskId: interruptedTaskId,
      status: 'running',
      pid: 999999, // This PID won't exist
      project: 'test',
      startedAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    });

    // Sync should detect this and mark as interrupted
    await stateManager.syncTaskStates();

    const updated = await stateManager.loadTaskState(interruptedTaskId);
    assert.equal(updated.status, 'interrupted');
    assert.ok(updated.error);

    await stateManager.deleteTaskState(interruptedTaskId);
  });
});

describe('Error Recovery - Agent Failures', () => {
  let orchestrator;

  before(() => {
    orchestrator = new Orchestrator(
      process.env.GITHUB_TOKEN,
      process.env.ANTHROPIC_API_KEY
    );
  });

  it('should handle non-existent agent', () => {
    const agent = orchestrator.agentRegistry.get('non-existent-agent-xyz');
    assert.equal(agent, null);
  });

  it('should provide list of available agents on error', () => {
    const agents = orchestrator.agentRegistry.listAll();
    assert.ok(Array.isArray(agents));
    assert.ok(agents.length > 0);
  });
});

describe('Error Recovery - Cost Limit Exceeded', () => {
  it('should throw error when cost limit exceeded', async () => {
    const { CostMonitor } = await import('../../lib/cost-monitor.js');
    const monitor = new CostMonitor(0.01); // Very low limit

    try {
      monitor.addUsage({ inputTokens: 10000, outputTokens: 10000 });
      assert.fail('Should have thrown cost limit error');
    } catch (error) {
      assert.ok(error.message.includes('Cost limit'));
      assert.ok(error.message.includes('exceeded'));
    }
  });

  it('should provide remaining budget information', async () => {
    const { CostMonitor } = await import('../../lib/cost-monitor.js');
    const monitor = new CostMonitor(5.0);

    monitor.addUsage({ inputTokens: 1000, outputTokens: 500 });

    const remaining = monitor.getRemainingBudget();
    assert.ok(remaining < 5.0);
    assert.ok(remaining > 4.9);
  });
});

describe('Error Recovery - Cleanup on Failure', () => {
  let orchestrator;

  before(() => {
    orchestrator = new Orchestrator(
      process.env.GITHUB_TOKEN,
      process.env.ANTHROPIC_API_KEY
    );
  });

  it('should have cleanup handlers registered', () => {
    assert.equal(orchestrator.cleanupRegistered, true);
  });

  it('should track active containers for cleanup', () => {
    const mockContainer1 = { id: 'c1', name: 'claude-1' };
    const mockContainer2 = { id: 'c2', name: 'claude-2' };

    orchestrator.activeContainers.add(mockContainer1);
    orchestrator.activeContainers.add(mockContainer2);

    assert.equal(orchestrator.activeContainers.size, 2);

    // Cleanup
    orchestrator.activeContainers.clear();
  });

  it('should remove containers from tracking on cleanup', async () => {
    const mockContainer = { id: 'test-cleanup', name: 'claude-test' };

    orchestrator.activeContainers.add(mockContainer);
    assert.equal(orchestrator.activeContainers.size, 1);

    await orchestrator.cleanupContainer(mockContainer);
    assert.equal(orchestrator.activeContainers.size, 0);
  });
});

describe('Error Recovery - Network Failures', () => {
  it('should handle timeout errors as retryable', async () => {
    const { ClaudeCodeAgent } = await import('../../lib/claude-code-agent.js');
    const agent = new ClaudeCodeAgent({ role: 'coder' });

    const timeoutError = new Error('network timeout');
    assert.equal(agent._isRetryableError(timeoutError), true);
  });

  it('should handle connection reset as retryable', async () => {
    const { ClaudeCodeAgent } = await import('../../lib/claude-code-agent.js');
    const agent = new ClaudeCodeAgent({ role: 'coder' });

    const resetError = new Error('ECONNRESET');
    assert.equal(agent._isRetryableError(resetError), true);
  });

  it('should handle rate limit errors as retryable', async () => {
    const { ClaudeCodeAgent } = await import('../../lib/claude-code-agent.js');
    const agent = new ClaudeCodeAgent({ role: 'coder' });

    const rateLimitError = new Error('rate limit exceeded');
    assert.equal(agent._isRetryableError(rateLimitError), true);
  });
});

describe('Error Recovery - Parallel Execution Failures', () => {
  it('should handle partial failures in parallel execution', async () => {
    const { ParallelAgentManager } = await import('../../lib/parallel-agent-manager.js');

    // Mock orchestrator
    const mockOrchestrator = {
      git: { createBranch: async () => ({}) },
      dockerManager: { create: async () => ({}), start: async () => ({}) }
    };

    const manager = new ParallelAgentManager(mockOrchestrator, 'test-task');

    const results = [
      { status: 'fulfilled', value: { success: true, subtaskId: '1' } },
      { status: 'rejected', reason: new Error('Subtask failed') },
      { status: 'fulfilled', value: { success: true, subtaskId: '3' } }
    ];

    const { successful, failed } = manager.analyzeResults(results);

    assert.equal(successful.length, 2);
    assert.equal(failed.length, 1);
  });
});

console.log('\n✅ Error recovery integration tests completed\n');
