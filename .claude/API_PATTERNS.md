# API Patterns and Usage Guide

## Correct Usage of APIs in Claude Multi-Agent System

**Last Updated**: October 21, 2025

---

## Table of Contents

1. [DockerManager API](#dockermanager-api)
2. [GitManager API](#gitmanager-api)
3. [GitHub API (Octokit)](#github-api-octokit)
4. [ClaudeCodeAgent API](#claudecodeagent-api)
5. [ConfigManager API](#configmanager-api)
6. [CostMonitor API](#costmonitor-api)

---

## DockerManager API

### Location
`lib/docker-manager.js`

### Key Methods

#### `create(options)` → `Promise<string>`

Creates a Docker container and returns container ID.

```javascript
const dockerManager = new DockerManager();

const containerId = await dockerManager.create({
  name: `task-${Date.now()}`,           // Unique name with timestamp
  image: 'claude-python:latest',        // Image to use
  memory: '512m',                       // Memory limit
  cpus: 1,                              // CPU limit
  volumes: {
    '/host/path': '/container/path'    // Volume mounts
  }
});

// containerId is a string like "abc123def456"
```

**Returns**: Container ID string (NOT an object)

**Important**:
- Always use timestamp in name for uniqueness
- Returns container ID, not container object
- Throws error if creation fails

---

#### `exec(containerIdOrName, command)` → `Promise<string>`

Executes command in container and returns output.

```javascript
// CORRECT: Returns string directly
const output = await dockerManager.exec(containerId, 'ls -la /workspace');
console.log(output); // "total 16\ndrwxr-xr-x..."

if (output.includes('main.py')) {
  console.log('File found!');
}

// Read file
const content = await dockerManager.exec(containerId, 'cat /workspace/main.py');

// Write file (to /tmp, not /workspace in tests!)
await dockerManager.exec(containerId, 'echo "test" > /tmp/test.txt');

// Run Python
const result = await dockerManager.exec(containerId, 'python3 -c "print(2+2)"');
console.log(result); // "4\n"
```

**Returns**: Command output as string

**WRONG USAGE** ❌:
```javascript
// This is WRONG - exec() doesn't return an exec object
const exec = await dockerManager.exec(container, 'ls');
const { stdout } = await exec.getOutput(); // ❌ No such method!
```

**Important**:
- Output is returned as string directly
- Includes both stdout and stderr
- No separate exec object to manage
- Command runs synchronously (waits for completion)

---

#### `stop(containerIdOrName)` → `Promise<void>`

Stops a running container.

```javascript
await dockerManager.stop(containerId);
// Returns void, throws on error
```

**Returns**: Nothing (void)

**Important**:
- Fire-and-forget operation
- Doesn't fail if already stopped
- Use in cleanup path

---

#### `remove(containerIdOrName)` → `Promise<void>`

Removes a stopped container.

```javascript
await dockerManager.remove(containerId);
// Returns void, throws on error
```

**Returns**: Nothing (void)

**Important**:
- Container must be stopped first
- Fire-and-forget operation
- Use in cleanup path

---

#### `ping()` → `Promise<void>`

Checks if Docker daemon is accessible.

```javascript
const dockerManager = new DockerManager();

try {
  await dockerManager.ping();
  console.log('✅ Docker is running');
} catch (error) {
  console.log('❌ Docker is not accessible');
}
```

**Returns**: Nothing (void), throws on error

**Use Cases**:
- System validation
- Pre-flight checks
- Health monitoring

---

### Complete DockerManager Example

```javascript
import { DockerManager } from './lib/docker-manager.js';

const dockerManager = new DockerManager();
let containerId = null;

try {
  // 1. Create container
  containerId = await dockerManager.create({
    name: `task-${Date.now()}`,
    image: 'claude-python:latest',
    memory: '512m',
    cpus: 1,
    volumes: {
      '/home/user/project': '/workspace'
    }
  });

  console.log(`Container created: ${containerId}`);

  // 2. Execute commands
  const files = await dockerManager.exec(containerId, 'ls /workspace');
  console.log('Files:', files);

  const pythonOutput = await dockerManager.exec(
    containerId,
    'cd /workspace && python3 -m pytest -v'
  );
  console.log('Test output:', pythonOutput);

  // 3. Check for specific output
  if (pythonOutput.includes('passed')) {
    console.log('✅ Tests passed');
  }

} catch (error) {
  console.error('❌ Docker operation failed:', error.message);
} finally {
  // 4. Always cleanup
  if (containerId) {
    try {
      await dockerManager.stop(containerId);
      await dockerManager.remove(containerId);
      console.log('✅ Container cleaned up');
    } catch (cleanupError) {
      console.warn('⚠️  Cleanup warning:', cleanupError.message);
    }
  }
}
```

---

## GitManager API

### Location
`lib/git-manager.js`

### Key Methods

#### `getCurrentBranch(repoPath)` → `Promise<string>`

Gets current branch name.

```javascript
const gitManager = new GitManager();

const branch = await gitManager.getCurrentBranch('/path/to/repo');
console.log(branch); // "master" or "main" or "feature-branch"
```

**Returns**: Branch name string

**Important**:
- Returns branch name only (no "refs/heads/")
- Throws if not a git repository
- Use for validation and checks

---

#### `status(repoPath)` → `Promise<Object>`

Gets repository status.

```javascript
const status = await gitManager.status('/path/to/repo');

console.log(status);
// {
//   branch: 'master',
//   ahead: 0,
//   behind: 0,
//   modified: 2,
//   deleted: 0,
//   untracked: 1,
//   clean: false
// }

if (status.clean) {
  console.log('✅ Working tree is clean');
} else {
  console.log(`⚠️  ${status.modified} modified, ${status.untracked} untracked`);
}
```

**Returns**: Status object

---

#### `commit(repoPath, message, files = [])` → `Promise<string>`

Creates a commit.

```javascript
// Commit specific files
await gitManager.commit(
  '/path/to/repo',
  'feat: Add new feature',
  ['file1.js', 'file2.js']
);

// Commit all changes
await gitManager.commit(
  '/path/to/repo',
  'fix: Bug fix'
  // No files = commit all staged
);
```

**Returns**: Commit hash

---

#### `push(repoPath, branch, setUpstream = false)` → `Promise<string>`

Pushes to remote.

```javascript
// First push (set upstream)
await gitManager.push('/path/to/repo', 'feature-branch', true);

// Subsequent pushes
await gitManager.push('/path/to/repo', 'feature-branch');
```

**Returns**: Git push output

---

## GitHub API (Octokit)

### Location
`lib/github-client.js`

### Initialization

```javascript
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});
```

### Common Patterns

#### Check if Repository Exists

```javascript
try {
  const { data } = await octokit.rest.repos.get({
    owner: 'username',
    repo: 'repo-name'
  });
  console.log('✅ Repository exists');
  console.log('URL:', data.html_url);
} catch (error) {
  if (error.status === 404) {
    console.log('❌ Repository not found');
  } else if (error.status === 401) {
    console.log('❌ Authentication failed');
  } else {
    throw error;
  }
}
```

#### Create Repository

```javascript
const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
  name: 'repo-name',
  description: 'Repository description',
  private: false,           // true for private
  auto_init: false,         // Don't create README
  has_issues: true,
  has_projects: true,
  has_wiki: true
});

console.log('Created:', repo.html_url);
console.log('Clone URL:', repo.clone_url);
```

#### Create Pull Request

```javascript
const { data: pr } = await octokit.rest.pulls.create({
  owner: 'username',
  repo: 'repo-name',
  title: 'PR Title',
  head: 'feature-branch',    // Source branch
  base: 'master',            // Target branch
  body: 'PR description in markdown',
  maintainer_can_modify: true
});

console.log('PR created:', pr.html_url);
console.log('PR number:', pr.number);
```

#### Check Authentication

```javascript
try {
  const { data: user } = await octokit.rest.users.getAuthenticated();
  console.log('✅ Authenticated as:', user.login);
} catch (error) {
  if (error.status === 401) {
    console.log('❌ Token invalid or expired');
  }
}
```

---

## ClaudeCodeAgent API

### Location
`lib/claude-code-agent.js`

### Initialization

```javascript
import { ClaudeCodeAgent } from './lib/claude-code-agent.js';

const agent = new ClaudeCodeAgent({
  role: 'coder',           // 'architect', 'coder', or 'reviewer'
  timeout: 300000,         // 5 minutes (optional)
  maxRetries: 3,           // Number of retries (optional)
  retryDelay: 2000         // Initial retry delay (optional)
});
```

### Key Methods

#### `query(prompt, conversationHistory = [])` → `Promise<string>`

Sends query to Claude and gets response.

```javascript
const agent = new ClaudeCodeAgent({ role: 'coder' });

const prompt = `
You are a Python developer. Add a new function called power(base, exponent)
that raises base to the power of exponent.

Add the function to main.py and tests to test_main.py.
`;

try {
  const response = await agent.query(prompt);
  console.log('Agent response:', response);
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log('❌ Query timed out after 5 minutes');
  } else if (error.message.includes('rate limit')) {
    console.log('❌ Rate limited, will retry');
  } else {
    console.log('❌ Query failed:', error.message);
  }
}
```

**Features**:
- Automatic timeout protection (5 minutes default)
- Automatic retry with exponential backoff
- Intelligent error classification
- Enhanced error messages with troubleshooting

---

### Error Handling Patterns

```javascript
const agent = new ClaudeCodeAgent({
  role: 'coder',
  timeout: 300000,   // 5 min
  maxRetries: 3,
  retryDelay: 2000   // 2 seconds
});

try {
  const response = await agent.query(prompt);
  // Success
} catch (error) {
  // Error is already enhanced with context
  console.error(error.message);
  // Includes:
  // - Original error
  // - Attempt number
  // - Troubleshooting hints
}
```

**Retryable Errors** (will retry):
- Rate limit exceeded
- Network errors
- Timeout
- Connection refused
- Socket hang up

**Non-Retryable Errors** (fail immediately):
- Permission denied
- Not found
- Syntax errors
- Invalid JSON
- Authentication failed

---

## ConfigManager API

### Location
`lib/config-manager.js`

### Key Methods

#### `load(projectName)` → `Promise<Object>`

Loads project configuration.

```javascript
import { ConfigManager } from './lib/config-manager.js';

const configManager = new ConfigManager();

const config = await configManager.load('test-project');

console.log(config);
// {
//   name: 'test-project',
//   path: '/home/user/projects/test-project',
//   repository: 'github.com/user/test-project',
//   docker: {
//     image: 'claude-python:latest',
//     memory: '512m',
//     cpus: 1
//   }
// }
```

#### `listProjects()` → `Promise<Array>`

Lists all configured projects.

```javascript
const projects = await configManager.listProjects();

console.log(projects);
// ['test-project', 'my-app', 'another-project']

for (const name of projects) {
  const config = await configManager.load(name);
  console.log(`${name}: ${config.path}`);
}
```

---

## CostMonitor API

### Location
`lib/cost-monitor.js`

### Initialization and Usage

```javascript
import { CostMonitor } from './lib/cost-monitor.js';

// Initialize with cost limit
const costMonitor = new CostMonitor(5.0); // $5 limit

// Track API usage
costMonitor.addUsage({
  inputTokens: 1000,
  outputTokens: 500
});

// Get current cost
const cost = costMonitor.getTotalCost();
console.log(`Current cost: $${cost.toFixed(4)}`);

// Check if under limit
try {
  costMonitor.addUsage({
    inputTokens: 10000,
    outputTokens: 10000
  });
} catch (error) {
  if (error.message.includes('Cost limit')) {
    console.log('❌ Would exceed cost limit!');
  }
}

// Get usage summary
const summary = costMonitor.getSummary();
console.log(summary);
// {
//   totalInputTokens: 11000,
//   totalOutputTokens: 10500,
//   totalCost: 0.0524,
//   limit: 5.0,
//   remaining: 4.9476
// }
```

---

## Common Patterns

### Pattern 1: Resource Management

```javascript
async function operation() {
  let resource = null;

  try {
    resource = await createResource();
    // ... use resource ...
    return result;
  } catch (error) {
    throw new Error(`Operation failed: ${error.message}`);
  } finally {
    // ALWAYS cleanup
    if (resource) {
      await cleanupResource(resource);
    }
  }
}
```

### Pattern 2: Timeout Protection

```javascript
async function withTimeout(operation, timeoutMs = 5000) {
  return Promise.race([
    operation(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
    )
  ]);
}

// Usage
const result = await withTimeout(
  () => agent.query(prompt),
  300000  // 5 minutes
);
```

### Pattern 3: Retry with Backoff

```javascript
async function retryOperation(operation, maxRetries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      const isRetryable = error.message.includes('rate limit') ||
                         error.message.includes('network');

      if (!isRetryable) {
        throw error;
      }

      const backoff = delay * attempt;
      console.log(`Retry ${attempt}/${maxRetries} after ${backoff}ms...`);
      await sleep(backoff);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Pattern 4: State Tracking

```javascript
class ResourceManager {
  constructor() {
    this.activeResources = new Set();
    this.registerCleanupHandlers();
  }

  async create() {
    const resource = await createResource();
    this.activeResources.add(resource);
    return resource;
  }

  async cleanup(resource) {
    await cleanupResource(resource);
    this.activeResources.delete(resource);
  }

  async cleanupAll() {
    for (const resource of this.activeResources) {
      await this.cleanup(resource);
    }
  }

  registerCleanupHandlers() {
    process.on('SIGINT', async () => {
      await this.cleanupAll();
      process.exit(130);
    });

    process.on('SIGTERM', async () => {
      await this.cleanupAll();
      process.exit(0);
    });
  }
}
```

---

## API Quick Reference Table

| API | Create/Init | Key Operations | Returns | Cleanup |
|-----|-------------|----------------|---------|---------|
| **DockerManager** | `new DockerManager()` | `create()`, `exec()`, `stop()`, `remove()` | Container ID (string), Output (string), void | `stop()` then `remove()` |
| **GitManager** | `new GitManager()` | `status()`, `commit()`, `push()`, `getCurrentBranch()` | Objects, strings | None needed |
| **GitHub (Octokit)** | `new Octokit({ auth })` | `repos.get()`, `repos.create()`, `pulls.create()` | Data objects | None needed |
| **ClaudeCodeAgent** | `new ClaudeCodeAgent({ role })` | `query()` | Response string | None needed |
| **ConfigManager** | `new ConfigManager()` | `load()`, `listProjects()` | Config object, Array | None needed |
| **CostMonitor** | `new CostMonitor(limit)` | `addUsage()`, `getTotalCost()` | Numbers | None needed |

---

**Last Updated**: 2025-10-21
**Next Review**: When adding new APIs or changing existing ones
**Maintained By**: Development team
