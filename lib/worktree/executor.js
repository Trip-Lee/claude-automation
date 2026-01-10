/**
 * Worktree Executor
 *
 * Executes agents using Claude's native Task tool pattern.
 * This replaces the old DynamicAgentExecutor with a simpler approach
 * that leverages Claude's built-in coordination capabilities.
 *
 * Key features:
 * - Spawns agents via Claude Code CLI in headless mode
 * - Manages shared conversation state
 * - Supports parallel execution
 * - Handles agent handoffs naturally
 */

import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import path from 'path';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';

/**
 * Execution result from an agent
 */
class ExecutionResult {
  constructor(agentName) {
    this.agentName = agentName;
    this.success = false;
    this.response = null;
    this.cost = 0;
    this.duration = 0;
    this.handoff = null;
    this.complete = false;
    this.error = null;
    this.mcpToolCalls = [];
  }

  /**
   * Parse agent response for handoff instructions
   */
  parseHandoff(response) {
    // Look for HANDOFF: [agent-name] pattern
    const handoffMatch = response.match(/HANDOFF:\s*([a-z-]+)/i);
    const reasonMatch = response.match(/REASON:\s*([^\n]+)/i);

    if (handoffMatch) {
      this.handoff = {
        agent: handoffMatch[1].toLowerCase().trim(),
        reason: reasonMatch ? reasonMatch[1].trim() : 'No reason provided'
      };
    }

    // Look for COMPLETE: pattern
    const completeMatch = response.match(/COMPLETE:\s*([^\n]+)/i);
    if (completeMatch) {
      this.complete = true;
      this.completeSummary = completeMatch[1].trim();
    }

    return this;
  }
}

/**
 * Worktree Executor - Executes agents using Claude Code CLI
 */
export class WorktreeExecutor {
  constructor(options = {}) {
    this.workingDir = options.workingDir || process.cwd();
    this.verbose = options.verbose !== false;
    this.timeout = options.timeout || 300000; // 5 minutes default
    this.maxRetries = options.maxRetries || 2;
    this.model = options.model || 'sonnet';

    // MCP configuration
    this.mcpConfigPath = options.mcpConfigPath || this._findMcpConfig();

    // Session management
    this.sessions = new Map();
  }

  /**
   * Execute an agent with the given prompt
   */
  async executeAgent(agent, task, conversation, options = {}) {
    const startTime = Date.now();
    const sessionId = options.sessionId || uuidv4();

    // Register agent in conversation
    conversation.registerAgent(agent.name, {
      capabilities: agent.capabilities,
      model: agent.model
    });

    // Get conversation context for this agent
    const context = conversation.getContextForAgent(agent.name);

    // Build the full prompt
    const fullPrompt = agent.buildPrompt(task, context);

    // Check for pending user messages
    const userMessages = conversation.consumeUserMessages();
    let promptWithUserInput = fullPrompt;
    if (userMessages.length > 0) {
      promptWithUserInput += '\n\n## User Input\n' + userMessages.join('\n');
    }

    if (this.verbose) {
      conversation.addOrchestratorMessage(`Executing agent: ${agent.name}`);
    }

    // Execute via Claude Code CLI
    const result = new ExecutionResult(agent.name);

    try {
      const response = await this._executeClaudeCode(
        promptWithUserInput,
        sessionId,
        agent,
        options
      );

      result.success = true;
      result.response = response.response;
      result.cost = response.cost || 0;
      result.duration = Date.now() - startTime;
      result.mcpToolCalls = response.mcpToolCalls || [];

      // Parse for handoff instructions
      result.parseHandoff(response.response);

      // Add to conversation
      conversation.addAgentMessage(agent.name, response.response, {
        cost: result.cost,
        duration: result.duration,
        mcpToolCalls: result.mcpToolCalls,
        sessionId
      });

      // Record tool results if any
      if (result.mcpToolCalls.length > 0) {
        for (const call of result.mcpToolCalls) {
          conversation.addToolResult(call.toolName || 'mcp-tool', call, agent.name);
        }
      }

      conversation.agentComplete(agent.name, 'completed', {
        handoff: result.handoff,
        complete: result.complete
      });

    } catch (error) {
      result.success = false;
      result.error = error.message;
      result.duration = Date.now() - startTime;

      conversation.addAgentMessage(agent.name, `Error: ${error.message}`, {
        error: true,
        duration: result.duration
      });

      conversation.agentComplete(agent.name, 'failed', { error: error.message });
    }

    return result;
  }

  /**
   * Execute multiple agents in parallel
   */
  async executeParallel(agents, tasks, conversation, options = {}) {
    conversation.addOrchestratorMessage(
      `Starting parallel execution: ${agents.map(a => a.name).join(', ')}`
    );

    const executions = agents.map((agent, index) => {
      const task = Array.isArray(tasks) ? tasks[index] : tasks;
      return this.executeAgent(agent, task, conversation, {
        ...options,
        sessionId: `${options.sessionId || uuidv4()}-${agent.name}`
      });
    });

    const results = await Promise.allSettled(executions);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const failedResult = new ExecutionResult(agents[index].name);
        failedResult.success = false;
        failedResult.error = result.reason?.message || 'Unknown error';
        return failedResult;
      }
    });
  }

  /**
   * Execute a sequence of agents with handoffs
   */
  async executeSequence(initialAgent, task, conversation, registry, options = {}) {
    const maxIterations = options.maxIterations || 10;
    let currentAgent = initialAgent;
    let iteration = 0;
    const results = [];

    conversation.addOrchestratorMessage(
      `Starting agent sequence with: ${currentAgent.name}`
    );

    while (iteration < maxIterations) {
      iteration++;

      if (this.verbose) {
        console.log(chalk.gray(`\n[Iteration ${iteration}/${maxIterations}]`));
      }

      // Execute current agent
      const result = await this.executeAgent(
        currentAgent,
        iteration === 1 ? task : 'Continue with the task based on prior conversation.',
        conversation,
        options
      );

      results.push(result);

      // Check for completion
      if (result.complete) {
        conversation.addOrchestratorMessage(
          `Task completed by ${currentAgent.name}: ${result.completeSummary || 'Done'}`
        );
        break;
      }

      // Check for handoff
      if (result.handoff) {
        const nextAgent = registry.get(result.handoff.agent);

        if (!nextAgent) {
          conversation.addOrchestratorMessage(
            `Unknown handoff target: ${result.handoff.agent}. Routing to reviewer.`
          );
          currentAgent = registry.get('reviewer');
        } else {
          conversation.addOrchestratorMessage(
            `Handoff: ${currentAgent.name} → ${nextAgent.name} (${result.handoff.reason})`
          );
          currentAgent = nextAgent;
        }

        continue;
      }

      // Check for failure
      if (!result.success) {
        conversation.addOrchestratorMessage(
          `Agent ${currentAgent.name} failed. Attempting recovery...`
        );

        // Try to recover by routing to reviewer
        if (currentAgent.name !== 'reviewer') {
          currentAgent = registry.get('reviewer');
          continue;
        } else {
          // Reviewer also failed, stop
          break;
        }
      }

      // No explicit handoff or completion - ask reviewer to assess
      if (iteration > 1) {
        conversation.addOrchestratorMessage(
          `No explicit handoff from ${currentAgent.name}. Routing to reviewer for assessment.`
        );
        currentAgent = registry.get('reviewer');
      }
    }

    if (iteration >= maxIterations) {
      conversation.addOrchestratorMessage(
        `Maximum iterations (${maxIterations}) reached. Stopping.`
      );
    }

    return {
      iterations: iteration,
      results,
      success: results.some(r => r.complete) || results[results.length - 1]?.success,
      totalCost: results.reduce((sum, r) => sum + (r.cost || 0), 0),
      totalDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0)
    };
  }

  /**
   * Execute Claude Code CLI
   */
  async _executeClaudeCode(prompt, sessionId, agent, options = {}) {
    return new Promise((resolve, reject) => {
      const args = [
        '-p', // Print mode (non-interactive)
        '--output-format', 'json',
        '--dangerously-skip-permissions',
        '--session-id', sessionId
      ];

      // Add model
      if (agent.model && agent.model !== 'sonnet') {
        args.push('--model', agent.model);
      }

      // Add MCP config if available
      if (this.mcpConfigPath) {
        args.push('--mcp-config', this.mcpConfigPath);
      }

      // Add working directory
      args.push('--add-dir', this.workingDir);

      // End of options
      args.push('--');

      // Add prompt
      args.push(prompt);

      if (this.verbose) {
        console.log(chalk.gray(`  Spawning claude with ${args.length} args...`));
      }

      const claudeProcess = spawn('claude', args, {
        cwd: this.workingDir,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        claudeProcess.kill('SIGTERM');
        setTimeout(() => {
          if (!claudeProcess.killed) {
            claudeProcess.kill('SIGKILL');
          }
        }, 5000);
      }, options.timeout || this.timeout);

      claudeProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      claudeProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        if (this.verbose && stderr.includes('[MCP')) {
          // Log MCP activity
          console.log(chalk.gray(`  ${data.toString().trim()}`));
        }
      });

      claudeProcess.on('close', (code) => {
        clearTimeout(timeoutId);

        if (timedOut) {
          reject(new Error(`Claude Code timed out after ${this.timeout}ms`));
          return;
        }

        if (code !== 0) {
          reject(new Error(`Claude Code exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);

          if (result.is_error) {
            reject(new Error(result.result || 'Unknown error'));
            return;
          }

          // Extract MCP tool calls from response
          const mcpToolCalls = this._extractMcpToolCalls(result);

          resolve({
            response: result.result,
            cost: result.total_cost_usd || 0,
            sessionId: result.session_id || sessionId,
            numTurns: result.num_turns || 1,
            mcpToolCalls
          });

        } catch (error) {
          reject(new Error(`Failed to parse Claude Code output: ${error.message}`));
        }
      });

      claudeProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to spawn Claude Code: ${error.message}`));
      });
    });
  }

  /**
   * Extract MCP tool calls from response
   */
  _extractMcpToolCalls(result) {
    const toolCalls = [];
    const responseStr = typeof result.result === 'string'
      ? result.result
      : JSON.stringify(result.result);

    // Known MCP tool names
    const mcpToolNames = [
      'trace_component_impact',
      'trace_table_dependencies',
      'trace_full_lineage',
      'validate_change_impact',
      'query_table_schema',
      'analyze_script_crud',
      'refresh_dependency_cache'
    ];

    // Look for _trace metadata
    const tracePattern = /"_trace"\s*:\s*\{([^}]+)\}/g;
    let match;
    while ((match = tracePattern.exec(responseStr)) !== null) {
      try {
        const traceContent = `{${match[1]}}`;
        const trace = JSON.parse(traceContent);
        toolCalls.push({
          traceId: trace.id,
          executionTimeMs: trace.executionTimeMs,
          timestamp: trace.timestamp,
          failed: trace.failed || false
        });
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Look for tool mentions
    for (const toolName of mcpToolNames) {
      if (responseStr.includes(toolName)) {
        const existing = toolCalls.find(t => t.toolName === toolName);
        if (!existing) {
          toolCalls.push({
            toolName,
            detected: true
          });
        }
      }
    }

    return toolCalls;
  }

  /**
   * Find MCP config file
   */
  _findMcpConfig() {
    const locations = [
      path.join(this.workingDir, 'mcp-config.json'),
      path.join(this.workingDir, '.mcp-config.json'),
      path.join(process.cwd(), 'mcp-config.json')
    ];

    for (const loc of locations) {
      if (existsSync(loc)) {
        return loc;
      }
    }

    return null;
  }

  /**
   * Clean up sessions
   */
  async cleanup() {
    this.sessions.clear();
  }
}

export default WorktreeExecutor;
