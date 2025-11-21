# Claude Automation Framework - Project Overview

**Last Updated**: 2025-11-21
**Version**: 1.0.0

---

## What This Project Is

A **multi-agent automation framework** that enables Claude Code agents to:
1. Analyze ServiceNow components and dependencies
2. Trace data lineage through UI → API → Script → Table layers
3. Generate comprehensive analysis documents
4. Validate changes and assess impact
5. Use native tool calling via MCP (Model Context Protocol)

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code CLI                          │
│                  (Orchestrates Agents)                      │
└──────────────────┬────────────────┬─────────────────────────┘
                   │                │
         ┌─────────▼───────┐   ┌───▼──────────────────┐
         │  Workflow       │   │  MCP Server          │
         │  Executor       │   │  (sn-tools)          │
         └─────────┬───────┘   └───┬──────────────────┘
                   │               │
         ┌─────────▼───────────────▼──────────────┐
         │     Enhanced sn-tools                   │
         │  (Dependency Tracing + AI Context)      │
         └─────────────────────────────────────────┘
```

### Key Components

**1. Orchestrator** (`lib/orchestrator.js`)
- Manages agent lifecycle
- Handles multi-step workflows
- Coordinates between agents

**2. Workflow System** (`lib/servicenow-workflows.js`)
- Defines multi-step analysis workflows
- Manages conversation context
- Separates data gathering from document creation

**3. MCP Server** (`mcp/sn-tools-mcp-server.js`)
- Exposes 7 ServiceNow tools via MCP protocol
- Returns structured responses with confidence scoring
- Provides actionable suggestions

**4. Enhanced sn-tools** (`tools/sn-tools/`)
- Git submodule with dependency tracing
- Enhanced with AI-context metadata
- Provides confidence scores and data quality indicators

**5. Test Framework** (`test/servicenow-component-backend-tests.js`)
- 16 comprehensive tests (855 points)
- Progressive validation with 3 checkpoints
- Validates deliverable quality

---

## Core Workflows

### SN-CB-001: Trace Component to Backend
```
Input: UI Component name (e.g., "WorkCampaignBoard")
Process: Component → APIs → Scripts → Tables
Output: Complete backend dependency analysis
```

### SN-CB-002: Trace Table Dependencies
```
Input: Table name (e.g., "x_cadso_work_campaign")
Process: Table ← Scripts ← APIs ← Components
Output: Reverse dependency chain (impact analysis)
```

### SN-CB-006: End-to-End Feature Analysis
```
Input: Feature description + table name
Process: Full system analysis + implementation plan
Output: Complete architecture + deployment plan
```

---

## Key Innovations

### 1. MCP Integration (NEW - 2025-11-21)

**Problem Solved**: Agents received data without quality indicators
- Empty results with 312h old cache → interpreted as "no dependencies"
- No way to know if results were trustworthy

**Solution**: Enhanced responses with confidence + suggestions
```json
{
  "data": {...},
  "metadata": {
    "confidence": {"level": "HIGH|MEDIUM|LOW", "score": 0.9},
    "interpretation": {"trustworthy": true, "message": "..."},
    "suggestions": [{"priority": "HIGH", "commands": [...]}]
  }
}
```

**Impact**: Agents can now make informed decisions about data quality

### 2. Conversation Context Management

**Problem Solved**: Long-running workflows hit context limits

**Solution**: Multi-step workflows with context caching
- Step 1: Data gathering (capture sn-tools outputs)
- Step 2: Document creation (use cached context)
- Reduces token usage by 40-60%

### 3. Progressive Validation

**Problem Solved**: Tests failed late, wasting time and money

**Solution**: 3-checkpoint validation
- Checkpoint 1 (30%): Quick validation during execution
- Checkpoint 2 (30%): Document structure validation
- Checkpoint 3 (40%): Content quality validation
- Early detection saves $0.40-0.60 per test

---

## Technology Stack

**Core**:
- Node.js (ES modules)
- Claude Code CLI
- JSON-RPC 2.0 (MCP protocol)

**ServiceNow Tools**:
- sn-tools v2.3.0 (git submodule)
- Enhanced with 370+ lines of AI-context methods

**Testing**:
- Custom test framework (855 points across 16 tests)
- Progressive validation
- Cost tracking

**Infrastructure**:
- Docker (for isolated test environments)
- Git submodules (sn-tools integration)
- GitHub integration (optional)

---

## Project Structure

```
claude-automation/
├── lib/                              # Core libraries
│   ├── orchestrator.js               # Agent orchestration
│   ├── servicenow-workflows.js       # Workflow definitions
│   ├── conversation-context.js       # Context management
│   ├── workflow-executor.js          # Workflow execution
│   └── agent-registry.js             # Agent configuration
│
├── mcp/                              # MCP server
│   ├── sn-tools-mcp-server.js        # Main server
│   ├── tool-schemas.js               # Tool definitions
│   ├── tool-handlers.js              # Tool execution
│   └── test-mcp-server.js            # Tests
│
├── test/                             # Test suites
│   ├── servicenow-component-backend-tests.js
│   ├── run-workflow-test.js
│   └── validation-suite.js
│
├── tools/sn-tools/                   # Git submodule
│   └── ServiceNow-Tools/
│       └── sn-unified-tracer.js      # Enhanced tracer
│
├── .claude/                          # Development guides
│   ├── PROJECT_OVERVIEW.md           # This file
│   ├── PROJECT_INSTRUCTIONS.md       # Work instructions
│   ├── CODING_STANDARDS.md           # Code standards
│   ├── API_PATTERNS.md               # API usage guide
│   ├── DEVELOPMENT_WORKFLOW.md       # Best practices
│   ├── LESSONS_LEARNED.md            # Development insights
│   └── QUICK_REFERENCE.md            # Quick patterns
│
├── docs/                             # User documentation
│   └── SERVICENOW_TESTING.md         # Testing guide
│
├── MCP_GUIDE.md                      # MCP integration guide
├── DOCUMENTATION_INDEX.md            # Doc index
└── README.md                         # Main readme
```

---

## Critical Files You'll Work With

### When Adding Features
- `lib/servicenow-workflows.js` - Add new workflows
- `lib/agent-registry.js` - Configure agents
- `test/servicenow-component-backend-tests.js` - Add tests

### When Fixing Bugs
- `lib/orchestrator.js` - Agent lifecycle issues
- `lib/workflow-executor.js` - Workflow execution issues
- `lib/conversation-context.js` - Context management issues

### When Updating MCP
- `mcp/tool-schemas.js` - Add/modify tool schemas
- `mcp/tool-handlers.js` - Update tool implementation
- `mcp/sn-tools-mcp-server.js` - Server functionality

### When Enhancing sn-tools
- `tools/sn-tools/ServiceNow-Tools/sn-unified-tracer.js` - Core tracer
- Must commit to sn-tools repo separately
- Then update submodule in claude-automation

---

## Performance Characteristics

### Test Execution
- Single workflow test: 5-15 minutes
- Full test suite (16 tests): 2-4 hours
- Smoke tests: < 5 seconds

### Cost per Test
- Simple test: $0.20-0.40
- Complex test: $0.60-1.20
- Full suite: $10-15

### Token Usage
- With context caching: 40-60% reduction
- Average per workflow: 50,000-150,000 tokens

---

## Common Tasks

### Run a Single Test
```bash
node test/run-workflow-test.js SN-CB-001
```

### Run Full Test Suite
```bash
npm run test:servicenow
```

### Test MCP Server
```bash
node mcp/test-mcp-server.js
```

### Test Enhanced sn-tools
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run trace-impact -- WorkCampaignBoard
```

### Update sn-tools Submodule
```bash
cd tools/sn-tools
git pull
cd ../..
git add tools/sn-tools
git commit -m "Update sn-tools submodule"
```

---

## Development Philosophy

1. **Test-Driven**: Always add tests before features
2. **Documentation-First**: Update docs before/during implementation
3. **Cost-Aware**: Monitor token usage and API costs
4. **Progressive**: Validate early and often
5. **Context-Efficient**: Cache and reuse context where possible

---

## Success Metrics

### Test Scores
- **Target**: 75-85% pass rate
- **Current Baseline**: 56-70% (with stale cache)
- **With MCP + Fresh Cache**: Expected 75-85%

### Quality Indicators
- All required sections present in deliverables
- Security analysis included
- Performance analysis included
- Risk assessment with all subsections
- Effort estimation with time/cost
- Implementation dependencies documented

### Efficiency Metrics
- < 15 minutes per workflow test
- < 4 hours for full suite
- < $15 cost for full suite
- 40-60% token reduction from caching

---

## Quick Reference

**Start of Session**:
1. Check `.claude/QUICK_REFERENCE.md`
2. Read `.claude/PROJECT_INSTRUCTIONS.md`
3. Review recent changes in git log

**During Development**:
1. Follow `.claude/CODING_STANDARDS.md`
2. Reference `.claude/API_PATTERNS.md`
3. Check `.claude/LESSONS_LEARNED.md` for past solutions

**Before Committing**:
1. Run tests: `npm run test:servicenow`
2. Update documentation
3. Check `.claude/DOCUMENTATION_CHECKLIST.md`

---

**For more details, see**:
- MCP Integration: `MCP_GUIDE.md`
- Testing: `docs/SERVICENOW_TESTING.md`
- Development Workflow: `.claude/DEVELOPMENT_WORKFLOW.md`
