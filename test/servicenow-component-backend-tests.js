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
import { Orchestrator } from '../lib/orchestrator.js';
import { ConfigManager } from '../lib/config-manager.js';
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
    this.config = new ConfigManager();
    this.orchestrator = null;
    this.results = [];
  }

  async initialize() {
    console.log(chalk.blue('Initializing test runner...'));
    this.orchestrator = new Orchestrator({
      model: 'claude-sonnet-4',
      maxAgents: 5,
      verbose: true
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
      // Run the task through orchestrator
      const result = await this.orchestrator.executeTask(test.taskPrompt, {
        sessionId: `component-backend-test-${test.id}`,
        maxTurns: 20,
        requireApproval: false
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
        failedCriteria: test.successCriteria.filter(c => !passedCriteria.includes(c))
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
        failedCriteria: test.successCriteria
      };

      this.results.push(testResult);
      return testResult;
    }
  }

  async validateSuccessCriteria(test, result) {
    // This would need to be implemented to actually check the created artifacts
    // For now, return placeholder
    console.log(chalk.yellow('\n⚠ Success criteria validation not yet implemented'));
    console.log(chalk.gray('Checking for expected artifacts...'));

    const passed = [];
    // Check if expected artifacts exist
    for (const artifact of test.expectedArtifacts) {
      const filePath = path.join(process.cwd(), artifact);
      try {
        await fs.access(filePath);
        console.log(chalk.green(`  ✓ Found: ${artifact}`));
        passed.push(`File exists: ${artifact}`);
      } catch {
        console.log(chalk.red(`  ✗ Missing: ${artifact}`));
      }
    }

    return passed;
  }

  async runTestSuite(tests, interactive = true) {
    console.log(chalk.cyan.bold('\nRunning Component-Backend Integration Test Suite\n'));
    console.log(chalk.gray(`Total tests: ${tests.length}`));
    console.log(chalk.gray(`Total points: ${tests.reduce((sum, t) => sum + t.pointValue, 0)}\n`));

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
    console.log(chalk.cyan.bold('='.repeat(80)}\n`));

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

    console.log();
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
