/**
 * DynamicAgentExecutor - Executes agents with handoff capability
 *
 * Runs individual agents and parses their next-step decisions.
 * Maintains execution history and detects issues.
 */

import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

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

    // Build prompt (optimized for brevity)
    return `You are the **${agentName}** agent.

**Task:** ${context.task}

**Previous Work:**
${conversationContext}

${fileCacheSummary !== 'No files cached yet.' ? `**Files Available:** ${fileCacheSummary}\n` : ''}
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

    console.log(chalk.cyan.bold('\n📊 Execution Summary\n'));
    console.log(chalk.gray(`  Total Agents: ${summary.totalAgents}`));
    console.log(chalk.cyan(`  Sequence: ${summary.agentSequence.join(' → ')}`));
    console.log(chalk.gray(`  Total Duration: ${(summary.totalDuration / 1000).toFixed(1)}s`));
    console.log(chalk.gray(`  Total Cost: $${summary.totalCost.toFixed(4)}`));
    console.log(chalk.gray(`  Avg per Agent: ${(summary.averageDuration / 1000).toFixed(1)}s / $${summary.averageCost.toFixed(4)}`));
    console.log();
  }
}
