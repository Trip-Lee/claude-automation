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
