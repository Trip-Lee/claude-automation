/**
 * Conversation Context Manager
 *
 * Manages conversation history with prompt caching for cost-efficient
 * multi-turn agent interactions. Captures and caches sn-tools outputs
 * so agents can reference them in later turns.
 */

export class ConversationContext {
  constructor(options = {}) {
    this.messages = [];
    this.snToolsOutputs = new Map(); // Store captured sn-tools outputs
    this.enableCaching = options.enableCaching !== false;
    this.workingDir = options.workingDir || process.cwd();
    this.metadata = {
      taskId: options.taskId || 'unknown',
      startTime: Date.now(),
      turnCount: 0
    };
  }

  /**
   * Add system message (typically agent identity - CACHED)
   */
  addSystem(content) {
    this.messages.push({
      role: 'system',
      content,
      ...(this.enableCaching && {
        cache_control: { type: 'ephemeral' }
      })
    });
  }

  /**
   * Add user message (task instructions - CACHED when appropriate)
   */
  addUser(content, options = {}) {
    const message = {
      role: 'user',
      content
    };

    // Cache long prompts or prompts marked as cacheable
    if (this.enableCaching && (options.cache || content.length > 1000)) {
      message.cache_control = { type: 'ephemeral' };
    }

    this.messages.push(message);
    this.metadata.turnCount++;
  }

  /**
   * Add assistant response
   */
  addAssistant(content) {
    this.messages.push({
      role: 'assistant',
      content: typeof content === 'string' ? content : JSON.stringify(content)
    });
  }

  /**
   * Capture sn-tools command output and add to context
   * This is the key method - it captures bash outputs and makes them available
   * for later reference in cached context
   */
  captureSnToolsOutput(command, output) {
    const commandKey = command.trim();
    this.snToolsOutputs.set(commandKey, {
      command: commandKey,
      output: output.trim(),
      timestamp: Date.now()
    });

    // Add to context as a user message so it's in the conversation history
    const contextMessage = `
📋 Captured sn-tools output:

\`\`\`bash
$ ${commandKey}
${output.trim()}
\`\`\`

This output is now available for you to reference in your analysis.
`;

    this.addUser(contextMessage, { cache: true });
  }

  /**
   * Get all captured sn-tools outputs as formatted text
   * for inclusion in document creation prompts
   */
  getSnToolsOutputsSummary() {
    if (this.snToolsOutputs.size === 0) {
      return '';
    }

    const outputs = Array.from(this.snToolsOutputs.values());
    return `
## Captured sn-tools Command Outputs

You previously ran these commands and captured their outputs:

${outputs.map(({ command, output }) => `
### Command: ${command}

\`\`\`bash
$ ${command}
${output}
\`\`\`
`).join('\n')}

**IMPORTANT:** Include these command outputs in your analysis document.
`;
  }

  /**
   * Get all messages for API call
   */
  getMessages() {
    return [...this.messages];
  }

  /**
   * Get the last N messages
   */
  getRecentMessages(n = 5) {
    return this.messages.slice(-n);
  }

  /**
   * Get conversation statistics
   */
  getStats() {
    const totalChars = this.messages.reduce((sum, msg) =>
      sum + (typeof msg.content === 'string' ? msg.content.length : 0), 0
    );

    const cachedMessages = this.messages.filter(msg => msg.cache_control).length;

    return {
      totalMessages: this.messages.length,
      totalCharacters: totalChars,
      cachedMessages,
      snToolsOutputsCaptured: this.snToolsOutputs.size,
      turnCount: this.metadata.turnCount,
      duration: Date.now() - this.metadata.startTime
    };
  }

  /**
   * Export context for debugging
   */
  export() {
    return {
      metadata: this.metadata,
      messages: this.messages,
      snToolsOutputs: Array.from(this.snToolsOutputs.entries()),
      stats: this.getStats()
    };
  }

  /**
   * Create a summary of the conversation for checkpoints
   */
  getSummary() {
    const stats = this.getStats();
    return `
Conversation Summary:
- Total turns: ${stats.turnCount}
- Messages: ${stats.totalMessages}
- Cached messages: ${stats.cachedMessages}
- sn-tools outputs captured: ${stats.snToolsOutputsCaptured}
- Duration: ${Math.round(stats.duration / 1000)}s
`;
  }
}

/**
 * Task Workflow Definition
 * Defines multi-step workflows for ServiceNow tasks
 */
export class TaskWorkflow {
  constructor(taskId, steps = []) {
    this.taskId = taskId;
    this.steps = steps;
    this.currentStep = 0;
  }

  /**
   * Get current step
   */
  getCurrentStep() {
    return this.steps[this.currentStep] || null;
  }

  /**
   * Move to next step
   */
  nextStep() {
    this.currentStep++;
    return this.getCurrentStep();
  }

  /**
   * Check if workflow is complete
   */
  isComplete() {
    return this.currentStep >= this.steps.length;
  }

  /**
   * Get workflow progress
   */
  getProgress() {
    return {
      current: this.currentStep + 1,
      total: this.steps.length,
      percentage: Math.round(((this.currentStep + 1) / this.steps.length) * 100)
    };
  }
}

/**
 * Workflow Step Types
 */
export const StepType = {
  DATA_GATHERING: 'data_gathering',
  DOCUMENT_CREATION: 'document_creation',
  VALIDATION: 'validation',
  REFINEMENT: 'refinement'
};

/**
 * Create a workflow step
 */
export function createStep(type, config) {
  return {
    type,
    name: config.name,
    prompt: config.prompt,
    validate: config.validate || (() => true),
    onSuccess: config.onSuccess || null,
    onFailure: config.onFailure || null,
    captureSnTools: config.captureSnTools || false
  };
}
