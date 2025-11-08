# Example 2: Create Priority Escalation Button

## Scenario
Create a UI Action button that allows support agents to escalate incident priority to Critical with one click, adding a work note explaining the escalation.

## What You'll Learn
- Creating UI Actions (buttons)
- Client vs Server-side scripts
- CRUD auto-detection for UI Actions
- Form integration

---

## Step 1: Analyze the Request

**Command:**
```bash
node sn-ai-operations-cli.js analyze "create a button to escalate incident priority to critical and add a work note"
```

**Expected Output:**
```
Analyzing request: create a button to escalate incident priority to critical and add a work note

Suggested Operations:
  1. create_ui_action (High confidence)
     Description: Create a UI Action (button, link, or context menu item)
     Complexity: Medium

Analysis complete!
Confidence: high
Suggestion: Use 'create_ui_action' operation
```

**What Happened:**
- AI detected keywords: "button", "escalate"
- Matched to `create_ui_action` operation
- Determined this is a form button scenario

---

## Step 2: Build the Operation Plan

**Create input file: `escalate-priority.json`**
```json
{
  "name": "Escalate to Critical",
  "table": "incident",
  "action_name": "escalate_priority",
  "form_button": true,
  "list_button": false,
  "client": false,
  "onclick": "escalatePriority();",
  "script": "function escalatePriority() {\n  var gr = new GlideRecord('incident');\n  if (gr.get(g_form.getUniqueValue())) {\n    gr.priority = '1'; // Critical\n    gr.work_notes = 'Priority escalated to Critical by ' + gs.getUserDisplayName();\n    gr.update();\n    g_form.addInfoMessage('Incident escalated to Critical priority');\n    g_form.reload();\n  }\n}",
  "show_insert": false,
  "show_update": true,
  "active": true,
  "order": 100
}
```

**Command:**
```bash
node sn-ai-operations-cli.js plan create_ui_action --input escalate-priority.json
```

**Expected Output:**
```
Building operation plan for: create_ui_action

✓ Loaded user input from escalate-priority.json
✓ Template loaded
✓ CRUD Auto-Detection analyzing script...

CRUD Analysis Results:
  Operations Detected:
    - READ: gr.get() (operation: query)
    - READ: g_form.getUniqueValue() (client-side read)
    - UPDATE: gr.priority = '1' (field: priority, table: incident)
    - UPDATE: gr.work_notes = '...' (field: work_notes, table: incident)
    - UPDATE: gr.update() (server-side update)

  Script Type Analysis:
    - Server-side operations detected (GlideRecord)
    - Client-side operations detected (g_form)
    - Recommendation: This should be a CLIENT script with AJAX callback

  Warnings:
    ⚠ Mixing client (g_form) and server (GlideRecord) operations
    ⚠ Consider using GlideAjax for server communication
    ⚠ Current approach may cause performance issues

Operation Plan Created:
  Operation: create_ui_action
  Description: Create a UI Action (button) on incident form

  Data to be created:
    sys_ui_action:
      name: "Escalate to Critical"
      table: "incident"
      action_name: "escalate_priority"
      form_button: true
      client: false (⚠ Consider changing to true with Ajax)
      show_update: true
      script: [243 characters]

Plan saved to: operation-plan-create_ui_action-1699386234.json
```

**What Happened:**
- CRUD detection found both client and server-side code
- **Warning issued**: Mixing client/server operations in one script
- Suggested using GlideAjax for better architecture
- Detected UPDATE operations on priority and work_notes

---

## Step 3: Refine Based on Recommendations

Let's split into proper client-server architecture:

**Updated: `escalate-priority-improved.json`**
```json
{
  "name": "Escalate to Critical",
  "table": "incident",
  "action_name": "escalate_priority",
  "form_button": true,
  "list_button": false,
  "client": true,
  "onclick": "escalateIncident();",
  "script": "function escalateIncident() {\n  var incidentId = g_form.getUniqueValue();\n  \n  // Call server-side Script Include via Ajax\n  var ga = new GlideAjax('IncidentEscalationUtil');\n  ga.addParam('sysparm_name', 'escalatePriority');\n  ga.addParam('sysparm_incident_id', incidentId);\n  ga.getXMLAnswer(function(response) {\n    if (response == 'success') {\n      g_form.addInfoMessage('Incident escalated to Critical priority');\n      g_form.reload();\n    } else {\n      g_form.addErrorMessage('Failed to escalate: ' + response);\n    }\n  });\n}",
  "show_insert": false,
  "show_update": true,
  "active": true,
  "order": 100
}
```

**Additional: Create Script Include `IncidentEscalationUtil`**
```javascript
var IncidentEscalationUtil = Class.create();
IncidentEscalationUtil.prototype = Object.extendsObject(AbstractAjaxProcessor, {

  escalatePriority: function() {
    var incidentId = this.getParameter('sysparm_incident_id');

    var gr = new GlideRecord('incident');
    if (gr.get(incidentId)) {
      gr.priority = '1'; // Critical
      gr.work_notes = 'Priority escalated to Critical by ' + gs.getUserDisplayName();
      if (gr.update()) {
        return 'success';
      } else {
        return 'Failed to update record';
      }
    } else {
      return 'Incident not found';
    }
  },

  type: 'IncidentEscalationUtil'
});
```

**Rebuild plan:**
```bash
node sn-ai-operations-cli.js plan create_ui_action --input escalate-priority-improved.json
```

**Expected Output:**
```
Building operation plan for: create_ui_action

✓ CRUD Auto-Detection analyzing script...

CRUD Analysis Results:
  Operations Detected:
    - READ: g_form.getUniqueValue() (client-side read)
    - AJAX CALL: GlideAjax('IncidentEscalationUtil') (server communication)
    - CLIENT OPERATION: g_form.reload() (form refresh)

  Script Type Analysis:
    - Pure client-side script detected ✓
    - Uses GlideAjax for server communication ✓
    - Follows ServiceNow best practices ✓

  Recommendations:
    ✓ Architecture is correct
    ✓ Proper separation of concerns
    - Remember to create Script Include: IncidentEscalationUtil

Operation Plan Created:
  Operation: create_ui_action

  Data to be created:
    sys_ui_action:
      name: "Escalate to Critical"
      table: "incident"
      client: true ✓
      show_update: true
      [Clean client-side script]

  Additional Requirements:
    ⚠ Must create Script Include: IncidentEscalationUtil
    ⚠ Script Include must be client-callable
    ⚠ Script Include must extend AbstractAjaxProcessor

Plan saved to: operation-plan-create_ui_action-1699386567.json
```

**What Happened:**
- Improved architecture detected and validated
- CRUD analysis confirmed proper client-side only script
- Identified dependency on Script Include
- Recommended creation steps

---

## Step 4: Validate the Plan

**Command:**
```bash
node sn-ai-operations-cli.js validate create_ui_action --plan operation-plan-create_ui_action-1699386567.json
```

**Expected Output:**
```
Validating operation plan...

Validation Results:

✓ Schema Validation: PASS
  - sys_ui_action table exists
  - All required fields present
  - Client flag set correctly

✓ Runtime Validation: PASS
  - Table 'incident' exists
  - Script is valid client-side JavaScript
  - GlideAjax call syntax is correct

⚠ Dependencies:
  - Script Include 'IncidentEscalationUtil' not found
  - You must create this Script Include first
  - Make sure it's marked as client-callable

✓ Security Checks: PASS
  - No direct GlideRecord manipulation on client
  - Proper server-side validation via Ajax
  - User context maintained through gs.getUserDisplayName()

Validation Status: PASS WITH DEPENDENCIES
Recommendation: Create Script Include before deploying UI Action
```

---

## Step 5: Deploy Script Include First

**Create Script Include manually or via API:**

1. Navigate to System Definition > Script Includes
2. Click "New"
3. Fill in:
   - Name: `IncidentEscalationUtil`
   - API Name: `IncidentEscalationUtil`
   - Client callable: ✓ (checked)
   - Script: [paste the Script Include code above]
4. Save

**Or use CLI:**
```bash
# Create script include plan
node sn-ai-operations-cli.js plan create_script_include --input escalation-util-si.json
```

---

## Step 6: Deploy UI Action

**Manual Deployment:**
1. Open ServiceNow Studio
2. Navigate to System UI > UI Actions
3. Click "New"
4. Copy values from plan
5. Test on incident form

**API Deployment:**
```bash
node sn-operations.js create --plan operation-plan-create_ui_action-1699386567.json
```

---

## Step 7: Test the Button

**Test Scenario 1: Escalate Existing Incident**
1. Open any incident record
2. Verify "Escalate to Critical" button appears
3. Click button
4. Verify:
   - Info message: "Incident escalated to Critical priority"
   - Priority changes to "1 - Critical"
   - Work notes added with user name
   - Form reloads automatically

**Test Scenario 2: Button Visibility**
1. Create new incident (empty form)
2. Verify button is NOT visible (show_insert = false)
3. Save incident
4. Verify button IS NOW visible (show_update = true)

**Test Scenario 3: Error Handling**
1. Temporarily rename Script Include
2. Click button
3. Verify error message displayed
4. Restore Script Include name

---

## Monitoring

**Check button usage:**
```bash
node sn-ai-monitor-cli.js summary | grep "create_ui_action"
```

**View any errors:**
```bash
node sn-ai-monitor-cli.js errors --operation create_ui_action
```

---

## Advanced: Add to List View

**Modify plan to show on lists:**
```json
{
  "name": "Escalate to Critical",
  "table": "incident",
  "list_button": true,
  "list_choice": true,
  "onclick": "escalateIncidentFromList();",
  "script": "function escalateIncidentFromList() {\n  var records = g_list.getChecked();\n  if (records.length == 0) {\n    alert('Please select at least one incident');\n    return;\n  }\n  // Bulk escalation logic\n}"
}
```

---

## Key Takeaways

✅ **CRUD Detection for UI Actions:**
   - Detected client vs server-side code
   - Warned about architectural issues
   - Suggested GlideAjax pattern

✅ **Best Practices Enforced:**
   - Proper client-server separation
   - Security through server-side validation
   - Error handling and user feedback

✅ **Dependency Management:**
   - Identified Script Include requirement
   - Provided creation order guidance
   - Validated dependencies before deployment

---

## Next Steps

- **Example 3:** Build a custom REST API endpoint
- **Example 4:** Bulk analyze existing scripts for CRUD patterns
- **Advanced:** Create context menu actions

---

## Troubleshooting

**Problem:** Button doesn't appear on form
- **Solution:** Check show_insert/show_update flags match your scenario

**Problem:** "IncidentEscalationUtil is not defined"
- **Solution:** Script Include must be client-callable and saved first

**Problem:** Button appears but does nothing
- **Solution:** Check browser console for JavaScript errors

**Problem:** Ajax call fails with permission error
- **Solution:** Verify user has write access to incident table

---

## Related Examples

- [Example 1: Incident Validation Rule](./01-incident-validation-rule.md)
- [Example 3: Custom REST API](./03-custom-rest-api.md)
