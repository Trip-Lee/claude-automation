# Lessons Learned - January 10, 2026

## Key Insights from Development Sessions

---

## 13. MCP Tool Integration with Agents (January 2026)

### Root Cause Analysis Process

**The Problem:**
- Agents were not using MCP tools despite MCP server being configured
- Agents would "hallucinate" MCP tool outputs (mention using them) but mcpToolCalls: 0
- Tests showed prompts instructing agents to use MCP tools, but tools never invoked

**The Investigation:**
1. Checked MCP server - working correctly, returns 7 tools
2. Checked mcp-config.json - properly configured
3. Checked agent spawning - `--mcp-config` flag was being passed
4. **Found root cause**: `--allowedTools Read,Write,Edit,Bash` was BLOCKING MCP tools

**Key Insight:**
The `--allowedTools` flag in Claude Code CLI is restrictive, not additive. If you specify allowedTools, ONLY those tools are available. MCP tools must be explicitly included in the allowedTools list.

### The Fix Pattern

```javascript
// MCP tool names constant
const MCP_TOOL_NAMES = [
  'trace_component_impact',
  'trace_table_dependencies',
  'trace_full_lineage',
  'validate_change_impact',
  'query_table_schema',
  'analyze_script_crud',
  'refresh_dependency_cache'
];

// When building args, merge MCP tools into allowedTools
let effectiveAllowedTools = [...this.allowedTools];
if (mcpConfigFound) {
  effectiveAllowedTools = [...new Set([...effectiveAllowedTools, ...MCP_TOOL_NAMES])];
  args.push('--mcp-config', mcpConfigPath);
}
args.push('--allowedTools', effectiveAllowedTools.join(','));
```

### Tool Name Consistency

**Problem:** Test code referenced wrong tool names
- Used `query_script_crud` but actual tool is `analyze_script_crud`
- Used `query_table_dependencies` but actual tool is `trace_table_dependencies`

**Lesson:** Always verify tool names match exactly between:
1. MCP server tool definitions (tool-schemas.js)
2. Test mappings (mcpEquivalents in test files)
3. Documentation and prompts

### Dependency Cache Management

**Problem:** MCP tools returned empty results because dependency cache was never populated

**Fix:** Auto-scan on first use
```javascript
async ensureLoaded(options = {}) {
  const { autoScan = true, quiet = false } = options;
  const stats = this.tracker.getStatistics();
  const hasData = stats.components > 0 || stats.apis > 0;

  if (!hasData && autoScan) {
    await this.tracker.scanAll({ quiet });
    this.tracker.saveCache();
  }
}
```

### Key Takeaways

1. **CLI flags are restrictive** - `--allowedTools` blocks everything not listed
2. **Verify tool names end-to-end** - Server → Tests → Docs must match exactly
3. **Auto-initialize resources** - Don't assume cache is populated
4. **Test MCP integration separately** - Create dedicated integration tests
5. **Watch for "hallucination"** - Agents may claim tool use without actual invocation

---

## 1. Docker Container Management

### ✅ What We Learned

**Container Cleanup is Critical:**
- Docker containers can leak if not properly cleaned up
- Even "exited" containers consume disk space and clutter the system
- Must track active containers in a Set for reliable cleanup
- Use `finally` blocks to ensure cleanup happens even on errors

**Cleanup Patterns That Work:**
```javascript
// In Orchestrator constructor
this.activeContainers = new Set();
this.registerCleanupHandlers();

// In executeTask
let container = null;
try {
  container = await dockerManager.create(...);
  this.activeContainers.add(container);
  // ... work ...
} finally {
  // CRITICAL: Always cleanup, even on error
  if (container) {
    await this.cleanupContainer(container);
  }
}

// Process exit handlers
process.on('SIGINT', async () => {
  await this.cleanupAll();
  process.exit(130);
});
```

**DockerManager API Specifics:**
- `exec(container, command)` returns output directly as a string, not an exec object
- No `status()` method exists - use container name to track state
- `create()` returns container ID string
- `stop()` and `remove()` are fire-and-forget (void return)

### ❌ What Didn't Work

- Trying to use `dockerManager.status(container)` - method doesn't exist
- Treating `exec()` return value as an object - it's a string
- Forgetting cleanup in error paths - containers leak

---

## 2. Error Handling Patterns

### ✅ What We Learned

**Timeout Protection is Essential:**
- Claude Code CLI can hang indefinitely without timeout
- Default 5-minute timeout prevents infinite waits
- Use SIGTERM first (graceful), then SIGKILL (force) after 5 seconds

**Retry Logic Must Be Intelligent:**
- Not all errors are retryable
- Rate limits, network errors, timeouts → Retry
- Permission denied, not found, syntax errors → Don't retry
- Use exponential backoff: 2s, 4s, 6s

**Error Classification Pattern:**
```javascript
_isRetryableError(error) {
  const message = error.message.toLowerCase();
  const retryablePatterns = [
    'rate limit', 'timeout', 'econnrefused',
    'network', 'socket hang up', 'temporary'
  ];
  return retryablePatterns.some(pattern => message.includes(pattern));
}
```

### ❌ What Didn't Work

- Retrying all errors blindly - wastes time and API calls
- No timeout protection - led to hanging processes
- Generic error messages - hard to debug issues

---

## 3. Testing and Validation

### ✅ What We Learned

**Two-Tier Testing Strategy:**
1. **Smoke Tests** (<3 seconds) - Quick sanity checks before/after changes
2. **Full Validation** (30-60s) - Comprehensive testing before releases

**Test Categories That Matter:**
- Infrastructure (Docker, Git, Config) - Foundation must work
- File Operations (Read, Write, Execute) - Core functionality
- Cleanup System (Success, Error, Interrupt) - Resource management
- Error Handling (Timeout, Retry, Classification) - Resilience
- Cost Tracking - Budget control
- Agent System (optional) - Advanced features

**Test Helper Pattern:**
```javascript
async function runTest(category, name, testFn, { skip = false, timeout = 60000 } = {}) {
  if (skip) {
    console.log('⊘ SKIPPED');
    return { passed: false, skipped: true };
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Test timeout')), timeout)
    );
    await Promise.race([testFn(), timeoutPromise]);
    console.log('✅');
    return { passed: true };
  } catch (error) {
    console.log('❌', error.message);
    return { passed: false, error };
  }
}
```

**Categories Tracking Pattern:**
```javascript
const categories = {
  infrastructure: { passed: 0, failed: 0, skipped: 0 },
  fileOps: { passed: 0, failed: 0, skipped: 0 },
  // ...
};

// Update in runTest
categories[category].passed++;
```

### ❌ What Didn't Work

- Tests without timeouts - can hang forever
- No test categories - hard to identify problem areas
- Testing implementation details instead of behavior

---

## 4. Git and GitHub Workflows

### ✅ What We Learned

**Git Ignore is Critical:**
```gitignore
# Always exclude
node_modules/
package-lock.json
.env
.env.*

# Logs
*.log
logs/

# OS files
.DS_Store
```

**Removing Files from Git Tracking:**
```bash
# Remove from git but keep locally
git rm -r --cached node_modules/
git rm --cached package-lock.json

# Commit the removal
git commit -m "Remove node_modules from tracking"
```

**GitHub Authentication Options:**
1. GitHub CLI (`gh auth login`) - Easiest, interactive
2. Personal Access Token - Good for automation
3. SSH keys - Best for security

**Repository Creation Pattern:**
```bash
# With gh CLI (best)
gh repo create repo-name --public --source=. --remote=origin --push

# Manual
git remote add origin https://github.com/username/repo.git
git push -u origin master
```

### ❌ What Didn't Work

- Committing node_modules to git - bloats repository
- Using expired GitHub tokens - authentication fails
- Not having .gitignore before initial commit - cleanup required

---

## 5. Documentation Discipline

### ✅ What We Learned

**Documentation Must Be Updated Every Change:**
- CHANGELOG.md - Every feature/fix
- RESUME.md - Every session
- STATUS.md - Every version bump
- Specific docs for major features

**Checklist System Works:**
- Use .claude/DOCUMENTATION_CHECKLIST.md
- Check off items as you update
- Quick reference card for common patterns

**Documentation Files Hierarchy:**
```
CHANGELOG.md          # Version history, what changed
STATUS.md             # Current version, what works now
RESUME.md             # Session history, how we got here
TODO.md               # What's next
docs/                 # Feature-specific documentation
  FEATURE_NAME.md     # Deep dive on specific feature
.claude/              # Development guides
  DOCUMENTATION_CHECKLIST.md
  QUICK_REFERENCE.md
  LESSONS_LEARNED.md  # This file
```

### ❌ What Didn't Work

- Updating docs "later" - they get forgotten
- Generic commit messages - hard to understand history
- No templates - inconsistent documentation

---

## 6. Performance Optimization

### ✅ What We Learned

**Measure Before Optimizing:**
- Don't optimize based on assumptions
- Profile actual execution time
- Identify real bottlenecks (not guesses)

**Our Performance Analysis:**
- 92.5% of time: Claude Code CLI execution (can't optimize)
- 7.5% of time: Our code (spawn, parsing, etc.)
- Spawn overhead: 0.01s (negligible!)
- Real bottleneck: Coder agent (51.5% of total time)

**Quick Wins vs Deep Optimization:**
- Quick wins: Reduce prompt verbosity, optimize context
- Deep optimization: Model selection, context caching
- Focus on quick wins first (80/20 rule)

### ❌ What Didn't Work

- Assuming spawn was slow - it wasn't (0.01s)
- Trying to optimize before measuring - wrong targets
- Not setting realistic goals - led to frustration

---

## 7. CLI Design Patterns

### ✅ What We Learned

**User-Friendly Commands:**
```bash
claude validate           # Default: smoke tests
claude validate --smoke   # Explicit: smoke tests
claude validate --full    # Comprehensive validation
claude cleanup            # Tracked containers
claude cleanup --all      # All Claude containers
```

**Command Patterns That Work:**
- Default to fast/safe operations
- Provide flags for powerful/comprehensive operations
- Always show what's happening (don't be silent)
- Exit codes matter: 0 = success, 1 = failure

**Helpful Output:**
```javascript
console.log(chalk.blue.bold('🚀 Starting...'));
console.log(chalk.green('✅ Success'));
console.log(chalk.red('❌ Failed'));
console.log(chalk.yellow('⚠️  Warning'));
console.log(chalk.gray('  Details...'));
```

### ❌ What Didn't Work

- Silent operations - users don't know what's happening
- No default behavior - users must always specify flags
- Generic error messages - hard to troubleshoot

---

## 8. Node.js and JavaScript Patterns

### ✅ What We Learned

**Async/Await Best Practices:**
```javascript
// Good: Handle errors explicitly
try {
  const result = await operation();
  return result;
} catch (error) {
  throw new Error(`Operation failed: ${error.message}`);
} finally {
  // Always cleanup
  await cleanup();
}

// Good: Use Promise.race for timeout
const result = await Promise.race([
  operation(),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), 5000)
  )
]);
```

**Environment Variables:**
```javascript
// Load from home directory (not project directory)
import { homedir } from 'os';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(homedir(), '.env') });
```

**Spawn Process Patterns:**
```javascript
import { spawn } from 'child_process';

const process = spawn('command', ['arg1', 'arg2'], {
  cwd: process.cwd(),
  stdio: 'inherit'  // or 'pipe' to capture output
});

process.on('close', (code) => {
  process.exit(code);
});
```

### ❌ What Didn't Work

- Not using `finally` blocks - cleanup doesn't happen on errors
- Loading .env from wrong location - variables not found
- Not handling process signals - cleanup on Ctrl+C fails

---

## 9. Testing Docker Functionality

### ✅ What We Learned

**Test in Temporary Locations:**
```javascript
// DON'T write to /workspace (tracked by git)
await dockerManager.exec(container,
  'echo "test" > /workspace/test.txt'
);

// DO write to /tmp (not tracked)
await dockerManager.exec(container,
  'echo "test" > /tmp/test.txt'
);
```

**Container Naming:**
```javascript
// Use timestamp for unique names
const containerName = `test-${Date.now()}`;

// Or use category prefix
const containerName = `smoke-test-${Date.now()}`;
const containerName = `validation-${Date.now()}`;
```

### ❌ What Didn't Work

- Writing test files to git-tracked directories
- Reusing container names - conflicts if previous cleanup failed
- Not cleaning up test containers - accumulate over time

---

## 10. API Integration Patterns

### ✅ What We Learned

**GitHub API (Octokit):**
```javascript
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: token });

// Check if repo exists
try {
  const { data } = await octokit.rest.repos.get({
    owner,
    repo: repoName
  });
  // Exists
} catch (error) {
  if (error.status === 404) {
    // Doesn't exist
  }
}

// Create repository
const { data } = await octokit.rest.repos.createForAuthenticatedUser({
  name: 'repo-name',
  description: 'Description',
  private: false,
  auto_init: false
});
```

**Token Validation:**
```javascript
// Test auth before using
try {
  await octokit.rest.users.getAuthenticated();
  // Token valid
} catch (error) {
  if (error.status === 401) {
    // Token invalid
  }
}
```

### ❌ What Didn't Work

- Using expired tokens - all operations fail
- Not checking for existing resources - create operations fail
- No error handling for rate limits - unexpected failures

---

## 11. Shell Script Best Practices

### ✅ What We Learned

**Detect and Guide:**
```bash
#!/bin/bash
set -e  # Exit on error

# Check if tool installed
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI installed"
    # Proceed
else
    echo "⚠️  GitHub CLI not installed"
    echo "Install with: sudo apt install gh"
    exit 1
fi

# Check if authenticated
if gh auth status &> /dev/null; then
    echo "✅ Authenticated"
else
    echo "⚠️  Not authenticated"
    echo "Run: gh auth login"
    exit 1
fi
```

**Colored Output:**
```bash
echo -e "\033[1;32m✅ Success\033[0m"
echo -e "\033[1;31m❌ Failed\033[0m"
echo -e "\033[1;33m⚠️  Warning\033[0m"
echo -e "\033[0;36mInfo\033[0m"
```

### ❌ What Didn't Work

- Not using `set -e` - errors go unnoticed
- Silent failures - user doesn't know what went wrong
- No fallback instructions - users get stuck

---

## 12. Project Structure Patterns

### ✅ What We Learned

**Organized Directory Structure:**
```
project/
  lib/                    # Core library code
    orchestrator.js       # Main workflow
    docker-manager.js     # Docker operations
    claude-code-agent.js  # Agent wrapper
  test/                   # Test files
    smoke-test.js         # Quick validation
    validation-suite.js   # Comprehensive tests
  docs/                   # Feature documentation
    FEATURE.md            # Deep dives
  .claude/                # Development guides
    DOCUMENTATION_CHECKLIST.md
    LESSONS_LEARNED.md
  cli.js                  # CLI entry point
  CHANGELOG.md            # Version history
  STATUS.md               # Current state
  RESUME.md               # Session history
```

**File Naming Conventions:**
- `kebab-case.js` for files
- `PascalCase` for classes
- `camelCase` for functions/variables
- `UPPER_CASE.md` for important docs

### ❌ What Didn't Work

- Mixing naming conventions - confusing
- Flat file structure - hard to navigate
- No separation of concerns - monolithic files

---

## Summary: Top 10 Takeaways

1. **Always cleanup resources** - Use `finally` blocks and process handlers
2. **Test before optimizing** - Measure, don't assume
3. **Two-tier testing** - Smoke tests (fast) + Full validation (comprehensive)
4. **Update docs immediately** - Not "later"
5. **Use .gitignore early** - Before first commit
6. **Intelligent error handling** - Timeout + classify + retry
7. **Track state explicitly** - Use Sets for active resources
8. **Validate tokens/auth** - Before attempting operations
9. **User-friendly CLIs** - Show progress, use colors, provide help
10. **Document learnings** - This file exists for a reason!

---

**Last Updated**: 2025-10-21
**Next Review**: When starting new major features
**Maintained By**: Development team (update after each major session)
