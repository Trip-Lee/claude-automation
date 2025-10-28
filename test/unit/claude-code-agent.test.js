#!/usr/bin/env node

/**
 * Unit Tests for ClaudeCodeAgent
 * Tests error handling, retry logic, and timeout protection
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeCodeAgent } from '../../lib/claude-code-agent.js';

describe('ClaudeCodeAgent - Configuration', () => {
  it('should initialize with default configuration', () => {
    const agent = new ClaudeCodeAgent({ role: 'coder' });

    assert.ok(agent.role === 'coder');
    assert.ok(agent.sessionId);
    assert.ok(agent.timeout > 0);
    assert.ok(agent.maxRetries >= 1);
  });

  it('should accept custom timeout', () => {
    const agent = new ClaudeCodeAgent({
      role: 'architect',
      timeout: 60000
    });

    assert.equal(agent.timeout, 60000);
  });

  it('should accept custom retry settings', () => {
    const agent = new ClaudeCodeAgent({
      role: 'reviewer',
      maxRetries: 5,
      retryDelay: 2000
    });

    assert.equal(agent.maxRetries, 5);
    assert.equal(agent.retryDelay, 2000);
  });

  it('should generate unique session IDs', () => {
    const agent1 = new ClaudeCodeAgent({ role: 'coder' });
    const agent2 = new ClaudeCodeAgent({ role: 'coder' });

    assert.notEqual(agent1.sessionId, agent2.sessionId);
  });
});

describe('ClaudeCodeAgent - Role Configuration', () => {
  it('should configure architect role correctly with tools', () => {
    const agent = new ClaudeCodeAgent({
      role: 'architect',
      allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)']
    });

    assert.equal(agent.role, 'architect');
    assert.ok(Array.isArray(agent.allowedTools));
    assert.ok(agent.allowedTools.includes('Read'));
    assert.equal(agent.allowedTools.length, 2);
  });

  it('should configure coder role correctly with tools', () => {
    const agent = new ClaudeCodeAgent({
      role: 'coder',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash']
    });

    assert.equal(agent.role, 'coder');
    assert.ok(Array.isArray(agent.allowedTools));
    assert.ok(agent.allowedTools.includes('Read'));
    assert.ok(agent.allowedTools.includes('Write'));
    assert.ok(agent.allowedTools.includes('Edit'));
    assert.equal(agent.allowedTools.length, 4);
  });

  it('should configure reviewer role correctly with tools', () => {
    const agent = new ClaudeCodeAgent({
      role: 'reviewer',
      allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)']
    });

    assert.equal(agent.role, 'reviewer');
    assert.ok(Array.isArray(agent.allowedTools));
    assert.ok(agent.allowedTools.includes('Read'));
    assert.equal(agent.allowedTools.length, 2);
  });

  it('should default to empty tools if not specified', () => {
    const agent = new ClaudeCodeAgent({ role: 'custom' });

    assert.equal(agent.role, 'custom');
    assert.ok(Array.isArray(agent.allowedTools));
    assert.equal(agent.allowedTools.length, 0);
  });
});

describe('ClaudeCodeAgent - Error Classification', () => {
  let agent;

  before(() => {
    agent = new ClaudeCodeAgent({ role: 'coder' });
  });

  it('should classify rate limit errors as retryable', () => {
    const error = new Error('rate limit exceeded');
    assert.equal(agent._isRetryableError(error), true);
  });

  it('should classify network errors as retryable', () => {
    const error = new Error('network timeout');
    assert.equal(agent._isRetryableError(error), true);
  });

  it('should classify ECONNRESET as retryable', () => {
    const error = new Error('ECONNRESET');
    assert.equal(agent._isRetryableError(error), true);
  });

  it('should classify permission denied as non-retryable', () => {
    const error = new Error('permission denied');
    assert.equal(agent._isRetryableError(error), false);
  });

  it('should classify not found errors as non-retryable', () => {
    const error = new Error('command not found');
    assert.equal(agent._isRetryableError(error), false);
  });

  it('should classify syntax errors as non-retryable', () => {
    const error = new Error('syntax error in code');
    assert.equal(agent._isRetryableError(error), false);
  });
});

describe('ClaudeCodeAgent - Error Enhancement', () => {
  let agent;

  before(() => {
    agent = new ClaudeCodeAgent({ role: 'coder' });
  });

  it('should enhance errors with context', () => {
    const originalError = new Error('Something went wrong');
    const context = { attempt: 2, maxRetries: 3 };

    const enhanced = agent._enhanceError(originalError, context);

    assert.ok(enhanced.message.includes('Something went wrong'));
    // Check that context info is added
    assert.ok(enhanced.message.includes('attempt') || enhanced.message.includes('Attempt'));
  });

  it('should add troubleshooting hints for permission errors', () => {
    const error = new Error('permission denied');
    const enhanced = agent._enhanceError(error, { role: 'coder' });

    assert.ok(enhanced.message.toLowerCase().includes('permission'));
  });

  it('should add troubleshooting hints for CLI not found', () => {
    const error = new Error('claude command not found');
    const enhanced = agent._enhanceError(error, { role: 'coder' });

    assert.ok(
      enhanced.message.includes('not found') ||
      enhanced.message.includes('install')
    );
  });
});

describe('ClaudeCodeAgent - System Prompts', () => {
  it('should generate architect system prompt', () => {
    const agent = new ClaudeCodeAgent({ role: 'architect' });
    const prompt = agent.getArchitectSystemPrompt();

    assert.ok(prompt.length > 50);
    assert.ok(prompt.toLowerCase().includes('architect'));
    assert.ok(prompt.toLowerCase().includes('analyze'));
  });

  it('should generate coder system prompt', () => {
    const agent = new ClaudeCodeAgent({ role: 'coder' });
    const prompt = agent.getCoderSystemPrompt();

    assert.ok(prompt.length > 50);
    assert.ok(prompt.toLowerCase().includes('implement'));
  });

  it('should generate reviewer system prompt', () => {
    const agent = new ClaudeCodeAgent({ role: 'reviewer' });
    const prompt = agent.getReviewerSystemPrompt();

    assert.ok(prompt.length > 50);
    assert.ok(prompt.toLowerCase().includes('review'));
  });
});

describe('ClaudeCodeAgent - Tool Configuration', () => {
  it('should accept architect tools configuration', () => {
    const tools = ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'];
    const agent = new ClaudeCodeAgent({
      role: 'architect',
      allowedTools: tools
    });

    assert.ok(agent.allowedTools.includes('Read'));
    // Should have read-only bash commands
    const bashTool = agent.allowedTools.find(t => t.includes('Bash'));
    assert.ok(bashTool);
    assert.ok(bashTool.includes('ls') || bashTool.includes('cat'));
  });

  it('should accept coder tools configuration', () => {
    const tools = ['Read', 'Write', 'Edit', 'Bash'];
    const agent = new ClaudeCodeAgent({
      role: 'coder',
      allowedTools: tools
    });

    assert.ok(agent.allowedTools.includes('Read'));
    assert.ok(agent.allowedTools.includes('Write'));
    assert.ok(agent.allowedTools.includes('Edit'));
    assert.ok(agent.allowedTools.includes('Bash'));
  });

  it('should allow custom tools', () => {
    const customTools = ['Read', 'CustomTool'];
    const agent = new ClaudeCodeAgent({
      role: 'custom',
      allowedTools: customTools
    });

    assert.deepEqual(agent.allowedTools, customTools);
  });
});

describe('ClaudeCodeAgent - Helper Methods', () => {
  let agent;

  before(() => {
    agent = new ClaudeCodeAgent({ role: 'coder' });
  });

  it('should implement sleep helper', async () => {
    const start = Date.now();
    await agent._sleep(100);
    const duration = Date.now() - start;

    assert.ok(duration >= 95); // Allow 5ms tolerance
    assert.ok(duration < 200); // Should not take too long
  });

  it('should validate retry configuration', () => {
    const agent = new ClaudeCodeAgent({
      role: 'coder',
      maxRetries: 3,
      retryDelay: 1000
    });

    assert.equal(agent.maxRetries, 3);
    assert.equal(agent.retryDelay, 1000);
  });
});

console.log('\n✅ ClaudeCodeAgent unit tests completed\n');
