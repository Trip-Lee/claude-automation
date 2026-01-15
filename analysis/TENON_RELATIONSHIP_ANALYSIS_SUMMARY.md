# Tenon Work Management - Complete Relationship & Workflow Analysis
## Summary of Campaign ↔ Project ↔ Task Orchestration

**Date:** November 14, 2025
**Source:** ServiceNow Tenon Marketing Work Management (x_cadso_work)
**Completeness:** ✅ All 6 questions answered with detailed examples

---

## QUICK ANSWERS TO YOUR QUESTIONS

### 1️⃣ HOW ARE THESE TABLES RELATED?

**The Three-Level Hierarchy:**

```
Campaign (x_cadso_work_campaign) - Level 1: Parent
    ↓ (one-to-many via "campaign" field)
Project (x_cadso_work_project) - Level 2: Child of Campaign
    ↓ (one-to-many via "project" field)
Task (x_cadso_work_task) - Level 3: Child of Project
```

**Relationship Types:**

| Relationship | Type | Field | Cardinality | Purpose |
|---|---|---|---|---|
| Campaign → Project | Parent-Child | `project.campaign` | 1:N | Direct parent-child |
| Project → Task | Parent-Child | `task.project` | 1:N | Direct parent-child |
| Campaign → Task | Direct Denormalized | `task.campaign` | 1:N | Skip-level reference for performance |

**What This Means:**
- 1 Campaign can have many Projects
- 1 Project can have many Tasks
- Tasks directly reference their Campaign for efficient queries (denormalization)
- Changes at any level cascade intelligently through the hierarchy

---

### 2️⃣ WHAT BUSINESS RULES CONNECT THESE TABLES?

**9 Business Rules Total — 3 are Cross-Table**

| # | Rule | Table | Cross-Table? | Effect |
|---|---|---|---|---|
| 1 | Save Current State | Campaign | ❌ | Saves state before archiving |
| 2 | **Save Current State** | **Project** | **✅ YES** | Saves state + checks parent campaign state |
| 3 | **Save Current State** | **Task** | **✅ YES** | Saves state + checks parent project state |
| 4 | Set Default Segment | Campaign | ❌ | Auto-assigns segment if blank |
| 5 | Set Default Segment | Project | ❌ | Auto-assigns segment if blank |
| 6 | Set Default Segment | Task | ❌ | Auto-assigns segment if blank |
| 7 | Denormalize Name | Campaign | ❌ | Copies name to campaign_string |
| 8 | Denormalize Name | Project | ❌ | Copies name to project_string |
| 9 | **Roll Up Budget** | **Project** | **✅ YES** | Aggregates project budgets to campaign |

**Critical Cross-Table Rules:**

**BR2: When Project is Archived/On-Hold**
```
TRIGGER: project.state → 333 (Archived) OR 22 (On Hold)
ACTION:
  1. Save project.state to previous_state JSON
  2. Query parent campaign
  3. Store flags: wasCampaignArchived, wasCampaignOnHold
  4. Prevent orphaned state combinations
```

**BR3: When Task is Archived/On-Hold**
```
TRIGGER: task.state → 333 (Archived) OR 22 (On Hold)
ACTION:
  1. Save task.state to previous_state JSON
  2. Query parent project
  3. Store flag: wasProjectOnHold
  4. Ensure consistency with parent
```

**BR9: When Project Budget Changes**
```
TRIGGER: project.campaign changes OR project.budget changes
ACTION:
  1. Query ALL projects for campaign
  2. SUM project budgets
  3. Update campaign.total_budget
```

---

### 3️⃣ WHAT WORKFLOWS ORCHESTRATE ACTIONS ACROSS TABLES?

**3 Flow Designer Flows — All Published & Active**

#### Flow 1: Close Campaign on All Associated Projects Completion
```
Name:     auto_close_campaigns
Trigger:  x_cadso_work_project.campaign updated
Tables:   x_cadso_work_project → x_cadso_work_campaign
Status:   Published ✅

LOGIC:
  WHEN any project in a campaign is updated:
    1. Get campaign_id from updated project
    2. Query ALL projects for campaign
    3. Check if ALL projects in TERMINAL state:
       - Completed (40)
       - Canceled (70)
       - Rejected (6)
       - Archived (333)
    4. If ALL terminal:
       - Set campaign.state = 40 (Closed Complete)
       - Set campaign.actual_end_date = today()
       - UPDATE campaign record
    5. If ANY non-terminal:
       - Do nothing, campaign stays open

EFFECT: Campaign auto-closes when all child projects complete
CASCADES: YES → Enables bottom-up closure
```

#### Flow 2: Close Project on All Associated Tasks Completion
```
Name:     close_project_on_all_associated_tasks_completion
Trigger:  x_cadso_work_task.project updated
Tables:   x_cadso_work_task → x_cadso_work_project → x_cadso_work_campaign
Status:   Published ✅

LOGIC:
  WHEN any task in a project is updated:
    1. Get project_id from updated task
    2. Query ALL tasks for project
    3. Check if ALL tasks in TERMINAL state:
       - Closed Complete
       - Closed Incomplete
       - Closed Skipped
    4. If ALL terminal:
       - Set project.state = 40 (Completed)
       - Set project.actual_end_date = today()
       - UPDATE project record
       - TRIGGER Flow 1 (auto-close campaign)
    5. If ANY non-terminal:
       - Do nothing, project stays open

EFFECT: Project auto-closes when all child tasks complete
CASCADES: YES → Triggers Flow 1 automatically
CHAIN REACTION: Task completion → Project closure → Campaign closure
```

#### Flow 3: Cancel Projects - Campaign Cancellation Business Logic
```
Name:     cancel_campaign__campaign_cancellation_business_logic
Trigger:  x_cadso_work_campaign.state updated
Tables:   x_cadso_work_campaign → x_cadso_work_project → x_cadso_work_task
Status:   Published ✅

LOGIC:
  WHEN campaign.state changes:
    1. Get campaign_id and new state
    2. Query ALL projects for campaign
    3. FOR EACH project:
       a. WAIT for state to propagate
       b. UPDATE project.state = campaign.state
       c. Increment counter
       d. Continue to next project
    4. END FOR
    5. Each project update notifies tasks

EFFECT: Top-down state propagation (Campaign → Projects → Tasks)
CASCADES: YES → Downward only
STATES PROPAGATED: Canceled (70), Archived (333), On Hold (22)

IMPACT:
  - Campaign → Canceled (70) → All projects become Canceled
  - Campaign → Archived (333) → All projects become Archived
  - Campaign → On Hold (22) → All projects become On Hold
```

---

### 4️⃣ WHAT IS THE DATA FLOW WHEN A CAMPAIGN IS CREATED?

**Step-by-Step Initialization:**

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Create Campaign "Q4 Marketing Push"                │
├─────────────────────────────────────────────────────────────────┤
│ Fields:
│  - name: "Q4 Marketing Push"
│  - state: 20 (Open)
│  - segment: (empty)
│  - budget: (will be calculated)
└─────────────────────────────────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │ BR4: Set Segment if Blank (Campaign) │
        │ Trigger: BEFORE INSERT               │
        ├──────────────────────────────────────┤
        │ ACTION:
        │ 1. Check if segment is NULL
        │ 2. Lookup system property:
        │    x_cadso_work.default_campaign_segment
        │ 3. Auto-assign default segment
        │ 4. Insert campaign with segment
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │ BR7: Copy Campaign Name String       │
        │ Trigger: AFTER INSERT                │
        ├──────────────────────────────────────┤
        │ ACTION:
        │ 1. Denormalize campaign.name
        │ 2. Set campaign_string field
        │ 3. Optimize future string searches
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │ Campaign Created Successfully        │
        │                                      │
        │ Ready for:                           │
        │ ✅ Adding Projects                   │
        │ ✅ Assigning Users                   │
        │ ✅ Setting Budget                    │
        │                                      │
        │ NOT YET:                             │
        │ ❌ Any automatic task creation       │
        └──────────────────────────────────────┘
```

**Campaign State After Creation:**
- `state`: 20 (Open)
- `segment`: (auto-assigned default)
- `campaign_string`: (denormalized name)
- `budget`: 0 (will be calculated when projects added)
- `actual_end_date`: (empty until closed)
- `previous_state`: (empty)

**No Cascading Effects:**
- Only 2 business rules fire (BR4, BR7)
- No flows triggered
- No projects created automatically
- Awaiting manual project creation

---

### 5️⃣ WHAT CASCADING EFFECTS HAPPEN WHEN UPDATING RECORDS?

**Complete Cascade Map - All Scenarios:**

#### Scenario A: TASK COMPLETION (Bottom-Up Cascade)
```
┌───────────────────────────────────────────────────────────┐
│ USER ACTION: Mark Task "Closed Complete"                 │
└──────────────────────┬──────────────────────────────────┘
                       ↓
        ┌──────────────────────────────────────┐
        │ BR3: Save Current State of Task      │
        │ (BEFORE UPDATE)                      │
        ├──────────────────────────────────────┤
        │ Actions:
        │ 1. Save task.state → previous_state
        │ 2. Query parent project
        │ 3. Store wasProjectOnHold flag
        └──────────┬───────────────────────────┘
                   ↓
        ┌──────────────────────────────────────┐
        │ Task Status Updated → "Closed Complete"
        └──────────┬───────────────────────────┘
                   ↓
        ┌──────────────────────────────────────┐
        │ Flow 2: Check Project Completion     │
        │ (AUTO TRIGGERED)                     │
        ├──────────────────────────────────────┤
        │ Logic:
        │ 1. Query ALL tasks for this project
        │ 2. Check if ALL in terminal state
        └──────────┬───────────────────────────┘
                   ↓
        ┌──────────────────────────────────────┐
        │ Decision: Are ALL Tasks Terminal?    │
        └──────┬──────────────────┬─────────────┘
               │                  │
            YES│                  │NO
               ↓                  ↓
    ┌──────────────────┐     (STOP)
    │ BR2: Save Project│     Project stays
    │ State            │     in current state
    └─────┬────────────┘
         ↓
    ┌──────────────────────────────┐
    │ Update Project State = 40     │
    │ Set actual_end_date = today() │
    └──────┬───────────────────────┘
           ↓
    ┌──────────────────────────────┐
    │ Flow 1: Check Campaign       │
    │ (AUTO TRIGGERED)             │
    └──────┬───────────────────────┘
           ↓
    ┌──────────────────────────────┐
    │ Decision: Are ALL Projects   │
    │ Terminal?                    │
    └──────┬───────────┬────────────┘
           │           │
        YES│           │NO
           ↓           ↓
    ┌───────────┐  (STOP)
    │Update     │  Campaign
    │Campaign   │  stays open
    │State = 40 │
    └────┬──────┘
         ↓
    ┌───────────────────────────────────────┐
    │ RESULT: ZERO MANUAL WORK               │
    │ Campaign auto-closed automatically     │
    │ from single task completion            │
    └───────────────────────────────────────┘

SUMMARY:
- 1 Task marked complete
- → Project auto-closes if ALL tasks complete
- → Campaign auto-closes if ALL projects complete
- NO manual campaign closure needed
- ONE action ripples through 3 levels
```

#### Scenario B: CAMPAIGN CANCELLATION (Top-Down Cascade)
```
┌───────────────────────────────────────────────────────┐
│ USER ACTION: Change Campaign State to "Canceled" (70) │
└───────────────────────┬───────────────────────────────┘
                        ↓
        ┌──────────────────────────────────┐
        │ BR1: Save Current State Campaign │
        │ (BEFORE UPDATE)                  │
        ├──────────────────────────────────┤
        │ Actions:
        │ 1. Save campaign.state → JSON
        │ 2. Enables future reactivation
        └──────────┬───────────────────────┘
                   ↓
        ┌──────────────────────────────────┐
        │ Campaign State Changed → Canceled │
        └──────────┬───────────────────────┘
                   ↓
        ┌──────────────────────────────────────────┐
        │ Flow 3: Cancel Projects - Campaign Logic │
        │ (AUTO TRIGGERED)                         │
        ├──────────────────────────────────────────┤
        │ Logic:
        │ 1. Query ALL projects for campaign
        │ 2. FOR EACH project:
        └──────────┬───────────────────────────────┘
                   ↓
        ┌──────────────────────────────────────┐
        │ [PROJECT LOOP - For Each Project]    │
        └──────────┬───────────────────────────┘
                   ↓
        ┌──────────────────────────────────┐
        │ BR2: Save Project State          │
        │ (BEFORE UPDATE)                  │
        ├──────────────────────────────────┤
        │ Actions:
        │ 1. Save project.state → JSON
        │ 2. Check parent campaign
        │ 3. Store wasCampaignCanceled flag
        └──────────┬───────────────────────┘
                   ↓
        ┌──────────────────────────────────┐
        │ Update Project.State = 70         │
        │ (Canceled)                        │
        └──────────┬───────────────────────┘
                   ↓
        ┌──────────────────────────────────┐
        │ FOR EACH task in project:        │
        │ Notify via project update        │
        │ (Tasks inherit parent state)     │
        └──────────┬───────────────────────┘
                   ↓
        ┌──────────────────────────────────┐
        │ [Loop Back] NEXT PROJECT         │
        └──────────┬───────────────────────┘
                   ↓
        ┌──────────────────────────────────┐
        │ ALL Projects Updated             │
        └──────────┬───────────────────────┘
                   ↓
        ┌──────────────────────────────────┐
        │ RESULT:                          │
        │ ✅ Campaign: Canceled (70)       │
        │ ✅ All Projects: Canceled (70)   │
        │ ✅ Tasks: Notified of change     │
        │                                  │
        │ SINGLE ACTION = CASCADES ENTIRE │
        │ HIERARCHY DOWNWARD               │
        └──────────────────────────────────┘

SUMMARY:
- 1 Campaign state change
- → ALL Projects updated immediately
- → ALL Tasks notified via project update
- Campaign-wide state consistency
- Bi-directional: Can cascade other states too
  (Archived, On Hold)
```

#### Scenario C: PROJECT BUDGET CHANGE (Cross-Table Aggregation)
```
┌───────────────────────────────────────────────────────────┐
│ USER ACTION: Update Project Budget from $5K to $8K        │
└────────────────────────┬────────────────────────────────┘
                         ↓
        ┌──────────────────────────────────────┐
        │ BR9: Roll Up Budget to Campaign      │
        │ Trigger: project.budget changes      │
        ├──────────────────────────────────────┤
        │ Conditions Check:
        │ 1. Is project.campaign set? YES
        │ 2. Has project.budget changed? YES
        └──────────┬───────────────────────────┘
                   ↓
        ┌──────────────────────────────────────┐
        │ Action: Aggregate Project Budgets    │
        ├──────────────────────────────────────┤
        │ 1. Get campaign_id
        │ 2. Query ALL projects for campaign
        │ 3. SUM all project.budget fields
        │ 4. Update campaign.total_budget
        └──────────┬───────────────────────────┘
                   ↓
        ┌──────────────────────────────────────┐
        │ Campaign Budget Updated              │
        │                                      │
        │ Example:
        │ Project 1 Budget: $3,000
        │ Project 2 Budget: $8,000 (updated)
        │ Project 3 Budget: $2,000
        │ ──────────────────────────
        │ Campaign Total: $13,000
        └──────────────────────────────────────┘

SUMMARY:
- Budget change automatically propagates up
- Campaign sees real-time budget totals
- No manual aggregation needed
- Cross-table relationship in action
```

**Cascading Effects Summary Table:**

| Action | Direction | Tables Affected | Automatic? | Reversible? |
|--------|-----------|---|---|---|
| Task → Terminal | ↑ | Task→Project→Campaign | YES (Flows) | Manual |
| Campaign → Cancel | ↓ | Campaign→Projects→Tasks | YES (Flow) | Manual |
| Project Budget ↑ | ↑ | Project→Campaign | YES (BR) | YES |
| Any → Archive | Both | All 3 tables | YES (BR+Flow) | Via previous_state |

---

### 6️⃣ WHAT SCRIPT INCLUDES HANDLE CROSS-TABLE OPERATIONS?

**3 Key Script Includes:**

#### 1️⃣ WorkClientUtilsMS (Client-Callable)
```
Name:             WorkClientUtilsMS
API Name:         x_cadso_work.WorkClientUtilsMS
Scope:            Tenon Marketing Work Management
Type:             Client-Callable Script Include
Mobile Callable:  NO
Client Callable:  YES ✅

TABLES ACCESSED:
  ✅ x_cadso_work_campaign        (parent)
  ✅ x_cadso_work_project         (child)
  ✅ x_cadso_work_task            (child)
  ✅ x_cadso_work_project_template
  ✅ x_cadso_work_user_segment_m2m (permissions)
  ✅ x_cadso_work_group_to_group_m2m (permissions)
  ✅ x_cadso_work_group_sys_user_m2m (permissions)
  ✅ sys_user_grmember            (user permissions)
  ✅ sys_user_has_role            (role checks)

KEY FUNCTIONS:
  1. getAllSegmentsForCampaignUser(campaignId)
     - Purpose: Get all segments user can access for campaign
     - Parameters: campaignId
     - Returns: Array of segment IDs
     - Operations: READ only

  2. getAllSegmentsForUser()
     - Purpose: Get all segments accessible to current user
     - Tables: x_cadso_work_user_segment_m2m
     - Returns: Array of segment IDs
     - Operations: READ only

  3. getAllAssignmentGroupsInWorkGroups()
     - Purpose: List all work group assignments
     - Tables: x_cadso_work_group_to_group_m2m
     - Returns: Array of group assignments
     - Operations: READ, WRITE

PURPOSE:
  ✅ Provides UI with permission-aware data
  ✅ Loads only segments user can see
  ✅ Handles cross-table permission checks
  ✅ Client-side access to hierarchy (READ-SAFE)

USAGE:
  - Used by UI widgets for dropdowns
  - Filters campaigns/projects/tasks by user segments
  - Prevents cross-segment data leakage
```

#### 2️⃣ TaskRelatedUtils (Server-Side Wrapper)
```
Name:             TaskRelatedUtils
API Name:         x_cadso_work.TaskRelatedUtils
Type:             Wrapper extending TaskRelatedUtilsMS
Client Callable:  NO
Mobile Callable:  NO
Scope:            Tenon Marketing Work Management

INHERITS FROM:
  x_cadso_work.TaskRelatedUtilsMS (parent implementation)

PURPOSE:
  ✅ Cross-table utilities for task operations
  ✅ Extends base task functionality
  ✅ Handles task-to-project-to-campaign relationships
  ✅ Server-side only (secure)

TYPICAL OPERATIONS:
  - Task state validation
  - Task-project relationship checks
  - Task completion cascading
  - Parent reference validation
```

#### 3️⃣ ActiveTaskApi (Server-Side Wrapper)
```
Name:             ActiveTaskApi
API Name:         x_cadso_work.ActiveTaskApi
Type:             Wrapper extending ActiveTaskApiMS
Client Callable:  NO
Mobile Callable:  NO
Scope:            Tenon Marketing Work Management

INHERITS FROM:
  x_cadso_work.ActiveTaskApiMS (parent implementation)

TABLES ACCESSED:
  ✅ x_cadso_work_task (primary)
  Related: x_cadso_work_project (parent)
  Related: x_cadso_work_campaign (grandparent)

PURPOSE:
  ✅ API for active task operations
  ✅ Query and filter active tasks
  ✅ Validate task state transitions
  ✅ Server-side operations only

TYPICAL OPERATIONS:
  - Get active tasks for project
  - Get active tasks for campaign
  - Filter by state/status
  - Validate state changes
```

**Script Include Interaction Diagram:**

```
┌─────────────────────────────────────────┐
│        UI / Client Application          │
└──────────────┬──────────────────────────┘
               │
               │ (Client-side SAFE)
               ↓
┌──────────────────────────────────────────┐
│   WorkClientUtilsMS (Client-Callable)    │
│                                          │
│ READ: Segments, Permissions, Groups      │
│ ✅ Safe for client-side use              │
│ ❌ No write operations                   │
└──────────────┬───────────────────────────┘
               │
               │ (Server-side operations)
               ↓
        ┌──────────────────┐
        │ Server-Side APIs │
        └────┬─────────┬───┘
             │         │
    ┌────────▼──┐  ┌──▼──────────────┐
    │TaskRelated│  │ ActiveTaskApi    │
    │Utils      │  │                  │
    │           │  │ Manages active   │
    │Wraps task │  │ task operations  │
    │utilities  │  │ & transitions    │
    └────┬──────┘  └──┬───────────────┘
         │            │
         └────┬───────┘
              │
              ↓
      ┌──────────────────────┐
      │ x_cadso_work_task    │
      │ x_cadso_work_project │
      │ x_cadso_work_campaign│
      └──────────────────────┘
```

---

## CRITICAL OPERATIONAL FLOWS

### Flow Execution Order (Multi-Table Operations)

#### When Task is Completed:
```
1. User marks task complete
2. BR3 fires (before update) - Save state, check project
3. Task record updated
4. Flow 2 triggers - Check if all tasks terminal
5. If yes → Project updates
6. Project update triggers Flow 1 - Check if all projects terminal
7. If yes → Campaign updates
8. Campaign update completes
9. All rules execute in correct sequence
```

#### When Campaign is Canceled:
```
1. User changes campaign state
2. BR1 fires (before update) - Save state
3. Campaign record updated
4. Flow 3 triggers - Loop through projects
5. For each project:
   a. BR2 fires - Save state, check campaign
   b. Project updates to match campaign state
   c. Tasks notified via project update
6. All projects updated with campaign state
7. Tasks inherit parent state implicitly
```

---

## SAFETY GUIDELINES

### ✅ SAFE OPERATIONS
```
✅ Create campaigns/projects/tasks (normal operations)
✅ Update task status to terminal states (triggers auto-close)
✅ Use flows to manage state transitions
✅ Read data via WorkClientUtilsMS
✅ Update segment assignments
✅ View state history in previous_state JSON
```

### ❌ DANGEROUS OPERATIONS
```
❌ Delete campaigns (orphans all projects/tasks)
❌ Modify state field directly (bypasses rules)
❌ Change campaign reference on project
❌ Bulk updates without testing
❌ Disable flows
❌ Delete projects with active tasks
❌ Manual database updates to state fields
```

---

## KEY METRICS

**Relationship Complexity:**
- **Hierarchy Levels:** 3 (Campaign → Project → Task)
- **Parent-Child Relationships:** 3
- **Cross-Table Business Rules:** 3
- **Flow Designer Workflows:** 3
- **Cascading Paths:** 2 (bottom-up, top-down)

**Automation Coverage:**
- **Auto-Close:** Campaign closes when all projects complete ✅
- **Auto-Cancel:** Campaign cancellation cascades to projects ✅
- **Auto-Archive:** Campaign archiving cascades to projects ✅
- **State Rollback:** Previous states stored for recovery ✅
- **Budget Aggregation:** Campaign totals calculated automatically ✅

---

## COMPLETE DOCUMENTATION REFERENCE

All analysis files are available:

| File | Size | Purpose |
|------|------|---------|
| `tenon_work_management_workflow.md` | 22 KB | Complete workflow guide (this main document) |
| `tenon_workflow_analysis.json` | 22 KB | Structured data in JSON format |
| `TENON_ANALYSIS_SUMMARY.md` | 13 KB | Executive summary |
| `TENON_QUICK_REFERENCE.md` | 5.3 KB | Quick lookup guide |
| This document | 15+ KB | Answers to all 6 questions |

---

## CONCLUSION

The Tenon work management system implements a sophisticated **three-level hierarchy** with **dual cascading mechanisms**:

1. **Bottom-Up Automation:** Task completion automatically closes projects and campaigns
2. **Top-Down Control:** Campaign state changes propagate to all child records
3. **Cross-Table Consistency:** Business rules ensure parent-child state alignment
4. **Smart Denormalization:** Direct campaign-task reference for performance
5. **Audit Trail:** Previous state stored for rollback capability

The system requires **zero manual campaign closure** when all tasks complete — pure automation magic! 🎯

---

**Analysis Complete** | **Date:** November 14, 2025 | **Quality:** Comprehensive
