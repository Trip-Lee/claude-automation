# ServiceNow Integration Workflow

**Safe AI-Driven ServiceNow Development with Human Approval**

## Overview

This document describes the secure workflow for using claude-automation with sn-tools to modify ServiceNow instances. The workflow ensures all ServiceNow changes go through human review and approval before being pushed to production.

---

## 🔒 Security Principles

1. **AI Read-Only by Default**: AI agents can only execute read-only operations
2. **Local Modifications Only**: All AI changes are written to local files (`temp_updates/`)
3. **Human Approval Gate**: ServiceNow changes require explicit human approval
4. **No Direct API Access**: AI cannot push changes directly to ServiceNow
5. **Batch Processing**: Changes are reviewed and pushed in batches

---

## 📋 The Safe Workflow

### Phase 1: AI Fetches Data (Read-Only)

**User Task:**
```bash
dev-tools task my-sn-project "Update Script Include X to add error handling"
```

**AI Actions (Allowed):**
```bash
# Test connectivity
cd /tools/sn-tools/ServiceNow-Tools && npm run test-connections

# Fetch Script Include from ServiceNow
cd /tools/sn-tools/ServiceNow-Tools && npm run fetch-data

# Results saved to: temp_updates/script_include_abc123_script.js
```

**Result**: Local file created with current ServiceNow data ✅

---

### Phase 2: AI Modifies Local Files

**AI Actions:**
```bash
# Read local file
cat temp_updates/script_include_abc123_script.js

# Analyze and modify
# AI makes improvements to the script

# Write modified version
# Modified content written to temp_updates/script_include_abc123_script.js
```

**Result**: Local file updated with changes ✅
**ServiceNow Status**: No changes yet ✅

---

### Phase 3: Human Review

**PR Created**:
- Git diff shows changes to `temp_updates/script_include_abc123_script.js`
- User reviews the actual code modifications
- User can see exactly what will be pushed to ServiceNow

**User Decision:**
- ✅ Approve → Merge PR → Proceed to Phase 4
- ❌ Reject → Close PR → No ServiceNow changes

---

### Phase 4: Human Pushes to ServiceNow

**After PR approval**, user manually executes:

```bash
# Navigate to project
cd ~/projects/my-sn-project

# Navigate to sn-tools
cd ../claude-automation/tools/sn-tools/ServiceNow-Tools

# Review pending changes
ls temp_updates/

# Push to ServiceNow
npm run process-updates
```

**What happens:**
1. Scans all files in `temp_updates/`
2. Parses filenames: `type_sysid_field.js`
3. Pushes each to ServiceNow via API
4. Moves processed files to `temp_updates/processed/`

**Result**: ServiceNow updated ✅

---

## 🛡️ Enforcement Details

### Allowed Operations (AI Can Execute)

```yaml
# Legacy operations
- test-connections      # Verify ServiceNow connectivity
- fetch-data            # Download records to temp_updates/
- fetch-stories         # Download stories to temp_updates/
- fetch-all             # Download all configured data
- dependency-scan       # Analyze Script Include dependencies
- impact-analysis       # Analyze change impact
- generate-context      # Generate AI context
- table-fields          # Show table schema
- search-fields         # Search for fields
- table-info            # Show table information
- mapper-stats          # Show field mapper statistics

# Unified tracing (v2.3.0)
- trace-impact          # Forward trace: component → tables
- trace-backward        # Backward trace: table → components
- trace-lineage         # Full bidirectional lineage
- validate-change       # Validate change impact
- query                 # Unified query interface

# Execution context (v2.3.0)
- cache-query           # Query what happens on record operations
- cache-status          # Check cache freshness
- simulate              # Simulate record operations
```

### Forbidden Operations (Human Only)

```yaml
- process-updates       # Push temp_updates/ to ServiceNow
- watch-auto            # Auto-push file changes
- create-enhanced       # Direct record creation
```

**Enforcement**: Any attempt by AI to execute forbidden operations results in:
```
SECURITY: Operation blocked - Operation 'process-updates' requires human approval
Tool: sn-tools
Command: npm run process-updates

This operation modifies external systems and must be executed manually.
After AI completes its work and you review the changes:
  1. Review files in temp_updates/
  2. Approve the PR
  3. Manually run: cd /tools/sn-tools/ServiceNow-Tools && npm run process-updates
```

---

## 🔮 Execution Context: Understanding Side Effects

**New in v2.3.0**: Before creating or modifying records, agents can query what will happen.

### What is Execution Context?

When you insert/update/delete a record in ServiceNow, many things happen automatically:
- Business Rules fire (before, after, async)
- Fields get auto-populated
- Other records may be created/updated
- Script Includes are called

The execution context cache pre-computes this information so agents can make informed decisions.

### Querying Execution Context

```bash
# Before creating an incident
cd tools/sn-tools/ServiceNow-Tools && npm run cache-query -- incident insert

# Returns:
{
  "businessRules": [
    { "name": "Set Priority Based on Impact", "timing": "before", "fieldsModified": ["priority", "urgency"] },
    { "name": "VIP Customer Handler", "timing": "before", "fieldsModified": ["priority", "u_vip_flag"] },
    { "name": "Auto-Assign Incident", "timing": "before", "fieldsModified": ["assigned_to", "state"] },
    { "name": "Calculate SLA", "timing": "after", "scriptIncludesCalled": ["SLAUtils"] },
    { "name": "Send Notification", "timing": "async", "condition": "priority == 1" }
  ],
  "fieldsAutoSet": ["priority", "urgency", "u_vip_flag", "assigned_to", "state"],
  "tablesAffected": ["task"],
  "scriptIncludesInvolved": ["IncidentUtils", "AssignmentEngine", "SLAUtils", "NotificationService"],
  "riskLevel": "HIGH"
}
```

### How Agents Use This

1. **Before record operations**: Query execution context
2. **Understand side effects**: Know what Business Rules fire, what fields change
3. **Avoid conflicts**: Don't set fields that are auto-populated
4. **Predict cascading effects**: Know what other records are affected
5. **Assess risk**: HIGH risk operations may need extra care

### Available Execution Contexts

Check what's cached:
```bash
ls tools/sn-tools/ServiceNow-Tools/ai-context-cache/execution-chains/
# incident.insert.json
# incident.update.json
```

### MCP Tool Access

Agents can also use the `query_execution_context` MCP tool:
```
Tool: query_execution_context
Params: { table_name: "incident", operation: "insert" }
```

---

## 🎯 Example Scenarios

### Scenario 1: Update Business Rule

```bash
# User task
dev-tools task sn-prod "Fix business rule to prevent duplicate incidents"

# AI workflow:
1. npm run fetch-data
   → Downloads business rule to temp_updates/business_rule_xyz789_script.js

2. AI reads, analyzes, modifies local file
   → Adds duplicate checking logic

3. AI stops (cannot call process-updates)

# Human workflow:
4. User reviews PR → sees improved business rule code
5. User approves PR
6. User runs: npm run process-updates
7. ServiceNow updated with improved business rule
```

### Scenario 2: Create New Script Include

```bash
# User task
dev-tools task sn-dev "Create utility Script Include for date formatting"

# AI workflow:
1. AI creates new file: temp_updates/new_script_include_DateUtils.js
2. AI writes complete Script Include code
3. AI stops

# Human workflow:
4. User reviews PR → sees new Script Include
5. User approves PR
6. User creates record in ServiceNow manually OR
   User copies code from temp_updates/ and creates via UI OR
   User runs custom import script (if available)
```

**Note**: Record creation is typically done manually for new items.

### Scenario 3: Background Task

```bash
# User starts background task
dev-tools task -b sn-prod "Analyze and optimize 10 Script Includes"

# AI workflow (runs in background):
1. Fetches 10 Script Includes
2. Analyzes each
3. Creates optimized versions in temp_updates/
4. Task completes

# User workflow (later):
5. User checks: dev-tools logs <taskId>
6. User reviews: dev-tools diff sn-prod
7. User approves PR
8. User pushes: npm run process-updates
```

---

## 🚀 Background Task Support

### How It Works

**Background execution is fully supported** because:
- AI only modifies **local files** in `temp_updates/`
- No ServiceNow API calls during agent execution
- Task can run for hours without risk
- User reviews and approves afterward

**Benefits:**
- Long-running analysis tasks don't block terminal
- User can disconnect and reconnect
- Multiple tasks can run in parallel
- Review happens when convenient

---

## 📊 Batch Processing

### Single Batch Review

After AI completes multiple changes:

```bash
# Check what's pending
ls temp_updates/

# Files pending:
script_include_abc123_script.js
business_rule_def456_script.js
rest_api_ghi789_code.js

# Review all at once
git diff

# Approve all
# PR merge

# Push all to ServiceNow
npm run process-updates
```

**Benefit**: Review and push multiple changes together efficiently.

---

## ⚠️ Important Notes

### 1. AI Cannot Use sn-tools' AI Features

sn-tools has built-in AI capabilities, but claude-automation agents should NOT use them:

```bash
# ❌ DO NOT: Agent using sn-tools AI features
npm run external-ai

# ✅ CORRECT: Agent IS the AI
# Agent uses manual CLI operations only
npm run fetch-data
```

**Reason**: claude-automation agents ARE the AI. Using sn-tools' AI would be AI-to-AI, which is unnecessary and adds complexity.

### 2. temp_updates/ is Version Controlled

```bash
# Include in .gitignore if you don't want to track pending changes:
temp_updates/*.js
temp_updates/processed/

# OR commit to track pending changes (recommended):
git add temp_updates/
git commit -m "Pending ServiceNow updates for review"
```

**Recommendation**: Commit `temp_updates/` to track what's pending approval.

### 3. Development vs Production

**Best Practice**: Always test in DEV first

```bash
# Step 1: Test in development
dev-tools task sn-dev "Make changes"
# → Review, approve, push to DEV instance

# Step 2: Verify in DEV ServiceNow
# → Test the changes

# Step 3: Promote to production
dev-tools task sn-prod "Same changes"
# → Review, approve, push to PROD instance
```

### 4. Rollback Strategy

If changes cause issues after pushing to ServiceNow:

```bash
# Option A: Revert local changes
git revert <commit>
cd tools/sn-tools/ServiceNow-Tools
npm run process-updates

# Option B: Manually revert in ServiceNow UI
# Navigate to record, view history, restore previous version

# Option C: Fetch current version, fix, and re-push
npm run fetch-data
# Edit temp_updates/
npm run process-updates
```

---

## 🧪 Testing the Workflow

### Test Enforcement

```bash
# Run enforcement tests
node test/tool-enforcement.test.js

# Expected: All tests pass
# ✅ Safe operations allowed
# ✅ Forbidden operations blocked
# ✅ Error messages are helpful
```

### Test Safe Operation

```bash
# Create a test task
dev-tools task sn-dev "Test fetch workflow"

# AI should be able to:
npm run test-connections  # ✅ Works
npm run fetch-data        # ✅ Works

# AI should be blocked from:
npm run process-updates   # ❌ Blocked with helpful error
```

---

## 📈 Workflow Diagram

```
┌─────────────────┐
│  User Request   │
│  "Update SN"    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│         AI Agent (Background OK)            │
│  ┌────────────────────────────────────┐    │
│  │  1. npm run fetch-data             │    │
│  │     → temp_updates/file.js         │    │
│  │                                     │    │
│  │  2. Read, analyze, modify local    │    │
│  │     → temp_updates/file.js (mod)   │    │
│  │                                     │    │
│  │  3. STOP (no API calls)            │    │
│  └────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
         │
         │ Task completes
         │ PR created
         ▼
┌─────────────────────────────────────────────┐
│            Human Review                     │
│  ┌────────────────────────────────────┐    │
│  │  1. Review git diff                │    │
│  │  2. Read temp_updates/ changes     │    │
│  │  3. Approve or Reject              │    │
│  └────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
         │
         │ PR approved
         ▼
┌─────────────────────────────────────────────┐
│        Human Pushes to ServiceNow           │
│  ┌────────────────────────────────────┐    │
│  │  1. cd tools/sn-tools/SN-Tools     │    │
│  │  2. npm run process-updates        │    │
│  │     → Pushes to ServiceNow API     │    │
│  │     → Moves to processed/          │    │
│  └────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ ServiceNow      │
│ Updated ✅       │
└─────────────────┘
```

---

## ✅ Checklist: Safe ServiceNow Development

Before running a task:
- [ ] Verified sn-config.json is correct
- [ ] Tested connectivity: `npm run test-connections`
- [ ] Decided DEV or PROD target
- [ ] Reviewed safe_operations in tool-manifest.yaml

During AI execution:
- [ ] AI only uses safe operations
- [ ] AI modifies files in temp_updates/
- [ ] No ServiceNow API calls are made

After task completes:
- [ ] Review git diff
- [ ] Examine temp_updates/ files
- [ ] Test in DEV if needed
- [ ] Approve PR
- [ ] Manually run: `npm run process-updates`

---

## 🎓 Summary

**Key Takeaways:**
1. AI fetches and modifies **local files only**
2. **No direct ServiceNow access** for AI agents
3. **Human reviews and approves** all changes
4. **Manual push** to ServiceNow after approval
5. **Background tasks supported** because writes are local
6. **Batch processing** for efficiency
7. **Execution context** helps agents understand side effects before operations

**Result**: Safe, auditable ServiceNow development with AI assistance and human oversight.

---

## 📚 Related Documentation

- `tools/sn-tools/tool-manifest.yaml` - Full list of sn-tools commands
- `mcp/tool-schemas.js` - MCP tool definitions (8 tools available)
- `lib/dynamic-agent-executor.js` - How agents receive tool context
- `CHANGELOG.md` - Version history and feature details
