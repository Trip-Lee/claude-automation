# Execution Context System

The Execution Context System provides agents with pre-computed information about what happens when performing record operations (insert, update, delete) on ServiceNow tables. This enables agents to make informed decisions before modifying data.

## Overview

When an agent needs to create, update, or delete a record, the execution context tells them:
- **Business Rules** that will fire (before, after, async phases)
- **Execution Order** (which rules run first)
- **Cascading Effects** (other tables that may be affected)
- **Risk Level** (HIGH, MEDIUM, LOW based on complexity)
- **Fields Auto-Set** (fields modified by business rules)

## How It Works

### 1. Pre-Computed Execution Chains

Execution chains are pre-computed and stored in:
```
tools/sn-tools/ServiceNow-Tools/ai-context-cache/execution-chains/
```

Each file follows the pattern: `{table_name}.{operation}.json`

Example: `x_cadso_automate_email.insert.json`

### 2. Chain Structure

```json
{
  "table": "x_cadso_automate_email",
  "operation": "insert",
  "businessRules": [
    {
      "name": "Set Audience Tables",
      "sys_id": "3ea6e3f3c3a1ea10d4ddf1db05013172",
      "timing": "before",
      "order": -100,
      "active": true,
      "operations": { "insert": true, "update": true, "delete": false },
      "condition": "sourcesVALCHANGES^EQ"
    }
  ],
  "phases": {
    "before": [...],
    "after": [...],
    "async": [...]
  },
  "fieldsAutoSet": [],
  "tablesAffected": [],
  "scriptIncludesInvolved": [],
  "riskLevel": "HIGH"
}
```

### 3. Risk Level Calculation

| Risk Level | Criteria |
|------------|----------|
| HIGH | 10+ BRs, or async rules, or cascading tables |
| MEDIUM | 5-9 BRs |
| LOW | 1-4 BRs |

## How Agents Use Execution Context

### Method 1: MCP Tool (Recommended)

Agents can use the `query_execution_context` MCP tool:

```json
{
  "tool": "query_execution_context",
  "parameters": {
    "table_name": "x_cadso_automate_email",
    "operation": "insert"
  }
}
```

Response:
```json
{
  "success": true,
  "table": "x_cadso_automate_email",
  "operation": "insert",
  "execution_context": {
    "business_rules": [...],
    "risk_level": "HIGH"
  },
  "summary": {
    "total_business_rules": 11,
    "before_rules": 6,
    "after_rules": 5,
    "async_rules": 0
  }
}
```

### Method 2: Bash Command

```bash
cd tools/sn-tools/ServiceNow-Tools
npm run cache-query -- x_cadso_automate_email insert
```

### Method 3: Natural Discovery (Agent Injection)

ServiceNow agents (`sn-api`, `sn-scripting`) automatically receive execution context hints in their prompts through `DynamicAgentExecutor.getAvailableExecutionContext()`.

## Agent Best Practices

### Before Creating Records

1. **Query execution context** for the target table
2. **Analyze risk level** - HIGH risk operations need extra care
3. **Understand cascading effects** - know what other tables will be affected
4. **Plan for before/after phases** - understand field auto-population

Example agent workflow:
```
1. Agent receives task: "Create a new email record"
2. Agent queries: query_execution_context(table="x_cadso_automate_email", operation="insert")
3. Agent sees: 11 BRs, Risk=HIGH, cascades to email_send table
4. Agent plans accordingly and proceeds safely
```

### Before Bulk Operations

For bulk updates (e.g., updating 50 records):

1. Query execution context for UPDATE
2. Calculate cumulative impact: `50 records × 10 BRs = 500 BR executions`
3. Assess performance impact
4. Consider batching strategy
5. Make GO/NO-GO decision

### Handling Unknown Tables

If a table has no cached execution context:
- The MCP tool returns `success: false` with a helpful error
- Agent should proceed with caution
- Consider running `npm run cache-build` to generate chains

## Generating Execution Chains

### Full Rebuild

```bash
cd tools/sn-tools/ServiceNow-Tools
npm run cache-build
```

This:
1. Loads business rules from `test-data/business_rules.json`
2. Loads additional rules from `ai-context-cache/computed-cache.json`
3. Builds execution chains for each table/operation combination
4. Saves to `ai-context-cache/execution-chains/`

### Data Sources

1. **business_rules.json**: Test data with rich BR details
2. **computed-cache.json**: Dependency tracker output with 300+ BRs

## Testing

### Run All Execution Context Tests

```bash
# Infrastructure + edge case tests
node test/execution-context-test.js

# Simulation tests (no API calls)
node test/execution-context-simulation-test.js

# Full agent integration tests (uses API)
node test/run-execution-context-tests.js
```

### Test Categories

| Test | Description |
|------|-------------|
| Cache Exists | Verifies execution chains are present |
| Query Command | Tests npm run cache-query |
| Logging Setup | Verifies tracking/logging in executor |
| MCP Handler | Tests query_execution_context handler |
| Non-existent Table | Edge case: unknown tables |
| DELETE Operation | Edge case: delete chains |
| MCP Invalid Params | Edge case: parameter validation |
| Data Quality | Validates chain structure |

## Architecture

```
┌─────────────────────┐
│   Agent Request     │
│ "Create email record" │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ DynamicAgentExecutor │
│ getAvailableContext()│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  MCP Tool Handler   │
│ query_execution_context │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Execution Chains   │
│ ai-context-cache/   │
│ execution-chains/   │
└─────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `sn-context-cache.js` | Builds and loads execution chains |
| `mcp/tool-handlers.js` | QueryExecutionContextHandler |
| `lib/dynamic-agent-executor.js` | Context injection & tracking |
| `test/execution-context-test.js` | Integration tests |
| `test/execution-context-simulation-test.js` | Unit tests |

## Metrics & Logging

The system tracks:
- **Discovery**: Which tables have cached execution chains
- **Injection**: Which agents received execution context hints
- **Usage**: Which agents actually queried execution context
- **Usage Rate**: % of injected agents that used the context

View metrics in agent execution summary or via:
```javascript
executor.getExecutionContextSummary()
```

## Troubleshooting

### No execution context for table X

1. Check if chain exists: `ls ai-context-cache/execution-chains/ | grep table_name`
2. If missing, rebuild: `npm run cache-build`
3. Verify BRs exist in computed-cache.json or business_rules.json

### Agent not using execution context

1. Check if agent is SN-type (`sn-api`, `sn-scripting`)
2. Verify `getAvailableExecutionContext()` returns data
3. Check logging for `[ExecContext]` messages

### Outdated execution chains

When new business rules are added:
1. Update `computed-cache.json` via dependency tracker
2. Rebuild chains: `npm run cache-build`
3. Commit new chains to repo
