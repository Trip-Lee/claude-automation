# Example 1: Create Incident Validation Rule

## Scenario
Create a business rule that validates priority is set when severity is High, preventing users from creating incidents without proper prioritization.

## What You'll Learn
- Using AI to analyze requirements
- Building operation plans
- CRUD auto-detection in action
- Validating before deployment

---

## Step 1: Analyze the Request

**Command:**
```bash
node sn-ai-operations-cli.js analyze "create a business rule that validates priority is set when severity is High"
```

**Expected Output:**
```
Analyzing request: create a business rule that validates priority is set when severity is High

Suggested Operations:
  1. create_business_rule (High confidence)
     Description: Create a new server-side Business Rule
     Complexity: Medium

Analysis complete!
Confidence: high
Suggestion: Use 'create_business_rule' operation
```

**What Happened:**
- AI detected keywords: "business rule", "validates"
- Matched to `create_business_rule` operation with high confidence
- Determined complexity level: Medium

---

## Step 2: Get Operation Guidance

**Command:**
```bash
node sn-ai-operations-cli.js guidance create_business_rule
```

**Expected Output:**
```
Operation Guidance: create_business_rule

Template Structure:
  Table: sys_script
  Required Fields:
    - name: Business Rule name
    - table: Target table (e.g., incident, change_request)
    - when: Execution timing (before, after, async, display)
    - script: JavaScript code to execute

  Optional Fields:
    - active: Enable/disable the rule (default: true)
    - order: Execution order (default: 100)
    - condition: When to run (GlideQuery format)
    - action_insert: Run on insert operations
    - action_update: Run on update operations
    - action_delete: Run on delete operations
    - action_query: Run on query operations

Available Tools:
  - tableExists(table): Check if table exists
  - getTableSchema(table): Get table structure
  - getReferenceTarget(table, field): Find reference targets
  - validatePlan(operation, plan): Validate before execution
```

**What Happened:**
- Retrieved template structure for business rules
- Listed all available fields and their purposes
- Showed available AI tools for validation

---

## Step 3: Build the Operation Plan

**Create input file: `incident-validation.json`**
```json
{
  "name": "Validate Priority When Severity is High",
  "table": "incident",
  "when": "before",
  "script": "(function executeRule(current, previous /*null when async*/) {\n  // Check if severity is High (value 1)\n  if (current.severity == '1' && current.getValue('priority') == '') {\n    gs.addErrorMessage('Priority must be set when Severity is High');\n    current.setAbortAction(true);\n  }\n})(current, previous);",
  "active": true,
  "order": 100
}
```

**Command:**
```bash
node sn-ai-operations-cli.js plan create_business_rule --input incident-validation.json
```

**Expected Output:**
```
Building operation plan for: create_business_rule

✓ Loaded user input from incident-validation.json
✓ Template loaded
✓ CRUD Auto-Detection analyzing script...

CRUD Analysis Results:
  Operations Detected:
    - READ: current.severity (field: severity)
    - READ: current.getValue('priority') (field: priority)
    - UPDATE: current.setAbortAction(true) (operation: abort)

  Recommendations:
    - action_insert: false (no insert operations detected)
    - action_update: true (read operations suggest validation on update)
    - action_delete: false (no delete operations)
    - action_query: false (no query operations)

  Auto-Applied Configuration:
    ✓ Set action_update = true (was unset)
    ✓ Set action_insert = true (validation should run on create too)

Operation Plan Created:
  Operation: create_business_rule
  Description: Create a new server-side Business Rule

  Data to be created:
    sys_script:
      name: "Validate Priority When Severity is High"
      table: "incident"
      when: "before"
      active: true
      order: 100
      action_insert: true   ← Auto-detected
      action_update: true   ← Auto-detected
      script: [347 characters]

  Steps:
    1. Validate table exists: incident
    2. Create business rule record in sys_script
    3. Verify creation successful

Plan saved to: operation-plan-create_business_rule-1699385234.json
```

**What Happened:**
- Loaded user input from JSON file
- Merged with template structure
- **CRUD Auto-Detection** analyzed the script and detected:
  - READ operations on `severity` and `priority` fields
  - UPDATE operation (`setAbortAction`)
  - Automatically set `action_insert = true` and `action_update = true`
- Generated complete operation plan
- Saved plan to file for review

---

## Step 4: Validate the Plan

**Command:**
```bash
node sn-ai-operations-cli.js validate create_business_rule --plan operation-plan-create_business_rule-1699385234.json
```

**Expected Output:**
```
Validating operation plan...

Validation Results:

✓ Schema Validation: PASS
  - sys_script table exists
  - All required fields present
  - Field types match schema

✓ Runtime Validation: PASS
  - Table 'incident' exists
  - Script syntax is valid JavaScript
  - Execution timing 'before' is valid
  - Order value is numeric (100)

✓ Pre-execution Checks: PASS
  - No naming conflicts found
  - CRUD flags are consistent with script
  - Performance impact: Low (validation rule)

⚠ Warnings:
  - This business rule will run on EVERY insert/update of incident records
  - Consider adding a condition to limit execution scope
  - Suggested condition: severity=1 (High severity only)

Validation Status: PASS WITH WARNINGS
Recommendation: Review warnings before deployment
```

**What Happened:**
- Validated against ServiceNow schema
- Checked table and field existence
- Validated JavaScript syntax
- Detected performance considerations
- Provided optimization suggestions

---

## Step 5: Review and Refine (Optional)

Based on the warning, let's add a condition to improve performance:

**Update `incident-validation.json`:**
```json
{
  "name": "Validate Priority When Severity is High",
  "table": "incident",
  "when": "before",
  "condition": "severity=1",
  "script": "(function executeRule(current, previous) {\n  if (current.getValue('priority') == '') {\n    gs.addErrorMessage('Priority must be set when Severity is High');\n    current.setAbortAction(true);\n  }\n})(current, previous);",
  "active": true,
  "order": 100,
  "action_insert": true,
  "action_update": true
}
```

**Changes Made:**
- Added `condition: "severity=1"` - only runs when severity is High
- Simplified script (no need to check severity in code)
- Explicitly set action flags based on CRUD analysis

**Re-validate:**
```bash
node sn-ai-operations-cli.js plan create_business_rule --input incident-validation.json
node sn-ai-operations-cli.js validate create_business_rule --plan operation-plan-create_business_rule-1699385567.json
```

**Expected Output:**
```
✓ All checks PASS
✓ No warnings
Status: READY FOR DEPLOYMENT
```

---

## Step 6: Deploy to ServiceNow

**Manual Deployment (Recommended):**
1. Open ServiceNow Studio
2. Navigate to Business Rules
3. Click "New"
4. Copy values from your plan:
   - Name: "Validate Priority When Severity is High"
   - Table: incident
   - When: before
   - Condition: severity=1
   - Insert: ✓ (checked)
   - Update: ✓ (checked)
   - Script: [paste from plan]
5. Save
6. Test with an incident record

**Alternative: API Deployment (Advanced)**
```bash
# Use sn-operations.js to deploy
node sn-operations.js create --plan operation-plan-create_business_rule-1699385567.json
```

---

## Step 7: Verify Deployment

**Test Cases:**

1. **Create incident with High severity and no priority:**
   - Expected: Error message "Priority must be set when Severity is High"
   - Expected: Record creation blocked

2. **Create incident with High severity and priority:**
   - Expected: Record created successfully
   - Expected: No error message

3. **Update incident to High severity without priority:**
   - Expected: Error message
   - Expected: Update blocked

4. **Create incident with Low severity and no priority:**
   - Expected: Record created (rule doesn't run)

---

## Monitoring

**View execution metrics:**
```bash
node sn-ai-monitor-cli.js summary
```

**Check for errors:**
```bash
node sn-ai-monitor-cli.js errors
```

**View operation history:**
```bash
node sn-ai-monitor-cli.js report
```

---

## Key Takeaways

✅ **CRUD Auto-Detection Working:**
   - Automatically detected READ and UPDATE operations
   - Suggested appropriate action flags
   - Saved manual configuration effort

✅ **AI-Assisted Validation:**
   - Caught performance issue before deployment
   - Suggested optimization (condition clause)
   - Validated syntax and schema compliance

✅ **Complete Workflow:**
   - From natural language request to deployment
   - Multiple validation checkpoints
   - Clear feedback at each step

---

## Next Steps

- **Example 2:** Create a priority escalation button (UI Action)
- **Example 3:** Build a custom REST API endpoint
- **Example 4:** Bulk analyze existing scripts for CRUD patterns

---

## Troubleshooting

**Problem:** "Table not found: incident"
- **Solution:** Check connection to correct ServiceNow instance (dev vs prod)

**Problem:** "Validation failed: Missing required field"
- **Solution:** Review the template guidance and ensure all required fields are provided

**Problem:** "CRUD detection returned no results"
- **Solution:** Ensure script is provided and contains actual CRUD operations

**Problem:** "Permission denied"
- **Solution:** Check credentials in sn-config.json and verify role permissions

---

## Related Documentation

- [NEW_FEATURES_GUIDE.md](../NEW_FEATURES_GUIDE.md) - Complete feature documentation
- [QUICK_REFERENCE.md](../QUICK_REFERENCE.md) - CLI command cheat sheet
- [AI_TOOLS_GUIDE.md](../AI_TOOLS_GUIDE.md) - AI system documentation
