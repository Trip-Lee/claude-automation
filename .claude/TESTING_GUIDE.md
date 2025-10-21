# Testing Guide

## How to Test the Claude Multi-Agent System

**Last Updated**: October 21, 2025

---

## Testing Philosophy

> **Test early, test often, test before releasing.**

We use a **two-tier testing approach**:
1. **Smoke Tests** - Fast validation (~3s) for continuous development
2. **Full Validation** - Comprehensive testing (~30-60s) before releases

---

## Quick Start

```bash
# Run smoke tests (always use this!)
node cli.js validate --smoke

# Run full validation (before releases)
node cli.js validate --full
```

---

## Tier 1: Smoke Tests

### Purpose
Quick sanity check that core functionality works.

### When to Run
- ✅ Before starting work on the codebase
- ✅ After each meaningful code change
- ✅ Before committing code
- ✅ After pulling updates
- ✅ When something "feels wrong"

### Command
```bash
node cli.js validate --smoke

# Or directly
node test/smoke-test.js
```

### What It Tests (7 Tests)

1. **Docker daemon is running**
   - Verifies Docker is accessible
   - Critical: Everything depends on Docker

2. **Configuration system loads**
   - Config files can be read
   - Projects can be listed
   - No corruption in configs

3. **Test project exists**
   - Test project directory is present
   - Required files (main.py, test_main.py) exist
   - Foundation for integration testing

4. **Docker container creation**
   - Can create containers
   - Volume mounts work
   - Resource limits applied

5. **File operations in container**
   - Can list files
   - Can read files
   - Can write files
   - Python execution works

6. **Container cleanup**
   - Containers can be stopped
   - Containers can be removed
   - No resource leaks

7. **Git operations**
   - Git is accessible
   - Can get current branch
   - Repository is valid

### Expected Duration
**~3 seconds**

### Success Criteria
```
✅ Passed: 7
❌ Failed: 0
```

### Example Output
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

---

## Tier 2: Full Validation Suite

### Purpose
Comprehensive validation of all system components.

### When to Run
- ✅ Before version bumps
- ✅ Before pushing to GitHub
- ✅ After significant changes
- ✅ Weekly (automated health check)
- ✅ Before demos/presentations
- ✅ In CI/CD pipeline

### Command
```bash
node cli.js validate --full

# Or directly
node test/validation-suite.js
```

### What It Tests (24 Tests, 6 Categories)

#### Category 1: Infrastructure (6 tests)
- Docker daemon accessible
- Docker Python image exists
- Configuration system initializes
- Test project configuration exists
- Test project directory exists
- Git operations work

#### Category 2: File Operations (5 tests)
- Container creation
- List files in container
- Read file in container
- Write file in container (to /tmp)
- Execute Python in container
- Run pytest in container

#### Category 3: Cleanup System (4 tests)
- Container stop
- Container remove
- Orchestrator cleanup registration
- Active container tracking

#### Category 4: Error Handling (3 tests)
- ClaudeCodeAgent has timeout
- ClaudeCodeAgent has retry logic
- Error classification works

#### Category 5: Cost Tracking (3 tests)
- CostMonitor initializes
- CostMonitor tracks usage
- CostMonitor enforces limit

#### Category 6: Agent System (3 tests, optional)
- Claude Code CLI available (skipped if not installed)
- ClaudeCodeAgent initializes
- Agent system prompts defined

### Expected Duration
**~30-60 seconds**

### Success Criteria
```
✅ Passed: 23-24 (depending on Claude CLI availability)
❌ Failed: 0
⊘  Skipped: 0-1 (Claude CLI test may be skipped)
```

### Example Output
```
═══════════════════════════════════════════════
CATEGORY 1: INFRASTRUCTURE TESTS
═══════════════════════════════════════════════

  INFRASTRUCTURE: Docker daemon accessible... ✅
  INFRASTRUCTURE: Docker Python image exists... ✅
  INFRASTRUCTURE: Configuration system initializes... ✅
  INFRASTRUCTURE: Test project configuration exists... ✅
  INFRASTRUCTURE: Test project directory exists... ✅
  INFRASTRUCTURE: Git operations work... ✅

═══════════════════════════════════════════════
CATEGORY 2: FILE OPERATIONS TESTS
═══════════════════════════════════════════════

  FILEOPS: Container creation... ✅
  FILEOPS: List files in container... ✅
  FILEOPS: Read file in container... ✅
  FILEOPS: Write file in container (temp)... ✅
  FILEOPS: Execute Python in container... ✅
  FILEOPS: Run pytest in container... ✅

[... more categories ...]

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

## Adding New Tests

### To Smoke Tests (test/smoke-test.js)

**Only add tests that are:**
- ✅ Critical infrastructure
- ✅ Fast (<1 second)
- ✅ High-level sanity checks

```javascript
// Add at appropriate location
await runTest('Test name', async () => {
  // Test logic here
  const result = await operation();

  if (!result.isValid) {
    throw new Error('Specific reason for failure');
  }
});
```

### To Full Validation (test/validation-suite.js)

**Add comprehensive tests for:**
- ✅ New features
- ✅ Edge cases
- ✅ Error scenarios
- ✅ Resource management

```javascript
// Add to appropriate category section
await runTest('category', 'Test name', async () => {
  // Comprehensive test logic
  const result = await operation();

  if (!result.isValid) {
    throw new Error('Detailed failure message with context');
  }
}, {
  skip: false,      // Set true to temporarily skip
  timeout: 60000    // Custom timeout (default: 60s)
});
```

### Adding New Category

```javascript
// 1. Add to categories object at top
const categories = {
  infrastructure: { passed: 0, failed: 0, skipped: 0 },
  fileOps: { passed: 0, failed: 0, skipped: 0 },
  // ... existing categories ...
  newCategory: { passed: 0, failed: 0, skipped: 0 }  // NEW
};

// 2. Add category section
console.log(chalk.cyan('\\n' + '═'.repeat(70)));
console.log(chalk.cyan('CATEGORY X: NEW CATEGORY TESTS'));
console.log(chalk.cyan('═'.repeat(70) + '\\n'));

await runTest('newCategory', 'First test', async () => {
  // Test logic
});

await runTest('newCategory', 'Second test', async () => {
  // Test logic
});
```

---

## Test-Driven Development (TDD)

For new features, consider writing tests first:

### 1. Write Test (Red)
```javascript
await runTest('fileOps', 'Copy file in container', async () => {
  const output = await dockerManager.exec(container,
    'cp /workspace/main.py /tmp/main_copy.py && cat /tmp/main_copy.py'
  );

  if (!output.includes('def greet')) {
    throw new Error('File not copied correctly');
  }
});
```

### 2. Run Test (Fail)
```bash
node test/validation-suite.js
# Expect: ❌ Copy file in container
```

### 3. Implement Feature (Green)
```javascript
// Add copy functionality to DockerManager
async copy(containerId, source, dest) {
  return await this.exec(containerId, `cp ${source} ${dest}`);
}
```

### 4. Run Test (Pass)
```bash
node test/validation-suite.js
# Expect: ✅ Copy file in container
```

### 5. Refactor (Clean)
Improve code while keeping tests green.

---

## Interpreting Test Results

### All Green ✅
```
✅ Passed: 7
❌ Failed: 0
```

**Action**: Safe to proceed. System is healthy.

### 1-2 Failures ⚠️
```
✅ Passed: 5
❌ Failed: 2
```

**Action**:
1. Read error messages
2. Investigate failures
3. Fix underlying issues
4. Re-run tests
5. Don't proceed until green

### 3+ Failures ❌
```
✅ Passed: 2
❌ Failed: 5
```

**Action**:
1. **STOP** - System has major issues
2. Check infrastructure:
   - Is Docker running? `docker ps`
   - Is test project valid? `ls ~/projects/test-project`
   - Are dependencies installed? `npm install`
3. Review recent changes
4. Consider reverting to last known good state
5. Fix issues before continuing

### Skipped Tests ⊘
```
✅ Passed: 23
❌ Failed: 0
⊘  Skipped: 1
```

**Action**: Usually fine. Skipped tests are optional features:
- Claude CLI not installed (optional)
- Feature not implemented yet
- Platform-specific test not applicable

---

## Troubleshooting Test Failures

### Docker Tests Failing

**Symptom**: "Docker daemon is running... ❌"

**Solutions**:
```bash
# Check if Docker is running
docker ps

# Start Docker
sudo systemctl start docker

# Check Docker socket permissions
ls -l /var/run/docker.sock
sudo chmod 666 /var/run/docker.sock  # If needed
```

### Test Project Missing

**Symptom**: "Test project exists... ❌"

**Solution**:
```bash
# Reset test project
./test/reset-test-project.sh

# Verify
ls -la ~/projects/test-project
```

### Container Creation Failing

**Symptom**: "Docker container creation... ❌"

**Possible Causes**:
1. Docker image missing
2. Container name conflict
3. Resource limits too high
4. Volume mount path invalid

**Solutions**:
```bash
# Check image exists
docker images | grep claude-python

# Build if missing
docker build -t claude-python:latest .

# Clean up existing containers
node cli.js cleanup --all

# Check disk space
df -h
```

### Git Operations Failing

**Symptom**: "Git operations... ❌"

**Solutions**:
```bash
# Check if test-project is git repo
cd ~/projects/test-project
git status

# Re-initialize if needed
./test/reset-test-project.sh
```

### Timeout Errors

**Symptom**: "Test timeout" error

**Causes**:
- Network slow
- Docker slow
- System under heavy load

**Solutions**:
```bash
# Increase timeout in test file
// In test file
const timeout = 120000; // 2 minutes instead of 60s

# Or temporarily disable other services
docker ps  # Check what's running
```

---

## Performance Monitoring

### Tracking Test Duration

Tests should complete within expected times:

| Test Suite | Expected | Warning | Critical |
|------------|----------|---------|----------|
| Smoke Tests | <5s | 5-10s | >10s |
| Full Validation | <60s | 60-90s | >90s |

### Slow Tests

If tests are slow:

```bash
# Run with timing
time node cli.js validate --smoke

# Check Docker performance
docker stats

# Check disk I/O
iostat -x 1
```

**Common Causes**:
- Docker daemon slow (restart Docker)
- Disk I/O bottleneck (check disk space)
- Network slow (check internet connection)
- Too many containers running (cleanup)

---

## Continuous Integration

### Local Pre-Commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/sh

echo "Running validation tests..."
node cli.js validate --smoke

if [ $? -ne 0 ]; then
  echo "❌ Validation failed - commit aborted"
  exit 1
fi

exit 0
```

### GitHub Actions

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
      - run: docker build -t claude-python:latest .
      - run: node cli.js validate --full
```

---

## Test Coverage Guidelines

### Current Coverage

- ✅ Infrastructure: 100%
- ✅ File Operations: 100%
- ✅ Cleanup: 100%
- ✅ Error Handling: 100%
- ✅ Cost Tracking: 100%
- ⚠️  Agent System: 67% (Claude CLI optional)

### Coverage Goals

- **Critical Paths**: 100% coverage
- **Core Features**: 80-100% coverage
- **Optional Features**: 50-80% coverage
- **Overall Target**: 80% coverage

### Adding Coverage

When adding new code:
1. Write tests for critical paths first
2. Add integration tests
3. Add edge case tests
4. Run coverage analysis

---

## Best Practices

### DO ✅

- Run smoke tests before every commit
- Run full validation before pushing to GitHub
- Add tests for new features
- Update tests when behavior changes
- Fix failing tests immediately
- Keep tests fast
- Use descriptive test names
- Clean up test resources

### DON'T ❌

- Skip tests because "it works on my machine"
- Commit code without testing
- Disable failing tests instead of fixing
- Write slow tests without timeout
- Forget to cleanup test resources
- Add tests that depend on external services
- Make tests flaky (random failures)
- Test implementation details instead of behavior

---

## Quick Reference

### Daily Workflow

```bash
# Morning: Check system health
node cli.js validate --smoke

# After changes: Quick check
node cli.js validate --smoke

# Before commit: Quick check
node cli.js validate --smoke

# Before push: Full check
node cli.js validate --full
```

### Test Files Location

- Smoke tests: `test/smoke-test.js` (193 lines)
- Full validation: `test/validation-suite.js` (451 lines)
- Test documentation: `docs/VALIDATION_SYSTEM.md` (511 lines)

### Common Commands

```bash
# Smoke tests
node cli.js validate --smoke
node test/smoke-test.js

# Full validation
node cli.js validate --full
node test/validation-suite.js

# With verbose errors
VERBOSE=1 node test/validation-suite.js

# Clean test environment
node cli.js cleanup --all
./test/reset-test-project.sh
```

---

**Last Updated**: 2025-10-21
**Next Review**: When adding new test categories or significantly changing test strategy
**Maintained By**: Development team
