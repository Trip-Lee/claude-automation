/**
 * DynamicAgentExecutor - Executes agents with handoff capability
 *
 * Runs individual agents and parses their next-step decisions.
 * Maintains execution history and detects issues.
 */

import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import { ToolRegistry } from './tool-registry.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DynamicAgentExecutor {
  constructor(registry, conversation, containerTools, costMonitor, options = {}) {
    this.registry = registry;
    this.conversation = conversation;
    this.containerTools = containerTools;
    this.costMonitor = costMonitor;
    this.sessionId = options.sessionId || uuidv4();
    this.executionHistory = [];
    this.visited = new Set();
    this.verbose = options.verbose || false;

    // Execution context tracking
    this.executionContextTracking = {
      discovered: [],        // Tables discovered in cache
      injected: [],          // What was injected into agent prompts
      queriedByAgents: [],   // What agents actually queried
      timestamp: new Date().toISOString()
    };

    // Initialize tool registry for dynamic tool context injection
    this.toolRegistry = new ToolRegistry();
    if (this.verbose && this.toolRegistry.getToolCount() > 0) {
      console.log(chalk.gray(`  Tool registry: ${this.toolRegistry.getToolCount()} tool(s) available`));
    }
  }

  /**
   * Execute an agent by name
   * @param {string} agentName - Name of agent to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} - Execution result with decision
   */
  async execute(agentName, context) {
    const agentConfig = this.registry.get(agentName);
    if (!agentConfig) {
      throw new Error(`Agent '${agentName}' not found in registry`);
    }

    // Check if we've visited this agent before (loop detection)
    if (this.visited.has(agentName)) {
      console.log(chalk.yellow(`\n⚠️  Warning: Revisiting '${agentName}' agent (potential loop)\n`));
    }
    this.visited.add(agentName);

    // Display agent header
    const icon = agentConfig.metadata?.icon || '🤖';
    const color = agentConfig.metadata?.color || 'white';
    console.log(chalk[color].bold(`\n${icon} ${agentConfig.name.toUpperCase()} Agent\n`));
    console.log(chalk.gray(`  ${agentConfig.description}\n`));

    // Create agent instance
    const isFirstAgent = this.executionHistory.length === 0;
    const agent = agentConfig.factory({
      sessionId: this.sessionId,
      resumeSession: !isFirstAgent, // First agent creates session, others resume
      workingDir: this.containerTools.workingDir,
      verbose: this.verbose
    });

    // Build prompt with handoff instructions
    const prompt = this.buildAgentPrompt(agentName, agentConfig, context);

    // Execute agent
    const startTime = Date.now();
    const result = await agent.executeWithTools({
      initialPrompt: prompt,
      containerTools: this.containerTools,
      costMonitor: this.costMonitor
    });
    const duration = Date.now() - startTime;

    // Record execution
    this.executionHistory.push({
      agent: agentName,
      timestamp: Date.now(),
      duration: result.totalDuration || duration,
      cost: result.cost || 0,
      iterations: result.iterations || 1
    });

    // Track execution context usage in agent response
    this.trackExecutionContextUsage(agentName, result.response);

    // Add to conversation
    this.conversation.add(agentName, result.response, {
      duration: result.totalDuration || duration,
      cost: result.cost || 0
    }, true);

    // Parse agent's decision
    const decision = this.parseAgentDecision(result.response, agentName);

    // Display result
    console.log(chalk.gray(`    Duration: ${((result.totalDuration || duration) / 1000).toFixed(1)}s | Cost: $${(result.cost || 0).toFixed(4)}`));
    console.log(chalk.cyan(`    Decision: ${decision.isComplete ? '✅ COMPLETE' : `→ ${decision.nextAgent}`}`));
    console.log(chalk.gray(`    Reason: ${decision.reason}\n`));

    return {
      agentName,
      result,
      decision,
      duration: result.totalDuration || duration,
      cost: result.cost || 0
    };
  }

  /**
   * Build prompt for agent with handoff instructions
   * @private
   */
  buildAgentPrompt(agentName, agentConfig, context) {
    // Get conversation context (condensed)
    const conversationContext = this.conversation.getCondensedHistory();
    const fileCacheSummary = this.conversation.getFileCacheSummary();

    // Get relevant agents based on current role (filtered list)
    const relevantAgents = this.getRelevantAgents(agentName);

    // Get tool context from manifest (dynamic injection)
    const toolContext = this.getToolContextForAgent(agentName);

    // Build prompt (optimized for brevity)
    return `You are the **${agentName}** agent.

**Task:** ${context.task}

**Previous Work:**
${conversationContext}

${fileCacheSummary !== 'No files cached yet.' ? `**Files Available:** ${fileCacheSummary}\n` : ''}${toolContext}
**Next Step Decision (REQUIRED at end):**
\`\`\`
NEXT: [agent-name] | COMPLETE
REASON: [brief why]
\`\`\`

**Available Agents:** ${relevantAgents}

**Guidelines:** Use COMPLETE if done, or hand off to another agent if more work needed.

Perform your work and make your decision.`;
  }

  /**
   * Get tool context for agent from manifest
   * Only includes tools relevant to ServiceNow agents
   * @private
   */
  getToolContextForAgent(agentName) {
    // Only inject tool context for ServiceNow agents
    const snAgents = ['sn-api', 'sn-flows', 'sn-scripting', 'sn-ui', 'sn-integration', 'sn-security', 'sn-testing', 'sn-performance'];
    if (!snAgents.includes(agentName)) {
      return '';
    }

    const toolCount = this.toolRegistry.getToolCount();
    if (toolCount === 0) {
      return '';
    }

    // Get condensed tool context (not full markdown to save tokens)
    const tools = this.toolRegistry.getAllTools();
    const snTools = tools.find(t => t.name === 'sn-tools');

    if (!snTools) {
      return '';
    }

    // Build condensed tool context with key info
    let context = `**Available Tools (from manifest):**\n`;
    context += `- **${snTools.name}** v${snTools.version}\n`;
    context += `  Key commands: trace-lineage, query, validate-change, cache-query\n`;
    context += `  Location: cd tools/sn-tools/ServiceNow-Tools && npm run <command>\n`;

    // Discover available execution context from cache
    const executionContext = this.getAvailableExecutionContext();
    if (executionContext) {
      context += executionContext;
      // Track injection
      this.executionContextTracking.injected.push({
        agent: agentName,
        tables: this.executionContextTracking.discovered,
        timestamp: new Date().toISOString()
      });
      console.log(chalk.green(`  [ExecContext] Injected context for ${agentName} with ${this.executionContextTracking.discovered.length} table operations`));
    }

    context += '\n';
    return context;
  }

  /**
   * Check if agent response contains execution context queries
   * Call this after agent execution to track usage
   * @param {string} agentName - Agent name
   * @param {string} response - Agent response text
   */
  trackExecutionContextUsage(agentName, response) {
    const patterns = [
      /npm run cache-query\s+--\s+(\S+)\s+(\S+)/g,
      /cache-query.*?(\S+)\s+(insert|update|delete)/gi,
      /query_execution_context.*?table.*?['":](\S+)/gi
    ];

    const queriesFound = [];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        queriesFound.push({
          table: match[1],
          operation: match[2] || 'unknown'
        });
      }
    }

    if (queriesFound.length > 0) {
      this.executionContextTracking.queriedByAgents.push({
        agent: agentName,
        queries: queriesFound,
        timestamp: new Date().toISOString()
      });
      console.log(chalk.yellow(`  [ExecContext] Agent '${agentName}' queried execution context: ${queriesFound.map(q => `${q.table} ${q.operation}`).join(', ')}`));
    }

    return queriesFound;
  }

  /**
   * Get execution context tracking summary
   * @returns {Object} Tracking data
   */
  getExecutionContextSummary() {
    const { discovered, injected, queriedByAgents } = this.executionContextTracking;

    return {
      tablesAvailable: discovered.length,
      tablesDiscovered: discovered,
      agentsInjected: injected.length,
      agentsQueried: queriedByAgents.length,
      queryDetails: queriedByAgents,
      usageRate: injected.length > 0 ? (queriedByAgents.length / injected.length * 100).toFixed(1) + '%' : 'N/A'
    };
  }

  /**
   * Discover what execution context is available in the cache
   * Returns info about what table.operation combinations have cached context
   * @private
   */
  getAvailableExecutionContext() {
    try {
      // Find sn-tools cache relative to this module
      const projectRoot = path.join(__dirname, '..');
      const cacheDir = path.join(projectRoot, 'tools', 'sn-tools', 'ServiceNow-Tools', 'ai-context-cache', 'execution-chains');

      if (!fs.existsSync(cacheDir)) {
        if (this.verbose) {
          console.log(chalk.gray('  [ExecContext] No execution-chains cache directory found'));
        }
        return '';
      }

      const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'));
      if (files.length === 0) {
        if (this.verbose) {
          console.log(chalk.gray('  [ExecContext] No execution chain files found'));
        }
        return '';
      }

      // Parse available operations (e.g., "incident.insert.json" -> "incident insert")
      const operations = files.map(f => {
        const parts = f.replace('.json', '').split('.');
        return `${parts[0]} ${parts[1]}`;
      });

      // Track what we discovered
      this.executionContextTracking.discovered = operations;

      // Log discovery
      console.log(chalk.cyan(`  [ExecContext] Discovered ${files.length} execution chains: ${operations.join(', ')}`));

      let context = `\n  **Execution Context Available** (query before record operations):\n`;
      context += `  Tables: ${operations.join(', ')}\n`;
      context += `  Command: npm run cache-query -- <table> <operation>\n`;
      context += `  Returns: Business Rules that fire, fields auto-set, cascading records, risk level\n`;

      return context;
    } catch (error) {
      if (this.verbose) {
        console.log(chalk.red(`  [ExecContext] Error: ${error.message}`));
      }
      return '';
    }
  }

  /**
   * Get relevant agents for handoff based on current agent role
   * @private
   */
  getRelevantAgents(currentAgent) {
    const allAgents = this.registry.listAll().filter(a => a.name !== currentAgent);

    // Define typical handoff patterns
    const handoffPatterns = {
      architect: ['coder', 'reviewer', 'security', 'tester'],
      coder: ['reviewer', 'security', 'tester'],
      reviewer: ['coder', 'security'],
      security: ['coder', 'reviewer'],
      documenter: ['reviewer'],
      tester: ['coder', 'reviewer'],
      performance: ['coder', 'reviewer']
    };

    const relevant = handoffPatterns[currentAgent] || allAgents.map(a => a.name);

    return relevant
      .map(name => {
        const agent = allAgents.find(a => a.name === name);
        return agent ? `${agent.name}` : null;
      })
      .filter(Boolean)
      .join(', ');
  }

  /**
   * Parse agent's decision from response
   * @private
   */
  parseAgentDecision(response, agentName) {
    // Look for NEXT: and REASON: markers
    const nextMatch = response.match(/NEXT:\s*([^\n|]+)/i);
    const reasonMatch = response.match(/REASON:\s*([^\n]+)/i);

    if (!nextMatch) {
      console.log(chalk.yellow(`  ⚠️  No explicit decision found from ${agentName}`));

      // Try to infer from context
      const responseLower = response.toLowerCase();

      // Check for completion indicators
      if (responseLower.includes('task complete') ||
          responseLower.includes('all done') ||
          responseLower.includes('finished') ||
          responseLower.includes('no further') ||
          responseLower.includes('analysis complete')) {
        return {
          nextAgent: null,
          reason: 'Inferred completion from agent response',
          isComplete: true,
          explicit: false
        };
      }

      // Default: route to reviewer as safe default
      return {
        nextAgent: 'reviewer',
        reason: 'No explicit decision, routing to reviewer for validation',
        isComplete: false,
        explicit: false
      };
    }

    const next = nextMatch[1].trim().toLowerCase();
    const reason = reasonMatch ? reasonMatch[1].trim() : 'No reason provided';

    const isComplete = next === 'complete' || next === 'done' || next === 'finish';

    return {
      nextAgent: isComplete ? null : next,
      reason,
      isComplete,
      explicit: true
    };
  }

  /**
   * Get execution summary
   * @returns {Object} - Summary of execution history
   */
  getSummary() {
    const totalDuration = this.executionHistory.reduce((sum, e) => sum + e.duration, 0);
    const totalCost = this.executionHistory.reduce((sum, e) => sum + e.cost, 0);
    const agentSequence = this.executionHistory.map(e => e.agent);

    return {
      totalAgents: this.executionHistory.length,
      agentSequence,
      totalDuration,
      totalCost,
      averageDuration: totalDuration / this.executionHistory.length,
      averageCost: totalCost / this.executionHistory.length,
      executionHistory: this.executionHistory
    };
  }

  /**
   * Check if agent has been visited
   * @param {string} agentName - Agent name
   * @returns {boolean}
   */
  hasVisited(agentName) {
    return this.visited.has(agentName);
  }

  /**
   * Get visit count for an agent
   * @param {string} agentName - Agent name
   * @returns {number} - Number of times visited
   */
  getVisitCount(agentName) {
    return this.executionHistory.filter(e => e.agent === agentName).length;
  }

  /**
   * Detect if we're in a loop
   * @returns {boolean}
   */
  detectLoop() {
    if (this.executionHistory.length < 3) return false;

    // Check if last 3 agents form a cycle
    const last3 = this.executionHistory.slice(-3).map(e => e.agent);
    const uniqueLast3 = new Set(last3);

    // If last 3 are all the same 2 agents, we're looping
    if (uniqueLast3.size <= 2) {
      return true;
    }

    return false;
  }

  /**
   * Display execution summary
   */
  displaySummary() {
    const summary = this.getSummary();
    const execContextSummary = this.getExecutionContextSummary();

    console.log(chalk.cyan.bold('\n📊 Execution Summary\n'));
    console.log(chalk.gray(`  Total Agents: ${summary.totalAgents}`));
    console.log(chalk.cyan(`  Sequence: ${summary.agentSequence.join(' → ')}`));
    console.log(chalk.gray(`  Total Duration: ${(summary.totalDuration / 1000).toFixed(1)}s`));
    console.log(chalk.gray(`  Total Cost: $${summary.totalCost.toFixed(4)}`));
    console.log(chalk.gray(`  Avg per Agent: ${(summary.averageDuration / 1000).toFixed(1)}s / $${summary.averageCost.toFixed(4)}`));

    // Execution Context Tracking
    if (execContextSummary.tablesAvailable > 0) {
      console.log(chalk.cyan.bold('\n🔍 Execution Context Tracking\n'));
      console.log(chalk.gray(`  Tables Available: ${execContextSummary.tablesAvailable}`));
      console.log(chalk.gray(`  Agents Injected: ${execContextSummary.agentsInjected}`));
      console.log(chalk.gray(`  Agents Queried: ${execContextSummary.agentsQueried}`));
      console.log(chalk.yellow(`  Usage Rate: ${execContextSummary.usageRate}`));

      if (execContextSummary.queryDetails.length > 0) {
        console.log(chalk.green('\n  Queries Made:'));
        for (const detail of execContextSummary.queryDetails) {
          console.log(chalk.green(`    - ${detail.agent}: ${detail.queries.map(q => `${q.table} ${q.operation}`).join(', ')}`));
        }
      }
    }

    console.log();
  }
}
