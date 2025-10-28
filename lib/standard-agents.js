/**
 * Standard Agents - Default agent configurations
 *
 * Defines the standard set of agents available in the system.
 * Can be extended or customized per project.
 */

import { ClaudeCodeAgent } from './claude-code-agent.js';

/**
 * Register all standard agents with the registry
 * @param {AgentRegistry} registry - Agent registry to populate
 */
export function registerStandardAgents(registry) {
  // ARCHITECT - Analysis & Planning
  registry.register({
    name: 'architect',
    description: 'Analyzes project structure, creates implementation plans, provides technical guidance',
    capabilities: ['analysis', 'planning', 'architecture', 'design'],
    tools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
    estimatedCost: 0.01, // Reduced cost with Haiku
    metadata: {
      color: 'magenta',
      icon: '🏗️',
      readOnly: true
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'architect',
      model: 'haiku', // Use Haiku for faster analysis
      allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
      systemPrompt: 'You are an architect who analyzes code and creates implementation plans. Focus on clarity and brevity.',
      ...config
    })
  });

  // CODER - Implementation
  registry.register({
    name: 'coder',
    description: 'Implements code changes, writes tests, fixes bugs, refactors code',
    capabilities: ['implementation', 'coding', 'testing', 'debugging', 'refactoring'],
    tools: ['Read', 'Write', 'Edit', 'Bash'],
    estimatedCost: 0.04,
    metadata: {
      color: 'green',
      icon: '👨‍💻',
      readOnly: false
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'coder',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
      systemPrompt: 'You are a coder who implements changes carefully. Write clean, tested code.',
      ...config
    })
  });

  // REVIEWER - Quality Assurance
  registry.register({
    name: 'reviewer',
    description: 'Reviews code quality, validates requirements, provides actionable feedback',
    capabilities: ['review', 'quality-assurance', 'validation', 'feedback'],
    tools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
    estimatedCost: 0.01, // Reduced cost with Haiku
    metadata: {
      color: 'yellow',
      icon: '👁️',
      readOnly: true
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'reviewer',
      model: 'haiku', // Use Haiku for pattern matching reviews
      allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
      systemPrompt: 'You are a reviewer who checks code quality thoroughly but fairly. Be specific in feedback.',
      ...config
    })
  });

  // SECURITY SCANNER - Security Analysis
  registry.register({
    name: 'security',
    description: 'Scans code for security vulnerabilities, validates security best practices',
    capabilities: ['security', 'scanning', 'vulnerability-detection', 'compliance'],
    tools: ['Read', 'Bash(grep:*,find:*)'],
    estimatedCost: 0.015,
    metadata: {
      color: 'red',
      icon: '🔒',
      readOnly: true
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'security',
      allowedTools: ['Read', 'Bash(grep:*,find:*)'],
      systemPrompt: 'You are a security expert who identifies vulnerabilities. Focus on critical issues.',
      ...config
    })
  });

  // DOCUMENTER - Documentation
  registry.register({
    name: 'documenter',
    description: 'Writes and updates documentation, README files, code comments',
    capabilities: ['documentation', 'writing', 'explanation'],
    tools: ['Read', 'Write', 'Edit'],
    estimatedCost: 0.025,
    metadata: {
      color: 'blue',
      icon: '📝',
      readOnly: false
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'documenter',
      allowedTools: ['Read', 'Write', 'Edit'],
      systemPrompt: 'You are a documentation specialist. Write clear, concise documentation.',
      ...config
    })
  });

  // TESTER - Test Engineering
  registry.register({
    name: 'tester',
    description: 'Writes comprehensive tests, identifies edge cases, validates test coverage',
    capabilities: ['testing', 'test-design', 'edge-case-analysis', 'coverage'],
    tools: ['Read', 'Write', 'Edit', 'Bash'],
    estimatedCost: 0.03,
    metadata: {
      color: 'cyan',
      icon: '🧪',
      readOnly: false
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'tester',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
      systemPrompt: 'You are a test engineer who writes comprehensive tests. Think about edge cases.',
      ...config
    })
  });

  // PERFORMANCE - Performance Analysis
  registry.register({
    name: 'performance',
    description: 'Analyzes performance bottlenecks, suggests optimizations',
    capabilities: ['performance', 'profiling', 'optimization', 'analysis'],
    tools: ['Read', 'Bash'],
    estimatedCost: 0.02,
    metadata: {
      color: 'yellow',
      icon: '⚡',
      readOnly: true
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'performance',
      allowedTools: ['Read', 'Bash'],
      systemPrompt: 'You are a performance expert who identifies bottlenecks. Focus on measurable improvements.',
      ...config
    })
  });

  return registry;
}

/**
 * Get default agent sequence for common task types
 */
export const DEFAULT_SEQUENCES = {
  // Full implementation with all checks
  full: ['architect', 'coder', 'reviewer'],

  // Analysis only (no code changes)
  analysis: ['architect', 'reviewer'],

  // Simple fix (skip planning)
  quickfix: ['coder', 'reviewer'],

  // Security-focused implementation
  secure: ['architect', 'security', 'coder', 'security', 'reviewer'],

  // Documentation task
  docs: ['architect', 'documenter', 'reviewer'],

  // Test-focused task
  testing: ['architect', 'tester', 'reviewer'],

  // Performance optimization
  performance: ['architect', 'performance', 'coder', 'performance', 'reviewer']
};

/**
 * Get recommended agents for a task based on keywords
 * @param {string} task - Task description
 * @returns {Array<string>} - Recommended agent names
 */
export function recommendAgents(task) {
  const taskLower = task.toLowerCase();

  // Security-critical
  if (taskLower.includes('auth') || taskLower.includes('security') ||
      taskLower.includes('password') || taskLower.includes('token')) {
    return DEFAULT_SEQUENCES.secure;
  }

  // Documentation
  if (taskLower.includes('document') || taskLower.includes('readme') ||
      taskLower.includes('comment') || taskLower.includes('explain')) {
    return DEFAULT_SEQUENCES.docs;
  }

  // Testing
  if (taskLower.includes('test') && !taskLower.includes('fix')) {
    return DEFAULT_SEQUENCES.testing;
  }

  // Performance
  if (taskLower.includes('optimize') || taskLower.includes('performance') ||
      taskLower.includes('speed') || taskLower.includes('slow')) {
    return DEFAULT_SEQUENCES.performance;
  }

  // Analysis only
  if (taskLower.includes('analyze') || taskLower.includes('review') ||
      taskLower.includes('assess') || taskLower.includes('evaluate')) {
    if (!taskLower.includes('implement') && !taskLower.includes('fix') &&
        !taskLower.includes('add') && !taskLower.includes('create')) {
      return DEFAULT_SEQUENCES.analysis;
    }
  }

  // Quick fix
  if (taskLower.includes('fix') && (taskLower.includes('typo') ||
      taskLower.includes('simple') || taskLower.includes('quick'))) {
    return DEFAULT_SEQUENCES.quickfix;
  }

  // Default: full sequence
  return DEFAULT_SEQUENCES.full;
}
