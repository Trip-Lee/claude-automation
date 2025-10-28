# ServiceNow Data Extractor

A Node.js script for extracting ServiceNow instance data into organized JSON files for reference and analysis.

## Features

- **Config-driven extraction** - Specify tables, queries, and fields in JSON config
- **Application-based organization** - Optionally organize records by ServiceNow application scope
- **Organized output** - Creates folder per table, file per record
- **Windows-safe filenames** - Sanitizes record names for valid file paths
- **Script field focus** - Special formatting for ServiceNow script fields
- **REST API integration** - Uses ServiceNow Table API with pagination
- **Progress logging** - Detailed extraction progress and statistics
- **Error handling** - Retry logic and graceful error recovery
- **Rate limiting** - Configurable delays to respect API limits

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Credentials
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your ServiceNow credentials
notepad .env
```

### 3. Configure Tables
Edit `config.json` to specify which tables and fields to extract:

```json
{
  "instance": "your-instance.service-now.com",
  "tables": [
    {
      "name": "sys_script",
      "displayName": "Business Rules",
      "query": "active=true",
      "fields": ["name", "script", "description", "table"]
    }
  ]
}
```

### 4. Run Extraction
```bash
npm start
```

## Configuration

### Environment Variables (.env)
```bash
# Required
SN_INSTANCE=dev12345.service-now.com
SN_USERNAME=your.username
SN_PASSWORD=your.password

# Optional
CONFIG_FILE=config.json
DEBUG=true
OUTPUT_DIR=./data
```

### Config File (config.json)
```json
{
  "instance": "dev12345.service-now.com",
  "auth": {
    "username": "",
    "password": ""
  },
  "output": {
    "baseDir": "./data",
    "createTimestamp": true,
    "organizeByApplication": true
  },
  "applications": {
    "mapping": {
      "x_cadso_work": "TenonWork",
      "x_cadso_automate": "TenonAutomate",
      "x_cadso_core": "TenonCore",
      "global": "Global"
    },
    "defaultApplication": "Unknown"
  },
  "api": {
    "batchSize": 100,
    "rateLimitDelay": 1000,
    "retryAttempts": 3
  },
  "tables": [
    {
      "name": "sys_script",
      "displayName": "Business Rules",
      "query": "active=true^table!=NULL",
      "fields": [
        "sys_id",
        "name",
        "description", 
        "script",
        "when",
        "table",
        "active",
        "condition",
        "sys_scope"
      ]
    }
  ]
}
```

## Output Structure

### Standard Organization (organizeByApplication: false)
The script creates the following directory structure:

```
/data/
  /sys_script/
    Business_Rule_Name_1.json
    Business_Rule_Name_2.json
  /sys_script_include/
    Script_Include_Name_1.json
    Script_Include_Name_2.json
  extraction_metadata.json
```

### Application-Based Organization (organizeByApplication: true)
When application organization is enabled, records are grouped by their ServiceNow application scope:

```
/data/
  /TenonWork/
    /sys_script/
      Work_Business_Rule_1.json
      Work_Business_Rule_2.json
    /sys_script_include/
      Work_Script_Include_1.json
  /TenonAutomate/
    /sys_script/
      Automate_Business_Rule_1.json
    /sys_ui_script/
      Automate_UI_Script_1.json
  /Global/
    /sys_script_client/
      Global_Client_Script_1.json
  extraction_metadata.json
```

### Record Format
Each JSON file contains:

```json
{
  "_metadata": {
    "table": "sys_script", 
    "sys_id": "abc123...",
    "extracted_at": "2024-01-15T10:30:00.000Z",
    "display_value": "Business Rule Name",
    "application": "TenonWork",
    "scope": {
      "value": "x_cadso_work",
      "display_value": "TenonWork"
    }
  },
  "name": {
    "value": "Business Rule Name",
    "display_value": "Business Rule Name"
  },
  "script": {
    "value": "function onChange(current, previous) { ... }",
    "display_value": "function onChange(current, previous) { ... }",
    "formatted_script": {
      "line_count": 25,
      "char_count": 1250,
      "preview": "function onChange(current, previous) {\n    // Check if...",
      "full_script": "function onChange(current, previous) { ... }"
    }
  }
}
```

## Supported Tables

Common ServiceNow script tables included in default config:

| Table | Description | Key Fields |
|-------|-------------|------------|
| `sys_script` | Business Rules | name, script, table, when |
| `sys_script_include` | Script Includes | name, script, api_name |
| `sys_ui_script` | UI Scripts | name, script, use_scoped_format |
| `sys_script_client` | Client Scripts | name, script, table, type |

## Advanced Usage

### Custom Queries
Use encoded queries to filter records:
```json
{
  "name": "sys_script",
  "query": "active=true^table=incident^when=before",
  "fields": ["name", "script", "table"]
}
```

### Large Instance Extraction
For large instances, adjust batch size and delays:
```json
{
  "api": {
    "batchSize": 50,
    "rateLimitDelay": 2000,
    "retryAttempts": 5
  }
}
```

### Application Organization
Enable application-based folder organization by setting `organizeByApplication: true` in config:

```json
{
  "output": {
    "organizeByApplication": true
  },
  "applications": {
    "mapping": {
      "x_cadso_work": "TenonWork",
      "x_cadso_automate": "TenonAutomate",
      "x_cadso_core": "TenonCore",
      "global": "Global"
    },
    "defaultApplication": "Unknown"
  }
}
```

**Important**: Make sure to include `sys_scope` in the fields array for each table when using application organization.

### Debug Mode
Enable detailed logging:
```bash
DEBUG=true npm start
```

## Troubleshooting

### Authentication Issues
- Verify credentials in `.env` file
- Ensure user has `table_api` role
- Check if account is locked/disabled

### Rate Limiting
- Increase `rateLimitDelay` in config
- Reduce `batchSize` for slower extraction
- Monitor ServiceNow system logs

### Permission Errors
- Verify read access to target tables
- Check ACL restrictions on fields
- Use service account with appropriate roles

### File System Issues
- Ensure output directory is writable
- Check disk space for large extractions
- Verify Windows path length limits

## License

MIT

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review ServiceNow API documentation
3. Verify network connectivity and credentials