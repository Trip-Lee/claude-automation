# ServiceNow Tools - Unified Package

A comprehensive, unified toolset for ServiceNow development operations including data fetching, story retrieval, and direct record updates.

## 🚀 Features

- **Data Fetching**: Extract ServiceNow records (Script Includes, REST APIs, Business Rules, etc.)
- **Story Fetching**: Retrieve user stories and requirements
- **Record Updating**: Direct updates to ServiceNow with automatic backups
- **Backup Management**: Automatic backups, restore functionality, and backup organization
- **Configuration Management**: Secure credential storage with optional encryption
- **Interactive CLI**: User-friendly menu-driven interface
- **Programmatic API**: Use as a Node.js module in your scripts

## 📦 Installation

### Quick Start (Windows)

1. **Initial Setup**:
   ```batch
   sn-setup.bat
   ```
   This will guide you through configuring your ServiceNow connection.

2. **Launch Tools**:
   ```batch
   sn-tools.bat
   ```
   Opens the interactive menu interface.

### Manual Setup

1. Navigate to the SN-Updater directory
2. Run the configuration setup:
   ```bash
   node config-manager.js setup
   ```

## 🎯 Usage

### Interactive Mode

Run `sn-tools.bat` (Windows) or `node sn-tools-cli.js` to access the interactive menu:

```
╔═══════════════════════════════════════╗
║     ServiceNow Tools - Main Menu      ║
╚═══════════════════════════════════════╝

1. Fetch Data (Script Includes, REST APIs, etc.)
2. Fetch Stories (User stories and requirements)
3. Update Record (Modify ServiceNow records)
4. Quick Update from File
5. Backup Management
6. Configuration
7. Help
0. Exit
```

### Command Line Mode

#### Fetch All Data
```bash
# Windows
sn-fetch-all.bat

# Or individually
node servicenow-tools.js fetch-data
node servicenow-tools.js fetch-stories
```

#### Update a Record
```bash
node servicenow-tools.js update \
  --type script_include \
  --sys_id abc123def456 \
  --field script \
  --file updated_script.js \
  --auto-confirm
```

#### Quick Update
```bash
# Windows
sn-quick-update.bat

# Place files in SN-Updater/temp_updates/
# Naming: type_sysid_field.js
# Example: script_include_abc123_script.js
```

### Programmatic Usage

```javascript
const ServiceNowTools = require('./servicenow-tools');

async function example() {
    const tools = new ServiceNowTools();
    
    // Fetch data
    await tools.fetchData();
    
    // Update a record
    await tools.updateRecord({
        type: 'script_include',
        sysId: 'abc123',
        field: 'script',
        file: 'update.js',
        autoConfirm: true
    });
    
    // List backups
    const backups = tools.listBackups();
    console.log(backups);
    
    // Restore from backup
    await tools.restoreBackup('script_include_abc123_2024.backup');
}
```

## 🛠️ Configuration

### Configuration File Structure

The configuration is stored in `sn-config.json`:

```json
{
  "instance": "dev123456.service-now.com",
  "username": "your-username",
  "password": "your-password",
  "timeout": 30000,
  "proxy": "http://proxy.example.com:8080",
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

### Configuration Management Commands

```bash
# Setup or reconfigure
node config-manager.js setup

# Test connection
node config-manager.js test

# Display current config (password hidden)
node config-manager.js display

# Export config (password redacted)
node config-manager.js export config-backup.json
```

## 📁 Directory Structure

```
SN-Updater/
├── servicenow-tools.js     # Main unified module
├── sn-tools-cli.js         # Interactive CLI interface
├── config-manager.js       # Configuration management
├── sn-config.json          # Your configuration (git-ignored)
├── temp_updates/           # Staging area for updates
│   └── *.js               # Update files
├── backups/               # Automatic backups
│   └── *.backup          # Backup files with timestamps
└── package.json          # Package configuration
```

## 🔒 Security Features

- **Credential Protection**: Passwords are never displayed in logs
- **Optional Encryption**: Configuration can be encrypted
- **Automatic Backups**: Every update creates a backup
- **Validation**: Updates are validated after execution
- **Secure API Calls**: HTTPS with basic authentication

## 🔄 Backup Management

### Automatic Backups

Every update automatically creates a backup with:
- Original value
- New value
- Timestamp
- Record metadata

### Backup Operations

```bash
# List all backups
node servicenow-tools.js list-backups

# Restore from backup
node servicenow-tools.js restore script_include_abc123_2024.backup

# Via interactive menu
sn-tools.bat → Option 5 (Backup Management)
```

## 🎨 Quick Update Workflow

1. Place your update file in `SN-Updater/temp_updates/`
2. Name it: `type_sysid_field.js`
   - Example: `script_include_abc123_script.js`
3. Run `sn-quick-update.bat` or use menu option 4
4. Confirm the update
5. File is automatically processed and can be deleted

## 📊 Supported Record Types

- `script_include` - Script Includes
- `rest_api` - REST API Operations
- `business_rule` - Business Rules
- `ui_action` - UI Actions
- `client_script` - Client Scripts

## 🚦 Status Codes

- ✓ Success - Operation completed successfully
- ⚠ Warning - Operation completed with warnings
- ✗ Error - Operation failed
- ❌ Critical - Significant failure

## 🔧 Troubleshooting

### Connection Issues
1. Run `node config-manager.js test` to test connection
2. Check firewall/proxy settings
3. Verify credentials

### Update Failures
1. Check the backup was created in `backups/`
2. Verify sys_id is correct
3. Ensure field name matches ServiceNow table schema

### Data Fetch Issues
1. Ensure proper read permissions in ServiceNow
2. Check if required directories exist
3. Verify Node.js version compatibility

## 📝 Examples

### Example: Update a Script Include

```bash
# Direct command
node servicenow-tools.js update \
  --type script_include \
  --sys_id 3c89fec44752b15098519fd8036d4327 \
  --field script \
  --file my_updated_script.js

# Or use interactive mode
sn-tools.bat → Option 3
```

### Example: Batch Operations

```javascript
// batch-update.js
const ServiceNowTools = require('./servicenow-tools');

async function batchUpdate() {
    const tools = new ServiceNowTools();
    
    const updates = [
        { type: 'script_include', sysId: 'abc123', field: 'script', file: 'update1.js' },
        { type: 'rest_api', sysId: 'def456', field: 'operation_script', file: 'update2.js' }
    ];
    
    for (const update of updates) {
        try {
            await tools.updateRecord({ ...update, autoConfirm: true });
            console.log(`✓ Updated ${update.type} ${update.sysId}`);
        } catch (error) {
            console.error(`✗ Failed to update ${update.type}: ${error.message}`);
        }
    }
}

batchUpdate();
```

## 🤝 Integration with Claude

This package is designed to work seamlessly with Claude for automated updates:

```bash
# Claude can run these directly
node claude-updater.js --type script_include --sys_id abc123 --field script --file update.js --auto-confirm
node claude-fetchers.js data
node claude-fetchers.js story
```

## 📚 API Reference

### ServiceNowTools Class

```javascript
const tools = new ServiceNowTools(configPath);

// Methods
await tools.fetchData(options)
await tools.fetchStories(options)
await tools.updateRecord(params)
await tools.getRecord(table, sysId, field)
await tools.createBackup(type, sysId, field, originalValue, newValue)
tools.listBackups(filter)
await tools.restoreBackup(backupFile, autoConfirm)
```

### ConfigManager Class

```javascript
const config = new ConfigManager(configPath);

// Methods
config.exists()
config.load()
config.save(config, encrypt)
await config.setup(options)
await config.testConnection(config)
config.validate(config)
config.display()
config.export(outputPath)
```

## 🔄 Migration from Old Scripts

If you're migrating from the old separate scripts:

1. **claude-fetchers.js** → `servicenow-tools.js fetch-data/fetch-stories`
2. **claude-updater.js** → `servicenow-tools.js update`
3. **servicenow-updater.js** → Now integrated into `servicenow-tools.js`

All existing functionality is preserved and enhanced.

## 📌 Version History

- **v2.0.0** - Unified package combining all ServiceNow tools
- **v1.x.x** - Separate scripts (deprecated)

## 📄 License

Internal use only - CadenceSoft/Tenon

---

For additional help, run `sn-tools.bat` and select option 7 (Help) or consult the team documentation.