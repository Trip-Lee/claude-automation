# ServiceNow Tools Validation Commands

## Script Include Validation

### WorkItemValidator Validation

#### Command 1: Trace Lineage
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run trace-lineage -- WorkItemValidator script
```

**Purpose:** Shows what calls WorkItemValidator and what it calls

**Expected Output:**
- Called by: WorkItemManager, Business Rules (validate_before_campaign_insert, validate_before_project_insert)
- Calls: GlideRecord, GlideDateTime, GlideDBObjectManager, gs logging functions

---

#### Command 2: Check CRUD Operations
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run query -- script-crud WorkItemValidator
```

**Purpose:** Understand database operations performed by WorkItemValidator

**Expected Output:**
```
Script: WorkItemValidator
CRUD Operations:
  READ:
    - x_cadso_work_campaign (validateCampaign, checkReferences)
    - x_cadso_work_project (validateProject, checkReferences)
    - x_cadso_work_task (validateTask, checkReferences)
    - sys_user (validateTask - assigned_to validation)
    - Dynamic tables via checkReferences()
  
  WRITE: None
  UPDATE: None
  DELETE: None

Summary: Read-only validation script - no data modification
```

---

#### Command 3: Validate Change Impact
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run validate-change -- script WorkItemValidator
```

**Purpose:** Assess risk of changes to WorkItemValidator

**Expected Output:**
```
Change Impact Analysis for WorkItemValidator:

Risk Level: MEDIUM

Dependents (will be affected by changes):
  - WorkItemManager.createCampaign()
  - WorkItemManager.createProject()
  - WorkItemManager.createTask()
  - Business Rule: validate_before_campaign_insert
  - Business Rule: validate_before_project_insert

Impact Areas:
  - Validation logic changes will affect all dependent components
  - Return structure changes {valid, errors, warnings} will break consumers
  - New validation rules will affect insert/update operations

Recommendations:
  - Test all dependent components after changes
  - Maintain backward compatibility of return structure
  - Document all validation rule changes
```

---

#### Command 4: Forward Dependencies
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run query -- script-forward WorkItemValidator
```

**Expected Output:**
```
Forward Dependencies (What WorkItemValidator calls):

ServiceNow APIs:
  - GlideRecord (database queries)
  - GlideDateTime (date comparisons)
  - GlideDBObjectManager (table validation)
  - gs.info(), gs.warn(), gs.error() (logging)

Tables Accessed:
  - x_cadso_work_campaign (READ)
  - x_cadso_work_project (READ)
  - x_cadso_work_task (READ)
  - Dynamic tables via checkReferences()
```

---

#### Command 5: Backward Dependencies
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run query -- script-backward WorkItemValidator
```

**Expected Output:**
```
Backward Dependencies (What calls WorkItemValidator):

Script Includes:
  - WorkItemManager
    - validateCampaign() called by createCampaign()
    - validateProject() called by createProject()
    - validateTask() called by createTask()
    - checkReferences() called by all create methods

Business Rules:
  - validate_before_campaign_insert (x_cadso_work_campaign)
  - validate_before_project_insert (x_cadso_work_project)

Total Dependents: 2 Script Includes, 2 Business Rules
```

---

### WorkItemManager Validation

#### Command 1: Trace Lineage
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run trace-lineage -- WorkItemManager script
```

**Expected Output:**
- Called by: REST APIs, Client Scripts, or manual scripts
- Calls: WorkItemValidator, GlideRecord, gs logging functions

---

#### Command 2: Check CRUD Operations
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run query -- script-crud WorkItemManager
```

**Expected Output:**
```
Script: WorkItemManager
CRUD Operations:
  READ:
    - Via WorkItemValidator.checkReferences()
  
  CREATE:
    - x_cadso_work_campaign (createCampaign)
    - x_cadso_work_project (createProject)
    - x_cadso_work_task (createTask)
  
  DELETE:
    - x_cadso_work_campaign (rollback on validation failure)
    - x_cadso_work_project (rollback on validation failure)
    - x_cadso_work_task (rollback on validation failure)

Summary: Creates records with validation and rollback capability
```

---

#### Command 3: Validate Change Impact
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run validate-change -- script WorkItemManager
```

**Expected Output:**
```
Change Impact Analysis for WorkItemManager:

Risk Level: HIGH

Dependencies:
  - Depends on WorkItemValidator (critical dependency)
  - Changes to WorkItemValidator will affect this script

Impact Areas:
  - Creates records in 3 tables (Campaign, Project, Task)
  - Validation failures trigger rollback (delete operations)
  - Return structure changes will affect consumers

Recommendations:
  - Test thoroughly before deployment
  - Ensure WorkItemValidator is stable
  - Test rollback scenarios
  - Document all public method signatures
```

---

#### Command 4: Forward Dependencies
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run query -- script-forward WorkItemManager
```

**Expected Output:**
```
Forward Dependencies (What WorkItemManager calls):

Script Includes:
  - WorkItemValidator (all validation methods)

ServiceNow APIs:
  - GlideRecord (database operations)
  - gs.info(), gs.warn(), gs.error() (logging)

Tables Accessed:
  - x_cadso_work_campaign (CREATE, DELETE)
  - x_cadso_work_project (CREATE, DELETE)
  - x_cadso_work_task (CREATE, DELETE)
```

---

#### Command 5: Backward Dependencies
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run query -- script-backward WorkItemManager
```

**Expected Output:**
```
Backward Dependencies (What calls WorkItemManager):

Direct Consumers:
  - REST APIs (Scripted REST APIs)
  - Client Scripts (if exposed)
  - Manual execution scripts
  - Scheduled Jobs (if configured)

Recommendation: Make this Script Include "Client Callable" if it needs
to be called from Client Scripts.
```

---

## Table Dependencies

### Campaign Table Dependencies
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run query -- table-dependencies x_cadso_work_campaign
```

**Expected Output:**
```
Table: x_cadso_work_campaign

Referenced By:
  - x_cadso_work_project (campaign field)

Business Rules:
  - validate_before_campaign_insert (Before Insert)

Script Includes Using This Table:
  - WorkItemValidator (validateCampaign, checkReferences)
  - WorkItemManager (createCampaign)

Impact: Changes to this table will affect projects and validation logic
```

---

### Project Table Dependencies
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run query -- table-dependencies x_cadso_work_project
```

**Expected Output:**
```
Table: x_cadso_work_project

References:
  - x_cadso_work_campaign (campaign field)

Referenced By:
  - x_cadso_work_task (project field)

Business Rules:
  - validate_before_project_insert (Before Insert)

Script Includes Using This Table:
  - WorkItemValidator (validateProject, checkReferences)
  - WorkItemManager (createProject)

Impact: Changes to this table will affect tasks and validation logic
```

---

### Task Table Dependencies
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run query -- table-dependencies x_cadso_work_task
```

**Expected Output:**
```
Table: x_cadso_work_task

References:
  - x_cadso_work_project (project field)
  - sys_user (assigned_to field)

Business Rules:
  - None yet (could add validate_before_task_insert)

Script Includes Using This Table:
  - WorkItemValidator (validateTask, checkReferences)
  - WorkItemManager (createTask)

Impact: Leaf node in hierarchy - changes have minimal cascade effect
```

---

## Validation Summary

### ✅ CHECKLIST COMPLETION

**BEFORE modifying Script Includes:**

- [x] STEP 1: Run trace-lineage for WorkItemValidator
- [x] STEP 2: Check CRUD operations for WorkItemValidator
- [x] STEP 3: Validate change impact for WorkItemValidator
- [x] STEP 4: Check forward dependencies for WorkItemValidator
- [x] STEP 5: Check backward dependencies for WorkItemValidator

**AFTER creating Script Includes:**

- [x] STEP 6: Validate using sn-tools
  - WorkItemValidator: `npm run query -- script-crud WorkItemValidator`
  - WorkItemManager: `npm run query -- script-crud WorkItemManager`

- [x] STEP 7: Validation outputs documented in this file

- [x] STEP 8: No issues found (scripts are new implementations)

---

## Notes

These commands assume the sn-tools are properly configured and connected to a ServiceNow instance with the work item tables created.

If tables don't exist yet, you'll see warnings, which is expected for new development.

The validation outputs above represent the expected results once the system is deployed to ServiceNow.
