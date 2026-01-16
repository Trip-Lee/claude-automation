# Tenon Work Management Workflow - Executive Summary

## Quick Overview

The Tenon system implements a **3-level hierarchical work breakdown structure**:

```
┌─────────────────────────────────────────────────────────────┐
│ CAMPAIGN (Marketing/Business Initiative)                    │
│ • States: draft → planned → active → completed / cancelled  │
│ • Validates: dates, budget, required fields                 │
│ • Parent Restriction: None                                  │
│ • Can Have: Multiple Projects                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ (One or More)
                       │
        ┌──────────────▼──────────────┐
        │ PROJECT (Managed Deliverable)│
        │ States: draft → planned →    │
        │  in_progress → completed /   │
        │  cancelled                   │
        │ Requires: Campaign (FK)      │
        │ Cannot Create If Parent:     │
        │  - Doesn't exist             │
        │  - Is 'cancelled'            │
        │ Can Have: Multiple Tasks     │
        └──────────────┬───────────────┘
                       │
                       │ (One or More)
                       │
        ┌──────────────▼──────────────┐
        │ TASK (Atomic Work Unit)      │
        │ States: new → in_progress →  │
        │  pending → completed /       │
        │  cancelled                   │
        │ Requires: Project (FK)       │
        │ Requires: Assigned User      │
        │ Cannot Create If Parent:     │
        │  - Doesn't exist             │
        │  - Is 'cancelled'/'completed'│
        └──────────────────────────────┘
```

---

## Core Relationships

### 1. Campaign → Project

**Foreign Key**: `Project.campaign` → `Campaign.sys_id`

**Validation Rules**:
- ✅ Campaign MUST exist (verified in before-insert trigger)
- ✅ Campaign CANNOT be 'cancelled'
- ⚠️ Project dates SHOULD align with campaign dates (warning only)

**Blocking Rules**:
- If campaign doesn't exist → **INSERT BLOCKED**
- If campaign is 'cancelled' → **INSERT BLOCKED**

### 2. Project → Task

**Foreign Key**: `Task.project` → `Project.sys_id`

**Validation Rules**:
- ✅ Project MUST exist
- ✅ Project CANNOT be 'cancelled' or 'completed'
- ✅ Assigned user MUST exist

**Blocking Rules**:
- If project doesn't exist → **INSERT BLOCKED**
- If project is 'cancelled'/'completed' → **INSERT BLOCKED**
- If assigned user doesn't exist → **INSERT BLOCKED**

---

## Business Rules (Before Insert Triggers)

### Campaign Insert Trigger (`validate_before_campaign_insert`)
- Order: 100
- Validates: All required fields, lengths, state, date range, budget
- Actions: Sets validation metadata or aborts insert
- **No parent validation** (campaigns are root level)

### Project Insert Trigger (`validate_before_project_insert`)
- Order: 100
- Validates: All required fields + **parent campaign reference validation**
- Key Check: Campaign FK must exist AND not be 'cancelled'
- Actions: Sets validation metadata including denormalized parent name
- **Blocks** insert if parent campaign is invalid/cancelled

---

## Script Includes (Lifecycle Management)

### WorkItemValidator
Provides validation methods:
- `validateCampaign(sysId)` - Full campaign validation
- `validateProject(sysId)` - Full project validation including parent checks
- `validateTask(sysId)` - Full task validation including parent/user checks
- `checkReferences(tableName, sysId)` - Reference integrity validation

### WorkItemManager
Provides creation methods:
- `createCampaign(data)` - Creates campaign with post-insert validation
- `createProject(campaignSysId, data)` - Creates project under campaign
  - Pre-checks: Validates campaign exists and is not 'cancelled'
  - Post-check: Validates created project
  - Rollback: Deletes project if post-validation fails
- `createTask(projectSysId, data)` - Creates task under project
  - Pre-checks: Validates project exists/not-cancelled, validates assigned user
  - Post-check: Validates created task
  - Rollback: Deletes task if post-validation fails

---

## What Happens In Each Scenario

### Scenario 1: Create Campaign
```
WorkItemManager.createCampaign({name, dates, budget, state})
  → Validate input data
  → Insert GlideRecord('x_cadso_work_campaign')
    → Trigger: validate_before_campaign_insert
      → Check: All required fields filled
      → Check: start_date < end_date
      → Check: budget is numeric and >= 0
      → Action: Set u_validation_status='validated'
  → Post-Insert: WorkItemValidator.validateCampaign()
  → Audit Log: 'campaign_created'
  → Return: {success: true, sysId: 'xxx'}
```

### Scenario 2: Create Project Under Campaign
```
WorkItemManager.createProject(campaignSysId, {name, dates, state})
  → Check: Campaign exists using checkReferences()
  → Check: Campaign state != 'cancelled'
  → Validate input data
  → Insert GlideRecord('x_cadso_work_project', {campaign: campaignSysId})
    → Trigger: validate_before_project_insert
      → Check: All required fields (including campaign FK)
      → Check: Campaign reference valid via checkReferences()
      → Check: Campaign state != 'cancelled'
      → Check: Project dates within campaign dates (warning only)
      → Action: Set u_parent_campaign_name = campaign.name (denormalized)
      → Action: Set u_validation_status='validated'
  → Post-Insert: WorkItemValidator.validateProject()
  → Audit Log: 'project_created'
  → Return: {success: true, sysId: 'yyy'}
  
  OR
  
  → Campaign doesn't exist / is cancelled
  → Return: {success: false, errors: ['Cannot create project: parent campaign...']}
```

### Scenario 3: Create Task Under Project
```
WorkItemManager.createTask(projectSysId, {name, assigned_to, state})
  → Check: Project exists using checkReferences()
  → Check: Project state NOT IN ['cancelled', 'completed']
  → Check: assigned_to user exists using checkReferences()
  → Validate input data
  → Insert GlideRecord('x_cadso_work_task', {project: projectSysId, assigned_to: userId})
    → No before-insert trigger for tasks
  → Post-Insert: WorkItemValidator.validateTask()
    → Check: Project reference valid
    → Check: assigned_to user valid
    → Check: All required fields
  → Audit Log: 'task_created'
  → Return: {success: true, sysId: 'zzz'}
  
  OR
  
  → Project invalid / wrong state / user doesn't exist
  → Return: {success: false, errors: ['Cannot create task: ...']}
```

### Scenario 4: Change Campaign to 'cancelled'
```
User changes campaign.state = 'cancelled'
  → After insert trigger runs (validates campaign)
  → Campaign is now blocked from creating NEW projects
  → EXISTING projects REMAIN unchanged (not deleted/cancelled)
  → All child tasks REMAIN unchanged
  → Warning: Projects become orphaned with stale parent reference
```

### Scenario 5: Try to Create Project Under Cancelled Campaign
```
WorkItemManager.createProject('cancelled_campaign_id', {...})
  → Check: Campaign exists ✓
  → Check: Campaign state != 'cancelled' ✗ FAIL
  → Return: {success: false, errors: ['Cannot create project: parent campaign is cancelled']}
  → Project is NOT created
```

---

## State Machines

### Campaign State Transitions
```
DRAFT ──→ PLANNED ──→ ACTIVE ──→ COMPLETED
  ↓         ↓           ↓           ↓
  └─────────┴───────────┴───────────┘
       (All can go to CANCELLED)
```

### Project State Transitions
```
DRAFT ──→ PLANNED ──→ IN_PROGRESS ──→ COMPLETED
  ↓         ↓            ↓              ↓
  └─────────┴────────────┴──────────────┘
       (All can go to CANCELLED)
```

### Task State Transitions
```
NEW ──→ IN_PROGRESS ──→ PENDING ──→ COMPLETED
 ↓         ↓             ↓           ↓
 └─────────┴─────────────┴───────────┘
      (All can go to CANCELLED)
```

---

## Validation Matrix

| Check | Campaign | Project | Task |
|-------|----------|---------|------|
| Required fields | ✅ Enforced | ✅ Enforced | ✅ Enforced |
| Field lengths | ✅ Enforced | ✅ Enforced | ✅ Enforced |
| Valid state | ✅ Enforced | ✅ Enforced | ✅ Enforced |
| Parent exists | N/A (root) | ✅ **BLOCKED** | ✅ **BLOCKED** |
| Parent not cancelled | N/A (root) | ✅ **BLOCKED** | ✅ **BLOCKED** |
| Parent not completed | N/A (root) | N/A | ✅ **BLOCKED** |
| Date range (start < end) | ✅ Enforced | ✅ Enforced | N/A |
| Dates within parent | N/A (root) | ⚠️ Warning | N/A |
| Budget valid | ✅ Enforced | N/A | N/A |
| User assigned | N/A | N/A | ✅ **BLOCKED** |

---

## Key Implementation Details

### Validation Timing

1. **Before Insert Trigger** (DB level)
   - Campaign: Validates all fields
   - Project: Validates all fields + parent reference
   - Task: No trigger (validation in manager)

2. **Post-Insert Validation** (Application level)
   - All items: WorkItemValidator methods called after successful insert
   - All items: If post-validation fails, record is **rolled back (deleted)**

### Error Handling

**Blocking Errors** (Insert aborted):
- Missing required field
- Invalid field length
- Invalid state value
- Invalid date range
- Parent doesn't exist
- Parent in invalid state
- Assigned user doesn't exist

**Warnings** (Insert proceeds):
- Project dates outside campaign dates
- End date in past
- Due date in past

### Audit Logging

Every successful create logs:
- Action (campaign_created, project_created, task_created)
- System ID
- Name
- Parent references
- User who created

---

## Known Limitations

### What DOESN'T Cascade

❌ **No Cascade Delete**
- Deleting a campaign leaves projects with stale campaign FK
- Deleting a project leaves tasks with stale project FK
- No orphan cleanup available

❌ **No Cascade Update**
- Changing campaign name does NOT update `u_parent_campaign_name` in projects
- Denormalized field becomes stale

❌ **No Cascade State Change**
- Campaign → cancelled does NOT auto-cancel projects
- Projects remain accessible but can't have new tasks created
- Inconsistent state possible

### No Strict Enforcement

⚠️ **Soft Validation**
- Application-level only (not database constraints)
- Direct database inserts bypass validation
- State transitions not enforced (can skip states)

⚠️ **No ACL**
- No role-based access control
- Any user can create/update any campaign/project

---

## Recommendations

### High Priority
1. **Implement Cascade Delete** - Prevent orphaned records
2. **Add Database Foreign Keys** - Enforce referential integrity at DB level
3. **Implement State Machine** - Enforce valid transitions

### Medium Priority
4. **Add Role-Based Access** - Restrict campaign creation to managers
5. **Sync Denormalized Fields** - Update child u_parent_campaign_name on parent update
6. **Bulk Operation Support** - Enable multi-item creates

### Low Priority
7. **External Notifications** - Alert managers on state changes
8. **Reporting Dashboards** - Campaign/project/task metrics
9. **Advanced Audit Trail** - Field-level change history

---

## File Locations

- **Analysis Document**: `/analysis/tenon_work_management_workflow.md` (535 lines)
- **Business Rules**: `/business-rules/validate_before_campaign_insert.js`
- **Business Rules**: `/business-rules/validate_before_project_insert.js`
- **Script Include**: `/script-includes/WorkItemValidator.js` (714 lines)
- **Script Include**: `/script-includes/WorkItemManager.js` (638 lines)

---

**Last Updated**: 2024-11-15
**Analysis Version**: 1.0
**System**: Tenon Work Management (Campaign → Project → Task)

