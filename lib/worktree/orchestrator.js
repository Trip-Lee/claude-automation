/**
 * Worktree Orchestrator
 *
 * Lightweight coordinator that leverages Claude's native Task tool patterns
 * for multi-agent collaboration. This replaces the heavyweight DynamicAgentExecutor
 * with a simpler, more efficient approach.
 *
 * Key design principles:
 * 1. Claude orchestrates agents natively via Task tool
 * 2. Shared conversation for agent collaboration
 * 3. Real-time user visibility and interaction
 * 4. Progressive context building (not condensed)
 */

import { AgentConversation } from './agent-conversation.js';
import { WorktreeAgentRegistry } from './agent-registry.js';
import { WorktreeExecutor } from './executor.js';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Orchestration strategies
 */
export const OrchestratorStrategy = {
  // Single agent handles everything
  SINGLE: 'single',

  // Sequential agents with handoffs
  SEQUENTIAL: 'sequential',

  // Parallel execution then merge
  PARALLEL: 'parallel',

  // Architect plans, then parallel execution
  ARCHITECT_LED: 'architect_led',

  // Auto-select based on task analysis
  AUTO: 'auto'
};

/**
 * Task complexity levels
 */
export const TaskComplexity = {
  SIMPLE: 'simple',       // Single agent, straightforward
  MODERATE: 'moderate',   // 2-3 agents, some coordination
  COMPLEX: 'complex',     // Multiple agents, heavy coordination
  EXPLORATORY: 'exploratory' // Needs investigation first
};

/**
 * Worktree Orchestrator
 */
export class WorktreeOrchestrator {
  constructor(options = {}) {
    this.workingDir = options.workingDir || process.cwd();
    this.outputDir = options.outputDir || path.join(this.workingDir, '.claude-worktree');
    this.verbose = options.verbose !== false;
    this.strategy = options.strategy || OrchestratorStrategy.AUTO;
    this.model = options.model || 'sonnet';

    // Initialize components
    this.registry = new WorktreeAgentRegistry({
      customAgents: options.customAgents
    });

    this.executor = new WorktreeExecutor({
      workingDir: this.workingDir,
      verbose: this.verbose,
      timeout: options.timeout || 300000,
      model: this.model,
      mcpConfigPath: options.mcpConfigPath
    });

    // Active conversations
    this.conversations = new Map();
    this.activeConversation = null;

    // Event handlers for user interaction
    this.userInputHandler = options.userInputHandler || null;
  }

  /**
   * Execute a task with automatic strategy selection
   */
  async execute(taskDescription, options = {}) {
    const strategy = options.strategy || this.strategy;

    // Create conversation
    const conversation = new AgentConversation({
      outputDir: this.outputDir,
      verbose: this.verbose,
      realTimeOutput: options.realTimeOutput !== false
    });

    this.activeConversation = conversation;
    this.conversations.set(conversation.conversationId, conversation);

    // Start task
    conversation.startTask(taskDescription, {
      strategy,
      workingDir: this.workingDir
    });

    try {
      let result;

      // Select strategy
      const selectedStrategy = strategy === OrchestratorStrategy.AUTO
        ? await this._analyzeAndSelectStrategy(taskDescription, conversation)
        : strategy;

      conversation.addOrchestratorMessage(`Using strategy: ${selectedStrategy}`);

      switch (selectedStrategy) {
        case OrchestratorStrategy.SINGLE:
          result = await this._executeSingle(taskDescription, conversation, options);
          break;

        case OrchestratorStrategy.SEQUENTIAL:
          result = await this._executeSequential(taskDescription, conversation, options);
          break;

        case OrchestratorStrategy.PARALLEL:
          result = await this._executeParallel(taskDescription, conversation, options);
          break;

        case OrchestratorStrategy.ARCHITECT_LED:
          result = await this._executeArchitectLed(taskDescription, conversation, options);
          break;

        default:
          throw new Error(`Unknown strategy: ${selectedStrategy}`);
      }

      // Complete conversation
      const summary = conversation.complete(result);

      // Save conversation
      if (options.save !== false) {
        await conversation.save();
      }

      return {
        success: true,
        conversationId: conversation.conversationId,
        result,
        summary
      };

    } catch (error) {
      conversation.fail(error);

      if (options.save !== false) {
        await conversation.save();
      }

      return {
        success: false,
        conversationId: conversation.conversationId,
        error: error.message
      };
    }
  }

  /**
   * Execute with a specific agent
   */
  async executeWithAgent(agentName, taskDescription, options = {}) {
    const agent = this.registry.get(agentName);
    if (!agent) {
      throw new Error(`Unknown agent: ${agentName}`);
    }

    const conversation = new AgentConversation({
      outputDir: this.outputDir,
      verbose: this.verbose,
      realTimeOutput: options.realTimeOutput !== false
    });

    this.activeConversation = conversation;
    this.conversations.set(conversation.conversationId, conversation);

    conversation.startTask(taskDescription, {
      strategy: OrchestratorStrategy.SINGLE,
      agent: agentName
    });

    try {
      const result = await this.executor.executeAgent(
        agent,
        taskDescription,
        conversation,
        options
      );

      const summary = conversation.complete(result);

      if (options.save !== false) {
        await conversation.save();
      }

      return {
        success: result.success,
        conversationId: conversation.conversationId,
        result,
        summary
      };

    } catch (error) {
      conversation.fail(error);
      throw error;
    }
  }

  /**
   * Execute ServiceNow-specific task
   */
  async executeServiceNowTask(taskDescription, options = {}) {
    // Determine which SN agent is most appropriate
    const taskLower = taskDescription.toLowerCase();
    let startAgent = 'sn-api';

    if (taskLower.includes('ui') || taskLower.includes('portal') || taskLower.includes('widget')) {
      startAgent = 'sn-ui';
    } else if (taskLower.includes('script') || taskLower.includes('business rule') || taskLower.includes('client script')) {
      startAgent = 'sn-scripting';
    } else if (taskLower.includes('integration') || taskLower.includes('rest') || taskLower.includes('soap')) {
      startAgent = 'sn-integration';
    } else if (taskLower.includes('security') || taskLower.includes('acl') || taskLower.includes('permission')) {
      startAgent = 'sn-security';
    }

    const conversation = new AgentConversation({
      outputDir: this.outputDir,
      verbose: this.verbose,
      realTimeOutput: options.realTimeOutput !== false
    });

    this.activeConversation = conversation;
    this.conversations.set(conversation.conversationId, conversation);

    conversation.startTask(taskDescription, {
      strategy: OrchestratorStrategy.SEQUENTIAL,
      domain: 'servicenow',
      startAgent
    });

    try {
      // Start with selected SN agent, allow handoffs within SN domain
      const initialAgent = this.registry.get(startAgent);

      const result = await this.executor.executeSequence(
        initialAgent,
        taskDescription,
        conversation,
        this.registry,
        {
          ...options,
          maxIterations: options.maxIterations || 8
        }
      );

      const summary = conversation.complete(result);

      if (options.save !== false) {
        await conversation.save();
      }

      return {
        success: result.success,
        conversationId: conversation.conversationId,
        result,
        summary
      };

    } catch (error) {
      conversation.fail(error);
      throw error;
    }
  }

  /**
   * Continue an existing conversation
   */
  async continueConversation(conversationId, userMessage, options = {}) {
    let conversation = this.conversations.get(conversationId);

    // Try to load from disk if not in memory
    if (!conversation) {
      const convPath = path.join(this.outputDir, `conversation-${conversationId}.json`);
      try {
        conversation = await AgentConversation.load(convPath);
        this.conversations.set(conversationId, conversation);
      } catch (error) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }
    }

    // Add user message
    conversation.queueUserMessage(userMessage);
    conversation.status = 'running';
    this.activeConversation = conversation;

    // Determine which agent should respond
    const lastAgent = conversation.currentAgent || 'reviewer';
    const agent = this.registry.get(lastAgent);

    try {
      const result = await this.executor.executeAgent(
        agent,
        'Continue with the conversation based on user input.',
        conversation,
        options
      );

      if (options.save !== false) {
        await conversation.save();
      }

      return {
        success: result.success,
        conversationId,
        result
      };

    } catch (error) {
      conversation.addOrchestratorMessage(`Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Inject a message into the active conversation
   */
  injectUserMessage(message) {
    if (!this.activeConversation) {
      throw new Error('No active conversation');
    }

    this.activeConversation.queueUserMessage(message);
    return true;
  }

  /**
   * Get current conversation state for UI
   */
  getConversationState(conversationId = null) {
    const conversation = conversationId
      ? this.conversations.get(conversationId)
      : this.activeConversation;

    if (!conversation) {
      return null;
    }

    return {
      conversationId: conversation.conversationId,
      status: conversation.status,
      taskDescription: conversation.taskDescription,
      currentAgent: conversation.currentAgent,
      totalCost: conversation.totalCost,
      messageCount: conversation.messages.length,
      messages: conversation.getFullConversation(),
      agents: Array.from(conversation.agents.entries()).map(([name, data]) => ({
        name,
        status: data.status,
        messageCount: data.messageCount
      }))
    };
  }

  /**
   * List all conversations
   */
  async listConversations() {
    const conversations = [];

    // In-memory conversations
    for (const [id, conv] of this.conversations) {
      conversations.push({
        conversationId: id,
        status: conv.status,
        taskDescription: conv.taskDescription,
        messageCount: conv.messages.length,
        source: 'memory'
      });
    }

    // Saved conversations
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      const files = await fs.readdir(this.outputDir);

      for (const file of files) {
        if (file.endsWith('.json') && file.startsWith('conversation-')) {
          const id = file.replace('conversation-', '').replace('.json', '');

          // Skip if already in memory
          if (this.conversations.has(id)) continue;

          try {
            const content = await fs.readFile(path.join(this.outputDir, file), 'utf-8');
            const data = JSON.parse(content);

            conversations.push({
              conversationId: id,
              status: data.status,
              taskDescription: data.taskDescription,
              messageCount: data.messages?.length || 0,
              source: 'disk',
              savedAt: data.savedAt
            });
          } catch (e) {
            // Skip invalid files
          }
        }
      }
    } catch (e) {
      // Output dir doesn't exist yet
    }

    return conversations;
  }

  /**
   * Analyze task and select best strategy
   */
  async _analyzeAndSelectStrategy(taskDescription, conversation) {
    const taskLower = taskDescription.toLowerCase();

    // Simple heuristics for strategy selection
    const complexity = this._assessComplexity(taskDescription);

    conversation.addOrchestratorMessage(`Task complexity: ${complexity}`);

    switch (complexity) {
      case TaskComplexity.SIMPLE:
        return OrchestratorStrategy.SINGLE;

      case TaskComplexity.MODERATE:
        return OrchestratorStrategy.SEQUENTIAL;

      case TaskComplexity.COMPLEX:
        return OrchestratorStrategy.ARCHITECT_LED;

      case TaskComplexity.EXPLORATORY:
        return OrchestratorStrategy.SEQUENTIAL;

      default:
        return OrchestratorStrategy.SEQUENTIAL;
    }
  }

  /**
   * Assess task complexity
   */
  _assessComplexity(taskDescription) {
    const taskLower = taskDescription.toLowerCase();
    const words = taskDescription.split(/\s+/).length;

    // Complexity indicators
    const complexIndicators = [
      'multiple', 'several', 'many', 'all', 'entire',
      'refactor', 'migrate', 'redesign', 'overhaul',
      'integration', 'system-wide', 'cross-cutting'
    ];

    const moderateIndicators = [
      'update', 'modify', 'change', 'add', 'remove',
      'fix', 'bug', 'issue', 'error'
    ];

    const exploratoryIndicators = [
      'investigate', 'analyze', 'understand', 'explore',
      'find', 'search', 'why', 'how does'
    ];

    const hasComplex = complexIndicators.some(i => taskLower.includes(i));
    const hasModerate = moderateIndicators.some(i => taskLower.includes(i));
    const hasExploratory = exploratoryIndicators.some(i => taskLower.includes(i));

    if (hasExploratory) {
      return TaskComplexity.EXPLORATORY;
    }

    if (hasComplex || words > 50) {
      return TaskComplexity.COMPLEX;
    }

    if (hasModerate) {
      return TaskComplexity.MODERATE;
    }

    return TaskComplexity.SIMPLE;
  }

  /**
   * Execute with single agent
   */
  async _executeSingle(taskDescription, conversation, options) {
    // Select best agent for task
    const agentName = this._selectBestAgent(taskDescription);
    const agent = this.registry.get(agentName);

    conversation.addOrchestratorMessage(`Selected agent: ${agentName}`);

    return await this.executor.executeAgent(
      agent,
      taskDescription,
      conversation,
      options
    );
  }

  /**
   * Execute with sequential agents
   */
  async _executeSequential(taskDescription, conversation, options) {
    // Start with architect or coder based on task
    const startAgent = this._selectStartAgent(taskDescription);
    const agent = this.registry.get(startAgent);

    return await this.executor.executeSequence(
      agent,
      taskDescription,
      conversation,
      this.registry,
      {
        ...options,
        maxIterations: options.maxIterations || 10
      }
    );
  }

  /**
   * Execute with parallel agents
   */
  async _executeParallel(taskDescription, conversation, options) {
    // For parallel, we need to split the task
    // This is a simplified version - could use architect to split

    const agents = [
      this.registry.get('coder'),
      this.registry.get('reviewer')
    ];

    const results = await this.executor.executeParallel(
      agents,
      taskDescription,
      conversation,
      options
    );

    // Merge results
    return {
      success: results.every(r => r.success),
      results,
      summary: results.map(r => r.response).join('\n\n---\n\n')
    };
  }

  /**
   * Execute with architect leading
   */
  async _executeArchitectLed(taskDescription, conversation, options) {
    const architect = this.registry.get('architect');

    // Phase 1: Architect creates plan
    conversation.addOrchestratorMessage('Phase 1: Architecture planning');

    const planResult = await this.executor.executeAgent(
      architect,
      `Analyze this task and create an implementation plan with clear steps. Identify which agents should handle each step. Task: ${taskDescription}`,
      conversation,
      options
    );

    if (!planResult.success) {
      return planResult;
    }

    // Phase 2: Execute plan
    conversation.addOrchestratorMessage('Phase 2: Executing plan');

    return await this.executor.executeSequence(
      this.registry.get('coder'),
      'Execute the implementation plan created by the architect.',
      conversation,
      this.registry,
      {
        ...options,
        maxIterations: options.maxIterations || 10
      }
    );
  }

  /**
   * Select best agent for a task
   */
  _selectBestAgent(taskDescription) {
    const taskLower = taskDescription.toLowerCase();

    // ServiceNow specific
    if (taskLower.includes('servicenow') || taskLower.includes('snow')) {
      if (taskLower.includes('ui') || taskLower.includes('portal')) return 'sn-ui';
      if (taskLower.includes('script')) return 'sn-scripting';
      if (taskLower.includes('api') || taskLower.includes('rest')) return 'sn-api';
      if (taskLower.includes('security')) return 'sn-security';
      return 'sn-integration';
    }

    // General tasks
    if (taskLower.includes('review') || taskLower.includes('check')) return 'reviewer';
    if (taskLower.includes('document') || taskLower.includes('readme')) return 'documenter';
    if (taskLower.includes('design') || taskLower.includes('architect')) return 'architect';

    return 'coder';
  }

  /**
   * Select starting agent for sequential execution
   */
  _selectStartAgent(taskDescription) {
    const taskLower = taskDescription.toLowerCase();

    // Complex tasks benefit from architect first
    if (taskLower.includes('design') || taskLower.includes('plan') ||
        taskLower.includes('architect') || taskLower.includes('refactor')) {
      return 'architect';
    }

    // Review tasks
    if (taskLower.includes('review') || taskLower.includes('audit')) {
      return 'reviewer';
    }

    // Default to coder
    return 'coder';
  }

  /**
   * Register event handler for user input
   */
  onUserInput(handler) {
    this.userInputHandler = handler;
  }

  /**
   * Register event listener on active conversation
   */
  on(event, handler) {
    if (this.activeConversation) {
      this.activeConversation.on(event, handler);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.executor.cleanup();
    this.conversations.clear();
    this.activeConversation = null;
  }
}

export default WorktreeOrchestrator;
