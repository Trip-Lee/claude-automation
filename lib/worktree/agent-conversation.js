/**
 * Agent Conversation Manager
 *
 * Manages a shared conversation between agents that:
 * 1. All agents can read and write to
 * 2. Users can view in real-time
 * 3. Users can inject messages into
 * 4. Persists to disk for review
 *
 * This replaces the old ConversationThread with a more interactive model
 * designed for the worktree-based multi-agent system.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

/**
 * Message roles in the conversation
 */
export const MessageRole = {
  SYSTEM: 'system',
  USER: 'user',
  AGENT: 'agent',
  ORCHESTRATOR: 'orchestrator',
  TOOL_RESULT: 'tool_result'
};

/**
 * Agent Conversation - Shared conversation state for multi-agent collaboration
 */
export class AgentConversation extends EventEmitter {
  constructor(options = {}) {
    super();

    this.conversationId = options.conversationId || `conv-${Date.now()}`;
    this.messages = [];
    this.agents = new Map(); // Active agents in conversation
    this.outputDir = options.outputDir || null;
    this.verbose = options.verbose !== false;
    this.realTimeOutput = options.realTimeOutput !== false;

    // Cost tracking
    this.totalCost = 0;
    this.costByAgent = new Map();

    // File cache (shared across agents)
    this.fileCache = new Map();

    // User interaction queue
    this.userMessageQueue = [];
    this.waitingForUser = false;

    // Conversation state
    this.status = 'idle'; // idle, running, paused, completed, failed
    this.currentAgent = null;
    this.taskDescription = null;
  }

  /**
   * Start a new task conversation
   */
  startTask(description, options = {}) {
    this.taskDescription = description;
    this.status = 'running';

    const systemMessage = {
      role: MessageRole.SYSTEM,
      content: `Task started: ${description}`,
      timestamp: new Date().toISOString(),
      metadata: {
        taskId: this.conversationId,
        options
      }
    };

    this.messages.push(systemMessage);
    this.emit('message', systemMessage);
    this.emit('taskStart', { description, conversationId: this.conversationId });

    if (this.realTimeOutput) {
      console.log(chalk.cyan('\n' + '═'.repeat(60)));
      console.log(chalk.cyan.bold('  TASK STARTED'));
      console.log(chalk.cyan('═'.repeat(60)));
      console.log(chalk.white(`  ${description}`));
      console.log(chalk.cyan('═'.repeat(60) + '\n'));
    }

    return this.conversationId;
  }

  /**
   * Add a message from an agent
   */
  addAgentMessage(agentName, content, metadata = {}) {
    const message = {
      role: MessageRole.AGENT,
      agent: agentName,
      content,
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        turn: this.messages.filter(m => m.role === MessageRole.AGENT).length + 1
      }
    };

    this.messages.push(message);
    this.currentAgent = agentName;

    // Track cost
    if (metadata.cost) {
      this.totalCost += metadata.cost;
      const agentCost = this.costByAgent.get(agentName) || 0;
      this.costByAgent.set(agentName, agentCost + metadata.cost);
    }

    this.emit('message', message);
    this.emit('agentMessage', { agent: agentName, content, metadata });

    if (this.realTimeOutput) {
      this._printAgentMessage(agentName, content, metadata);
    }

    return message;
  }

  /**
   * Add a message from the orchestrator
   */
  addOrchestratorMessage(content, metadata = {}) {
    const message = {
      role: MessageRole.ORCHESTRATOR,
      content,
      timestamp: new Date().toISOString(),
      metadata
    };

    this.messages.push(message);
    this.emit('message', message);
    this.emit('orchestratorMessage', { content, metadata });

    if (this.realTimeOutput) {
      console.log(chalk.magenta(`\n[Orchestrator] ${content}`));
    }

    return message;
  }

  /**
   * Add a user message (for user intervention/guidance)
   */
  addUserMessage(content) {
    const message = {
      role: MessageRole.USER,
      content,
      timestamp: new Date().toISOString()
    };

    this.messages.push(message);
    this.emit('message', message);
    this.emit('userMessage', { content });

    if (this.realTimeOutput) {
      console.log(chalk.green(`\n[User] ${content}`));
    }

    return message;
  }

  /**
   * Add a tool result message
   */
  addToolResult(toolName, result, agentName = null) {
    const message = {
      role: MessageRole.TOOL_RESULT,
      tool: toolName,
      agent: agentName,
      content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
      timestamp: new Date().toISOString(),
      metadata: {
        success: result?.success !== false,
        truncated: result?._context_management?.truncated || false
      }
    };

    this.messages.push(message);
    this.emit('message', message);
    this.emit('toolResult', { tool: toolName, result, agent: agentName });

    if (this.realTimeOutput && this.verbose) {
      const status = message.metadata.success ? chalk.green('✓') : chalk.red('✗');
      console.log(chalk.gray(`  ${status} Tool: ${toolName}`));
    }

    return message;
  }

  /**
   * Register an agent joining the conversation
   */
  registerAgent(agentName, agentConfig) {
    this.agents.set(agentName, {
      name: agentName,
      config: agentConfig,
      joinedAt: new Date().toISOString(),
      messageCount: 0
    });

    this.emit('agentJoined', { agent: agentName, config: agentConfig });

    if (this.realTimeOutput) {
      console.log(chalk.yellow(`\n→ Agent '${agentName}' joined the conversation`));
    }
  }

  /**
   * Record agent leaving/completing
   */
  agentComplete(agentName, status = 'completed', result = null) {
    const agent = this.agents.get(agentName);
    if (agent) {
      agent.status = status;
      agent.completedAt = new Date().toISOString();
      agent.result = result;
    }

    this.emit('agentComplete', { agent: agentName, status, result });

    if (this.realTimeOutput) {
      const statusIcon = status === 'completed' ? chalk.green('✓') : chalk.red('✗');
      console.log(chalk.yellow(`\n${statusIcon} Agent '${agentName}' ${status}`));
    }
  }

  /**
   * Get conversation context for an agent
   * This is what gets passed to each agent so they understand prior work
   */
  getContextForAgent(agentName, options = {}) {
    const maxMessages = options.maxMessages || 20;
    const includeToolResults = options.includeToolResults !== false;

    // Filter and format messages
    const relevantMessages = this.messages
      .filter(m => {
        if (m.role === MessageRole.TOOL_RESULT && !includeToolResults) return false;
        return true;
      })
      .slice(-maxMessages);

    // Build context string
    const contextParts = [];

    // Task description
    if (this.taskDescription) {
      contextParts.push(`## Current Task\n${this.taskDescription}`);
    }

    // Active agents
    const activeAgents = Array.from(this.agents.keys());
    if (activeAgents.length > 0) {
      contextParts.push(`## Active Agents\n${activeAgents.join(', ')}`);
    }

    // Conversation history
    if (relevantMessages.length > 0) {
      const historyLines = relevantMessages.map(m => {
        switch (m.role) {
          case MessageRole.AGENT:
            return `**${m.agent}**: ${this._truncate(m.content, 500)}`;
          case MessageRole.USER:
            return `**User**: ${m.content}`;
          case MessageRole.ORCHESTRATOR:
            return `*[Orchestrator]: ${m.content}*`;
          case MessageRole.TOOL_RESULT:
            return `  → Tool(${m.tool}): ${this._truncate(m.content, 200)}`;
          default:
            return `[${m.role}]: ${this._truncate(m.content, 200)}`;
        }
      });

      contextParts.push(`## Conversation History\n${historyLines.join('\n')}`);
    }

    // Pending user messages
    if (this.userMessageQueue.length > 0) {
      contextParts.push(`## Pending User Input\n${this.userMessageQueue.join('\n')}`);
    }

    return contextParts.join('\n\n');
  }

  /**
   * Get full conversation for user viewing
   */
  getFullConversation() {
    return this.messages.map(m => ({
      ...m,
      formattedTime: new Date(m.timestamp).toLocaleTimeString()
    }));
  }

  /**
   * Allow user to queue a message for the next agent
   */
  queueUserMessage(content) {
    this.userMessageQueue.push(content);
    this.addUserMessage(content);
    this.emit('userMessageQueued', { content });
  }

  /**
   * Get and clear pending user messages
   */
  consumeUserMessages() {
    const messages = [...this.userMessageQueue];
    this.userMessageQueue = [];
    return messages;
  }

  /**
   * Check if there are pending user messages
   */
  hasPendingUserMessages() {
    return this.userMessageQueue.length > 0;
  }

  /**
   * Pause conversation to wait for user input
   */
  async waitForUserInput(prompt = 'Waiting for user input...') {
    this.waitingForUser = true;
    this.status = 'paused';

    this.addOrchestratorMessage(prompt);
    this.emit('waitingForUser', { prompt });

    // Return a promise that resolves when user provides input
    return new Promise((resolve) => {
      const handler = ({ content }) => {
        this.waitingForUser = false;
        this.status = 'running';
        this.removeListener('userMessage', handler);
        resolve(content);
      };

      this.on('userMessage', handler);
    });
  }

  /**
   * Mark task as complete
   */
  complete(result = null) {
    this.status = 'completed';

    const summary = {
      conversationId: this.conversationId,
      taskDescription: this.taskDescription,
      totalMessages: this.messages.length,
      totalCost: this.totalCost,
      costByAgent: Object.fromEntries(this.costByAgent),
      agents: Array.from(this.agents.entries()).map(([name, data]) => ({
        name,
        ...data
      })),
      result
    };

    this.addOrchestratorMessage(`Task completed. Total cost: $${this.totalCost.toFixed(4)}`);
    this.emit('taskComplete', summary);

    if (this.realTimeOutput) {
      console.log(chalk.green('\n' + '═'.repeat(60)));
      console.log(chalk.green.bold('  TASK COMPLETED'));
      console.log(chalk.green('═'.repeat(60)));
      console.log(chalk.white(`  Messages: ${this.messages.length}`));
      console.log(chalk.white(`  Cost: $${this.totalCost.toFixed(4)}`));
      console.log(chalk.green('═'.repeat(60) + '\n'));
    }

    return summary;
  }

  /**
   * Mark task as failed
   */
  fail(error) {
    this.status = 'failed';

    this.addOrchestratorMessage(`Task failed: ${error.message || error}`);
    this.emit('taskFailed', { error, conversationId: this.conversationId });

    if (this.realTimeOutput) {
      console.log(chalk.red('\n' + '═'.repeat(60)));
      console.log(chalk.red.bold('  TASK FAILED'));
      console.log(chalk.red('═'.repeat(60)));
      console.log(chalk.white(`  Error: ${error.message || error}`));
      console.log(chalk.red('═'.repeat(60) + '\n'));
    }
  }

  /**
   * Save conversation to disk
   */
  async save(outputPath = null) {
    const targetPath = outputPath || (this.outputDir
      ? path.join(this.outputDir, `conversation-${this.conversationId}.json`)
      : `conversation-${this.conversationId}.json`);

    // Ensure directory exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    const data = {
      conversationId: this.conversationId,
      taskDescription: this.taskDescription,
      status: this.status,
      messages: this.messages,
      agents: Object.fromEntries(this.agents),
      totalCost: this.totalCost,
      costByAgent: Object.fromEntries(this.costByAgent),
      savedAt: new Date().toISOString()
    };

    await fs.writeFile(targetPath, JSON.stringify(data, null, 2));

    // Also save human-readable version
    const readablePath = targetPath.replace('.json', '.md');
    await fs.writeFile(readablePath, this._toMarkdown());

    return targetPath;
  }

  /**
   * Load conversation from disk
   */
  static async load(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    const conversation = new AgentConversation({
      conversationId: data.conversationId
    });

    conversation.taskDescription = data.taskDescription;
    conversation.status = data.status;
    conversation.messages = data.messages;
    conversation.totalCost = data.totalCost;

    for (const [name, agentData] of Object.entries(data.agents)) {
      conversation.agents.set(name, agentData);
    }

    for (const [name, cost] of Object.entries(data.costByAgent)) {
      conversation.costByAgent.set(name, cost);
    }

    return conversation;
  }

  /**
   * Convert conversation to markdown
   */
  _toMarkdown() {
    const lines = [];

    lines.push(`# Agent Conversation: ${this.conversationId}`);
    lines.push(`\n**Task:** ${this.taskDescription}`);
    lines.push(`**Status:** ${this.status}`);
    lines.push(`**Total Cost:** $${this.totalCost.toFixed(4)}`);
    lines.push('');

    lines.push('## Participants');
    for (const [name, data] of this.agents) {
      lines.push(`- **${name}**: ${data.status || 'active'}`);
    }
    lines.push('');

    lines.push('## Conversation');
    lines.push('');

    for (const msg of this.messages) {
      const time = new Date(msg.timestamp).toLocaleTimeString();

      switch (msg.role) {
        case MessageRole.AGENT:
          lines.push(`### ${msg.agent} (${time})`);
          lines.push(msg.content);
          lines.push('');
          break;

        case MessageRole.USER:
          lines.push(`### User (${time})`);
          lines.push(`> ${msg.content}`);
          lines.push('');
          break;

        case MessageRole.ORCHESTRATOR:
          lines.push(`*[${time}] ${msg.content}*`);
          lines.push('');
          break;

        case MessageRole.TOOL_RESULT:
          lines.push(`<details><summary>Tool: ${msg.tool} (${time})</summary>`);
          lines.push('');
          lines.push('```json');
          lines.push(msg.content);
          lines.push('```');
          lines.push('</details>');
          lines.push('');
          break;

        case MessageRole.SYSTEM:
          lines.push(`---`);
          lines.push(`*${msg.content}*`);
          lines.push(`---`);
          lines.push('');
          break;
      }
    }

    return lines.join('\n');
  }

  /**
   * Print agent message in real-time
   */
  _printAgentMessage(agentName, content, metadata) {
    const agentColors = {
      'architect': chalk.blue,
      'coder': chalk.green,
      'reviewer': chalk.yellow,
      'sn-api': chalk.cyan,
      'sn-ui': chalk.magenta,
      'sn-scripting': chalk.green,
      'sn-integration': chalk.yellow,
      'sn-security': chalk.red
    };

    const color = agentColors[agentName] || chalk.white;
    const costStr = metadata.cost ? ` ($${metadata.cost.toFixed(4)})` : '';

    console.log(color('\n┌' + '─'.repeat(58) + '┐'));
    console.log(color(`│ ${agentName.toUpperCase().padEnd(50)}${costStr.padStart(7)} │`));
    console.log(color('└' + '─'.repeat(58) + '┘'));

    // Print content with word wrap
    const maxWidth = 80;
    const words = content.split(' ');
    let line = '';

    for (const word of words) {
      if (line.length + word.length + 1 > maxWidth) {
        console.log(chalk.white(line));
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) {
      console.log(chalk.white(line));
    }
  }

  /**
   * Truncate string
   */
  _truncate(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }
}

export default AgentConversation;
