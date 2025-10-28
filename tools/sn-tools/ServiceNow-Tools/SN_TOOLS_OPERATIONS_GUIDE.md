# ServiceNow Tools Operations Guide

## Quick Reference for Claude

This guide enables me to execute ServiceNow operations to fix bugs, create/update records, and manage the development workflow.

## Available Operations

### 1. Fetch Operations

#### Fetch All Data
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-operations.js fetch-data
# With delete before fetch:
node sn-operations.js fetch-data --delete-before-fetch
```

#### Fetch Stories
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-operations.js fetch-stories
```

### 2. Update Operations

#### Update Script Include
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-operations.js update --type script_include --sys_id [sys_id] --field script --file update.js
```

#### Update REST API Operation Script
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-operations.js update --type rest_api --sys_id [sys_id] --field operation_script --file api_script.js
```

#### Process Pending Updates (from temp_updates folder)
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-operations.js process-updates
```

### 3. Create Operations

#### Create Script Include
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-operations.js create --table sys_script_include --field name --value "ScriptName" --field script --value "// code here" --field api_name --value "ScriptName"
```

#### Create with JSON file
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-operations.js create --table sys_script_include --data new_record.json
```

### 4. Test & Diagnostics

#### Test All Connections
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-operations.js test
```

### 5. File Watching Operations

#### Import File for Local Editing
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-file-watcher.js import script_include [sys_id] [name]
```

#### Watch Files (Generate Updates)
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-file-watcher.js watch
```

#### Watch with Auto-Update
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-file-watcher.js watch --auto-update
```

### 6. Dependency Analysis

#### Scan All Dependencies
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-dependency-tracker.js scan
```

#### Impact Analysis
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-dependency-tracker.js impact [ScriptIncludeName]
```

#### Show Dependency Graph
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-dependency-tracker.js graph
```

### 7. Automated Execution

#### Run Everything Based on Config
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-auto-execute.js
```

Or use batch file:
```bash
W:\Tenon\sn-tools.bat
```

## Common Workflows

### Fix a Bug in Script Include

1. **Find the Script Include**
```bash
cd W:\Tenon\ServiceNow-Tools
grep -r "ScriptIncludeName" ServiceNow-Data/
```

2. **Create Fix File**
```bash
# Create the fixed code in a temporary file
echo "// Fixed code here" > temp_fix.js
```

3. **Update the Record**
```bash
node sn-operations.js update --type script_include --sys_id [found_sys_id] --field script --file temp_fix.js
```

### Fix REST API Operation

1. **Locate API Operation**
```bash
cd W:\Tenon\ServiceNow-Tools
grep -r "API_NAME" ServiceNow-Data/Tenon/Rest_API\'s/
```

2. **Update Operation Script**
```bash
node sn-operations.js update --type rest_api --sys_id [sys_id] --field operation_script --file fixed_api.js
```

### Create New Script Include for API

1. **Create JSON file with record data**
```json
{
  "name": "TenonNewFeatureMS",
  "api_name": "TenonNewFeatureMS",
  "script": "var TenonNewFeatureMS = Class.create();\nTenonNewFeatureMS.prototype = {\n    initialize: function() {},\n    \n    processRequest: function(request, response) {\n        // Implementation\n    },\n    \n    type: 'TenonNewFeatureMS'\n};\n",
  "active": true,
  "access": "package_private",
  "description": "Master Script for new feature"
}
```

2. **Create the record**
```bash
cd W:\Tenon\ServiceNow-Tools
node sn-operations.js create --table sys_script_include --data new_script.json
```

## Table Mappings

Common ServiceNow tables used:
- `sys_script_include` - Script Includes
- `sys_ws_operation` - REST API Operations
- `sys_script` - Business Rules
- `sys_ui_action` - UI Actions
- `sys_script_client` - Client Scripts
- `sys_hub_flow` - Flow Designer Flows
- `rm_story` - User Stories (Agile)

## Instance Routing

Based on `sn-config.json`:
- **Dev Instance**: tenonworkstudio.service-now.com (most operations)
- **Prod Instance**: tenon.service-now.com (stories only)

## Important Notes

1. **Always backup before updates** - The system auto-creates backups in `ServiceNow-Tools/backups/`
2. **Use correct table names** - ServiceNow uses sys_ prefix for system tables
3. **Field names are lowercase with underscores** - e.g., `operation_script`, not `operationScript`
4. **Test in dev first** - All non-story operations route to dev by default
5. **Check dependencies** - Use dependency tracker before major changes

## Error Recovery

If an update fails:
1. Check `ServiceNow-Tools/backups/` for the backup
2. Review error message for field name or permission issues
3. Verify sys_id exists in the target instance
4. Check network connectivity with `node sn-operations.js test`