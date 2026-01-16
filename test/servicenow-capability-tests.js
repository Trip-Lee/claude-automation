#!/usr/bin/env node

/**
 * ServiceNow Capability Tests
 *
 * Purpose: Test the AI's ability to complete ServiceNow development tasks
 * with the current toolset across three difficulty levels.
 *
 * Test Levels:
 * - SIMPLE: Basic ServiceNow development tasks (1-2 files, straightforward logic)
 * - MEDIUM: Moderate complexity tasks (3-5 files, some integration)
 * - COMPLEX: Advanced tasks (multiple components, integrations, security)
 *
 * Each test includes:
 * - Task description (what would be given to the AI)
 * - Expected artifacts (files/components to be created)
 * - Success criteria (how to validate completion)
 * - Estimated time (how long AI should take)
 * - Agent sequence (which agents should handle it)
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

console.log(chalk.cyan.bold('\n🎯 SERVICENOW CAPABILITY TESTS\n'));
console.log(chalk.gray('Testing AI ability to complete ServiceNow development tasks\n'));

// ============================================================================
// TEST DEFINITIONS
// ============================================================================

const SIMPLE_TESTS = [
  {
    id: 'SN-SIMPLE-001',
    name: 'Create Basic Business Rule',
    description: 'Create a business rule on the Incident table that automatically sets Priority to 1 (Critical) when Impact is 1 (High) and Urgency is 1 (High)',
    taskPrompt: `Create a business rule on the Incident [incident] table that:
- Runs BEFORE the record is inserted or updated
- Checks if Impact is 1 (High) AND Urgency is 1 (High)
- If true, automatically sets Priority to 1 (Critical)
- Name it "Auto Set Critical Priority"
- Make it Active and set Order to 100`,
    expectedArtifacts: [
      'business-rules/auto_set_critical_priority.js'
    ],
    successCriteria: [
      'File contains GlideRecord or current object reference',
      'Checks current.impact == 1 and current.urgency == 1',
      'Sets current.priority = 1',
      'Includes proper comments',
      'Has condition to run only on incident table'
    ],
    estimatedTime: '2-3 minutes',
    expectedAgents: ['architect', 'sn-scripting', 'reviewer'],
    complexity: 'SIMPLE',
    pointValue: 10
  },

  {
    id: 'SN-SIMPLE-002',
    name: 'Create Client Script for Form Validation',
    description: 'Create a client script that validates the Short Description field on Incident form',
    taskPrompt: `Create a client script on the Incident form that:
- Runs onSubmit
- Validates that Short Description is not empty
- If empty, shows an error message "Short Description is required"
- Prevents form submission if validation fails
- Name it "Validate Short Description"
- Make it Active and apply to all views`,
    expectedArtifacts: [
      'client-scripts/validate_short_description.js'
    ],
    successCriteria: [
      'Uses onSubmit type',
      'Checks g_form.getValue("short_description")',
      'Shows error with g_form.addErrorMessage()',
      'Returns false to prevent submission',
      'Includes proper comments'
    ],
    estimatedTime: '2-3 minutes',
    expectedAgents: ['architect', 'sn-scripting', 'reviewer'],
    complexity: 'SIMPLE',
    pointValue: 10
  },

  {
    id: 'SN-SIMPLE-003',
    name: 'Create Script Include for Utility Function',
    description: 'Create a reusable Script Include for incident statistics',
    taskPrompt: `Create a Script Include named "IncidentUtils" that:
- Is Server-side only (not client-callable)
- Has a function getOpenIncidentCount(assignedTo) that:
  - Takes a sys_id of a user
  - Returns count of open incidents assigned to that user
  - Open means state < 6
- Include proper JSDoc comments
- Make it Active and Accessible from All application scopes`,
    expectedArtifacts: [
      'script-includes/IncidentUtils.js'
    ],
    successCriteria: [
      'Defines class or function IncidentUtils',
      'Has getOpenIncidentCount method',
      'Uses GlideRecord on incident table',
      'Adds query for assigned_to == sys_id',
      'Adds query for state < 6',
      'Returns count with getRowCount() or similar',
      'Includes JSDoc comments'
    ],
    estimatedTime: '3-4 minutes',
    expectedAgents: ['architect', 'sn-scripting', 'reviewer'],
    complexity: 'SIMPLE',
    pointValue: 15
  }
];

const MEDIUM_TESTS = [
  {
    id: 'SN-MEDIUM-001',
    name: 'Create REST API Endpoint with Error Handling',
    description: 'Create a Scripted REST API for incident management',
    taskPrompt: `Create a Scripted REST API named "Incident Management API" with the following:

Resource Path: /incident
HTTP Method: POST
Purpose: Create new incidents via REST API

Requirements:
- Accept JSON payload with: short_description, description, caller_id, urgency, impact
- Validate all required fields (short_description and caller_id are required)
- Create incident record with provided data
- Return 201 with incident sys_id and number on success
- Return 400 with error message on validation failure
- Return 500 with error message on system failure
- Include proper error handling and logging
- Add API documentation comments

Example request:
{
  "short_description": "Laptop not working",
  "description": "My laptop won't turn on",
  "caller_id": "681ccaf9c0a8016400b98a06818d57c7",
  "urgency": "2",
  "impact": "2"
}

Example response (success):
{
  "success": true,
  "incident": {
    "sys_id": "abc123...",
    "number": "INC0010001"
  }
}`,
    expectedArtifacts: [
      'rest-apis/incident_management_api.js',
      'rest-apis/incident_management_api_POST.js'
    ],
    successCriteria: [
      'Parses JSON request body',
      'Validates required fields',
      'Creates GlideRecord for incident',
      'Sets all provided fields',
      'Inserts record',
      'Returns proper HTTP status codes (201, 400, 500)',
      'Returns JSON response with sys_id and number',
      'Has try-catch error handling',
      'Includes gs.log() for logging',
      'Has JSDoc documentation'
    ],
    estimatedTime: '5-7 minutes',
    expectedAgents: ['architect', 'sn-api', 'sn-security', 'reviewer'],
    complexity: 'MEDIUM',
    pointValue: 25
  },

  {
    id: 'SN-MEDIUM-002',
    name: 'Create Service Portal Widget',
    description: 'Build a Service Portal widget to display user\'s open incidents',
    taskPrompt: `Create a Service Portal widget named "My Open Incidents" with:

Display:
- Shows table of user's open incidents (state < 6)
- Columns: Number, Short Description, Priority, Created Date
- Priority displayed with color coding (1=red, 2=orange, 3=yellow, 4+=green)
- Clicking row navigates to incident detail page
- Shows "No open incidents" message if none found
- Responsive design for mobile

Functionality:
- Server Script: Query incidents for current user
- Client Controller: Handle data display and row clicks
- HTML Template: Bootstrap table with styling
- CSS: Priority colors and responsive styles

Bonus: Add refresh button to reload data`,
    expectedArtifacts: [
      'widgets/my_open_incidents/server_script.js',
      'widgets/my_open_incidents/client_controller.js',
      'widgets/my_open_incidents/template.html',
      'widgets/my_open_incidents/css.css'
    ],
    successCriteria: [
      'Server script queries incident table',
      'Filters by assigned_to = current user',
      'Filters by state < 6',
      'Returns array of incident data',
      'Client controller receives data',
      'HTML displays table with proper columns',
      'Priority has color coding classes',
      'Row click navigation implemented',
      'Shows empty state message',
      'Responsive CSS included',
      'Code is commented'
    ],
    estimatedTime: '8-10 minutes',
    expectedAgents: ['architect', 'sn-ui', 'sn-testing', 'reviewer'],
    complexity: 'MEDIUM',
    pointValue: 30
  },

  {
    id: 'SN-MEDIUM-003',
    name: 'Create Flow with Approval and Notifications',
    description: 'Build a Flow Designer flow for incident escalation',
    taskPrompt: `Create a Flow Designer flow named "Incident Escalation Flow" with:

Trigger:
- Runs when Incident record is updated
- Condition: Priority changes to 1 (Critical)

Flow Steps:
1. Look up incident's Assignment Group manager
2. Create an Approval for the manager
3. Wait for approval decision
4. If Approved:
   - Add work note: "Escalation approved by [manager name]"
   - Send email to assigned user: "Your critical incident has been escalated"
5. If Rejected:
   - Add work note: "Escalation rejected by [manager name]: [rejection reason]"
   - Set Priority back to 2 (High)
   - Send email to assigned user: "Escalation was not approved"
6. Log all actions

Requirements:
- Use proper error handling in flow
- Include descriptive labels for all steps
- Add comments explaining logic
- Use flow variables for reusability
- Test data: Create JSON mock structure`,
    expectedArtifacts: [
      'flows/incident_escalation_flow.json',
      'flows/incident_escalation_flow_documentation.md'
    ],
    successCriteria: [
      'Trigger defined for incident table update',
      'Condition checks priority == 1',
      'Lookup action for assignment group manager',
      'Approval action configured',
      'Branch for approval/rejection',
      'Work note actions in both branches',
      'Email notifications configured',
      'Error handling included',
      'Flow variables defined',
      'Documentation explains flow logic',
      'Test scenario included'
    ],
    estimatedTime: '10-12 minutes',
    expectedAgents: ['architect', 'sn-flows', 'sn-testing', 'reviewer'],
    complexity: 'MEDIUM',
    pointValue: 35
  },

  {
    id: 'SN-MEDIUM-004',
    name: 'Create Import Set with Transform Map',
    description: 'Build data integration for importing users from external system',
    taskPrompt: `Create an Import Set and Transform Map to import users from external CSV:

Import Set Table: u_imported_users
Columns:
- u_first_name (string)
- u_last_name (string)
- u_email (string)
- u_employee_id (string)
- u_department (string)
- u_manager_email (string)

Transform Map: "Import External Users"
Target Table: sys_user
Field Mappings:
- first_name ← u_first_name
- last_name ← u_last_name
- email ← u_email
- employee_number ← u_employee_id
- department ← lookup department by name from u_department
- manager ← lookup manager by email from u_manager_email

Requirements:
- Use coalesce on email (don't create duplicates)
- Skip records with missing email
- Create onBefore script to validate email format
- Create onAfter script to send welcome email to new users
- Add error handling and logging
- Create sample CSV with 3 test records`,
    expectedArtifacts: [
      'import-sets/u_imported_users_table.json',
      'transform-maps/import_external_users.json',
      'transform-maps/import_external_users_onBefore.js',
      'transform-maps/import_external_users_onAfter.js',
      'test-data/sample_users.csv'
    ],
    successCriteria: [
      'Import Set table defined with correct columns',
      'Transform map targets sys_user',
      'Field mappings configured',
      'Coalesce on email field',
      'onBefore script validates email format',
      'onAfter script sends email to new users',
      'Error handling for lookups',
      'Logging statements included',
      'Sample CSV has valid test data',
      'Documentation explains process'
    ],
    estimatedTime: '10-12 minutes',
    expectedAgents: ['architect', 'sn-integration', 'sn-security', 'sn-testing', 'reviewer'],
    complexity: 'MEDIUM',
    pointValue: 35
  }
];

const COMPLEX_TESTS = [
  {
    id: 'SN-COMPLEX-001',
    name: 'Build Complete Incident Management Enhancement',
    description: 'End-to-end enhancement with multiple integrated components',
    taskPrompt: `Build a comprehensive "Smart Incident Assignment" system with:

COMPONENTS:

1. Script Include "SmartAssignmentEngine"
   - analyzeIncident(incidentSysId): Analyzes incident and returns recommended assignee
   - Uses keywords in short_description to match expertise
   - Checks assignee availability (not on PTO, workload < 10 open incidents)
   - Returns assignment recommendation with confidence score

2. Business Rule "Auto Assign Incidents"
   - Runs BEFORE INSERT on Incident
   - If assignment_group is set but assigned_to is empty
   - Calls SmartAssignmentEngine to get recommendation
   - Sets assigned_to if confidence > 0.7
   - Adds work note explaining assignment logic

3. REST API "Assignment Override"
   - POST /api/x_assign/incident/{sys_id}/assign
   - Allows manual assignment override
   - Logs override reason
   - Validates user permissions
   - Returns assignment result

4. Client Script "Assignment Feedback"
   - Runs onLoad for incident form
   - If record was auto-assigned, shows info message
   - Adds "Was this assignment helpful?" feedback buttons
   - Submits feedback via GlideAjax

5. Scheduled Job "Assignment Performance Report"
   - Runs daily at 6 AM
   - Generates report on assignment accuracy
   - Calculates avg resolution time for auto vs manual assignments
   - Emails report to system admins

6. ACLs
   - Only assignment managers can override assignments
   - Only incident coordinators can view assignment analytics
   - Proper read/write/delete controls

7. ATF Tests
   - Test SmartAssignmentEngine with various scenarios
   - Test Business Rule assignment logic
   - Test REST API authentication and authorization
   - Test Client Script feedback submission

REQUIREMENTS:
- Full error handling throughout
- Comprehensive logging
- Security best practices
- Performance optimized (no slow queries)
- Complete documentation
- Test coverage for all components`,
    expectedArtifacts: [
      'script-includes/SmartAssignmentEngine.js',
      'business-rules/auto_assign_incidents.js',
      'rest-apis/assignment_override_api.js',
      'client-scripts/assignment_feedback.js',
      'scheduled-jobs/assignment_performance_report.js',
      'acls/assignment_override_acl.js',
      'acls/assignment_analytics_acl.js',
      'tests/test_smart_assignment_engine.js',
      'tests/test_auto_assign_business_rule.js',
      'tests/test_assignment_override_api.js',
      'docs/SMART_ASSIGNMENT_SYSTEM.md'
    ],
    successCriteria: [
      'SmartAssignmentEngine analyzes incident correctly',
      'Keyword matching logic implemented',
      'Availability checking works',
      'Confidence scoring accurate',
      'Business rule calls engine correctly',
      'Work note logging included',
      'REST API has auth and validation',
      'Client script displays feedback UI',
      'GlideAjax submission works',
      'Scheduled job generates report',
      'Email functionality configured',
      'ACLs properly restrict access',
      'All ATF tests pass',
      'Documentation is comprehensive',
      'Performance is optimized',
      'Security review passed'
    ],
    estimatedTime: '20-30 minutes',
    expectedAgents: [
      'architect',
      'sn-scripting',
      'sn-api',
      'sn-ui',
      'sn-security',
      'sn-performance',
      'sn-testing',
      'documenter',
      'reviewer'
    ],
    complexity: 'COMPLEX',
    pointValue: 100
  },

  {
    id: 'SN-COMPLEX-002',
    name: 'Build Service Portal Application with Backend',
    description: 'Complete portal application with multiple widgets and API integration',
    taskPrompt: `Build a "Team Dashboard" Service Portal application:

PORTAL PAGES:

1. Main Dashboard Page (/)
   - Team metrics widget (incidents, changes, problems)
   - Activity feed widget (recent updates)
   - Quick actions widget (create incident/change)
   - Team calendar widget (upcoming changes)

2. Incident Management Page (/incidents)
   - Incident list widget (filterable, sortable table)
   - Incident detail widget (shows when row clicked)
   - Incident creation widget (form to create new)

3. Analytics Page (/analytics)
   - Charts widget (incidents by priority, category)
   - Trends widget (weekly trends line chart)
   - Team performance widget (SLA compliance)

BACKEND COMPONENTS:

4. REST API "Team Dashboard API"
   - GET /api/x_team/metrics: Returns team metrics
   - GET /api/x_team/incidents: Returns paginated incident list
   - POST /api/x_team/incidents: Creates new incident
   - GET /api/x_team/analytics: Returns analytics data

5. Script Includes
   - TeamDashboardUtils: Utility functions
   - TeamMetricsCalculator: Calculates all metrics
   - AnalyticsEngine: Generates chart data

6. Scheduled Jobs
   - Cache team metrics (runs every 15 minutes)
   - Generate daily analytics snapshots

FEATURES:
- Real-time updates using notifications
- Responsive design (mobile, tablet, desktop)
- Dark/light theme toggle
- Export to PDF/Excel functionality
- User preferences persistence
- Accessibility compliant (WCAG 2.1)

REQUIREMENTS:
- Angular best practices for widgets
- Efficient API design (pagination, caching)
- Security (role-based access)
- Performance optimized (< 2s page load)
- Full test coverage
- Comprehensive documentation`,
    expectedArtifacts: [
      'portal-pages/team_dashboard.json',
      'portal-pages/incident_management.json',
      'portal-pages/analytics.json',
      'widgets/team_metrics/server_script.js',
      'widgets/team_metrics/client_controller.js',
      'widgets/team_metrics/template.html',
      'widgets/team_metrics/css.css',
      'widgets/activity_feed/server_script.js',
      'widgets/activity_feed/client_controller.js',
      'widgets/activity_feed/template.html',
      'widgets/incident_list/server_script.js',
      'widgets/incident_list/client_controller.js',
      'widgets/incident_list/template.html',
      'widgets/charts/server_script.js',
      'widgets/charts/client_controller.js',
      'widgets/charts/template.html',
      'rest-apis/team_dashboard_api.js',
      'script-includes/TeamDashboardUtils.js',
      'script-includes/TeamMetricsCalculator.js',
      'script-includes/AnalyticsEngine.js',
      'scheduled-jobs/cache_team_metrics.js',
      'scheduled-jobs/generate_analytics_snapshots.js',
      'tests/test_team_dashboard_api.js',
      'tests/test_widgets.js',
      'docs/TEAM_DASHBOARD_USER_GUIDE.md',
      'docs/TEAM_DASHBOARD_TECHNICAL_GUIDE.md'
    ],
    successCriteria: [
      'All portal pages created and linked',
      'All widgets functional',
      'Responsive design works on all devices',
      'API endpoints return correct data',
      'Pagination implemented',
      'Filtering and sorting work',
      'Charts display correctly',
      'Real-time updates working',
      'Theme toggle functional',
      'Export features work',
      'Security roles enforced',
      'Performance meets targets',
      'All tests pass',
      'Documentation complete',
      'Accessibility compliance validated'
    ],
    estimatedTime: '30-40 minutes',
    expectedAgents: [
      'architect',
      'sn-ui',
      'sn-api',
      'sn-scripting',
      'sn-integration',
      'sn-security',
      'sn-performance',
      'sn-testing',
      'documenter',
      'reviewer'
    ],
    complexity: 'COMPLEX',
    pointValue: 120
  },

  {
    id: 'SN-COMPLEX-003',
    name: 'Build Integration Hub Spoke with External API',
    description: 'Complete IntegrationHub spoke for third-party service',
    taskPrompt: `Build IntegrationHub Spoke "Slack Integration" v1.0:

SPOKE COMPONENTS:

1. Connection & Credential Alias
   - Connection: Slack API (OAuth 2.0)
   - Credential: Slack Bot Token
   - Base URL: https://slack.com/api

2. Flow Actions (8 total):

   a. "Send Channel Message"
      - Inputs: channel_id, message, thread_ts (optional)
      - Calls: chat.postMessage API
      - Outputs: message_ts, success, error

   b. "Create Channel"
      - Inputs: channel_name, is_private
      - Calls: conversations.create API
      - Outputs: channel_id, success, error

   c. "Invite User to Channel"
      - Inputs: channel_id, user_email
      - Lookups: user_id from email
      - Calls: conversations.invite API
      - Outputs: success, error

   d. "Upload File"
      - Inputs: channel_id, file_attachment, title, comment
      - Calls: files.upload API
      - Outputs: file_id, success, error

   e. "Get Channel History"
      - Inputs: channel_id, limit (default 100)
      - Calls: conversations.history API
      - Outputs: messages array, success, error

   f. "Update Message"
      - Inputs: channel_id, message_ts, new_text
      - Calls: chat.update API
      - Outputs: success, error

   g. "Create User Group"
      - Inputs: group_name, user_emails array
      - Creates group and adds users
      - Outputs: group_id, success, error

   h. "Search Messages"
      - Inputs: query, sort_by, limit
      - Calls: search.messages API
      - Outputs: results array, success, error

3. Subflows (3 total):

   a. "Notify Incident Assignment"
      - Inputs: incident_sys_id
      - Looks up incident details
      - Finds user's Slack channel
      - Sends formatted message with incident link
      - Creates thread for updates

   b. "Sync Slack User to ServiceNow"
      - Inputs: slack_user_id
      - Gets user details from Slack
      - Finds/creates ServiceNow user
      - Maps fields (name, email, title)
      - Returns sys_user sys_id

   c. "Create War Room"
      - Inputs: incident_number, participants array
      - Creates private Slack channel
      - Invites all participants
      - Posts incident summary
      - Pins important messages

4. Error Handling
   - Retry logic for rate limits (429)
   - Exponential backoff
   - Detailed error logging
   - User-friendly error messages

5. Integration Tests
   - Test all 8 flow actions
   - Test authentication
   - Test error scenarios
   - Test rate limiting
   - Mock Slack API responses

6. Documentation
   - Setup guide (Slack app creation)
   - Configuration guide (OAuth, scopes)
   - Flow action reference
   - Subflow usage examples
   - Troubleshooting guide

REQUIREMENTS:
- Follow IntegrationHub best practices
- Secure credential handling
- Comprehensive error handling
- Performance optimized
- Full test coverage
- Professional documentation`,
    expectedArtifacts: [
      'spoke/slack_integration/connection.json',
      'spoke/slack_integration/credential_alias.json',
      'spoke/slack_integration/actions/send_channel_message.json',
      'spoke/slack_integration/actions/create_channel.json',
      'spoke/slack_integration/actions/invite_user.json',
      'spoke/slack_integration/actions/upload_file.json',
      'spoke/slack_integration/actions/get_channel_history.json',
      'spoke/slack_integration/actions/update_message.json',
      'spoke/slack_integration/actions/create_user_group.json',
      'spoke/slack_integration/actions/search_messages.json',
      'spoke/slack_integration/subflows/notify_incident_assignment.json',
      'spoke/slack_integration/subflows/sync_slack_user.json',
      'spoke/slack_integration/subflows/create_war_room.json',
      'spoke/slack_integration/scripts/slack_api_client.js',
      'spoke/slack_integration/scripts/slack_utils.js',
      'spoke/slack_integration/tests/test_actions.js',
      'spoke/slack_integration/tests/test_subflows.js',
      'spoke/slack_integration/tests/mock_responses.json',
      'spoke/slack_integration/docs/SETUP_GUIDE.md',
      'spoke/slack_integration/docs/CONFIGURATION_GUIDE.md',
      'spoke/slack_integration/docs/API_REFERENCE.md',
      'spoke/slack_integration/docs/TROUBLESHOOTING.md'
    ],
    successCriteria: [
      'Connection configured with OAuth 2.0',
      'All 8 flow actions implemented',
      'All actions call correct Slack API endpoints',
      'Input/output variables properly defined',
      'All 3 subflows functional',
      'Error handling comprehensive',
      'Retry logic with exponential backoff',
      'Rate limiting handled',
      'All tests pass',
      'Mock responses realistic',
      'Documentation professional and complete',
      'Setup guide has step-by-step instructions',
      'API reference documents all actions',
      'Troubleshooting covers common issues',
      'Code follows ServiceNow conventions'
    ],
    estimatedTime: '35-45 minutes',
    expectedAgents: [
      'architect',
      'sn-flows',
      'sn-integration',
      'sn-api',
      'sn-scripting',
      'sn-security',
      'sn-testing',
      'documenter',
      'reviewer'
    ],
    complexity: 'COMPLEX',
    pointValue: 150
  }
];

// ============================================================================
// TEST EXECUTION FRAMEWORK
// ============================================================================

class ServiceNowTestRunner {
  constructor() {
    this.results = {
      simple: { passed: 0, failed: 0, total: 0, points: 0 },
      medium: { passed: 0, failed: 0, total: 0, points: 0 },
      complex: { passed: 0, failed: 0, total: 0, points: 0 }
    };
    this.startTime = Date.now();
  }

  async runTest(test, automated = false) {
    console.log(chalk.cyan('\n' + '═'.repeat(70)));
    console.log(chalk.cyan(`TEST: ${test.id} - ${test.name}`));
    console.log(chalk.cyan('═'.repeat(70)));
    console.log(chalk.gray(`Complexity: ${test.complexity}`));
    console.log(chalk.gray(`Point Value: ${test.pointValue}`));
    console.log(chalk.gray(`Estimated Time: ${test.estimatedTime}`));
    console.log(chalk.gray(`Expected Agents: ${test.expectedAgents.join(' → ')}`));

    console.log(chalk.yellow('\n📋 Task Prompt:'));
    console.log(chalk.white(test.taskPrompt));

    console.log(chalk.yellow('\n📦 Expected Artifacts:'));
    test.expectedArtifacts.forEach(artifact => {
      console.log(chalk.white(`  • ${artifact}`));
    });

    console.log(chalk.yellow('\n✅ Success Criteria:'));
    test.successCriteria.forEach(criteria => {
      console.log(chalk.white(`  • ${criteria}`));
    });

    if (!automated) {
      console.log(chalk.cyan('\n' + '─'.repeat(70)));
      console.log(chalk.yellow('⚠️  Manual Test - Run with: dev-tools task sn-tools "' + test.taskPrompt.split('\n')[0] + '"'));
      console.log(chalk.gray('Then validate artifacts and success criteria manually.'));
      return { status: 'manual', test };
    }

    // Automated test execution (future implementation)
    console.log(chalk.cyan('\n' + '─'.repeat(70)));
    console.log(chalk.yellow('🤖 Automated execution not yet implemented'));
    return { status: 'pending', test };
  }

  async runTestSuite(tests, automated = false) {
    console.log(chalk.cyan.bold(`\n${'='.repeat(70)}`));
    console.log(chalk.cyan.bold(`${tests[0].complexity} TESTS (${tests.length} total)`));
    console.log(chalk.cyan.bold('='.repeat(70)));

    for (const test of tests) {
      await this.runTest(test, automated);
    }
  }

  printSummary() {
    console.log(chalk.cyan('\n\n' + '═'.repeat(70)));
    console.log(chalk.cyan.bold('SERVICENOW CAPABILITY TEST SUMMARY'));
    console.log(chalk.cyan('═'.repeat(70)));

    const totalSimple = SIMPLE_TESTS.length;
    const totalMedium = MEDIUM_TESTS.length;
    const totalComplex = COMPLEX_TESTS.length;
    const totalTests = totalSimple + totalMedium + totalComplex;

    const maxPointsSimple = SIMPLE_TESTS.reduce((sum, t) => sum + t.pointValue, 0);
    const maxPointsMedium = MEDIUM_TESTS.reduce((sum, t) => sum + t.pointValue, 0);
    const maxPointsComplex = COMPLEX_TESTS.reduce((sum, t) => sum + t.pointValue, 0);
    const maxPoints = maxPointsSimple + maxPointsMedium + maxPointsComplex;

    console.log(chalk.white('\nTest Breakdown:'));
    console.log(chalk.white(`  SIMPLE:  ${totalSimple} tests (${maxPointsSimple} points max)`));
    console.log(chalk.white(`  MEDIUM:  ${totalMedium} tests (${maxPointsMedium} points max)`));
    console.log(chalk.white(`  COMPLEX: ${totalComplex} tests (${maxPointsComplex} points max)`));
    console.log(chalk.white(`  TOTAL:   ${totalTests} tests (${maxPoints} points max)`));

    console.log(chalk.white('\nScoring:'));
    console.log(chalk.white(`  ${maxPointsSimple} points = Basic ServiceNow competency`));
    console.log(chalk.white(`  ${maxPointsSimple + maxPointsMedium} points = Intermediate ServiceNow developer`));
    console.log(chalk.white(`  ${maxPoints} points = Advanced ServiceNow expert`));

    console.log(chalk.cyan('\n' + '─'.repeat(70)));
    console.log(chalk.yellow('\n💡 Usage Instructions:'));
    console.log(chalk.white('  1. Run individual tests manually with dev-tools'));
    console.log(chalk.white('  2. Validate artifacts are created'));
    console.log(chalk.white('  3. Check success criteria'));
    console.log(chalk.white('  4. Record pass/fail and time taken'));
    console.log(chalk.white('  5. Calculate total score\n'));
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const runner = new ServiceNowTestRunner();

  // Check if automated flag is passed
  const automated = process.argv.includes('--automated');

  if (automated) {
    console.log(chalk.yellow('⚠️  Automated execution not yet implemented'));
    console.log(chalk.gray('Tests will be displayed for manual execution\n'));
  }

  // Run test suites
  await runner.runTestSuite(SIMPLE_TESTS, false);
  await runner.runTestSuite(MEDIUM_TESTS, false);
  await runner.runTestSuite(COMPLEX_TESTS, false);

  // Print summary
  runner.printSummary();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red('\n💥 Error running tests:'));
    console.error(chalk.red(error.message));
    console.error(chalk.gray(error.stack));
    process.exit(1);
  });
}

export { SIMPLE_TESTS, MEDIUM_TESTS, COMPLEX_TESTS, ServiceNowTestRunner };
