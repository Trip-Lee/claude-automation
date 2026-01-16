/**
 * ServiceNow Task Workflows
 *
 * Defines multi-step workflows for ServiceNow component-backend tests.
 * Each workflow separates data gathering from document creation to enable
 * proper context management and caching.
 */

import { createStep, StepType } from './conversation-context.js';
import path from 'path';

/**
 * Build document structure prompt with captured sn-tools outputs
 */
function buildDocumentStructurePrompt(context, taskConfig) {
  const snToolsSection = context.getSnToolsOutputsSummary();

  // Build absolute path from working directory + relative deliverable path
  const deliverablePath = path.join(context.workingDir, taskConfig.deliverable);

  return `
Now create the analysis document using the data you've gathered.

${snToolsSection}

## Required Document Structure

Create a file: ${deliverablePath}

### Required Sections (in this order):

**## 1. Executive Summary**
- 2-3 sentences summarizing the key findings
- What is this component/table/feature?
- What are the main dependencies or integration points?

**## 2. Existing System Analysis**
${taskConfig.existingSystemGuidance || ''}
- **CRITICAL:** Include the MCP tool results you gathered in Step 1
- For each tool call, document:
  - Tool name and parameters used
  - Confidence level from metadata
  - Key findings (APIs, Scripts, Tables discovered)
  - Any manual investigation performed (if confidence was LOW)
- Analyze what the results reveal about the current architecture

**## 3. Complete Lineage/Dependencies**
${taskConfig.lineageGuidance || ''}
- Show the full dependency chain
- Use arrows (→ or ↔) to show relationships
- Include all layers: Component → API → Script → Table (as applicable)
- Can use Mermaid diagram or text-based format

**## 4. CRUD Operations** (if applicable)
- Create a table showing which operations are performed on each table
- Columns: Table | CREATE | READ | UPDATE | DELETE
- Mark with ✓ or ✗

**## 5. Security Analysis**
- What ACLs are required?
- What roles should have access?
- Any authentication/authorization considerations?
- Data exposure risks?
- Security implications of changes

**## 6. Performance Analysis**
- Query complexity
- Caching strategies
- Potential bottlenecks
- Optimization opportunities
- Performance implications

**## 7. Risk Assessment**
Must include these subsections:
- **Technical Constraints:** Technical limitations or challenges
- **Business Constraints:** Business rules or processes affected
- **Data Integrity Constraints:** Data quality or consistency concerns
- **Security Constraints:** Security implications or requirements

**## 8. Implementation Guidance** (if creating/modifying)
${taskConfig.implementationGuidance || ''}
- Dependencies between steps (use "depends on", "prerequisite", "required before")
- Deployment sequence
- Testing strategy (unit, integration, E2E)

${taskConfig.additionalSections || ''}

## Formatting Requirements

- Use proper markdown headings (## for main sections, ### for subsections)
- Document MCP tool calls in \`\`\`json code blocks showing parameters
- Include tool results in \`\`\`json code blocks or formatted tables
- Highlight confidence levels and data quality notes
- Create clear, scannable sections
- Use tables where appropriate for structured data

Create this document now. Include ALL sections listed above.
`;
}

/**
 * SN-CB-001: Trace Script Include to Backend Tables
 */
export const WORKFLOW_SN_CB_001 = {
  id: 'SN-CB-001',
  name: 'Trace Script Include to Backend Tables',
  deliverable: 'analysis/WorkClientUtilsMS_backend_analysis.md',

  steps: [
    createStep(StepType.DATA_GATHERING, {
      name: 'Trace Script Include with sn-tools cache',
      prompt: `
Your task is to analyze the WorkClientUtilsMS Script Include and trace its table dependencies.

**Step 1: Query Script Include CRUD Operations**

Run this command to get cached CRUD data:
\`\`\`bash
cd tools/sn-tools/ServiceNow-Tools && npm run query -- script-crud WorkClientUtilsMS
\`\`\`

This returns JSON with:
- Tables accessed by the Script Include
- CRUD operations (create/read/update/delete) for each table
- Script Include dependencies

**Step 2: Get Full Lineage**

Run this command for complete dependency chain:
\`\`\`bash
cd tools/sn-tools/ServiceNow-Tools && npm run trace-lineage -- WorkClientUtilsMS script
\`\`\`

This returns:
- Forward dependencies (what this script calls)
- Backward dependencies (what calls this script)
- Complete lineage diagram

**What to capture:**
1. All tables accessed (should be 7 tables including x_cadso_work_campaign, x_cadso_work_project)
2. CRUD operations for each table
3. Script Include dependencies (Class, JSON, etc.)
4. Any APIs that use this Script Include

**Include the full JSON output from both commands in your analysis.**
`,
      captureSnTools: true,
      validate: (result) => {
        return result.toLowerCase().includes('script-crud') ||
               result.toLowerCase().includes('trace-lineage') ||
               result.toLowerCase().includes('workclientutilsms');
      }
    }),

    createStep(StepType.DOCUMENT_CREATION, {
      name: 'Create analysis document',
      prompt: (context) => buildDocumentStructurePrompt(context, {
        deliverable: 'analysis/WorkClientUtilsMS_backend_analysis.md',
        existingSystemGuidance: `
- Include the JSON output from npm run query -- script-crud WorkClientUtilsMS
- Include the JSON output from npm run trace-lineage -- WorkClientUtilsMS script
- Document all 7 tables accessed by this Script Include
- Show CRUD operations for each table in a formatted table
- List the Script Include dependencies (Class, JSON, etc.)`,
        lineageGuidance: `
- Show: WorkClientUtilsMS → [Dependencies] → [Tables]
- Include CRUD operations at the table layer
- Use the cached data from sn-tools`,
        implementationGuidance: `
If modifying this Script Include:
- What tables would be affected?
- What other scripts depend on this one?
- What is the risk of changes?`
      }),
      validate: (result) => {
        return true;
      }
    })
  ]
};

/**
 * SN-CB-002: Trace Table to Dependent Components
 */
export const WORKFLOW_SN_CB_002 = {
  id: 'SN-CB-002',
  name: 'Trace Table to Dependent Components',
  deliverable: 'analysis/x_cadso_work_campaign_dependencies.md',

  steps: [
    createStep(StepType.DATA_GATHERING, {
      name: 'Trace table dependencies with MCP tools',
      prompt: `
Your task is to analyze dependencies on the x_cadso_work_campaign table (reverse lineage).

**Step 1: Use MCP Tools for Data Gathering**

Use these MCP tools to gather comprehensive data:

**Tool 1:** trace_table_dependencies
**Parameters:**
\`\`\`json
{
  "table_name": "x_cadso_work_campaign"
}
\`\`\`

**Tool 2:** query_table_schema
**Parameters:**
\`\`\`json
{
  "table_name": "x_cadso_work_campaign"
}
\`\`\`

**Tool 3 (optional):** trace_full_lineage
**Parameters:**
\`\`\`json
{
  "entity_name": "x_cadso_work_campaign",
  "entity_type": "table"
}
\`\`\`

**CRITICAL - Interpret Enhanced Results:**

Each tool returns metadata with confidence scoring and suggestions.

**Check the response metadata:**
- **confidence.level** (HIGH/MEDIUM/LOW)
- **interpretation.trustworthy** (true/false)
- **suggestions[]** - Array of recommended actions

**If confidence is LOW or trustworthy is false:**
  1. Read the suggestions array
  2. Execute the recommended commands (usually grep/find operations)
  3. Use manual findings to supplement or replace tool results
  4. Document both automated and manual findings

**If confidence is HIGH/MEDIUM and trustworthy is true:**
  1. Use the results directly
  2. Proceed with analysis

**Always examine metadata.dataSource.freshness** to understand cache age:
- FRESH: < 24 hours
- ACCEPTABLE: 24-72 hours
- STALE: 72-168 hours
- CRITICAL: > 168 hours
`,
      captureSnTools: true,
      validate: (result) => {
        return result.toLowerCase().includes('trace_table_dependencies') ||
               result.toLowerCase().includes('query_table_schema') ||
               result.toLowerCase().includes('tool_use');
      }
    }),

    createStep(StepType.DOCUMENT_CREATION, {
      name: 'Create dependencies document',
      prompt: (context) => buildDocumentStructurePrompt(context, {
        deliverable: 'analysis/x_cadso_work_campaign_dependencies.md',
        existingSystemGuidance: `
- Include ALL MCP tool results from Step 1 (trace_table_dependencies, query_table_schema)
- Document confidence levels and data freshness for each tool call
- If confidence was LOW and you did manual investigation, include those findings
- Show what scripts access this table (from tool results OR manual search)
- Show what APIs use those scripts
- Show what components call those APIs
- Document the complete reverse dependency chain`,
        lineageGuidance: `
- Reverse path: x_cadso_work_campaign → [Scripts] → [APIs] → [Components]
- Show CRUD operations performed by each script`,
        implementationGuidance: `
**Impact Assessment:**
- If I modify this table, what breaks?
- What components are affected?
- What APIs need updates?
- What scripts need changes?`,
        additionalSections: `
**## 9. Table Schema**
Include the table schema from your query, showing:
- Field names and types
- Relationships to other tables
- Key fields
`
      }),
      validate: (result) => {
        return true;
      }
    })
  ]
};

/**
 * SN-CB-006: End-to-End Component-Backend Integration Analysis
 */
export const WORKFLOW_SN_CB_006 = {
  id: 'SN-CB-006',
  name: 'End-to-End Feature Analysis',
  deliverable: 'analysis/campaign_budget_tracking_complete_analysis.md',

  steps: [
    createStep(StepType.DATA_GATHERING, {
      name: 'Analyze existing system with MCP tools',
      prompt: `
Your task is to analyze the existing x_cadso_work_campaign table and design a budget tracking feature.

**Step 1: Comprehensive System Analysis**

Use MCP tools to understand the current system:

**Tool 1:** trace_full_lineage
**Parameters:**
\`\`\`json
{
  "entity_name": "x_cadso_work_campaign",
  "entity_type": "table"
}
\`\`\`
This gives you both forward and backward lineage in one call.

**Tool 2:** query_table_schema
**Parameters:**
\`\`\`json
{
  "table_name": "x_cadso_work_campaign"
}
\`\`\`

**Tool 3 (if needed):** validate_change_impact
**Parameters:**
\`\`\`json
{
  "change_type": "table",
  "target": "x_cadso_work_campaign",
  "operation": "modify",
  "description": "Adding budget tracking fields and logic"
}
\`\`\`

**Interpreting Results:**

For each tool response:

1. **Check metadata.confidence.level**
   - HIGH: Proceed with confidence
   - MEDIUM: Results likely good, verify critical items
   - LOW: Follow suggestions for manual investigation

2. **Review metadata.interpretation**
   - Look at isEmpty and likelyReason
   - Check trustworthy flag
   - Read the message summary

3. **Act on metadata.suggestions**
   - If suggestions exist, they're prioritized (HIGH/MEDIUM/LOW)
   - Execute suggested commands to fill data gaps
   - Combine automated + manual findings

4. **Check metadata.dataSource.freshness**
   - FRESH/ACCEPTABLE: Results current
   - STALE/CRITICAL: May need manual verification

**Goal:** Build a complete picture of existing system before designing new feature.
`,
      captureSnTools: true,
      validate: (result) => {
        return result.toLowerCase().includes('trace_full_lineage') ||
               result.toLowerCase().includes('query_table_schema') ||
               result.toLowerCase().includes('tool_use');
      }
    }),

    createStep(StepType.DOCUMENT_CREATION, {
      name: 'Create complete analysis',
      prompt: (context) => buildDocumentStructurePrompt(context, {
        deliverable: 'analysis/campaign_budget_tracking_complete_analysis.md',
        existingSystemGuidance: `
- **CRITICAL:** Include all MCP tool results from Step 1 (trace_full_lineage, query_table_schema, validate_change_impact)
- Document confidence levels, data freshness, and any suggested actions taken
- Include any manual investigation findings if tool confidence was LOW
- Analyze the current x_cadso_work_campaign table structure from query_table_schema results
- Show what components/APIs/scripts currently use this table (from tool results OR manual search)
- Identify where budget tracking will integrate based on lineage analysis`,
        lineageGuidance: `
- Show the complete system: UI Component → API → Script → Tables
- Include both existing components AND your proposed budget tracking feature
- Show how they integrate`,
        implementationGuidance: `
**Detailed Implementation Plan:**

Must include:
1. **New fields to add** to x_cadso_work_campaign table
2. **Script Include changes** required
3. **API endpoint modifications** needed
4. **UI component updates** required
5. **Dependencies between steps** - clearly mark with "depends on", "prerequisite"
6. **Deployment sequence** - what order to implement changes
7. **Rollback procedure** - how to undo changes if needed

**Effort Estimation:**
- Provide time estimates (hours/days) for each implementation phase
- Include cost estimates ($) if possible
- Break down by: Backend (database/scripts), API layer, Frontend (UI)`,
        additionalSections: `
**## 9. Data Flow Diagram**
- Show how budget data flows through the system
- From UI input → API → Script → Database
- Include validation and calculation points

**## 10. Testing Strategy**
- Unit tests for Script Includes (calculations, validations)
- Integration tests for API endpoints
- E2E tests for UI workflows
- Test data requirements
`
      }),
      validate: (result) => {
        return true;
      }
    })
  ]
};

/**
 * Get workflow for a task ID
 */
export function getWorkflow(taskId) {
  const workflows = {
    'SN-CB-001': WORKFLOW_SN_CB_001,
    'SN-CB-002': WORKFLOW_SN_CB_002,
    'SN-CB-006': WORKFLOW_SN_CB_006
  };

  return workflows[taskId] || null;
}

/**
 * Get all workflows
 */
export function getAllWorkflows() {
  return {
    'SN-CB-001': WORKFLOW_SN_CB_001,
    'SN-CB-002': WORKFLOW_SN_CB_002,
    'SN-CB-006': WORKFLOW_SN_CB_006
  };
}
