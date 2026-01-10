/**
 * Worktree Compatibility Layer
 *
 * Provides backward compatibility adapters that allow existing code
 * to work with both the old multi-agent system and the new worktree system.
 *
 * This enables gradual migration without breaking existing tests.
 */

import { WorktreeOrchestrator, OrchestratorStrategy } from './orchestrator.js';
import { AgentConversation, MessageRole } from './agent-conversation.js';
import { WorktreeAgentRegistry, WorktreeAgent } from './agent-registry.js';
import { WorktreeExecutor } from './executor.js';

/**
 * Adapter that makes WorktreeOrchestrator compatible with the old Orchestrator interface
 */
export class OrchestratorAdapter {
  constructor(githubToken, anthropicApiKey) {
    // Note: worktree system doesn't need these directly (uses Claude CLI)
    this.githubToken = githubToken;
    this.anthropicApiKey = anthropicApiKey;

    this.orchestrator = new WorktreeOrchestrator({
      verbose: true
    });
  }

  /**
   * Execute a task (old interface)
   * @param {string} project - Project name
   * @param {string} description - Task description
   * @returns {Promise<Object>} - Execution result
   */
  async executeTask(project, description) {
    const result = await this.orchestrator.execute(description, {
      realTimeOutput: true,
      save: true
    });

    return {
      success: result.success,
      taskId: result.conversationId,
      branchName: `worktree-${result.conversationId}`,
      pr: null, // Worktree doesn't auto-create PRs
      error: result.error
    };
  }

  /**
   * Cleanup (old interface)
   */
  async cleanupAll() {
    await this.orchestrator.cleanup();
  }
}

/**
 * Adapter that makes WorktreeAgentRegistry compatible with the old AgentRegistry interface
 */
export class AgentRegistryAdapter {
  constructor() {
    this.worktreeRegistry = new WorktreeAgentRegistry();
    this._agents = new Map();

    // Pre-populate with agents that match old interface
    this._initializeAgents();
  }

  _initializeAgents() {
    const agentNames = ['architect', 'coder', 'reviewer', 'documenter',
                       'sn-api', 'sn-ui', 'sn-scripting', 'sn-integration', 'sn-security'];

    for (const name of agentNames) {
      const worktreeAgent = this.worktreeRegistry.get(name);
      if (worktreeAgent) {
        this._agents.set(name, {
          name,
          capabilities: worktreeAgent.capabilities,
          model: worktreeAgent.model,
          factory: (options) => new AgentAdapter(worktreeAgent, options)
        });
      }
    }
  }

  /**
   * Get an agent config (old interface)
   */
  get(name) {
    return this._agents.get(name);
  }

  /**
   * Register an agent (old interface)
   */
  register(name, config) {
    // Convert to worktree agent and register in both places
    const worktreeAgent = new WorktreeAgent({
      name,
      capabilities: config.capabilities || [],
      systemPrompt: config.systemPrompt || '',
      model: config.model || 'sonnet'
    });

    this.worktreeRegistry.register(worktreeAgent);

    this._agents.set(name, {
      name,
      capabilities: worktreeAgent.capabilities,
      model: worktreeAgent.model,
      factory: (options) => new AgentAdapter(worktreeAgent, options)
    });
  }

  /**
   * List all agents (old interface)
   */
  list() {
    return Array.from(this._agents.keys());
  }
}

/**
 * Adapter that makes WorktreeAgent compatible with the old ClaudeCodeAgent interface
 */
export class AgentAdapter {
  constructor(worktreeAgent, options = {}) {
    this.worktreeAgent = worktreeAgent;
    this.options = options;
    this.name = worktreeAgent.name;
    this.sessionId = null;
    this._auditTrail = [];

    // Create executor for this agent
    this.executor = new WorktreeExecutor({
      workingDir: options.workingDir || process.cwd(),
      verbose: options.verbose || false,
      timeout: options.timeout || 300000
    });

    // Create conversation for tracking
    this.conversation = new AgentConversation({
      verbose: options.verbose || false,
      realTimeOutput: false
    });
  }

  /**
   * Query the agent (old interface)
   * @param {string} prompt - The prompt to send
   * @param {Array} conversationHistory - Previous conversation history
   * @returns {Promise<Object>} - Agent response
   */
  async query(prompt, conversationHistory = []) {
    // Convert old conversation history to context
    let context = '';
    if (conversationHistory.length > 0) {
      context = conversationHistory.map(h => {
        if (h.prompt && h.response) {
          return `User: ${h.prompt}\nAssistant: ${typeof h.response === 'string' ? h.response : JSON.stringify(h.response)}`;
        }
        return '';
      }).filter(Boolean).join('\n\n');
    }

    // Build full prompt
    const fullPrompt = context ? `${context}\n\nUser: ${prompt}` : prompt;

    // Execute using worktree executor
    const result = await this.executor.executeAgent(
      this.worktreeAgent,
      fullPrompt,
      this.conversation,
      { sessionId: this.sessionId }
    );

    // Record in audit trail
    this._auditTrail.push({
      type: 'query',
      prompt,
      response: result.response,
      success: result.success,
      cost: result.cost,
      timestamp: new Date().toISOString()
    });

    // Return in format expected by old interface
    return {
      response: result.response,
      success: result.success,
      cost: result.cost || 0,
      mcpToolCalls: result.mcpToolCalls || []
    };
  }

  /**
   * Get audit trail (old interface)
   */
  getAuditTrail() {
    return {
      decisions: this._auditTrail.map(entry => ({
        toJSON: () => entry
      }))
    };
  }

  /**
   * Cleanup
   */
  async cleanup() {
    await this.executor.cleanup();
  }
}

/**
 * Adapter for SimpleTestExecutor to use worktree system
 */
export class TestExecutorAdapter {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.workingDir = options.workingDir || process.cwd();
    this.outputDir = options.outputDir;

    // Use worktree registry
    this.agentRegistry = new AgentRegistryAdapter();

    // Orchestrator for complex tasks
    this.orchestrator = new WorktreeOrchestrator({
      workingDir: this.workingDir,
      verbose: this.verbose
    });
  }

  /**
   * Execute a test task using worktree system
   */
  async executeTask(taskPrompt, options = {}) {
    const testId = options.testId || `test-${Date.now()}`;

    if (this.verbose) {
      console.log(`[TestExecutorAdapter] Starting task: ${testId}`);
    }

    try {
      // Determine strategy based on task
      const strategy = this._detectStrategy(taskPrompt);

      // Execute using worktree orchestrator
      const result = await this.orchestrator.execute(taskPrompt, {
        strategy,
        realTimeOutput: this.verbose,
        save: true
      });

      return {
        success: result.success,
        testId,
        agentName: 'worktree',
        outputDir: this.outputDir,
        result: {
          response: result.result?.response || 'Task completed',
          conversationId: result.conversationId,
          summary: result.summary
        },
        artifacts: [],
        workflowUsed: false,
        worktreeMode: true
      };

    } catch (error) {
      if (this.verbose) {
        console.error(`[TestExecutorAdapter] Task failed: ${error.message}`);
      }

      return {
        success: false,
        testId,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Detect best strategy for a task
   */
  _detectStrategy(taskPrompt) {
    const lower = taskPrompt.toLowerCase();

    if (lower.includes('servicenow') || lower.includes('snow')) {
      return OrchestratorStrategy.SEQUENTIAL;
    }

    if (lower.includes('refactor') || lower.includes('architecture')) {
      return OrchestratorStrategy.ARCHITECT_LED;
    }

    if (lower.includes('review') || lower.includes('test')) {
      return OrchestratorStrategy.PARALLEL;
    }

    return OrchestratorStrategy.AUTO;
  }

  /**
   * Create an agent (compatibility method)
   */
  async createAgent(agentName, options = {}) {
    const agentConfig = this.agentRegistry.get(agentName);
    if (!agentConfig) {
      throw new Error(`Agent not found: ${agentName}`);
    }

    return agentConfig.factory({
      workingDir: options.workingDir || this.workingDir,
      verbose: this.verbose,
      timeout: options.timeout
    });
  }

  /**
   * Cleanup
   */
  async cleanup(testId) {
    await this.orchestrator.cleanup();
  }
}

/**
 * Factory function to create the appropriate system based on environment
 */
export function createAgentSystem(options = {}) {
  const useWorktree = options.useWorktree !== false; // Default to worktree

  if (useWorktree) {
    return {
      orchestrator: new WorktreeOrchestrator(options),
      registry: new WorktreeAgentRegistry(options),
      executor: new WorktreeExecutor(options),
      mode: 'worktree'
    };
  } else {
    // Return adapters that use the old system
    // This path requires the old imports to be available
    return {
      orchestrator: new OrchestratorAdapter(options.githubToken, options.anthropicApiKey),
      registry: new AgentRegistryAdapter(),
      executor: null, // Old system uses different pattern
      mode: 'legacy'
    };
  }
}

export default {
  OrchestratorAdapter,
  AgentRegistryAdapter,
  AgentAdapter,
  TestExecutorAdapter,
  createAgentSystem
};
