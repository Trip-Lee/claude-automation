#!/usr/bin/env node

/**
 * ServiceNow Flow Understanding Tests
 *
 * Purpose: Test the AI's ability to:
 * 1. Fully understand ServiceNow Flow Designer flows
 * 2. Detect which flows trigger based on record updates
 * 3. Predict what happens to a record when flows execute
 *
 * These tests validate that agents can effectively use:
 * - servicenow-agent-cache.json (lightweight, quick lookups)
 * - servicenow-full-cache.json (deep analysis with scripts)
 * - sn-flow-parser.js (real-time queries)
 *
 * Test Categories:
 * - FLOW_UNDERSTANDING: Can the agent explain what a flow does?
 * - TRIGGER_DETECTION: Can the agent identify which flows trigger on record changes?
 * - IMPACT_ANALYSIS: Can the agent predict the outcome of flow execution?
 */

import chalk from 'chalk';
import { SimpleTestExecutor } from './lib/simple-test-executor.js';
import { promises as fs } from 'fs';
import path from 'path';
import { homedir } from 'os';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(homedir(), '.env') });

console.log(chalk.cyan.bold('\n🔄 SERVICENOW FLOW UNDERSTANDING TESTS\n'));
console.log(chalk.gray('Testing AI ability to understand flows and predict trigger behavior\n'));

// ============================================================================
// PATHS TO SERVICENOW TOOLS
// ============================================================================

const SN_TOOLS_PATH = '/home/coltrip/projects/sn-tools/ServiceNow-Tools';
const AGENT_CACHE_PATH = path.join(SN_TOOLS_PATH, 'cache', 'servicenow-agent-cache.json');
const FULL_CACHE_PATH = path.join(SN_TOOLS_PATH, 'cache', 'servicenow-full-cache.json');
const FLOW_PARSER_PATH = path.join(SN_TOOLS_PATH, 'src', 'sn-flow-parser.js');

// ============================================================================
// TEST DEFINITIONS
// ============================================================================

/**
 * FLOW UNDERSTANDING TESTS
 * Test agent's ability to explain what a flow does
 */
const FLOW_UNDERSTANDING_TESTS = [
  {
    id: 'FLOW-UNDERSTAND-001',
    name: 'Explain Flow Purpose and Steps',
    description: 'Agent should fully explain what the Send Email V4 flow does',
    taskPrompt: `Using the ServiceNow cache files and flow parser, analyze the "Send Email V4" flow and provide a complete explanation.

Cache files are located at:
- Agent cache: ${AGENT_CACHE_PATH}
- Full cache: ${FULL_CACHE_PATH}
- Flow parser: ${FLOW_PARSER_PATH}

Please provide:
1. What is the purpose of this flow?
2. How many steps does it have?
3. Which steps contain scripts? What do those scripts do?
4. What tables does this flow read from or write to?
5. What triggers this flow?
6. What is the overall complexity and risk level?

Write your analysis to a file: flow-analysis/send-email-v4-analysis.md`,
    expectedArtifacts: [
      'flow-analysis/send-email-v4-analysis.md'
    ],
    successCriteria: [
      'Correctly identifies 22 steps',
      'Identifies script steps (8 with scripts)',
      'Mentions Refresh Audience Hash as step 1',
      'Mentions Generate Temps, Generate Mailing List Address steps',
      'Identifies tables affected (x_cadso_automate_email_send)',
      'Describes the flow as HIGH complexity',
      'Explains the batching logic for large audiences'
    ],
    estimatedTime: '3-5 minutes',
    expectedAgents: ['architect', 'sn-flows', 'reviewer'],
    complexity: 'MEDIUM',
    pointValue: 25
  },

  {
    id: 'FLOW-UNDERSTAND-002',
    name: 'Extract and Explain Script Logic',
    description: 'Agent should read and explain specific script content from a flow step',
    taskPrompt: `Using the ServiceNow full cache or flow parser, extract the script from Step 1 of the "Send Email V4" flow and explain what it does.

Tools available:
- Full cache: ${FULL_CACHE_PATH}
- Flow parser CLI: node ${FLOW_PARSER_PATH} --step "Send Email V4" 1

Please provide:
1. The complete script code
2. Line-by-line explanation of what the script does
3. What inputs does it expect?
4. What Script Includes or APIs does it call?
5. Are there any potential issues or improvements?

Write your analysis to: flow-analysis/step1-script-analysis.md`,
    expectedArtifacts: [
      'flow-analysis/step1-script-analysis.md'
    ],
    successCriteria: [
      'Extracts the actual script code',
      'Identifies inputs.sendId usage',
      'Identifies Audience API call (audienceApi.refreshAudienceHash)',
      'Explains the gs.info logging',
      'Notes the script is for refreshing audience hash'
    ],
    estimatedTime: '2-4 minutes',
    expectedAgents: ['architect', 'sn-scripting', 'reviewer'],
    complexity: 'SIMPLE',
    pointValue: 15
  },

  {
    id: 'FLOW-UNDERSTAND-003',
    name: 'Map Flow Dependencies',
    description: 'Agent should identify all dependencies of a flow',
    taskPrompt: `Analyze the "Send Email V4" flow and map all its dependencies.

Using the cache files at:
- Agent cache: ${AGENT_CACHE_PATH}
- Full cache: ${FULL_CACHE_PATH}

Create a dependency map showing:
1. Script Includes referenced
2. Tables accessed (read/write/reference)
3. External APIs or integrations called
4. Subflows called (if any)
5. Any other flows that might be affected

Output format: JSON file with structured dependency data
Write to: flow-analysis/send-email-v4-dependencies.json`,
    expectedArtifacts: [
      'flow-analysis/send-email-v4-dependencies.json'
    ],
    successCriteria: [
      'Valid JSON output',
      'Lists tables: x_cadso_automate_email_send, x_cadso_automate_email_temp, etc.',
      'Identifies Script Includes used',
      'Notes mailing list API interactions',
      'Documents GlideRecord usage patterns'
    ],
    estimatedTime: '3-5 minutes',
    expectedAgents: ['architect', 'sn-flows', 'reviewer'],
    complexity: 'MEDIUM',
    pointValue: 20
  }
];

/**
 * TRIGGER DETECTION TESTS
 * Test agent's ability to identify which flows trigger on record changes
 */
const TRIGGER_DETECTION_TESTS = [
  {
    id: 'TRIGGER-DETECT-001',
    name: 'Identify Triggers for Table Update',
    description: 'Agent should identify all flows that trigger when a specific table is updated',
    taskPrompt: `A developer is about to update a record in the x_cadso_automate_email_send table.

Using the ServiceNow agent cache at: ${AGENT_CACHE_PATH}

Answer these questions:
1. What flows will potentially trigger on this update?
2. What are the trigger conditions for each flow?
3. Which updates would trigger each flow (field changes, status changes, etc.)?
4. What is the risk level for this table?
5. Are any flows set to run in the background?

Provide a clear summary that a developer could use to understand the impact.
Write to: trigger-analysis/email-send-update-triggers.md`,
    expectedArtifacts: [
      'trigger-analysis/email-send-update-triggers.md'
    ],
    successCriteria: [
      'Identifies multiple triggers on x_cadso_automate_email_send',
      'Notes trigger conditions (statusCHANGESTOsend-ready, email_htmlVALCHANGES, etc.)',
      'Identifies flows: Send Email V4, Verify DNS Settings Flow, etc.',
      'Mentions HIGH risk level',
      'Notes which run in background'
    ],
    estimatedTime: '2-4 minutes',
    expectedAgents: ['architect', 'sn-flows', 'reviewer'],
    complexity: 'SIMPLE',
    pointValue: 20
  },

  {
    id: 'TRIGGER-DETECT-002',
    name: 'Specific Field Change Impact',
    description: 'Agent should identify what happens when a specific field changes',
    taskPrompt: `A user is changing the 'status' field on an x_cadso_automate_email_send record from 'draft' to 'send-ready'.

Using the caches at:
- Agent cache: ${AGENT_CACHE_PATH}
- Full cache (if needed): ${FULL_CACHE_PATH}

Determine:
1. Will any flows trigger? Which ones?
2. What is the exact trigger condition that matches this change?
3. What will each triggered flow do (high-level summary)?
4. How many steps will execute?
5. What is the estimated impact on the system?

Write a detailed impact report to: trigger-analysis/status-change-impact.md`,
    expectedArtifacts: [
      'trigger-analysis/status-change-impact.md'
    ],
    successCriteria: [
      'Identifies trigger condition: statusCHANGESTOsend-ready',
      'Identifies that Send Email V4 or similar flow will trigger',
      'Explains the flow will process the email send',
      'Notes step count and complexity',
      'Mentions audience processing, mailing list creation'
    ],
    estimatedTime: '3-5 minutes',
    expectedAgents: ['architect', 'sn-flows', 'reviewer'],
    complexity: 'MEDIUM',
    pointValue: 25
  },

  {
    id: 'TRIGGER-DETECT-003',
    name: 'Multi-Table Cascade Detection',
    description: 'Agent should trace cascading triggers across multiple tables',
    taskPrompt: `When a record in x_cadso_automate_email_send is updated, flows may modify other tables which could trigger additional flows.

Using all available ServiceNow tools:
- Agent cache: ${AGENT_CACHE_PATH}
- Full cache: ${FULL_CACHE_PATH}
- Flow parser: ${FLOW_PARSER_PATH}

Trace the potential cascade:
1. What flows trigger on x_cadso_automate_email_send update?
2. What tables do those flows modify?
3. Are there triggers on those secondary tables?
4. What is the full cascade of possible flow executions?
5. What is the total risk assessment?

Create a cascade diagram and analysis in: trigger-analysis/cascade-analysis.md`,
    expectedArtifacts: [
      'trigger-analysis/cascade-analysis.md'
    ],
    successCriteria: [
      'Identifies primary triggers on email_send',
      'Notes tables modified (email_temp, domain, etc.)',
      'Checks for secondary triggers',
      'Creates clear cascade visualization',
      'Provides risk assessment'
    ],
    estimatedTime: '5-8 minutes',
    expectedAgents: ['architect', 'sn-flows', 'sn-security', 'reviewer'],
    complexity: 'COMPLEX',
    pointValue: 35
  }
];

/**
 * IMPACT ANALYSIS TESTS
 * Test agent's ability to predict what happens to a record after flow execution
 */
const IMPACT_ANALYSIS_TESTS = [
  {
    id: 'IMPACT-001',
    name: 'Predict Record State After Flow',
    description: 'Agent should predict what fields will change on a record after flow execution',
    taskPrompt: `Given an x_cadso_automate_email_send record with:
- sys_id: abc123
- status: draft
- audiences: [list of audience sys_ids]
- email_html: <html content>

A user changes status from 'draft' to 'send-ready'.

Using the full cache and flow parser:
- Full cache: ${FULL_CACHE_PATH}
- Flow parser: ${FLOW_PARSER_PATH}

Predict:
1. What fields on this record will be modified by the triggered flows?
2. What new records might be created in other tables?
3. What is the sequence of changes?
4. What is the final expected state of the record?
5. What external systems might be called?

Write predictions to: impact-analysis/email-send-state-prediction.md`,
    expectedArtifacts: [
      'impact-analysis/email-send-state-prediction.md'
    ],
    successCriteria: [
      'Predicts mailing_list_address will be set',
      'Notes email_temp records will be created',
      'Identifies audience hash refresh',
      'Notes mailing list creation',
      'Predicts external email API calls'
    ],
    estimatedTime: '4-6 minutes',
    expectedAgents: ['architect', 'sn-flows', 'reviewer'],
    complexity: 'MEDIUM',
    pointValue: 30
  },

  {
    id: 'IMPACT-002',
    name: 'Error Scenario Analysis',
    description: 'Agent should identify what happens if a flow step fails',
    taskPrompt: `Analyze the "Send Email V4" flow for error handling.

Using:
- Full cache: ${FULL_CACHE_PATH}
- Flow parser: node ${FLOW_PARSER_PATH} --steps "Send Email V4"

Answer:
1. What error handling exists in the flow (try/catch blocks)?
2. What happens if step "Generate Mailing List Address" fails?
3. What happens if the external email API fails?
4. Will the record be left in an inconsistent state?
5. What recovery options exist?

Write error analysis to: impact-analysis/error-scenario-analysis.md`,
    expectedArtifacts: [
      'impact-analysis/error-scenario-analysis.md'
    ],
    successCriteria: [
      'Identifies Top Level Try/Catch in flow',
      'Notes error handling in steps 23-25',
      'Analyzes script error handling',
      'Discusses record state on failure',
      'Suggests recovery approaches'
    ],
    estimatedTime: '4-6 minutes',
    expectedAgents: ['architect', 'sn-flows', 'sn-security', 'reviewer'],
    complexity: 'MEDIUM',
    pointValue: 30
  },

  {
    id: 'IMPACT-003',
    name: 'Performance Impact Prediction',
    description: 'Agent should predict performance impact of flow execution',
    taskPrompt: `A batch operation will update 1000 x_cadso_automate_email_send records to status='send-ready'.

Using the ServiceNow caches and flow parser, analyze:
1. How many flow instances will be triggered?
2. How many total steps will execute across all instances?
3. What is the estimated execution time?
4. What tables will experience high write load?
5. Are there any bottlenecks or concerns?
6. What recommendations would you make for this batch operation?

Write performance analysis to: impact-analysis/batch-performance-analysis.md`,
    expectedArtifacts: [
      'impact-analysis/batch-performance-analysis.md'
    ],
    successCriteria: [
      'Calculates 1000 flow instances',
      'Estimates total steps (22 * 1000 = 22000)',
      'Identifies high-load tables',
      'Notes potential batching within flows',
      'Recommends throttling or scheduling'
    ],
    estimatedTime: '4-6 minutes',
    expectedAgents: ['architect', 'sn-performance', 'reviewer'],
    complexity: 'MEDIUM',
    pointValue: 30
  }
];

// ============================================================================
// TEST EXECUTION
// ============================================================================

async function runTests() {
  const executor = new SimpleTestExecutor({
    verbose: true,
    generateStructuredReports: true,
    workingDir: process.cwd()
  });

  const results = {
    flowUnderstanding: [],
    triggerDetection: [],
    impactAnalysis: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    }
  };

  // Check cache files exist
  console.log(chalk.yellow('\n📁 Checking cache files...\n'));

  try {
    await fs.access(AGENT_CACHE_PATH);
    console.log(chalk.green(`  ✓ Agent cache found: ${AGENT_CACHE_PATH}`));
  } catch {
    console.log(chalk.red(`  ✗ Agent cache not found: ${AGENT_CACHE_PATH}`));
    console.log(chalk.yellow('    Run: cd /home/coltrip/projects/sn-tools/ServiceNow-Tools && node src/sn-cache-generator.js --agent'));
    return;
  }

  try {
    await fs.access(FULL_CACHE_PATH);
    console.log(chalk.green(`  ✓ Full cache found: ${FULL_CACHE_PATH}`));
  } catch {
    console.log(chalk.red(`  ✗ Full cache not found: ${FULL_CACHE_PATH}`));
    console.log(chalk.yellow('    Run: cd /home/coltrip/projects/sn-tools/ServiceNow-Tools && node src/sn-cache-generator.js --full'));
    return;
  }

  // Parse command line arguments
  const args = process.argv.slice(2);
  const testFilter = args.find(a => a.startsWith('--test='))?.split('=')[1];
  const categoryFilter = args.find(a => a.startsWith('--category='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  const listOnly = args.includes('--list');

  // Collect all tests
  let allTests = [
    ...FLOW_UNDERSTANDING_TESTS.map(t => ({ ...t, category: 'flowUnderstanding' })),
    ...TRIGGER_DETECTION_TESTS.map(t => ({ ...t, category: 'triggerDetection' })),
    ...IMPACT_ANALYSIS_TESTS.map(t => ({ ...t, category: 'impactAnalysis' }))
  ];

  // Apply filters
  if (testFilter) {
    allTests = allTests.filter(t => t.id === testFilter || t.id.includes(testFilter));
  }
  if (categoryFilter) {
    allTests = allTests.filter(t => t.category === categoryFilter);
  }

  // List mode
  if (listOnly) {
    console.log(chalk.cyan('\n📋 Available Tests:\n'));
    allTests.forEach(t => {
      console.log(chalk.white(`  ${t.id}: ${t.name}`));
      console.log(chalk.gray(`    Category: ${t.category}, Complexity: ${t.complexity}, Points: ${t.pointValue}`));
    });
    console.log(chalk.gray(`\n  Total: ${allTests.length} tests\n`));
    return;
  }

  console.log(chalk.cyan(`\n🧪 Running ${allTests.length} tests...\n`));

  for (const test of allTests) {
    console.log(chalk.cyan(`\n${'─'.repeat(60)}`));
    console.log(chalk.cyan.bold(`📝 ${test.id}: ${test.name}`));
    console.log(chalk.gray(`   Category: ${test.category}`));
    console.log(chalk.gray(`   Complexity: ${test.complexity}`));
    console.log(chalk.gray(`   Points: ${test.pointValue}`));
    console.log(chalk.cyan(`${'─'.repeat(60)}\n`));

    if (dryRun) {
      console.log(chalk.yellow('  [DRY RUN] Would execute:'));
      console.log(chalk.gray(`  ${test.taskPrompt.substring(0, 200)}...`));
      results.summary.skipped++;
      continue;
    }

    results.summary.total++;

    try {
      const startTime = Date.now();

      const result = await executor.executeTask(test.taskPrompt, {
        testId: test.id,
        complexity: test.complexity,
        maxTurns: test.complexity === 'COMPLEX' ? 15 : 10,
        timeout: test.complexity === 'COMPLEX' ? 600000 : 300000
      });

      const duration = Date.now() - startTime;

      // Validate results
      const validation = await validateTestResult(test, result);

      if (validation.passed) {
        console.log(chalk.green(`  ✓ PASSED (${(duration / 1000).toFixed(1)}s)`));
        results.summary.passed++;
      } else {
        console.log(chalk.red(`  ✗ FAILED: ${validation.reason}`));
        results.summary.failed++;
      }

      results[test.category].push({
        ...test,
        result,
        validation,
        duration
      });

    } catch (error) {
      console.log(chalk.red(`  ✗ ERROR: ${error.message}`));
      results.summary.failed++;
      results[test.category].push({
        ...test,
        error: error.message,
        validation: { passed: false, reason: error.message }
      });
    }
  }

  // Print summary
  printSummary(results);

  // Save results
  const resultsPath = path.join(process.cwd(), 'test-outputs', 'flow-understanding-results.json');
  await fs.mkdir(path.dirname(resultsPath), { recursive: true });
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  console.log(chalk.gray(`\nResults saved to: ${resultsPath}`));
}

/**
 * Validate test results against success criteria
 */
async function validateTestResult(test, result) {
  const validation = {
    passed: true,
    reason: '',
    criteriaResults: []
  };

  // Check if artifacts were created - check multiple possible locations
  // Agents may write to different directories depending on context
  const artifactSearchPaths = [
    process.cwd(),                              // Current working directory
    SN_TOOLS_PATH,                              // sn-tools directory (where agents often write)
    path.join(process.cwd(), 'test-outputs'),   // Test outputs directory
    '/home/coltrip/claude-automation'           // Project root
  ];

  for (const artifact of test.expectedArtifacts) {
    let found = false;
    let foundPath = null;

    // Search for artifact in all possible locations
    for (const basePath of artifactSearchPaths) {
      const artifactPath = path.join(basePath, artifact);
      try {
        await fs.access(artifactPath);
        found = true;
        foundPath = artifactPath;
        break;
      } catch {
        // Continue searching
      }
    }

    if (found) {
      validation.criteriaResults.push({
        criterion: `Artifact: ${artifact}`,
        passed: true,
        note: `Found at: ${foundPath}`
      });
    } else {
      validation.passed = false;
      validation.reason = `Missing artifact: ${artifact}`;
      validation.criteriaResults.push({ criterion: `Artifact: ${artifact}`, passed: false });
    }
  }

  // Check success criteria in output (if we have artifact content)
  for (const criterion of test.successCriteria) {
    // For now, mark as pending if we can't verify
    validation.criteriaResults.push({
      criterion,
      passed: 'pending',
      note: 'Manual verification needed'
    });
  }

  return validation;
}

/**
 * Print test summary
 */
function printSummary(results) {
  console.log(chalk.cyan('\n' + '═'.repeat(60)));
  console.log(chalk.cyan.bold('  TEST SUMMARY'));
  console.log(chalk.cyan('═'.repeat(60)));

  console.log(chalk.white(`\n  Total Tests:  ${results.summary.total}`));
  console.log(chalk.green(`  Passed:       ${results.summary.passed}`));
  console.log(chalk.red(`  Failed:       ${results.summary.failed}`));
  console.log(chalk.yellow(`  Skipped:      ${results.summary.skipped}`));

  const passRate = results.summary.total > 0
    ? ((results.summary.passed / results.summary.total) * 100).toFixed(1)
    : 0;

  console.log(chalk.white(`\n  Pass Rate:    ${passRate}%`));

  // Points summary
  let totalPoints = 0;
  let earnedPoints = 0;

  for (const category of ['flowUnderstanding', 'triggerDetection', 'impactAnalysis']) {
    for (const test of results[category]) {
      totalPoints += test.pointValue;
      if (test.validation?.passed) {
        earnedPoints += test.pointValue;
      }
    }
  }

  console.log(chalk.white(`\n  Points:       ${earnedPoints}/${totalPoints}`));
  console.log(chalk.cyan('\n' + '═'.repeat(60) + '\n'));
}

// Run tests
runTests().catch(console.error);

// ============================================================================
// CLI HELP
// ============================================================================

if (process.argv.includes('--help')) {
  console.log(`
ServiceNow Flow Understanding Tests

Usage:
  node servicenow-flow-understanding-tests.js [options]

Options:
  --list              List all available tests
  --dry-run           Show what would run without executing
  --test=ID           Run specific test by ID
  --category=NAME     Run tests in category (flowUnderstanding, triggerDetection, impactAnalysis)
  --help              Show this help

Examples:
  node servicenow-flow-understanding-tests.js --list
  node servicenow-flow-understanding-tests.js --test=FLOW-UNDERSTAND-001
  node servicenow-flow-understanding-tests.js --category=triggerDetection
  node servicenow-flow-understanding-tests.js --dry-run
`);
  process.exit(0);
}
