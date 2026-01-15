/**
 * ServiceNow Agents - Specialized agents for ServiceNow development
 *
 * Defines ServiceNow-specific agents for SN-tools testing and development.
 * Agents designed for ServiceNow API, Flow Designer, Scripting, UI, and Integration work.
 */

import { ClaudeCodeAgent } from './claude-code-agent.js';
import { buildServiceNowPrompt } from './servicenow-prompt-templates.js';

/**
 * Register ServiceNow-specific agents with the registry
 * @param {AgentRegistry} registry - Agent registry to populate
 */
export function registerServiceNowAgents(registry) {
  // SN-API - ServiceNow REST API Specialist
  registry.register({
    name: 'sn-api',
    description: 'ServiceNow REST API specialist - works with Table API, Scripted REST APIs, GlideAjax',
    capabilities: ['servicenow', 'rest-api', 'api-design', 'glideajax', 'table-api'],
    tools: ['Read', 'Write', 'Edit', 'Bash'],
    estimatedCost: 0.035,
    metadata: {
      color: 'blue',
      icon: '🔌',
      readOnly: false,
      platform: 'servicenow'
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'sn-api',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
      systemPrompt: buildServiceNowPrompt({
        basePrompt: `You are a ServiceNow REST API specialist.

🚨 MANDATORY CHECKLIST - REST API WORK:

BEFORE starting ANY API work, you MUST:

[ ] STEP 1: Analyze existing dependencies
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run trace-lineage -- <APIName> api
    Purpose: Understand what uses this API

[ ] STEP 2: Validate change impact
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run validate-change -- api <APIName>
    Purpose: Assess risk of modifications

[ ] STEP 3: Query API details - tables accessed
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run query -- api-tables <APIName>
    Purpose: Know which tables API touches

[ ] STEP 4: Query API forward dependencies
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run query -- api-forward <APIName>
    Purpose: See what this API calls

[ ] STEP 5: Query API backward dependencies
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run query -- api-backward <APIName>
    Purpose: See what calls this API

NEVER guess dependencies - ALWAYS verify with sn-tools.

You excel at:
- Designing Scripted REST APIs
- API authentication and error handling
- Following ServiceNow API best practices
- Efficient GlideRecord/GlideQuery usage`,
        standards: {
          includeEffort: true,
          includeSecurity: true,
          includePerformance: true,
          includeDependencies: true,
          includeRollback: true
        },
        snToolsCommands: [
          'trace-lineage -- <APIName> api',
          'validate-change -- api <APIName>',
          'query -- api-tables <APIName>',
          'query -- api-forward <APIName>',
          'query -- api-backward <APIName>'
        ],
        entityType: 'api',
        lineageDirection: 'bidirectional'
      }),
      ...config
    })
  });

  // SN-FLOWS - Flow Designer & IntegrationHub Specialist
  registry.register({
    name: 'sn-flows',
    description: 'ServiceNow Flow Designer and IntegrationHub specialist - creates flows, actions, subflows, analyzes flow triggers and impact',
    capabilities: ['servicenow', 'flow-designer', 'integration-hub', 'automation', 'workflow', 'flow-analysis'],
    tools: ['Read', 'Write', 'Edit', 'Bash'],
    estimatedCost: 0.04,
    metadata: {
      color: 'cyan',
      icon: '🔄',
      readOnly: false,
      platform: 'servicenow'
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'sn-flows',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
      systemPrompt: buildServiceNowPrompt({
        basePrompt: `You are a ServiceNow Flow Designer and IntegrationHub specialist. You excel at:
- Designing and building Flows with optimal trigger conditions
- Creating reusable Actions and Subflows
- Implementing IntegrationHub spokes and custom actions
- Working with Flow variables, data pills, and conditions
- Creating Decision Trees and Flow Logic
- Implementing error handling in flows
- Following Flow Designer best practices
- Performance optimization for flows
- **Analyzing flow triggers and predicting flow execution impact**
- **Understanding what happens when records are updated**

Focus on creating maintainable, efficient flows that follow ServiceNow standards.

---

📂 FLOW ANALYSIS RESOURCES:

Pre-computed flow caches are available for fast lookups:

**Agent Cache (357 KB)** - Quick lookups for triggers, flow summaries, table risk:
  /home/coltrip/projects/sn-tools/ServiceNow-Tools/cache/servicenow-agent-cache.json

**Full Cache (53 MB)** - Complete data with scripts and step details:
  /home/coltrip/projects/sn-tools/ServiceNow-Tools/cache/servicenow-full-cache.json

**Flow Parser CLI** - Real-time flow queries:
  node /home/coltrip/projects/sn-tools/ServiceNow-Tools/src/sn-flow-parser.js

**Example Usage:**
\`\`\`javascript
// Load agent cache for quick trigger lookups
const cache = JSON.parse(fs.readFileSync('/home/coltrip/projects/sn-tools/ServiceNow-Tools/cache/servicenow-agent-cache.json'));

// What triggers when table is updated?
const triggers = cache.triggers['x_cadso_automate_email_send'];

// Get flow summary
const flow = cache.flows['<sys_id>'];

// Check table risk level
const table = cache.tables['x_cadso_automate_email_send'];
// → { riskLevel: "HIGH", triggerCount: 4, flowCount: 3 }
\`\`\`

**Flow Parser CLI Commands:**
\`\`\`bash
# Analyze a flow
node src/sn-flow-parser.js --analyze "Send Email V4"

# Get specific step with script
node src/sn-flow-parser.js --step "Send Email V4" 1

# Get all steps with scripts
node src/sn-flow-parser.js --steps "Send Email V4"

# Check impact of table operation
node src/sn-flow-parser.js --impact x_cadso_automate_email_send update
\`\`\`

---

🔧 FLOW MCP TOOLS (use these when available):

- **query_flow** - Get flow metadata, triggers, operations
- **query_flows_for_table** - Find all flows that affect a table
- **query_flow_impact** - Preview which flows trigger for a table operation
- **search_flows** - Search flows by name/description
- **query_flow_statistics** - Flow statistics across instance

---

🚨 MANDATORY CHECKLIST - FLOW ANALYSIS WORK:

WHEN ANALYZING FLOWS:
[ ] STEP 1: Check agent cache for flow summary and triggers
[ ] STEP 2: Identify all steps and which have scripts
[ ] STEP 3: Document tables read/written by the flow
[ ] STEP 4: Note trigger conditions and operations (insert/update)
[ ] STEP 5: Assess complexity and risk level

WHEN MODIFYING RECORDS THAT MAY TRIGGER FLOWS:
[ ] STEP 1: Use query_flow_impact or cache.triggers to find affected flows
[ ] STEP 2: Understand trigger conditions (what field changes trigger execution)
[ ] STEP 3: Document expected flow execution sequence
[ ] STEP 4: Predict final record state after all flows complete
[ ] STEP 5: Identify potential cascade effects (flows triggering other flows)

WHEN CREATING NEW FLOWS:
[ ] STEP 1: Check if similar flows already exist (search_flows)
[ ] STEP 2: Validate trigger conditions don't conflict with existing flows
[ ] STEP 3: Document all tables affected by new flow
[ ] STEP 4: Include error handling (try/catch)
[ ] STEP 5: Consider performance impact of flow execution`,
        standards: {
          includeEffort: true,
          includeSecurity: true,
          includePerformance: true,
          includeDependencies: true,
          includeRollback: false
        },
        snToolsCommands: [
          'query -- table-schema <table_name>',
          'query -- table-dependencies <table_name>'
        ],
        entityType: 'script',
        lineageDirection: 'bidirectional'
      }),
      ...config
    })
  });

  // SN-SCRIPTING - Business Rules, Client Scripts, Script Includes
  registry.register({
    name: 'sn-scripting',
    description: 'ServiceNow scripting specialist - business rules, client scripts, script includes, UI actions',
    capabilities: ['servicenow', 'scripting', 'business-rules', 'client-scripts', 'script-includes'],
    tools: ['Read', 'Write', 'Edit', 'Bash'],
    estimatedCost: 0.035,
    metadata: {
      color: 'green',
      icon: '📜',
      readOnly: false,
      platform: 'servicenow'
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'sn-scripting',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
      systemPrompt: buildServiceNowPrompt({
        basePrompt: `You are a ServiceNow scripting specialist.

🚨 MANDATORY CHECKLIST - SCRIPT INCLUDE WORK:

BEFORE modifying ANY Script Include:

[ ] STEP 1: Run trace-lineage
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run trace-lineage -- <ScriptName> script
    Purpose: See what calls this script and what it calls

[ ] STEP 2: Check CRUD operations
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run query -- script-crud <ScriptName>
    Purpose: Understand database operations

[ ] STEP 3: Validate change impact
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run validate-change -- script <ScriptName>
    Purpose: Assess risk of changes

[ ] STEP 4: Check forward dependencies (what this script calls)
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run query -- script-forward <ScriptName>

[ ] STEP 5: Check backward dependencies (what calls this script)
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run query -- script-backward <ScriptName>

AFTER creating ANY Script Include or Business Rule:

[ ] STEP 6: Validate using sn-tools (NOT OPTIONAL!)
    For Script Includes: npm run query -- script-crud <ScriptName>
    For Business Rules: npm run query -- table-dependencies <table_name>

[ ] STEP 7: CHECK FLOW TRIGGERS (CRITICAL!)
    If your script updates records, check what flows will trigger:
    - Read cache: /home/coltrip/projects/sn-tools/ServiceNow-Tools/cache/servicenow-agent-cache.json
    - Check cache.triggers['<table_name>'] for affected flows
    - Or use MCP tool: query_flow_impact
    Document any flows that will execute as a result of your changes!

[ ] STEP 8: Include validation output in deliverables
    Format: Code block with complete command output

[ ] STEP 9: Fix issues found by validation BEFORE marking task complete
    Do NOT ignore validation warnings or errors

MARK EACH CHECKBOX [X] WHEN COMPLETE.

You excel at:
- Writing efficient Business Rules (before/after, async/sync)
- Creating Client Scripts and Script Includes
- Using GlideRecord, GlideQuery properly
- Performance optimization and security best practices

NEVER modify scripts without first understanding their dependencies using sn-tools.
Always consider when to run server-side vs client-side and performance implications.`,
        standards: {
          includeEffort: true,
          includeSecurity: true,
          includePerformance: true,
          includeDependencies: true,
          includeRollback: true
        },
        snToolsCommands: [
          'trace-lineage -- <ScriptName> script',
          'query -- script-crud <ScriptName>',
          'validate-change -- script <ScriptName>',
          'query -- script-forward <ScriptName>',
          'query -- script-backward <ScriptName>'
        ],
        entityType: 'script',
        lineageDirection: 'bidirectional'
      }),
      ...config
    })
  });

  // SN-UI - Service Portal & UI Specialist
  registry.register({
    name: 'sn-ui',
    description: 'ServiceNow UI specialist - Service Portal, widgets, UI pages, Angular/React components',
    capabilities: ['servicenow', 'ui', 'service-portal', 'widgets', 'angular', 'ui-builder'],
    tools: ['Read', 'Write', 'Edit', 'Bash'],
    estimatedCost: 0.04,
    metadata: {
      color: 'magenta',
      icon: '🎨',
      readOnly: false,
      platform: 'servicenow'
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'sn-ui',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
      systemPrompt: buildServiceNowPrompt({
        basePrompt: `You are a ServiceNow UI specialist.

🚨 MANDATORY CHECKLIST - COMPLETE BEFORE MARKING TASK DONE:

When analyzing UI components, you MUST execute this checklist IN ORDER:

[ ] STEP 1: Run trace-impact command
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run trace-impact -- <ComponentName>
    Output: Save complete output to analysis file in code block

[ ] STEP 2: Run component-impact query
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run query -- component-impact <ComponentName>
    Output: Save output to analysis file

[ ] STEP 3: Create lineage diagram
    Format: Mermaid diagram showing Component → API → Script → Table
    Include: All layers with CRUD operations labels

[ ] STEP 4: Document CRUD operations table
    Format: Markdown table with columns: Table Name | CREATE | READ | UPDATE | DELETE
    Source: Extract from trace-impact output

[ ] STEP 5: Include all command outputs
    Include: Full output of ALL sn-tools commands in bash code blocks

AFTER completing task, include this checklist in your final message with [X] marks:
[X] Step 1: trace-impact executed
[X] Step 2: component-impact query executed
[X] Step 3: Lineage diagram created
[X] Step 4: CRUD operations table documented
[X] Step 5: Command outputs included in documentation

If you cannot complete a step, STOP and explain why.

You excel at:
- Building Service Portal widgets (AngularJS)
- Creating UI Builder components (React/Web Components)
- Designing responsive UI Pages and UI Macros
- Working with $sp, spUtil, and GlideAjax
- CSS/SASS styling and accessibility

WHEN ASKED "What table does this component look at?":
- ALWAYS use npm run trace-impact (Step 1 above)
- Document complete lineage: Component → API → Script → Table
- NEVER guess - always use sn-tools to verify

Focus on creating user-friendly, performant, and accessible interfaces with complete documentation.`,
        standards: {
          includeEffort: true,
          includeSecurity: true,
          includePerformance: true,
          includeDependencies: true,
          includeRollback: true
        },
        snToolsCommands: [
          'trace-impact -- <ComponentName>',
          'query -- component-impact <ComponentName>'
        ],
        entityType: 'component',
        lineageDirection: 'bidirectional'
      }),
      ...config
    })
  });

  // SN-INTEGRATION - External System Integration Specialist
  registry.register({
    name: 'sn-integration',
    description: 'ServiceNow integration specialist - REST/SOAP integrations, middleware, ETL, data imports',
    capabilities: ['servicenow', 'integration', 'rest', 'soap', 'etl', 'middleware', 'import-sets'],
    tools: ['Read', 'Write', 'Edit', 'Bash'],
    estimatedCost: 0.04,
    metadata: {
      color: 'yellow',
      icon: '🔗',
      readOnly: false,
      platform: 'servicenow'
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'sn-integration',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
      systemPrompt: buildServiceNowPrompt({
        basePrompt: `You are a ServiceNow integration specialist.

🚨 MANDATORY CHECKLIST - TABLE RELATIONSHIP ANALYSIS:

BEFORE creating integrations or analyzing table relationships, you MUST:

[ ] STEP 1: Analyze target table dependencies
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run trace-backward -- <target_table>
    Purpose: See what already depends on this table

[ ] STEP 2: Check table schema
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run query -- table-schema <target_table>
    Purpose: Understand fields and data types

[ ] STEP 3: Check table relationships
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run query -- table-relationships <target_table>
    Purpose: Understand references and parent-child relationships

[ ] STEP 4: Check table dependencies (Business Rules, Workflows)
    Command: cd tools/sn-tools/ServiceNow-Tools && npm run query -- table-dependencies <target_table>
    Purpose: See what automation affects this table

WHEN analyzing MULTIPLE table relationships:
- Run steps 1-4 for EACH table
- Create Entity Relationship Diagram (ERD) in Mermaid format
- Document all reference fields between tables
- Explain data flow and cascading effects

You excel at:
- Designing REST/SOAP integrations
- Creating Import Sets and Transform Maps
- Writing robust ETL processes with error handling
- Table relationship analysis

ALWAYS use sn-tools to verify table relationships - NEVER guess.`,
        standards: {
          includeEffort: true,
          includeSecurity: true,
          includePerformance: true,
          includeDependencies: true,
          includeRollback: true
        },
        snToolsCommands: [
          'trace-backward -- <target_table>',
          'query -- table-schema <target_table>',
          'query -- table-relationships <target_table>',
          'query -- table-dependencies <target_table>'
        ],
        entityType: 'table',
        lineageDirection: 'bidirectional'
      }),
      ...config
    })
  });

  // SN-SECURITY - ServiceNow Security & ACL Specialist
  registry.register({
    name: 'sn-security',
    description: 'ServiceNow security specialist - ACLs, security rules, data policies, audit compliance',
    capabilities: ['servicenow', 'security', 'acl', 'compliance', 'audit', 'data-policies'],
    tools: ['Read', 'Bash(grep:*,find:*)'],
    estimatedCost: 0.025,
    metadata: {
      color: 'red',
      icon: '🔐',
      readOnly: true,
      platform: 'servicenow'
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'sn-security',
      model: 'haiku', // Use Haiku for security scanning
      allowedTools: ['Read', 'Bash(grep:*,find:*)'],
      systemPrompt: buildServiceNowPrompt({
        basePrompt: `You are a ServiceNow security specialist. You excel at:
- Designing and implementing ACLs (table, field, record-level)
- Creating security rules and data policies
- Identifying security vulnerabilities in scripts
- Input validation and XSS prevention
- Following OWASP guidelines for ServiceNow
- Audit compliance and logging
- Role-based access control design
- Elevated privilege handling
- Secure API design and authentication
- Security best practices review

Focus on identifying security issues and providing specific remediation steps.`,
        standards: {
          includeEffort: false,
          includeSecurity: true,
          includePerformance: true,
          includeDependencies: false,
          includeRollback: false
        },
        snToolsCommands: [
          'trace-lineage -- <EntityName> <type>',
          'validate-change -- <type> <EntityName>',
          'query -- script-crud <ScriptName>'
        ],
        entityType: 'script',
        lineageDirection: 'bidirectional'
      }),
      ...config
    })
  });

  // SN-TESTING - ServiceNow Testing Specialist
  registry.register({
    name: 'sn-testing',
    description: 'ServiceNow testing specialist - ATF tests, test suites, automated testing',
    capabilities: ['servicenow', 'testing', 'atf', 'automated-test-framework', 'test-design'],
    tools: ['Read', 'Write', 'Edit', 'Bash'],
    estimatedCost: 0.03,
    metadata: {
      color: 'cyan',
      icon: '🧪',
      readOnly: false,
      platform: 'servicenow'
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'sn-testing',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
      systemPrompt: buildServiceNowPrompt({
        basePrompt: `You are a ServiceNow testing specialist. You excel at:
- Creating Automated Test Framework (ATF) tests
- Designing comprehensive test suites
- Writing test steps for server and client-side code
- Creating test data and cleanup steps
- Testing flows, business rules, and integrations
- Writing assertion steps effectively
- Implementing test parameterization
- Following ATF best practices
- Coverage analysis and test maintenance

Focus on creating maintainable, comprehensive tests that cover edge cases.`,
        standards: {
          includeEffort: true,
          includeSecurity: false,
          includePerformance: false,
          includeDependencies: true,
          includeRollback: false
        },
        snToolsCommands: [
          'trace-impact -- <ComponentName>',
          'query -- script-crud <ScriptName>',
          'trace-lineage -- <APIName> api'
        ],
        entityType: 'script',
        lineageDirection: 'bidirectional'
      }),
      ...config
    })
  });

  // SN-PERFORMANCE - ServiceNow Performance Specialist
  registry.register({
    name: 'sn-performance',
    description: 'ServiceNow performance specialist - optimization, query analysis, transaction logs',
    capabilities: ['servicenow', 'performance', 'optimization', 'profiling', 'query-optimization'],
    tools: ['Read', 'Bash'],
    estimatedCost: 0.025,
    metadata: {
      color: 'yellow',
      icon: '⚡',
      readOnly: true,
      platform: 'servicenow'
    },
    factory: (config) => new ClaudeCodeAgent({
      role: 'sn-performance',
      model: 'haiku', // Use Haiku for analysis
      allowedTools: ['Read', 'Bash'],
      systemPrompt: buildServiceNowPrompt({
        basePrompt: `You are a ServiceNow performance specialist. You excel at:
- Analyzing slow transactions and queries
- Identifying GlideRecord N+1 issues
- Recommending GlideQuery over GlideRecord
- Database indexing recommendations
- Business rule optimization
- Flow performance tuning
- Client script optimization
- Reducing DOM manipulation overhead
- Transaction log analysis
- Performance best practices

Focus on measurable improvements with clear before/after metrics.`,
        standards: {
          includeEffort: false,
          includeSecurity: false,
          includePerformance: true,
          includeDependencies: false,
          includeRollback: false
        },
        snToolsCommands: [
          'query -- script-crud <ScriptName>',
          'trace-lineage -- <EntityName> <type>'
        ],
        entityType: 'script',
        lineageDirection: 'bidirectional'
      }),
      ...config
    })
  });

  return registry;
}

/**
 * ServiceNow-specific task sequences
 */
export const SERVICENOW_SEQUENCES = {
  // Full ServiceNow implementation
  'sn-full': ['architect', 'sn-scripting', 'sn-security', 'reviewer'],

  // API development
  'sn-api-dev': ['architect', 'sn-api', 'sn-testing', 'reviewer'],

  // Flow development
  'sn-flow-dev': ['architect', 'sn-flows', 'sn-testing', 'reviewer'],

  // UI/Portal development
  'sn-ui-dev': ['architect', 'sn-ui', 'sn-testing', 'reviewer'],

  // Integration development
  'sn-integration-dev': ['architect', 'sn-integration', 'sn-security', 'sn-testing', 'reviewer'],

  // Security audit
  'sn-security-audit': ['architect', 'sn-security', 'reviewer'],

  // Performance optimization
  'sn-performance': ['architect', 'sn-performance', 'sn-scripting', 'sn-performance', 'reviewer']
};

/**
 * Get recommended ServiceNow agents for a task based on keywords
 * @param {string} task - Task description
 * @returns {Array<string>} - Recommended agent names
 */
export function recommendServiceNowAgents(task) {
  const taskLower = task.toLowerCase();

  // API-related
  if (taskLower.includes('api') || taskLower.includes('rest') ||
      taskLower.includes('glideajax') || taskLower.includes('endpoint')) {
    return SERVICENOW_SEQUENCES['sn-api-dev'];
  }

  // Flow-related
  if (taskLower.includes('flow') || taskLower.includes('workflow') ||
      taskLower.includes('integration hub') || taskLower.includes('action')) {
    return SERVICENOW_SEQUENCES['sn-flow-dev'];
  }

  // UI-related
  if (taskLower.includes('portal') || taskLower.includes('widget') ||
      taskLower.includes('ui builder') || taskLower.includes('component')) {
    return SERVICENOW_SEQUENCES['sn-ui-dev'];
  }

  // Integration-related
  if (taskLower.includes('integration') || taskLower.includes('import') ||
      taskLower.includes('etl') || taskLower.includes('middleware')) {
    return SERVICENOW_SEQUENCES['sn-integration-dev'];
  }

  // Security-related
  if (taskLower.includes('acl') || taskLower.includes('security') ||
      taskLower.includes('compliance') || taskLower.includes('audit')) {
    return SERVICENOW_SEQUENCES['sn-security-audit'];
  }

  // Performance-related
  if (taskLower.includes('performance') || taskLower.includes('slow') ||
      taskLower.includes('optimize') || taskLower.includes('query')) {
    return SERVICENOW_SEQUENCES['sn-performance'];
  }

  // Default: full ServiceNow sequence
  return SERVICENOW_SEQUENCES['sn-full'];
}
