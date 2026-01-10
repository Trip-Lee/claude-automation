# ServiceNow Tools MCP Server

Model Context Protocol (MCP) server that exposes sn-tools capabilities as native tools for Claude Code.

## Features

This MCP server provides 7 tools for ServiceNow dependency analysis:

1. **trace_component_impact** - Trace UI component forward to APIs, scripts, tables
2. **trace_table_dependencies** - Trace table backward to components that depend on it
3. **trace_full_lineage** - Get complete bidirectional lineage for any entity
4. **validate_change_impact** - Validate impact of proposed changes
5. **query_table_schema** - Get table schema and relationships
6. **analyze_script_crud** - Analyze Script Include CRUD operations
7. **refresh_dependency_cache** - Refresh dependency cache (manual command required)

## Architecture

```
mcp/
├── sn-tools-mcp-server.js    # Main MCP protocol server (stdio-based)
├── tool-schemas.js            # MCP tool definitions
├── tool-handlers.js           # Tool execution logic
├── test-mcp-server.js         # Standalone test script
└── README.md                  # This file
```

## How It Works

1. **MCP Server** (`sn-tools-mcp-server.js`)
   - Implements JSON-RPC 2.0 over stdio
   - Handles initialize, tools/list, tools/call, ping requests
   - Dispatches tool calls to handlers

2. **Tool Schemas** (`tool-schemas.js`)
   - Defines MCP tool schemas with inputSchema
   - Provides tool descriptions for Claude

3. **Tool Handlers** (`tool-handlers.js`)
   - Implements execution logic for each tool
   - Calls into enhanced sn-tools UnifiedTracer
   - Returns structured responses with confidence/suggestions

4. **Enhanced sn-tools** (`tools/sn-tools/ServiceNow-Tools/sn-unified-tracer.js`)
   - Provides AI-context enhancement
   - Returns confidence scores, interpretation, actionable suggestions
   - Helps agents make informed decisions

## Configuration

### Option 1: Claude Code CLI Configuration (Recommended)

Add to Claude Code settings:

```json
{
  "mcpServers": {
    "sn-tools": {
      "command": "node",
      "args": ["/home/coltrip/claude-automation/mcp/sn-tools-mcp-server.js"],
      "env": {}
    }
  }
}
```

### Option 2: Programmatic Usage

```javascript
import { spawn } from 'child_process';

const server = spawn('node', ['mcp/sn-tools-mcp-server.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send JSON-RPC requests to server.stdin
// Receive JSON-RPC responses from server.stdout
```

## Testing

### Standalone Test

```bash
cd /home/coltrip/claude-automation
node mcp/test-mcp-server.js
```

Expected output:
```
✓ Initialize response: {...}
✓ Tools list response: Found 7 tools
✓ Tool call response received: Success: true
✓ Ping response: {...}
✅ All tests passed!
```

### Test with Claude Code

Once configured in Claude Code settings:

```
Ask Claude: "Use trace_component_impact to analyze the WorkCampaignBoard component"
```

Claude will:
1. Call the `trace_component_impact` tool
2. Receive enhanced results with confidence/suggestions
3. Interpret the data quality and decide next actions

## Enhanced Response Format

All tools return enhanced responses with:

```json
{
  "success": true,
  "error": null,
  "data": {
    "apis": [...],
    "scripts": [...],
    "tables": [...],
    "metadata": {
      "timestamp": "2025-11-21T00:00:00Z",
      "cacheUsed": true,
      "dataSource": {
        "type": "dependency-cache",
        "ageHours": 8.5,
        "lastBuilt": "2025-11-20T15:30:00Z",
        "freshness": "FRESH"
      },
      "confidence": {
        "level": "HIGH",
        "score": 0.9,
        "factors": ["Cache is fresh (8.5 hours old)", "Results are complete"]
      },
      "interpretation": {
        "isEmpty": false,
        "likelyReason": "FOUND_DEPENDENCIES",
        "reliability": "RELIABLE",
        "trustworthy": true,
        "message": "Found 3 APIs, 5 scripts, 2 tables with high confidence"
      },
      "suggestions": []
    },
    "_aiContext": {
      "shouldTrustResults": true,
      "requiredAction": "NONE",
      "confidenceLevel": "HIGH",
      "nextSteps": "Proceed with analysis of found dependencies"
    }
  }
}
```

## Tool Examples

### Example 1: Trace Component Impact

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "trace_component_impact",
    "arguments": {
      "component_name": "WorkCampaignBoard"
    }
  }
}
```

Response includes:
- APIs accessed by component
- Script Includes used
- Database tables queried
- Confidence level and data quality assessment

### Example 2: Validate Change Impact

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "validate_change_impact",
    "arguments": {
      "change_type": "table",
      "target": "x_cadso_work_campaign",
      "operation": "modify",
      "description": "Adding new field 'priority'"
    }
  }
}
```

Response includes:
- Impact analysis (warnings, errors)
- Affected components
- Risk assessment
- Recommended actions

### Example 3: Query Table Schema

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "query_table_schema",
    "arguments": {
      "table_name": "incident"
    }
  }
}
```

Response includes:
- Table fields and types
- Reference fields
- Relationships
- Extended tables

## Debugging

### Enable Verbose Logging

Server logs are written to stderr (not stdout which is used for protocol):

```bash
node mcp/sn-tools-mcp-server.js 2> mcp-server.log
```

### Common Issues

1. **"enhanceWithAIContext is not a function"**
   - sn-tools submodule not updated
   - Solution: `cd tools/sn-tools && git pull`

2. **"Unknown tool: xyz"**
   - Tool name mismatch
   - Check available tools with `tools/list` request

3. **Empty results with stale cache**
   - This is expected behavior
   - Response will include LOW confidence and MANUAL_INVESTIGATION suggestion
   - Agent should execute suggested commands

## Version History

- **1.0.0** (2025-11-21)
  - Initial MCP implementation
  - 7 tools with enhanced AI context
  - Confidence scoring and actionable suggestions
  - Integration with claude-automation workflows

## Next Steps

After MCP server is configured:

1. Update workflows in `lib/servicenow-workflows.js`
   - Replace bash command instructions with MCP tool guidance

2. Update test validation in `test/servicenow-component-backend-tests.js`
   - Check for `tool_use` messages instead of bash outputs
   - Parse `tool_result` content for success criteria

3. Run integration tests
   - Verify 75-85% score improvement
   - Validate agents make better decisions with enhanced context

## Related Files

- `/home/coltrip/projects/sn-tools/ServiceNow-Tools/sn-unified-tracer.js` - Enhanced UnifiedTracer (source)
- `/home/coltrip/claude-automation/tools/sn-tools/` - sn-tools submodule (used by MCP server)
- `/home/coltrip/claude-automation/MCP_IMPLEMENTATION_PROGRESS.md` - Implementation progress tracker
- `/home/coltrip/claude-automation/CLAUDE_TOOLS_ARCHITECTURE_ANALYSIS.md` - Architecture analysis
