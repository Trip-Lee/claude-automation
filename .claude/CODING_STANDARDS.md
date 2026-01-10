# Coding Standards - Claude Automation Framework

**Last Updated**: 2025-11-21
**Applies To**: All code in claude-automation repository

---

## JavaScript/Node.js Standards

### Module System
- **Always use ES modules** (import/export)
- Never use CommonJS (require/module.exports)
- Use `.js` extension for all files

```javascript
// ✅ CORRECT
import { Orchestrator } from './lib/orchestrator.js';
export class MyClass { }

// ❌ WRONG
const Orchestrator = require('./lib/orchestrator.js');
module.exports = MyClass;
```

### Imports
- Use named imports when possible
- Group imports: Node builtins → External → Internal
- Always include `.js` extension for local imports

```javascript
// ✅ CORRECT
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { WorkflowExecutor } from './lib/workflow-executor.js';
import { getWorkflow } from './lib/servicenow-workflows.js';

// ❌ WRONG
import * as everything from 'chalk';
import { WorkflowExecutor } from './lib/workflow-executor';  // Missing .js
```

### Async/Await
- **Always use async/await** for asynchronous code
- Never use raw Promises or callbacks
- Always handle errors with try/catch

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
- Use descriptive error messages
- Include context in errors
- Always clean up resources in finally blocks

```javascript
// ✅ CORRECT
async function processFile(filePath) {
  let handle;
  try {
    handle = await fs.open(filePath, 'r');
    const data = await handle.readFile('utf8');
    return JSON.parse(data);
  } catch (error) {
    throw new Error(`Failed to process file ${filePath}: ${error.message}`);
  } finally {
    if (handle) await handle.close();
  }
}

// ❌ WRONG
async function processFile(filePath) {
  const handle = await fs.open(filePath, 'r');
  return JSON.parse(await handle.readFile('utf8'));
  // No error handling, no cleanup
}
```

### Naming Conventions

**Classes**: PascalCase
```javascript
class WorkflowExecutor { }
class AgentRegistry { }
```

**Functions/Methods**: camelCase
```javascript
async function executeWorkflow() { }
getWorkflow(id) { }
```

**Constants**: UPPER_SNAKE_CASE
```javascript
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 120000;
```

**Private methods**: Prefix with underscore
```javascript
class MyClass {
  _privateHelper() { }  // Internal use only
  publicMethod() { }    // Public API
}
```

---

## API Usage Patterns

### DockerManager

**CRITICAL**: `exec()` returns string, not object!

```javascript
// ✅ CORRECT
const output = await dockerManager.exec(container, 'ls -la');
console.log(output);  // Direct string

// ❌ WRONG
const result = await dockerManager.exec(container, 'ls -la');
console.log(result.stdout);  // Error: undefined
```

**Always cleanup**:
```javascript
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
```

### GitManager

**Check return values**:
```javascript
// ✅ CORRECT
const branch = await gitManager.getCurrentBranch(projectPath);
if (!branch) {
  throw new Error('Not a git repository');
}

// ❌ WRONG
const branch = await gitManager.getCurrentBranch(projectPath);
console.log(branch.name);  // May error if branch is null
```

### ClaudeCodeAgent

**Use timeout and retries**:
```javascript
// ✅ CORRECT
const agent = new ClaudeCodeAgent({
  role: 'architect',
  timeout: 15 * 60 * 1000,  // 15 minutes
  maxRetries: 2,
  workingDir: process.cwd()
});

// ❌ WRONG
const agent = new ClaudeCodeAgent({ role: 'architect' });
// Missing timeout, may hang indefinitely
```

---

## File Operations

### Reading Files

**Use promises API**:
```javascript
// ✅ CORRECT
import { promises as fs } from 'fs';
const content = await fs.readFile(filePath, 'utf8');

// ❌ WRONG
import fs from 'fs';
fs.readFile(filePath, (err, data) => { });  // Callback style
```

### Writing Files

**Atomic writes with error handling**:
```javascript
// ✅ CORRECT
async function writeFile(path, content) {
  const tempPath = `${path}.tmp`;
  try {
    await fs.writeFile(tempPath, content, 'utf8');
    await fs.rename(tempPath, path);  // Atomic
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});  // Cleanup
    throw error;
  }
}

// ❌ WRONG
await fs.writeFile(path, content);
// Not atomic, can corrupt on failure
```

### Path Handling

**Always use path.join**:
```javascript
// ✅ CORRECT
import path from 'path';
const fullPath = path.join(baseDir, 'analysis', 'file.md');

// ❌ WRONG
const fullPath = `${baseDir}/analysis/file.md`;
// Breaks on Windows
```

---

## Testing Standards

### Test Structure

**AAA Pattern**: Arrange, Act, Assert

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

### Test Naming

```javascript
// ✅ CORRECT
test_workflow_executor_handles_agent_errors()
test_conversation_context_caching_reduces_tokens()

// ❌ WRONG
test1()
testWorkflow()
```

### Validation Functions

**Return boolean, don't throw**:
```javascript
// ✅ CORRECT
function validateDeliverable(content) {
  if (!content.includes('## Executive Summary')) {
    return false;
  }
  return true;
}

// ❌ WRONG
function validateDeliverable(content) {
  if (!content.includes('## Executive Summary')) {
    throw new Error('Missing section');
  }
}
```

---

## Documentation Standards

### Code Comments

**When to comment**:
- Complex algorithms (explain WHY, not WHAT)
- Non-obvious behavior
- Workarounds for bugs
- Performance considerations

```javascript
// ✅ CORRECT
// Cache results for 5 minutes to avoid hitting rate limits
const cache = new Map();

// ❌ WRONG
// Set variable to new Map
const cache = new Map();
```

### JSDoc for Public APIs

```javascript
// ✅ CORRECT
/**
 * Execute a workflow with the given agent
 * @param {ClaudeCodeAgent} agent - The agent to execute with
 * @param {Object} workflow - Workflow definition
 * @returns {Promise<Object>} Workflow result
 * @throws {Error} If workflow execution fails
 */
async function executeWorkflow(agent, workflow) {
  // ...
}

// ❌ WRONG
// Executes workflow
async function executeWorkflow(agent, workflow) {
  // ...
}
```

### README Requirements

Every directory with multiple files should have README.md:
- Purpose of the directory
- Overview of key files
- Usage examples
- Related documentation

---

## MCP Tool Standards

### Tool Schemas

**Always include examples**:
```javascript
// ✅ CORRECT
export const TRACE_COMPONENT_IMPACT = {
  name: 'trace_component_impact',
  description: 'Trace a ServiceNow UI component forward to discover dependencies',
  inputSchema: {
    type: 'object',
    properties: {
      component_name: {
        type: 'string',
        description: 'Name of the UI component (e.g., "WorkCampaignBoard")'
      }
    },
    required: ['component_name']
  }
};

// ❌ WRONG
export const TRACE_COMPONENT_IMPACT = {
  name: 'trace_component_impact',
  inputSchema: {
    properties: { component_name: { type: 'string' } }
  }
};
```

### Tool Handlers

**Always wrap with error handling**:
```javascript
// ✅ CORRECT
export class ToolHandler {
  async execute(handler) {
    try {
      const result = await handler();
      return this.wrapResult(result);
    } catch (error) {
      return this.wrapResult(null, error);
    }
  }
}

// ❌ WRONG
async handle(params) {
  return await doSomething(params);
  // Unhandled errors crash the server
}
```

---

## Git Commit Standards

### Commit Messages

**Format**: `<type>: <short description>`

**Types**:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance

```bash
# ✅ CORRECT
git commit -m "feat: Add MCP server for sn-tools integration"
git commit -m "fix: Handle null results in workflow executor"
git commit -m "docs: Update MCP guide with troubleshooting"

# ❌ WRONG
git commit -m "updates"
git commit -m "Fixed stuff"
git commit -m "WIP"
```

### What to Commit

**Always include**:
- Code changes
- Related tests
- Updated documentation
- Updated CHANGELOG.md

**Never commit**:
- node_modules/
- .env files
- IDE-specific files (.vscode/, .idea/)
- Temporary files (*.tmp, *.log)

---

## Performance Standards

### Token Usage

**Always cache context**:
```javascript
// ✅ CORRECT
const context = new ConversationContext();
context.addMessage(systemPrompt, 'system');  // Cached
context.addMessage(userPrompt, 'user');      // Cached
const messages = context.getMessages();      // Reuses cache

// ❌ WRONG
const messages = [
  { role: 'system', content: systemPrompt },  // Not cached
  { role: 'user', content: userPrompt }       // Duplicated
];
```

### Avoid Repeated Operations

```javascript
// ✅ CORRECT
const files = await fs.readdir(dir);
const analyses = await Promise.all(
  files.map(file => analyzeFile(path.join(dir, file)))
);

// ❌ WRONG
const files = await fs.readdir(dir);
for (const file of files) {
  await analyzeFile(path.join(dir, file));  // Sequential
}
```

### Early Returns

```javascript
// ✅ CORRECT
function validate(data) {
  if (!data) return false;
  if (!data.name) return false;
  if (!data.type) return false;
  return true;
}

// ❌ WRONG
function validate(data) {
  if (data && data.name && data.type) {
    return true;
  } else {
    return false;
  }
}
```

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
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// Use array form
await dockerManager.exec(container, ['ls', '-la', userInput]);

// ❌ WRONG
await execAsync(`ls -la ${userInput}`);
// Command injection vulnerability!
```

---

## Quick Checklist

Before committing, verify:

- [ ] Using ES modules (import/export)
- [ ] Using async/await consistently
- [ ] Error handling with try/catch
- [ ] Cleanup in finally blocks
- [ ] Descriptive variable names
- [ ] Comments for complex logic
- [ ] Tests for new functionality
- [ ] Documentation updated
- [ ] No secrets in code
- [ ] No console.log for production (use proper logging)

---

**For more patterns, see**: `.claude/API_PATTERNS.md`
**For workflow, see**: `.claude/DEVELOPMENT_WORKFLOW.md`
