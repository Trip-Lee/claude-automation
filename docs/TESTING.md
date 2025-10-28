# Testing Guide

**Version**: v0.11.0-alpha
**Date**: 2025-10-24
**Status**: Testing infrastructure complete

---

## Overview

The system has comprehensive testing at three levels:
1. **Unit Tests** - Test individual functions and methods
2. **Smoke Tests** - Quick system health check (<30s)
3. **Validation Suite** - Comprehensive system validation (~5s)

---

## Quick Start

### Run All Tests
```bash
npm test                    # Unit tests only
npm run test:all            # Unit + Smoke + Validation
```

### Run Specific Test Types
```bash
# Unit tests (25 tests for critical modules)
npm run test:unit
./cli.js test

# Quick smoke test (<30s)
npm run test:smoke
./cli.js validate --smoke

# Full validation suite (~5s)
npm run test:validate
./cli.js validate --full

# Default validation (smoke)
./cli.js validate
```

---

## Test Coverage

### Current Coverage: ~30% (Critical Paths)

| Module | Unit Tests | Coverage | Status |
|--------|------------|----------|--------|
| **ClaudeCodeAgent** | 25 tests | High | ✅ Complete |
| **Orchestrator** | 0 tests | Low | ⬜ Planned |
| **ConfigManager** | 0 tests | Low | ⬜ Planned |
| **Docker Manager** | Smoke | Partial | ⚠️ Needs unit tests |
| **Git Manager** | Smoke | Partial | ⚠️ Needs unit tests |
| **Cost Monitor** | Validation | Medium | ✅ Good |
| **Agent Registry** | 0 tests | Low | ⬜ Planned |
| **Task Planner** | 0 tests | Low | ⬜ Planned |

**Goal**: 50-60% coverage (critical paths only)

---

## 1. Unit Tests

### Purpose
Test individual functions and classes in isolation.

### Location
`test/unit/*.test.js`

### Run
```bash
npm test
# or
./cli.js test
```

### Current Tests

#### ClaudeCodeAgent (25 tests) ✅
- **Configuration** (4 tests)
  - Default initialization
  - Custom timeout
  - Custom retry settings
  - Unique session IDs

- **Role Configuration** (4 tests)
  - Architect role with tools
  - Coder role with tools
  - Reviewer role with tools
  - Empty tools default

- **Error Classification** (6 tests)
  - Rate limit errors (retryable)
  - Network errors (retryable)
  - Connection reset (retryable)
  - Permission denied (non-retryable)
  - Not found (non-retryable)
  - Syntax errors (non-retryable)

- **Error Enhancement** (3 tests)
  - Context addition
  - Permission hints
  - CLI not found hints

- **System Prompts** (3 tests)
  - Architect prompt generation
  - Coder prompt generation
  - Reviewer prompt generation

- **Tool Configuration** (3 tests)
  - Architect tools
  - Coder tools
  - Custom tools

- **Helper Methods** (2 tests)
  - Sleep function
  - Retry configuration

### Writing Unit Tests

Create a new file in `test/unit/` with `.test.js` extension:

```javascript
#!/usr/bin/env node

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { MyModule } from '../../lib/my-module.js';

describe('MyModule - Feature', () => {
  let instance;

  before(() => {
    instance = new MyModule();
  });

  it('should do something', () => {
    const result = instance.doSomething();
    assert.ok(result);
    assert.equal(result.value, 'expected');
  });
});
```

### Test Runner
The test runner (`test/run-unit-tests.js`) automatically discovers and runs all `*.test.js` files in `test/unit/`.

---

## 2. Smoke Tests

### Purpose
Quick health check to ensure system basics work.

### Duration
< 30 seconds

### Location
`test/smoke-test.js`

### Run
```bash
npm run test:smoke
# or
./cli.js validate --smoke
```

### Tests (7 total)

1. ✅ **Docker daemon is running**
   - Checks Docker is accessible
   - Validates connection

2. ✅ **Configuration system loads**
   - ConfigManager initializes
   - Project list accessible

3. ✅ **Test project exists**
   - Directory present
   - Required files (main.py, test_main.py)

4. ✅ **Docker container creation**
   - Creates test container
   - Returns valid container ID

5. ✅ **File operations in container**
   - List files (ls)
   - Read files (cat)
   - Write files (echo | tee)

6. ✅ **Container cleanup**
   - Stop container
   - Remove container

7. ✅ **Git operations**
   - Get current branch
   - Status works

### Use Cases
- Before making changes
- After system updates
- Quick sanity check
- CI/CD pipeline

---

## 3. Validation Suite

### Purpose
Comprehensive system validation covering all components.

### Duration
~5 seconds (fast!)

### Location
`test/validation-suite.js`

### Run
```bash
npm run test:validate
# or
./cli.js validate --full
```

### Test Categories (25 tests)

#### Infrastructure (6 tests) ✅
- Docker daemon accessible
- Docker Python image exists
- Configuration system initializes
- Test project configuration exists
- Test project directory exists
- Git operations work

#### File Operations (6 tests) ✅
- Container creation
- List files in container
- Read file in container
- Write file in container (temp)
- Execute Python in container
- Run pytest in container

#### Cleanup System (4 tests) ✅
- Container stop
- Container remove
- Orchestrator cleanup registration
- Active container tracking

#### Error Handling (3 tests) ✅
- ClaudeCodeAgent has timeout
- ClaudeCodeAgent has retry logic
- Error classification works

#### Cost Tracking (3 tests) ✅
- CostMonitor initializes
- CostMonitor tracks usage
- CostMonitor enforces limit

#### Agent System (3 tests) ✅
- Claude Code CLI available
- ClaudeCodeAgent initializes
- Agent system prompts defined

### Results by Category
```
✅ infrastructure       6/6 passed
✅ agents               3/3 passed
✅ errorHandling        3/3 passed
✅ cleanup              4/4 passed
✅ fileOps              6/6 passed
✅ costTracking         3/3 passed
```

---

## Test Results

### Current Status (2025-10-24)

```
Unit Tests:      25/25 passed ✅
Smoke Tests:     7/7 passed ✅
Validation:      25/25 passed ✅
Total:           57/57 passed ✅
Coverage:        ~30% (critical paths)
```

### Performance

| Test Type | Duration | Tests | Status |
|-----------|----------|-------|--------|
| Unit Tests | ~0.2s | 25 | ✅ Fast |
| Smoke Tests | ~3-5s | 7 | ✅ Quick |
| Validation Suite | ~3-5s | 25 | ✅ Fast |
| **Total** | **~8s** | **57** | **✅ Excellent** |

---

## CLI Commands Summary

### Test Commands
```bash
# Unit tests
claude test                 # Run unit tests
npm test                    # Same as above

# Validation
claude validate             # Quick smoke test (default)
claude validate --smoke     # Explicit smoke test
claude validate --full      # Full validation suite

# All tests
claude test --all           # Unit + smoke + validation
npm run test:all            # Same as above
```

### Test Scripts (package.json)
```json
{
  "scripts": {
    "test": "node test/run-unit-tests.js",
    "test:unit": "node test/run-unit-tests.js",
    "test:smoke": "node test/smoke-test.js",
    "test:validate": "node test/validation-suite.js",
    "test:all": "npm run test:unit && npm run test:smoke && npm run test:validate"
  }
}
```

---

## Continuous Integration

### Pre-Commit Hook
Run smoke tests before committing:
```bash
#!/bin/bash
# .git/hooks/pre-commit
npm run test:smoke || exit 1
```

### Pre-Push Hook
Run full validation before pushing:
```bash
#!/bin/bash
# .git/hooks/pre-push
npm run test:validate || exit 1
```

### CI Pipeline
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm install
      - name: Run all tests
        run: npm run test:all
```

---

## Next Steps

### High Priority (Week 2)
1. **Orchestrator Unit Tests**
   - Cleanup logic
   - Container tracking
   - Error handling
   - Git operations

2. **ConfigManager Unit Tests**
   - Configuration loading
   - Validation
   - Defaults
   - Error cases

3. **Increase Coverage to 50-60%**
   - Focus on critical paths
   - Test error scenarios
   - Edge case handling

### Medium Priority (Week 3-4)
4. **Integration Tests**
   - Full workflow (simple task)
   - Error scenarios
   - Interruption handling

5. **Performance Tests**
   - Measure task durations
   - Cost tracking accuracy
   - Memory usage

6. **Docker Manager Unit Tests**
   - Container operations
   - Capability configuration
   - Resource limits

---

## Debugging Failed Tests

### Unit Test Failures
```bash
# Run specific test file
node --test test/unit/claude-code-agent.test.js

# Verbose output
node --test --test-reporter=spec test/unit/claude-code-agent.test.js
```

### Smoke Test Failures
Common issues:
- Docker not running → `systemctl start docker`
- Test project missing → Run setup script
- Permissions → Check user in docker group

### Validation Suite Failures
Check logs for specific category failures:
- Infrastructure → Docker/Git issues
- File Ops → Container permissions
- Cleanup → Resource leaks
- Error Handling → Agent configuration
- Cost Tracking → Monitor initialization
- Agents → Claude CLI availability

---

## Test Maintenance

### Adding New Tests
1. Create `test/unit/module-name.test.js`
2. Follow existing test structure
3. Run tests to verify
4. Update this documentation

### Updating Tests
1. Keep tests in sync with code
2. Update test descriptions
3. Verify all tests still pass
4. Document any new test categories

### Removing Tests
1. Only remove obsolete tests
2. Document why in commit message
3. Update coverage metrics

---

## Best Practices

### Writing Good Tests
- ✅ Test one thing per test
- ✅ Use descriptive test names
- ✅ Keep tests fast (<100ms each)
- ✅ Avoid external dependencies
- ✅ Clean up resources (containers, files)

### Test Organization
- ✅ Group related tests with `describe()`
- ✅ Use `before()` for setup
- ✅ Use `after()` for cleanup
- ✅ Keep tests independent

### Assertions
- ✅ Use strict assertions (`assert/strict`)
- ✅ Check both positive and negative cases
- ✅ Test edge cases
- ✅ Verify error messages

---

## FAQ

### Q: Why do tests take so long?
A: They don't! Total test time is ~8 seconds for all 57 tests.

### Q: Can I run tests in parallel?
A: Unit tests run in parallel automatically. Smoke/validation tests run sequentially for safety.

### Q: What if Docker is not running?
A: Smoke and validation tests will fail. Start Docker with `systemctl start docker`.

### Q: How do I skip certain tests?
A: Use `it.skip()` in unit tests, or modify smoke/validation scripts.

### Q: Why are some tests skipped?
A: Some tests require Claude CLI. They skip if CLI not available.

---

## Summary

**Testing Infrastructure**: ✅ Complete
- Unit tests for critical modules
- Smoke tests for quick validation
- Comprehensive validation suite
- CLI integration
- NPM scripts
- Documentation

**Current Status**: 57/57 tests passing (100%)
**Coverage**: ~30% (critical paths)
**Goal**: 50-60% coverage by Week 2

**Next**: Add unit tests for Orchestrator and ConfigManager

---

**Last Updated**: 2025-10-24
**Maintained By**: System development team
