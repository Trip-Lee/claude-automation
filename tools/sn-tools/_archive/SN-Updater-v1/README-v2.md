# ServiceNow Tools v2 - Multi-Instance Configuration

A powerful, config-driven toolset for ServiceNow operations with support for routing different tables to different instances.

## 🚀 Key Features

- **Multi-Instance Support**: Route different tables to different ServiceNow instances
- **Config-Driven**: Everything controlled through a single configuration file
- **Automatic Execution**: No CLI needed - config handles everything
- **Table-Specific Routing**: Get stories from production, dev data from development
- **Full Field Retrieval**: Gets ALL fields from records, not just specific ones
- **Automatic Backups**: Every update creates a timestamped backup
- **Batch Processing**: Process multiple updates from temp_updates folder

## 📋 Quick Start

### 1. Setup Configuration

```batch
sn-setup.bat
```

This will create/edit `sn-config.json` with your instance details.

### 2. Run Everything

```batch
sn-tools.bat
```

Automatically executes all configured operations based on your settings.

## 🔧 Configuration Structure

Create `SN-Updater/sn-config.json`:

```json
{
  "instances": {
    "dev": {
      "instance": "dev123456.service-now.com",
      "username": "dev-username",
      "password": "dev-password"
    },
    "prod": {
      "instance": "prod123456.service-now.com",
      "username": "prod-username",
      "password": "prod-password"
    }
  },
  "routing": {
    "stories": "prod",           // Stories come from production
    "default": "dev",            // Default instance for unlisted tables
    "tables": {
      "sys_script_include": "dev",
      "sys_ws_operation": "dev",
      "sys_script": "dev",
      "sys_ui_action": "dev",
      "sys_script_client": "dev",
      "rm_story": "prod",        // User stories from production
      "rm_epic": "prod",
      "rm_sprint": "prod"
    }
  },
  "settings": {
    "autoBackup": true,          // Create backups before updates
    "validateUpdates": true,     // Validate after updating
    "autoFetchData": true,       // Fetch data in auto-execute
    "autoFetchStories": true,    // Fetch stories in auto-execute
    "autoProcessUpdates": true,  // Process temp_updates folder
    "timeout": 30000
  }
}
```

## 📁 Directory Structure

```
SN-Updater/
├── sn-config.json           # Your configuration (create this)
├── sn-config.example.json   # Example configuration
├── servicenow-tools-v2.js   # Main tools module
├── sn-auto-execute.js       # Automatic execution script
├── sn-operations.js         # Individual operations
├── temp_updates/            # Place update files here
│   ├── *.js                # Files to update (type_sysid_field.js)
│   └── processed/          # Processed files moved here
└── backups/                # Automatic backups
    └── *.backup            # Timestamped backup files
```

## 🎯 Usage Scenarios

### Automatic Execution (Recommended)

Run everything based on configuration:
```batch
sn-tools.bat
```

This will:
1. Process any pending updates in temp_updates/
2. Fetch data from configured instances
3. Fetch stories from configured instance
4. Create backups automatically
5. Validate all updates

### Individual Operations

```batch
# Test all connections
sn-test-connections.bat

# Fetch all data and stories
sn-fetch-all.bat

# Process pending updates only
sn-process-updates.bat

# Or use the operations script directly
cd SN-Updater
node sn-operations.js fetch-data
node sn-operations.js fetch-stories
node sn-operations.js process-updates
node sn-operations.js test
```

### Manual Update

```batch
cd SN-Updater
node sn-operations.js update ^
  --type script_include ^
  --sys_id abc123def456 ^
  --field script ^
  --file my_update.js
```

## 🔄 Update Workflow

### 1. Place Update Files

Put files in `SN-Updater/temp_updates/` with naming convention:
```
type_sysid_field.js
```

Examples:
- `script_include_abc123_script.js`
- `rest_api_def456_operation_script.js`
- `business_rule_ghi789_script.js`

### 2. Process Updates

Run one of:
```batch
# Process everything
sn-tools.bat

# Process updates only
sn-process-updates.bat
```

### 3. Files Are Processed

- ✓ Updates applied to ServiceNow
- ✓ Backups created in backups/
- ✓ Processed files moved to temp_updates/processed/

## 🔍 Instance Routing Examples

Based on your configuration:

| Operation | Table/Type | Instance Used |
|-----------|------------|---------------|
| Fetch Script Include | sys_script_include | dev |
| Fetch REST API | sys_ws_operation | dev |
| Fetch User Story | rm_story | prod |
| Fetch Epic | rm_epic | prod |
| Update Business Rule | sys_script | dev |
| Fetch unlisted table | any_other_table | dev (default) |

## 🛡️ Security Features

- Passwords never displayed in logs
- Automatic backups before every update
- Validation after updates
- Instance-specific authentication
- Configuration file is gitignored

## 📊 What Gets Fetched

When fetching data:
- **ALL fields** from records (not just specific fields)
- Complete record data for comprehensive local development
- Proper instance routing based on table configuration

## 🔧 Troubleshooting

### Configuration Not Found
```
ERROR: No configuration file found!
```
**Solution**: Run `sn-setup.bat` to create configuration

### Connection Failed
```
Testing dev... ✗ HTTP 401
```
**Solution**: Check username/password in sn-config.json

### No Updates Processed
```
No pending updates found.
```
**Solution**: Ensure files in temp_updates/ follow naming convention: `type_sysid_field.js`

### Wrong Instance Used
**Solution**: Check routing configuration in sn-config.json:
- Verify table is listed in `routing.tables`
- Check `routing.default` for unlisted tables

## 🚀 Migration from v1

Key differences from previous version:
1. **No CLI interface** - everything is config-driven
2. **Multi-instance support** - route tables to different instances
3. **Full field retrieval** - gets all fields, not specific ones
4. **Simplified execution** - just run sn-tools.bat
5. **Automatic processing** - handles everything based on config

## 📝 Examples

### Example: Dev/Prod Split Configuration

```json
{
  "instances": {
    "dev": {
      "instance": "dev123456.service-now.com",
      "username": "admin",
      "password": "devpass123"
    },
    "prod": {
      "instance": "prod123456.service-now.com",
      "username": "readonly_user",
      "password": "prodpass456"
    }
  },
  "routing": {
    "stories": "prod",
    "default": "dev",
    "tables": {
      "sys_script_include": "dev",
      "sys_ws_operation": "dev",
      "rm_story": "prod",
      "rm_epic": "prod"
    }
  }
}
```

This configuration:
- Fetches all code/scripts from dev
- Fetches stories/epics from production
- Updates go to dev instance

### Example: Single Instance Configuration

```json
{
  "instances": {
    "main": {
      "instance": "myinstance.service-now.com",
      "username": "admin",
      "password": "password"
    }
  },
  "routing": {
    "default": "main"
  }
}
```

Simple configuration using one instance for everything.

## 📌 Version

**v2.0.0** - Complete rewrite with multi-instance support and config-driven execution

## 📄 License

Internal use only - CadenceSoft/Tenon