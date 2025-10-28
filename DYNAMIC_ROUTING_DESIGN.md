# Dynamic Agent Routing System - Design Document

**Status**: 🚧 Design Phase
**Target Version**: v0.11.0
**Created**: 2025-10-23

---

## Vision

Transform the system from **hardcoded 3-agent sequence** to **fully dynamic routing** where:
- Each agent decides who to hand off to next (or if task is complete)
- System can skip unnecessary agents (e.g., no coder needed for analysis-only tasks)
- New agents can be added without modifying orchestrator
- Task complexity determines agent selection

---

## Current vs Proposed

### Current (v0.10.0): Hardcoded Pipeline

```
User Task
    ↓
Architect (always)
    ↓
Coder (always)
    ↓
Reviewer (always)
    ↓
Done
```

**Problems**:
- ❌ Can't skip agents even if not needed
- ❌ Can't add new agents without code changes
- ❌ Analysis-only tasks still run coder
- ❌ Simple tasks waste time in full pipeline

### Proposed (v0.11.0): Dynamic Routing

```
User Task
    ↓
Task Planner analyzes task
    ↓
Selects agents: [Architect, Reviewer] (skips Coder!)
    ↓
Architect: "Task is analysis-only, passing to Reviewer"
    ↓
Reviewer: "Analysis complete, task done"
    ↓
Done (no code changes made)
```

**Benefits**:
- ✅ Agents route intelligently
- ✅ Skip unnecessary steps
- ✅ Add agents via configuration
- ✅ Faster for simple tasks
- ✅ Each agent decides next step

---

## Architecture Components

### 1. Agent Registry

**Purpose**: Central registry of all available agents

**File**: `lib/agent-registry.js` (new)

```javascript
export class AgentRegistry {
  constructor() {
    this.agents = new Map();
  }

  // Register an agent with capabilities
  register(agentConfig) {
    this.agents.set(agentConfig.name, {
      name: agentConfig.name,
      description: agentConfig.description,
      capabilities: agentConfig.capabilities,
      tools: agentConfig.tools,
      cost: agentConfig.estimatedCost,
      createInstance: agentConfig.factory
    });
  }

  // Get agent by name
  get(name) {
    return this.agents.get(name);
  }

  // Get all agents matching capabilities
  findByCapability(capability) {
    return Array.from(this.agents.values())
      .filter(agent => agent.capabilities.includes(capability));
  }

  // List all available agents
  listAll() {
    return Array.from(this.agents.values());
  }
}
```

**Agent Configuration Example**:
```javascript
registry.register({
  name: 'architect',
  description: 'Analyzes project structure and creates implementation plans',
  capabilities: ['analysis', 'planning', 'architecture'],
  tools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
  estimatedCost: 0.02,
  factory: (config) => new ClaudeCodeAgent({
    role: 'architect',
    allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
    ...config
  })
});

registry.register({
  name: 'coder',
  description: 'Implements code changes and writes tests',
  capabilities: ['implementation', 'coding', 'testing'],
  tools: ['Read', 'Write', 'Edit', 'Bash'],
  estimatedCost: 0.04,
  factory: (config) => new ClaudeCodeAgent({
    role: 'coder',
    allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
    ...config
  })
});

registry.register({
  name: 'reviewer',
  description: 'Reviews code quality and provides feedback',
  capabilities: ['review', 'quality-assurance', 'validation'],
  tools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
  estimatedCost: 0.02,
  factory: (config) => new ClaudeCodeAgent({
    role: 'reviewer',
    allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
    ...config
  })
});

// NEW AGENTS (easy to add!)
registry.register({
  name: 'security-scanner',
  description: 'Scans code for security vulnerabilities',
  capabilities: ['security', 'scanning', 'validation'],
  tools: ['Read', 'Bash(grep:*,find:*)'],
  estimatedCost: 0.015,
  factory: (config) => new ClaudeCodeAgent({
    role: 'security',
    allowedTools: ['Read', 'Bash(grep:*,find:*)'],
    ...config
  })
});

registry.register({
  name: 'documentation-writer',
  description: 'Writes and updates documentation',
  capabilities: ['documentation', 'writing'],
  tools: ['Read', 'Write', 'Edit'],
  estimatedCost: 0.025,
  factory: (config) => new ClaudeCodeAgent({
    role: 'documenter',
    allowedTools: ['Read', 'Write', 'Edit'],
    ...config
  })
});
```

---

### 2. Task Planner Agent

**Purpose**: Analyzes task and creates initial routing plan

**File**: `lib/task-planner.js` (new)

```javascript
export class TaskPlanner {
  constructor(registry, conversation) {
    this.registry = registry;
    this.conversation = conversation;
  }

  async planTask(task, containerTools, costMonitor) {
    // Use a lightweight agent to analyze task
    const plannerAgent = new ClaudeCodeAgent({
      role: 'planner',
      allowedTools: ['Read', 'Bash(ls:*,cat:*)'],
      workingDir: containerTools.workingDir
    });

    const availableAgents = this.registry.listAll()
      .map(a => `- ${a.name}: ${a.description} (capabilities: ${a.capabilities.join(', ')})`)
      .join('\n');

    const prompt = `You are a task planner. Analyze this task and determine which agents are needed.

**Task:** ${task}

**Available Agents:**
${availableAgents}

**Your job:**
1. Determine task type (analysis, implementation, documentation, etc.)
2. Select minimum agents needed (don't over-engineer)
3. Suggest execution order

Respond in JSON format:
{
  "taskType": "implementation|analysis|documentation|mixed",
  "agents": ["agent1", "agent2", ...],
  "reasoning": "why these agents",
  "estimatedDuration": "30s-5min",
  "complexity": "simple|medium|complex"
}`;

    const result = await plannerAgent.executeWithTools({
      initialPrompt: prompt,
      containerTools,
      costMonitor
    });

    // Parse JSON response
    const plan = this.parseTaskPlan(result.response);

    this.conversation.add('planner',
      `Task Plan:\n- Type: ${plan.taskType}\n- Agents: ${plan.agents.join(' → ')}\n- Reasoning: ${plan.reasoning}`,
      { duration: result.totalDuration, cost: result.cost },
      true
    );

    return plan;
  }

  parseTaskPlan(response) {
    // Extract JSON from response (handles markdown code blocks)
    const jsonMatch = response.match(/```json\n([\s\S]+?)\n```/) ||
                     response.match(/\{[\s\S]+\}/);

    if (jsonMatch) {
      const json = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(json);
    }

    // Fallback: default plan
    return {
      taskType: 'implementation',
      agents: ['architect', 'coder', 'reviewer'],
      reasoning: 'Default plan (JSON parse failed)',
      estimatedDuration: '3-5min',
      complexity: 'medium'
    };
  }
}
```

---

### 3. Dynamic Agent Executor

**Purpose**: Executes agents with handoff capability

**File**: `lib/dynamic-agent-executor.js` (new)

```javascript
export class DynamicAgentExecutor {
  constructor(registry, conversation, containerTools, costMonitor) {
    this.registry = registry;
    this.conversation = conversation;
    this.containerTools = containerTools;
    this.costMonitor = costMonitor;
    this.sessionId = uuidv4();
    this.executionHistory = [];
  }

  async execute(agentName, context) {
    const agentConfig = this.registry.get(agentName);
    if (!agentConfig) {
      throw new Error(`Agent '${agentName}' not found in registry`);
    }

    console.log(chalk.cyan(`\n🤖 ${agentConfig.name.toUpperCase()} Agent\n`));
    console.log(chalk.gray(`  ${agentConfig.description}\n`));

    // Create agent instance
    const agent = agentConfig.createInstance({
      sessionId: this.sessionId,
      resumeSession: this.executionHistory.length > 0, // Resume if not first
      workingDir: this.containerTools.workingDir
    });

    // Build prompt with handoff instructions
    const conversationContext = this.conversation.getHistory();
    const availableAgents = this.registry.listAll()
      .filter(a => a.name !== agentName) // Don't suggest self
      .map(a => `- ${a.name}: ${a.description}`)
      .join('\n');

    const prompt = this.buildPrompt(agentName, context, conversationContext, availableAgents);

    // Execute agent
    const result = await agent.executeWithTools({
      initialPrompt: prompt,
      containerTools: this.containerTools,
      costMonitor: this.costMonitor
    });

    // Record execution
    this.executionHistory.push({
      agent: agentName,
      timestamp: Date.now(),
      duration: result.totalDuration,
      cost: result.cost
    });

    // Add to conversation
    this.conversation.add(agentName, result.response, {
      duration: result.totalDuration,
      cost: result.cost
    }, true);

    // Parse agent's decision
    const decision = this.parseAgentDecision(result.response);

    return {
      agentName,
      result,
      decision
    };
  }

  buildPrompt(agentName, context, conversationContext, availableAgents) {
    return `You are the ${agentName} agent.

**Task:** ${context.task}

**Conversation Context:**
${conversationContext}

**Your Responsibilities:**
${this.registry.get(agentName).description}

**After completing your work, you must decide the next step:**

1. **Hand off to another agent** if more work is needed:
   Available agents:
   ${availableAgents}

2. **Mark task as complete** if no more work is needed.

**At the end of your response, include a decision in this format:**

NEXT: [agent-name] | COMPLETE
REASON: [why this next step]

Example decisions:
- "NEXT: coder | REASON: Implementation plan ready, code needs to be written"
- "NEXT: reviewer | REASON: Code complete, needs quality review"
- "NEXT: COMPLETE | REASON: Analysis finished, no code changes needed"

Now perform your work and decide the next step.`;
  }

  parseAgentDecision(response) {
    // Look for NEXT: and REASON: markers
    const nextMatch = response.match(/NEXT:\s*([^\n|]+)/i);
    const reasonMatch = response.match(/REASON:\s*([^\n]+)/i);

    if (!nextMatch) {
      // Default: assume task needs more work
      return {
        nextAgent: 'reviewer', // Safe default
        reason: 'No explicit decision found, routing to reviewer',
        isComplete: false
      };
    }

    const next = nextMatch[1].trim().toLowerCase();
    const reason = reasonMatch ? reasonMatch[1].trim() : 'No reason provided';

    return {
      nextAgent: next === 'complete' ? null : next,
      reason,
      isComplete: next === 'complete'
    };
  }
}
```

---

### 4. Dynamic Orchestrator

**Purpose**: Orchestrates dynamic workflow using planner and executor

**File**: `lib/dynamic-orchestrator.js` (new)

```javascript
import { AgentRegistry } from './agent-registry.js';
import { TaskPlanner } from './task-planner.js';
import { DynamicAgentExecutor } from './dynamic-agent-executor.js';
import { ConversationThread } from './conversation-thread.js';
import chalk from 'chalk';

export class DynamicOrchestrator {
  constructor() {
    this.registry = new AgentRegistry();
    this.initializeAgents();
  }

  initializeAgents() {
    // Register standard agents
    this.registry.register({
      name: 'architect',
      description: 'Analyzes project structure and creates implementation plans',
      capabilities: ['analysis', 'planning', 'architecture'],
      tools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
      estimatedCost: 0.02,
      factory: (config) => new ClaudeCodeAgent({
        role: 'architect',
        allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
        ...config
      })
    });

    this.registry.register({
      name: 'coder',
      description: 'Implements code changes, writes tests, fixes bugs',
      capabilities: ['implementation', 'coding', 'testing', 'debugging'],
      tools: ['Read', 'Write', 'Edit', 'Bash'],
      estimatedCost: 0.04,
      factory: (config) => new ClaudeCodeAgent({
        role: 'coder',
        allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
        ...config
      })
    });

    this.registry.register({
      name: 'reviewer',
      description: 'Reviews code quality, validates requirements, provides feedback',
      capabilities: ['review', 'quality-assurance', 'validation'],
      tools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
      estimatedCost: 0.02,
      factory: (config) => new ClaudeCodeAgent({
        role: 'reviewer',
        allowedTools: ['Read', 'Bash(ls:*,cat:*,find:*,grep:*)'],
        ...config
      })
    });

    // Can easily add more agents here
  }

  async executeTask(task, containerTools, costMonitor) {
    console.log(chalk.cyan.bold('\n🚀 Dynamic Agent System Starting\n'));

    const conversation = new ConversationThread();
    conversation.add('orchestrator', `Task: ${task}`, {}, true);

    // Step 1: Plan the task
    console.log(chalk.blue.bold('📋 Planning Task\n'));
    const planner = new TaskPlanner(this.registry, conversation);
    const plan = await planner.planTask(task, containerTools, costMonitor);

    console.log(chalk.green(`  ✅ Task plan ready: ${plan.agents.join(' → ')}\n`));

    // Step 2: Execute with dynamic routing
    console.log(chalk.blue.bold('🔄 Dynamic Agent Execution\n'));

    const executor = new DynamicAgentExecutor(
      this.registry,
      conversation,
      containerTools,
      costMonitor
    );

    let currentAgent = plan.agents[0]; // Start with first planned agent
    let iterationCount = 0;
    const maxIterations = 10; // Safety limit
    const visited = new Set();

    while (currentAgent && iterationCount < maxIterations) {
      iterationCount++;

      // Safety: detect infinite loops
      if (visited.has(currentAgent)) {
        console.log(chalk.yellow(`\n⚠️  Agent loop detected (${currentAgent} visited again), breaking\n`));
        break;
      }
      visited.add(currentAgent);

      // Execute current agent
      const execution = await executor.execute(currentAgent, { task });

      console.log(chalk.gray(`    Duration: ${(execution.result.totalDuration / 1000).toFixed(1)}s | Cost: $${(execution.result.cost || 0).toFixed(4)}`));
      console.log(chalk.cyan(`    Decision: ${execution.decision.isComplete ? '✅ COMPLETE' : `→ ${execution.decision.nextAgent}`}`));
      console.log(chalk.gray(`    Reason: ${execution.decision.reason}\n`));

      // Check if task is complete
      if (execution.decision.isComplete) {
        console.log(chalk.green.bold('\n✅ Task Complete!\n'));
        break;
      }

      // Move to next agent
      currentAgent = execution.decision.nextAgent;

      // Validate next agent exists
      if (currentAgent && !this.registry.get(currentAgent)) {
        console.log(chalk.yellow(`\n⚠️  Unknown agent '${currentAgent}', defaulting to reviewer\n`));
        currentAgent = 'reviewer';
      }
    }

    if (iterationCount >= maxIterations) {
      console.log(chalk.red('\n❌ Max iterations reached, stopping\n'));
    }

    // Return execution summary
    return {
      success: iterationCount < maxIterations,
      plan,
      executionHistory: executor.executionHistory,
      conversationHistory: conversation.getHistory(),
      totalCost: executor.executionHistory.reduce((sum, e) => sum + (e.cost || 0), 0),
      totalDuration: executor.executionHistory.reduce((sum, e) => sum + e.duration, 0)
    };
  }
}
```

---

## Integration with Current System

### Option 1: New Command (Recommended)

Add a new CLI command to test dynamic routing:

```bash
claude task-dynamic <project> "<description>"
```

**Benefits**:
- ✅ Keep existing system working
- ✅ A/B test both approaches
- ✅ Gradual migration path
- ✅ Fallback if dynamic has issues

### Option 2: Feature Flag

Add a config option:

```yaml
# project config
routing:
  mode: dynamic  # or 'classic'
```

### Option 3: Full Replacement

Replace entire orchestrator (risky, not recommended initially)

---

## Example Scenarios

### Scenario 1: Analysis-Only Task

**Task**: "Analyze the code quality and suggest improvements"

```
Planner: Detects analysis task
    ↓
Plan: [architect, reviewer] (skips coder!)
    ↓
Architect: Analyzes code quality
    NEXT: reviewer | REASON: Analysis complete, needs validation
    ↓
Reviewer: Validates analysis
    NEXT: COMPLETE | REASON: Analysis task finished, no code changes needed
    ↓
Done in 2 steps (saves ~126s by skipping coder)
```

### Scenario 2: Simple Bug Fix

**Task**: "Fix the typo in the error message"

```
Planner: Detects simple fix
    ↓
Plan: [coder, reviewer] (skips architect!)
    ↓
Coder: Fixes typo
    NEXT: reviewer | REASON: Simple change made, quick review needed
    ↓
Reviewer: Confirms fix
    NEXT: COMPLETE | REASON: Typo fixed correctly
    ↓
Done in 2 steps (saves ~55s by skipping architect)
```

### Scenario 3: Security-Critical Feature

**Task**: "Add user authentication with JWT"

```
Planner: Detects security-critical implementation
    ↓
Plan: [architect, security-scanner, coder, security-scanner, reviewer]
    ↓
Architect: Designs auth system
    NEXT: security-scanner | REASON: Security review before implementation
    ↓
Security Scanner: Reviews design for vulnerabilities
    NEXT: coder | REASON: Design is secure, ready to implement
    ↓
Coder: Implements JWT auth
    NEXT: security-scanner | REASON: Code complete, needs security scan
    ↓
Security Scanner: Scans for vulnerabilities
    NEXT: reviewer | REASON: No security issues found
    ↓
Reviewer: Final quality check
    NEXT: COMPLETE | REASON: Implementation secure and correct
    ↓
Done with security validation at each step
```

### Scenario 4: Agent Decides to Loop Back

**Task**: "Refactor the authentication module"

```
Architect: Creates refactoring plan
    NEXT: coder | REASON: Plan ready
    ↓
Coder: Refactors code
    NEXT: reviewer | REASON: Refactoring complete
    ↓
Reviewer: Finds architectural issue
    NEXT: architect | REASON: Refactoring changes architecture, need architect review
    ↓
Architect: Reviews and suggests adjustment
    NEXT: coder | REASON: Adjustment needed
    ↓
Coder: Makes adjustment
    NEXT: reviewer | REASON: Changes complete
    ↓
Reviewer: Approves
    NEXT: COMPLETE | REASON: All good
```

---

## Migration Path

### Phase 1: Build Infrastructure (Week 1)
- ✅ Create AgentRegistry
- ✅ Create TaskPlanner
- ✅ Create DynamicAgentExecutor
- ✅ Create DynamicOrchestrator
- ✅ Add tests

### Phase 2: Add CLI Command (Week 1)
- ✅ Add `claude task-dynamic` command
- ✅ Keep existing `claude task` unchanged
- ✅ Run parallel A/B testing

### Phase 3: Validation (Week 2)
- ✅ Test with 10+ different task types
- ✅ Compare performance vs classic
- ✅ Measure cost differences
- ✅ Validate quality of results

### Phase 4: Gradual Migration (Week 3)
- ✅ Add feature flag to projects
- ✅ Migrate low-risk projects first
- ✅ Monitor for issues
- ✅ Collect feedback

### Phase 5: Make Default (Week 4)
- ✅ Switch default to dynamic
- ✅ Keep classic as fallback
- ✅ Document differences
- ✅ Update guides

---

## Implementation Checklist

### Core Components
- [ ] Create `lib/agent-registry.js`
- [ ] Create `lib/task-planner.js`
- [ ] Create `lib/dynamic-agent-executor.js`
- [ ] Create `lib/dynamic-orchestrator.js`

### CLI Integration
- [ ] Add `task-dynamic` command to `cli.js`
- [ ] Add `--routing` flag to existing `task` command
- [ ] Update help text

### Testing
- [ ] Unit tests for AgentRegistry
- [ ] Unit tests for decision parsing
- [ ] Integration test: analysis-only task
- [ ] Integration test: simple implementation
- [ ] Integration test: complex with loops
- [ ] Performance comparison tests

### Documentation
- [ ] Update AGENT_SYSTEM_OVERVIEW.md
- [ ] Create DYNAMIC_ROUTING_GUIDE.md
- [ ] Add examples to README
- [ ] Document agent creation process

### New Agents (Easy Wins)
- [ ] Security Scanner agent
- [ ] Documentation Writer agent
- [ ] Test Engineer agent
- [ ] Performance Analyzer agent

---

## Benefits Over Current System

### Performance
- ✅ Skip unnecessary agents (20-50% faster for simple tasks)
- ✅ Analysis tasks don't waste time coding
- ✅ Simple fixes skip planning

### Flexibility
- ✅ Add agents without code changes
- ✅ Agents make intelligent decisions
- ✅ Adapt to task complexity

### Scalability
- ✅ Easy to add 20+ agents
- ✅ Agents can be specialized
- ✅ No hardcoded sequences

### Intelligence
- ✅ Task-aware routing
- ✅ Agents collaborate intelligently
- ✅ Self-correcting loops

---

## Risks & Mitigations

### Risk: Infinite Loops
**Mitigation**: Max iteration limit (10), loop detection, visited agent tracking

### Risk: Poor Agent Decisions
**Mitigation**: Task planner creates initial plan, agents have conversation context

### Risk: Higher Costs
**Mitigation**: Planner estimates cost upfront, monitoring and alerts

### Risk: Complexity Increases
**Mitigation**: Keep classic mode, feature flag, gradual rollout

### Risk: Worse Results
**Mitigation**: A/B testing, quality metrics, easy rollback

---

## Success Metrics

**Performance**:
- Analysis-only tasks: <60s (vs ~245s)
- Simple fixes: <90s (vs ~245s)
- Complex tasks: ~250s (similar to current)

**Quality**:
- Approval rate: >90% (current: 100%)
- Correct agent selection: >85%
- Unnecessary agent skips: <10%

**Cost**:
- Analysis tasks: <$0.04 (vs $0.08)
- Simple tasks: <$0.06 (vs $0.08)
- Complex tasks: ~$0.10 (similar)

---

**Status**: Ready to implement
**Next Step**: Create AgentRegistry and basic components
**Timeline**: 1-2 weeks for full implementation
**Risk Level**: Medium (new architecture, keep classic as fallback)
