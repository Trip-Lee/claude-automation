# Validation System - October 21, 2025

## Overview

Comprehensive validation system to ensure system health and catch regressions before they reach production.

---

## Commands

### Quick Smoke Tests (<30s)
```bash
claude validate
# or
claude validate --smoke
```

**Use When**:
- Before making changes
- After pulling updates
- Quick health check
- Pre-commit validation

**Tests**:
- ✅ Docker daemon accessible
- ✅ Configuration system loads
- ✅ Test project exists
- ✅ Docker container creation
- ✅ File operations in container
- ✅ Container cleanup
- ✅ Git operations

**Duration**: ~3 seconds
**Exit Code**: 0 = pass, 1 = fail

### Full Validation Suite (~30-60s)
```bash
claude validate --full
```

**Use When**:
- Before releases
- After significant changes
- Weekly validation
- CI/CD pipeline

**Test Categories**:
1. **Infrastructure** (6 tests)
   - Docker daemon
   - Docker images
   - Configuration system
   - Test project configuration
   - Test project directory
   - Git operations

2. **File Operations** (5 tests)
   - Container creation
   - List files
   - Read files
   - Write files
   - Execute Python
   - Run pytest

3. **Cleanup System** (4 tests)
   - Container stop
   - Container remove
   - Orchestrator cleanup registration
   - Active container tracking

4. **Error Handling** (3 tests)
   - ClaudeCodeAgent timeout
   - Retry logic
   - Error classification

5. **Cost Tracking** (3 tests)
   - CostMonitor initialization
   - Usage tracking
   - Limit enforcement

6. **Agent System** (3 tests - optional)
   - Claude CLI availability
   - Agent initialization
   - System prompts defined

**Duration**: ~30-60 seconds
**Exit Code**: 0 = all pass, 1 = any fail

---

## Test Files

### test/smoke-test.js
Quick validation script for essential functionality.

**What it tests**:
- Core infrastructure (Docker, Git, Config)
- Basic file operations
- Container lifecycle
- Essential functionality only

**Run directly**:
```bash
node test/smoke-test.js
```

### test/validation-suite.js
Comprehensive validation of all system components.

**What it tests**:
- All infrastructure components
- Complete file operations
- Cleanup system (success & error paths)
- Error handling logic
- Cost tracking
- Agent system (if Claude CLI available)

**Run directly**:
```bash
node test/validation-suite.js
```

---

## Output Format

### Success
```
🔍 SMOKE TEST - Quick System Validation

  Testing Docker daemon is running... ✅
  Testing Configuration system loads... ✅
  Testing Test project exists... ✅
  Testing Docker container creation... ✅
  Testing File operations in container... ✅
  Testing Container cleanup... ✅
  Testing Git operations... ✅

============================================================
SMOKE TEST SUMMARY
============================================================
✅ Passed: 7
❌ Failed: 0
⏱️  Duration: 2.7s

✅ ALL SMOKE TESTS PASSED - System is healthy!
```

### Failure
```
  Testing Docker daemon is running... ❌
    Error: connect ECONNREFUSED /var/run/docker.sock

============================================================
SMOKE TEST SUMMARY
============================================================
✅ Passed: 6
❌ Failed: 1
⏱️  Duration: 1.2s

❌ 1 SMOKE TEST(S) FAILED - System has issues!
```

### Full Validation (Category Breakdown)
```
═══════════════════════════════════════════════
CATEGORY 1: INFRASTRUCTURE TESTS
═══════════════════════════════════════════════

  INFRASTRUCTURE: Docker daemon accessible... ✅
  INFRASTRUCTURE: Docker Python image exists... ✅
  INFRASTRUCTURE: Configuration system initializes... ✅
  ...

═══════════════════════════════════════════════
VALIDATION SUITE SUMMARY
═══════════════════════════════════════════════

Results by Category:

✅ infrastructure         6/6 passed
✅ fileOps               5/5 passed
✅ cleanup               4/4 passed
✅ errorHandling         3/3 passed
✅ costTracking          3/3 passed
✅ agents                2/3 passed (1 skipped)

─────────────────────────────────────────────────

✅ Passed: 23
❌ Failed: 0
⊘  Skipped: 1
⏱️  Duration: 28.3s

✅ ALL VALIDATION TESTS PASSED - System is fully functional!
```

---

## Integration with Development

### Pre-commit Hook
```bash
#!/bin/sh
# .git/hooks/pre-commit

echo "Running validation tests..."
node cli.js validate --smoke

if [ $? -ne 0 ]; then
  echo "❌ Validation failed - commit aborted"
  exit 1
fi

exit 0
```

### CI/CD Pipeline
```yaml
# .github/workflows/test.yml
name: Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: node cli.js validate --full
```

### Daily Cron Job
```bash
# Run full validation daily at 2am
0 2 * * * cd /home/coltrip/claude-automation && node cli.js validate --full >> /var/log/claude-validation.log 2>&1
```

---

## What Gets Validated

### ✅ Infrastructure
- **Docker**
  - Daemon running and accessible
  - Python image exists (claude-python:latest)
  - Container creation works
  - Container operations (exec, stop, remove)

- **Configuration**
  - Config system initializes
  - Projects can be loaded
  - Test project configuration exists
  - Test project directory exists

- **Git**
  - Git operations work
  - Can get current branch
  - Status checks work

### ✅ File Operations
- Container can be created
- Files can be listed
- Files can be read
- Files can be written
- Python can be executed
- Tests can be run with pytest

### ✅ Cleanup System
- Containers can be stopped
- Containers can be removed
- Orchestrator registers cleanup handlers
- Active containers are tracked
- Cleanup happens on success
- Cleanup happens on failure

### ✅ Error Handling
- ClaudeCodeAgent has timeout configured
- Retry logic is configured
- Error classification works (retryable vs permanent)
- Error messages are enhanced with context

### ✅ Cost Tracking
- CostMonitor initializes correctly
- Usage can be tracked
- Cost limits are enforced
- Total cost can be calculated

### ✅ Agent System
- Claude Code CLI is available (optional)
- Agents can be initialized
- System prompts are defined
- Roles are configured correctly

---

## Troubleshooting

### Docker Not Running
```
❌ Testing Docker daemon is running... ❌
    Error: connect ECONNREFUSED /var/run/docker.sock
```

**Fix**:
```bash
sudo systemctl start docker
# or
sudo service docker start
```

### Test Project Missing
```
❌ Testing Test project exists... ❌
    Error: ENOENT: no such file or directory
```

**Fix**:
```bash
./test/reset-test-project.sh
```

### Claude CLI Not Found
```
⊘  AGENTS: Claude Code CLI available... ⊘ SKIPPED
```

**Note**: This is optional - validation will skip agent tests if Claude CLI is not installed.

**To install**:
```bash
npm install -g @anthropic-ai/claude-cli
```

### Container Already Exists
```
❌ Testing Docker container creation... ❌
    Error: Conflict. The container name is already in use
```

**Fix**:
```bash
claude cleanup --all
```

---

## Best Practices

### When to Run

**Always**:
- ✅ Before committing changes
- ✅ After pulling updates
- ✅ Before releases
- ✅ After fixing bugs

**Regularly**:
- ✅ Daily (automated)
- ✅ Before demos
- ✅ After dependencies update

**When to Run Full**:
- ✅ Weekly
- ✅ Before releases
- ✅ After significant changes
- ✅ In CI/CD pipeline

### Interpreting Results

**All Green** ✅
- System is healthy
- Safe to proceed
- No issues detected

**1-2 Failures** ⚠️
- Investigate failures
- May be environment-specific
- Check error messages for clues

**3+ Failures** ❌
- System has issues
- Do NOT proceed
- Fix issues before continuing
- Check infrastructure (Docker, Git)

**Skipped Tests** ⊘
- Optional components not available
- Usually fine (e.g., Claude CLI)
- Can ignore unless needed

---

## Extending the Validation Suite

### Adding a New Test

**In smoke-test.js**:
```javascript
await runTest('category', 'Test name', async () => {
  // Test logic here
  const result = await someOperation();

  if (!result.isValid) {
    throw new Error('Test failed because...');
  }
});
```

**In validation-suite.js**:
```javascript
await runTest('category', 'Test name', async () => {
  // More comprehensive test logic
  const result = await someOperation();

  if (!result.isValid) {
    throw new Error('Detailed failure message');
  }
}, {
  skip: false,      // Set to true to skip
  timeout: 60000    // Custom timeout in ms
});
```

### Adding a New Category

```javascript
console.log(chalk.cyan('\n' + '═'.repeat(70)));
console.log(chalk.cyan('CATEGORY X: NEW CATEGORY TESTS'));
console.log(chalk.cyan('═'.repeat(70) + '\n'));

await runTest('newCategory', 'First test', async () => {
  // Test logic
});

await runTest('newCategory', 'Second test', async () => {
  // Test logic
});
```

**Update categories object**:
```javascript
const categories = {
  infrastructure: { passed: 0, failed: 0, skipped: 0 },
  fileOps: { passed: 0, failed: 0, skipped: 0 },
  // ... existing categories ...
  newCategory: { passed: 0, failed: 0, skipped: 0 }  // NEW
};
```

---

## Performance

### Smoke Tests
- **Duration**: ~3 seconds
- **Tests**: 7
- **Resource Usage**: Minimal (creates 1 container)

### Full Validation
- **Duration**: ~30-60 seconds
- **Tests**: 24 (1 optional)
- **Resource Usage**: Low (creates 1 container)

### Optimization
- Tests run sequentially for clarity
- Could be parallelized for speed
- Container creation is the slowest part (~2s)
- File operations are fast (~0.1s each)

---

## Summary

### What Was Built

| Component | Purpose | Duration |
|-----------|---------|----------|
| **smoke-test.js** | Quick validation | ~3s |
| **validation-suite.js** | Comprehensive validation | ~30-60s |
| **claude validate** | CLI command | - |

### Test Coverage

| Category | Tests | What's Covered |
|----------|-------|----------------|
| Infrastructure | 6 | Docker, Config, Git |
| File Operations | 5 | Read, Write, Execute |
| Cleanup | 4 | Stop, Remove, Tracking |
| Error Handling | 3 | Timeout, Retry, Classification |
| Cost Tracking | 3 | Initialization, Tracking, Limits |
| Agents | 3 | CLI, Init, Prompts |
| **Total** | **24** | **Complete system coverage** |

### Benefits

- ✅ **Catch regressions** before they reach production
- ✅ **Confidence to change** code without breaking things
- ✅ **Fast feedback** (<3s for smoke tests)
- ✅ **Comprehensive coverage** (all critical paths)
- ✅ **Easy to run** (`claude validate`)
- ✅ **Clear output** (know exactly what failed)

---

**Last Updated**: 2025-10-21
**Version**: Added in v0.9.2 (unreleased)
**Status**: ✅ Complete and tested
**Lines Added**: ~600 lines across 2 test files
