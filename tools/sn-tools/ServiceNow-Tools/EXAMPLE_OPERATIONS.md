# ServiceNow Tools - Example Operations

## Real-World Examples for Common Tasks

### Example 1: Fix a Bug in AudienceBuilderMS Script Include

```bash
# 1. First, locate the Script Include
cd ServiceNow-Tools
grep -r "AudienceBuilderMS" ServiceNow-Data/

# 2. Find the sys_id from the file (usually in the filename or metadata)
# Example: sys_script_include_abc123def456.json

# 3. Create the fixed script
cat > fixed_audience_builder.js << 'EOF'
var AudienceBuilderMS = Class.create();
AudienceBuilderMS.prototype = {
    initialize: function() {
        this.logger = new x_cadso_tenon_ma.TenonLogger('AudienceBuilderMS');
    },
    
    getAudiences: function(request, response) {
        try {
            // FIXED: Added null check for request.queryParams
            var queryParams = request.queryParams || {};
            var limit = queryParams.limit || 100;
            
            var gr = new GlideRecord('x_cadso_tenon_ma_audience');
            gr.addActiveQuery();
            gr.setLimit(limit);
            gr.query();
            
            var audiences = [];
            while (gr.next()) {
                audiences.push({
                    sys_id: gr.getValue('sys_id'),
                    name: gr.getValue('name'),
                    description: gr.getValue('description')
                });
            }
            
            return {
                success: true,
                data: audiences
            };
        } catch (e) {
            this.logger.error('getAudiences', e);
            return {
                success: false,
                error: e.message
            };
        }
    },
    
    type: 'AudienceBuilderMS'
};
EOF

# 4. Update the Script Include
node sn-operations.js update --type script_include --sys_id abc123def456 --field script --file fixed_audience_builder.js
```

### Example 2: Fix REST API Operation Script

```bash
# 1. Find the REST API operation
cd ServiceNow-Tools
grep -r "USER_FETCH" "ServiceNow-Data/Tenon/Rest_API's/"

# 2. Create the fixed operation script
cat > fixed_user_fetch_api.js << 'EOF'
(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    try {
        // FIXED: Added proper error handling and validation
        var queryParams = request.queryParams || {};
        
        if (!queryParams.user_id && !queryParams.email) {
            response.setStatus(400);
            response.setBody({
                success: false,
                error: 'Either user_id or email is required'
            });
            return;
        }
        
        var userHelper = new x_cadso_tenon_ma.UserHelperMS();
        var result = userHelper.getUser(queryParams);
        
        if (result.success) {
            response.setStatus(200);
        } else {
            response.setStatus(404);
        }
        
        response.setBody(result);
        
    } catch (e) {
        response.setStatus(500);
        response.setBody({
            success: false,
            error: 'Internal server error: ' + e.message
        });
    }
})(request, response);
EOF

# 3. Update the REST API operation
node sn-operations.js update --type rest_api --sys_id xyz789ghi012 --field operation_script --file fixed_user_fetch_api.js
```

### Example 3: Create New Script Include for Email Template Handler

```bash
# 1. Create the new Script Include as JSON
cd ServiceNow-Tools
cat > new_email_template_ms.json << 'EOF'
{
  "name": "EmailTemplateMS",
  "api_name": "x_cadso_tenon_ma.EmailTemplateMS",
  "script": "var EmailTemplateMS = Class.create();\nEmailTemplateMS.prototype = {\n    initialize: function() {\n        this.logger = new x_cadso_tenon_ma.TenonLogger('EmailTemplateMS');\n    },\n    \n    processTemplate: function(templateId, data) {\n        try {\n            var gr = new GlideRecord('x_cadso_tenon_ma_email_template');\n            if (!gr.get(templateId)) {\n                return {\n                    success: false,\n                    error: 'Template not found'\n                };\n            }\n            \n            var content = gr.getValue('content');\n            var subject = gr.getValue('subject');\n            \n            // Process merge tags\n            for (var key in data) {\n                var regex = new RegExp('{{' + key + '}}', 'g');\n                content = content.replace(regex, data[key]);\n                subject = subject.replace(regex, data[key]);\n            }\n            \n            return {\n                success: true,\n                data: {\n                    subject: subject,\n                    content: content\n                }\n            };\n        } catch (e) {\n            this.logger.error('processTemplate', e);\n            return {\n                success: false,\n                error: e.message\n            };\n        }\n    },\n    \n    type: 'EmailTemplateMS'\n};",
  "active": true,
  "access": "package_private",
  "client_callable": false,
  "description": "Master Script for email template processing"
}
EOF

# 2. Create the Script Include
node sn-operations.js create --table sys_script_include --data new_email_template_ms.json
```

### Example 4: Batch Update Multiple Files

```bash
# 1. Create update files in temp_updates directory
cd ServiceNow-Tools/temp_updates

# Create update for Script Include
cat > update_script_include_abc123.json << 'EOF'
{
  "table": "sys_script_include",
  "sys_id": "abc123def456",
  "field": "script",
  "value": "// Updated script content here"
}
EOF

# Create update for REST API
cat > update_rest_api_xyz789.json << 'EOF'
{
  "table": "sys_ws_operation",
  "sys_id": "xyz789ghi012",
  "field": "operation_script",
  "value": "// Updated API script here"
}
EOF

# 2. Process all pending updates
cd ..
node sn-operations.js process-updates
```

### Example 5: Import and Watch Files for Development

```bash
# 1. Import a Script Include for local editing
cd ServiceNow-Tools
node sn-file-watcher.js import script_include abc123def456 AudienceBuilderMS

# 2. The file is now at: local_development/script_includes/AudienceBuilderMS.js
# Edit it with any editor

# 3. Start watching for changes (auto-generate updates)
node sn-file-watcher.js watch

# Or watch with auto-update to ServiceNow
node sn-file-watcher.js watch --auto-update
```

### Example 6: Analyze Dependencies Before Making Changes

```bash
# 1. Check what depends on a Script Include before modifying it
cd ServiceNow-Tools
node sn-dependency-tracker.js impact AudienceBuilderMS

# Output will show:
# - Components that use APIs calling this Script Include
# - Other Script Includes that reference it
# - REST APIs that use it

# 2. Scan entire codebase to build dependency map
node sn-dependency-tracker.js scan

# 3. Show visual dependency graph
node sn-dependency-tracker.js graph
```

### Example 7: Quick Fixes Using Direct Commands

```bash
# Fix a typo in a Script Include (one-liner)
cd ServiceNow-Tools
echo "var FixedScript = Class.create(); /* fixed code */" > fix.js && node sn-operations.js update --type script_include --sys_id abc123 --field script --file fix.js

# Create a simple utility Script Include
node sn-operations.js create --table sys_script_include --field name --value "DateUtils" --field api_name --value "x_cadso_tenon_ma.DateUtils" --field script --value "var DateUtils = Class.create(); DateUtils.prototype = { formatDate: function(date) { return new GlideDateTime(date).getDisplayValue(); }, type: 'DateUtils' };"
```

### Example 8: Fetch Latest Data Before Making Changes

```bash
# Fetch all data (keeps existing)
cd ServiceNow-Tools
node sn-operations.js fetch-data

# Fetch with clean slate (deletes existing first)
node sn-operations.js fetch-data --delete-before-fetch

# Fetch only stories from production
node sn-operations.js fetch-stories
```

## Common Patterns

### Pattern 1: MS (Master Script) Pattern
Most Tenon Script Includes follow the MS pattern:
- Named with "MS" suffix (e.g., AudienceBuilderMS)
- Contains business logic for REST APIs
- Returns standardized response: `{ success: boolean, data: any, error: string }`

### Pattern 2: Error Handling
Always wrap in try-catch and use TenonLogger:
```javascript
try {
    // Logic here
    return { success: true, data: result };
} catch (e) {
    this.logger.error('methodName', e);
    return { success: false, error: e.message };
}
```

### Pattern 3: REST API Response
Standard REST API response pattern:
```javascript
if (result.success) {
    response.setStatus(200);
} else {
    response.setStatus(400);
}
response.setBody(result);
```

## Tips

1. **Always test connections first**: `node sn-operations.js test`
2. **Check backups**: Located in `ServiceNow-Tools/backups/`
3. **Use grep to find records**: `grep -r "SearchTerm" ServiceNow-Data/`
4. **Sys IDs are in filenames**: Format is usually `tablename_sysid.json`
5. **Use temp_updates for batch operations**: Place JSON files there and run `process-updates`