/**
 * OrchestratorAgent - AI-powered task orchestration
 *
 * The orchestrator is itself an agent that:
 * 1. Analyzes incoming tasks
 * 2. Discovers available agents and tools
 * 3. Creates intelligent execution plans
 * 4. Coordinates agent communication
 */

import { ClaudeCodeAgent } from './claude-code-agent.js';
import chalk from 'chalk';

/**
 * Tools for the orchestrator to discover system capabilities
 */
export class OrchestratorTools {
  constructor(agentRegistry, toolRegistry) {
    this.agentRegistry = agentRegistry;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Get all available tools as a discovery function
   */
  getToolDefinitions() {
    return [
      {
        name: 'list_available_agents',
        description: 'List all available agents in the system with their capabilities, tools, and estimated costs. Use this to understand what agents can do before creating a plan.',
        input_schema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'list_available_tools',
        description: 'List all external tools (like sn-tools) available in the system. These tools can be used by agents for specialized tasks.',
        input_schema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_agent_details',
        description: 'Get detailed information about a specific agent including its full capabilities and system prompt.',
        input_schema: {
          type: 'object',
          properties: {
            agent_name: {
              type: 'string',
              description: 'Name of the agent to get details for'
            }
          },
          required: ['agent_name']
        }
      },
      {
        name: 'create_execution_plan',
        description: 'Create and output an execution plan for the task. This plan will be visible to all agents and the user.',
        input_schema: {
          type: 'object',
          properties: {
            task_analysis: {
              type: 'string',
              description: 'Your analysis of what the task requires'
            },
            agent_sequence: {
              type: 'array',
              items: { type: 'string' },
              description: 'Ordered list of agent names to execute'
            },
            workflow_type: {
              type: 'string',
              enum: ['sequential', 'parallel', 'conditional'],
              description: 'How agents should execute'
            },
            agent_instructions: {
              type: 'object',
              description: 'Specific instructions for each agent (agent_name -> instructions)'
            },
            success_criteria: {
              type: 'string',
              description: 'What constitutes successful completion'
            },
            estimated_cost: {
              type: 'number',
              description: 'Estimated total cost in USD'
            }
          },
          required: ['task_analysis', 'agent_sequence', 'workflow_type', 'success_criteria']
        }
      }
    ];
  }

  /**
   * Execute a tool call from the orchestrator
   */
  async executeTool(toolName, input) {
    switch (toolName) {
      case 'list_available_agents':
        return this.listAvailableAgents();

      case 'list_available_tools':
        return this.listAvailableTools();

      case 'get_agent_details':
        return this.getAgentDetails(input.agent_name);

      case 'create_execution_plan':
        return this.createExecutionPlan(input);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  /**
   * List all available agents
   */
  listAvailableAgents() {
    const agents = this.agentRegistry.listAll();

    return {
      agent_count: agents.length,
      agents: agents.map(agent => ({
        name: agent.name,
        description: agent.description,
        capabilities: agent.capabilities,
        tools: agent.tools,
        estimated_cost: agent.estimatedCost,
        read_only: agent.metadata?.readOnly || false
      }))
    };
  }

  /**
   * List all available external tools
   */
  listAvailableTools() {
    if (!this.toolRegistry) {
      return { tool_count: 0, tools: [] };
    }

    const tools = this.toolRegistry.getAllTools();

    return {
      tool_count: tools.length,
      tools: tools.map(tool => ({
        name: tool.name,
        version: tool.version,
        description: tool.description,
        capabilities: tool.capabilities || []
      }))
    };
  }

  /**
   * Get detailed information about a specific agent
   */
  getAgentDetails(agentName) {
    const agent = this.agentRegistry.get(agentName);

    if (!agent) {
      return { error: `Agent '${agentName}' not found` };
    }

    return {
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
      tools: agent.tools,
      estimated_cost: agent.estimatedCost,
      metadata: agent.metadata
    };
  }

  /**
   * Create and display execution plan
   */
  createExecutionPlan(plan) {
    // Validate agents exist
    const validation = this.agentRegistry.validateAgents(plan.agent_sequence);
    if (!validation.valid) {
      return {
        error: `Unknown agents in plan: ${validation.missing.join(', ')}`,
        valid: false
      };
    }

    // Calculate estimated cost
    const estimatedCost = plan.estimated_cost ||
      this.agentRegistry.estimateCost(plan.agent_sequence);

    // Format the plan for display
    const formattedPlan = {
      task_analysis: plan.task_analysis,
      agent_sequence: plan.agent_sequence,
      workflow_type: plan.workflow_type,
      agent_instructions: plan.agent_instructions || {},
      success_criteria: plan.success_criteria,
      estimated_cost: estimatedCost,
      valid: true
    };

    // Display plan to user
    this.displayPlan(formattedPlan);

    return formattedPlan;
  }

  /**
   * Display the plan in a user-friendly format
   */
  displayPlan(plan) {
    console.log('');
    console.log(chalk.cyan('  Execution Plan'));
    console.log(chalk.gray('  ────────────────────────────────────────'));
    console.log(chalk.white(`  Analysis: ${plan.task_analysis}`));
    console.log(chalk.cyan(`  Agents: ${plan.agent_sequence.join(' -> ')}`));
    console.log(chalk.gray(`  Workflow: ${plan.workflow_type}`));
    console.log(chalk.gray(`  Est. Cost: $${plan.estimated_cost.toFixed(4)}`));

    if (plan.agent_instructions && Object.keys(plan.agent_instructions).length > 0) {
      console.log(chalk.gray('  Agent Instructions:'));
      for (const [agent, instruction] of Object.entries(plan.agent_instructions)) {
        const instrStr = String(instruction || '');
        console.log(chalk.gray(`    ${agent}: ${instrStr.slice(0, 60)}${instrStr.length > 60 ? '...' : ''}`));
      }
    }

    console.log(chalk.gray(`  Success: ${plan.success_criteria}`));
    console.log('');
  }
}

/**
 * Create the orchestrator agent configuration
 */
export function createOrchestratorAgent(agentRegistry, toolRegistry, config = {}) {
  const orchestratorTools = new OrchestratorTools(agentRegistry, toolRegistry);

  return new ClaudeCodeAgent({
    role: 'orchestrator',
    model: config.model || 'haiku', // Use Haiku for fast planning
    allowedTools: ['Read', 'Bash(ls:*)'], // Basic exploration tools
    systemPrompt: `You are the **orchestrator** - the intelligent coordinator of a multi-agent system.

Your job is to:
1. **Analyze** the incoming task to understand what's needed
2. **Discover** available agents and tools using the discovery tools
3. **Plan** the optimal execution strategy
4. **Coordinate** by creating a clear plan that agents can follow

## Your Tools

You have special tools to discover system capabilities:
- \`list_available_agents\` - See all agents with their capabilities
- \`list_available_tools\` - See external tools (like sn-tools for ServiceNow)
- \`get_agent_details\` - Get full details about a specific agent
- \`create_execution_plan\` - Output your execution plan (REQUIRED)

## Planning Process

1. First, use \`list_available_agents\` to see what agents are available
2. Optionally use \`list_available_tools\` to see external tools
3. Analyze the task and decide which agents are needed
4. Use \`create_execution_plan\` to output your plan

## Plan Format

Your plan must include:
- **task_analysis**: What does this task require?
- **agent_sequence**: Which agents, in what order?
- **workflow_type**: "sequential" (one after another), "parallel" (simultaneous), or "conditional" (depends on results)
- **agent_instructions**: Specific guidance for each agent
- **success_criteria**: How do we know when we're done?

## Important Guidelines

- Simple questions (math, explanations) may only need the architect agent
- Implementation tasks typically need: architect -> coder -> reviewer
- Security-sensitive tasks should include the security agent
- Always include reviewer for code changes
- Consider using parallel execution when agents don't depend on each other

## Communication

Your plan will be visible to:
- The user (they see what you're planning)
- All agents (they can see the full plan and their instructions)

Be clear and specific in your instructions so agents understand their role.`,
    ...config
  });
}

/**
 * Register orchestrator as an agent in the registry
 */
export function registerOrchestratorAgent(registry, toolRegistry) {
  registry.register({
    name: 'orchestrator',
    description: 'Analyzes tasks, discovers available agents and tools, creates intelligent execution plans',
    capabilities: ['planning', 'coordination', 'analysis', 'discovery'],
    tools: ['list_available_agents', 'list_available_tools', 'get_agent_details', 'create_execution_plan'],
    estimatedCost: 0.005, // Very low cost for planning
    metadata: {
      color: 'cyan',
      icon: 'ORCH',
      readOnly: true,
      isOrchestrator: true
    },
    factory: (config) => createOrchestratorAgent(registry, toolRegistry, config)
  });

  return registry;
}
