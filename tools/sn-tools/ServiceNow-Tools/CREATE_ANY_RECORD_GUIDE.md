# ServiceNow - Create Any Record Type Guide

## Universal Record Creation Command

```bash
cd ServiceNow-Tools
node sn-operations.js create --table [table_name] --data [json_file]
# OR
node sn-operations.js create --table [table_name] --field [name] --value [value] --field [name2] --value [value2]
```

## All ServiceNow Tables & Required Fields

### 1. Script Include (sys_script_include)
```json
{
  "name": "ScriptName",
  "api_name": "x_cadso_tenon_ma.ScriptName",
  "script": "var ScriptName = Class.create();\n//code",
  "active": true,
  "access": "package_private",
  "client_callable": false,
  "description": "Description here"
}
```

### 2. REST API Operation (sys_ws_operation)
```json
{
  "name": "Operation Name",
  "web_service_definition": "sys_id_of_api_definition",
  "web_service_version": "sys_id_of_api_version",
  "http_method": "GET",
  "relative_path": "/endpoint",
  "operation_script": "(function process(request, response) {\n    // code\n})(request, response);",
  "active": true,
  "requires_authentication": true,
  "description": "API endpoint description"
}
```

### 3. Business Rule (sys_script)
```json
{
  "name": "Rule Name",
  "collection": "table_name",
  "when": "before",
  "insert": true,
  "update": true,
  "delete": false,
  "query": false,
  "script": "(function executeRule(current, previous) {\n    // code\n})(current, previous);",
  "active": true,
  "order": 100,
  "description": "Business rule description"
}
```

### 4. UI Action (sys_ui_action)
```json
{
  "name": "Action Name",
  "table": "table_name",
  "action_name": "action_name",
  "form_button": true,
  "form_context_menu": false,
  "form_link": false,
  "list_button": false,
  "list_context_menu": false,
  "list_link": false,
  "onclick": "functionName();",
  "condition": "current.state == 'open'",
  "script": "function functionName() {\n    // code\n}",
  "active": true,
  "order": 100
}
```

### 5. Client Script (sys_script_client)
```json
{
  "name": "Client Script Name",
  "table": "table_name",
  "type": "onLoad",
  "script": "function onLoad() {\n    // code\n}",
  "active": true,
  "description": "Client script description",
  "applies_to": "desktop",
  "ui_type": 10,
  "order": 50
}
```

### 6. Scheduled Job (sysauto_script)
```json
{
  "name": "Job Name",
  "script": "// Scheduled job code here",
  "active": true,
  "run_type": "periodically",
  "run_period": "1970-01-01 04:00:00",
  "run_interval": "86400",
  "description": "Runs daily at 4 AM"
}
```

### 7. Event Registration (sysevent_register)
```json
{
  "event_name": "custom.event.name",
  "table": "table_name",
  "description": "Event description",
  "fired_by": "Script"
}
```

### 8. Email Notification (sysevent_email_action)
```json
{
  "name": "Notification Name",
  "table": "table_name",
  "active": true,
  "event_name": "event.name",
  "recipient_fields": "assigned_to",
  "subject": "Email Subject: ${number}",
  "message_html": "<p>HTML message body</p>",
  "condition": "current.state == 'open'"
}
```

### 9. ACL/Security Rule (sys_security_acl)
```json
{
  "name": "table_name.field_name",
  "operation": "write",
  "admin_overrides": false,
  "active": true,
  "condition": "gs.hasRole('admin')",
  "script": "// Advanced condition script",
  "type": "record"
}
```

### 10. Flow Designer Flow (sys_hub_flow)
```json
{
  "name": "Flow Name",
  "description": "Flow description",
  "active": true,
  "sys_scope": "x_cadso_tenon_ma",
  "type": "flow",
  "internal_name": "flow_name",
  "callable_by_client_api": false
}
```

### 11. Catalog Item (sc_cat_item)
```json
{
  "name": "Catalog Item Name",
  "short_description": "Brief description",
  "category": "sys_id_of_category",
  "price": "0",
  "recurring_price": "0",
  "billable": false,
  "active": true,
  "workflow": "sys_id_of_workflow"
}
```

### 12. Portal Widget (sp_widget)
```json
{
  "name": "Widget Name",
  "id": "widget-id",
  "template": "<div>HTML template</div>",
  "css": ".widget-class { }",
  "client_script": "function() {\n    // Angular controller\n}",
  "server_script": "(function() {\n    // Server script\n})()",
  "option_schema": "[]",
  "public": false
}
```

### 13. Import Set Table (sys_db_object)
```json
{
  "name": "u_import_table_name",
  "label": "Import Table Label",
  "super_class": "sys_import_set_row",
  "sys_scope": "global",
  "create_access_controls": false
}
```

### 14. Transform Map (sys_transform_map)
```json
{
  "name": "Transform Map Name",
  "source_table": "import_table",
  "target_table": "target_table",
  "active": true,
  "order": 100,
  "run_business_rules": true,
  "run_script": false,
  "script": "// onBefore script"
}
```

### 15. Dictionary Entry (sys_dictionary)
```json
{
  "name": "table_name",
  "element": "field_name",
  "column_label": "Field Label",
  "internal_type": "string",
  "max_length": 40,
  "mandatory": false,
  "active": true,
  "read_only": false,
  "default_value": ""
}
```

### 16. UI Policy (sys_ui_policy)
```json
{
  "name": "Policy Name",
  "table": "table_name",
  "active": true,
  "conditions": "state=3",
  "short_description": "Policy description",
  "reverse_if_false": true,
  "on_load": true,
  "inherit": false
}
```

### 17. Data Policy (sys_data_policy2)
```json
{
  "name": "Policy Name",
  "model_table": "table_name",
  "active": true,
  "conditions": "active=true",
  "apply_import_set": false,
  "apply_web_service": true,
  "enforce_ui": true
}
```

### 18. Application Menu (sys_app_module)
```json
{
  "title": "Menu Title",
  "application": "sys_id_of_app",
  "hint": "Menu hint text",
  "order": 100,
  "roles": "x_cadso_tenon_ma.user",
  "link_type": "LIST",
  "table": "table_name",
  "active": true
}
```

### 19. Report (sys_report)
```json
{
  "title": "Report Title",
  "table": "table_name",
  "field": "state",
  "type": "bar",
  "is_scheduled": false,
  "is_published": true,
  "description": "Report description"
}
```

### 20. Workflow (wf_workflow)
```json
{
  "name": "Workflow Name",
  "table": "table_name",
  "description": "Workflow description",
  "on_condition": "current.state == 'pending'",
  "active": true
}
```

## Tenon-Specific Tables

### 21. Marketing Audience (x_cadso_tenon_ma_audience)
```json
{
  "name": "Audience Name",
  "description": "Target audience description",
  "criteria": "JSON criteria object",
  "active": true,
  "type": "dynamic",
  "refresh_interval": 86400
}
```

### 22. Email Campaign (x_cadso_tenon_ma_campaign)
```json
{
  "name": "Campaign Name",
  "subject": "Email Subject",
  "template": "sys_id_of_template",
  "audience": "sys_id_of_audience",
  "scheduled_send": "2024-12-01 10:00:00",
  "status": "draft",
  "active": true
}
```

### 23. Journey Stage (x_cadso_tenon_mjb_journey_stage)
```json
{
  "name": "Stage Name",
  "journey": "sys_id_of_journey",
  "type": "email",
  "order": 100,
  "wait_time": 86400,
  "conditions": "JSON conditions"
}
```

### 24. Work Item (x_cadso_tenon_mwm_work_item)
```json
{
  "short_description": "Work item title",
  "description": "Detailed description",
  "assigned_to": "sys_id_of_user",
  "priority": 3,
  "state": "open",
  "sprint": "sys_id_of_sprint",
  "story_points": 5
}
```

### 25. Brand Kit (x_cadso_tenon_ma_brand_kit)
```json
{
  "name": "Brand Name",
  "primary_color": "#007ACC",
  "secondary_color": "#40E0D0",
  "logo_attachment": "sys_id_of_attachment",
  "font_family": "Arial, sans-serif",
  "active": true
}
```

## Quick Creation Examples

### Create Script Include
```bash
cd ServiceNow-Tools
cat > script.json << 'EOF'
{
  "name": "MyUtilityMS",
  "api_name": "x_cadso_tenon_ma.MyUtilityMS",
  "script": "var MyUtilityMS = Class.create();\nMyUtilityMS.prototype = {\n    initialize: function() {},\n    type: 'MyUtilityMS'\n};",
  "active": true
}
EOF
node sn-operations.js create --table sys_script_include --data script.json
```

### Create Business Rule
```bash
node sn-operations.js create --table sys_script \
  --field name --value "Update Modified Time" \
  --field collection --value "x_cadso_tenon_ma_campaign" \
  --field when --value "before" \
  --field update --value "true" \
  --field script --value "current.u_modified = gs.nowDateTime();" \
  --field active --value "true"
```

### Create REST API Endpoint
```bash
cat > api.json << 'EOF'
{
  "name": "Get User Preferences",
  "web_service_definition": "abc123",
  "http_method": "GET",
  "relative_path": "/preferences/{user_id}",
  "operation_script": "(function process(request, response) {\n    var userId = request.pathParams.user_id;\n    response.setBody({userId: userId, preferences: {}});\n})(request, response);",
  "active": true
}
EOF
node sn-operations.js create --table sys_ws_operation --data api.json
```

### Create UI Action
```bash
cat > ui_action.json << 'EOF'
{
  "name": "Send Campaign",
  "table": "x_cadso_tenon_ma_campaign",
  "form_button": true,
  "onclick": "sendCampaign();",
  "condition": "current.status == 'ready'",
  "script": "function sendCampaign() {\n    g_form.setValue('status', 'sending');\n    gsftSubmit();\n}",
  "active": true
}
EOF
node sn-operations.js create --table sys_ui_action --data ui_action.json
```

### Create Client Script
```bash
node sn-operations.js create --table sys_script_client \
  --field name --value "Validate Email Format" \
  --field table --value "x_cadso_tenon_ma_campaign" \
  --field type --value "onChange" \
  --field field_name --value "email" \
  --field script --value "function onChange(control, oldValue, newValue, isLoading) {\n    if (!isLoading && newValue) {\n        var emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\n        if (!emailRegex.test(newValue)) {\n            g_form.showFieldMsg('email', 'Invalid email format', 'error');\n        }\n    }\n}" \
  --field active --value "true"
```

### Create Scheduled Job
```bash
cat > job.json << 'EOF'
{
  "name": "Daily Campaign Report",
  "script": "var report = new x_cadso_tenon_ma.CampaignReporter();\nreport.generateDailyReport();",
  "active": true,
  "run_type": "periodically",
  "run_period": "1970-01-01 06:00:00",
  "run_interval": "86400"
}
EOF
node sn-operations.js create --table sysauto_script --data job.json
```

### Create Flow
```bash
cat > flow.json << 'EOF'
{
  "name": "Campaign Approval Flow",
  "description": "Approval workflow for marketing campaigns",
  "active": true,
  "sys_scope": "x_cadso_tenon_ma",
  "type": "flow",
  "internal_name": "campaign_approval_flow"
}
EOF
node sn-operations.js create --table sys_hub_flow --data flow.json
```

### Create Custom Tenon Record
```bash
# Create Marketing Audience
cat > audience.json << 'EOF'
{
  "name": "High Value Customers",
  "description": "Customers with lifetime value > $10000",
  "criteria": "{\"ltv\": {\"$gt\": 10000}}",
  "active": true,
  "type": "dynamic",
  "refresh_interval": 86400
}
EOF
node sn-operations.js create --table x_cadso_tenon_ma_audience --data audience.json
```

## Field Types Reference

### Common Field Types
- **string**: Text field (specify max_length)
- **integer**: Whole number
- **decimal**: Decimal number
- **boolean**: true/false
- **date**: Date only (YYYY-MM-DD)
- **glide_date_time**: Date and time
- **reference**: sys_id reference to another table
- **choice**: Dropdown selection
- **journal**: Multi-line text with history
- **html**: Rich text HTML
- **script**: Script field (JavaScript/code)
- **json**: JSON object storage
- **conditions**: Query condition string

## Tips for Creating Records

1. **Always include active field**: Most tables have an active field (boolean)
2. **Scope awareness**: Tenon tables use `x_cadso_tenon_ma`, `x_cadso_tenon_mwm`, or `x_cadso_tenon_mjb` prefixes
3. **References need sys_ids**: When referencing other records, use their sys_id
4. **Check parent class**: Some tables inherit from others (e.g., Task extended tables)
5. **Use proper datetime format**: "YYYY-MM-DD HH:MM:SS" for glide_date_time fields
6. **Script fields escape properly**: Use \\n for newlines in JSON strings

## Validation Before Creating

```bash
# Test connection first
cd ServiceNow-Tools
node sn-operations.js test

# Check if table exists
grep -r "table_name" ServiceNow-Data/

# Verify required fields
cat ServiceNow-Data/path/to/existing_record.json | head -20
```

## After Creation

Every create operation returns the sys_id of the new record:
```
✓ Record created
Sys ID: abc123def456ghi789
```

Save this sys_id for future updates or references.