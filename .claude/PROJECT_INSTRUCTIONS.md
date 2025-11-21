# Project Instructions - Claude Automation Framework

**Version**: 1.0.0
**Last Updated**: 2025-11-21
**Applies To**: All Claude sessions working on this project

---

## Overview

These instructions apply to **every session** in this project. They ensure consistency, quality, and alignment with project goals.

**Before you start working**: Read these instructions carefully and follow them throughout the session.

---

## Session Startup Checklist

### 1. Context Loading (Automatic)

When you start a Claude session in this project, the following knowledge files are **automatically loaded**:

- `.claude/PROJECT_OVERVIEW.md` - Architecture and components
- `.claude/CODING_STANDARDS.md` - Code standards and patterns
- `.claude/API_PATTERNS.md` - API usage guides
- `.claude/DEVELOPMENT_WORKFLOW.md` - Development practices
- `.claude/LESSONS_LEARNED.md` - Past solutions and mistakes
- `.claude/QUICK_REFERENCE.md` - Quick patterns reference
- `MCP_GUIDE.md` - MCP integration documentation
- `docs/SERVICENOW_TESTING.md` - Testing guide

You don't need to read these manually - they're already in your context.

### 2. Validate System Health (Required)

Before making any changes, verify the system is working:

```bash
# Quick validation (run this first)
node test/smoke-test.js

# If smoke tests pass, you're ready to work
# If they fail, investigate before proceeding
```

**Why**: Never build on a broken foundation. Always start from a working state.

### 3. Check Git Status

```bash
git status
git log --oneline -5
```

**Why**: Understand what's changed recently and what state the repository is in.

---

## Core Work Principles

### 1. Test-Driven Development

**Always follow this order**:

1. **Understand** - Read relevant code and documentation
2. **Plan** - Use TodoWrite tool for complex tasks
3. **Test** - Write or identify test that validates the change
4. **Implement** - Make the actual code changes
5. **Verify** - Run tests to confirm it works
6. **Document** - Update relevant documentation

**Never**:
- Write code without understanding existing patterns
- Skip tests "to save time"
- Commit without running smoke tests

### 2. Documentation-First Approach

**Update documentation WHILE coding, not after**:

- Modified a workflow? Update workflow documentation
- Added a feature? Update CHANGELOG.md
- Fixed a bug? Document the fix in CHANGELOG.md
- Changed an API? Update API_PATTERNS.md

**Why**: Documentation updated "later" rarely gets updated at all.

### 3. Cost-Aware Development

This project uses Claude API calls which have real costs:

- **Smoke tests**: Nearly free (< $0.01)
- **Single workflow test**: $0.20-0.40
- **Full test suite**: $10-15

**Best practices**:
- Run smoke tests frequently (they're cheap)
- Run full workflow tests only when necessary
- Use conversation context caching when possible
- Monitor token usage in test outputs

---

## MCP Tools Usage

### When to Use MCP Tools

**PREFER MCP tools** when:
- Tracing ServiceNow component dependencies
- Analyzing table relationships
- Validating change impact
- Querying table schemas
- Analyzing script CRUD operations
- Getting structured responses with confidence scores

**Example**:
```javascript
// Use MCP tool for structured response
const result = await mcp.trace_component_impact({ component_name: 'WorkCampaignBoard' });
// Returns: data + metadata with confidence scores and suggestions
```

### When to Use Bash Commands

**PREFER bash commands** when:
- Running sn-tools for raw output
- Debugging MCP server
- Quick one-off queries
- Testing enhanced sn-tools directly

**Example**:
```bash
cd tools/sn-tools/ServiceNow-Tools
npm run trace-impact -- WorkCampaignBoard
```

### MCP Tools Available

All 7 sn-tools are available via MCP:

1. `trace_component_impact` - UI component → dependencies
2. `trace_table_dependencies` - Table → reverse dependencies
3. `trace_full_lineage` - Complete forward + backward trace
4. `validate_change_impact` - Assess change impact
5. `query_table_schema` - Get table structure
6. `analyze_script_crud` - Script CRUD operations
7. `refresh_dependency_cache` - Update cached data

**See**: `MCP_GUIDE.md` for complete documentation

---

## Code Standards (Critical)

### Module System

**ALWAYS use ES modules**:

```javascript
// ✅ CORRECT
import { Orchestrator } from './lib/orchestrator.js';
export class MyClass { }

// ❌ WRONG
const Orchestrator = require('./lib/orchestrator.js');
module.exports = MyClass;
```

### Async/Await

**ALWAYS use async/await** for asynchronous code:

```javascript
// ✅ CORRECT
async function runWorkflow(agent, workflow) {
  try {
    const result = await executor.executeWorkflow(agent, workflow);
    return result;
  } catch (error) {
    console.error('Workflow failed:', error);
    throw error;
  }
}

// ❌ WRONG
function runWorkflow(agent, workflow) {
  return executor.executeWorkflow(agent, workflow)
    .then(result => result)
    .catch(error => console.error(error));
}
```

### Error Handling

**ALWAYS cleanup resources**:

```javascript
// ✅ CORRECT
let container;
try {
  container = await dockerManager.create({ ... });
  await dockerManager.exec(container, 'some command');
} finally {
  if (container) {
    await dockerManager.stop(container);
    await dockerManager.remove(container);
  }
}

// ❌ WRONG
const container = await dockerManager.create({ ... });
await dockerManager.exec(container, 'some command');
// No cleanup!
```

### API Usage (Critical!)

**DockerManager.exec() returns string, not object**:

```javascript
// ✅ CORRECT
const output = await dockerManager.exec(container, 'ls -la');
console.log(output);  // Direct string

// ❌ WRONG
const result = await dockerManager.exec(container, 'ls -la');
console.log(result.stdout);  // Error: undefined
```

**See**: `.claude/CODING_STANDARDS.md` for complete standards

---

## Testing Requirements

### Before ANY Commit

**ALWAYS run smoke tests**:

```bash
node test/smoke-test.js
```

**Success criteria**: All tests pass (✅)
**If tests fail**: Fix the issue before committing

### Before Major Changes

**Run full workflow test**:

```bash
# Test specific workflow
node test/run-workflow-test.js SN-CB-001

# Or run validation suite
node test/validation-suite.js
```

### Test Structure (When Adding Tests)

**Use AAA pattern**:

```javascript
async function test_workflow_execution() {
  // Arrange
  const workflow = getWorkflow('SN-CB-001');
  const agent = createTestAgent();

  // Act
  const result = await executor.executeWorkflow(agent, workflow);

  // Assert
  if (!result.success) {
    throw new Error('Workflow should succeed');
  }
}
```

**See**: `.claude/CODING_STANDARDS.md` Testing Standards section

---

## Git Commit Standards

### Commit Message Format

**Use conventional commits**:

```bash
<type>: <short description>

Detailed explanation of what and why.

- Bullet point changes
- Include file references
```

**Types**:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance

**Examples**:

```bash
✅ CORRECT:
git commit -m "feat: Add MCP server for sn-tools integration"
git commit -m "fix: Handle null results in workflow executor"
git commit -m "docs: Update MCP guide with troubleshooting"

❌ WRONG:
git commit -m "updates"
git commit -m "Fixed stuff"
git commit -m "WIP"
```

### What to Commit

**Always include**:
- Code changes
- Related tests
- Updated documentation
- Updated CHANGELOG.md (if applicable)

**Never commit**:
- node_modules/
- .env files
- IDE-specific files (.vscode/, .idea/)
- Temporary files (*.tmp, *.log)
- Generated files

---

## Common Workflows

### Adding a New Feature

1. **Read** relevant existing code
2. **Plan** using TodoWrite tool
3. **Write test** that validates the feature
4. **Implement** the feature following coding standards
5. **Run tests** (smoke + specific)
6. **Update docs** (CHANGELOG.md, relevant .md files)
7. **Commit** with good message

### Fixing a Bug

1. **Reproduce** the bug
2. **Write test** that exposes the bug
3. **Fix** the bug
4. **Verify** test now passes
5. **Run smoke tests**
6. **Update** CHANGELOG.md
7. **Commit** with fix: message

### Modifying Workflows

1. **Read** existing workflow in `lib/servicenow-workflows.js`
2. **Update** workflow definition
3. **Test** with `node test/run-workflow-test.js <workflow-id>`
4. **Verify** deliverable quality
5. **Update** workflow documentation
6. **Run smoke tests**
7. **Commit**

### Enhancing sn-tools

**IMPORTANT**: sn-tools is a git submodule

1. **Navigate** to submodule: `cd tools/sn-tools/ServiceNow-Tools`
2. **Make changes** to sn-unified-tracer.js
3. **Test** enhanced functionality
4. **Commit** in submodule repository
5. **Return** to main repo: `cd ../../..`
6. **Update** submodule reference: `git add tools/sn-tools`
7. **Commit** in main repo
8. **Push** both repositories

**See**: `MCP_GUIDE.md` section on "Updating Enhanced sn-tools"

---

## Documentation Checklist

### Before Every Commit

- [ ] Code changes match coding standards
- [ ] Tests added/updated for changes
- [ ] Smoke tests pass
- [ ] CHANGELOG.md updated (if feature/fix)
- [ ] Relevant .md files updated
- [ ] No console.log left in production code

### Before Every Session End

- [ ] All changes committed
- [ ] Documentation up to date
- [ ] Tests passing
- [ ] No orphaned Docker containers
- [ ] Work is in a stable state

### Before Pushing to GitHub

- [ ] Full validation passes
- [ ] All documentation updated
- [ ] Commit messages are clear
- [ ] No sensitive data in commits
- [ ] .gitignore is correct

---

## Troubleshooting Guide

### Tests Failing

**Step 1**: Run smoke tests to identify which category is failing

```bash
node test/smoke-test.js
```

**Step 2**: Check recent changes

```bash
git diff
git log --oneline -5
```

**Step 3**: Review error messages and check:
- Docker running? `docker ps`
- Correct imports? Check file paths include `.js` extension
- API usage? Check API_PATTERNS.md

### MCP Server Issues

**Check server is working**:

```bash
cd /home/coltrip/claude-automation
node mcp/test-mcp-server.js
```

**Common issues**:
- Tool schema errors → Check `mcp/tool-schemas.js`
- Handler errors → Check `mcp/tool-handlers.js`
- Cache issues → Run `refresh_dependency_cache` tool

**See**: `MCP_GUIDE.md` Troubleshooting section

### Docker Issues

**Check Docker daemon**:

```bash
docker ps
```

**Clean up orphaned containers**:

```bash
docker ps -a | grep claude
docker rm -f $(docker ps -a -q --filter "name=claude")
```

**Check images exist**:

```bash
docker images | grep claude-python
```

### Workflow Test Issues

**Check workflow definition loads**:

```bash
node -e "import('./lib/servicenow-workflows.js').then(m => console.log('✅ Workflows OK'))"
```

**Run with verbose output** (if implemented):

```bash
VERBOSE=1 node test/run-workflow-test.js SN-CB-001
```

**Check test deliverables**:

```bash
ls -la test-output/
cat test-output/latest.json
```

---

## Performance Guidelines

### Token Usage Optimization

**Use conversation context caching**:
- System prompts are cached
- Repeated workflow data is cached
- Reduces token costs by 40-60%

**Current costs**:
- Smoke tests: < $0.01
- Single workflow test: $0.20-0.40
- Full suite (16 tests): $10-15

**Best practices**:
- Cache context in multi-step workflows
- Reuse conversation history when possible
- Use Haiku for simple tasks (if applicable)

### Execution Time

**Current benchmarks**:
- Smoke tests: < 5 seconds
- Single workflow: 5-15 minutes
- Full suite: 2-4 hours

**Don't optimize**:
- Spawn overhead (0.01s - negligible)
- JSON parsing (already fast)
- File I/O (already efficient)

**Do optimize**:
- Prompt verbosity (shorter = faster)
- Context size (smaller = faster)
- Number of workflow steps (fewer = faster)

**See**: `.claude/LESSONS_LEARNED.md` section on Performance

---

## Security Standards

### No Secrets in Code

```javascript
// ✅ CORRECT
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error('API key required');

// ❌ WRONG
const apiKey = 'sk-ant-1234567890';  // NEVER DO THIS
```

### Input Validation

```javascript
// ✅ CORRECT
function processFileName(name) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Invalid filename');
  }
  return path.join(baseDir, name);
}

// ❌ WRONG
function processFileName(name) {
  return path.join(baseDir, name);
  // Path traversal vulnerability!
}
```

### Command Injection Prevention

```javascript
// ✅ CORRECT
// Use array form
await dockerManager.exec(container, ['ls', '-la', userInput]);

// ❌ WRONG
await execAsync(`ls -la ${userInput}`);
// Command injection vulnerability!
```

**See**: `.claude/CODING_STANDARDS.md` Security Standards section

---

## File Organization

### Where Things Live

```
claude-automation/
├── lib/                              # Core libraries
│   ├── orchestrator.js               # Agent orchestration
│   ├── servicenow-workflows.js       # Workflow definitions
│   ├── workflow-executor.js          # Workflow execution
│   └── conversation-context.js       # Context management
│
├── mcp/                              # MCP server
│   ├── sn-tools-mcp-server.js        # Main server
│   ├── tool-schemas.js               # Tool definitions
│   └── tool-handlers.js              # Tool execution
│
├── test/                             # Tests
│   ├── smoke-test.js                 # Quick validation
│   ├── run-workflow-test.js          # Workflow testing
│   └── servicenow-component-backend-tests.js
│
├── tools/sn-tools/                   # Git submodule
│   └── ServiceNow-Tools/
│       └── sn-unified-tracer.js      # Enhanced tracer
│
└── .claude/                          # Development guides
    ├── PROJECT_OVERVIEW.md           # This loads automatically
    ├── CODING_STANDARDS.md           # This loads automatically
    ├── API_PATTERNS.md               # This loads automatically
    └── PROJECT_INSTRUCTIONS.md       # This file
```

### When to Modify Each File

**`lib/servicenow-workflows.js`**:
- Adding new workflows
- Modifying workflow steps
- Changing prompt templates

**`lib/orchestrator.js`**:
- Agent lifecycle changes
- Multi-agent coordination
- Resource management

**`mcp/tool-schemas.js`**:
- Adding new MCP tools
- Modifying tool schemas
- Updating tool descriptions

**`mcp/tool-handlers.js`**:
- Tool implementation logic
- Error handling for tools
- Response formatting

**`test/servicenow-component-backend-tests.js`**:
- Adding new workflow tests
- Modifying test criteria
- Updating validation rules

**`tools/sn-tools/ServiceNow-Tools/sn-unified-tracer.js`**:
- Enhancing dependency tracing
- Adding AI-context metadata
- Improving confidence scoring
- **NOTE**: This is a submodule - commit separately!

---

## TodoWrite Tool Usage

### When to Use TodoWrite

**Use TodoWrite when**:
- Task has 3+ steps
- Task is non-trivial/complex
- User provides multiple tasks
- User explicitly requests it

**Don't use when**:
- Single straightforward task
- Trivial task (< 3 steps)
- Purely conversational

### Todo Task States

**States**:
- `pending` - Not yet started
- `in_progress` - Currently working (limit to ONE at a time)
- `completed` - Finished successfully

**Task descriptions must have TWO forms**:
- `content`: Imperative form ("Run tests")
- `activeForm`: Present continuous ("Running tests")

**Example**:

```javascript
TodoWrite({
  todos: [
    { content: "Run smoke tests", activeForm: "Running smoke tests", status: "in_progress" },
    { content: "Update documentation", activeForm: "Updating documentation", status: "pending" },
    { content: "Commit changes", activeForm: "Committing changes", status: "pending" }
  ]
});
```

**Best practices**:
- Mark tasks completed IMMEDIATELY after finishing
- Keep exactly ONE task in_progress at any time
- Only mark completed when FULLY accomplished
- Remove tasks that are no longer relevant

---

## Quick Command Reference

### Testing

```bash
# Quick validation (always run before commit)
node test/smoke-test.js

# Single workflow test
node test/run-workflow-test.js SN-CB-001

# Full validation suite
node test/validation-suite.js

# MCP server tests
node mcp/test-mcp-server.js
```

### sn-tools (Direct)

```bash
cd tools/sn-tools/ServiceNow-Tools

# Trace component impact
npm run trace-impact -- WorkCampaignBoard

# Trace table dependencies
npm run query -- table-dependencies x_cadso_work_campaign

# Validate change impact
npm run validate-change -- component WorkCampaignBoard
```

### Docker

```bash
# Check running containers
docker ps

# Check all containers (including stopped)
docker ps -a | grep claude

# Clean up claude containers
docker rm -f $(docker ps -a -q --filter "name=claude")

# Check images
docker images | grep claude
```

### Git

```bash
# Check status
git status

# Recent commits
git log --oneline -5

# See changes
git diff

# Stage all changes
git add .

# Commit with message
git commit -m "type: description"
```

---

## Success Criteria

### For Every Session

- [ ] Started from working state (smoke tests passed)
- [ ] Followed coding standards
- [ ] Tests pass before committing
- [ ] Documentation updated
- [ ] Clean git state (no leftover changes)
- [ ] No orphaned Docker containers

### For Every Feature

- [ ] Tests added/updated
- [ ] CHANGELOG.md updated
- [ ] Relevant docs updated
- [ ] Smoke tests pass
- [ ] Code review checklist completed

### For Every Release

- [ ] Full validation suite passes
- [ ] All documentation current
- [ ] Version bumped in relevant files
- [ ] CHANGELOG.md has release notes
- [ ] Git tags created (if applicable)

---

## Key Reminders

### Always

- ✅ Use ES modules (import/export)
- ✅ Use async/await consistently
- ✅ Cleanup resources in finally blocks
- ✅ Include .js extension in imports
- ✅ Run smoke tests before committing
- ✅ Update documentation while coding

### Never

- ❌ Use CommonJS (require/module.exports)
- ❌ Use Promises directly (.then/.catch)
- ❌ Leave resources without cleanup
- ❌ Skip tests "to save time"
- ❌ Commit without running smoke tests
- ❌ Update documentation "later"

---

## Getting Help

### Documentation Hierarchy

1. **This file** - Session instructions (you're here)
2. **PROJECT_OVERVIEW.md** - Architecture and components
3. **CODING_STANDARDS.md** - Code standards and patterns
4. **API_PATTERNS.md** - API usage examples
5. **DEVELOPMENT_WORKFLOW.md** - Development best practices
6. **LESSONS_LEARNED.md** - Past solutions and mistakes
7. **MCP_GUIDE.md** - MCP integration documentation

### Quick References

- Common patterns: `.claude/QUICK_REFERENCE.md`
- Documentation checklist: `.claude/DOCUMENTATION_CHECKLIST.md`
- Testing guide: `docs/SERVICENOW_TESTING.md`

### When Stuck

1. Check relevant documentation (above)
2. Review similar existing code
3. Check `.claude/LESSONS_LEARNED.md` for past solutions
4. Run tests to understand current behavior
5. Ask user for clarification if still unclear

---

**Remember**: These instructions exist to ensure quality, consistency, and success. Following them saves time and prevents common mistakes.

**Version**: 1.0.0
**Last Updated**: 2025-11-21
**Maintained By**: Development team
