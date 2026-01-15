/**
 * TaskPlanner - Analyzes tasks and creates agent execution plans
 *
 * Uses AI to understand task requirements and select optimal agent sequence.
 */

import { ClaudeCodeAgent } from './claude-code-agent.js';
import { recommendAgents } from './standard-agents.js';
import chalk from 'chalk';

export class TaskPlanner {
  constructor(registry, conversation) {
    this.registry = registry;
    this.conversation = conversation;
  }

  /**
   * Analyze task and create execution plan
   * @param {string} task - Task description
   * @param {Object} containerTools - Container tools instance
   * @param {Object} costMonitor - Cost monitor instance
   * @param {Object} options - Planning options
   * @returns {Promise<Object>} - Execution plan
   */
  async planTask(task, containerTools, costMonitor, options = {}) {
    const startTime = Date.now();

    // Option 1: Use AI planner (more intelligent)
    if (options.useAI !== false) {
      try {
        const aiPlan = await this.planWithAI(task, containerTools, costMonitor);
        const duration = Date.now() - startTime;

        this.conversation.add('planner',
          `Task Plan (AI):\n- Type: ${aiPlan.taskType}\n- Agents: ${aiPlan.agents.join(' → ')}\n- Reasoning: ${aiPlan.reasoning}`,
          { duration, cost: aiPlan.cost || 0 },
          true
        );

        return aiPlan;
      } catch (error) {
        console.log(chalk.yellow(`  ⚠️  AI planner failed: ${error.message}`));
        console.log(chalk.gray(`  Falling back to heuristic planning...\n`));
      }
    }

    // Option 2: Use heuristic planner (fast, rule-based)
    const heuristicPlan = this.planWithHeuristics(task);
    const duration = Date.now() - startTime;

    this.conversation.add('planner',
      `Task Plan (Heuristic):\n- Type: ${heuristicPlan.taskType}\n- Agents: ${heuristicPlan.agents.join(' → ')}\n- Reasoning: ${heuristicPlan.reasoning}`,
      { duration },
      true
    );

    return heuristicPlan;
  }

  /**
   * Use AI to analyze task and recommend agents
   * @private
   */
  async planWithAI(task, containerTools, costMonitor) {
    const plannerAgent = new ClaudeCodeAgent({
      role: 'planner',
      allowedTools: ['Read', 'Bash(ls:*,cat:*)'],
      workingDir: containerTools.workingDir,
      sessionId: `planner-${Date.now()}`
    });

    // Build list of available agents
    const availableAgents = this.registry.listAll()
      .map(a => `- **${a.name}**: ${a.description}\n  Capabilities: ${a.capabilities.join(', ')}\n  Est. Cost: $${a.estimatedCost.toFixed(4)}`)
      .join('\n\n');

    const prompt = `You are a task planning expert. Analyze this task and determine the optimal sequence of agents.

**Task:** ${task}

**Available Agents:**
${availableAgents}

**Guidelines:**
1. Use MINIMUM agents needed (don't over-engineer)
2. Consider task complexity
3. Skip agents when not needed:
   - Skip architect for simple fixes (just typos, obvious changes)
   - Skip coder for analysis-only tasks
   - Skip reviewer for documentation-only tasks (if low risk)
4. Add specialized agents when needed:
   - Add security agent for auth/security tasks
   - Add performance agent for optimization tasks
   - Add documenter for documentation tasks
5. Consider agent sequencing carefully

**Task Type Classification:**
- **analysis**: No code changes, just analysis/review
- **implementation**: Add features, refactor, significant changes
- **fix**: Bug fixes, small corrections
- **documentation**: Write/update docs, README, comments
- **security**: Auth, permissions, security-critical features
- **performance**: Optimization, speed improvements
- **testing**: Write/improve tests

**Respond in this JSON format:**
\`\`\`json
{
  "taskType": "analysis|implementation|fix|documentation|security|performance|testing",
  "agents": ["agent1", "agent2", "agent3"],
  "reasoning": "Brief explanation of why these agents in this order",
  "estimatedDuration": "30s-5min",
  "complexity": "simple|medium|complex",
  "skipReason": "Why certain agents were skipped (if any)"
}
\`\`\`

Think carefully about the minimum agents needed. Don't default to all three (architect, coder, reviewer) unless truly necessary.`;

    const result = await plannerAgent.executeWithTools({
      initialPrompt: prompt,
      containerTools,
      costMonitor
    });

    // Parse the plan
    const plan = this.parseTaskPlan(result.response, task);
    plan.cost = result.cost;
    plan.plannerDuration = result.totalDuration;

    return plan;
  }

  /**
   * Recommend agents based on dynamic capability matching
   * Uses agent registry to find best matches without hardcoding
   * @private
   */
  recommendAgentsForTask(task) {
    const taskLower = task.toLowerCase();

    // Extract meaningful words from task
    const taskWords = this.extractRelevantWords(taskLower);

    // Score each agent based on capability matches
    const agentScores = new Map();

    for (const agent of this.registry.listAll()) {
      let score = 0;

      // Check each agent capability against task words
      for (const capability of agent.capabilities) {
        for (const word of taskWords) {
          // Direct match or containment
          if (capability.includes(word) || word.includes(capability)) {
            score += 2;
          }
          // Similar words (handles hyphenation, plurals, etc.)
          else if (this.areSimilar(capability, word)) {
            score += 1;
          }
        }
      }

      // Platform bonus: if agent is ServiceNow-specific and task mentions ServiceNow
      if (agent.metadata?.platform === 'servicenow' &&
          (taskLower.includes('servicenow') || taskLower.includes('sn-tools') ||
           taskLower.includes('trace-impact') || taskLower.includes('trace-backward') ||
           taskLower.includes('trace-lineage') || taskLower.includes('npm run') ||
           taskLower.includes('script include') || taskLower.includes('gliderecord') ||
           taskLower.includes('table schema') || taskLower.includes('x_cadso') ||
           taskLower.includes('business rule') || taskLower.includes('flow designer'))) {
        score += 5;
      }

      // Capability-specific bonuses for better matching
      if (agent.capabilities.includes('servicenow')) {
        // ServiceNow agents get bonus for SN-specific terms
        if (taskLower.includes('workcampaignboard') || taskLower.includes('campaign')) score += 3;
        if (taskLower.includes('gliderecord') || taskLower.includes('glideajax')) score += 3;

        // Agent-specific bonuses for precise routing
        if (agent.name === 'sn-api' && (taskLower.includes('rest api') || taskLower.includes('api'))) score += 3;
        if (agent.name === 'sn-scripting' && (taskLower.includes('script include') || taskLower.includes('business rule'))) score += 3;
        if (agent.name === 'sn-ui' && (taskLower.includes('component') || taskLower.includes('ui') || taskLower.includes('portal'))) score += 3;
        if (agent.name === 'sn-integration' && (taskLower.includes('table') || taskLower.includes('relationship') || taskLower.includes('schema'))) score += 3;
        if (agent.name === 'sn-data' && (taskLower.includes('data') || taskLower.includes('import') || taskLower.includes('transform'))) score += 3;
      }

      if (score > 0) {
        agentScores.set(agent.name, score);
      }
    }

    // Sort agents by score (highest first)
    const sortedAgents = Array.from(agentScores.entries())
      .sort((a, b) => b[1] - a[1]);

    if (sortedAgents.length > 0) {
      const topAgent = sortedAgents[0][0];

      // For specialized agents, use just that one (they're self-contained)
      if (topAgent.startsWith('sn-') || topAgent === 'documenter' ||
          topAgent === 'security' || topAgent === 'performance' || topAgent === 'tester') {
        return [topAgent];
      }

      // For analysis-only tasks, use top agent only
      if ((taskLower.includes('analyze') || taskLower.includes('review')) &&
          !taskLower.includes('implement') && !taskLower.includes('fix') &&
          !taskLower.includes('add') && !taskLower.includes('create')) {
        return [topAgent];
      }

      // For security/performance tasks, use full workflow with specialist
      if (topAgent === 'architect' && sortedAgents.length > 1) {
        const specialist = sortedAgents[1][0];
        if (specialist === 'security') {
          return ['architect', 'coder', 'security', 'reviewer'];
        }
        if (specialist === 'performance') {
          return ['architect', 'performance', 'coder', 'reviewer'];
        }
      }

      // Standard implementation workflow (architect plans, coder implements, reviewer validates)
      return ['architect', 'coder', 'reviewer'];
    }

    // Default fallback if no agents match
    return ['architect', 'coder', 'reviewer'];
  }

  /**
   * Extract relevant words from task (removes stop words)
   * @private
   */
  extractRelevantWords(taskLower) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been',
      'this', 'that', 'these', 'those', 'what', 'which', 'who', 'when', 'where',
      'how', 'why', 'does', 'do', 'did', 'should', 'could', 'would', 'can'
    ]);

    const words = taskLower
      .split(/[\s,.:;!?()[\]{}]+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    return words;
  }

  /**
   * Check if two strings are similar (handles hyphenation, plurals, stems)
   * @private
   */
  areSimilar(str1, str2) {
    // Normalize: lowercase, remove hyphens/underscores
    const s1 = str1.toLowerCase().replace(/[-_]/g, '');
    const s2 = str2.toLowerCase().replace(/[-_]/g, '');

    // One contains the other
    if (s1.includes(s2) || s2.includes(s1)) {
      return true;
    }

    // Common word stems (simple stemming - remove common suffixes)
    const stem1 = this.simpleStem(s1);
    const stem2 = this.simpleStem(s2);

    return stem1 === stem2;
  }

  /**
   * Simple word stemming (removes common suffixes)
   * @private
   */
  simpleStem(word) {
    // Remove common suffixes
    return word
      .replace(/ing$/, '')
      .replace(/ed$/, '')
      .replace(/s$/, '')
      .replace(/er$/, '')
      .replace(/tion$/, '')
      .replace(/ness$/, '');
  }

  /**
   * Use heuristic rules to create plan (fast, no AI)
   * @private
   */
  planWithHeuristics(task) {
    const agents = this.recommendAgentsForTask(task);
    const taskLower = task.toLowerCase();

    // Determine task type
    let taskType = 'implementation';
    let reasoning = 'Standard implementation workflow';
    let complexity = 'medium';

    // Analysis task
    if ((taskLower.includes('analyze') || taskLower.includes('review') ||
         taskLower.includes('assess') || taskLower.includes('evaluate')) &&
        !taskLower.includes('implement') && !taskLower.includes('fix') &&
        !taskLower.includes('add') && !taskLower.includes('create')) {
      taskType = 'analysis';
      reasoning = 'Analysis-only task, no code changes needed';
      complexity = 'simple';
    }
    // Simple fix
    else if (taskLower.includes('fix') && (taskLower.includes('typo') ||
             taskLower.includes('simple') || taskLower.includes('quick'))) {
      taskType = 'fix';
      reasoning = 'Simple fix, skip planning phase';
      complexity = 'simple';
    }
    // Documentation
    else if (taskLower.includes('document') || taskLower.includes('readme') ||
             (taskLower.includes('comment') && !taskLower.includes('uncomment'))) {
      taskType = 'documentation';
      reasoning = 'Documentation task, use specialized documenter';
      complexity = 'simple';
    }
    // Security
    else if (taskLower.includes('auth') || taskLower.includes('security') ||
             taskLower.includes('password') || taskLower.includes('token')) {
      taskType = 'security';
      reasoning = 'Security-critical task, add security validation';
      complexity = 'complex';
    }
    // Performance
    else if (taskLower.includes('optimize') || taskLower.includes('performance') ||
             taskLower.includes('speed') || taskLower.includes('slow')) {
      taskType = 'performance';
      reasoning = 'Performance task, add performance analysis';
      complexity = 'medium';
    }
    // Testing
    else if (taskLower.includes('test') && !taskLower.includes('fix')) {
      taskType = 'testing';
      reasoning = 'Testing task, use test specialist';
      complexity = 'medium';
    }
    // Complex implementation
    else if (taskLower.includes('refactor') || taskLower.includes('redesign') ||
             taskLower.includes('migrate') || taskLower.includes('rewrite')) {
      complexity = 'complex';
      reasoning = 'Complex changes require full workflow';
    }

    // Estimate duration based on complexity and agent count
    let estimatedDuration = '2-3min';
    if (complexity === 'simple') {
      estimatedDuration = agents.length === 2 ? '1-2min' : '2-3min';
    } else if (complexity === 'complex') {
      estimatedDuration = agents.length > 3 ? '4-6min' : '3-5min';
    }

    // Validate agents exist in registry
    const validation = this.registry.validateAgents(agents);
    if (!validation.valid) {
      console.log(chalk.yellow(`  ⚠️  Unknown agents: ${validation.missing.join(', ')}`));
      // Fallback to default sequence
      return {
        taskType: 'implementation',
        agents: ['architect', 'coder', 'reviewer'],
        reasoning: 'Fallback to default (unknown agents requested)',
        estimatedDuration: '3-5min',
        complexity: 'medium',
        skipReason: null
      };
    }

    return {
      taskType,
      agents,
      reasoning,
      estimatedDuration,
      complexity,
      skipReason: this.explainSkips(agents)
    };
  }

  /**
   * Parse JSON plan from AI response
   * @private
   */
  parseTaskPlan(response, task) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/```json\n([\s\S]+?)\n```/) ||
                       response.match(/```\n([\s\S]+?)\n```/) ||
                       response.match(/(\{[\s\S]+?\})/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const plan = JSON.parse(jsonStr);

        // Validate required fields
        if (!plan.agents || !Array.isArray(plan.agents)) {
          throw new Error('Invalid plan: missing agents array');
        }

        // Validate agents exist
        const validation = this.registry.validateAgents(plan.agents);
        if (!validation.valid) {
          console.log(chalk.yellow(`  ⚠️  Plan includes unknown agents: ${validation.missing.join(', ')}`));
          // Remove unknown agents
          plan.agents = plan.agents.filter(name => this.registry.has(name));
          if (plan.agents.length === 0) {
            throw new Error('No valid agents in plan');
          }
        }

        // Set defaults for missing fields
        return {
          taskType: plan.taskType || 'implementation',
          agents: plan.agents,
          reasoning: plan.reasoning || 'AI-generated plan',
          estimatedDuration: plan.estimatedDuration || '2-5min',
          complexity: plan.complexity || 'medium',
          skipReason: plan.skipReason || null
        };
      }

      throw new Error('No JSON found in response');
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️  Failed to parse AI plan: ${error.message}`));
      console.log(chalk.gray(`  Falling back to heuristic planning...\n`));

      // Fallback to heuristic
      return this.planWithHeuristics(task);
    }
  }

  /**
   * Explain why certain standard agents were skipped
   * @private
   */
  explainSkips(agents) {
    const standardAgents = ['architect', 'coder', 'reviewer'];
    const skipped = standardAgents.filter(a => !agents.includes(a));

    if (skipped.length === 0) return null;

    const reasons = [];
    if (skipped.includes('architect')) {
      reasons.push('Architect skipped (task is straightforward, no planning needed)');
    }
    if (skipped.includes('coder')) {
      reasons.push('Coder skipped (analysis-only, no code changes)');
    }
    if (skipped.includes('reviewer')) {
      reasons.push('Reviewer skipped (low-risk changes, self-review sufficient)');
    }

    return reasons.join('; ');
  }

  /**
   * Get estimated cost for a plan
   * @param {Object} plan - Execution plan
   * @returns {number} - Estimated cost in dollars
   */
  estimateCost(plan) {
    return this.registry.estimateCost(plan.agents);
  }

  /**
   * Display plan summary
   * @param {Object} plan - Execution plan
   */
  displayPlan(plan) {
    console.log(chalk.cyan('\n📋 Execution Plan:'));
    console.log(chalk.gray(`  Task Type: ${plan.taskType}`));
    console.log(chalk.gray(`  Complexity: ${plan.complexity}`));
    console.log(chalk.gray(`  Estimated Duration: ${plan.estimatedDuration}`));
    console.log(chalk.gray(`  Estimated Cost: $${this.estimateCost(plan).toFixed(4)}`));
    console.log(chalk.cyan(`  Agent Sequence: ${plan.agents.join(' → ')}`));
    console.log(chalk.gray(`  Reasoning: ${plan.reasoning}`));
    if (plan.skipReason) {
      console.log(chalk.yellow(`  Optimizations: ${plan.skipReason}`));
    }
    console.log();
  }
}
