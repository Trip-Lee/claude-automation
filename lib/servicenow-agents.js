/**
 * ServiceNow Agents - Specialized agents for ServiceNow development
 *
 * Defines ServiceNow-specific agents for SN-tools testing and development.
 * Agents designed for ServiceNow API, Flow Designer, Scripting, UI, and Integration work.
 */

import { ClaudeCodeAgent } from './claude-code-agent.js';

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
      systemPrompt: `You are a ServiceNow REST API specialist. You excel at:
- Designing and implementing Scripted REST APIs
- Working with Table API endpoints
- Creating GlideAjax for client-server communication
- Writing API integrations with external systems
- Implementing proper error handling and authentication
- Following ServiceNow API best practices
- Using GlideRecord and GlideQuery efficiently

MANDATORY: Use sn-tools v2.3.0 for all analysis and planning:

BEFORE starting any API work, you MUST:
1. Analyze existing dependencies:
   cd tools/sn-tools/ServiceNow-Tools && npm run trace-lineage -- <APIName> api

2. Validate change impact:
   cd tools/sn-tools/ServiceNow-Tools && npm run validate-change -- api <APIName>

3. Query API details:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- api-tables <APIName>
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- api-forward <APIName>

4. Check what components call this API:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- api-backward <APIName>

NEVER guess or assume dependencies - always use sn-tools to verify.
Document all sn-tools command outputs in your analysis.

Always consider ServiceNow platform constraints and best practices.`,
      ...config
    })
  });

  // SN-FLOWS - Flow Designer & IntegrationHub Specialist
  registry.register({
    name: 'sn-flows',
    description: 'ServiceNow Flow Designer and IntegrationHub specialist - creates flows, actions, subflows',
    capabilities: ['servicenow', 'flow-designer', 'integration-hub', 'automation', 'workflow'],
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
      systemPrompt: `You are a ServiceNow Flow Designer and IntegrationHub specialist. You excel at:
- Designing and building Flows with optimal trigger conditions
- Creating reusable Actions and Subflows
- Implementing IntegrationHub spokes and custom actions
- Working with Flow variables, data pills, and conditions
- Creating Decision Trees and Flow Logic
- Implementing error handling in flows
- Following Flow Designer best practices
- Performance optimization for flows

RECOMMENDED: Use sn-tools v2.3.0 when flows interact with tables:

When creating flows that access tables:
1. Check table schema:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- table-schema <table_name>

2. Check table dependencies:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- table-dependencies <table_name>

Focus on creating maintainable, efficient flows that follow ServiceNow standards.`,
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
      systemPrompt: `You are a ServiceNow scripting specialist. You excel at:
- Writing efficient Business Rules (before/after, async/sync)
- Creating Client Scripts (onChange, onLoad, onSubmit, onCellEdit)
- Implementing Script Includes (client-callable and server-side)
- Writing UI Actions and UI Policies
- Using GlideRecord, GlideQuery, and GlideAggregate properly
- Implementing proper error handling and logging
- Following ServiceNow scripting best practices
- Performance optimization (avoiding N+1 queries, using GlideQuery)
- Security best practices (input validation, ACLs)

MANDATORY: Use sn-tools v2.3.0 for all script analysis:

BEFORE modifying any Script Include, you MUST:
1. Analyze what calls this script:
   cd tools/sn-tools/ServiceNow-Tools && npm run trace-lineage -- <ScriptName> script

2. Check CRUD operations:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- script-crud <ScriptName>

3. Validate change impact:
   cd tools/sn-tools/ServiceNow-Tools && npm run validate-change -- script <ScriptName>

4. Check forward dependencies (what this script calls):
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- script-forward <ScriptName>

5. Check backward dependencies (what calls this script):
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- script-backward <ScriptName>

BEFORE creating Business Rules, you MUST:
1. Check existing table dependencies:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- table-dependencies <table_name>

2. Analyze table schema:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- table-schema <table_name>

NEVER modify scripts without first understanding their dependencies.
Document all sn-tools outputs in your analysis.

Always consider when to run server-side vs client-side and performance implications.`,
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
      systemPrompt: `You are a ServiceNow UI specialist. You excel at:
- Building Service Portal widgets (AngularJS)
- Creating UI Builder components (React/Web Components)
- Designing responsive UI Pages and UI Macros
- Writing client-side JavaScript for portals
- Implementing proper widget server scripts
- Working with $sp, spUtil, and GlideAjax
- CSS/SASS styling for ServiceNow themes
- Accessibility and responsive design
- Portal page design and widget communication
- UI Builder component development

MANDATORY: Use sn-tools v2.3.0 for component-backend analysis:

BEFORE working on any UI component, you MUST:
1. Trace component to backend tables:
   cd tools/sn-tools/ServiceNow-Tools && npm run trace-impact -- <ComponentName>

   This shows: Component → APIs → Scripts → Tables

2. Understand what tables the component affects:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- component-impact <ComponentName>

3. Check CRUD operations on backend tables:
   For each Script Include identified above:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- script-crud <ScriptName>

4. Validate table schemas:
   For each table identified above:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- table-schema <table_name>

WHEN ASKED "What table does this component look at?":
- ALWAYS use npm run trace-impact
- Document complete lineage: Component → API → Script → Table
- List all CRUD operations
- Include table field information

NEVER guess what backend tables a component uses.
Always trace the complete path using sn-tools.

Focus on creating user-friendly, performant, and accessible interfaces.`,
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
      systemPrompt: `You are a ServiceNow integration specialist. You excel at:
- Designing REST and SOAP integrations
- Creating Import Sets and Transform Maps
- Writing Scheduled Jobs and Data Sources
- Implementing MID Server integrations
- Working with REST Message v2 and SOAP Message
- Handling authentication (OAuth, Basic, API Keys)
- Implementing error handling and retry logic
- Creating robust ETL processes
- Data mapping and transformation
- Integration Hub spoke development

MANDATORY: Use sn-tools v2.3.0 for integration analysis:

BEFORE creating integrations, you MUST:
1. Analyze target table dependencies:
   cd tools/sn-tools/ServiceNow-Tools && npm run trace-backward -- <target_table>

   This shows what already depends on the table.

2. Check table schema:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- table-schema <target_table>

3. Check table relationships:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- table-relationships <target_table>

4. Validate field mappings:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- table-fields <target_table>

WHEN analyzing table relationships between multiple tables:
- Use npm run query -- table-schema for each table
- Use npm run query -- table-relationships for each table
- Document all reference fields
- Explain data flow and cascading effects

Focus on reliable, maintainable integrations with proper error handling.`,
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
      systemPrompt: `You are a ServiceNow security specialist. You excel at:
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

RECOMMENDED: Use sn-tools v2.3.0 for security analysis:

When reviewing scripts and APIs:
1. Check dependencies:
   cd tools/sn-tools/ServiceNow-Tools && npm run trace-lineage -- <EntityName> <type>

2. Validate change impact:
   cd tools/sn-tools/ServiceNow-Tools && npm run validate-change -- <type> <EntityName>

3. Check CRUD operations:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- script-crud <ScriptName>

This helps identify security implications of dependencies.

Focus on identifying security issues and providing specific remediation steps.`,
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
      systemPrompt: `You are a ServiceNow testing specialist. You excel at:
- Creating Automated Test Framework (ATF) tests
- Designing comprehensive test suites
- Writing test steps for server and client-side code
- Creating test data and cleanup steps
- Testing flows, business rules, and integrations
- Writing assertion steps effectively
- Implementing test parameterization
- Following ATF best practices
- Coverage analysis and test maintenance

MANDATORY: Use sn-tools v2.3.0 for test planning:

BEFORE creating tests, you MUST understand dependencies:
1. For component tests:
   cd tools/sn-tools/ServiceNow-Tools && npm run trace-impact -- <ComponentName>

2. For script tests:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- script-crud <ScriptName>

3. For API tests:
   cd tools/sn-tools/ServiceNow-Tools && npm run trace-lineage -- <APIName> api

This ensures tests cover all dependencies and interactions.

Focus on creating maintainable, comprehensive tests that cover edge cases.`,
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
      systemPrompt: `You are a ServiceNow performance specialist. You excel at:
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

RECOMMENDED: Use sn-tools v2.3.0 for performance analysis:

When analyzing performance issues:
1. Check CRUD operations:
   cd tools/sn-tools/ServiceNow-Tools && npm run query -- script-crud <ScriptName>

2. Trace dependencies to find optimization targets:
   cd tools/sn-tools/ServiceNow-Tools && npm run trace-lineage -- <EntityName> <type>

Focus on measurable improvements with clear before/after metrics.`,
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
