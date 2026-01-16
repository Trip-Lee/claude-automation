# Tenon Work Management - Quick Reference Guide

## One-Page Overview

```
CAMPAIGN
├─ Required: name (≤100), description (≤1000), start_date, end_date, state
├─ Valid States: draft, planned, active, completed, cancelled
├─ Blocking: When cancelled, no new projects can be created
├─ Children: Projects (0..*)
│
└─ PROJECT
   ├─ Required: name (≤100), description (≤1000), campaign(FK), start_date, end_date, state
   ├─ Valid States: draft, planned, in_progress, completed, cancelled
   ├─ Blocking: 
   │  ├─ Parent campaign must exist
   │  ├─ Parent campaign cannot be 'cancelled'
   │  ├─ Dates should align with parent (warning only)
   │
   └─ TASK
      ├─ Required: name (≤80), description (≤500), project(FK), assigned_to(FK), state
      ├─ Valid States: new, in_progress, pending, completed, cancelled
      ├─ Blocking:
      │  ├─ Parent project must exist
      │  ├─ Parent project cannot be 'cancelled' or 'completed'
      │  └─ assigned_to user must exist
```

---

## API Quick Start

### Create Campaign
```javascript
var manager = new WorkItemManager();
var result = manager.createCampaign({
    name: 'Q1 2024 Campaign',
    short_description: 'Description here',
    start_date: '2024-01-01',
    end_date: '2024-03-31',
    state: 'draft',        // Optional, defaults to 'draft'
    budget: 50000,         // Optional
    priority: 3            // Optional, 1-5
});

// Result: {success: boolean, sysId: string, errors: [], warnings: []}
if (result.success) {
    gs.info('Campaign created: ' + result.sysId);
} else {
    gs.error('Failed: ' + result.errors.join(', '));
}
```

### Create Project
```javascript
var manager = new WorkItemManager();
var result = manager.createProject('campaign_sys_id', {
    name: 'Website Redesign',
    short_description: 'Complete redesign',
    start_date: '2024-01-15',
    end_date: '2024-02-28',
    state: 'draft',        // Optional
    priority: 3            // Optional
});

// Result: {success, sysId, errors, warnings, campaignValidation}
if (!result.success) {
    gs.error('Project creation failed');
    // Check result.campaignValidation.errors for parent issues
}
```

### Create Task
```javascript
var manager = new WorkItemManager();
var result = manager.createTask('project_sys_id', {
    name: 'Design mockup',
    short_description: 'Create initial mockup',
    assigned_to: 'user_sys_id',
    due_date: '2024-02-15',    // Optional
    state: 'new',              // Optional
    priority: 3,               // Optional
    estimated_hours: 8         // Optional
});

// Result: {success, sysId, errors, warnings, projectValidation}
if (!result.success) {
    gs.error('Task creation failed');
    // Check result.projectValidation.errors for parent issues
}
```

---

## Validation Rules

### Campaign Validation
```
✅ name ≤ 100 characters
✅ short_description ≤ 1000 characters
✅ state IN ['draft', 'planned', 'active', 'completed', 'cancelled']
✅ start_date < end_date
✅ budget is numeric and >= 0
⚠️  end_date in past (warning only)
```

### Project Validation
```
✅ name ≤ 100 characters
✅ short_description ≤ 1000 characters
✅ state IN ['draft', 'planned', 'in_progress', 'completed', 'cancelled']
✅ start_date < end_date
✅ campaign FK exists and is not 'cancelled' (BLOCKING)
⚠️  project dates within campaign dates (warning only)
⚠️  end_date in past (warning only)
```

### Task Validation
```
✅ name ≤ 80 characters
✅ short_description ≤ 500 characters
✅ state IN ['new', 'in_progress', 'pending', 'completed', 'cancelled']
✅ project FK exists and NOT ['cancelled', 'completed'] (BLOCKING)
✅ assigned_to user exists (BLOCKING)
⚠️  due_date in past (warning only)
```

---

## Business Rules Triggered

### Before Insert on Campaign
- **File**: `validate_before_campaign_insert.js`
- **Checks**: Required fields, lengths, state, dates, budget
- **Action**: Abort insert on validation failure, set metadata on success

### Before Insert on Project
- **File**: `validate_before_project_insert.js`
- **Checks**: All campaign validations PLUS parent campaign reference validation
- **Critical**: Blocks if campaign doesn't exist or is 'cancelled'
- **Action**: Sets `u_parent_campaign_name` for denormalization

### Before Insert on Task
- **Status**: NO business rule (validation in manager only)

---

## State Transition Matrix

### Campaign States
```
draft        → planned, cancelled
planned      → active, cancelled
active       → completed, cancelled
completed    → (no transitions)
cancelled    → (no transitions)

⚠️  Effect: When campaign is 'cancelled', new projects CANNOT be created
```

### Project States
```
draft        → planned, cancelled
planned      → in_progress, cancelled
in_progress  → completed, cancelled
completed    → (no transitions)
cancelled    → (no transitions)

⚠️  Effect: When project is 'cancelled' or 'completed', new tasks CANNOT be created
```

### Task States
```
new          → in_progress, cancelled
in_progress  → pending, cancelled
pending      → completed, cancelled
completed    → (no transitions)
cancelled    → (no transitions)
```

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Invalid parent campaign reference" | Campaign doesn't exist | Create campaign first, verify sys_id |
| "Cannot create project: parent campaign is cancelled" | Campaign state is 'cancelled' | Use campaign in active/draft/planned state |
| "Campaign name exceeds maximum length" | name.length > 100 | Shorten campaign name |
| "Campaign start date must be before end date" | start_date >= end_date | Verify dates: start < end |
| "Budget must be a valid number" | budget is not numeric | Enter numeric budget |
| "Required field is empty: assigned_to" | assigned_to not provided for task | Provide valid user sys_id |
| "Invalid assigned_to user reference" | User doesn't exist | Use valid user sys_id from sys_user |
| "Cannot create task: parent project in invalid state" | Project is cancelled/completed | Use project in active state |

---

## Validator Methods

### Check if Parent Exists
```javascript
var validator = new WorkItemValidator();
var result = validator.checkReferences('x_cadso_work_campaign', campaignSysId);
if (result.valid && result.exists) {
    // Campaign is valid and not deleted
    gs.info('Campaign name: ' + result.data.name);
} else {
    // Campaign missing or deleted
    gs.error('Campaign invalid: ' + result.errors.join(', '));
}
```

### Full Campaign Validation
```javascript
var validator = new WorkItemValidator();
var result = validator.validateCampaign(sysId);
if (result.valid) {
    gs.info('Campaign is valid');
    gs.info('Project count: ' + result.data.projectCount);
} else {
    gs.error('Campaign errors: ' + result.errors.join(', '));
    gs.warn('Campaign warnings: ' + result.warnings.join(', '));
}
```

### Full Project Validation
```javascript
var validator = new WorkItemValidator();
var result = validator.validateProject(sysId);
if (result.valid) {
    gs.info('Project is valid');
    gs.info('Task count: ' + result.data.taskCount);
} else {
    gs.error('Project errors: ' + result.errors.join(', '));
}
```

### Full Task Validation
```javascript
var validator = new WorkItemValidator();
var result = validator.validateTask(sysId);
if (result.valid) {
    gs.info('Task is valid');
} else {
    gs.error('Task errors: ' + result.errors.join(', '));
}
```

---

## Return Values

### manager.createCampaign()
```javascript
{
    success: boolean,           // true if campaign created
    sysId: 'xxx...',           // Campaign sys_id if successful
    errors: [],                // Array of error messages
    warnings: [],              // Array of warning messages
    validationResult: {        // Full validation result
        valid: boolean,
        errors: [],
        warnings: [],
        data: {
            sys_id: '...',
            name: '...',
            projectCount: 0
        }
    }
}
```

### manager.createProject(campaignSysId, data)
```javascript
{
    success: boolean,
    sysId: 'xxx...',
    errors: [],
    warnings: [],
    validationResult: { /* ... */ },
    campaignValidation: {           // Parent campaign validation
        valid: boolean,
        exists: boolean,
        errors: [],
        data: { /* ... */ }
    }
}
```

### manager.createTask(projectSysId, data)
```javascript
{
    success: boolean,
    sysId: 'xxx...',
    errors: [],
    warnings: [],
    validationResult: { /* ... */ },
    projectValidation: {            // Parent project validation
        valid: boolean,
        exists: boolean,
        errors: [],
        data: { /* ... */ }
    }
}
```

---

## What Gets Logged

### Audit Entries
- `campaign_created`: When campaign is successfully created
- `project_created`: When project is successfully created
- `task_created`: When task is successfully created
- `campaign_updated`: When campaign is updated

### Audit Data
```javascript
{
    sys_id: 'campaign_sys_id',
    name: 'Campaign Name',
    campaign: 'parent_campaign_sys_id',  // For projects
    assigned_to: 'user_sys_id',         // For tasks
    created_by: 'user.name',
    fields_updated: ['field1', 'field2']  // For updates
}
```

---

## Database Schema (Quick Reference)

### x_cadso_work_campaign
```
sys_id              (GUID, PK)
name                (String, ≤100)
short_description   (String, ≤1000)
start_date          (DateTime)
end_date            (DateTime)
state               (Choice)
budget              (Decimal)
assigned_to         (FK to sys_user)
priority            (Integer)
u_validation_status (String)
u_validated_on      (DateTime)
u_validated_by      (FK to sys_user)
```

### x_cadso_work_project
```
sys_id                      (GUID, PK)
name                        (String, ≤100)
short_description           (String, ≤1000)
campaign                    (FK to x_cadso_work_campaign) [REQUIRED]
start_date                  (DateTime)
end_date                    (DateTime)
state                       (Choice)
assigned_to                 (FK to sys_user)
priority                    (Integer)
u_validation_status         (String)
u_validated_on              (DateTime)
u_validated_by              (FK to sys_user)
u_parent_campaign_name      (String, denormalized)
```

### x_cadso_work_task
```
sys_id              (GUID, PK)
name                (String, ≤80)
short_description   (String, ≤500)
project             (FK to x_cadso_work_project) [REQUIRED]
assigned_to         (FK to sys_user) [REQUIRED]
state               (Choice)
due_date            (DateTime)
estimated_hours     (Decimal)
priority            (Integer)
```

---

## Troubleshooting

### Project Creation Fails with Campaign Validation Error
1. Check that campaign sys_id is correct
2. Verify campaign exists: `var gr = new GlideRecord('x_cadso_work_campaign'); if (gr.get(sysId)) { ... }`
3. Check campaign state: `gs.info(gr.getValue('state'));`
4. If state is 'cancelled', create project under different campaign

### Task Creation Fails with Project Validation Error
1. Verify project sys_id is correct
2. Check project state - must NOT be 'cancelled' or 'completed'
3. Verify assigned_to user exists and is not deleted

### Post-Creation Validation Fails (Rollback)
1. Check returned validationResult.errors
2. May indicate data inconsistency
3. Verify all required fields were provided
4. Check for data that exceeds field length limits

---

**Quick Reference Version**: 1.0
**Updated**: 2024-11-15

