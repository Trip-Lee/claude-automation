# ServiceNow Direct Update Guide

This guide explains how to update Script Includes, REST APIs, and other ServiceNow records directly from your local environment.

## Important: Script String Handling

ServiceNow scripts in the extracted JSON files are stored as **escaped strings** with:
- `\r\n` for line breaks  
- `\t` for tabs
- `\"` for quotes

When updating scripts:
1. The JSON parser automatically converts these to real newlines and tabs
2. Claude will parse the string and create clean JavaScript files
3. The updater sends the clean JavaScript to ServiceNow

See `parse-script-example.js` for examples of parsing and updating scripts.

## Setup

### 1. Configure Credentials
Copy `sn-config.example.json` to `sn-config.json` and update with your credentials:

```json
{
  "instance": "tenonworkstudio.service-now.com",
  "username": "your-username",
  "password": "your-password"
}
```

**Important**: Never commit `sn-config.json` to version control!

### 2. Install Node.js Dependencies
No additional dependencies needed - uses built-in Node.js modules.

## Usage Methods

### Method 1: Interactive Update (Recommended)
Run the interactive updater:
```bash
update-servicenow.bat
```

This will:
1. Show a menu to select record type
2. Prompt for sys_id
3. Let you choose file input or open an editor
4. Preview changes before updating
5. Create automatic backups

### Method 2: Command Line
Direct command line usage:

```bash
# Update Script Include from file
node servicenow-updater.js --type script_include --sys_id [sys_id] --field script --file updated_script.js

# Update REST API operation script
node servicenow-updater.js --type rest_api --sys_id [sys_id] --field operation_script --file api_script.js

# Update with direct value
node servicenow-updater.js --type script_include --sys_id [sys_id] --field description --value "New description"
```

## Supported Record Types

| Type | Table | Common Fields | Example |
|------|-------|--------------|---------|
| `script_include` | sys_script_include | script, description, api_name | Backend logic |
| `rest_api` | sys_ws_operation | operation_script, name | API endpoints |
| `business_rule` | sys_script | script, condition | Table triggers |
| `client_script` | sys_script_client | script | UI scripts |
| `ui_action` | sys_ui_action | script, condition | Form buttons |

## Finding Sys IDs

### From Extracted Data
Look in the JSON files:
```
W:\Tenon\ServiceNow Data\Tenon\Script_Includes\[scope]\[name].json
W:\Tenon\ServiceNow Data\Tenon\Rest_API's\[scope]\[name].json
```

The sys_id is in `_metadata.sys_id` field.

### From ServiceNow Instance
1. Navigate to the record in ServiceNow
2. Right-click the form header
3. Select "Copy sys_id"

## Workflow for Updates

### When Claude Suggests Changes

1. **Claude identifies needed change**:
   ```
   "I need to update the ComplexFilterApiMS Script Include to add error handling"
   ```

2. **Claude provides the sys_id**:
   ```
   Script Include: ComplexFilterApiMS
   Sys ID: 40a9fac44752b15098519fd8036d43e9
   ```

3. **Claude creates update file**:
   ```bash
   # Claude will create: W:\Tenon\temp_updates\ComplexFilterApiMS_update.js
   ```

4. **You run the update**:
   ```bash
   update-servicenow.bat
   # Select: 1 (Script Include)
   # Enter sys_id: 40a9fac44752b15098519fd8036d43e9
   # Select: 1 (From file)
   # Enter path: temp_updates\ComplexFilterApiMS_update.js
   ```

## Backups

All updates are automatically backed up to:
```
W:\Tenon\backups\[type]_[sys_id]_[timestamp].backup
```

Backup files contain:
- Original value
- Updated value
- Timestamp
- Table and field information

## Safety Features

1. **Preview**: Shows first 500 characters before updating
2. **Confirmation**: Requires Enter key to proceed
3. **Automatic Backup**: Every update is backed up
4. **Current State Check**: Shows last update time before changes
5. **Error Handling**: Clear error messages for common issues

## Common Operations

### Update Script Include
```bash
# When Claude identifies a Script Include to update
node servicenow-updater.js --type script_include --sys_id [sys_id] --field script --file [file]
```

### Update REST API Operation
```bash
# When updating API endpoint logic
node servicenow-updater.js --type rest_api --sys_id [sys_id] --field operation_script --file [file]
```

### Update Description/Documentation
```bash
# Quick description update
node servicenow-updater.js --type script_include --sys_id [sys_id] --field description --value "Updated description"
```

## Troubleshooting

### Authentication Failed
- Check username/password in sn-config.json
- Ensure user has write permissions
- Verify instance URL is correct

### Record Not Found
- Verify sys_id is correct
- Check if record exists in instance
- Ensure correct table/type selected

### Network Issues
- Check VPN connection if required
- Verify instance is accessible
- Check firewall settings

## Best Practices

1. **Always Test First**: Update development instance before production
2. **Review Changes**: Use preview feature before confirming
3. **Keep Backups**: Don't delete backup files immediately
4. **Document Changes**: Add comments explaining why changes were made
5. **Coordinate Updates**: Ensure no one else is editing the same record

## Integration with Claude

When working with Claude:
1. Claude will identify records that need updating
2. Claude will provide sys_ids from the extracted data
3. Claude will create update files in `temp_updates/` directory
4. You execute the updates using the tools provided
5. Claude can verify updates succeeded by re-reading extracted data

## Security Notes

- Credentials are only stored locally in sn-config.json
- Never share or commit sn-config.json
- Use service account with minimal required permissions
- Rotate passwords regularly
- Consider using OAuth tokens for production use