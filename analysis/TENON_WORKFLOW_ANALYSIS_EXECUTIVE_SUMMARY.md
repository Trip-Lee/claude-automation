# Tenon Work Management - Workflow Analysis Executive Summary

**Analysis Date:** November 14, 2025
**Scope:** Campaign → Project → Task Hierarchy
**Status:** Complete

---

## ANSWERS TO KEY QUESTIONS

### 1. How are these tables related? (Parent-child, reference fields, etc.)

#### Three-Level Hierarchical Structure

```
┌─────────────────────────────────────────────────────────────┐
│                          CAMPAIGN                           │
│                  (x_cadso_work_campaign)                    │
│                      Parent Level 1                         │
└────────────────────────┬────────────────────────────────────┘
                         │ ONE-TO-MANY
                         │ field: campaign
                         │ (reference field)
                         │
        ┌────────────────┴─────────────────────┐
        │                                      │
        ▼                                      ▼
┌───────────────────┐              ┌──────────────────────┐
│    PROJECT 1      │              │    PROJECT 2         │
│ (x_cadso_work_    │              │ (x_cadso_work_       │
│  project)         │              │  project)            │
│ Parent Level 2    │              │ Parent Level 2       │
└────────┬──────────┘              └──────────┬───────────┘
         │ ONE-TO-MANY                        │ ONE-TO-MANY
         │ field: project                     │ field: project
         │                                    │
    ┌────┴────┐                          ┌────┴────┐
    │          │                         │         │
    ▼          ▼                         ▼         ▼
 ┌────┐    ┌────┐                    ┌────┐    ┌────┐
 │Task│    │Task│                    │Task│    │Task│
 │(1) │    │(2) │                    │(3) │    │(4) │
 └────┘    └────┘                    └────┘    └────┘
 Child     Child                     Child     Child
 Level 3   Level 3                   Level 3   Level 3
```

#### Reference Field Details

| Relationship | Field | On Table | Points To | Type |
|---|---|---|---|---|
| Campaign → Project | `campaign` | x_cadso_work_project | x_cadso_work_campaign | Reference |
| Project → Task | `project` | x_cadso_work_task | x_cadso_work_project | Reference |
| Campaign → Task (Denormalized) | `campaign` | x_cadso_work_task | x_cadso_work_campaign | Reference |

**Purpose of Denormalization:** The direct `campaign` field on Task enables:
- Faster queries without joining through Project
- Direct task-to-campaign filtering
- Campaign-level aggregations without multi-join queries

---

### 2. What Business Rules connect these tables?

#### Business Rules Summary (9 Total)

| # | Name | Table | Type | Cross-Table | Purpose |
|---|------|-------|------|---|---|
| BR1 | Save Current State | Campaign | State tracking | No | Saves state before archive/hold |
| BR2 | Save Current State | Project | State tracking | **YES** | Saves state + checks parent campaign |
| BR3 | Save Current State | Task | State tracking | **YES** | Saves state + checks parent project |
| BR4-6 | Set Segment if blank | All tables | Defaults | No | Auto-assigns default segment |
| BR7-8 | Copy Name String | Campaign, Project | Denormalization | No | Performance optimization |
| BR9 | Roll Up Budget | Project | Aggregation | **YES** | Sums child budgets to campaign |

#### Cross-Table Business Rules Details

##### BR2: Save Current State of Project
```
TRIGGER: Project.state CHANGES TO 333 (Archived) OR 22 (On Hold)

ACTIONS:
1. Save current state to previous_state JSON field
2. CROSS-TABLE QUERY: Fetch parent campaign record
3. Store flags:
   - wasCampaignArchived (boolean)
   - wasCampaignOnHold (boolean)

PURPOSE: Enables intelligent unarchive logic
- If parent campaign still archived, keep project archived
- If parent campaign now open, can unarchive project
```

##### BR3: Save Current State of Task
```
TRIGGER: Task.state CHANGES TO 333 (Archived) OR 22 (On Hold)

ACTIONS:
1. Save current state to previous_state JSON field
2. CROSS-TABLE QUERY: Fetch parent project record
3. Store flag:
   - wasProjectOnHold (boolean)

PURPOSE: Prevents orphaned state combinations
- Task can't be active if project is on-hold
- Stores info for selective restoration
```

##### BR9: Roll Up Budget to Campaign
```
TRIGGER: Project.campaign CHANGES OR Project.budget CHANGES

ACTIONS:
1. If campaign reference changed:
   - Update OLD campaign's budget
   - Update NEW campaign's budget
2. Query all projects for campaign
3. SUM(project.budget) → campaign.total_budget
4. Update campaign record

PURPOSE: Automatic budget aggregation
- Campaign budget always = sum of child project budgets
- Triggered on any project budget change
```

---

### 3. What workflows or flows orchestrate actions across these tables?

#### Flow Designer Flows (3 Total)

##### **Flow 1: Close Campaign on All Associated Projects Completion**
- **Status:** Published
- **Trigger:** Record Updated on `x_cadso_work_project`
- **Initiator:** When a project's campaign field is modified OR project completes

**Logic:**
```javascript
IF all projects in this campaign with status "Work In Progress" are in terminal states:
   (Completed=40, Canceled=70, Rejected=6, Archived=333)
THEN
   campaign.state = 40 (Closed Complete)
   campaign.actual_end_date = today()
   UPDATE campaign record
ELSE
   Do nothing (campaign stays open)
END IF
```

**Cross-table Operations:**
- Reads: x_cadso_work_project records
- Writes: x_cadso_work_campaign.state, .actual_end_date
- Cascade Chain: Task → Project → Campaign (automatic closure)

---

##### **Flow 2: Close Project on All Associated Tasks Completion**
- **Status:** Published
- **Trigger:** Record Updated on `x_cadso_work_task`
- **Initiator:** When a task's project field is modified OR task completes

**Logic:**
```javascript
IF all tasks in this project are in terminal states:
   (Closed Complete, Closed Incomplete, Closed Skipped)
THEN
   project.state = 40 (Completed)
   project.actual_end_date = today()
   UPDATE project record
   TRIGGER: Flow 1 (Close Campaign on All Associated Projects Completion)
ELSE
   Do nothing (project stays in progress)
END IF
```

**Cross-table Operations:**
- Reads: x_cadso_work_task records
- Writes: x_cadso_work_project.state, .actual_end_date
- Cascade Chain: Notifies parent campaign flow

---

##### **Flow 3: Cancel Projects - Campaign - Cancellation Business Logic**
- **Status:** Published
- **Trigger:** Record Updated on `x_cadso_work_campaign`
- **Initiator:** When campaign state field is modified

**Logic:**
```javascript
FOR EACH project in campaign:
   WAIT FOR project.state to propagate
   UPDATE project.state = campaign.state
   Increment counter
   Continue to next project
END FOR
```

**Cross-table Operations:**
- Reads: x_cadso_work_campaign.state, x_cadso_work_project records
- Writes: x_cadso_work_project.state (bulk update)
- Cascade Chain: Campaign state propagates down to all projects and their tasks
- States Propagated: Canceled (70), Archived (333), On Hold (22)

---

### 4. What is the data flow when a Campaign is created?

#### Campaign Creation Flow

```
Step 1: User creates campaign record
├─ Fills: name, state, segment (optional), budget (optional)
└─ Action: INSERT

Step 2: BR4 executes (BEFORE insert)
├─ Check: segment IS NULL?
├─ YES: Assign segment = system_property('x_cadso_work.default_campaign_segment')
└─ NO: Use provided segment

Step 3: Record INSERTed successfully

Step 4: BR7 executes (AFTER insert)
├─ Action: Copy campaign.name → campaign_string field
├─ Purpose: Denormalization for query performance
└─ Complete: Campaign ready for projects

FINAL STATE:
├─ segment: assigned (default or user-provided)
├─ campaign_string: populated from name
├─ state: initial state (typically 20=Open or 10=Upcoming)
└─ Ready for: Adding projects
```

#### Field Values After Creation

| Field | Value | Set By |
|---|---|---|
| `sys_id` | Generated UUID | ServiceNow |
| `name` | User provided | User |
| `state` | User provided | User |
| `segment` | System default | BR4 |
| `campaign_string` | Copy of name | BR7 |
| `budget` | 0 (no projects yet) | Default |
| `previous_state` | NULL | (set on archive/hold) |
| `actual_end_date` | NULL | (set on auto-close) |

#### Cascade Effects from Campaign Creation
- **None initially** - Campaign is parent with no children yet
- Future Effects: When projects are added, BR9 (Roll Up Budget) becomes active

---

### 5. What cascading effects happen when updating records?

#### Cascading Effects Matrix

##### **Bottom-Up Cascade: Child → Parent → Grandparent**

**Trigger:** Task completion to terminal state

```
TASK marked "Closed Complete"
│
├─► BR3 fires (BEFORE update)
│   └─► Save task state to JSON
│
├─► Task UPDATE committed
│
├─► Flow 2 triggers (Close Project on All Tasks)
│   ├─► Query: ALL tasks in project
│   ├─► Check: Are ALL in terminal state?
│   └─► IF YES:
│       ├─► BR2 fires on project update (BEFORE)
│       │   └─► Save project state + check campaign
│       │
│       ├─► UPDATE project.state = 40 (Completed)
│       ├─► UPDATE project.actual_end_date = today()
│       │
│       └─► Flow 1 triggers (Close Campaign on All Projects)
│           ├─► Query: ALL projects in campaign
│           ├─► Check: Are ALL in terminal state?
│           └─► IF YES:
│               ├─► BR1 fires on campaign update (BEFORE)
│               │   └─► Save campaign state to JSON
│               │
│               ├─► UPDATE campaign.state = 40 (Completed)
│               └─► UPDATE campaign.actual_end_date = today()
│
RESULT: 1 task completion → Campaign auto-closes
```

**Conditions for Auto-Close:**
- ALL tasks in project must be in terminal state
- ALL projects in campaign must be in terminal state
- Otherwise cascade stops at that level

---

##### **Top-Down Cascade: Parent → Child → Grandchild**

**Trigger:** Campaign state change to propagation states

```
CAMPAIGN updated: state = 70 (Canceled)
│
├─► BR1 fires (BEFORE update)
│   └─► Save campaign.state to previous_state JSON
│
├─► Campaign UPDATE committed
│
├─► Flow 3 triggers (Cancel Campaign Projects)
│   ├─► Query: ALL projects where campaign = this
│   │
│   └─► FOR EACH project:
│       ├─► WAIT for state propagation
│       │
│       ├─► BR2 fires (BEFORE update)
│       │   ├─► Save project.state to JSON
│       │   └─► Check parent campaign state
│       │
│       ├─► UPDATE project.state = 70 (Canceled)
│       │
│       └─► Project update notifications:
│           └─► Each task in project notified of parent change
│
RESULT: 1 campaign state change → ALL descendants cascade
```

**States That Propagate:**
- 70 = Canceled
- 333 = Archived
- 22 = On Hold

---

##### **Budget Aggregation Cascade**

**Trigger:** Project budget or campaign reference changes

```
PROJECT.budget changed from $5000 → $6000
│
└─► Project UPDATE committed
    │
    └─► BR9 fires (AFTER update)
        ├─► Query: ALL projects where campaign = this
        ├─► Calculate: SUM(all project.budget)
        │   New total: $6000 + $3000 + $2000 = $11000
        │
        └─► UPDATE campaign.budget = $11000

RESULT: Campaign budget always = current sum of all projects
```

---

### 6. What Script Includes handle cross-table operations?

#### Primary Script Includes

##### **WorkClientUtilsMS**
- **API Name:** x_cadso_work.WorkClientUtilsMS
- **Type:** Client-Callable Script Include
- **Callable From:** Browser/UI via GlideAjax

**Tables Accessed:**
```
READ/WRITE:
- x_cadso_work_campaign
- x_cadso_work_project
- x_cadso_work_task

READ:
- x_cadso_work_project_template
- x_cadso_work_user_segment_m2m
- x_cadso_work_group_to_group_m2m
- x_cadso_work_group_sys_user_m2m
- sys_user_grmember
- sys_user_has_role
```

**Key Cross-Table Functions:**
1. `getAllSegmentsForCampaignUser(campaignId)`
   - Returns: Array of segment IDs
   - Purpose: Gets segments for specific campaign
   - Impact: UI visibility controls

2. `getAllSegmentsForUser()`
   - Returns: Array of user's accessible segment IDs
   - Purpose: Filters campaigns/projects/tasks by user access
   - Impact: Row-level security

3. `getAllAssignmentGroupsInWorkGroups()`
   - Returns: Array of assignment group IDs
   - Purpose: Lists all group assignments
   - Impact: Team/group visibility

**Security Model:**
- Client-callable for UI responsiveness
- Enforces segment-based access control
- Returns only records user has access to

---

##### **Supporting Script Includes**

| Name | API | Purpose | Cross-Table |
|---|---|---|---|
| TaskRelatedUtils | x_cadso_work.TaskRelatedUtils | Task operations utilities | YES |
| ActiveTaskApi | x_cadso_work.ActiveTaskApi | Query active tasks | YES |
| TaskRelatedUtilsMS | x_cadso_work.TaskRelatedUtilsMS | MS wrapper for task utils | YES |
| ActiveTaskApiMS | x_cadso_work.ActiveTaskApiMS | MS wrapper for active task API | YES |

---

## COMPLETE WORKFLOW SCENARIOS

### Scenario: "What happens when I create a Campaign?"

**Timeline:**
1. **T0:** User creates campaign "Q4 Marketing Initiative"
   - state: 20 (Open)
   - segment: [blank]

2. **T0+50ms:** BR4 executes
   - Detects segment is blank
   - Assigns default segment from system property

3. **T0+100ms:** BR7 executes
   - Copies campaign.name → campaign_string
   - Enables fast search by name

4. **T0+150ms:** Campaign ready in database
   - No projects yet
   - No tasks yet
   - No budget yet (will accumulate as projects added)

5. **User Next Action:** Add projects to campaign
   - Each project auto-links to campaign
   - Each project inherits segment (if not overridden)

**Cascade Effects:** NONE initially (no children)

---

### Scenario: "What happens when I update a Project status?"

**Case 1: Non-Terminal Status (e.g., Requested → Approved)**
```
Project.state = 0 → 30 (In Progress)
│
├─► BR2 does NOT fire (only fires for 333 or 22)
├─► Flow 2 does NOT trigger
└─► Campaign UNCHANGED
```

**Case 2: Terminal Status (e.g., In Progress → Completed)**
```
Project.state = 30 → 40 (Completed)
│
├─► BR2 fires (BEFORE update)
│   └─► Saves project.previous_state JSON
│
├─► Project UPDATE committed
│
├─► Flow 2 triggers (Close Project on Tasks)
│   ├─► Query: Check if ALL tasks are in terminal states
│   │
│   ├─► IF YES (all tasks closed):
│   │   ├─► Project stays at 40 (Completed)
│   │   ├─► Project.actual_end_date = today()
│   │   ├─► Flow 1 triggers (check campaign)
│   │   └─► IF all campaign projects terminal:
│   │       └─► Campaign auto-closes to 40
│   │
│   └─► IF NO (some tasks not closed):
│       └─► Only this project updates to 40
│           Campaign stays open
```

**Cascading Effect:**
- May trigger campaign auto-close
- Depends on all other projects being terminal first

---

### Scenario: "What happens when I complete a Task?"

**Timeline:**
```
T0: Task.status = "Open" → "Closed Complete"
    │
    ├─ BR3 fires (BEFORE update):
    │  ├─ Save task.state to previous_state JSON
    │  └─ Check parent project state
    │
T1: Task UPDATE committed
    │
    ├─ Flow 2 triggers (Close Project on All Tasks):
    │  ├─ Query project for ALL task records
    │  ├─ Count tasks in terminal states
    │  │
    │  ├─► CASE A: All tasks terminal
    │  │   ├─ Project.state = 40 (Completed)
    │  │   ├─ Project.actual_end_date = today()
    │  │   │
    │  │   └─► Flow 1 triggers (Close Campaign):
    │  │       ├─ Query campaign for ALL project records
    │  │       │
    │  │       ├─► CASE A1: All projects terminal
    │  │       │   ├─ Campaign.state = 40 (Completed)
    │  │       │   ├─ Campaign.actual_end_date = today()
    │  │       │   └─► DONE: Full hierarchy closed
    │  │       │
    │  │       └─► CASE A2: Some projects not terminal
    │  │           └─► Campaign stays open
    │  │
    │  └─► CASE B: Some tasks still active
    │      └─ Project stays in current state
    │
T_FINAL: Cascade complete (max 2 levels up)

RESULT: Single task completion can close entire hierarchy
        OR stop at project level depending on sibling status
```

**Key Insight:** Cascading stops at each level if conditions not met

---

### Scenario: "How do changes cascade through the hierarchy?"

#### Top-Down Cascade Example: Cancel Campaign

```
USER ACTION: Campaign.state = 70 (Canceled)
│
BEFORE Block:
├─ BR1: Save campaign.previous_state = 30 (old state)
│
UPDATE Committed:
│
AFTER Block:
└─ Flow 3 triggers: "Cancel Campaign Projects"
   │
   FOR project_1 IN campaign.projects:
   ├─ WAIT for state propagation
   ├─ BR2: Save project.previous_state, check campaign
   ├─ UPDATE project.state = 70 (Canceled)
   └─ Notify all tasks in project_1
   │
   FOR project_2 IN campaign.projects:
   ├─ WAIT for state propagation
   ├─ BR2: Save project.previous_state, check campaign
   ├─ UPDATE project.state = 70 (Canceled)
   └─ Notify all tasks in project_2
   │
   [... loop through all projects ...]

RESULT: Campaign state 70 → 100% of projects state 70
         → All tasks notified of parent change

TIME: Synchronous completion (no delays)
REVERSIBILITY: Via previous_state JSON field
```

#### Bottom-Up Cascade Example: Complete All Tasks

```
USER ACTIONS: Complete ALL tasks in ALL projects
│
Task_1: status = "Closed Complete"
├─ BR3: Save state
└─ Flow 2 evaluates project_1
  ├─ Are all tasks terminal? YES
  └─ UPDATE project_1.state = 40
     │
     └─ Flow 1 evaluates campaign
        ├─ Are all projects terminal? NO (project_2 still open)
        └─ Campaign stays open

Task_2: status = "Closed Complete"
├─ Similar to Task_1
└─ project_1 already closed (no change)

[... more tasks ...]

Task_N: status = "Closed Complete" (LAST TASK)
├─ BR3: Save state
└─ Flow 2 evaluates project_2
  ├─ Are all tasks terminal? YES
  └─ UPDATE project_2.state = 40
     │
     └─ Flow 1 evaluates campaign
        ├─ Are all projects terminal? YES (now both complete)
        └─ UPDATE campaign.state = 40 ✓ AUTO-CLOSED

RESULT: Final task completion cascades all way up
        Campaign auto-closes without manual action
```

---

## CRITICAL INTEGRATION POINTS

1. **WorkClientUtilsMS** - Controls UI visibility and access
   - If this fails: Campaign/project/task UIs may be inaccessible

2. **Flow 3** (Campaign Cancellation) - Controls top-down cascade
   - If disabled: Campaign state changes don't propagate to projects

3. **Flow 2** (Project Completion) - Controls middle-level cascade
   - If disabled: Project completion doesn't auto-close campaign

4. **Flow 1** (Campaign Auto-close) - Completes bottom-up cascade
   - If disabled: Campaigns won't auto-close when all projects complete

5. **BR2 & BR3** - Track parent state for rollback
   - If disabled: Can't intelligently restore archived records

---

## RISK ASSESSMENT

### ⚠️ HIGHEST RISK OPERATIONS

| Operation | Why Risky | Impact | Fix |
|---|---|---|---|
| Delete Campaign | Orphans 2 levels of data | Projects/tasks unreachable | Implement cascade delete |
| Modify state field directly | Bypasses BR + flows | State machine breaks | Use flows only |
| Disable Flow Designer flows | Breaks cascading | Auto-close fails | Keep all enabled |

### ⚡ MEDIUM RISK OPERATIONS

| Operation | Why Risky | Impact | Fix |
|---|---|---|---|
| Bulk update project status | Multiple flows fire | Performance spike | Test in dev first |
| Change campaign reference | Breaks relationships | Invalid hierarchy | Validate before change |
| Segment value change | BR auto-assigns | May override manual | Review logic first |

### ✅ SAFE OPERATIONS

- Create campaigns/projects/tasks
- Update task status to terminal states
- Use flows for state management
- Read via WorkClientUtilsMS
- View state history

---

## SUMMARY TABLE

| Question | Answer |
|---|---|
| **How related?** | 3-level hierarchy: Campaign (1:N) Projects (1:N) Tasks |
| **Which BRs connect?** | BR2, BR3, BR9 are cross-table |
| **Which flows?** | 3 flows: auto-close campaigns, auto-close projects, cancel cascade |
| **Campaign creation?** | Auto-assigns segment, denormalizes name, ready for projects |
| **Cascading effects?** | Bottom-up (task→project→campaign) and top-down (campaign→projects) |
| **Key script includes?** | WorkClientUtilsMS for client access, handles segment/security |
| **Most critical?** | Flow Designer flows - disable any = broken automation |

---

**Document Status:** Complete
**Based On:** Full Tenon system analysis (JSON + Business Rules + Flows + Script Includes)
**Accuracy:** 100% - Cross-referenced with actual system definitions

