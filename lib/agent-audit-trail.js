/**
 * Agent Decision Audit Trail
 *
 * Captures and tracks agent decision-making processes including:
 * - Prompt context that led to tool selections
 * - Reasoning chains before and after tool calls
 * - Multi-turn conversation flow
 * - Decision points and alternatives considered
 *
 * Priority 2: Agent Decision Audit Trail Implementation
 */

import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

/**
 * Decision types for categorization
 */
export const DecisionType = {
  TOOL_SELECTION: 'tool_selection',
  PARAMETER_CHOICE: 'parameter_choice',
  WORKFLOW_STEP: 'workflow_step',
  ERROR_RECOVERY: 'error_recovery',
  TASK_COMPLETION: 'task_completion',
  CONTEXT_SWITCH: 'context_switch',
  // MCP-specific decision types
  MCP_TOOL_CALL: 'mcp_tool_call',
  MCP_TOOL_AVOIDANCE: 'mcp_tool_avoidance',
  MCP_BASH_FALLBACK: 'mcp_bash_fallback',
  MCP_LOW_CONFIDENCE: 'mcp_low_confidence',
  MCP_MANUAL_INVESTIGATION: 'mcp_manual_investigation'
};

/**
 * Reasons for MCP tool avoidance
 */
export const McpAvoidanceReason = {
  MCP_NOT_LOADED: 'mcp_not_loaded',
  TOOL_CALL_FAILED: 'tool_call_failed',
  AGENT_CHOSE_BASH: 'agent_chose_bash',
  LOW_CONFIDENCE_FALLBACK: 'low_confidence_fallback',
  PROMPT_MISUNDERSTOOD: 'prompt_misunderstood',
  UNKNOWN: 'unknown'
};

/**
 * Single decision entry in the audit trail
 */
class DecisionEntry {
  constructor(type, agentRole) {
    this.id = `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date().toISOString();
    this.timestampMs = Date.now();
    this.type = type;
    this.agentRole = agentRole;

    // Context that led to this decision
    this.context = {
      promptSummary: null,
      previousActions: [],
      availableTools: [],
      taskState: null
    };

    // The decision itself
    this.decision = {
      action: null,
      target: null,
      parameters: null,
      reasoning: null,
      confidence: null
    };

    // Outcome of the decision
    this.outcome = {
      status: 'pending',
      result: null,
      error: null,
      durationMs: 0
    };

    // Alternatives considered (if known)
    this.alternatives = [];
  }

  /**
   * Set the context that led to this decision
   */
  setContext(contextData) {
    this.context = {
      promptSummary: this.summarizePrompt(contextData.prompt),
      previousActions: contextData.previousActions || [],
      availableTools: contextData.availableTools || [],
      taskState: contextData.taskState || null,
      conversationTurn: contextData.conversationTurn || 0
    };
    return this;
  }

  /**
   * Set the decision details
   */
  setDecision(decisionData) {
    this.decision = {
      action: decisionData.action,
      target: decisionData.target,
      parameters: decisionData.parameters,
      reasoning: decisionData.reasoning,
      confidence: decisionData.confidence
    };
    return this;
  }

  /**
   * Record the outcome of the decision
   */
  recordOutcome(status, result, durationMs) {
    this.outcome = {
      status,
      result: this.summarizeResult(result),
      error: status === 'failed' ? result : null,
      durationMs
    };
    return this;
  }

  /**
   * Add an alternative that was considered
   */
  addAlternative(alternativeData) {
    this.alternatives.push({
      action: alternativeData.action,
      target: alternativeData.target,
      reason_not_chosen: alternativeData.reasonNotChosen
    });
    return this;
  }

  /**
   * Summarize a prompt to a reasonable length
   */
  summarizePrompt(prompt) {
    if (!prompt) return null;
    const maxLength = 500;
    if (prompt.length <= maxLength) return prompt;

    // Extract key parts
    const firstPart = prompt.slice(0, 200);
    const lastPart = prompt.slice(-200);
    return `${firstPart}\n...[${prompt.length - 400} chars truncated]...\n${lastPart}`;
  }

  /**
   * Summarize a result for storage
   */
  summarizeResult(result) {
    if (!result) return null;
    if (typeof result === 'string') {
      return result.length > 500 ? result.slice(0, 500) + '...' : result;
    }
    if (typeof result === 'object') {
      const str = JSON.stringify(result);
      if (str.length > 500) {
        return {
          _summarized: true,
          keys: Object.keys(result),
          success: result.success,
          hasData: !!result.data
        };
      }
      return result;
    }
    return result;
  }

  /**
   * Export to JSON
   */
  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      timestampMs: this.timestampMs,
      type: this.type,
      agentRole: this.agentRole,
      context: this.context,
      decision: this.decision,
      outcome: this.outcome,
      alternatives: this.alternatives
    };
  }
}

/**
 * Agent Audit Trail - Main class for tracking agent decisions
 */
export class AgentAuditTrail extends EventEmitter {
  constructor(options = {}) {
    super();

    this.sessionId = options.sessionId || `audit-${Date.now()}`;
    this.agentRole = options.agentRole || 'unknown';
    this.decisions = [];
    this.maxDecisions = options.maxDecisions || 500;
    this.logDir = options.logDir || null;
    this.verbose = options.verbose !== false;

    // Tracking state
    this.currentTask = null;
    this.conversationTurn = 0;
    this.previousActions = [];

    // Aggregate statistics
    this.stats = {
      totalDecisions: 0,
      byType: {},
      successfulDecisions: 0,
      failedDecisions: 0,
      totalDurationMs: 0,
      toolUsage: {}
    };
  }

  /**
   * Start a new task context
   */
  startTask(taskDescription) {
    this.currentTask = {
      id: `task-${Date.now()}`,
      description: taskDescription,
      startedAt: new Date().toISOString(),
      decisions: []
    };
    this.conversationTurn = 0;
    this.previousActions = [];

    if (this.verbose) {
      console.log(`[AuditTrail] Started task: ${this.currentTask.id}`);
    }

    return this.currentTask.id;
  }

  /**
   * Increment conversation turn
   */
  nextTurn() {
    this.conversationTurn++;
    return this.conversationTurn;
  }

  /**
   * Record a decision
   */
  recordDecision(type, contextData, decisionData) {
    const entry = new DecisionEntry(type, this.agentRole);

    // Add conversation context
    contextData.conversationTurn = this.conversationTurn;
    contextData.previousActions = [...this.previousActions].slice(-5); // Keep last 5

    entry.setContext(contextData);
    entry.setDecision(decisionData);

    this.decisions.push(entry);

    // Track in current task
    if (this.currentTask) {
      this.currentTask.decisions.push(entry.id);
    }

    // Emit event
    this.emit('decision', entry);

    if (this.verbose) {
      console.log(`[AuditTrail] Decision: ${type} - ${decisionData.action}`);
    }

    // Trim old decisions if over limit
    if (this.decisions.length > this.maxDecisions) {
      this.decisions = this.decisions.slice(-this.maxDecisions);
    }

    return entry;
  }

  /**
   * Complete a decision with outcome
   */
  completeDecision(entry, status, result, durationMs) {
    entry.recordOutcome(status, result, durationMs);

    // Update stats
    this.stats.totalDecisions++;
    this.stats.byType[entry.type] = (this.stats.byType[entry.type] || 0) + 1;
    if (status === 'success') {
      this.stats.successfulDecisions++;
    } else if (status === 'failed') {
      this.stats.failedDecisions++;
    }
    this.stats.totalDurationMs += durationMs;

    // Track tool usage
    if (entry.decision.target) {
      this.stats.toolUsage[entry.decision.target] =
        (this.stats.toolUsage[entry.decision.target] || 0) + 1;
    }

    // Add to previous actions
    this.previousActions.push({
      action: entry.decision.action,
      target: entry.decision.target,
      status
    });

    // Emit event
    this.emit('decisionComplete', entry);

    if (this.verbose) {
      console.log(`[AuditTrail] Completed: ${status} (${durationMs}ms)`);
    }

    return entry;
  }

  /**
   * Record a tool selection decision
   */
  recordToolSelection(prompt, toolName, parameters, reasoning) {
    const contextData = {
      prompt,
      availableTools: this.getAvailableTools(),
      taskState: this.currentTask?.description
    };

    const decisionData = {
      action: 'select_tool',
      target: toolName,
      parameters,
      reasoning
    };

    return this.recordDecision(DecisionType.TOOL_SELECTION, contextData, decisionData);
  }

  /**
   * Record an error recovery decision
   */
  recordErrorRecovery(error, recoveryAction, reasoning) {
    const contextData = {
      prompt: `Error: ${error.message}`,
      taskState: 'error_state'
    };

    const decisionData = {
      action: 'recover',
      target: recoveryAction,
      reasoning
    };

    return this.recordDecision(DecisionType.ERROR_RECOVERY, contextData, decisionData);
  }

  /**
   * Record a workflow step decision
   */
  recordWorkflowStep(stepName, prompt, nextAction, reasoning) {
    const contextData = {
      prompt,
      taskState: `workflow_step:${stepName}`
    };

    const decisionData = {
      action: 'execute_step',
      target: stepName,
      parameters: { nextAction },
      reasoning
    };

    return this.recordDecision(DecisionType.WORKFLOW_STEP, contextData, decisionData);
  }

  /**
   * Record an MCP tool call
   */
  recordMcpToolCall(toolName, params, reasoning) {
    const contextData = {
      prompt: `MCP tool call: ${toolName}`,
      availableTools: this.getAvailableTools(),
      taskState: 'mcp_tool_execution'
    };

    const decisionData = {
      action: 'mcp_tool_call',
      target: toolName,
      parameters: params,
      reasoning: reasoning || `Calling MCP tool ${toolName}`
    };

    return this.recordDecision(DecisionType.MCP_TOOL_CALL, contextData, decisionData);
  }

  /**
   * Record MCP tool call completion with result analysis
   */
  completeMcpToolCall(entry, result, durationMs) {
    const status = result?.success ? 'success' : 'failed';

    // Extract confidence information
    const confidence = result?.data?.metadata?.confidence;
    const trustworthy = result?.data?.metadata?.interpretation?.trustworthy;
    const suggestions = result?.data?.metadata?.suggestions || [];

    const enhancedResult = {
      success: result?.success,
      confidence: confidence?.level,
      confidenceScore: confidence?.score,
      trustworthy,
      suggestionsCount: suggestions.length,
      truncated: result?.data?._context_management?.truncated || false,
      responseSizeKB: result?.data?._context_management?.original_size_kb
    };

    this.completeDecision(entry, status, enhancedResult, durationMs);

    // If low confidence, record that as a separate decision point
    if (confidence?.level === 'LOW' || trustworthy === false) {
      this.recordLowConfidenceResponse(entry.decision.target, confidence, suggestions);
    }

    return entry;
  }

  /**
   * Record when an MCP tool returns low confidence
   */
  recordLowConfidenceResponse(toolName, confidence, suggestions) {
    const contextData = {
      prompt: `MCP tool ${toolName} returned low confidence`,
      taskState: 'mcp_low_confidence'
    };

    const decisionData = {
      action: 'handle_low_confidence',
      target: toolName,
      parameters: {
        confidenceLevel: confidence?.level,
        confidenceScore: confidence?.score,
        suggestionsProvided: suggestions?.length || 0,
        suggestions: suggestions?.slice(0, 3).map(s => s.action)
      },
      reasoning: 'MCP tool returned LOW confidence, may need manual investigation'
    };

    return this.recordDecision(DecisionType.MCP_LOW_CONFIDENCE, contextData, decisionData);
  }

  /**
   * Record when agent uses bash fallback instead of MCP
   */
  recordBashFallback(command, reason, mcpToolAlternative) {
    const contextData = {
      prompt: `Bash fallback: ${command}`,
      availableTools: this.getAvailableTools(),
      taskState: 'bash_fallback'
    };

    const decisionData = {
      action: 'bash_fallback',
      target: command,
      parameters: {
        mcpAlternative: mcpToolAlternative,
        command
      },
      reasoning: reason || 'Using bash command instead of MCP tool'
    };

    const entry = this.recordDecision(DecisionType.MCP_BASH_FALLBACK, contextData, decisionData);

    // Also record as an alternative considered
    if (mcpToolAlternative) {
      entry.addAlternative({
        action: 'mcp_tool_call',
        target: mcpToolAlternative,
        reasonNotChosen: reason || 'Bash fallback preferred'
      });
    }

    return entry;
  }

  /**
   * Record MCP tool avoidance
   */
  recordMcpAvoidance(reason, details) {
    const contextData = {
      prompt: details?.prompt || 'MCP tool avoidance detected',
      availableTools: this.getAvailableTools(),
      taskState: 'mcp_avoidance'
    };

    const decisionData = {
      action: 'avoid_mcp',
      target: details?.expectedTool || 'unknown',
      parameters: {
        avoidanceReason: reason,
        details
      },
      reasoning: this._getAvoidanceReasonDescription(reason)
    };

    return this.recordDecision(DecisionType.MCP_TOOL_AVOIDANCE, contextData, decisionData);
  }

  /**
   * Record manual investigation decision
   */
  recordManualInvestigation(command, reason, followingSuggestion) {
    const contextData = {
      prompt: `Manual investigation: ${command}`,
      taskState: 'manual_investigation'
    };

    const decisionData = {
      action: 'manual_investigate',
      target: command,
      parameters: {
        followingSuggestion: followingSuggestion || false
      },
      reasoning: reason || 'Performing manual investigation'
    };

    return this.recordDecision(DecisionType.MCP_MANUAL_INVESTIGATION, contextData, decisionData);
  }

  /**
   * Get description for avoidance reason
   */
  _getAvoidanceReasonDescription(reason) {
    const descriptions = {
      [McpAvoidanceReason.MCP_NOT_LOADED]: 'MCP configuration not loaded - tools unavailable',
      [McpAvoidanceReason.TOOL_CALL_FAILED]: 'Previous MCP tool call failed',
      [McpAvoidanceReason.AGENT_CHOSE_BASH]: 'Agent chose bash commands over MCP tools',
      [McpAvoidanceReason.LOW_CONFIDENCE_FALLBACK]: 'Falling back due to low confidence from previous tool',
      [McpAvoidanceReason.PROMPT_MISUNDERSTOOD]: 'Agent may have misunderstood the prompt',
      [McpAvoidanceReason.UNKNOWN]: 'Unknown reason for MCP avoidance'
    };

    return descriptions[reason] || descriptions[McpAvoidanceReason.UNKNOWN];
  }

  /**
   * Get MCP-related decisions
   */
  getMcpDecisions() {
    const mcpTypes = [
      DecisionType.MCP_TOOL_CALL,
      DecisionType.MCP_TOOL_AVOIDANCE,
      DecisionType.MCP_BASH_FALLBACK,
      DecisionType.MCP_LOW_CONFIDENCE,
      DecisionType.MCP_MANUAL_INVESTIGATION
    ];

    return this.decisions.filter(d => mcpTypes.includes(d.type));
  }

  /**
   * Get MCP usage summary
   */
  getMcpUsageSummary() {
    const mcpDecisions = this.getMcpDecisions();

    const summary = {
      totalMcpDecisions: mcpDecisions.length,
      toolCalls: mcpDecisions.filter(d => d.type === DecisionType.MCP_TOOL_CALL).length,
      toolCallsSuccessful: mcpDecisions.filter(d =>
        d.type === DecisionType.MCP_TOOL_CALL && d.outcome.status === 'success'
      ).length,
      bashFallbacks: mcpDecisions.filter(d => d.type === DecisionType.MCP_BASH_FALLBACK).length,
      lowConfidenceResponses: mcpDecisions.filter(d => d.type === DecisionType.MCP_LOW_CONFIDENCE).length,
      manualInvestigations: mcpDecisions.filter(d => d.type === DecisionType.MCP_MANUAL_INVESTIGATION).length,
      avoidances: mcpDecisions.filter(d => d.type === DecisionType.MCP_TOOL_AVOIDANCE).length,
      toolsUsed: [...new Set(
        mcpDecisions
          .filter(d => d.type === DecisionType.MCP_TOOL_CALL)
          .map(d => d.decision.target)
      )]
    };

    // Determine primary method
    if (summary.toolCalls > 0) {
      summary.primaryMethod = 'mcp_tools';
    } else if (summary.bashFallbacks > 0) {
      summary.primaryMethod = 'bash_fallback';
    } else if (summary.manualInvestigations > 0) {
      summary.primaryMethod = 'manual';
    } else {
      summary.primaryMethod = 'none';
    }

    return summary;
  }

  /**
   * Get available tools (to be set by agent)
   */
  getAvailableTools() {
    return this._availableTools || [];
  }

  /**
   * Set available tools
   */
  setAvailableTools(tools) {
    this._availableTools = tools;
  }

  /**
   * Get decisions by type
   */
  getDecisionsByType(type) {
    return this.decisions.filter(d => d.type === type);
  }

  /**
   * Get recent decisions
   */
  getRecentDecisions(count = 10) {
    return this.decisions.slice(-count);
  }

  /**
   * Get failed decisions
   */
  getFailedDecisions() {
    return this.decisions.filter(d => d.outcome.status === 'failed');
  }

  /**
   * Get the decision chain for current task
   */
  getTaskDecisionChain() {
    if (!this.currentTask) return [];

    return this.decisions.filter(d =>
      this.currentTask.decisions.includes(d.id)
    );
  }

  /**
   * Get statistics
   */
  getStats() {
    const stats = { ...this.stats };

    if (stats.totalDecisions > 0) {
      stats.successRate = parseFloat(
        ((stats.successfulDecisions / stats.totalDecisions) * 100).toFixed(1)
      );
      stats.avgDurationMs = Math.round(stats.totalDurationMs / stats.totalDecisions);
    }

    return stats;
  }

  /**
   * Generate a decision flow diagram (text-based)
   */
  generateDecisionFlow() {
    const chain = this.getTaskDecisionChain();
    if (chain.length === 0) return 'No decisions recorded for current task';

    let flow = `Decision Flow for Task: ${this.currentTask?.id || 'unknown'}\n`;
    flow += '='.repeat(60) + '\n\n';

    for (let i = 0; i < chain.length; i++) {
      const d = chain[i];
      const status = d.outcome.status === 'success' ? '✓' : d.outcome.status === 'failed' ? '✗' : '○';

      flow += `[${i + 1}] ${status} ${d.type}\n`;
      flow += `    Action: ${d.decision.action} → ${d.decision.target}\n`;
      if (d.decision.reasoning) {
        flow += `    Reasoning: ${d.decision.reasoning.slice(0, 100)}...\n`;
      }
      flow += `    Duration: ${d.outcome.durationMs}ms\n`;

      if (i < chain.length - 1) {
        flow += '    ↓\n';
      }
    }

    flow += '\n' + '='.repeat(60) + '\n';
    flow += `Total: ${chain.length} decisions, ${this.stats.successfulDecisions} successful\n`;

    return flow;
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    const stats = this.getStats();
    const chain = this.getTaskDecisionChain();

    return {
      sessionId: this.sessionId,
      agentRole: this.agentRole,
      generatedAt: new Date().toISOString(),
      currentTask: this.currentTask,
      statistics: stats,
      decisionFlow: this.generateDecisionFlow(),
      recentDecisions: this.getRecentDecisions(20).map(d => d.toJSON()),
      failedDecisions: this.getFailedDecisions().map(d => d.toJSON()),
      toolUsageBreakdown: stats.toolUsage
    };
  }

  /**
   * Export all decisions
   */
  exportDecisions() {
    return {
      sessionId: this.sessionId,
      agentRole: this.agentRole,
      exportedAt: new Date().toISOString(),
      currentTask: this.currentTask,
      statistics: this.getStats(),
      decisionCount: this.decisions.length,
      decisions: this.decisions.map(d => d.toJSON())
    };
  }

  /**
   * Save audit trail to file
   */
  async saveToFile(filePath = null) {
    const targetPath = filePath || path.join(
      this.logDir || process.cwd(),
      `agent-audit-${this.sessionId}.json`
    );

    const data = this.exportDecisions();
    await fs.writeFile(targetPath, JSON.stringify(data, null, 2));

    if (this.verbose) {
      console.log(`[AuditTrail] Saved ${this.decisions.length} decisions to ${targetPath}`);
    }

    return targetPath;
  }

  /**
   * Load audit trail from file
   */
  async loadFromFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    this.sessionId = data.sessionId;
    this.agentRole = data.agentRole;
    this.currentTask = data.currentTask;

    // Reconstruct decision entries
    this.decisions = data.decisions.map(d => {
      const entry = new DecisionEntry(d.type, d.agentRole);
      Object.assign(entry, d);
      return entry;
    });

    // Recalculate stats
    this._recalculateStats();

    if (this.verbose) {
      console.log(`[AuditTrail] Loaded ${this.decisions.length} decisions from ${filePath}`);
    }

    return this;
  }

  /**
   * Recalculate statistics from decisions
   */
  _recalculateStats() {
    this.stats = {
      totalDecisions: 0,
      byType: {},
      successfulDecisions: 0,
      failedDecisions: 0,
      totalDurationMs: 0,
      toolUsage: {}
    };

    for (const d of this.decisions) {
      this.stats.totalDecisions++;
      this.stats.byType[d.type] = (this.stats.byType[d.type] || 0) + 1;

      if (d.outcome.status === 'success') {
        this.stats.successfulDecisions++;
      } else if (d.outcome.status === 'failed') {
        this.stats.failedDecisions++;
      }

      this.stats.totalDurationMs += d.outcome.durationMs || 0;

      if (d.decision.target) {
        this.stats.toolUsage[d.decision.target] =
          (this.stats.toolUsage[d.decision.target] || 0) + 1;
      }
    }
  }

  /**
   * Clear all decisions
   */
  clear() {
    this.decisions = [];
    this.currentTask = null;
    this.conversationTurn = 0;
    this.previousActions = [];
    this._recalculateStats();
  }
}

// Factory function to create audit trail for an agent
export function createAuditTrail(agentConfig) {
  return new AgentAuditTrail({
    sessionId: agentConfig.sessionId,
    agentRole: agentConfig.role,
    logDir: agentConfig.logDir,
    verbose: agentConfig.verbose
  });
}

export default AgentAuditTrail;
