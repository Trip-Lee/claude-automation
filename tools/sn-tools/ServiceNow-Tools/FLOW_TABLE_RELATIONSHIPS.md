# ServiceNow Flow Table Relationships

## Quick Reference for Flow Analysis

When analyzing a flow like "Send Email V3", always check these tables in order:

### 1. Main Flow Record
**Table:** `sys_hub_flow`
- Contains: Flow metadata, status, version info
- Key Fields:
  - `name`: Flow name
  - `latest_snapshot`: Points to most recent snapshot
  - `master_snapshot`: Current active snapshot
  - `remote_trigger_id`: Links to trigger record

### 2. Flow Snapshot (MOST IMPORTANT FOR ANALYSIS)
**Table:** `sys_hub_flow_block` or `sys_hub_flow_snapshot`
- Contains: The actual flow definition and steps
- Key Fields:
  - `name`: Snapshot name (usually matches flow name)
  - `sys_updated_on`: When snapshot was last modified
  - `label_cache`: Contains all the flow steps and connections
- **Always look for the most recent by sys_updated_on**

### 3. Trigger Records
**Tables:**
- `sys_flow_trigger` - Base trigger record
- `sys_flow_record_trigger` - For record-based triggers
- `sys_flow_timer_trigger` - For scheduled triggers
- `sys_flow_rest_trigger` - For REST API triggers

**Key Fields for Record Triggers:**
- `table`: Which table triggers the flow
- `condition`: The trigger condition (e.g., "statusCHANGESTOsend-ready")
- `on_insert`: Triggers on new records
- `on_update`: Triggers on updates
- `active`: Whether trigger is enabled

### 4. Supporting Tables
- `sys_hub_flow_logic_instance_v2` - Individual action instances
- `sys_hub_flow_logic_variable` - Flow variables
- `sys_hub_flow_input` - Flow input parameters
- `sys_hub_flow_output` - Flow output parameters

## How to Find the Latest Flow Snapshot

### Method 1: Using the Helper Script
```bash
cd ServiceNow-Tools
node flow-lookup-helper.js "Send Email V3"
```

### Method 2: Manual Search
1. Find flow in `sys_hub_flow` to get flow sys_id
2. Look in `sys_hub_flow_block` for all snapshots with matching name
3. Sort by `sys_updated_on` to find the latest
4. Use the flow's `remote_trigger_id` to find trigger details

## Key Relationships

```
sys_hub_flow (Main Flow)
    ├── latest_snapshot → sys_hub_flow_block
    ├── master_snapshot → sys_hub_flow_block
    └── remote_trigger_id → sys_flow_trigger
            └── (extends to) → sys_flow_record_trigger
                    └── table (e.g., x_cadso_automate_email_send)
                    └── condition (e.g., statusCHANGESTOsend-ready)
```

## For "Send Email V3" Specifically

- **Latest Snapshot:** `e7e5a341336baa107b18bc534d5c7b9e` (as of 2025-08-26)
- **Main Flow:** `cdabd378c3402210d4ddf1db05013155`
- **Trigger:** `8723f448c3fbca5085b196c4e40131df`
- **Trigger Condition:** `status CHANGES TO send-ready` on table `x_cadso_automate_email_send`

## Tips for Flow Analysis

1. **Always start with the latest snapshot** - It contains the actual flow logic
2. **Check the trigger condition** - Understand when the flow runs
3. **Review the label_cache** - Contains all steps and their connections
4. **Look for patterns** in step names:
   - Numbers indicate sequence (e.g., "2 - Get All Merge Tags")
   - "For Each" indicates loops
   - "Look Up" indicates database queries
   - "Create Record" indicates data creation

## Common Flow Patterns in Tenon

- **Email Flows**: Usually trigger on status changes, process audiences, handle consent
- **Journey Flows**: Often have complex branching and state management
- **Work Management Flows**: Typically involve task creation and updates
- **Marketing Automation**: Heavy use of audience processing and personalization