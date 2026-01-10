/**
 * ServiceNow Agent Prompt Templates
 *
 * Provides dynamic, reusable prompt templates for ServiceNow agents
 * to ensure consistent deliverable quality across all agents.
 */

/**
 * Generate deliverable quality standards section dynamically
 * @param {Object} options - Configuration options
 * @param {boolean} options.includeEffort - Include effort estimation requirements
 * @param {boolean} options.includeSecurity - Include security analysis requirements
 * @param {boolean} options.includePerformance - Include performance analysis requirements
 * @param {boolean} options.includeDependencies - Include dependencies requirements
 * @param {boolean} options.includeRollback - Include rollback strategy requirements
 * @param {string[]} options.requiredSections - Additional required sections
 * @returns {string} Formatted deliverable quality standards
 */
export function generateDeliverableStandards(options = {}) {
  const {
    includeEffort = true,
    includeSecurity = true,
    includePerformance = true,
    includeDependencies = true,
    includeRollback = true,
    requiredSections = []
  } = options;

  const sections = [
    '📋 DELIVERABLE QUALITY STANDARDS:',
    '',
    'When creating analysis documents, ALWAYS include these sections:',
    ''
  ];

  // Core sections (always included)
  sections.push('  [ ] Executive Summary');
  sections.push('  [ ] Existing System Analysis');
  sections.push('      - Run relevant sn-tools commands (trace-backward, trace-lineage, query)');
  sections.push('      - Include command outputs in code blocks');
  sections.push('      - Analyze current implementation/architecture');
  sections.push('');
  sections.push('  [ ] Table Schema Information (when analyzing tables)');
  sections.push('      - Use query_table_schema or npm run query -- table-schema <table_name>');
  sections.push('      - Include field definitions table: Field Name | Type | Description');
  sections.push('      - Document reference fields and relationships');
  sections.push('');

  // Conditional sections based on options
  if (includeSecurity) {
    sections.push('  [ ] Security Analysis');
    sections.push('      - Section heading: "## Security Analysis" or "### Security Considerations"');
    sections.push('      - Include: ACLs, permissions, roles, authentication');
    sections.push('      - Document security implications and risks');
    sections.push('');
  }

  if (includePerformance) {
    sections.push('  [ ] Performance Analysis');
    sections.push('      - Section heading: "## Performance Analysis" or "### Performance Considerations"');
    sections.push('      - Include: Query complexity, caching strategies, optimization opportunities');
    sections.push('      - Document performance implications and bottlenecks');
    sections.push('');
  }

  sections.push('  [ ] Implementation Plan');

  if (includeDependencies) {
    sections.push('      - Document dependencies between steps');
    sections.push('      - Include: "depends on", "prerequisite", "required before"');
    sections.push('      - Show deployment sequence or order of operations');
  }

  sections.push('      - Provide step-by-step instructions');
  sections.push('');

  if (includeEffort) {
    sections.push('  [ ] Effort Estimation');
    sections.push('      - Section heading: "## Effort Estimation" or "## Timeline"');
    sections.push('      - Include time units: hours, days, weeks');
    sections.push('      - Include cost estimates: $XXX');
    sections.push('      - Break down by task or phase');
    sections.push('');
  }

  sections.push('  [ ] Risk Assessment (REQUIRED - ALL subsections mandatory)');
  sections.push('      - Section heading: "## Risks" or "## Potential Issues" or "## Risk Assessment"');
  sections.push('      - REQUIRED SUBSECTIONS (must include all):');
  sections.push('        1. ### Technical Risks (or Technical Constraints/Considerations)');
  sections.push('           - Include: Architecture risks, complexity, dependencies');
  sections.push('        2. ### Business Risks (or Business Constraints/Considerations)');
  sections.push('           - Include: Process impact, user impact, timeline risks');
  sections.push('        3. ### Data Integrity Risks (or Data Quality/Considerations)');
  sections.push('           - Include: Data validation, migration risks, consistency');
  if (includeSecurity) {
    sections.push('        4. ### Security Risks (or Security Constraints/Considerations)');
    sections.push('           - Include: Access control, vulnerabilities, compliance');
  }
  sections.push('');
  sections.push('      IMPORTANT: Each subsection MUST have its own heading (### level)');
  sections.push('');

  sections.push('  [ ] Testing Strategy');
  sections.push('      - Unit tests needed');
  sections.push('      - Integration tests needed');
  sections.push('      - E2E test scenarios');
  sections.push('');

  if (includeRollback) {
    sections.push('  [ ] Deployment & Rollback');
    sections.push('      - Include deployment sequence');
    sections.push('      - Document rollback procedure');
    sections.push('      - Provide step-by-step rollback instructions');
    sections.push('');
  }

  // Add any additional required sections
  if (requiredSections.length > 0) {
    sections.push('  [ ] Additional Requirements:');
    requiredSections.forEach(section => {
      sections.push(`      - ${section}`);
    });
    sections.push('');
  }

  sections.push('STANDARDIZED SECTION HEADERS (use these exact headings):');
  sections.push('  ## Executive Summary');
  sections.push('  ## Existing System Analysis');
  sections.push('  ## Table Schema (when analyzing tables)');
  if (includeSecurity) {
    sections.push('  ## Security Analysis');
  }
  if (includePerformance) {
    sections.push('  ## Performance Analysis');
  }
  sections.push('  ## Implementation Plan');
  if (includeEffort) {
    sections.push('  ## Effort Estimation');
  }
  sections.push('  ## Risk Assessment (with ### subsections)');
  sections.push('  ## Testing Strategy');
  if (includeRollback) {
    sections.push('  ## Deployment & Rollback');
  }
  sections.push('');
  sections.push('VALIDATION CHECKLIST:');
  sections.push('  [ ] All sn-tools command outputs included in final documentation');
  sections.push('  [ ] All required section headings present (use ## for main, ### for sub)');
  sections.push('  [ ] Risk assessment has all required subsections (Technical, Business, Data, Security)');
  if (includeEffort) {
    sections.push('  [ ] Effort estimation includes specific time/cost numbers');
  }
  if (includeDependencies) {
    sections.push('  [ ] Dependencies clearly documented with prerequisite relationships');
  }
  if (includeRollback) {
    sections.push('  [ ] Rollback strategy includes concrete steps');
  }
  sections.push('');
  sections.push('IMPORTANT: These are REQUIRED sections, not optional. Every deliverable must include them.');

  return sections.join('\n');
}

/**
 * Generate CRUD documentation requirements
 * @param {string} entityType - Type of entity (script, api, table, component)
 * @returns {string} CRUD documentation requirements
 */
export function generateCrudRequirements(entityType = 'script') {
  const commandMap = {
    'script': 'script-crud',
    'api': 'api-tables',
    'table': 'table-dependencies',
    'component': 'component-impact'
  };

  const command = commandMap[entityType] || 'script-crud';

  return `
CRUD OPERATIONS DOCUMENTATION:

[ ] Include CRUD operations section in documentation
[ ] Run: npm run query -- ${command} <EntityName>
[ ] Create table with columns: Table | CREATE | READ | UPDATE | DELETE
[ ] Mark each operation with ✓ or ✗
[ ] Include sn-tools validation output in code block

Example format:
\`\`\`bash
$ npm run query -- ${command} <EntityName>
{
  "table": "table_name",
  "operations": ["read", "write"]
}
\`\`\`

| Table | CREATE | READ | UPDATE | DELETE |
|-------|--------|------|--------|--------|
| table_name | ✗ | ✓ | ✓ | ✗ |
`;
}

/**
 * Generate lineage diagram requirements
 * @param {string} direction - Direction of lineage (forward, backward, bidirectional)
 * @returns {string} Lineage diagram requirements
 */
export function generateLineageRequirements(direction = 'bidirectional') {
  const examples = {
    forward: 'Component → API → Script → Table',
    backward: 'Table → Script → API → Component',
    bidirectional: 'Component ↔ API ↔ Script ↔ Table'
  };

  return `
LINEAGE DIAGRAM REQUIREMENTS:

[ ] Include complete lineage/dependency diagram
[ ] Use arrows (→, ↔) to show relationships
[ ] Include all layers: ${examples[direction]}
[ ] Can use Mermaid diagram or text-based arrows
[ ] Show CRUD operations at each layer

Example formats:
- Mermaid: \`\`\`mermaid\\ngraph LR\\n  A[Component] --> B[API]\\n\`\`\`
- Text: Component → API (POST /endpoint) → Script (ScriptName) → Table (READ)
`;
}

/**
 * Generate MCP tools section - tells agents about available MCP tools
 * @returns {string} MCP tools documentation
 */
export function generateMCPToolsSection() {
  return `
🔧 MCP TOOLS AVAILABLE (PREFERRED over bash commands):

When MCP tools are available, ALWAYS prefer them over bash commands.
MCP tools provide the same functionality but integrate better with Claude.

Available MCP tools:
- trace_component_impact: Trace a UI component forward (same as: npm run trace-impact)
- trace_table_dependencies: Trace table backward dependencies (same as: npm run trace-backward)
- trace_full_lineage: Get complete bidirectional lineage (same as: npm run trace-lineage)
- validate_change_impact: Validate proposed changes (same as: npm run validate-change)
- query_component_impact: Query component dependencies (same as: npm run query -- component-impact)
- query_script_crud: Query script CRUD operations (same as: npm run query -- script-crud)
- query_table_schema: Query table schema (same as: npm run query -- table-schema)
- query_table_dependencies: Query table dependencies (same as: npm run query -- table-dependencies)

USAGE PRIORITY:
1. FIRST: Try to use MCP tools (if available in your tool list)
2. FALLBACK: If MCP tools fail or aren't available, use bash commands

Example MCP tool usage:
  Instead of: npm run trace-impact -- WorkCampaignBoard
  Use: trace_component_impact with {"component_name": "WorkCampaignBoard"}

Benefits of MCP tools:
- Native integration with Claude
- Structured JSON responses
- No need to parse bash output
- Progressive context building (large results are summarized)

CRITICAL - Documentation Requirements (MANDATORY):
When documenting your analysis, you MUST include the tool outputs in your deliverable:

1. For MCP tools: Include the JSON response in a \`\`\`json code block:
   \`\`\`json
   // Tool: trace_component_impact
   // Parameters: {"component_name": "ComponentName"}
   {
     "success": true,
     "data": { ... },
     "metadata": { "confidence": { "level": "HIGH" } }
   }
   \`\`\`

2. For Bash fallback: Include command and output in \`\`\`bash code block:
   \`\`\`bash
   $ cd tools/sn-tools/ServiceNow-Tools && npm run trace-impact -- ComponentName
   [output here]
   \`\`\`

3. ALWAYS include at least ONE tool output per analysis section
4. Tool outputs are REQUIRED evidence - deliverables without them will fail validation

These outputs serve as validation evidence that sn-tools were properly used.
Without tool outputs, your deliverable is INCOMPLETE.
`;
}

/**
 * Generate sn-tools validation requirements
 * @param {string[]} requiredCommands - Required sn-tools commands
 * @returns {string} Validation requirements
 */
export function generateSnToolsRequirements(requiredCommands = []) {
  const commandList = requiredCommands.length > 0
    ? requiredCommands.map(cmd => `  - npm run ${cmd}`).join('\n')
    : '  - (commands determined by entity type)';

  return `
SN-TOOLS VALIDATION REQUIREMENTS:

You MUST run these analyses and include outputs:

${commandList}

FOR EACH ANALYSIS:
[ ] FIRST: Try using MCP tools (trace_component_impact, trace_full_lineage, etc.)
[ ] FALLBACK: If MCP tools unavailable, use Bash commands
[ ] Capture the complete output
[ ] Include output in documentation within code blocks
[ ] Analyze the output and explain findings

Format for including MCP tool outputs:
\`\`\`json
// Tool: trace_component_impact
// Parameters: {"component_name": "ComponentName"}
{
  "success": true,
  "data": { ... },
  "metadata": { "confidence": { "level": "HIGH" } }
}
\`\`\`

Format for including bash command outputs (fallback):
\`\`\`bash
$ cd tools/sn-tools/ServiceNow-Tools && npm run <command> -- <args>

[paste complete command output here]
\`\`\`

Then analyze what the output shows about dependencies, CRUD operations, or risks.
`;
}

/**
 * Build complete prompt template for ServiceNow agents
 * @param {Object} config - Configuration for prompt generation
 * @param {string} config.agentType - Type of agent (api, scripting, ui, etc.)
 * @param {string} config.basePrompt - Base agent prompt/description
 * @param {Object} config.standards - Deliverable standards options
 * @param {string[]} config.snToolsCommands - Required sn-tools commands
 * @param {string} config.entityType - Entity type for CRUD docs
 * @param {string} config.lineageDirection - Lineage direction
 * @returns {string} Complete formatted prompt
 */
export function buildServiceNowPrompt(config) {
  const {
    basePrompt = '',
    standards = {},
    snToolsCommands = [],
    entityType = 'script',
    lineageDirection = 'bidirectional',
    includeMCPTools = true // Include MCP tools section by default
  } = config;

  const sections = [];

  // Add base prompt
  if (basePrompt) {
    sections.push(basePrompt);
    sections.push('');
    sections.push('---');
    sections.push('');
  }

  // Add MCP tools section (tells agents about available tools)
  if (includeMCPTools) {
    sections.push(generateMCPToolsSection());
    sections.push('');
    sections.push('---');
    sections.push('');
  }

  // Add deliverable standards
  sections.push(generateDeliverableStandards(standards));
  sections.push('');
  sections.push('---');
  sections.push('');

  // Add CRUD requirements
  sections.push(generateCrudRequirements(entityType));
  sections.push('');
  sections.push('---');
  sections.push('');

  // Add lineage requirements
  sections.push(generateLineageRequirements(lineageDirection));
  sections.push('');
  sections.push('---');
  sections.push('');

  // Add sn-tools requirements
  sections.push(generateSnToolsRequirements(snToolsCommands));

  return sections.join('\n');
}
