# Tenon Work Management - Quick Reference

## Three-Level Hierarchy
```
Campaign (x_cadso_work_campaign)
    ↓ [Many] reference: active=true
Project (x_cadso_work_project)
    ↓ [Many] reference: CASCADING DELETE
Task (x_cadso_work_task)
```

## Critical Cascade Rules

### 🚨 DANGEROUS - DELETE PROJECT → DELETE ALL TASKS
```javascript
Task.project references Project with Cascade = DELETE
// Deleting one project automatically deletes ALL associated tasks
// No warnings, silent operation
```

### ⚠️ RISKY - ARCHIVE CAMPAIGN → ARCHIVE ALL PROJECTS & TASKS
```
campaign.state = 333 (Archive)
    ↓ Flow: Archive (Campaign)
    ↓ For Each Project: state = 333
    ↓ For Each Task: state = 333
Result: Entire hierarchy archived
Example: 1 campaign → 5 projects → 50 tasks (56 total)
```

### 🔗 AUTO-CLOSURE CASCADE
```
Complete Last Task
    ↓ Check: All tasks done?
    ↓ Close Project
    ↓ Check: All projects done?
    ↓ Close Campaign (auto-closes!)
Risk: User completes 1 task, campaign auto-closes (unexpected)
```

## Key Reference Fields

| Table | Field | References | Qualifier | Cascade |
|-------|-------|-----------|-----------|---------|
| Project | campaign | Campaign | active=true | None |
| Task | project | Project | None | **DELETE** |
| Task | campaign | Campaign | None | None |

## Business Rules Count: 66 Total

- Campaign: 15 rules
- Project: 20 rules
- Task: 25 rules
- Supporting: 6 rules

## Workflows Count: 80+ Total

**Critical Flows:**
1. Process_Start_and_End_Dates_for_Task_and_Project (Date sync)
2. Create_Project_from_Template (Task structure)
3. Close_Project_on_All_Associated_Tasks_Completion (Auto-close)
4. Archive (Campaign) (Full hierarchy archive)
5. On Hold (Campaign) (Work pause)
6. Marketing_Task_-_Start_Date (Task date change)
7. Marketing_Task_-_End_Date (Task end change)

## Script Includes (20+)

| Script | Tables | Risk |
|--------|--------|------|
| DateCalculation | project, task | HIGH |
| WorkClientUtils | campaign, segment | LOW |
| ActiveTaskApi | task | LOW |
| RefQualApi | various | LOW |
| sprintPlanningMS | task, sprint | MEDIUM |
| workMainUtilsMS | project, task | MEDIUM |

## Common Scenarios

### ✅ Scenario: Create Campaign
```
INSERT campaign
    ↓ Activity stream entry
    ↓ Ready for projects
```

### ✅ Scenario: Create Project from Template
```
INSERT project (template specified)
    ↓ Copy fields from template
    ↓ Create all tasks
    ↓ Calculate dates from template
```

### ⚠️ Scenario: Update Project Dates
```
UPDATE project.expected_start = new_date
    ↓ Trigger: Process_Start_and_End_Dates_for_Task_and_Project
    ↓ For Each Task: Shift date by offset
    ↓ Recalculate project dates
    ↓ Result: All tasks shifted
```

### 🚨 Scenario: Complete Last Task
```
UPDATE task.state = Complete
    ↓ Check: All tasks in project done? YES
    ↓ Auto-close project
    ↓ Check: All projects in campaign done? YES
    ↓ Auto-close campaign
    ✓ Entire hierarchy closed automatically!
```

### 🚨 Scenario: Delete Project
```
DELETE project (with 50 tasks)
    ↓ Cascade Delete Rule Triggers
    ↓ DELETE ALL 50 tasks automatically
    ✓ Silent operation, no warning!
```

### 🚨 Scenario: Archive Campaign
```
UPDATE campaign.state = 333 (Archive)
    ↓ Flow: Archive (Campaign)
    ├─ For Each of 5 projects: state = 333
    │   ├─ For Each task (10 per project): state = 333
    │   └─ Activity entry per task
    └─ Result: 56 records updated, 56 activity entries
```

## Risk Assessment

### HIGH RISK Operations
- 🚨 Delete project (cascades to all tasks)
- 🚨 Archive campaign (cascades to all projects/tasks)
- 🚨 Complete last task (may auto-close campaign)
- 🚨 Update project dates (shifts all task dates)

### MEDIUM RISK Operations
- ⚠️ Change campaign status
- ⚠️ Modify reference qualifiers
- ⚠️ Update task dates

### LOW RISK Operations
- ✅ Create campaign
- ✅ Create project from template
- ✅ Add new custom field
- ✅ Modify labels

## Before Any Changes

**MUST DO:**
1. ✅ Test in DEV instance only
2. ✅ Document all 80+ affected flows
3. ✅ Identify all 20+ script dependencies
4. ✅ Plan cascade testing
5. ✅ Get stakeholder approval
6. ✅ Backup database
7. ✅ Schedule maintenance window

**SAFE CHANGES:**
- Add new custom fields
- Add new state values
- Modify field labels
- Add choice list values

**DANGEROUS CHANGES (DO NOT WITHOUT APPROVAL):**
- Delete reference fields
- Change cascade rules
- Disable flows
- Delete campaigns/projects

## Performance Notes

- Date sync on 100 tasks: ~30 seconds
- Campaign dropdown load: ~2-3 seconds
- Archive cascade (50 tasks): ~2-5 seconds
- Archive cascade (100 tasks): ~5-10 seconds

## Key Files

**Table Definitions:**
- Campaign: `x_cadso_work_campaign_7a00ecf44728e950a1052a02e26d4355.json`
- Project: `x_cadso_work_project_2f154d29475c255085d19fd8036d431b.json`
- Task: `x_cadso_work_task_b547068947282d50a1052a02e26d4397.json`

**Critical References:**
- Project.campaign: `x_cadso_work_project_c8a30461c396861085b196c4e40131e8.json` (active=true)
- Task.project: `x_cadso_work_task_3ca3c461c396861085b196c4e4013137.json` (CASCADE DELETE)

**Key Script:**
- DateCalculation: `DateCalculation_c205510547f4025098519fd8036d4388.json`

**Flows (80+):**
- Archive (Campaign): `Archive_Campaign_b036ef88475a3150b0361ae8036d4321.json`
- Date Sync: `Process_Start_and_End_Dates_for_Task_and_Project_97f0e3934756bd5098519fd8036d436a.json`

## Testing Checklist

Before deploying changes:
- [ ] Design documented
- [ ] All flows reviewed (80+)
- [ ] All scripts checked (20+)
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Cascade testing complete
- [ ] Performance tests pass
- [ ] Security tests pass
- [ ] Stakeholder approval
- [ ] Database backup
- [ ] Rollback plan documented

---

**Last Updated:** November 15, 2025
**Confidence Level:** HIGH (Comprehensive analysis)
**Next Review:** December 15, 2025

**Contact:** Architecture Team
