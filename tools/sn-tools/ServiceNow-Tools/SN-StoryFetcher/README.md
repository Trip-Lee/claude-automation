# ServiceNow Data Fetcher & Analyzer

A utility to fetch data from ServiceNow instances and save it locally for offline development and analysis, plus tools to analyze and work with the fetched data.

## Features

- Connect to ServiceNow instance using REST API
- Query any table with encoded query support
- Save records as JSON files for offline work
- Organize data by table and timestamp
- Create individual record files for easy navigation
- Support for field filtering
- Secure credential handling (passwords not saved)

## Installation

1. Ensure Node.js is installed (v12.22.12 for ServiceNow compatibility)
2. Navigate to the SN-DataFetcher directory
3. Run `npm init -y` to create package.json if needed

## Usage

### Basic Usage

Run the fetcher interactively:

```bash
node sn-fetcher.js
```

You'll be prompted for:
- ServiceNow instance name (e.g., dev123456)
- Username
- Password (hidden input)
- Table name
- Query (optional)
- Fields to retrieve (optional)
- Maximum records

### Configuration File

Create a `sn-config.json` file based on `sn-config.example.json`:

```json
{
  "instance": "your-instance-name",
  "username": "your.username",
  "outputDir": "./sn-data"
}
```

**Note:** Never store passwords in the config file. You'll be prompted for the password when running.

### Examples

#### Fetch all active incidents:
```
Table name: incident
Query: active=true
Fields: number,short_description,state,priority
Maximum records: 100
```

#### Fetch specific user:
```
Table name: sys_user
Query: user_name=john.doe
Fields: (leave empty for all fields)
Maximum records: 1
```

#### Fetch script includes:
```
Table name: sys_script_include
Query: name CONTAINS Utils
Fields: name,api_name,script
Maximum records: 50
```

## Output Structure

Data is saved in the following structure:

```
sn-data/
├── incident/
│   ├── index.json                          # Index of all fetches
│   ├── incident_active_true_2024-01-15.json # Main data file
│   └── records_2024-01-15/                 # Individual records
│       ├── 0_INC0001234.json
│       ├── 1_INC0001235.json
│       └── ...
├── sys_user/
│   ├── index.json
│   └── sys_user_2024-01-15.json
└── ...
```

## File Formats

### Main Data File
Contains an array of all fetched records:
```json
[
  {
    "sys_id": "abc123",
    "number": "INC0001234",
    "short_description": "Issue description",
    ...
  }
]
```

### Index File
Tracks all fetches for a table:
```json
{
  "incident_active_true_2024-01-15.json": {
    "timestamp": "2024-01-15T10:30:00Z",
    "query": "active=true",
    "count": 50,
    "fields": ["number", "short_description", ...]
  }
}
```

### Individual Record Files
Each record saved separately for easy access (only for ≤100 records).

## Security Notes

- **Never commit sn-data/ directory to version control**
- **Never save passwords in configuration files**
- **Use .gitignore to exclude sensitive data**
- Consider using environment variables for credentials in automated scripts
- Data files may contain sensitive information - handle appropriately

## Common Queries

### Incident Queries
- `active=true` - All active incidents
- `state=1` - New incidents
- `priority=1^ORpriority=2` - High and critical priority
- `assigned_to=javascript:gs.getUserID()` - Assigned to current user

### User Queries
- `active=true` - Active users
- `department=IT` - Users in IT department
- `roles CONTAINS admin` - Users with admin role

### Script Include Queries
- `active=true^accessible=true` - Active and accessible
- `name CONTAINS Utils` - Utility scripts
- `sys_created_on>javascript:gs.daysAgo(7)` - Created in last week

## Troubleshooting

### Connection Issues
- Verify instance name (don't include .service-now.com)
- Check username and password
- Ensure your account has REST API access
- Check if instance is awake (for dev instances)

### Query Issues
- Test queries in ServiceNow first
- Encode special characters properly
- Use field names, not labels

### Data Issues
- Check field permissions in ServiceNow
- Verify table access rights
- Some fields may require elevated privileges

## Working with Fetched Data

Once data is fetched, you can:
1. Open JSON files in any editor
2. Process with scripts
3. Import into other tools
4. Use for offline development
5. Analyze patterns and relationships

## Data Analyzer

Once data is fetched, use the analyzer to work with it:

```bash
node sn-analyzer.js
```

### Analyzer Features

1. **Analysis Summary**: Get statistics about your data
   - Total records and fields
   - Reference field identification
   - Empty field detection
   - State breakdown

2. **Display Records**: View records in formatted output
   - Customizable field selection
   - State mapping for readability
   - Pagination support

3. **Generate Story Summary**: Create markdown documentation
   - Groups stories by state
   - Includes descriptions and Figma links
   - Perfect for sprint planning

4. **Export to CSV**: Convert JSON data to CSV format
   - All fields included
   - Proper escaping for Excel compatibility
   - Reference fields resolved

5. **Filter by State**: View records in specific states
   - Uses state mapping from config
   - Helpful for workflow analysis

6. **Custom Field Display**: Choose which fields to view
   - Reduces clutter
   - Focus on relevant data

## Configuration Enhancements

The config now supports:
- **State Mapping**: Human-readable state names
- **Always includes**: sys_id, number fields for better tracking
- **Multiple tables**: Configure defaults for different tables

## Future Enhancements

- [x] Data analyzer tool
- [x] CSV export
- [x] State mapping
- [ ] Batch fetch multiple tables
- [ ] Attachment download support
- [ ] Incremental fetch (only new/modified records)
- [ ] Relationship mapping and fetch
- [ ] OAuth support
- [ ] Proxy configuration