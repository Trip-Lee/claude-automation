# Tenon Work Management - Operation Runbooks

**Standard procedures for common operations and troubleshooting**

---

## Table of Contents
1. Creating Records
2. Updating Records
3. Closing Records
4. Canceling/Archiving Records
5. Cascading Issues
6. Troubleshooting Common Problems

---

## 1. CREATING RECORDS

### Runbook: Create a New Campaign

**Time Required:** 2-3 minutes
**Risk Level:** LOW
**Auto-actions:** 2 (segment assignment + name denormalization)

#### Steps

```
Step 1: Navigate to x_cadso_work_campaign list view
└─► Action: Click "New"

Step 2: Fill required fields
├─► Field: name
│   └─ Example: "Q4 Marketing Campaign"
├─► Field: state
│   └─ Recommended: 10 (Upcoming) or 20 (Open)
└─► Field: segment (optional, can leave blank)
    └─ If blank: Auto-assigned to default

Step 3: Fill optional fields
├─► budget (optional, will be calculated)
├─► description
└─► other custom fields

Step 4: Click "Submit" or "Save"
├─► BR4 executes (BEFORE):
│   └─ Sets segment = default if blank
├─► Record inserted
└─► BR7 executes (AFTER):
    └─ Sets campaign_string = name

Step 5: Verify
├─► Check: segment is populated
├─► Check: campaign_string matches name
└─► Note: No projects yet, budget = 0

✅ CAMPAIGN CREATED AND READY

Next Steps:
└─► Add projects by clicking related list link
```

#### Validation Checklist

```
□ Campaign name is meaningful and unique
□ Segment is assigned (auto or manual)
□ State is one of: 10, 20, 30 (not 40, 50, 60, 333)
□ campaign_string field populated
□ No error messages in browser console
```

---

### Runbook: Create a New Project

**Time Required:** 3-4 minutes
**Risk Level:** LOW
**Auto-actions:** 1 (segment assignment)
**Important:** Must be linked to campaign

#### Steps

```
Step 1: Open parent campaign record
└─► Navigate to x_cadso_work_campaign list
└─► Click campaign name to open

Step 2: Click related list link "Projects"
└─► Or navigate to x_cadso_work_project
    and use filter: campaign = [campaign ID]

Step 3: Click "New" to create project
└─► Or click "New project" on campaign form

Step 4: Fill required fields
├─► Field: campaign
│   └─ Should be pre-populated from parent
│   └─ Verify: Check correct campaign
├─► Field: name
│   └─ Example: "Email Campaign Design"
├─► Field: state
│   └─ Recommended: 0 (Requested) or 10 (Upcoming)
└─► Field: segment (optional, can leave blank)
    └─ If blank: Auto-assigned to default

Step 5: Fill optional fields
├─► description
├─► assigned_to
├─► due_date
└─► other custom fields

Step 6: Click "Submit" or "Save"
├─► BR5 executes (BEFORE):
│   └─ Sets segment = default if blank
├─► Record inserted
└─► BR8 executes (AFTER):
    └─ Sets project_string = name

✅ PROJECT CREATED AND READY

Next Steps:
└─► Add tasks by clicking related list link
└─► Note: Campaign budget still = 0 (no project budgets set)
```

#### Validation Checklist

```
□ campaign field is populated and correct
□ Project name is meaningful
□ State is one of: -10, 0, 10, 30 (not terminal)
□ segment is assigned
□ project_string field populated
□ No errors in browser console
```

---

### Runbook: Create a New Task

**Time Required:** 2-3 minutes
**Risk Level:** LOW
**Auto-actions:** 1 (campaign auto-filled, segment assignment)
**Important:** Creates denormalized link to campaign

#### Steps

```
Step 1: Open parent project record
└─► Navigate to x_cadso_work_project list
└─► Click project name to open

Step 2: Click related list link "Tasks"
└─► Or navigate to x_cadso_work_task
    and use filter: project = [project ID]

Step 3: Click "New" to create task
└─► Or click "New task" on project form

Step 4: Fill required fields
├─► Field: project
│   └─ Should be pre-populated from parent
│   └─ Verify: Check correct project
├─► Field: campaign
│   └─ May auto-fill from project.campaign
│   └─ If blank: Must fill manually
│   └─ CRITICAL: Must match parent project.campaign
├─► Field: name
│   └─ Example: "Design email template"
├─► Field: status (or state)
│   └─ Recommended: "Open"
└─► Field: segment (optional, can leave blank)
    └─ If blank: Auto-assigned to default

Step 5: Fill optional fields
├─► description
├─► assigned_to
├─► due_date
└─► other custom fields

Step 6: Click "Submit" or "Save"
├─► BR6 executes (BEFORE):
│   └─ Sets segment = default if blank
├─► Record inserted
└─► Task ready to work on

✅ TASK CREATED AND READY

Next Steps:
└─► Assign to team member
└─► Work on task
└─► Mark complete when done (triggers cascade)
```

#### Validation Checklist

```
□ project field is populated and correct
□ campaign field is populated and correct
□ campaign matches project.campaign
□ Task name is meaningful
□ status/state is "Open"
□ segment is assigned
□ No errors in browser console
```

---

## 2. UPDATING RECORDS

### Runbook: Update Campaign Segment

**Time Required:** 1 minute
**Risk Level:** LOW
**Cascading:** NO (only affects this campaign)
**Important:** Doesn't change project/task segments

#### Steps

```
Step 1: Open campaign record
├─► Navigate to x_cadso_work_campaign
└─► Click campaign name

Step 2: Click Edit button
└─► Or click "Edit" pencil icon

Step 3: Update segment field
├─► Click segment field
├─► Select new segment from list
└─► Note: Only changes this campaign, not children

Step 4: Click "Save"
├─► No BR fires for segment update
├─► Record updated successfully
└─► Campaign.segment now changed

Step 5: Verify
└─► Check: segment field shows new value

✅ CAMPAIGN SEGMENT UPDATED

Notes:
- Projects still have their own segments
- Tasks still have their own segments
- This is a solo change, no cascade
```

---

### Runbook: Update Project Status

**Time Required:** 2-5 minutes (depends on cascade)
**Risk Level:** MEDIUM
**Cascading:** POSSIBLY (if all tasks complete)
**Important:** Terminal states may trigger auto-close

#### Steps

```
Step 1: Open project record
├─► Navigate to x_cadso_work_project
└─► Click project name

Step 2: Click Edit button
└─► Or click "Edit" pencil icon

Step 3: Update state field
├─► Click state field
├─► Choose new state:
│   ├─► 10 (Upcoming) - LOW RISK
│   ├─► 30 (In Progress) - LOW RISK
│   ├─► 40 (Completed) - MEDIUM RISK
│   ├─► 70 (Canceled) - MEDIUM RISK
│   ├─► 333 (Archived) - MEDIUM RISK
│   └─► Note: Avoid 6 (Rejected) unless needed
└─► Note terminal states in the Flows section

Step 4: Click "Save"
├─► BR2 fires (BEFORE update) if state→333 or 22:
│   ├─► Saves project.previous_state JSON
│   └─► Checks parent campaign state
│
├─► Record updated
│
└─► IF new state is terminal (40, 70, 6, 333):
    └─► Flow 2 triggers immediately
        ├─► Checks: Are ALL tasks in project terminal?
        └─► IF ALL tasks terminal:
            ├─► Campaign auto-closes if all its projects terminal
            └─► May see flow notification

Step 5: Monitor cascade
├─► If state = 40, 70, or 333:
│   ├─► Wait 5-10 seconds for Flow 2 to check
│   ├─► Refresh campaign record
│   └─► Check: Did campaign auto-close?
│       └─ YES: Only if all projects are terminal
│       └─ NO: Other projects still in progress
└─► If state = 10 or 30:
    └─► No cascade, project stays as-is

✅ PROJECT STATUS UPDATED

Notes:
- Non-terminal status = no cascade
- Terminal status = may trigger campaign auto-close
- Only auto-closes if ALL projects in campaign terminal
```

#### Decision Tree: Which State to Choose?

```
Is project in planning phase?
├─ YES: Set to 0 (Requested)
│   └─► Awaiting approval
│   └─► No cascade triggered
│
└─ NO: Is project approved and ready to start?
   ├─ YES: Set to 30 (In Progress)
   │   └─► Work is active
   │   └─► No cascade triggered
   │
   └─ NO: Is project complete?
      ├─ YES: Set to 40 (Completed)
      │   └─► CAUTION: May auto-close if all tasks terminal
      │   └─► Cascade triggered
      │
      └─ NO: Is project canceled by stakeholder?
         ├─ YES: Set to 70 (Canceled)
         │   └─► CAUTION: May auto-close campaign
         │   └─► Cascade triggered
         │
         └─ NO: Is project being archived for historical record?
            └─ YES: Set to 333 (Archived)
               └─► CAUTION: Saves state, may auto-close campaign
               └─► Can unarchive later
               └─► Cascade triggered
```

---

### Runbook: Update Task Status

**Time Required:** 1-3 minutes (depends on cascade)
**Risk Level:** MEDIUM
**Cascading:** STRONG (may close project AND campaign)
**Important:** This is the primary cascade trigger

#### Steps

```
Step 1: Open task record
├─► Navigate to x_cadso_work_task
└─► Click task name

Step 2: Click Edit button
└─► Or use inline edit

Step 3: Update status field
├─► Current status: "Open"
├─► Change to ONE OF:
│   ├─► "Closed Complete" - Task succeeded
│   ├─► "Closed Incomplete" - Task abandoned
│   └─► "Closed Skipped" - Not applicable
└─► Note: All three are "terminal" states

Step 4: Click "Save"
├─► BR3 fires (BEFORE update):
│   ├─► Saves task.previous_state JSON
│   └─► Checks parent project state
│
├─► Record updated
│
└─► Flow 2 triggers IMMEDIATELY:
    ├─► Checks: Are ALL tasks in project terminal?
    │
    ├─► YES (all closed):
    │   ├─► Project auto-closes to state 40
    │   ├─► Sets project.actual_end_date = today()
    │   │
    │   └─► Flow 1 triggers:
    │       ├─► Checks: Are ALL projects in campaign terminal?
    │       │
    │       ├─► YES (all closed):
    │       │   ├─► Campaign auto-closes to state 40
    │       │   └─► Sets campaign.actual_end_date = today()
    │       │
    │       └─► NO (other projects active):
    │           └─► Campaign stays in current state
    │
    └─► NO (other tasks still open):
        └─► Project stays in current state
            Campaign unaffected

Step 5: Monitor cascade (IMPORTANT)
├─► Wait 5-10 seconds
├─► Refresh project record
│   └─► Check: Did it auto-close?
├─► Refresh campaign record
│   └─► Check: Did it auto-close?
└─► Verify: All three levels updated correctly

✅ TASK STATUS UPDATED + POTENTIAL CASCADE

Example Cascade:
─────────────────────────────────────────────
BEFORE:
  Campaign: state 30 (WIP)
  Project A: state 30 (In Progress)
    Task A1: status "Open"
    Task A2: status "Open"
  Project B: state 40 (Completed) - all tasks done

ACTION: Mark Task A1 as "Closed Complete"
        (still Task A2 open)
RESULT: No cascade (not all tasks in A closed)

ACTION: Mark Task A2 as "Closed Complete"
        (NOW all tasks in A closed)
RESULT: Project A auto-closes → 40 (Completed)
        Campaign check: Project A=40, Project B=40
        Campaign auto-closes → 40 (Completed)
        actual_end_date = today()

Timeline: ~10 seconds for full cascade
─────────────────────────────────────────────
```

#### Validation Checklist

```
□ Task status is one of: Closed Complete/Incomplete/Skipped
□ Can open task again if needed? No (closed)
□ Did parent project auto-close? Check if expected
□ Did campaign auto-close? Check if all projects terminal
□ actual_end_date set correctly? Should be today()
□ No error messages in browser console
```

---

## 3. CLOSING RECORDS

### Runbook: Auto-Close Campaign (via Task Completion)

**Time Required:** N/A (automatic)
**Risk Level:** LOW
**Trigger:** All tasks in all projects are terminal
**Reversible:** YES (via manual state update)

#### Prerequisites

```
□ Campaign has at least one project
□ All projects have at least one task
□ ALL tasks in ALL projects are marked terminal
  (Closed Complete/Incomplete/Skipped)
```

#### What Happens

```
AUTOMATIC PROCESS (Flow 2 + Flow 1):

When ALL tasks in ALL projects are closed:
│
├─► Last task completion triggers Flow 2
│   ├─► Confirms: All tasks in this project terminal
│   └─► Auto-updates: project.state = 40
│
├─► Project update triggers Flow 1
│   ├─► Queries: All projects in campaign
│   ├─► Checks: Are ALL terminal?
│   └─► IF YES:
│       └─► Auto-updates:
│           ├─► campaign.state = 40
│           └─► campaign.actual_end_date = today()
│
└─► RESULT: Campaign auto-closed

No user action needed!
```

#### Verification Steps

```
Step 1: Verify in Flow Designer logs
├─► Navigate: System Logs → Flow Designer
├─► Filter: Table = x_cadso_work_campaign
├─► Check: "Close Campaign on Projects" flow executed
└─► Verify: Status = "Success"

Step 2: Check campaign record
├─► Navigate: x_cadso_work_campaign
├─► Open: Affected campaign
├─► Verify: state = 40 (Closed Complete)
└─► Verify: actual_end_date = today's date

Step 3: Check project records
├─► Navigate: x_cadso_work_project
├─► Filter: campaign = [affected campaign]
├─► Verify: ALL projects show state = 40
└─► Verify: All have actual_end_date = today()

Step 4: Check task records
├─► Navigate: x_cadso_work_task
├─► Filter: campaign = [affected campaign]
├─► Verify: ALL tasks show terminal status
└─► No tasks should be "Open"
```

#### What If It Doesn't Auto-Close?

```
Problem: Campaign still shows state 30, but all tasks closed

Step 1: Check project status
└─► At least one project NOT in terminal state?
    └─ Project might still be state 30 (In Progress)
    └─ Flow 1 requires ALL projects terminal
    └─ Update that project to 40

Step 2: Check task status
└─► At least one task NOT terminal?
    └─ Some task might still be "Open"
    └─ Mark it as Closed
    └─ Trigger flow again

Step 3: Check flow logs
├─► System Logs → Flow Designer
├─► Search: "Close Campaign" flow
└─► Check: Any error messages?

Step 4: Manual workaround
└─► IF flows disabled: Set campaign.state = 40 manually
    └─► WARNING: This bypasses validation
    └─► Only do if flows are broken
```

---

### Runbook: Manually Close Campaign

**Time Required:** 1-2 minutes
**Risk Level:** LOW
**Reversible:** YES (via state history)
**When to Use:** Flows not working or urgent closure needed

#### Steps

```
Step 1: Open campaign record
├─► Navigate to x_cadso_work_campaign
└─► Click campaign name

Step 2: Verify readiness
├─► Check: Are there active projects?
├─► Check: Are there open tasks?
└─► BEST PRACTICE: Close projects first, let cascade happen
    └─► But if urgent, proceed with manual close

Step 3: Update state field
├─► Click state field
├─► Select one of:
│   ├─► 40 = Closed Complete (work succeeded)
│   ├─► 50 = Closed Incomplete (work partially done)
│   └─► 60 = Closed Skipped (work not done)
└─► AVOID: Using 333 (Archive) for normal close
    └─► Archive = save for historical record

Step 4: Click "Save"
├─► BR1 fires (BEFORE):
│   └─► Saves campaign.previous_state JSON
│
├─► Record updated
│
└─► Flow 3 may trigger (only if state = 70, 22, 333)
    └─► For normal close (40-60): No flow triggers

Step 5: Update end date (optional)
├─► If not auto-set:
├─► Set actual_end_date = today()
└─► Save again

✅ CAMPAIGN MANUALLY CLOSED

Notes:
- Manual close doesn't force project closure
- Projects may still be open/in progress
- Use when flows not working
- Can always reopen by changing state back
```

---

## 4. CANCELING/ARCHIVING RECORDS

### Runbook: Cancel Campaign (Top-Down Cascade)

**Time Required:** 5-10 seconds (automatic)
**Risk Level:** HIGH
**Cascading:** GUARANTEED (affects all projects)
**Reversible:** YES (via previous_state)

#### When to Use

```
Use Campaign Cancellation when:
- Campaign scope changed by stakeholder
- Budget/resources cut unexpectedly
- Market conditions changed
- Need to stop all work immediately
- Want to halt entire hierarchy in one action
```

#### Steps

```
Step 1: Open campaign record
├─► Navigate to x_cadso_work_campaign
└─► Click campaign name to open

Step 2: Prepare for cascade
├─► INFORM TEAM: All projects will be canceled
├─► CHECK: Are any projects in critical phase?
└─► REVIEW: Ensure cancellation is correct choice

Step 3: Update state field
├─► Click state field
├─► Select: 70 (Canceled)
└─► Note: State 22 (On Hold) also cascades, but different intent

Step 4: Click "Save"
├─► BR1 fires (BEFORE):
│   └─► Saves campaign.previous_state = {
│       old_state: 30,
│       timestamp: now,
│       ...metadata
│       }
│
├─► Record updated: campaign.state = 70
│
└─► Flow 3 triggers IMMEDIATELY:
    ├─► "Cancel Campaign Projects"
    ├─► Queries: All projects where campaign = this
    │
    └─► FOR EACH project:
        ├─► BR2 fires (BEFORE):
        │   └─► Saves project.previous_state
        │   └─► Checks parent campaign (now canceled)
        │
        └─► UPDATE project.state = 70 (Canceled)
            └─► All tasks in project notified

Step 5: Monitor cascade
├─► Wait 5-10 seconds for flows to complete
├─► Check Flow Designer logs:
│   └─► Navigate: System Logs → Flow Designer
│   └─► Filter: "cancel_campaign" flow
│   └─► Verify: Status = "Success"
│
├─► Verify all projects updated:
│   └─► Navigate: x_cadso_work_project
│   └─► Filter: campaign = [canceled campaign]
│   └─► Verify: ALL show state = 70
│
└─► Verify no automatic campaign closure:
    └─► Campaign stays at 70 (not auto-closed)

✅ CAMPAIGN CANCELED AND CASCADED

Timeline:
┌────────────────────────────────────────┐
│ T0: User saves campaign.state = 70     │
│ T1: BR1 executes                       │
│ T2: Flow 3 starts                      │
│ T3-T8: Each project updated (loop)     │
│ T9: All projects = 70                  │
│ T10: Tasks notified via flow           │
└────────────────────────────────────────┘
Total: 5-10 seconds
```

#### Reverting Cancellation

```
IF cancellation was mistake:

Step 1: Open campaign record
├─► Navigate: x_cadso_work_campaign
└─► Click: Affected campaign

Step 2: Check previous_state
├─► Scroll to: previous_state JSON field
├─► Note: What was the old state?
│   └─ Example: 30 (WIP)
└─► Note: Are there wasCampaignCanceled flags in projects?

Step 3: Manually restore
├─► Update campaign.state = [old value from previous_state]
│   └─ Example: Set back to 30
│
├─► Save
│
└─► Flow 3 triggers again:
    ├─► Updates all projects back to 30
    └─► Same cascade happens in reverse

Step 4: Verify restoration
├─► Check: All projects back to previous state
├─► Check: Projects have restored end_date handling
└─► Check: Tasks aware of new parent state

✅ CAMPAIGN RESTORED

Notes:
- previous_state JSON tracks restoration data
- Can only restore to states that were saved
- Projects with flags know they were affected
- Works because state history is preserved
```

#### Risk Mitigation

```
Before canceling campaign:
□ Notify all project stakeholders
□ Get authorization from campaign owner
□ Document reason in campaign description
□ Check: Are any projects in critical phase?
□ Backup campaign data (screenshot/export)
□ Note: Flow 3 will be logged in System Logs

After canceling campaign:
□ Verify: All projects show state = 70
□ Verify: No error messages
□ Verify: Flow execution successful
□ Inform team of cancellation
□ Plan: What happens to active work
□ Update: Any related dashboards/reports
```

---

### Runbook: Archive Campaign (Historical Record)

**Time Required:** 1-2 minutes
**Risk Level:** MEDIUM
**Cascading:** TOP-DOWN (projects cascade)
**Reversible:** YES (via previous_state)

#### When to Use

```
Use Archive when:
- Campaign completed and moving to history
- Want to keep record but mark inactive
- Need to clean up active campaign list
- Plan to reference later for metrics
- Want to prevent accidental updates
```

#### Steps

```
Step 1: Open campaign record
├─► Navigate to x_cadso_work_campaign
└─► Click campaign name

Step 2: Verify campaign is ready to archive
├─► Check: Are projects still in progress?
│   └─ Archive will propagate to projects
├─► Check: Are tasks still open?
│   └─ Archive will propagate to tasks
└─► BEST PRACTICE: Close everything first
    └─► Then archive as final step

Step 3: Update state field
├─► Click state field
├─► Select: 333 (Archived)
└─► Note: Different from Cancel (70)
    └─► Archive = save for history
    └─► Cancel = don't do this work

Step 4: Click "Save"
├─► BR1 fires (BEFORE):
│   └─► Saves campaign.previous_state = {
│       old_state: 40 or 30,
│       timestamp: now,
│       archived: true,
│       }
│
├─► Record updated: campaign.state = 333
│
└─► Flow 3 triggers:
    ├─► Updates ALL projects to state 333
    └─► All projects marked archived

Step 5: Verify archive
├─► Check campaign:
│   └─► state = 333 ✓
│   └─► previous_state = populated ✓
│
├─► Check all projects:
│   └─► state = 333 ✓
│
└─► Check all tasks:
    └─► May show archived status ✓

✅ CAMPAIGN ARCHIVED

Properties of Archived Records:
- Still visible in lists (filtered by "Archived" checkbox)
- Can still be queried and reported on
- Can be unarchived later if needed
- Help identify historical work
- Reduce clutter in active campaign list
```

#### Unarchiving Campaign

```
IF campaign needs to be reactivated:

Step 1: Open archived campaign
├─► Navigate: x_cadso_work_campaign
├─► Check: Include archived records checkbox
└─► Find and click: Campaign to restore

Step 2: Check previous_state
├─► Note: What was the state before archiving?
└─► You can restore to that state

Step 3: Update state field
├─► Click state field
├─► Select: Previous state
│   └─ Example: 40 (Closed Complete)
│   └─ Or: 30 (WIP) if was being worked on
└─► Or select: New desired state

Step 4: Click "Save"
├─► Flow 3 triggers
└─► All projects updated to new state

Step 5: Update projects if needed
├─► Check: Are project states correct?
├─► Fix: Any projects that need different state
└─► Ensure: Hierarchy is consistent

✅ CAMPAIGN UNARCHIVED

Notes:
- Archiving doesn't delete data
- All relationships preserved
- Can unarchive at any time
- previous_state preserves history
- Good for "undo" functionality
```

---

## 5. CASCADING ISSUES

### Troubleshooting: Campaign Won't Auto-Close

**Symptoms:** All projects/tasks completed, but campaign still shows WIP

#### Diagnosis

```
STEP 1: Verify Flow 1 is enabled
├─► Navigate: System Applications → Flow Designer
├─► Search: "Close Campaign on All Associated Projects"
├─► Check: Status = "Published" (not Draft or Inactive)
└─► If disabled: CRITICAL - Re-publish immediately

STEP 2: Check project states
├─► Navigate: x_cadso_work_project
├─► Filter: campaign = [your campaign]
├─► For EACH project:
│   ├─► Check: state is in terminal list?
│   │   └─► Terminal states: 40, 70, 6, 333
│   └─► If any NOT terminal:
│       └─► This is the problem!
│       └─► Mark that project as terminal first
└─► Note: Need ALL projects in terminal state

STEP 3: Check project status codes
├─► Open each project
├─► Verify: state field shows:
│   ├─► 40 = Completed ✓
│   ├─► 70 = Canceled ✓
│   ├─► 6 = Rejected ✓
│   └─► 333 = Archived ✓
└─► If showing 30 (In Progress): NOT terminal!

STEP 4: Check Flow 2 execution
├─► Navigate: System Logs → Flow Designer
├─► Search: "close_project_on_all_associated_tasks"
├─► Look for RECENT execution (last 5 mins)
├─► If NO execution found:
│   └─► Flow 2 might not have triggered
│   └─► Manually update project to terminal state
└─► If error in log:
    └─► Check error message for issue

STEP 5: Check Flow 1 execution
├─► Navigate: System Logs → Flow Designer
├─► Search: "auto_close_campaigns"
├─► Look for RECENT execution
├─► If error: See "Fix" section below

STEP 6: Verify terminal task states
├─► Navigate: x_cadso_work_task
├─► Filter: project = [any unclosed project]
├─► For EACH task:
│   └─► Check status:
│       ├─► Closed Complete ✓
│       ├─► Closed Incomplete ✓
│       ├─► Closed Skipped ✓
│       └─► If Open: FOUND ISSUE
└─► If any task is "Open": Project won't close
```

#### Fix

```
SCENARIO A: Projects exist, but one is NOT terminal
└─► FIX: Update that project to terminal state
    └─► Open project
    └─► Set state = 40 (Completed)
    └─► Save
    └─► Flow 2 will check ALL projects
    └─► Flow 1 will auto-close campaign

SCENARIO B: Projects have open tasks
└─► FIX: Close all remaining tasks
    └─► Mark all tasks as Closed Complete/Incomplete/Skipped
    └─► This triggers Flow 2 on project
    └─► Project auto-closes
    └─► Campaign auto-closes

SCENARIO C: Flow 1 is disabled
└─► FIX: Re-publish flow
    └─► Navigate: Flow Designer
    └─► Open: "Close Campaign on All Associated Projects"
    └─► Check: Status = Published
    └─► If Draft or Inactive: Click "Publish"
    └─► Manually trigger by updating a project

SCENARIO D: Multiple campaigns affected
└─► FIX: Run bulk job
    └─► Batch-update all terminal projects
    └─► Let flows execute
    └─► Monitor System Logs for completion
    └─► Verify campaigns auto-closed
```

---

### Troubleshooting: Campaign Cancellation Not Cascading

**Symptoms:** Canceled campaign, but projects still showing WIP

#### Diagnosis

```
STEP 1: Verify Flow 3 is enabled
├─► Navigate: System Applications → Flow Designer
├─► Search: "Cancel Projects - Campaign - Cancellation"
├─► Check: Status = "Published"
└─► If disabled: Re-publish immediately

STEP 2: Check campaign state
├─► Navigate: x_cadso_work_campaign
├─► Open: Affected campaign
├─► Check: state field
├─► Verify: state = 70 (Canceled)
│   └─ Note: Only 70, 22, 333 propagate
│   └─ If state = 40: Won't cascade!
└─► If different: Fix state first

STEP 3: Check Flow 3 logs
├─► Navigate: System Logs → Flow Designer
├─► Search: "cancel_campaign"
├─► Look for RECENT execution
├─► Check: Status (Success vs Error)
└─► If error: See "Fix" section below

STEP 4: Manually verify projects
├─► Navigate: x_cadso_work_project
├─► Filter: campaign = [affected campaign]
├─► For EACH project:
│   ├─► Check: state = 70 (Canceled) ?
│   └─► If different:
│       └─ Flow didn't execute
│       └─ Manual fix needed
└─► Note: May need refresh

STEP 5: Check for in-progress flows
├─► Flow might still be running
├─► Go back to Step 3, check timestamps
├─► If from 30+ seconds ago: Should be done
├─► If from < 5 seconds ago: Still running, wait
└─► Refresh campaign after waiting
```

#### Fix

```
SCENARIO A: Flow 3 is disabled
└─► FIX: Enable and re-run
    └─► Navigate: Flow Designer
    └─► Open: "Cancel Campaign Projects"
    └─► Status = Published
    └─► Go back to campaign
    └─► Update state = 70 again (triggers flow)

SCENARIO B: Campaign state not in propagation list
└─► Propagation states: 70 (Cancel), 22 (On Hold), 333 (Archive)
└─► FIX: Set campaign.state = one of these values
    └─► Ensure decimal point correct
    └─► Save
    └─► Flow 3 will execute

SCENARIO C: Manual cascade (if flow broken)
└─► FIX: Update projects manually
    └─► Navigate: x_cadso_work_project
    └─► Filter: campaign = [campaign ID]
    └─► Bulk edit: Set all state = 70
    └─► Save
    └─► Check: All projects now state = 70

SCENARIO D: Database connection issue
└─► FIX: Contact system admin
    └─► Check: Database connectivity
    └─► Check: GlideRecord permissions
    └─► Verify: BR and flow access
    └─► Retry: Update campaign state again
```

---

## 6. QUICK REFERENCE CHECKLIST

### Pre-Operation Checklist

```
Before any significant operation:

PREPARATION:
□ Understand current state of records
□ Notify affected stakeholders
□ Document reason for change
□ Verify all flows are enabled
□ Check system logs are working
□ Have rollback plan ready

VERIFICATION:
□ Confirm: All prerequisites met
□ Confirm: No errors in browser console
□ Confirm: System is not under maintenance
□ Confirm: Database connectivity OK
□ Confirm: All related records accessible

SAFETY:
□ Export/screenshot important data first
□ Know: What previous_state contains
□ Know: How to revert the operation
□ Know: What cascading effects to expect
□ Know: System admin contact for emergencies
```

### Post-Operation Checklist

```
After any significant operation:

IMMEDIATE:
□ Verify: Operation completed without errors
□ Check: All affected records updated
□ Review: Flow Designer logs for success
□ Confirm: Cascade completed as expected
□ Note: actual_end_date values set correctly

SHORT-TERM (within 5 minutes):
□ Refresh records and verify state
□ Check: No orphaned or inconsistent records
□ Verify: Budget aggregation correct
□ Verify: Segment assignments correct
□ Check: System logs for any errors

FOLLOW-UP (next business day):
□ Verify: All cascading effects completed
□ Review: Any impacts on dependent processes
□ Update: Any dashboards/reports
□ Notify: Stakeholders of completion
□ Document: What was changed and why
```

---

**Last Updated:** November 14, 2025
**Version:** 1.0
**Status:** Complete

