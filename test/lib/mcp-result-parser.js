/**
 * MCP Result Parser
 *
 * Comprehensive parser for analyzing MCP tool usage in test conversations.
 * Extracts tool calls, bash fallbacks, agent decisions, confidence levels,
 * and identifies failure reasons when agents don't use MCP tools.
 *
 * This addresses the key gap: understanding WHY agents use or don't use MCP tools.
 */

/**
 * MCP Tool call types detected in conversation
 */
export const McpCallType = {
  MCP_TOOL: 'mcp_tool',           // Native MCP tool call
  BASH_FALLBACK: 'bash_fallback', // npm run command fallback
  MANUAL_GREP: 'manual_grep',     // grep/find manual investigation
  NONE: 'none'                    // No tool usage detected
};

/**
 * Reasons why MCP tools might not be used
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
 * Known MCP tool names
 */
const MCP_TOOL_NAMES = [
  'trace_component_impact',
  'trace_table_dependencies',
  'trace_full_lineage',
  'validate_change_impact',
  'query_table_schema',
  'analyze_script_crud',
  'refresh_dependency_cache'
];

/**
 * Bash command patterns that indicate sn-tools usage
 */
const BASH_SNTOOL_PATTERNS = [
  /npm run trace-impact/i,
  /npm run trace-backward/i,
  /npm run trace-lineage/i,
  /npm run validate-change/i,
  /npm run query/i,
  /cd\s+tools\/sn-tools/i,
  /ServiceNow-Tools/i
];

/**
 * Manual investigation patterns
 */
const MANUAL_INVESTIGATION_PATTERNS = [
  /grep\s+-r/i,
  /grep\s+--include/i,
  /find\s+.*-name/i,
  /rg\s+/i,  // ripgrep
  /ag\s+/i   // silver searcher
];

/**
 * MCP Result Parser
 * Analyzes conversation history to understand MCP tool usage patterns
 */
export class McpResultParser {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
  }

  /**
   * Parse conversation history for complete MCP analysis
   * @param {Array} conversationHistory - Array of conversation turns
   * @returns {Object} Comprehensive MCP analysis
   */
  parseConversation(conversationHistory) {
    const analysis = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTurns: conversationHistory.length,
        mcpToolCallsDetected: 0,
        bashFallbacksDetected: 0,
        manualInvestigationsDetected: 0,
        mcpToolsUsed: [],
        primaryMethod: McpCallType.NONE
      },
      mcpToolCalls: [],
      bashFallbacks: [],
      manualInvestigations: [],
      agentDecisions: [],
      confidenceLevels: [],
      failureAnalysis: {
        mcpConfigLoaded: null,
        toolCallAttempts: [],
        errorResponses: [],
        avoidanceReasons: []
      },
      recommendations: []
    };

    // Process each turn
    for (let i = 0; i < conversationHistory.length; i++) {
      const turn = conversationHistory[i];
      const turnNumber = turn.turn || i + 1;

      // Extract MCP tool calls
      const mcpCalls = this.extractMcpToolCalls(turn, turnNumber);
      analysis.mcpToolCalls.push(...mcpCalls);

      // Extract bash fallbacks
      const bashCalls = this.extractBashCommands(turn, turnNumber);
      analysis.bashFallbacks.push(...bashCalls);

      // Extract manual investigations
      const manualCalls = this.extractManualInvestigations(turn, turnNumber);
      analysis.manualInvestigations.push(...manualCalls);

      // Extract agent decisions
      const decisions = this.extractDecisionPoints(turn, turnNumber);
      analysis.agentDecisions.push(...decisions);

      // Extract confidence levels from MCP responses
      const confidences = this.extractConfidenceLevels(turn, turnNumber);
      analysis.confidenceLevels.push(...confidences);

      // Check for MCP config loading
      if (analysis.failureAnalysis.mcpConfigLoaded === null) {
        analysis.failureAnalysis.mcpConfigLoaded = this.detectMcpConfigLoaded(turn);
      }

      // Extract errors
      const errors = this.extractErrors(turn, turnNumber);
      analysis.failureAnalysis.errorResponses.push(...errors);
    }

    // Calculate summary
    analysis.summary.mcpToolCallsDetected = analysis.mcpToolCalls.length;
    analysis.summary.bashFallbacksDetected = analysis.bashFallbacks.length;
    analysis.summary.manualInvestigationsDetected = analysis.manualInvestigations.length;
    analysis.summary.mcpToolsUsed = [...new Set(analysis.mcpToolCalls.map(c => c.toolName))];

    // Determine primary method used
    if (analysis.mcpToolCalls.length > 0) {
      analysis.summary.primaryMethod = McpCallType.MCP_TOOL;
    } else if (analysis.bashFallbacks.length > 0) {
      analysis.summary.primaryMethod = McpCallType.BASH_FALLBACK;
    } else if (analysis.manualInvestigations.length > 0) {
      analysis.summary.primaryMethod = McpCallType.MANUAL_GREP;
    }

    // Identify failure reasons
    analysis.failureAnalysis.avoidanceReasons = this.identifyFailureReasons(analysis);

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis);

    return analysis;
  }

  /**
   * Extract MCP tool calls from a conversation turn
   */
  extractMcpToolCalls(turn, turnNumber) {
    const calls = [];
    const responseStr = this.getResponseString(turn);

    // Pattern 1: Look for tool_use blocks (Claude Code format)
    const toolUsePattern = /"type"\s*:\s*"tool_use".*?"name"\s*:\s*"([^"]+)"/gs;
    let match;
    while ((match = toolUsePattern.exec(responseStr)) !== null) {
      if (MCP_TOOL_NAMES.includes(match[1])) {
        calls.push({
          turnNumber,
          toolName: match[1],
          detected: true,
          source: 'tool_use_block'
        });
      }
    }

    // Pattern 2: Look for _trace metadata in responses
    const tracePattern = /"_trace"\s*:\s*\{([^}]+)\}/g;
    while ((match = tracePattern.exec(responseStr)) !== null) {
      try {
        const traceContent = `{${match[1]}}`;
        const trace = JSON.parse(traceContent);
        calls.push({
          turnNumber,
          toolName: 'unknown',
          traceId: trace.id,
          executionTimeMs: trace.executionTimeMs,
          timestamp: trace.timestamp,
          failed: trace.failed || false,
          source: '_trace_metadata'
        });
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Pattern 3: Look for explicit tool name mentions with results
    for (const toolName of MCP_TOOL_NAMES) {
      // Check if tool name appears with parameters or results
      const toolPattern = new RegExp(`${toolName}[\\s\\S]{0,200}(parameters|params|arguments|result)`, 'gi');
      if (toolPattern.test(responseStr)) {
        // Avoid duplicates
        if (!calls.some(c => c.toolName === toolName && c.turnNumber === turnNumber)) {
          calls.push({
            turnNumber,
            toolName,
            detected: true,
            source: 'content_mention'
          });
        }
      }
    }

    // Pattern 4: Look for [MCPTrace] log entries
    const mcpTracePattern = /\[MCPTrace\]\s*(START|COMPLETE|FAILED)\s+([^\s|]+)\s*\|\s*Tool:\s*(\w+)/g;
    while ((match = mcpTracePattern.exec(responseStr)) !== null) {
      const status = match[1].toLowerCase();
      calls.push({
        turnNumber,
        traceId: match[2],
        toolName: match[3],
        status,
        source: 'mcp_trace_log'
      });
    }

    return calls;
  }

  /**
   * Extract bash sn-tools commands from a conversation turn
   */
  extractBashCommands(turn, turnNumber) {
    const calls = [];
    const responseStr = this.getResponseString(turn);

    // Look for bash code blocks with sn-tools commands
    const bashBlockPattern = /```bash\s*([\s\S]*?)```/g;
    let match;

    while ((match = bashBlockPattern.exec(responseStr)) !== null) {
      const bashContent = match[1];

      for (const pattern of BASH_SNTOOL_PATTERNS) {
        if (pattern.test(bashContent)) {
          // Extract the actual command
          const cmdMatch = bashContent.match(/\$?\s*(npm run [^\n]+|cd [^\n]+)/);
          calls.push({
            turnNumber,
            type: McpCallType.BASH_FALLBACK,
            command: cmdMatch ? cmdMatch[1].trim() : bashContent.trim().substring(0, 100),
            fullContent: bashContent.substring(0, 500)
          });
          break; // One match per bash block is enough
        }
      }
    }

    // Also look for inline npm run mentions
    const inlinePattern = /(?:executing|running|run):\s*(npm run [^\s]+[^\n]*)/gi;
    while ((match = inlinePattern.exec(responseStr)) !== null) {
      calls.push({
        turnNumber,
        type: McpCallType.BASH_FALLBACK,
        command: match[1].trim(),
        source: 'inline_mention'
      });
    }

    return calls;
  }

  /**
   * Extract manual investigation commands (grep, find, etc.)
   */
  extractManualInvestigations(turn, turnNumber) {
    const investigations = [];
    const responseStr = this.getResponseString(turn);

    for (const pattern of MANUAL_INVESTIGATION_PATTERNS) {
      if (pattern.test(responseStr)) {
        // Extract the command context
        const match = responseStr.match(new RegExp(`(?:^|\\n)[^\\n]*${pattern.source}[^\\n]*`, 'i'));
        investigations.push({
          turnNumber,
          type: McpCallType.MANUAL_GREP,
          pattern: pattern.source,
          context: match ? match[0].trim().substring(0, 200) : null
        });
      }
    }

    return investigations;
  }

  /**
   * Extract decision points where agent chose a method
   */
  extractDecisionPoints(turn, turnNumber) {
    const decisions = [];
    const responseStr = this.getResponseString(turn);

    // Decision to use MCP tool
    if (/(?:using|calling|invoking)\s+(?:the\s+)?(?:MCP\s+)?tool/i.test(responseStr)) {
      decisions.push({
        turnNumber,
        decision: 'use_mcp_tool',
        reasoning: this.extractReasoning(responseStr, 'tool')
      });
    }

    // Decision to use bash fallback
    if (/(?:instead|alternatively|falling back|using bash)/i.test(responseStr) &&
        BASH_SNTOOL_PATTERNS.some(p => p.test(responseStr))) {
      decisions.push({
        turnNumber,
        decision: 'use_bash_fallback',
        reasoning: this.extractReasoning(responseStr, 'bash')
      });
    }

    // Decision based on confidence level
    if (/confidence\s+(?:is|was)\s+(?:LOW|low)/i.test(responseStr)) {
      decisions.push({
        turnNumber,
        decision: 'low_confidence_action',
        reasoning: 'Confidence was LOW, following suggestions'
      });
    }

    // Decision to do manual investigation
    if (/(?:manual|manually)\s+(?:investigate|search|check)/i.test(responseStr)) {
      decisions.push({
        turnNumber,
        decision: 'manual_investigation',
        reasoning: this.extractReasoning(responseStr, 'manual')
      });
    }

    return decisions;
  }

  /**
   * Extract confidence levels from MCP tool responses
   */
  extractConfidenceLevels(turn, turnNumber) {
    const confidences = [];
    const responseStr = this.getResponseString(turn);

    // Pattern 1: JSON confidence object
    const jsonPattern = /"confidence"\s*:\s*\{\s*"level"\s*:\s*"(\w+)"\s*,\s*"score"\s*:\s*([\d.]+)/g;
    let match;
    while ((match = jsonPattern.exec(responseStr)) !== null) {
      confidences.push({
        turnNumber,
        level: match[1],
        score: parseFloat(match[2]),
        source: 'json_metadata'
      });
    }

    // Pattern 2: Textual confidence mentions
    const textPattern = /confidence\s+(?:level|is|was)?\s*:?\s*(HIGH|MEDIUM|LOW)/gi;
    while ((match = textPattern.exec(responseStr)) !== null) {
      // Avoid duplicates from JSON pattern
      const level = match[1].toUpperCase();
      if (!confidences.some(c => c.turnNumber === turnNumber && c.level === level)) {
        confidences.push({
          turnNumber,
          level,
          score: level === 'HIGH' ? 0.9 : level === 'MEDIUM' ? 0.6 : 0.3,
          source: 'text_mention'
        });
      }
    }

    // Pattern 3: trustworthy flag
    const trustPattern = /"trustworthy"\s*:\s*(true|false)/gi;
    while ((match = trustPattern.exec(responseStr)) !== null) {
      confidences.push({
        turnNumber,
        trustworthy: match[1] === 'true',
        source: 'trustworthy_flag'
      });
    }

    return confidences;
  }

  /**
   * Detect if MCP config was loaded
   */
  detectMcpConfigLoaded(turn) {
    const responseStr = this.getResponseString(turn);

    // Positive indicators
    if (/MCP config:\s*\S+/i.test(responseStr) ||
        /MCP server started/i.test(responseStr) ||
        /sn-tools.*loaded/i.test(responseStr)) {
      return true;
    }

    // Negative indicators
    if (/No MCP config found/i.test(responseStr) ||
        /MCP.*not available/i.test(responseStr)) {
      return false;
    }

    return null; // Unknown
  }

  /**
   * Extract errors from conversation
   */
  extractErrors(turn, turnNumber) {
    const errors = [];
    const responseStr = this.getResponseString(turn);

    // MCP tool errors
    const errorPattern = /"success"\s*:\s*false.*?"error"\s*:\s*\{([^}]+)\}/gs;
    let match;
    while ((match = errorPattern.exec(responseStr)) !== null) {
      try {
        const errorContent = `{${match[1]}}`;
        const error = JSON.parse(errorContent);
        errors.push({
          turnNumber,
          type: 'mcp_tool_error',
          message: error.message,
          code: error.code
        });
      } catch (e) {
        errors.push({
          turnNumber,
          type: 'mcp_tool_error',
          raw: match[1].substring(0, 200)
        });
      }
    }

    // Timeout errors
    if (/timed?\s*out|timeout/i.test(responseStr)) {
      errors.push({
        turnNumber,
        type: 'timeout'
      });
    }

    // Connection errors
    if (/connection refused|ECONNREFUSED|network error/i.test(responseStr)) {
      errors.push({
        turnNumber,
        type: 'connection_error'
      });
    }

    return errors;
  }

  /**
   * Identify reasons why MCP tools weren't used
   */
  identifyFailureReasons(analysis) {
    const reasons = [];

    // No MCP tool calls detected
    if (analysis.mcpToolCalls.length === 0) {
      // Check if MCP config was loaded
      if (analysis.failureAnalysis.mcpConfigLoaded === false) {
        reasons.push({
          reason: McpAvoidanceReason.MCP_NOT_LOADED,
          description: 'MCP configuration was not loaded - tools unavailable',
          severity: 'high'
        });
      }

      // Check if there were errors
      if (analysis.failureAnalysis.errorResponses.length > 0) {
        reasons.push({
          reason: McpAvoidanceReason.TOOL_CALL_FAILED,
          description: `Tool calls failed: ${analysis.failureAnalysis.errorResponses.length} errors`,
          severity: 'high',
          errors: analysis.failureAnalysis.errorResponses
        });
      }

      // Check if bash was used instead
      if (analysis.bashFallbacks.length > 0) {
        reasons.push({
          reason: McpAvoidanceReason.AGENT_CHOSE_BASH,
          description: 'Agent used bash commands instead of MCP tools',
          severity: 'medium',
          bashCommands: analysis.bashFallbacks.length
        });
      }

      // Check for low confidence fallback
      const lowConfidence = analysis.confidenceLevels.find(c => c.level === 'LOW');
      if (lowConfidence) {
        reasons.push({
          reason: McpAvoidanceReason.LOW_CONFIDENCE_FALLBACK,
          description: 'Tool returned LOW confidence, agent may have fallen back to manual methods',
          severity: 'low'
        });
      }

      // If no other reason found
      if (reasons.length === 0 && analysis.bashFallbacks.length === 0 && analysis.manualInvestigations.length === 0) {
        reasons.push({
          reason: McpAvoidanceReason.PROMPT_MISUNDERSTOOD,
          description: 'Agent did not use any sn-tools (MCP or bash) - may have misunderstood prompt',
          severity: 'high'
        });
      }

      if (reasons.length === 0) {
        reasons.push({
          reason: McpAvoidanceReason.UNKNOWN,
          description: 'Could not determine why MCP tools were not used',
          severity: 'medium'
        });
      }
    }

    return reasons;
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    // MCP not loaded
    if (analysis.failureAnalysis.mcpConfigLoaded === false) {
      recommendations.push({
        priority: 'high',
        category: 'configuration',
        recommendation: 'Ensure mcp-config.json is present in working directory or specify explicit path',
        action: 'Check --mcp-config flag or file locations'
      });
    }

    // Using bash instead of MCP
    if (analysis.bashFallbacks.length > 0 && analysis.mcpToolCalls.length === 0) {
      recommendations.push({
        priority: 'medium',
        category: 'tool_usage',
        recommendation: 'Agent is using bash fallback instead of native MCP tools',
        action: 'Verify MCP server is running and tools are available'
      });
    }

    // Low confidence responses
    const lowConfidenceCount = analysis.confidenceLevels.filter(c => c.level === 'LOW').length;
    if (lowConfidenceCount > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'data_quality',
        recommendation: `${lowConfidenceCount} tool responses had LOW confidence`,
        action: 'Consider refreshing sn-tools cache: npm run refresh-cache'
      });
    }

    // No tool usage at all
    if (analysis.summary.primaryMethod === McpCallType.NONE) {
      recommendations.push({
        priority: 'high',
        category: 'agent_behavior',
        recommendation: 'No sn-tools usage detected (neither MCP nor bash)',
        action: 'Review agent system prompt to ensure sn-tools instructions are clear'
      });
    }

    // Errors detected
    if (analysis.failureAnalysis.errorResponses.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'errors',
        recommendation: `${analysis.failureAnalysis.errorResponses.length} errors detected during execution`,
        action: 'Review error messages and fix underlying issues'
      });
    }

    return recommendations;
  }

  /**
   * Helper: Get response string from turn
   */
  getResponseString(turn) {
    if (!turn) return '';

    if (typeof turn.response === 'string') {
      return turn.response;
    }

    if (turn.response?.response) {
      return typeof turn.response.response === 'string'
        ? turn.response.response
        : JSON.stringify(turn.response.response);
    }

    return JSON.stringify(turn.response || turn);
  }

  /**
   * Helper: Extract reasoning context
   */
  extractReasoning(text, type) {
    // Look for reasoning patterns near the decision
    const patterns = {
      tool: /(?:because|since|as)\s+([^.]{20,100})\./i,
      bash: /(?:falling back|instead|alternatively)[^.]{0,50}because\s+([^.]{20,100})\./i,
      manual: /(?:manually|manual investigation)[^.]{0,50}(?:to|because)\s+([^.]{20,100})\./i
    };

    const pattern = patterns[type];
    if (pattern) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Generate a human-readable summary of the analysis
   */
  generateSummaryText(analysis) {
    const lines = [];

    lines.push('=== MCP Tool Usage Analysis ===\n');

    // Summary
    lines.push(`Total conversation turns: ${analysis.summary.totalTurns}`);
    lines.push(`Primary method: ${analysis.summary.primaryMethod}`);
    lines.push(`MCP tool calls: ${analysis.summary.mcpToolCallsDetected}`);
    lines.push(`Bash fallbacks: ${analysis.summary.bashFallbacksDetected}`);
    lines.push(`Manual investigations: ${analysis.summary.manualInvestigationsDetected}`);

    if (analysis.summary.mcpToolsUsed.length > 0) {
      lines.push(`MCP tools used: ${analysis.summary.mcpToolsUsed.join(', ')}`);
    }

    // Confidence levels
    if (analysis.confidenceLevels.length > 0) {
      lines.push('\n--- Confidence Levels ---');
      const grouped = {};
      for (const c of analysis.confidenceLevels) {
        if (c.level) {
          grouped[c.level] = (grouped[c.level] || 0) + 1;
        }
      }
      for (const [level, count] of Object.entries(grouped)) {
        lines.push(`  ${level}: ${count}`);
      }
    }

    // Failure analysis
    if (analysis.failureAnalysis.avoidanceReasons.length > 0) {
      lines.push('\n--- Failure Analysis ---');
      for (const reason of analysis.failureAnalysis.avoidanceReasons) {
        lines.push(`  [${reason.severity.toUpperCase()}] ${reason.reason}: ${reason.description}`);
      }
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      lines.push('\n--- Recommendations ---');
      for (const rec of analysis.recommendations) {
        lines.push(`  [${rec.priority.toUpperCase()}] ${rec.recommendation}`);
        lines.push(`    Action: ${rec.action}`);
      }
    }

    return lines.join('\n');
  }
}

export default McpResultParser;
