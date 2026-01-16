# Tenon Work Management - Visual Reference Guide

**Quick diagrams and visual maps for understanding the system**

---

## Table of Contents
1. Entity Relationships
2. Cascade Flows
3. State Machines
4. Business Rule Execution Order
5. Data Flow Patterns
6. Quick Lookup Tables

---

## 1. ENTITY RELATIONSHIPS

### Full Hierarchy Diagram

```
                    ┌─────────────────────────────┐
                    │      CAMPAIGN               │
                    │  (x_cadso_work_campaign)    │
                    │   Level: 1 (Root)           │
                    │  Relationships:             │
                    │  - 1:N → Project            │
                    │  - 1:N → Task (direct)      │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │ field: campaign (ref)      │
                    │ field: campaign (denorm)   │
                    │                             │
        ┌───────────▼──────────┐    ┌────────────▼─────────┐
        │    PROJECT A         │    │    PROJECT B         │
        │ (x_cadso_work_       │    │ (x_cadso_work_       │
        │  project)            │    │  project)            │
        │ Level: 2 (Middle)    │    │ Level: 2 (Middle)    │
        │ Parent: Campaign     │    │ Parent: Campaign     │
        └───────────┬──────────┘    └────────────┬─────────┘
                    │                             │
        ┌───────────┴─────┐        ┌────────────┴──────────┐
        │ field: project  │        │ field: project       │
        │                 │        │                      │
    ┌───▼──┐  ┌──────┐   │   ┌────▼───┐  ┌─────────┐
    │Task 1│  │Task 2│   │   │Task 3  │  │ Task 4  │
    │(C,P)│  │(C,P) │   │   │(C,P)   │  │ (C,P)   │
    └──────┘  └──────┘   │   └────────┘  └─────────┘
                         │
        Level 3:    Children of Project A/B
                    Parent: Project A/B
                    Grandparent: Campaign
```

### Reference Fields Quick Map

```
x_cadso_work_campaign (CAMPAIGN)
├─ PK: sys_id
├─ Reference: segment → x_cadso_work_segment
└─ Children: (pointed to by project.campaign, task.campaign)

x_cadso_work_project (PROJECT)
├─ PK: sys_id
├─ FK: campaign → x_cadso_work_campaign
├─ Reference: segment → x_cadso_work_segment
└─ Children: (pointed to by task.project)

x_cadso_work_task (TASK)
├─ PK: sys_id
├─ FK: project → x_cadso_work_project
├─ FK: campaign → x_cadso_work_campaign (denormalized)
└─ Reference: segment → x_cadso_work_segment
```

---

## 2. CASCADE FLOWS

### Bottom-Up Cascade (Task Completion → Campaign Auto-Close)

```
                    ┌─────────────────────────────┐
                    │  USER: Complete Task        │
                    │  task.status = "Closed..."  │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │ BR3: Save Current State     │
                    │ ✓ Save state to JSON        │
                    │ ✓ Check parent project      │
                    │ ✓ Store wasProjectOnHold    │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │ TASK UPDATE COMMITTED       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │ Flow 2: Check Project       │
                    │ - Query all tasks in proj   │
                    │ - Are ALL terminal? ← KEY   │
                    └──────────────┬──────────────┘
                                   │
                   ┌───────────────┴────────────────┐
                   │ ALL TASKS TERMINAL?            │
                   └───┬───────────────────────────┬┘
                       │                           │
                      YES                         NO
                       │                           │
            ┌──────────▼──────────┐       ┌────────▼─────────┐
            │ UPDATE Project      │       │ STOP             │
            │ state = 40          │       │ Project stays    │
            │ actual_end_date =   │       │ in current state │
            │ today()             │       │                  │
            └──────────┬──────────┘       └──────────────────┘
                       │
            ┌──────────▼──────────┐
            │ Flow 1: Check       │
            │ Campaign            │
            │ - Query all projs   │
            │ - Are ALL terminal? │
            └──────────┬──────────┘
                       │
           ┌───────────┴────────────┐
           │ ALL PROJECTS TERMINAL? │
           └───┬─────────────────┬─┘
               │                 │
              YES               NO
               │                 │
      ┌────────▼────────┐   ┌────▼─────────┐
      │ UPDATE Campaign │   │ STOP         │
      │ state = 40      │   │ Campaign     │
      │ actual_end_date │   │ stays open   │
      │ = today()       │   │              │
      └────────┬────────┘   └──────────────┘
               │
      ┌────────▼────────────────┐
      │ ✓ CASCADE COMPLETE      │
      │ Entire hierarchy closed │
      │ No manual work needed   │
      └─────────────────────────┘
```

### Top-Down Cascade (Campaign Cancellation)

```
                    ┌──────────────────────────┐
                    │ USER: Cancel Campaign    │
                    │ campaign.state = 70      │
                    └──────────────┬───────────┘
                                   │
                    ┌──────────────▼──────────┐
                    │ BR1: Save Current State │
                    │ ✓ Save state to JSON    │
                    └──────────────┬──────────┘
                                   │
                    ┌──────────────▼──────────┐
                    │ CAMPAIGN UPDATE COMMIT  │
                    └──────────────┬──────────┘
                                   │
                    ┌──────────────▼────────────────┐
                    │ Flow 3: Cancel Campaign Proj  │
                    │ - Query all projects          │
                    │ - FOR EACH project:           │
                    └──────────────┬────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
    ┌───▼──────────┐          ┌───▼──────────┐          ┌───▼──────────┐
    │ Project 1    │          │ Project 2    │          │ Project N    │
    └───┬──────────┘          └───┬──────────┘          └───┬──────────┘
        │                         │                        │
        │ FOR EACH proj:          │                        │
        ├─ BR2: Save state        ├─ BR2: Save state      ├─ BR2: Save state
        ├─ Check campaign         ├─ Check campaign       ├─ Check campaign
        │                         │                        │
    ┌───▼──────────────────┐  ┌───▼──────────────────┐  ┌───▼──────────────────┐
    │ UPDATE proj.state=70 │  │ UPDATE proj.state=70 │  │ UPDATE proj.state=70 │
    │ actual_end_date=...  │  │ actual_end_date=...  │  │ actual_end_date=...  │
    └───┬──────────────────┘  └───┬──────────────────┘  └───┬──────────────────┘
        │                         │                        │
        ├─ All tasks notified      ├─ All tasks notified   ├─ All tasks notified
        │  of parent change        │  of parent change     │  of parent change
        │                         │                        │
        └─────────────┬───────────┴────────────┬──────────┘
                      │
            ┌─────────▼─────────────┐
            │ ✓ CASCADE COMPLETE    │
            │ ALL descendants = 70  │
            │ All tasks aware       │
            └──────────────────────┘
```

---

## 3. STATE MACHINES

### Campaign State Machine

```
                           ┌─────────────────────────┐
                           │     [START]             │
                           │   (No campaign)         │
                           └────────────┬────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │  UPCOMING (10)   │
                              │ · Projects added │
                              │ · No tasks yet   │
                              └────────┬─────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │ User sets state                     │
                    ▼                                     ▼
           ┌──────────────────┐              ┌──────────────────┐
           │  OPEN (20)       │◄────────────►│ ON HOLD (22)     │
           │ · Ready to work  │              │ · Paused work    │
           │ · Projects running              │ · Save state JSON│
           └────────┬─────────┘              └──────┬───────────┘
                    │                              │
                    └──────────────┬───────────────┘
                                   │
                        ┌──────────▼──────────┐
                        │ WIP (30)            │
                        │ · Active work       │
                        │ · Projects updating │
                        └──────────┬──────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │ All projects terminal?      │
                    │ (Auto-close by Flow 1)      │
                    ▼                             ▼
           ┌──────────────────┐    ┌──────────────────────┐
           │ CLOSED           │    │ ARCHIVED (333)       │
           │ COMPLETE (40)    │    │ · Save state JSON    │
           │ · Auto-set       │    │ · Unarchive capable  │
           │ · actual_end_date│    │                      │
           └────────┬─────────┘    └──────────┬───────────┘
                    │                        │
                    │ User could also        │
                    │ manually set:          │
                    ▼                        ▼
           ┌──────────────────┐    ┌──────────────────┐
           │ CLOSED           │    │ CLOSED           │
           │ INCOMPLETE (50)  │    │ SKIPPED (60)     │
           │                  │    │                  │
           └──────────────────┘    └──────────────────┘

        Legend:
        ↔ = Reversible (user can go back)
        ⟹ = Auto-triggered
        [Numbered states] = ServiceNow choice field codes
```

### Project State Machine

```
                        ┌──────────────────┐
                        │  PLANNING (-10)  │
                        │ · Initial state  │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │ REQUESTED (0)    │
                        │ · Awaiting approval
                        └────────┬─────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           ┌──────────────────┐   ┌──────────────────┐
           │ UPCOMING (10)    │   │ REJECTED (6)     │
           │ · Approved       │   │ · Terminal       │
           │ · Scheduled      │   │ · Counts toward  │
           └────────┬─────────┘   │   campaign close │
                    │             └──────────────────┘
                    │ User starts work
                    ▼
           ┌──────────────────┐
           │ ON HOLD (22)     │◄────────┐
           │ · Paused         │         │ User pauses
           │ · Save state JSON│         │
           └────────┬─────────┘    ┌────┴──────────┐
                    │              │               │
                    │              │               ▼
                    │          ┌───┴──────────────────┐
                    │          │ IN PROGRESS (30)    │
                    │          │ · Active tasks      │
                    │          │ · Tasks completing  │
                    │          └────────┬────────────┘
                    │                   │
                    │ All tasks terminal?
                    │ (Auto-close by Flow 2)
                    │                   │
                    └───────────┬───────┘
                                ▼
                    ┌──────────────────────────┐
                    │ Check all tasks state    │
                    │                          │
                    ├─ All Closed Complete    │
                    ├─ All Closed Incomplete  │
                    ├─ All Closed Skipped     │
                    └────┬──────────────┬─────┘
                         │              │
                        YES             NO
                         │              │
            ┌────────────▼────────┐ ┌──▼──────────┐
            │ AUTO-CLOSE TO (40)  │ │ Stay open   │
            │ COMPLETED           │ │ Continue    │
            │ ✓ Set end_date      │ │ working     │
            │ ✓ Trigger Flow 1    │ └─────────────┘
            └────────┬────────────┘
                     │
        Or user can manually set:
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    ┌──────┐    ┌──────┐    ┌──────────┐
    │CANCEL│    │ARCHIVE   │(333)      │
    │(70)  │    │(333)  │    │Save state│
    └──────┘    └──────┘    │JSON      │
                             └──────────┘
```

### Task Status Machine

```
                    ┌──────────────────┐
                    │ OPEN             │
                    │ · Active         │
                    │ · Work ongoing   │
                    └────────┬─────────┘
                             │
             ┌───────────────┴────────────────┐
             │ User marks task complete       │
             ▼                                 ▼
    ┌──────────────────────┐    ┌──────────────────────┐
    │ CLOSED COMPLETE      │    │ CLOSED INCOMPLETE    │
    │ · Task succeeded     │    │ · Task abandoned     │
    │ · (Flow 2 checks)    │    │ · (Flow 2 checks)    │
    │ · Counts for project │    │ · Counts for project │
    │   close              │    │   close              │
    └──────┬───────────────┘    └──────┬───────────────┘
           │                           │
           └───────────────┬───────────┘
                           │
                           ▼
            ┌──────────────────────────┐
            │ OR user skips task       │
            └───────────┬──────────────┘
                        │
                        ▼
            ┌──────────────────────────┐
            │ CLOSED SKIPPED           │
            │ · Task not applicable    │
            │ · (Flow 2 checks)        │
            │ · Counts for project     │
            │   close                  │
            └──────────┬───────────────┘
                       │
        All terminal states ▼
    ┌─────────────────────────────────────┐
    │ IF all tasks in project terminal:   │
    │   ⟹ Flow 2 auto-closes project (40) │
    │   ⟹ Flow 1 checks campaign          │
    │   ⟹ If all projects terminal:       │
    │      Campaign auto-closes (40)      │
    └─────────────────────────────────────┘

    Legend:
    • Flow 2 = "Close Project on All Associated Tasks"
    • Flow 1 = "Close Campaign on All Associated Projects"
```

---

## 4. BUSINESS RULE EXECUTION ORDER

### Create Campaign (INSERT)

```
┌────────────────────────────────────────┐
│ 1. User INSERTs new campaign record    │
└────────────────────────────────────────┘
                    ▼
        ┌─────────────────────────┐
        │ BEFORE INSERT triggers  │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │ BR4: Set Segment        │
        │ if blank                │
        │ segment = default       │
        └────────────┬────────────┘
                     │
┌────────────────────▼────────────────────┐
│ INSERT executed (record now in DB)      │
└────────────────────┬────────────────────┘
                     │
        ┌────────────▼────────────┐
        │ AFTER INSERT triggers   │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │ BR7: Copy Name String   │
        │ campaign_string =       │
        │ campaign.name           │
        └────────────┬────────────┘
                     │
┌────────────────────▼────────────────────┐
│ Campaign ready to use                   │
│ ✓ segment assigned                      │
│ ✓ campaign_string populated             │
│ Ready for projects to be added          │
└─────────────────────────────────────────┘
```

### Update Campaign State to Archive (UPDATE)

```
┌────────────────────────────────────────┐
│ 1. User sets campaign.state = 333      │
└────────────────────────────────────────┘
                    ▼
        ┌─────────────────────────┐
        │ BEFORE UPDATE triggers  │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────────────────┐
        │ BR1: Save Current State             │
        │ if state → 333 OR 22                │
        │   previous_state = JSON({           │
        │     old_state: 30,                  │
        │     timestamp: now,                 │
        │     ...metadata                     │
        │   })                                │
        └────────────┬──────────────┬─────────┘
                     │              │
        ┌────────────▼──────────────────────┐
        │ BR2-BR8: Other rules (no trigger) │
        │ (These don't fire for this update)│
        └────────────┬──────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│ UPDATE executed (record updated in DB)  │
└────────────────────┬────────────────────┘
                     │
        ┌────────────▼────────────────┐
        │ AFTER UPDATE triggers       │
        └────────────┬────────────────┘
                     │
        ┌────────────▼────────────────┐
        │ Flow 3 triggers:            │
        │ Cancel Campaign Projects    │
        │ (state change detected)     │
        │                             │
        │ Loop through all projects:  │
        │ - BR2 fires for each        │
        │ - Update each to state 333  │
        │ - Notify all tasks          │
        └────────────┬────────────────┘
                     │
┌────────────────────▼────────────────────┐
│ Cascade complete                        │
│ ✓ Campaign archived                     │
│ ✓ All projects archived                 │
│ ✓ All tasks notified                    │
└─────────────────────────────────────────┘
```

---

## 5. DATA FLOW PATTERNS

### Budget Aggregation Flow

```
Project A budget changes: $5000 → $6000
│
├─ Triggers BR9: "Roll Up Budget to Campaign"
│
└─ Query: Campaign.getAllProjects()
   │
   ├─ Project A: $6000
   ├─ Project B: $3000
   ├─ Project C: $2000
   │
   └─ SUM = $11000
      │
      └─ UPDATE campaign.budget = $11000

WHEN Triggered:
- Project budget field changes
- Project campaign reference changes
  (updates both old and new campaign)

RESULT: Campaign budget = SUM(all project budgets)
        Always in sync automatically
```

### Segment Assignment Flow

```
New Campaign created with segment = NULL
│
├─ BR4: "Set Segment if blank (Campaign)"
│
├─ Query: gs.getProperty('x_cadso_work.default_campaign_segment')
│  └─ Returns: 'seg_12345'
│
└─ UPDATE campaign.segment = 'seg_12345'

When used:
- WorkClientUtilsMS filters by campaign.segment
- Only shows campaigns user has access to
- UI visibility controlled by segment

Result: Segment-based access control
        Everyone has a segment
        No NULL values
```

---

## 6. QUICK LOOKUP TABLES

### State Code Reference

| Table | Code | Name | Terminal | Auto-close |
|---|---|---|---|---|
| Campaign | 10 | Upcoming | No | No |
| Campaign | 20 | Open | No | No |
| Campaign | 22 | On Hold | No | Yes* |
| Campaign | 30 | WIP | No | No |
| Campaign | 40 | Closed Complete | Yes | Trigger Flow 1 |
| Campaign | 50 | Closed Incomplete | Yes | No |
| Campaign | 60 | Closed Skipped | Yes | No |
| Campaign | 333 | Archived | Yes | Trigger Flow 3 |
| Project | -10 | Planning | No | No |
| Project | 0 | Requested | No | No |
| Project | 6 | Rejected | Yes | Trigger Flow 1 |
| Project | 10 | Upcoming | No | No |
| Project | 22 | On Hold | No | No |
| Project | 30 | In Progress | No | No |
| Project | 40 | Completed | Yes | Trigger Flow 1 |
| Project | 70 | Canceled | Yes | Trigger Flow 1 |
| Project | 333 | Archived | Yes | Trigger Flow 1 |

*: Saves state but doesn't auto-close campaign unless all projects also terminal

### Business Rule Priority Order

| Order | BR | Event | Executes |
|---|---|---|---|
| 1 | BR1,2,3,4,5,6 | BEFORE | Parallel |
| 2 | Record INSERT/UPDATE | - | Physical write |
| 3 | BR7,8,9 | AFTER | Sequential |
| 4 | Flow Triggers | - | Async |

### Cross-Table Operations Matrix

| From Table | To Table | BR/Flow | Operation | When |
|---|---|---|---|---|
| Campaign | Project | Flow 3 | UPDATE state | Campaign state change |
| Project | Campaign | Flow 1 | UPDATE state | All projects terminal |
| Project | Campaign | BR9 | UPDATE budget | Project budget change |
| Task | Project | Flow 2 | UPDATE state | All tasks terminal |
| Task | Project | BR3 | READ | Task archive/hold |
| Project | Campaign | BR2 | READ | Project archive/hold |

---

## CRITICAL RULES TO REMEMBER

### ✅ DO THIS

```
1. Update state via Flow Designer flows
   (Never direct field modification)

2. Use WorkClientUtilsMS for client access
   (Segment-based security included)

3. Test cascades in dev before production
   (Multiple flows fire simultaneously)

4. Monitor Flow 1, 2, 3 execution logs
   (Cascading effects tracked there)

5. Archive instead of delete
   (Preserves data, enables unarchive)
```

### ❌ DON'T DO THIS

```
1. Direct UPDATE of state field
   ✗ current.state = 333 (in script)
   ✓ Use flow to set state

2. Delete campaigns with projects
   ✗ Orphans all child records
   ✓ Archive or set to inactive

3. Disable Flow Designer flows
   ✗ Breaks auto-close mechanism
   ✓ Always keep enabled

4. Modify campaign reference directly
   ✗ Breaks budget aggregation
   ✓ Validate before changing

5. Bulk update without testing
   ✗ May trigger hundreds of flows
   ✓ Test in dev, use scheduled jobs
```

---

## FLOW TRIGGER CHECKLIST

### What Triggers What

```
Task status change:
└─► Flow 2: "Close Project on All Associated Tasks"

Project state change (to terminal):
└─► Flow 1: "Close Campaign on All Associated Projects"

Campaign state change (70, 22, 333):
└─► Flow 3: "Cancel Campaign Projects"

Project budget change:
└─► BR9: "Roll Up Budget to Campaign"

Project campaign reference change:
└─► BR9: "Roll Up Budget to Campaign" (both old & new)

Any record insert:
└─► BR4-6: "Set Segment if blank"

Campaign/Project name change:
└─► BR7-8: "Copy Name String"
```

---

**Last Updated:** November 14, 2025
**Accuracy:** Based on actual system configuration

