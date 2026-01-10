#!/usr/bin/env node

/**
 * ServiceNow Component-Backend Integration Tests
 *
 * Purpose: Test the AI's ability to trace and analyze relationships between
 * UI components and backend ServiceNow elements using sn-tools v2.3.0
 * unified tracing capabilities.
 *
 * These tests specifically validate:
 * 1. Component → Table lineage tracing (what tables does a component affect?)
 * 2. Table → Component dependency tracing (what UI depends on this table?)
 * 3. Table relationship analysis (how do tables relate through BRs/workflows?)
 * 4. REST API backend impact analysis (what changes are needed?)
 * 5. Script Include dependency chains (calling scripts from scripts/BRs)
 *
 * All tests should leverage sn-tools v2.3.0 unified tracing:
 * - npm run trace-impact -- ComponentName
 * - npm run trace-backward -- table_name
 * - npm run trace-lineage -- EntityName type
 * - npm run validate-change -- type EntityName
 * - npm run query -- query-type target
 */

import chalk from 'chalk';
import { SimpleTestExecutor } from './lib/simple-test-executor.js';
import { homedir } from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(homedir(), '.env') });

console.log(chalk.cyan.bold('\n🔗 SERVICENOW COMPONENT-BACKEND INTEGRATION TESTS\n'));
console.log(chalk.gray('Testing AI ability to trace component-backend relationships using sn-tools v2.3.0\n'));

// ============================================================================
// COMPONENT-BACKEND INTEGRATION TESTS
// ============================================================================

const COMPONENT_BACKEND_TESTS = [
  {
    id: 'SN-CB-001',
    name: 'Trace Component to Backend Tables',
    description: 'Analyze what backend tables a UI component affects',
    taskPrompt: `Using sn-tools unified tracing, analyze the WorkCampaignBoard component:

QUESTIONS TO ANSWER:
1. What backend tables does WorkCampaignBoard component directly access?
2. What REST APIs does it call?
3. What Script Includes are used by those APIs?
4. What CRUD operations (create/read/update/delete) are performed on each table?
5. What is the complete lineage path: Component → APIs → Scripts → Tables?

EXPECTED WORKFLOW:
1. Use: npm run trace-impact -- WorkCampaignBoard
2. Analyze the output to identify:
   - All APIs called by the component
   - All Script Includes used by those APIs
   - All tables accessed (with CRUD operations)
3. Provide a summary in markdown format with:
   - Component name
   - List of APIs with descriptions
   - List of Script Includes with purposes
   - List of tables with CRUD operations
   - Complete lineage diagram

DELIVERABLES:
- analysis/WorkCampaignBoard_backend_analysis.md
- Include sn-tools command outputs
- Include lineage diagram (text-based or mermaid)
- List any potential issues or concerns`,
    expectedArtifacts: [
      'analysis/WorkCampaignBoard_backend_analysis.md'
    ],
    successCriteria: [
      'Used npm run trace-impact command',
      'Identified all APIs called by component',
      'Identified all Script Includes used',
      'Identified all tables accessed',
      'Listed CRUD operations for each table',
      'Created lineage diagram',
      'Documented complete path: Component → API → Script → Table',
      'Analysis is accurate and comprehensive',
      'Included sn-tools command outputs',
      'Markdown formatting is clean'
    ],
    requiredSnTools: [
      'trace-impact',
      'query component-impact'
    ],
    estimatedTime: '5-7 minutes',
    estimatedCost: '$0.60-0.80',
    expectedAgents: ['architect', 'sn-tools-analyst', 'documenter'],
    complexity: 'MEDIUM',
    pointValue: 30
  },

  {
    id: 'SN-CB-002',
    name: 'Trace Table to Dependent Components',
    description: 'Find all UI components that depend on a backend table',
    taskPrompt: `Using sn-tools unified tracing, analyze dependencies on the x_cadso_work_campaign table:

QUESTIONS TO ANSWER:
1. What UI components depend on the x_cadso_work_campaign table?
2. What Script Includes access this table?
3. What REST APIs call those Script Includes?
4. What components call those REST APIs?
5. What is the reverse lineage: Table → Scripts → APIs → Components?

EXPECTED WORKFLOW:
1. Use: npm run trace-backward -- x_cadso_work_campaign
2. Analyze which scripts access the table
3. Trace which APIs use those scripts
4. Identify which components call those APIs
5. Document the complete dependency chain

DELIVERABLES:
- analysis/x_cadso_work_campaign_dependencies.md
- Include table schema information
- List all dependent components
- List all intermediate layers (scripts, APIs)
- Impact assessment: "If I modify this table, what breaks?"

BONUS:
- Use npm run query -- table-schema x_cadso_work_campaign
- Include table field definitions
- Note any relationships to other tables`,
    expectedArtifacts: [
      'analysis/x_cadso_work_campaign_dependencies.md'
    ],
    successCriteria: [
      'Used npm run trace-backward command',
      'Identified all Script Includes accessing table',
      'Identified all APIs using those scripts',
      'Identified all components calling those APIs',
      'Created reverse lineage diagram',
      'Documented impact assessment',
      'Included table schema information',
      'Listed table relationships',
      'Analysis shows complete dependency chain',
      'Clear documentation of what would break if table changes'
    ],
    requiredSnTools: [
      'trace-backward',
      'query table-dependencies',
      'query table-schema'
    ],
    estimatedTime: '5-7 minutes',
    estimatedCost: '$0.60-0.80',
    expectedAgents: ['architect', 'sn-tools-analyst', 'documenter'],
    complexity: 'MEDIUM',
    pointValue: 30
  },

  {
    id: 'SN-CB-003',
    name: 'Analyze Table Relationships and Workflows',
    description: 'Map relationships between multiple tables through Business Rules and workflows',
    taskPrompt: `Analyze the relationship and workflow between these Tenon tables:
- x_cadso_work_campaign (Campaign)
- x_cadso_work_project (Project)
- x_cadso_work_task (Task)

QUESTIONS TO ANSWER:
1. How are these tables related? (parent-child, reference fields, etc.)
2. What Business Rules connect these tables?
3. What workflows or flows orchestrate actions across these tables?
4. What is the data flow when a Campaign is created?
5. What cascading effects happen when updating records?
6. What Script Includes handle cross-table operations?

EXPECTED WORKFLOW:
1. Use: npm run query -- table-schema x_cadso_work_campaign
2. Use: npm run query -- table-schema x_cadso_work_project
3. Use: npm run query -- table-schema x_cadso_work_task
4. Use: npm run query -- table-relationships for each table
5. Analyze Business Rules that reference these tables
6. Trace Script Includes that operate across multiple tables
7. Document the complete workflow

DELIVERABLES:
- analysis/tenon_work_management_workflow.md
- Include:
  - Entity Relationship Diagram (text/mermaid)
  - Table schemas with key fields
  - Reference field mappings
  - Business Rules that cross tables
  - Workflow descriptions
  - Data flow diagrams
  - Common operations and their effects

EXAMPLE SCENARIOS TO DOCUMENT:
- "What happens when I create a Campaign?"
- "What happens when I update a Project status?"
- "What happens when I complete a Task?"
- "How do changes cascade through the hierarchy?"`,
    expectedArtifacts: [
      'analysis/tenon_work_management_workflow.md',
      'diagrams/tenon_erd.md',
      'diagrams/tenon_workflow_cascade.md'
    ],
    successCriteria: [
      'Used npm run query for table schemas',
      'Used npm run query for table relationships',
      'Identified all reference fields between tables',
      'Documented parent-child relationships',
      'Listed all Business Rules affecting these tables',
      'Documented workflows/flows',
      'Created Entity Relationship Diagram',
      'Created workflow cascade diagram',
      'Documented common operation scenarios',
      'Explained data flow clearly',
      'Identified potential issues or constraints'
    ],
    requiredSnTools: [
      'query table-schema',
      'query table-relationships',
      'trace-lineage'
    ],
    estimatedTime: '10-12 minutes',
    estimatedCost: '$2.00-2.50',
    expectedAgents: ['architect', 'sn-tools-analyst', 'sn-integration', 'documenter'],
    complexity: 'COMPLEX',
    pointValue: 50
  },

  {
    id: 'SN-CB-004',
    name: 'Create Script Include Called from Multiple Sources',
    description: 'Build a Script Include and demonstrate calling it from another Script Include and Business Rule',
    taskPrompt: `Create a comprehensive Script Include system with cross-script calling:

COMPONENTS TO BUILD:

1. Script Include: "WorkItemValidator"
   - Purpose: Validates work items (campaigns, projects, tasks)
   - Functions:
     - validateCampaign(campaignSysId): Validates campaign data
     - validateProject(projectSysId): Validates project data
     - validateTask(taskSysId): Validates task data
     - checkReferences(tableName, sysId): Validates reference integrity
   - Returns: {valid: true/false, errors: [array], warnings: [array]}
   - Include proper error handling and logging

2. Script Include: "WorkItemManager"
   - Purpose: Manages work item lifecycle
   - Functions:
     - createCampaign(data): Creates campaign and validates using WorkItemValidator
     - createProject(campaignSysId, data): Creates project under campaign
     - createTask(projectSysId, data): Creates task under project
   - MUST call WorkItemValidator before creating records
   - Returns: {success: true/false, sysId: string, errors: [array]}

3. Business Rule: "Validate Before Campaign Insert"
   - Table: x_cadso_work_campaign
   - When: Before Insert
   - Action: Calls WorkItemValidator.validateCampaign(current.sys_id)
   - If validation fails, abort insert and show errors
   - Logs validation results

4. Business Rule: "Validate Before Project Insert"
   - Table: x_cadso_work_project
   - When: Before Insert
   - Action: Calls WorkItemValidator.validateProject(current.sys_id)
   - Also validates parent campaign using checkReferences
   - Abort if validation fails

REQUIREMENTS:
- Demonstrate Script Include → Script Include calling
- Demonstrate Business Rule → Script Include calling
- Proper error handling throughout
- Comprehensive logging
- JSDoc documentation
- Unit tests for all functions

DELIVERABLES:
- script-includes/WorkItemValidator.js
- script-includes/WorkItemManager.js
- business-rules/validate_before_campaign_insert.js
- business-rules/validate_before_project_insert.js
- tests/test_work_item_validator.js
- tests/test_work_item_manager.js
- docs/WORK_ITEM_VALIDATION_SYSTEM.md

VALIDATION:
Use sn-tools to verify the implementation:
- npm run query -- script-crud WorkItemValidator
- npm run query -- script-crud WorkItemManager
- npm run validate-change -- script WorkItemValidator`,
    expectedArtifacts: [
      'script-includes/WorkItemValidator.js',
      'script-includes/WorkItemManager.js',
      'business-rules/validate_before_campaign_insert.js',
      'business-rules/validate_before_project_insert.js',
      'tests/test_work_item_validator.js',
      'tests/test_work_item_manager.js',
      'docs/WORK_ITEM_VALIDATION_SYSTEM.md'
    ],
    successCriteria: [
      'WorkItemValidator has all required functions',
      'WorkItemManager calls WorkItemValidator correctly',
      'Business Rules call WorkItemValidator',
      'Error handling is comprehensive',
      'Validation logic is correct',
      'Returns proper result objects',
      'Logging included throughout',
      'JSDoc documentation complete',
      'Unit tests cover all functions',
      'Cross-script calling works correctly',
      'Business Rule abort logic works',
      'Used sn-tools to validate implementation'
    ],
    requiredSnTools: [
      'query script-crud',
      'validate-change'
    ],
    estimatedTime: '12-15 minutes',
    estimatedCost: '$1.50-2.00',
    expectedAgents: ['architect', 'sn-scripting', 'sn-testing', 'documenter', 'reviewer'],
    complexity: 'COMPLEX',
    pointValue: 60
  },

  {
    id: 'SN-CB-005',
    name: 'REST API Backend Impact Analysis',
    description: 'Analyze backend changes needed when modifying a REST API',
    taskPrompt: `Analyze the impact of adding a new property to the CampaignAPI REST API:

SCENARIO:
The CampaignAPI currently has these endpoints:
- GET /campaign/{sys_id} - Get campaign details
- POST /campaign - Create new campaign
- PUT /campaign/{sys_id} - Update campaign

NEW REQUIREMENT:
Add a new property "estimated_budget" to all API responses and requests.

QUESTIONS TO ANSWER:
1. What backend tables need to be modified?
2. What Script Includes call the current API?
3. What components consume the API responses?
4. What database fields need to be added?
5. What Business Rules might be affected?
6. What validation logic needs updating?
7. What documentation needs updating?
8. What is the complete impact radius?

EXPECTED WORKFLOW:
1. Use: npm run trace-lineage -- CampaignAPI api
2. Identify all components calling the API
3. Identify all Script Includes used by the API
4. Identify all tables accessed by the API
5. Use: npm run validate-change -- api CampaignAPI
6. Analyze the impact assessment
7. Document all required changes

DELIVERABLES:
- analysis/CampaignAPI_budget_property_impact.md
- Include:
  - Current API structure
  - Proposed API changes
  - Backend table changes needed (field additions)
  - Script Include modifications needed
  - Business Rule updates needed
  - Component updates needed
  - Migration plan
  - Risk assessment
  - Testing plan
  - Rollback strategy

BONUS:
- Generate a change checklist
- Estimate effort for each change
- Identify dependencies between changes
- Suggest deployment sequence`,
    expectedArtifacts: [
      'analysis/CampaignAPI_budget_property_impact.md',
      'checklists/CampaignAPI_budget_change_checklist.md'
    ],
    successCriteria: [
      'Used npm run trace-lineage for API',
      'Used npm run validate-change for impact',
      'Identified all affected tables',
      'Listed all Script Include changes',
      'Listed all component changes',
      'Documented database field additions',
      'Created migration plan',
      'Included risk assessment',
      'Created testing plan',
      'Created rollback strategy',
      'Generated change checklist',
      'Estimated effort accurately',
      'Identified change dependencies',
      'Suggested deployment sequence'
    ],
    requiredSnTools: [
      'trace-lineage',
      'validate-change',
      'query api-tables',
      'query api-forward',
      'query api-backward'
    ],
    estimatedTime: '10-12 minutes',
    estimatedCost: '$1.50-2.00',
    expectedAgents: ['architect', 'sn-tools-analyst', 'sn-api', 'sn-integration', 'documenter'],
    complexity: 'COMPLEX',
    pointValue: 55
  },

  {
    id: 'SN-CB-006',
    name: 'End-to-End Component-Backend Integration Analysis',
    description: 'Complete analysis of component creation and all backend implications',
    taskPrompt: `You are tasked with adding a new feature: "Campaign Budget Tracking"

FEATURE REQUIREMENTS:
- UI Component: CampaignBudgetTracker (displays budget vs actual spending)
- REST API: CampaignBudgetAPI (CRUD operations for budget data)
- Script Includes: CampaignBudgetCalculator (calculates totals, variance, forecasts)
- Database: New table x_cadso_work_campaign_budget with fields:
  - campaign (reference to x_cadso_work_campaign)
  - budgeted_amount (decimal)
  - actual_amount (decimal)
  - variance (decimal, calculated)
  - forecast (decimal, calculated)
  - fiscal_year (integer)
  - budget_category (choice: personnel, equipment, marketing, other)
- Business Rules: Auto-calculate variance and forecast on insert/update
- ACLs: Only campaign managers can edit budgets

TASK:
Analyze the COMPLETE impact and dependencies:

1. What existing components might need updates?
2. What existing APIs need modifications?
3. What existing Script Includes should be leveraged?
4. What existing Business Rules might interact?
5. What table relationships need to be established?
6. What security implications exist?
7. What performance considerations are there?
8. What testing is required?

USE SN-TOOLS TO ANALYZE:
- npm run trace-backward -- x_cadso_work_campaign (find existing dependencies)
- npm run query -- table-dependencies x_cadso_work_campaign
- npm run query -- table-schema x_cadso_work_campaign
- npm run query -- component-impact (for any existing campaign components)

DELIVERABLES:
1. analysis/campaign_budget_tracking_complete_analysis.md
   - Feature requirements breakdown
   - Existing system analysis
   - New components needed
   - Integration points
   - Dependency diagram
   - Security analysis
   - Performance analysis

2. implementation-plan/campaign_budget_tracking_plan.md
   - Step-by-step implementation sequence
   - Dependencies between steps
   - Testing strategy for each step
   - Rollback plan for each step
   - Estimated effort per step

3. architecture/campaign_budget_tracking_architecture.md
   - Component diagram
   - Data flow diagram
   - API contract specification
   - Database schema
   - Security model

4. testing/campaign_budget_tracking_test_plan.md
   - Unit tests needed
   - Integration tests needed
   - E2E tests needed
   - Performance tests needed
   - Security tests needed

VALIDATION:
After analysis, use sn-tools to validate assumptions:
- npm run validate-change -- table x_cadso_work_campaign
- Run queries to verify existing dependencies
- Check for naming conflicts or similar features`,
    expectedArtifacts: [
      'analysis/campaign_budget_tracking_complete_analysis.md',
      'implementation-plan/campaign_budget_tracking_plan.md',
      'architecture/campaign_budget_tracking_architecture.md',
      'testing/campaign_budget_tracking_test_plan.md'
    ],
    successCriteria: [
      'Used multiple sn-tools commands effectively',
      'Analyzed existing x_cadso_work_campaign dependencies',
      'Identified all integration points',
      'Created comprehensive component diagram',
      'Created detailed data flow diagram',
      'Documented API contracts completely',
      'Designed database schema with relationships',
      'Analyzed security implications',
      'Analyzed performance implications',
      'Created step-by-step implementation plan',
      'Identified dependencies between steps',
      'Created comprehensive test plan',
      'Included rollback strategies',
      'Estimated effort accurately',
      'Validated assumptions with sn-tools',
      'Documentation is professional and thorough'
    ],
    requiredSnTools: [
      'trace-backward',
      'query table-dependencies',
      'query table-schema',
      'query component-impact',
      'validate-change',
      'trace-lineage'
    ],
    estimatedTime: '20-25 minutes',
    estimatedCost: '$1.80-2.50',
    actualCost: '$2.05 (Nov 2025)',
    actualTime: '17.3 minutes (52 turns)',
    expectedAgents: [
      'architect',
      'sn-tools-analyst',
      'sn-ui',
      'sn-api',
      'sn-scripting',
      'sn-integration',
      'sn-security',
      'sn-performance',
      'documenter',
      'reviewer'
    ],
    complexity: 'COMPLEX',
    pointValue: 100
  }
];

// ============================================================================
// TEST RUNNER
// ============================================================================

class ComponentBackendTestRunner {
  constructor() {
    this.executor = null;
    this.results = [];
  }

  async initialize() {
    console.log(chalk.blue('Initializing test runner...'));

    // Use SimpleTestExecutor for lightweight testing (uses Claude Code CLI)
    this.executor = new SimpleTestExecutor({
      verbose: true,
      workingDir: process.cwd(),
      outputDir: path.join(process.cwd(), 'test-outputs')
    });

    console.log(chalk.green('✓ Test runner initialized\n'));
  }

  async runTest(test) {
    console.log(chalk.cyan.bold(`\n${'='.repeat(80)}`));
    console.log(chalk.cyan.bold(`TEST: ${test.id} - ${test.name}`));
    console.log(chalk.cyan.bold('='.repeat(80)));
    console.log(chalk.gray(`Complexity: ${test.complexity} | Points: ${test.pointValue} | Est. Time: ${test.estimatedTime}\n`));

    console.log(chalk.yellow('Required sn-tools commands:'));
    test.requiredSnTools.forEach(cmd => {
      console.log(chalk.gray(`  - ${cmd}`));
    });
    console.log();

    console.log(chalk.white(test.taskPrompt));
    console.log();

    const startTime = Date.now();

    try {
      // Run the task through SimpleTestExecutor with progressive validation
      const result = await this.executor.executeTask(test.taskPrompt, {
        testId: test.id,
        maxTurns: 15,
        requiredSnTools: test.requiredSnTools,    // Pass required commands for validation
        expectedArtifacts: test.expectedArtifacts, // Pass expected deliverables
        complexity: test.complexity                 // Pass complexity for timeout/guidance
      });

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

      // Check success criteria
      const passedCriteria = await this.validateSuccessCriteria(test, result);
      const score = (passedCriteria.length / test.successCriteria.length) * test.pointValue;

      const testResult = {
        id: test.id,
        name: test.name,
        passed: passedCriteria.length === test.successCriteria.length,
        score: score,
        maxScore: test.pointValue,
        duration: duration,
        passedCriteria: passedCriteria,
        failedCriteria: test.successCriteria.filter(c => !passedCriteria.includes(c)),
        mcpMetrics: result.mcpMetrics || null // Add MCP metrics
      };

      this.results.push(testResult);

      // Print result
      if (testResult.passed) {
        console.log(chalk.green.bold(`\n✓ TEST PASSED`));
      } else {
        console.log(chalk.red.bold(`\n✗ TEST FAILED`));
      }
      console.log(chalk.gray(`Score: ${score.toFixed(1)}/${test.pointValue} | Duration: ${duration} min`));

      if (testResult.failedCriteria.length > 0) {
        console.log(chalk.red('\nFailed Criteria:'));
        testResult.failedCriteria.forEach(c => {
          console.log(chalk.red(`  ✗ ${c}`));
        });
      }

      return testResult;

    } catch (error) {
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

      console.log(chalk.red.bold(`\n✗ TEST ERROR: ${error.message}`));

      const testResult = {
        id: test.id,
        name: test.name,
        passed: false,
        score: 0,
        maxScore: test.pointValue,
        duration: duration,
        error: error.message,
        passedCriteria: [],
        failedCriteria: test.successCriteria,
        mcpMetrics: null // No metrics on error
      };

      this.results.push(testResult);
      return testResult;
    }
  }

  /**
   * Find artifact file in multiple possible locations
   * Agents may create files in different subdirectories
   */
  async findArtifact(artifact) {
    const possiblePaths = [
      path.join(process.cwd(), artifact),
      path.join(process.cwd(), 'tools', 'sn-tools', 'ServiceNow-Tools', artifact),
      // Some agents work in the sn-tools directory
      path.join(process.cwd(), 'tools', 'sn-tools', 'ServiceNow-Tools', path.basename(artifact))
    ];

    for (const filePath of possiblePaths) {
      try {
        await fs.access(filePath);
        return filePath;
      } catch {}
    }

    return null;
  }

  /**
   * Read artifact content from any location
   */
  async readArtifact(artifact) {
    const filePath = await this.findArtifact(artifact);
    if (filePath) {
      try {
        return await fs.readFile(filePath, 'utf-8');
      } catch {}
    }
    return null;
  }

  async validateSuccessCriteria(test, result) {
    console.log(chalk.yellow('\n📋 Validating success criteria...'));

    const passed = [];
    const workingDir = process.cwd();

    // Read conversation history to check for tool usage and content
    const conversationFile = path.join(this.executor.outputDir, test.id, 'conversation.json');
    let conversationContent = '';
    try {
      const convData = await fs.readFile(conversationFile, 'utf-8');
      conversationContent = JSON.stringify(JSON.parse(convData));
    } catch (error) {
      console.log(chalk.gray('  ℹ Could not read conversation file'));
    }

    // Check each success criterion
    for (const criterion of test.successCriteria) {
      let criterionPassed = false;

      // Strategy 1: Check for sn-tools command usage (bash OR MCP tool equivalent)
      if (criterion.includes('npm run')) {
        const commandMatch = criterion.match(/npm run (\S+)/);
        if (commandMatch) {
          const command = commandMatch[1];

          // MCP tool equivalents mapping
          const mcpEquivalents = {
            'trace-impact': ['trace_component_impact', 'trace-component-impact'],
            'trace-backward': ['trace_table_dependencies', 'trace-table-dependencies'],
            'trace-lineage': ['trace_full_lineage', 'trace-full-lineage'],
            'validate-change': ['validate_change_impact', 'validate-change-impact'],
            'query': ['query_table_schema', 'query_script_crud', 'query_table_dependencies',
                     'query_component_impact', 'query_api_tables', 'query_api_forward', 'query_api_backward']
          };

          // Get equivalent MCP tools for this command
          const equivalentTools = mcpEquivalents[command] || [];

          // Check if bash command OR any MCP equivalent appears in conversation or artifacts
          const contentToCheck = [conversationContent];
          for (const artifact of test.expectedArtifacts) {
            const artifactContent = await this.readArtifact(artifact);
            if (artifactContent) contentToCheck.push(artifactContent);
          }

          const allContent = contentToCheck.join(' ');

          // Check for bash command
          if (allContent.includes(command) || allContent.includes(`npm run ${command}`)) {
            criterionPassed = true;
          }

          // Check for MCP tool equivalents
          if (!criterionPassed) {
            for (const mcpTool of equivalentTools) {
              if (allContent.includes(mcpTool)) {
                criterionPassed = true;
                break;
              }
            }
          }

          // Also check for MCP tool JSON output patterns that indicate tool was used
          if (!criterionPassed) {
            const hasMcpJsonPattern = allContent.match(/"(component|table|entity)_name":\s*"/i) ||
                                      allContent.match(/"success":\s*true.*"data":/s) ||
                                      allContent.match(/\*\*Tool:\*\*\s*(trace_|query_|validate_)/i);
            if (hasMcpJsonPattern) {
              criterionPassed = true;
            }
          }
        }
      }

      // Strategy 2: Check for identified elements (APIs, Script Includes, Tables, etc.)
      else if (criterion.includes('Identified all')) {
        // Check if analysis files contain relevant sections
        for (const artifact of test.expectedArtifacts) {
          const content = await this.readArtifact(artifact);
          if (content) {

            if (criterion.includes('APIs')) {
              if (content.match(/##?\s*(REST\s*)?API/i) || content.match(/POST|GET|PUT|DELETE.*\/api\//i)) {
                criterionPassed = true;
                break;
              }
            }
            if (criterion.includes('Script Includes')) {
              if (content.match(/##?\s*Script\s*Includes?/i) || content.includes('Script Include')) {
                criterionPassed = true;
                break;
              }
            }
            if (criterion.includes('tables')) {
              if (content.match(/##?\s*Tables?/i) || content.match(/x_\w+_\w+/)) {
                criterionPassed = true;
                break;
              }
            }
            if (criterion.includes('components')) {
              if (content.match(/##?\s*Components?/i) || content.includes('Component')) {
                criterionPassed = true;
                break;
              }
            }
          }
        }
      }

      // Strategy 3: Check for CRUD operations documentation
      else if (criterion.includes('CRUD')) {
        for (const artifact of test.expectedArtifacts) {
          try {
            const content = await this.readArtifact(artifact);
            if (content) {
              if (content.match(/##?\s*CRUD/i) ||
                  (content.includes('Create') && content.includes('Read') &&
                   content.includes('Update') && content.includes('Delete'))) {
                criterionPassed = true;
                break;
              }
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 4: Check for diagrams
      else if (criterion.includes('diagram')) {
        for (const artifact of test.expectedArtifacts) {
          const filePath = path.join(workingDir, artifact);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            if (content.includes('```mermaid') || content.includes('```') ||
                content.includes('→') || content.includes('↓') ||
                content.match(/##?\s*(Lineage|Diagram|Flow)/i)) {
              criterionPassed = true;
              break;
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 5: Check for file existence with specific patterns
      else if (criterion.includes('has all required functions') ||
               criterion.includes('calls') ||
               criterion.includes('Error handling')) {
        // Check if code files exist and have substantive content
        const codePatterns = [
          'script-includes/*.js',
          'business-rules/*.js',
          'tests/*.js'
        ];

        for (const pattern of codePatterns) {
          const dir = path.dirname(path.join(workingDir, pattern));
          try {
            const files = await fs.readdir(dir);
            for (const file of files) {
              if (file.endsWith('.js')) {
                const content = await fs.readFile(path.join(dir, file), 'utf-8');

                if (criterion.includes('has all required functions')) {
                  if (content.includes('function') || content.includes('=>')) {
                    criterionPassed = true;
                    break;
                  }
                }
                if (criterion.includes('calls') && content.includes('WorkItemValidator')) {
                  criterionPassed = true;
                  break;
                }
                if (criterion.includes('Error handling') &&
                    (content.includes('try') || content.includes('catch') || content.includes('throw'))) {
                  criterionPassed = true;
                  break;
                }
              }
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 6: Check for documentation sections
      else if (criterion.includes('documentation') || criterion.includes('Documented')) {
        for (const artifact of test.expectedArtifacts) {
          const filePath = path.join(workingDir, artifact);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const hasMultipleSections = (content.match(/##/g) || []).length >= 3;
            const hasSubstantiveContent = content.length > 1000;

            if (hasMultipleSections && hasSubstantiveContent) {
              criterionPassed = true;
              break;
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 7: Check for analysis quality
      else if (criterion.includes('accurate and comprehensive') ||
               criterion.includes('Analysis') ||
               criterion.includes('professional and thorough')) {
        for (const artifact of test.expectedArtifacts) {
          const filePath = path.join(workingDir, artifact);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            // Consider it comprehensive if it has multiple sections and substantial content
            const sectionCount = (content.match(/##/g) || []).length;
            const wordCount = content.split(/\s+/).length;

            if (sectionCount >= 5 && wordCount >= 500) {
              criterionPassed = true;
              break;
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 8: Check for specific deliverable types
      else if (criterion.includes('Created') || criterion.includes('Includes')) {
        // Check for file patterns mentioned in criterion
        if (criterion.includes('analysis') || criterion.includes('document')) {
          for (const artifact of test.expectedArtifacts) {
            const filePath = path.join(workingDir, artifact);
            try {
              await fs.access(filePath);
              const stats = await fs.stat(filePath);
              if (stats.size > 100) { // At least 100 bytes
                criterionPassed = true;
                break;
              }
            } catch (e) {
            // Ignore file read errors
          }
          }
        }

        if (criterion.includes('test')) {
          try {
            const testDir = path.join(workingDir, 'tests');
            const files = await fs.readdir(testDir);
            if (files.some(f => f.endsWith('.js'))) {
              criterionPassed = true;
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 9: Check for Business Rules and validation logic
      else if (criterion.includes('Business Rule') || criterion.includes('validation')) {
        try {
          const brDir = path.join(workingDir, 'business-rules');
          const files = await fs.readdir(brDir);
          if (files.length > 0) {
            criterionPassed = true;
          }
        } catch {}
      }

      // Strategy 10: Check for JSDoc
      else if (criterion.includes('JSDoc')) {
        const codeFiles = ['script-includes', 'business-rules'];
        for (const dir of codeFiles) {
          try {
            const dirPath = path.join(workingDir, dir);
            const files = await fs.readdir(dirPath);
            for (const file of files) {
              const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
              if (content.includes('/**') || content.includes('* @')) {
                criterionPassed = true;
                break;
              }
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 11: Logging check
      else if (criterion.includes('Logging') || criterion.includes('logging')) {
        const codeFiles = ['script-includes', 'business-rules'];
        for (const dir of codeFiles) {
          try {
            const dirPath = path.join(workingDir, dir);
            const files = await fs.readdir(dirPath);
            for (const file of files) {
              const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
              if (content.includes('gs.log') || content.includes('console.log') ||
                  content.includes('gs.info') || content.includes('gs.warn')) {
                criterionPassed = true;
                break;
              }
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 12: Check for specific content patterns
      else if (criterion.includes('impact assessment')) {
        for (const artifact of test.expectedArtifacts) {
          const filePath = path.join(workingDir, artifact);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            if (content.match(/##?\s*Impact/i) || content.includes('impact') || content.includes('Impact')) {
              criterionPassed = true;
              break;
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 13: Check for relationship information
      else if (criterion.includes('relationships') || criterion.includes('reference fields')) {
        for (const artifact of test.expectedArtifacts) {
          const filePath = path.join(workingDir, artifact);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            if (content.match(/##?\s*Relationship/i) || content.includes('reference') ||
                content.includes('parent') || content.includes('child')) {
              criterionPassed = true;
              break;
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 13b: Check for table schema information
      else if (criterion.includes('table schema') || criterion.includes('Table schema')) {
        for (const artifact of test.expectedArtifacts) {
          const content = await this.readArtifact(artifact);
          if (content) {
            // Check for schema section headers
            const hasSchemaSection = content.match(/##?\s*(Table\s*)?Schema/i);
            // Check for field definitions
            const hasFieldDefinitions = content.match(/\|.*field.*\|/i) ||
                                        content.match(/\|.*column.*\|/i) ||
                                        content.match(/\|.*type.*\|/i);
            // Check for table with field names
            const hasFieldTable = content.match(/\|\s*(sys_id|name|number|created|modified|state)\s*\|/i);
            // Check for query_table_schema output
            const hasQuerySchemaOutput = content.match(/query_table_schema|table-schema/i) ||
                                         content.match(/"fields":\s*\[/);

            if (hasSchemaSection || hasFieldDefinitions || hasFieldTable || hasQuerySchemaOutput) {
              criterionPassed = true;
              break;
            }
          }
        }
      }

      // Strategy 14: Check for workflow/flow information
      else if (criterion.includes('workflow') || criterion.includes('flow')) {
        for (const artifact of test.expectedArtifacts) {
          const filePath = path.join(workingDir, artifact);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            if (content.match(/##?\s*(Workflow|Flow|Data Flow)/i) ||
                content.includes('Business Rule') || content.includes('cascade')) {
              criterionPassed = true;
              break;
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 15: Check for plans and strategies
      else if (criterion.includes('plan') || criterion.includes('strategy') ||
               criterion.includes('checklist')) {
        for (const artifact of test.expectedArtifacts) {
          const filePath = path.join(workingDir, artifact);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            if (content.match(/##?\s*(Plan|Strategy|Checklist|Steps)/i) ||
                content.includes('1.') || content.includes('- [ ]')) {
              criterionPassed = true;
              break;
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 15b: Check for rollback strategy specifically
      else if (criterion.includes('rollback') || criterion.includes('Rollback')) {
        for (const artifact of test.expectedArtifacts) {
          const content = await this.readArtifact(artifact);
          if (content) {
            const hasRollbackSection = content.match(/##?\s*(\d+\.?\s*)?Rollback/i);
            const hasRollbackKeywords = content.match(/rollback|revert|undo|backup|restore/i);
            const hasRollbackSteps = content.match(/rollback\s*(steps?|procedure|plan|strategy)/i);
            const hasRecoverySection = content.match(/##?\s*(Recovery|Disaster Recovery|Backup)/i);

            if (hasRollbackSection || hasRollbackSteps || (hasRollbackKeywords && hasRecoverySection)) {
              criterionPassed = true;
              break;
            }
          }
        }
      }

      // Strategy 15c: Check for risk assessment subsections specifically
      else if (criterion.includes('risk') || criterion.includes('Risk') ||
               criterion.includes('Potential Issues') || criterion.includes('constraints')) {
        for (const artifact of test.expectedArtifacts) {
          const content = await this.readArtifact(artifact);
          if (content) {
            // Check for main risk section
            const hasRiskSection = content.match(/##?\s*(Risk|Potential Issues|Constraints)/i);
            // Check for technical subsection
            const hasTechnical = content.match(/###?\s*(\d+\.?\s*)?(Technical)\s*(Risk|Constraint|Consideration|Issue)?/i) ||
                                 content.match(/technical\s*(risk|constraint|consideration|issue)/i);
            // Check for business subsection
            const hasBusiness = content.match(/###?\s*(\d+\.?\s*)?(Business)\s*(Risk|Constraint|Consideration|Issue)?/i) ||
                                content.match(/business\s*(risk|constraint|consideration|issue)/i);
            // Check for data integrity subsection
            const hasDataIntegrity = content.match(/###?\s*(\d+\.?\s*)?(Data\s*(Integrity|Quality))\s*(Risk|Constraint|Consideration|Issue)?/i) ||
                                     content.match(/data\s*(integrity|quality|validation)\s*(risk|constraint|consideration|issue)?/i);

            // Pass if risk section exists with at least two subsections
            const subsectionCount = [hasTechnical, hasBusiness, hasDataIntegrity].filter(Boolean).length;
            if (hasRiskSection && subsectionCount >= 2) {
              criterionPassed = true;
              break;
            }
            // Also pass if has risk section and substantial content
            if (hasRiskSection && content.length > 2000) {
              criterionPassed = true;
              break;
            }
          }
        }
      }

      // Strategy 16: Default - check if any expected artifacts exist with content
      if (!criterionPassed && test.expectedArtifacts.length > 0) {
        for (const artifact of test.expectedArtifacts) {
          const filePath = path.join(workingDir, artifact);
          try {
            const stats = await fs.stat(filePath);
            if (stats.size > 500) { // Substantive content
              // This is a weak match - only use as last resort
              // Don't mark as passed unless criterion is very generic
              if (criterion.includes('Created') || criterion.includes('clean')) {
                criterionPassed = true;
                break;
              }
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 17: Security Analysis
      else if (criterion.includes('security') || criterion.includes('Security')) {
        for (const artifact of test.expectedArtifacts) {
          const filePath = path.join(workingDir, artifact);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const hasSecuritySection = content.match(/##?\s*(\d+\.?\s*)?Security/i);
            const hasSecurityKeywords = (
              content.includes('ACL') || content.includes('permission') ||
              content.includes('authorization') || content.includes('authentication') ||
              content.includes('role') || content.toLowerCase().includes('security')
            );
            const hasSecurityTable = content.match(/\|\s*Security\s*\|/i);
            const hasSecuritySubsection = content.match(/###?\s*(\d+\.?\s*)?Security\s*(Constraints?|Considerations?|Issues?|Implications?|Analysis)/i);

            if (hasSecuritySection || hasSecuritySubsection || (hasSecurityKeywords && hasSecurityTable)) {
              criterionPassed = true;
              break;
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 18: Effort Estimation
      else if (criterion.includes('effort') || criterion.includes('Estimated')) {
        for (const artifact of test.expectedArtifacts) {
          const filePath = path.join(workingDir, artifact);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const hasEffortSection = content.match(/##?\s*(Effort|Estimation|Estimate|Timeline|Duration|Schedule)/i);
            const hasTimeUnits = content.match(/\d+\s*(hours?|hrs?|days?|weeks?|months?)/i);
            const hasCostEstimate = content.match(/\$\d+/);
            const hasResourceEstimate = content.match(/\d+\s*(FTE|developers?|engineers?|people)/i);

            if ((hasEffortSection && hasTimeUnits) || (hasTimeUnits && hasCostEstimate) || hasResourceEstimate) {
              criterionPassed = true;
              break;
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 19: Dependencies Between Steps
      else if (criterion.includes('dependencies between') || criterion.includes('Identified dependencies')) {
        for (const artifact of test.expectedArtifacts) {
          const filePath = path.join(workingDir, artifact);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const hasDependencySection = content.match(/##?\s*Dependencies/i);
            const hasDependencyList = content.match(/depends on|prerequisite|required before|must be completed/i);
            const hasSequence = content.match(/##?\s*(Sequence|Order|Prerequisites?|Deployment\s*Sequence)/i);
            const hasDependencyDiagram = content.includes('→') && content.match(/Phase|Step/i);

            if (hasDependencySection || hasDependencyList || hasSequence || hasDependencyDiagram) {
              criterionPassed = true;
              break;
            }
          } catch (e) {
            // Ignore file read errors
          }
        }
      }

      // Strategy 20: Existing System Analysis
      else if (criterion.includes('existing') || criterion.includes('Analyzed existing')) {
        for (const artifact of test.expectedArtifacts) {
          const content = await this.readArtifact(artifact);
          if (content) {
            const hasExistingSection = content.match(/##?\s*Existing\s*(System|Components?|Infrastructure|Implementation|Architecture)/i);
            const hasCurrentState = content.match(/##?\s*Current\s*(State|Architecture|Implementation|System)/i);
            const hasAnalysisKeywords = content.match(/currently|existing|already in place|as-is/i);

            // Check for sn-tools outputs (bash OR MCP)
            const hasBashOutput = content.match(/```(bash|shell)\s*\n.*npm run/i);
            const hasMcpToolOutput = content.match(/trace_(component_impact|table_dependencies|full_lineage)|query_|validate_change_impact/i);
            const hasJsonOutput = content.match(/```json\s*\n\s*\{/);
            const hasToolOutput = hasBashOutput || (hasMcpToolOutput && hasJsonOutput);

            // Pass conditions
            if (hasExistingSection || (hasToolOutput && hasCurrentState) ||
                (hasToolOutput && hasAnalysisKeywords) || (hasMcpToolOutput && hasAnalysisKeywords)) {
              criterionPassed = true;
              break;
            }
          }
        }
      }

      // Strategy 21: Check for sn-tools command outputs (bash OR MCP tool JSON)
      // This handles the criterion "Included sn-tools command outputs" which can be
      // satisfied by either bash command outputs OR MCP tool JSON responses
      if (!criterionPassed && (criterion.includes('sn-tools') || criterion.includes('command outputs'))) {
        for (const artifact of test.expectedArtifacts) {
          const content = await this.readArtifact(artifact);
          if (content) {
            // Check for bash command outputs (traditional)
            const hasBashOutput = content.match(/```(bash|shell)\s*\n\s*\$?\s*npm run/i) ||
                                  content.match(/\$\s*(npm run|cd tools)/);

            // Check for MCP tool JSON outputs (new preferred method)
            const hasMcpToolCall = content.match(/trace_component_impact|trace_table_dependencies|trace_full_lineage|validate_change_impact|query_/i);
            const hasMcpJsonOutput = content.match(/```json\s*\n\s*\{\s*"(success|data|component|table|entity)"/i);
            const hasToolParameters = content.match(/\*\*Parameters( Used)?:\*\*\s*```json/i);
            const hasToolResponse = content.match(/\*\*Tool Response:\*\*\s*```json/i);

            // Check for MCP metadata indicators
            const hasMcpMetadata = content.match(/"metadata":\s*\{[^}]*"confidence"/i) ||
                                   content.match(/"confidence":\s*\{[^}]*"level"/i);

            // Pass if bash outputs OR MCP tool outputs are present
            if (hasBashOutput || (hasMcpToolCall && hasMcpJsonOutput) ||
                (hasToolParameters && hasToolResponse) || hasMcpMetadata) {
              criterionPassed = true;
              break;
            }
          }
        }
      }

      if (criterionPassed) {
        passed.push(criterion);
        console.log(chalk.green(`  ✓ ${criterion}`));
      } else {
        console.log(chalk.red(`  ✗ ${criterion}`));

        // Add failure reason
        const failureReasons = [];
        if (criterion.includes('security') || criterion.includes('Security')) {
          failureReasons.push('Missing "Security" section or security keywords (ACL, permission, role)');
        }
        if (criterion.includes('effort') || criterion.includes('Estimated')) {
          failureReasons.push('Missing effort estimation (hours/days) or cost ($)');
        }
        if (criterion.includes('dependencies between') || criterion.includes('Identified dependencies')) {
          failureReasons.push('Missing dependencies section or prerequisite information');
        }
        if (criterion.includes('existing') || criterion.includes('Analyzed existing')) {
          failureReasons.push('Missing existing system analysis or sn-tools command outputs');
        }
        if (criterion.includes('npm run')) {
          const commandMatch = criterion.match(/npm run (\S+)/);
          if (commandMatch) {
            failureReasons.push(`Command "npm run ${commandMatch[1]}" not found in conversation or artifacts`);
          }
        }
        if (criterion.includes('diagram')) {
          failureReasons.push('Missing diagram (mermaid, arrows, or visual representation)');
        }
        if (criterion.includes('CRUD')) {
          failureReasons.push('Missing CRUD operations section or Create/Read/Update/Delete documentation');
        }
        if (criterion.includes('sn-tools') || criterion.includes('command outputs')) {
          failureReasons.push('Missing sn-tools outputs - need bash commands (npm run ...) OR MCP tool JSON responses');
        }

        if (failureReasons.length > 0) {
          console.log(chalk.yellow(`    → ${failureReasons.join('; ')}`));
        }
      }
    }

    console.log(chalk.gray(`\nPassed: ${passed.length}/${test.successCriteria.length}`));
    return passed;
  }

  async runTestSuite(tests, interactive = true) {
    console.log(chalk.cyan.bold('\nRunning Component-Backend Integration Test Suite\n'));
    console.log(chalk.gray(`Total tests: ${tests.length}`));
    console.log(chalk.gray(`Total points: ${tests.reduce((sum, t) => sum + t.pointValue, 0)}`));

    // Calculate estimated costs
    const totalEstimatedCost = tests.reduce((sum, t) => {
      if (t.estimatedCost) {
        const match = t.estimatedCost.match(/\$?([\d.]+)/);
        return sum + (match ? parseFloat(match[1]) : 0);
      }
      return sum;
    }, 0);
    console.log(chalk.yellow(`Estimated cost: $${totalEstimatedCost.toFixed(2)}-${(totalEstimatedCost * 1.5).toFixed(2)} USD`));
    console.log(chalk.gray(`(Based on actual test runs from Nov 2025)\n`));

    for (const test of tests) {
      if (interactive) {
        // Prompt to continue
        console.log(chalk.yellow(`\nPress Enter to run test ${test.id}...`));
        // await new Promise(resolve => process.stdin.once('data', resolve));
      }

      await this.runTest(test);
    }

    this.printFinalResults();
  }

  printFinalResults() {
    console.log(chalk.cyan.bold(`\n${'='.repeat(80)}`));
    console.log(chalk.cyan.bold('FINAL RESULTS'));
    console.log(chalk.cyan.bold(`${'='.repeat(80)}\n`));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const totalScore = this.results.reduce((sum, r) => sum + r.score, 0);
    const maxScore = this.results.reduce((sum, r) => sum + r.maxScore, 0);
    const avgDuration = (this.results.reduce((sum, r) => sum + parseFloat(r.duration), 0) / totalTests).toFixed(2);

    console.log(chalk.white(`Tests Passed: ${passedTests}/${totalTests}`));
    console.log(chalk.white(`Total Score: ${totalScore.toFixed(1)}/${maxScore}`));
    console.log(chalk.white(`Percentage: ${((totalScore / maxScore) * 100).toFixed(1)}%`));
    console.log(chalk.white(`Avg Duration: ${avgDuration} min\n`));

    console.log(chalk.cyan('Individual Test Results:\n'));
    this.results.forEach(r => {
      const status = r.passed ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
      const score = `${r.score.toFixed(1)}/${r.maxScore}`;
      console.log(`${status} ${r.id} - ${r.name} (${score} pts, ${r.duration} min)`);
    });

    // MCP Metrics Summary
    const mcpSummary = this.aggregateMcpMetrics();
    if (mcpSummary.total_tool_calls > 0) {
      console.log(chalk.cyan.bold(`\n${'='.repeat(80)}`));
      console.log(chalk.cyan.bold('MCP TOOL METRICS'));
      console.log(chalk.cyan.bold(`${'='.repeat(80)}\n`));

      console.log(chalk.white(`Total MCP Tool Calls: ${mcpSummary.total_tool_calls}`));
      console.log(chalk.white(`Average Response Size: ${mcpSummary.avg_response_size_kb} KB`));
      console.log(chalk.white(`Total Response Size: ${mcpSummary.total_response_size_kb} KB`));
      console.log(chalk.white(`Truncated Responses: ${mcpSummary.truncated_responses} (${mcpSummary.truncation_percentage}%)`));
      console.log(chalk.white(`Average Execution Time: ${mcpSummary.avg_execution_time_ms}ms\n`));

      if (Object.keys(mcpSummary.by_tool).length > 0) {
        console.log(chalk.cyan('By Tool:\n'));
        Object.entries(mcpSummary.by_tool).forEach(([tool, metrics]) => {
          console.log(chalk.gray(`  ${tool}:`));
          console.log(chalk.gray(`    Calls: ${metrics.calls}`));
          console.log(chalk.gray(`    Avg Size: ${metrics.avg_size_kb} KB`));
          console.log(chalk.gray(`    Avg Time: ${metrics.avg_time_ms}ms`));
          if (metrics.truncated_count > 0) {
            console.log(chalk.yellow(`    Truncated: ${metrics.truncated_count}`));
          }
        });
      }

      if (mcpSummary.largest_response) {
        console.log(chalk.cyan('\nLargest Response:'));
        console.log(chalk.gray(`  Tool: ${mcpSummary.largest_response.tool}`));
        console.log(chalk.gray(`  Size: ${mcpSummary.largest_response.size_kb} KB (${mcpSummary.largest_response.size_chars} chars)`));
        console.log(chalk.gray(`  Test: ${mcpSummary.largest_response.test_id}`));
      }
    }

    console.log();
  }

  /**
   * Aggregate MCP metrics from all test results
   * @returns {Object} - Aggregated MCP metrics
   */
  aggregateMcpMetrics() {
    const summary = {
      total_tool_calls: 0,
      total_response_size_kb: 0,
      truncated_responses: 0,
      total_execution_time_ms: 0,
      avg_response_size_kb: 0,
      avg_execution_time_ms: 0,
      truncation_percentage: 0,
      by_tool: {},
      largest_response: null
    };

    for (const result of this.results) {
      if (!result.mcpMetrics) continue;

      const m = result.mcpMetrics;
      summary.total_tool_calls += m.tool_calls || 0;
      summary.total_response_size_kb += m.total_response_size_kb || 0;
      summary.truncated_responses += m.truncated_responses || 0;
      summary.total_execution_time_ms += m.total_execution_time_ms || 0;

      // Aggregate by tool
      if (m.by_tool) {
        for (const [tool, metrics] of Object.entries(m.by_tool)) {
          if (!summary.by_tool[tool]) {
            summary.by_tool[tool] = {
              calls: 0,
              total_size_kb: 0,
              total_time_ms: 0,
              truncated_count: 0
            };
          }
          summary.by_tool[tool].calls += metrics.calls || 0;
          summary.by_tool[tool].total_size_kb += metrics.total_size_kb || 0;
          summary.by_tool[tool].total_time_ms += metrics.total_time_ms || 0;
          summary.by_tool[tool].truncated_count += metrics.truncated_count || 0;
        }
      }

      // Track largest response
      if (m.largest_response) {
        if (!summary.largest_response || m.largest_response.size_kb > summary.largest_response.size_kb) {
          summary.largest_response = {
            ...m.largest_response,
            test_id: result.id
          };
        }
      }
    }

    // Calculate averages and percentages
    if (summary.total_tool_calls > 0) {
      summary.avg_response_size_kb = (summary.total_response_size_kb / summary.total_tool_calls).toFixed(2);
      summary.avg_response_size_kb = parseFloat(summary.avg_response_size_kb);

      summary.avg_execution_time_ms = Math.round(summary.total_execution_time_ms / summary.total_tool_calls);

      summary.truncation_percentage = ((summary.truncated_responses / summary.total_tool_calls) * 100).toFixed(1);
    }

    // Calculate per-tool averages
    for (const [tool, metrics] of Object.entries(summary.by_tool)) {
      if (metrics.calls > 0) {
        metrics.avg_size_kb = (metrics.total_size_kb / metrics.calls).toFixed(2);
        metrics.avg_size_kb = parseFloat(metrics.avg_size_kb);

        metrics.avg_time_ms = Math.round(metrics.total_time_ms / metrics.calls);
      }
    }

    // Round totals
    summary.total_response_size_kb = parseFloat(summary.total_response_size_kb.toFixed(2));

    return summary;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const runner = new ComponentBackendTestRunner();
  await runner.initialize();
  await runner.runTestSuite(COMPONENT_BACKEND_TESTS, false);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red(`\nFatal error: ${error.message}`));
    console.error(error.stack);
    process.exit(1);
  });
}

export { COMPONENT_BACKEND_TESTS, ComponentBackendTestRunner };
