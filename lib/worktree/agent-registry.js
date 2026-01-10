/**
 * Worktree Agent Registry
 *
 * Adapts existing agent definitions for use with Claude's native Task tool.
 * Each agent becomes a specialized prompt that can be passed to a Task subagent.
 *
 * Key differences from old system:
 * - No ClaudeCodeAgent wrapper - uses native Task tool
 * - Prompts are standalone - include full context
 * - Agents communicate via shared AgentConversation
 */

import { buildServiceNowPrompt } from '../servicenow-prompt-templates.js';

/**
 * Agent capability tags
 */
export const AgentCapability = {
  // General
  ANALYSIS: 'analysis',
  IMPLEMENTATION: 'implementation',
  REVIEW: 'review',
  DOCUMENTATION: 'documentation',

  // ServiceNow specific
  SN_API: 'servicenow-api',
  SN_FLOWS: 'servicenow-flows',
  SN_SCRIPTING: 'servicenow-scripting',
  SN_UI: 'servicenow-ui',
  SN_INTEGRATION: 'servicenow-integration',
  SN_SECURITY: 'servicenow-security',
  SN_TESTING: 'servicenow-testing',
  SN_PERFORMANCE: 'servicenow-performance'
};

/**
 * Recommended subagent types for different tasks
 */
export const SubagentType = {
  EXPLORE: 'Explore',        // For codebase exploration
  PLAN: 'Plan',              // For planning/architecture
  BASH: 'Bash',              // For command execution
  GENERAL: 'general-purpose' // For general multi-step tasks
};

/**
 * Agent definition structure for worktree system
 */
class WorktreeAgent {
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.capabilities = config.capabilities || [];
    this.systemPrompt = config.systemPrompt;
    this.subagentType = config.subagentType || SubagentType.GENERAL;
    this.model = config.model || 'sonnet';
    this.estimatedCost = config.estimatedCost || 0.05;
    this.metadata = config.metadata || {};

    // MCP tools this agent should use
    this.mcpTools = config.mcpTools || [];

    // Handoff preferences - which agents to route to next
    this.handoffPreferences = config.handoffPreferences || {};
  }

  /**
   * Build the full prompt for this agent including conversation context
   */
  buildPrompt(task, conversationContext = '') {
    const parts = [];

    // System identity
    parts.push(this.systemPrompt);

    // Conversation context (if any)
    if (conversationContext) {
      parts.push('\n---\n## Prior Conversation\n' + conversationContext);
    }

    // Current task
    parts.push('\n---\n## Your Task\n' + task);

    // Communication instructions
    parts.push(`
---
## Communication Protocol

You are part of a multi-agent team. Follow these communication rules:

1. **State your understanding** - Start by summarizing what you understand needs to be done
2. **Report your findings** - Share what you discover or implement
3. **Recommend next steps** - Suggest which agent should continue, using format:

   HANDOFF: [agent-name]
   REASON: [why this agent should continue]

4. **Ask for clarification** - If something is unclear, ask in your response

Available agents you can hand off to:
- **architect**: For analysis, planning, architecture decisions
- **coder**: For implementation, code changes
- **reviewer**: For code review, validation
- **sn-api**: For ServiceNow REST API work
- **sn-ui**: For ServiceNow UI/Portal work
- **sn-scripting**: For ServiceNow scripts (Business Rules, Script Includes)
- **sn-integration**: For ServiceNow integrations

If your work is complete and no handoff is needed, end with:
COMPLETE: [summary of what was accomplished]
`);

    return parts.join('\n');
  }

  /**
   * Get Task tool configuration for this agent
   */
  getTaskConfig(task, conversationContext = '') {
    return {
      description: `${this.name}: ${task.substring(0, 50)}...`,
      prompt: this.buildPrompt(task, conversationContext),
      subagent_type: this.subagentType,
      model: this.model
    };
  }
}

/**
 * Worktree Agent Registry
 */
export class WorktreeAgentRegistry {
  constructor() {
    this.agents = new Map();
    this._registerStandardAgents();
    this._registerServiceNowAgents();
  }

  /**
   * Register standard agents (architect, coder, reviewer, documenter)
   */
  _registerStandardAgents() {
    // Architect - Analysis and planning
    this.register(new WorktreeAgent({
      name: 'architect',
      description: 'Software architect for analysis, planning, and design decisions',
      capabilities: [AgentCapability.ANALYSIS],
      subagentType: SubagentType.PLAN,
      model: 'sonnet',
      estimatedCost: 0.03,
      systemPrompt: `You are a software architect. Your role is to:

1. **Analyze** - Understand the codebase, requirements, and constraints
2. **Plan** - Design solutions and implementation approaches
3. **Guide** - Provide clear direction for implementation

When analyzing a task:
- Explore the relevant code using available tools
- Identify existing patterns and conventions
- Consider impact on existing functionality
- Think about testing requirements

When planning:
- Break down into clear, actionable steps
- Identify dependencies between steps
- Consider edge cases and error handling
- Estimate complexity and effort

Your output should be:
- A clear analysis of the current state
- A structured implementation plan
- Specific guidance for the implementing agent`,
      handoffPreferences: {
        implementation: 'coder',
        review: 'reviewer',
        servicenow: 'sn-scripting'
      }
    }));

    // Coder - Implementation
    this.register(new WorktreeAgent({
      name: 'coder',
      description: 'Software engineer for implementation and code changes',
      capabilities: [AgentCapability.IMPLEMENTATION],
      subagentType: SubagentType.GENERAL,
      model: 'sonnet',
      estimatedCost: 0.08,
      systemPrompt: `You are a software engineer. Your role is to:

1. **Implement** - Write clean, tested, production-quality code
2. **Follow patterns** - Match existing code style and conventions
3. **Test** - Ensure your changes work correctly

Implementation guidelines:
- Read existing code before making changes
- Follow the patterns you find in the codebase
- Write minimal, focused changes
- Add tests for new functionality
- Handle errors gracefully

Code quality requirements:
- Clear, readable code
- Appropriate comments for complex logic
- No security vulnerabilities
- Efficient algorithms

After implementation:
- Verify the code compiles/runs
- Run relevant tests
- Document any manual testing done`,
      handoffPreferences: {
        review: 'reviewer',
        planning: 'architect'
      }
    }));

    // Reviewer - Code review and validation
    this.register(new WorktreeAgent({
      name: 'reviewer',
      description: 'Code reviewer for quality assurance and validation',
      capabilities: [AgentCapability.REVIEW],
      subagentType: SubagentType.EXPLORE,
      model: 'sonnet',
      estimatedCost: 0.03,
      systemPrompt: `You are a code reviewer. Your role is to:

1. **Review** - Examine code changes for quality and correctness
2. **Validate** - Ensure changes meet requirements
3. **Approve or Request Changes** - Provide clear feedback

Review checklist:
- [ ] Code correctness - Does it do what it should?
- [ ] Code quality - Is it readable, maintainable?
- [ ] Security - Any vulnerabilities introduced?
- [ ] Performance - Any performance concerns?
- [ ] Tests - Are there adequate tests?
- [ ] Documentation - Is it properly documented?

Your review output should:
- List specific issues found (with file:line references)
- Categorize as: BLOCKER, WARNING, or SUGGESTION
- Provide concrete fix recommendations

Final verdict:
- APPROVED: Code is ready to merge
- CHANGES_REQUESTED: Specific changes needed (list them)
- NEEDS_DISCUSSION: Architectural concerns to discuss`,
      handoffPreferences: {
        fixes: 'coder',
        architecture: 'architect'
      }
    }));

    // Documenter
    this.register(new WorktreeAgent({
      name: 'documenter',
      description: 'Technical writer for documentation and communication',
      capabilities: [AgentCapability.DOCUMENTATION],
      subagentType: SubagentType.GENERAL,
      model: 'haiku',
      estimatedCost: 0.02,
      systemPrompt: `You are a technical writer. Your role is to:

1. **Document** - Create clear, useful documentation
2. **Explain** - Make complex concepts understandable
3. **Communicate** - Write for your audience

Documentation principles:
- Write for the reader, not yourself
- Use clear, simple language
- Include examples
- Keep it up to date
- Structure logically

Types of documentation:
- Code comments - Explain WHY, not WHAT
- README files - Getting started, setup, usage
- API docs - Endpoints, parameters, responses
- Architecture docs - System design, decisions`
    }));
  }

  /**
   * Register ServiceNow-specific agents
   */
  _registerServiceNowAgents() {
    // SN-API - ServiceNow REST API specialist
    this.register(new WorktreeAgent({
      name: 'sn-api',
      description: 'ServiceNow REST API specialist',
      capabilities: [AgentCapability.SN_API, AgentCapability.IMPLEMENTATION],
      subagentType: SubagentType.GENERAL,
      model: 'sonnet',
      estimatedCost: 0.05,
      mcpTools: ['trace_component_impact', 'trace_full_lineage', 'query_table_schema'],
      systemPrompt: buildServiceNowPrompt({
        basePrompt: `You are a ServiceNow REST API specialist.

MANDATORY CHECKLIST - Before ANY API work:

1. [ ] Trace API dependencies using MCP tools:
   - Use trace_full_lineage with entity_type="api"
   - Check what calls this API and what it calls

2. [ ] Understand table access:
   - Use query_table_schema for tables the API touches
   - Document CRUD operations

3. [ ] Check impact:
   - Use validate_change_impact before modifications

You excel at:
- Designing Scripted REST APIs
- API authentication and error handling
- GlideRecord/GlideQuery efficient usage
- Following ServiceNow API best practices

NEVER guess dependencies - ALWAYS verify with MCP tools first.`,
        standards: {
          includeEffort: true,
          includeSecurity: true,
          includePerformance: true,
          includeDependencies: true,
          includeRollback: true
        }
      }),
      handoffPreferences: {
        ui: 'sn-ui',
        scripting: 'sn-scripting',
        review: 'reviewer'
      }
    }));

    // SN-UI - ServiceNow UI specialist
    this.register(new WorktreeAgent({
      name: 'sn-ui',
      description: 'ServiceNow UI and Service Portal specialist',
      capabilities: [AgentCapability.SN_UI, AgentCapability.IMPLEMENTATION],
      subagentType: SubagentType.GENERAL,
      model: 'sonnet',
      estimatedCost: 0.05,
      mcpTools: ['trace_component_impact', 'trace_full_lineage'],
      systemPrompt: buildServiceNowPrompt({
        basePrompt: `You are a ServiceNow UI specialist.

MANDATORY CHECKLIST - Before ANY UI work:

1. [ ] Trace component dependencies using MCP tools:
   - Use trace_component_impact for the component
   - Document: Component → API → Script → Table lineage

2. [ ] Document CRUD operations:
   - Create table showing Table | CREATE | READ | UPDATE | DELETE
   - Mark with checkmarks

3. [ ] Create lineage diagram (Mermaid format)

You excel at:
- Service Portal widgets (AngularJS)
- UI Builder components (React/Web Components)
- UI Pages and UI Macros
- $sp, spUtil, and GlideAjax
- CSS/SASS and accessibility

WHEN ASKED about table access:
- ALWAYS use trace_component_impact first
- Document complete lineage
- NEVER guess`,
        standards: {
          includeEffort: true,
          includeSecurity: true,
          includePerformance: true,
          includeDependencies: true,
          includeRollback: true
        }
      }),
      handoffPreferences: {
        api: 'sn-api',
        scripting: 'sn-scripting',
        review: 'reviewer'
      }
    }));

    // SN-Scripting - Business Rules, Script Includes
    this.register(new WorktreeAgent({
      name: 'sn-scripting',
      description: 'ServiceNow scripting specialist (Business Rules, Script Includes)',
      capabilities: [AgentCapability.SN_SCRIPTING, AgentCapability.IMPLEMENTATION],
      subagentType: SubagentType.GENERAL,
      model: 'sonnet',
      estimatedCost: 0.05,
      mcpTools: ['trace_full_lineage', 'analyze_script_crud', 'validate_change_impact'],
      systemPrompt: buildServiceNowPrompt({
        basePrompt: `You are a ServiceNow scripting specialist.

MANDATORY CHECKLIST - Before modifying ANY Script Include:

1. [ ] Run trace_full_lineage with entity_type="script"
   - See what calls this script and what it calls

2. [ ] Check CRUD operations with analyze_script_crud
   - Understand database operations

3. [ ] Validate change impact
   - Use validate_change_impact before modifications

AFTER creating ANY Script Include or Business Rule:

4. [ ] Validate using MCP tools (NOT OPTIONAL!)
5. [ ] Include validation output in deliverables
6. [ ] Fix issues found BEFORE marking complete

You excel at:
- Business Rules (before/after, async/sync)
- Script Includes
- GlideRecord, GlideQuery
- Performance optimization
- Security best practices

NEVER modify scripts without first understanding dependencies.`,
        standards: {
          includeEffort: true,
          includeSecurity: true,
          includePerformance: true,
          includeDependencies: true,
          includeRollback: true
        }
      }),
      handoffPreferences: {
        api: 'sn-api',
        ui: 'sn-ui',
        review: 'reviewer'
      }
    }));

    // SN-Integration - External system integration
    this.register(new WorktreeAgent({
      name: 'sn-integration',
      description: 'ServiceNow integration specialist',
      capabilities: [AgentCapability.SN_INTEGRATION, AgentCapability.IMPLEMENTATION],
      subagentType: SubagentType.GENERAL,
      model: 'sonnet',
      estimatedCost: 0.05,
      mcpTools: ['trace_table_dependencies', 'query_table_schema'],
      systemPrompt: buildServiceNowPrompt({
        basePrompt: `You are a ServiceNow integration specialist.

MANDATORY CHECKLIST - Before creating integrations:

1. [ ] Analyze target table dependencies
   - Use trace_table_dependencies for the target table

2. [ ] Check table schema
   - Use query_table_schema for field types and relationships

3. [ ] Document table relationships
   - Create ERD in Mermaid format
   - Document reference fields

You excel at:
- REST/SOAP integrations
- Import Sets and Transform Maps
- ETL processes with error handling
- Table relationship analysis

ALWAYS use MCP tools to verify relationships - NEVER guess.`,
        standards: {
          includeEffort: true,
          includeSecurity: true,
          includePerformance: true,
          includeDependencies: true,
          includeRollback: true
        }
      }),
      handoffPreferences: {
        api: 'sn-api',
        scripting: 'sn-scripting',
        review: 'reviewer'
      }
    }));

    // SN-Security - ACLs and security
    this.register(new WorktreeAgent({
      name: 'sn-security',
      description: 'ServiceNow security specialist (ACLs, security rules)',
      capabilities: [AgentCapability.SN_SECURITY, AgentCapability.REVIEW],
      subagentType: SubagentType.EXPLORE,
      model: 'haiku',
      estimatedCost: 0.02,
      systemPrompt: buildServiceNowPrompt({
        basePrompt: `You are a ServiceNow security specialist.

You excel at:
- ACLs (table, field, record-level)
- Security rules and data policies
- Identifying security vulnerabilities
- Input validation and XSS prevention
- OWASP guidelines for ServiceNow
- Role-based access control
- Secure API design

Your security review should:
1. Identify specific vulnerabilities
2. Categorize severity (CRITICAL, HIGH, MEDIUM, LOW)
3. Provide concrete remediation steps
4. Reference relevant ServiceNow security best practices`,
        standards: {
          includeSecurity: true,
          includePerformance: true
        }
      }),
      handoffPreferences: {
        fixes: 'sn-scripting',
        architecture: 'architect'
      }
    }));
  }

  /**
   * Register an agent
   */
  register(agent) {
    this.agents.set(agent.name, agent);
    return this;
  }

  /**
   * Get agent by name
   */
  get(name) {
    return this.agents.get(name);
  }

  /**
   * Get all agent names
   */
  getAgentNames() {
    return Array.from(this.agents.keys());
  }

  /**
   * Get agents by capability
   */
  getByCapability(capability) {
    return Array.from(this.agents.values())
      .filter(agent => agent.capabilities.includes(capability));
  }

  /**
   * Find best agent for a task based on keywords
   */
  findAgentForTask(taskDescription) {
    const task = taskDescription.toLowerCase();

    // ServiceNow-specific routing
    if (task.includes('api') || task.includes('rest') || task.includes('endpoint')) {
      return this.get('sn-api');
    }
    if (task.includes('portal') || task.includes('widget') || task.includes('ui builder') || task.includes('component')) {
      return this.get('sn-ui');
    }
    if (task.includes('script include') || task.includes('business rule') || task.includes('gliderecord')) {
      return this.get('sn-scripting');
    }
    if (task.includes('integration') || task.includes('import') || task.includes('etl')) {
      return this.get('sn-integration');
    }
    if (task.includes('acl') || task.includes('security') || task.includes('permission')) {
      return this.get('sn-security');
    }

    // General routing
    if (task.includes('analyze') || task.includes('plan') || task.includes('design') || task.includes('architecture')) {
      return this.get('architect');
    }
    if (task.includes('implement') || task.includes('create') || task.includes('build') || task.includes('fix')) {
      return this.get('coder');
    }
    if (task.includes('review') || task.includes('check') || task.includes('validate')) {
      return this.get('reviewer');
    }
    if (task.includes('document') || task.includes('readme') || task.includes('explain')) {
      return this.get('documenter');
    }

    // Default to architect for analysis
    return this.get('architect');
  }

  /**
   * Get agent for handoff based on context
   */
  getHandoffAgent(currentAgentName, reason) {
    const currentAgent = this.get(currentAgentName);
    if (!currentAgent) return this.get('architect');

    const reasonLower = reason.toLowerCase();

    // Check handoff preferences
    for (const [key, targetAgent] of Object.entries(currentAgent.handoffPreferences)) {
      if (reasonLower.includes(key)) {
        return this.get(targetAgent);
      }
    }

    // Default handoffs
    if (reasonLower.includes('implement') || reasonLower.includes('code')) {
      return this.get('coder');
    }
    if (reasonLower.includes('review') || reasonLower.includes('check')) {
      return this.get('reviewer');
    }
    if (reasonLower.includes('plan') || reasonLower.includes('analyze')) {
      return this.get('architect');
    }

    return this.get('reviewer'); // Default to reviewer
  }
}

// Singleton instance
let registryInstance = null;

export function getAgentRegistry() {
  if (!registryInstance) {
    registryInstance = new WorktreeAgentRegistry();
  }
  return registryInstance;
}

export default WorktreeAgentRegistry;
