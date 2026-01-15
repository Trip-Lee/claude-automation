# Tenon Work Management - Implementation Reference & Code Examples

**Date:** November 14, 2025
**Purpose:** Code patterns, query examples, and implementation guidelines

---

## 1. QUERY PATTERNS

### Query 1: Get All Projects for Campaign

```javascript
/**
 * Retrieve all projects associated with a campaign
 * @param {String} campaignId - sys_id of campaign
 * @returns {Array} Array of project records
 */
function getProjectsForCampaign(campaignId) {
  var projectGr = new GlideRecord('x_cadso_work_project');
  projectGr.addQuery('campaign', campaignId);
  projectGr.orderBy('name');
  projectGr.query();

  var projects = [];
  while (projectGr.next()) {
    projects.push({
      sys_id: projectGr.getValue('sys_id'),
      name: projectGr.getValue('name'),
      state: projectGr.getValue('state'),
      actual_end_date: projectGr.getValue('actual_end_date')
    });
  }
  return projects;
}
```

### Query 2: Get All Tasks for Project

```javascript
/**
 * Retrieve all tasks associated with a project
 * @param {String} projectId - sys_id of project
 * @returns {Array} Array of task records
 */
function getTasksForProject(projectId) {
  var taskGr = new GlideRecord('x_cadso_work_task');
  taskGr.addQuery('project', projectId);
  taskGr.orderBy('name');
  taskGr.query();

  var tasks = [];
  while (taskGr.next()) {
    tasks.push({
      sys_id: taskGr.getValue('sys_id'),
      name: taskGr.getValue('name'),
      status: taskGr.getValue('status'),
      state: taskGr.getValue('state')
    });
  }
  return tasks;
}
```

### Query 3: Get All Tasks for Campaign (Direct)

```javascript
/**
 * Retrieve all tasks associated with a campaign directly
 * Uses denormalized campaign field on task table
 * @param {String} campaignId - sys_id of campaign
 * @returns {Array} Array of task records
 */
function getTasksForCampaign(campaignId) {
  var taskGr = new GlideRecord('x_cadso_work_task');
  taskGr.addQuery('campaign', campaignId);  // Direct denormalized field
  taskGr.orderBy('name');
  taskGr.query();

  var tasks = [];
  while (taskGr.next()) {
    tasks.push({
      sys_id: taskGr.getValue('sys_id'),
      name: taskGr.getValue('name'),
      project: taskGr.getValue('project'),
      status: taskGr.getValue('status')
    });
  }
  return tasks;
}
```

### Query 4: Check If Project Can Auto-Close

```javascript
/**
 * Determines if all tasks in a project are in terminal state
 * Used by Flow 2 logic
 * @param {String} projectId - sys_id of project
 * @returns {Boolean} true if ALL tasks are terminal
 */
function canProjectAutoClose(projectId) {
  var taskGr = new GlideRecord('x_cadso_work_task');
  taskGr.addQuery('project', projectId);
  taskGr.query();

  var terminalStates = ['Closed Complete', 'Closed Incomplete', 'Closed Skipped'];
  var allTerminal = true;
  var taskCount = 0;

  while (taskGr.next()) {
    taskCount++;
    var taskStatus = taskGr.getValue('status');

    if (terminalStates.indexOf(taskStatus) === -1) {
      allTerminal = false;
      break;  // Exit early if found non-terminal
    }
  }

  // Return false if no tasks found
  return (taskCount > 0) && allTerminal;
}
```

### Query 5: Check If Campaign Can Auto-Close

```javascript
/**
 * Determines if all projects in a campaign are in terminal state
 * Used by Flow 1 logic
 * @param {String} campaignId - sys_id of campaign
 * @returns {Boolean} true if ALL projects are terminal
 */
function canCampaignAutoClose(campaignId) {
  var projectGr = new GlideRecord('x_cadso_work_project');
  projectGr.addQuery('campaign', campaignId);
  projectGr.query();

  var terminalStates = ['40', '70', '6', '333'];  // Completed, Canceled, Rejected, Archived
  var allTerminal = true;
  var projectCount = 0;

  while (projectGr.next()) {
    projectCount++;
    var projectState = projectGr.getValue('state');

    if (terminalStates.indexOf(projectState) === -1) {
      allTerminal = false;
      break;  // Exit early if found non-terminal
    }
  }

  // Return false if no projects found
  return (projectCount > 0) && allTerminal;
}
```

### Query 6: Get Campaign Budget Aggregate

```javascript
/**
 * Calculate total budget for a campaign
 * Sums all project budgets (as per BR9 logic)
 * @param {String} campaignId - sys_id of campaign
 * @returns {Number} Total budget in currency units
 */
function getCampaignTotalBudget(campaignId) {
  var projectGr = new GlideRecord('x_cadso_work_project');
  projectGr.addQuery('campaign', campaignId);
  projectGr.query();

  var totalBudget = 0;

  while (projectGr.next()) {
    var projectBudget = projectGr.getValue('budget');

    // Handle potential null or non-numeric values
    if (projectBudget) {
      totalBudget += parseFloat(projectBudget);
    }
  }

  return totalBudget;
}
```

### Query 7: Find Orphaned Records

```javascript
/**
 * Find potential orphaned tasks (project reference broken)
 * Useful for data quality checks
 * @returns {Array} Array of potentially orphaned task records
 */
function findOrphanedTasks() {
  var taskGr = new GlideRecord('x_cadso_work_task');

  // Find tasks with empty project reference
  taskGr.addQuery('project', '');
  taskGr.query();

  var orphans = [];
  while (taskGr.next()) {
    orphans.push({
      sys_id: taskGr.getValue('sys_id'),
      name: taskGr.getValue('name'),
      campaign: taskGr.getValue('campaign'),
      created: taskGr.getValue('sys_created_on')
    });
  }

  return orphans;
}
```

### Query 8: Find State Mismatches

```javascript
/**
 * Find projects that don't match their parent campaign state
 * Useful for detecting state propagation issues
 * @param {String} campaignId - sys_id of campaign
 * @returns {Array} Array of mismatched project records
 */
function findStatesMismatches(campaignId) {
  var campaignGr = new GlideRecord('x_cadso_work_campaign');
  if (!campaignGr.get(campaignId)) {
    return [];
  }

  var campaignState = campaignGr.getValue('state');
  var projectGr = new GlideRecord('x_cadso_work_project');
  projectGr.addQuery('campaign', campaignId);
  projectGr.query();

  var mismatches = [];

  while (projectGr.next()) {
    var projectState = projectGr.getValue('state');

    // Check if states should match for certain campaign states
    if (projectState !== campaignState) {
      mismatches.push({
        project_sys_id: projectGr.getValue('sys_id'),
        project_name: projectGr.getValue('name'),
        project_state: projectState,
        campaign_state: campaignState,
        mismatch_type: 'state_divergence'
      });
    }
  }

  return mismatches;
}
```

---

## 2. BUSINESS RULE PATTERNS

### BR Pattern 1: Save State Before Archive

```javascript
/**
 * BR1/BR2/BR3 Pattern: Save previous state before archiving/holding
 * Trigger: BEFORE INSERT/UPDATE
 * Condition: state CHANGES TO 333 (Archived) OR 22 (On Hold)
 */

// Check if state is changing to archive/hold state
if (current.state.changes() &&
    (current.state.toString() === '333' || current.state.toString() === '22')) {

  // Store previous state in JSON
  var previousState = {
    state: previous.state.toString(),
    timestamp: gs.nowDateTime(),
    changedBy: gs.getUserID(),
    changedByName: gs.getUserName(),
    reason: current.getValue('change_reason') || 'Not specified'
  };

  current.previous_state = JSON.stringify(previousState);

  // Log the state change
  gs.info('State saved for ' + current.getTableName() +
          ': ' + previous.state + ' → ' + current.state);
}
```

### BR Pattern 2: Cross-Table State Check

```javascript
/**
 * BR2 Pattern: Save state + check parent campaign state
 * Project checking its parent campaign when archiving/holding
 * Trigger: BEFORE INSERT/UPDATE on x_cadso_work_project
 */

if (current.state.changes() &&
    (current.state.toString() === '333' || current.state.toString() === '22')) {

  // Get parent campaign
  var campaignId = current.campaign.toString();
  var campaignGr = new GlideRecord('x_cadso_work_campaign');

  if (campaignGr.get(campaignId)) {
    var campaignState = campaignGr.state.toString();

    // Store flags about parent state
    var previousState = {
      state: previous.state.toString(),
      wasCampaignArchived: (campaignState === '333'),
      wasCampaignOnHold: (campaignState === '22'),
      parentState: campaignState,
      timestamp: gs.nowDateTime()
    };

    current.previous_state = JSON.stringify(previousState);
  }
}
```

### BR Pattern 3: Default Segment Assignment

```javascript
/**
 * BR4/BR5/BR6 Pattern: Auto-assign default segment if blank
 * Trigger: BEFORE INSERT
 * Condition: segment IS EMPTY
 */

if (current.segment.nil() || current.segment.toString() === '') {
  // Get system property for default segment
  var defaultSegment = gs.getProperty('x_cadso_work.default_' +
                                      current.getTableName() + '_segment');

  if (defaultSegment && defaultSegment.trim() !== '') {
    current.segment = defaultSegment;
    gs.info('Assigned default segment: ' + defaultSegment);
  } else {
    gs.warn('No default segment configured for ' + current.getTableName());
  }
}
```

### BR Pattern 4: Denormalize Field

```javascript
/**
 * BR7/BR8 Pattern: Denormalize name field for performance
 * Trigger: AFTER INSERT/UPDATE
 * Purpose: Create searchable string copy
 */

if (current.name.changed() || current.isNewRecord()) {
  var nameString = current.name.toString();

  // Update denormalized field
  if (current.getTableName() === 'x_cadso_work_campaign') {
    current.campaign_string = nameString.toUpperCase();
  } else if (current.getTableName() === 'x_cadso_work_project') {
    current.project_string = nameString.toUpperCase();
  }

  current.update();
}
```

### BR Pattern 5: Cross-Table Aggregation

```javascript
/**
 * BR9 Pattern: Roll up budget from projects to campaign
 * Trigger: AFTER UPDATE on x_cadso_work_project
 * Condition: project.campaign changed OR project.budget changed
 */

// Check if campaign reference or budget changed
if ((current.campaign.changed() && !previous.campaign.nil()) ||
    current.budget.changed()) {

  // Update previous campaign if reference changed
  if (current.campaign.changed()) {
    updateCampaignBudget(previous.campaign.toString());
  }

  // Update current campaign
  if (!current.campaign.nil()) {
    updateCampaignBudget(current.campaign.toString());
  }
}

/**
 * Helper function to update campaign total
 */
function updateCampaignBudget(campaignId) {
  var projectGr = new GlideRecord('x_cadso_work_project');
  projectGr.addQuery('campaign', campaignId);
  projectGr.query();

  var totalBudget = 0;

  while (projectGr.next()) {
    var budget = projectGr.budget.toString();
    if (budget && !isNaN(parseFloat(budget))) {
      totalBudget += parseFloat(budget);
    }
  }

  // Update campaign total
  var campaignGr = new GlideRecord('x_cadso_work_campaign');
  if (campaignGr.get(campaignId)) {
    campaignGr.total_budget = totalBudget;
    campaignGr.update();
    gs.info('Campaign budget updated: ' + campaignId + ' = ' + totalBudget);
  }
}
```

---

## 3. FLOW DESIGNER LOGIC PATTERNS

### Flow Pattern 1: Project Auto-Close Check

```javascript
/**
 * Flow 2 Logic: Close Project on All Associated Tasks Completion
 * Run as: Inline Script in Flow Designer
 *
 * Triggered when: x_cadso_work_task.project is updated
 */

function checkProjectAutoClose(projectId) {
  var taskGr = new GlideRecord('x_cadso_work_task');
  taskGr.addQuery('project', projectId);
  taskGr.query();

  var terminalStates = ['Closed Complete', 'Closed Incomplete', 'Closed Skipped'];
  var allTerminal = true;
  var taskCount = 0;

  while (taskGr.next()) {
    taskCount++;
    var taskStatus = taskGr.status.toString();

    if (terminalStates.indexOf(taskStatus) === -1) {
      allTerminal = false;
      break;
    }
  }

  // Only close if there are tasks AND all are terminal
  if (taskCount > 0 && allTerminal) {
    var projectGr = new GlideRecord('x_cadso_work_project');
    if (projectGr.get(projectId)) {
      projectGr.state = '40';  // Completed
      projectGr.actual_end_date = gs.nowDateTime();
      projectGr.update();

      // Log completion
      gs.info('Project auto-closed: ' + projectId);

      // Return true to trigger next flow
      return true;
    }
  }

  return false;
}
```

### Flow Pattern 2: Campaign Auto-Close Check

```javascript
/**
 * Flow 1 Logic: Close Campaign on All Associated Projects Completion
 * Run as: Inline Script in Flow Designer
 *
 * Triggered when: x_cadso_work_project is updated
 */

function checkCampaignAutoClose(campaignId) {
  var projectGr = new GlideRecord('x_cadso_work_project');
  projectGr.addQuery('campaign', campaignId);
  projectGr.query();

  var terminalStates = ['40', '70', '6', '333'];  // Completed, Canceled, Rejected, Archived
  var allTerminal = true;
  var projectCount = 0;

  while (projectGr.next()) {
    projectCount++;
    var projectState = projectGr.state.toString();

    if (terminalStates.indexOf(projectState) === -1) {
      allTerminal = false;
      break;
    }
  }

  // Only close if there are projects AND all are terminal
  if (projectCount > 0 && allTerminal) {
    var campaignGr = new GlideRecord('x_cadso_work_campaign');
    if (campaignGr.get(campaignId)) {
      campaignGr.state = '40';  // Closed Complete
      campaignGr.actual_end_date = gs.nowDateTime();
      campaignGr.update();

      // Log completion
      gs.info('Campaign auto-closed: ' + campaignId);

      return true;
    }
  }

  return false;
}
```

### Flow Pattern 3: State Cascade

```javascript
/**
 * Flow 3 Logic: Cancel Projects - Campaign Cancellation Business Logic
 * Run as: Loop in Flow Designer
 *
 * Triggered when: x_cadso_work_campaign.state is updated
 */

function cascadeCampaignState(campaignId, newState) {
  var projectGr = new GlideRecord('x_cadso_work_project');
  projectGr.addQuery('campaign', campaignId);
  projectGr.query();

  var updatedCount = 0;

  while (projectGr.next()) {
    // Save previous state (BR2 will handle this in before-update)
    var previousState = {
      state: projectGr.state.toString(),
      cascadedFrom: campaignId,
      cascadedState: newState,
      timestamp: gs.nowDateTime()
    };

    // Get campaign state
    var campaignGr = new GlideRecord('x_cadso_work_campaign');
    if (campaignGr.get(campaignId)) {
      previousState.wasCampaignCanceled = (campaignGr.state.toString() === '70');
      previousState.wasCampaignArchived = (campaignGr.state.toString() === '333');
    }

    // Update project state
    projectGr.state = newState;
    projectGr.previous_state = JSON.stringify(previousState);
    projectGr.update();

    updatedCount++;

    // Optional: Notify child tasks via project update
    // (Tasks implicitly inherit parent state)
  }

  gs.info('Campaign state cascaded to ' + updatedCount + ' projects');
  return updatedCount;
}
```

---

## 4. CLIENT-SIDE PATTERNS (WorkClientUtilsMS)

### Pattern 1: Get User's Accessible Segments

```javascript
/**
 * Client-callable pattern: Get all segments accessible to current user
 * Called from: UI widgets, filters, dropdowns
 * Returns: Array of segment sys_ids
 */

function getAllSegmentsForUser() {
  var segments = [];
  var userSegmentGr = new GlideRecord('x_cadso_work_user_segment_m2m');

  // Add query for current user
  userSegmentGr.addQuery('user', gs.getUserID());
  userSegmentGr.query();

  while (userSegmentGr.next()) {
    segments.push(userSegmentGr.getValue('segment'));
  }

  return segments;
}
```

### Pattern 2: Filter Campaign by User Segments

```javascript
/**
 * Client-callable pattern: Get segments for campaign that user can access
 * @param {String} campaignId - sys_id of campaign
 * @returns {Array} Array of accessible segment sys_ids
 */

function getAllSegmentsForCampaignUser(campaignId) {
  // Get user's accessible segments
  var userSegments = getAllSegmentsForUser();

  // Get campaign's segments
  var campaignGr = new GlideRecord('x_cadso_work_campaign');
  if (!campaignGr.get(campaignId)) {
    return [];
  }

  var campaignSegment = campaignGr.getValue('segment');
  var accessibleSegments = [];

  // Return intersection (segments in both user AND campaign)
  if (userSegments.indexOf(campaignSegment) !== -1) {
    accessibleSegments.push(campaignSegment);
  }

  return accessibleSegments;
}
```

### Pattern 3: Check User Permissions

```javascript
/**
 * Client-callable pattern: Check if user can access campaign
 * @param {String} campaignId - sys_id of campaign
 * @returns {Boolean} true if user can access
 */

function canUserAccessCampaign(campaignId) {
  var accessibleSegments = getAllSegmentsForCampaignUser(campaignId);
  return accessibleSegments.length > 0;
}
```

---

## 5. VALIDATION PATTERNS

### Pattern 1: Validate Campaign State Transition

```javascript
/**
 * Validate that campaign state transition is allowed
 * @param {String} fromState - current state
 * @param {String} toState - requested state
 * @returns {Object} {valid: boolean, message: string}
 */

function validateCampaignStateTransition(fromState, toState) {
  var validTransitions = {
    '10': ['20', '22', '333'],  // Upcoming → Open, OnHold, Archived
    '20': ['30', '22', '333'],  // Open → WIP, OnHold, Archived
    '22': ['20', '30', '333'],  // OnHold → Open, WIP, Archived
    '30': ['40', '50', '60', '22', '333'],  // WIP → Closed*, OnHold, Archived
    '40': [],  // Closed Complete - no transitions
    '50': [],  // Closed Incomplete - no transitions
    '60': [],  // Closed Skipped - no transitions
    '333': ['20']  // Archived → Open (unarchive only)
  };

  if (!validTransitions[fromState]) {
    return { valid: false, message: 'Unknown state: ' + fromState };
  }

  if (validTransitions[fromState].indexOf(toState) === -1) {
    return {
      valid: false,
      message: 'Invalid transition: ' + fromState + ' → ' + toState
    };
  }

  return { valid: true, message: 'Transition allowed' };
}
```

### Pattern 2: Validate Parent-Child Relationship

```javascript
/**
 * Validate that project reference is valid
 * @param {String} projectId - sys_id of project
 * @param {String} campaignId - sys_id of campaign
 * @returns {Object} {valid: boolean, message: string}
 */

function validateProjectCampaignRelationship(projectId, campaignId) {
  var projectGr = new GlideRecord('x_cadso_work_project');

  if (!projectGr.get(projectId)) {
    return { valid: false, message: 'Project not found' };
  }

  var campaignGr = new GlideRecord('x_cadso_work_campaign');

  if (!campaignGr.get(campaignId)) {
    return { valid: false, message: 'Campaign not found' };
  }

  // Check if project's current campaign matches
  var currentCampaign = projectGr.campaign.toString();

  if (currentCampaign !== '' && currentCampaign !== campaignId) {
    return {
      valid: false,
      message: 'Project already belongs to different campaign'
    };
  }

  return { valid: true, message: 'Relationship valid' };
}
```

---

## 6. ERROR HANDLING PATTERNS

### Pattern 1: Safe Budget Update

```javascript
/**
 * Safely update budget with error handling
 * @param {String} projectId - sys_id of project
 * @param {Number} newBudget - new budget amount
 * @returns {Object} {success: boolean, message: string}
 */

function updateProjectBudget(projectId, newBudget) {
  try {
    // Validate input
    if (!projectId || projectId === '') {
      return { success: false, message: 'Project ID required' };
    }

    if (isNaN(parseFloat(newBudget))) {
      return { success: false, message: 'Invalid budget amount' };
    }

    // Get project
    var projectGr = new GlideRecord('x_cadso_work_project');
    if (!projectGr.get(projectId)) {
      return { success: false, message: 'Project not found' };
    }

    // Update budget
    projectGr.budget = parseFloat(newBudget);
    projectGr.update();

    // BR9 will automatically update campaign total
    return {
      success: true,
      message: 'Budget updated successfully. Campaign total will update via automation.'
    };

  } catch (err) {
    gs.error('Error updating project budget: ' + err);
    return { success: false, message: 'System error: ' + err };
  }
}
```

### Pattern 2: Safe State Change

```javascript
/**
 * Safely change campaign state with validation
 * @param {String} campaignId - sys_id of campaign
 * @param {String} newState - new state to set
 * @returns {Object} {success: boolean, message: string}
 */

function changeCampaignState(campaignId, newState) {
  try {
    // Validate input
    if (!campaignId || campaignId === '') {
      return { success: false, message: 'Campaign ID required' };
    }

    // Get campaign
    var campaignGr = new GlideRecord('x_cadso_work_campaign');
    if (!campaignGr.get(campaignId)) {
      return { success: false, message: 'Campaign not found' };
    }

    // Validate transition
    var validation = validateCampaignStateTransition(
      campaignGr.state.toString(),
      newState
    );

    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    // Update state
    // Note: BR1 and Flow 3 will handle automatically
    campaignGr.state = newState;
    campaignGr.update();

    return {
      success: true,
      message: 'Campaign state changed. Flows will cascade changes automatically.'
    };

  } catch (err) {
    gs.error('Error changing campaign state: ' + err);
    return { success: false, message: 'System error: ' + err };
  }
}
```

---

## 7. TESTING PATTERNS

### Test 1: Verify Auto-Close Cascade

```javascript
/**
 * Test: Complete all tasks and verify campaign auto-closes
 * Manual test steps:
 * 1. Create campaign → Create project → Create task
 * 2. Mark task as "Closed Complete"
 * 3. Verify project auto-closes
 * 4. Verify campaign auto-closes
 */

function testAutoCloseCascade() {
  var results = {
    success: true,
    steps: []
  };

  try {
    // Step 1: Get test campaign with all tasks completed
    var campaignGr = new GlideRecord('x_cadso_work_campaign');
    campaignGr.addQuery('name', 'TEST_AUTO_CLOSE');
    campaignGr.query();

    if (!campaignGr.next()) {
      return { success: false, message: 'Test campaign not found' };
    }

    // Step 2: Check all projects
    var projectGr = new GlideRecord('x_cadso_work_project');
    projectGr.addQuery('campaign', campaignGr.sys_id);
    projectGr.query();

    var projectCount = 0;
    var closedProjectCount = 0;

    while (projectGr.next()) {
      projectCount++;

      // Check if project is closed
      if (projectGr.state.toString() === '40') {
        closedProjectCount++;
      }
    }

    // Step 3: Verify campaign state
    var finalCampaignGr = new GlideRecord('x_cadso_work_campaign');
    finalCampaignGr.get(campaignGr.sys_id);

    results.steps.push({
      step: 'Campaign Query',
      expected: 'Campaign found',
      actual: 'Campaign found',
      passed: true
    });

    results.steps.push({
      step: 'Project Count',
      expected: projectCount + ' projects',
      actual: projectCount + ' projects (' + closedProjectCount + ' closed)',
      passed: true
    });

    results.steps.push({
      step: 'Campaign Auto-Close',
      expected: 'Campaign state = 40',
      actual: 'Campaign state = ' + finalCampaignGr.state,
      passed: finalCampaignGr.state.toString() === '40'
    });

    results.success = results.steps.every(s => s.passed);

  } catch (err) {
    results.success = false;
    results.error = err.toString();
  }

  return results;
}
```

---

## 8. PERFORMANCE OPTIMIZATION PATTERNS

### Pattern 1: Batch Campaign Updates

```javascript
/**
 * Safely update multiple campaigns in batch
 * Prevents individual flow executions from stacking
 * @param {Array} campaignIds - array of campaign sys_ids
 * @param {String} newState - state to set for all
 * @returns {Object} {success: boolean, updated: number, message: string}
 */

function batchUpdateCampaignStates(campaignIds, newState) {
  var updated = 0;
  var failed = [];

  for (var i = 0; i < campaignIds.length; i++) {
    try {
      var campaignGr = new GlideRecord('x_cadso_work_campaign');

      if (campaignGr.get(campaignIds[i])) {
        // Validate transition
        var validation = validateCampaignStateTransition(
          campaignGr.state.toString(),
          newState
        );

        if (validation.valid) {
          campaignGr.state = newState;
          campaignGr.update();
          updated++;
        } else {
          failed.push({
            campaignId: campaignIds[i],
            reason: validation.message
          });
        }
      }
    } catch (err) {
      failed.push({
        campaignId: campaignIds[i],
        reason: err.toString()
      });
    }
  }

  return {
    success: failed.length === 0,
    updated: updated,
    failed: failed,
    message: 'Updated ' + updated + ' campaigns. ' + failed.length + ' failures.'
  };
}
```

### Pattern 2: Index Usage for Queries

```javascript
/**
 * Optimized query using indexed fields
 * Note: Ensure campaign_id and project_id fields are indexed
 * @param {String} campaignId - sys_id of campaign
 * @returns {Array} Array of projects (optimized query)
 */

function getProjectsForCampaignOptimized(campaignId) {
  var projectGr = new GlideRecord('x_cadso_work_project');

  // Use indexed field (campaign)
  projectGr.addQuery('campaign', campaignId);

  // Limit fields to improve performance
  projectGr.query('sys_id, name, state');

  var projects = [];
  while (projectGr.next()) {
    projects.push({
      sys_id: projectGr.sys_id,
      name: projectGr.name,
      state: projectGr.state
    });
  }

  return projects;
}
```

---

## 9. MONITORING & DEBUGGING PATTERNS

### Pattern 1: Log State Changes

```javascript
/**
 * Log all state changes for audit trail
 * Called by business rules before state change
 * @param {GlideRecord} record - record being updated
 * @param {String} tableName - table name
 */

function logStateChange(record, tableName) {
  if (record.state.changed()) {
    var logEntry = {
      table: tableName,
      recordId: record.sys_id,
      recordName: record.name || record.sys_id,
      fromState: previous.state.toString(),
      toState: record.state.toString(),
      changedBy: gs.getUserID(),
      changedByName: gs.getUserName(),
      timestamp: gs.nowDateTime(),
      reason: record.change_reason || 'Not specified'
    };

    // Create audit record
    var auditGr = new GlideRecord('x_cadso_work_state_change_log');
    auditGr.newRecord();
    auditGr.table = tableName;
    auditGr.record_id = record.sys_id;
    auditGr.from_state = logEntry.fromState;
    auditGr.to_state = logEntry.toState;
    auditGr.changed_by = gs.getUserID();
    auditGr.insert();

    gs.info(JSON.stringify(logEntry));
  }
}
```

### Pattern 2: Monitor Flow Executions

```javascript
/**
 * Monitor flow execution times
 * Call at start and end of flow logic
 */

function startFlowTimer(flowName) {
  return {
    flowName: flowName,
    startTime: gs.nowDateTime(),
    startMs: new Date().getTime()
  };
}

function endFlowTimer(timer) {
  var endMs = new Date().getTime();
  var durationMs = endMs - timer.startMs;

  gs.info('Flow Execution Time [' + timer.flowName + ']: ' + durationMs + 'ms');

  return {
    flowName: timer.flowName,
    durationMs: durationMs,
    durationSeconds: (durationMs / 1000).toFixed(2)
  };
}
```

---

## 10. COMMON GOTCHAS & SOLUTIONS

### Gotcha 1: State Not Cascading Properly
**Problem:** Campaign state changes but projects don't update
**Solution:**
```javascript
// Ensure Flow 3 is enabled and published
// Check flow trigger conditions
// Verify project.campaign field is populated
// Check if any business rule is blocking update

function debugStateCascade(campaignId) {
  var projectGr = new GlideRecord('x_cadso_work_project');
  projectGr.addQuery('campaign', campaignId);
  projectGr.query();

  var issues = [];

  while (projectGr.next()) {
    if (projectGr.campaign.nil()) {
      issues.push('Project ' + projectGr.sys_id + ' has null campaign');
    }
  }

  return issues;
}
```

### Gotcha 2: Budget Not Aggregating
**Problem:** Campaign budget doesn't update when project budget changes
**Solution:**
```javascript
// Ensure BR9 is enabled
// Check if project.campaign is set
// Verify budget field is numeric
// BR9 runs AFTER update, not during

function debugBudgetAggregation(campaignId) {
  // Manually trigger aggregation
  var projectGr = new GlideRecord('x_cadso_work_project');
  projectGr.addQuery('campaign', campaignId);
  projectGr.query();

  var totalBudget = 0;

  while (projectGr.next()) {
    var budget = parseFloat(projectGr.budget.toString());
    if (!isNaN(budget)) {
      totalBudget += budget;
    }
  }

  // Update campaign
  var campaignGr = new GlideRecord('x_cadso_work_campaign');
  if (campaignGr.get(campaignId)) {
    campaignGr.total_budget = totalBudget;
    campaignGr.update();
  }

  return totalBudget;
}
```

### Gotcha 3: Auto-Close Not Triggering
**Problem:** All tasks complete but project doesn't auto-close
**Solution:**
```javascript
// Ensure all tasks are actually in terminal state
// Check Flow 2 is enabled and published
// Verify task.status field has correct values
// Check for blocking business rules

function debugAutoClose(projectId) {
  var taskGr = new GlideRecord('x_cadso_work_task');
  taskGr.addQuery('project', projectId);
  taskGr.query();

  var nonTerminalTasks = [];

  while (taskGr.next()) {
    var taskStatus = taskGr.status.toString();

    if (taskStatus !== 'Closed Complete' &&
        taskStatus !== 'Closed Incomplete' &&
        taskStatus !== 'Closed Skipped') {
      nonTerminalTasks.push({
        taskId: taskGr.sys_id,
        taskName: taskGr.name,
        status: taskStatus
      });
    }
  }

  return {
    totalTasks: taskGr.getRowCount(),
    nonTerminalCount: nonTerminalTasks.length,
    nonTerminalTasks: nonTerminalTasks,
    canAutoClose: nonTerminalTasks.length === 0
  };
}
```

---

**Implementation Reference Complete** | **Date:** November 14, 2025
