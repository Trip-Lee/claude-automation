/**
 * AgentExecutor - Clean abstraction for Claude tool calling
 * Handles conversation management, tool execution, retries, and cost tracking
 */

import Anthropic from '@anthropic-ai/sdk';

export class AgentExecutor {
  constructor(container, config = {}) {
    this.container = container;
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.maxIterations = config.maxIterations || 15;
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 4096;

    this.messages = [];
    this.costTracker = new CostTracker();
    this.iteration = 0;
  }

  /**
   * Run agent with system prompt, user task, and available tools
   * @param {string} systemPrompt - System prompt for agent
   * @param {string} userTask - User's task description
   * @param {Array} tools - Available tools for agent
   * @returns {Object} - Result with response, cost, and conversation
   */
  async run(systemPrompt, userTask, tools) {
    console.log(`\n🤖 Starting agent execution...`);
    console.log(`📝 Task: ${userTask.substring(0, 80)}...`);

    // Initialize conversation
    this.messages = [
      { role: "user", content: userTask }
    ];

    this.iteration = 0;

    // Agent loop
    while (this.iteration < this.maxIterations) {
      this.iteration++;
      console.log(`\n🔄 Iteration ${this.iteration}/${this.maxIterations}`);

      const response = await this.callClaude(systemPrompt, tools);

      // Track costs
      this.costTracker.add(response.usage);
      console.log(`💰 Cost so far: $${this.costTracker.getCost().toFixed(4)}`);

      // Check stop reason
      if (response.stop_reason === "end_turn") {
        console.log(`✅ Agent finished`);
        return this.formatResult(response);
      }

      if (response.stop_reason === "max_tokens") {
        throw new Error('Context limit reached - task too complex');
      }

      if (response.stop_reason === "tool_use") {
        await this.handleToolCalls(response.content);
      }
    }

    throw new Error(`Max iterations (${this.maxIterations}) exceeded`);
  }

  /**
   * Call Claude API with current conversation state
   */
  async callClaude(systemPrompt, tools) {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        tools: tools.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema
        })),
        messages: this.messages
      });

      return response;
    } catch (error) {
      // Handle rate limiting
      if (error.status === 429) {
        console.log(`⏳ Rate limited, waiting 5s...`);
        await new Promise(r => setTimeout(r, 5000));
        return this.callClaude(systemPrompt, tools);
      }

      // Handle low credits - throw a specific error we can catch
      if (error.status === 400 && error.message?.includes('credit balance')) {
        const lowCreditError = new Error('ANTHROPIC_LOW_CREDITS');
        lowCreditError.originalError = error;
        throw lowCreditError;
      }

      throw error;
    }
  }

  /**
   * Handle tool calls from Claude
   */
  async handleToolCalls(content) {
    const toolUseBlocks = content.filter(block => block.type === "tool_use");

    console.log(`🔧 Executing ${toolUseBlocks.length} tool(s)...`);

    // Execute all tool calls (parallel)
    const toolResults = await Promise.all(
      toolUseBlocks.map(block => this.executeTool(block))
    );

    // Add to conversation
    this.messages.push(
      { role: "assistant", content: content },
      { role: "user", content: toolResults }
    );
  }

  /**
   * Execute a single tool with retry logic
   */
  async executeTool(toolUseBlock) {
    const { name, input, id } = toolUseBlock;

    console.log(`  → ${name}(${JSON.stringify(input).substring(0, 60)}...)`);

    try {
      const result = await this.executeWithRetry(
        () => this.container.executeTool(name, input),
        3
      );

      console.log(`  ✓ ${name} succeeded`);

      return {
        type: "tool_result",
        tool_use_id: id,
        content: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      };
    } catch (error) {
      console.log(`  ✗ ${name} failed: ${error.message}`);

      return {
        type: "tool_result",
        tool_use_id: id,
        content: `Error: ${error.message}`,
        is_error: true
      };
    }
  }

  /**
   * Execute function with exponential backoff retry
   */
  async executeWithRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;

        const delay = Math.pow(2, i) * 1000;
        console.log(`    ⏳ Retry ${i + 1}/${maxRetries} in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  /**
   * Format final result
   */
  formatResult(response) {
    // Extract text content from response
    const textContent = response.content
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join('\n');

    return {
      response: textContent,
      cost: this.costTracker.getCost(),
      usage: this.costTracker.getUsage(),
      iterations: this.iteration,
      messages: this.messages
    };
  }

  /**
   * Get current cost
   */
  getCost() {
    return this.costTracker.getCost();
  }

  /**
   * Get conversation history
   */
  getConversation() {
    return this.messages;
  }
}

/**
 * CostTracker - Track Anthropic API costs
 */
class CostTracker {
  constructor() {
    this.usage = {
      input_tokens: 0,
      output_tokens: 0
    };
  }

  add(usage) {
    this.usage.input_tokens += usage.input_tokens || 0;
    this.usage.output_tokens += usage.output_tokens || 0;
  }

  getCost() {
    // Claude Sonnet 4 pricing (as of 2025)
    const inputCost = (this.usage.input_tokens / 1_000_000) * 3;    // $3 per MTok
    const outputCost = (this.usage.output_tokens / 1_000_000) * 15;  // $15 per MTok
    return inputCost + outputCost;
  }

  getUsage() {
    return { ...this.usage };
  }
}
