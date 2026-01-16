# Claude Automation Test Suite

Complete testing infrastructure for claude-automation v0.14.0

---

## Quick Start

```bash
# Run fast tests (recommended)
npm test

# Run all automated tests
npm run test:all

# Run ServiceNow agent tests (long, costs $5-12)
npm run test:servicenow
```

---

## Test Structure

### Core Test Runners

**run-all-tests.js** - Unified test runner (RECOMMENDED)
- Runs all test categories in sequence
- Supports `--quick` and `--servicenow` flags
- Provides comprehensive summary

**run-unit-tests.js** - Unit test runner
- Runs all tests in `test/unit/`
- Fast execution (~30-60s)

**smoke-test.js** - Quick sanity checks
- Validates core functionality
- Runs in ~10-20s

**validation-suite.js** - Infrastructure validation
- Tests Docker, Git, config systems
- Runs in ~3-5s

**stress-test.js** - Performance testing
- Load and memory leak detection
- Runs in ~5-15 minutes

### ServiceNow Agent Tests

**servicenow-capability-tests.js**
- 10 tests validating AI agent capabilities
- Duration: 45-90 minutes
- Cost: $3-6 USD

**servicenow-component-backend-tests.js**
- 6 tests validating component-backend integration
- Duration: 40-60 minutes
- Cost: $2-4 USD

### Test Categories

```
test/
├── run-all-tests.js                    # Unified runner ⭐
├── run-unit-tests.js                   # Unit test runner
├── smoke-test.js                       # Quick sanity checks
├── validation-suite.js                 # Infrastructure validation
├── stress-test.js                      # Performance tests
├── servicenow-capability-tests.js      # AI capability tests
├── servicenow-component-backend-tests.js # Component integration tests
├── lib/
│   └── simple-test-executor.js         # AI test framework
├── unit/                               # 291 unit tests
│   ├── task-state-manager.test.js     # Background task tests
│   ├── orchestrator.test.js           # Workflow coordination
│   ├── config-manager.test.js         # Configuration
│   ├── parallel-agent-manager.test.js # Multi-agent
│   ├── docker-manager.test.js         # Container operations
│   ├── git-manager.test.js            # Git operations
│   ├── task-decomposer.test.js        # Task analysis
│   ├── branch-merger.test.js          # Branch merging
│   └── claude-code-agent.test.js      # Agent execution
└── integration/                        # 77 integration tests
    ├── sn-tools.test.js               # sn-tools safety
    ├── error-recovery.test.js         # Error handling
    ├── end-to-end-workflow.test.js    # Complete workflows
    └── background-task-lifecycle.test.js # Background flows
```

---

## Test Commands

### npm Scripts

```bash
# Default: Fast tests only
npm test

# All automated tests (no ServiceNow)
npm run test:all

# Quick mode (same as npm test)
npm run test:quick

# Individual test suites
npm run test:unit          # Unit tests only
npm run test:smoke         # Smoke tests only
npm run test:validate      # Validation suite only
npm run test:stress        # Stress tests only

# ServiceNow tests
npm run test:servicenow                    # All ServiceNow tests
npm run test:servicenow:capability         # Capability tests
npm run test:servicenow:components         # Component-backend tests
```

### Direct Execution

```bash
# Unified runner with options
node test/run-all-tests.js                # All tests
node test/run-all-tests.js --quick        # Fast tests only
node test/run-all-tests.js --servicenow   # Include ServiceNow tests

# Individual runners
node test/run-unit-tests.js
node test/smoke-test.js
node test/validation-suite.js
node test/stress-test.js
node test/servicenow-capability-tests.js
node test/servicenow-component-backend-tests.js
```

---

## Test Coverage

| Category | Tests | Duration | Purpose |
|----------|-------|----------|---------|
| Unit | 291 | 30-60s | Component isolation |
| Integration | 77 | 10-30s | Component interaction |
| Smoke | 41 | 10-20s | Quick sanity |
| Validation | 25 | 3-5s | Infrastructure |
| Stress | 9 | 5-15m | Performance |
| ServiceNow | 16 | 90-150m | AI workflows |
| **Total** | **459** | **varies** | **Comprehensive** |

**Overall Coverage:** ~75% of codebase

---

## Writing Tests

### Unit Test Template

```javascript
#!/usr/bin/env node

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { YourComponent } from '../../lib/your-component.js';

describe('YourComponent - Feature', () => {
  let component;

  beforeEach(() => {
    component = new YourComponent();
  });

  it('should do something correctly', () => {
    const result = component.doSomething();
    assert.equal(result, expectedValue);
  });
});
```

### Integration Test Template

```javascript
#!/usr/bin/env node

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ComponentA } from '../../lib/component-a.js';
import { ComponentB } from '../../lib/component-b.js';

describe('ComponentA + ComponentB Integration', () => {
  it('should work together', async () => {
    const a = new ComponentA();
    const b = new ComponentB(a);

    const result = await b.processWithA();
    assert.ok(result.success);
  });
});
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  quick-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test

  full-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:all
```

---

## Troubleshooting

### Common Issues

**Tests failing with ENOENT**
```bash
cd /home/coltrip/claude-automation
npm test
```

**Docker tests failing**
```bash
# Check Docker is running
docker ps

# Restart Docker
sudo systemctl restart docker
```

**Out of memory**
```bash
node --max-old-space-size=4096 test/stress-test.js
```

**ServiceNow tests timing out**
```bash
# Tests have 15-minute timeout by default
# Complex tests may need more time
# This is expected for COMPLEX tests
```

---

## Performance Benchmarks

Latest test run results:

```
✅ Unit Tests:       291 tests in 35s   (8.3 tests/sec)
✅ Integration:      77 tests in 18s    (4.3 tests/sec)
✅ Smoke Tests:      41 tests in 12s    (3.4 tests/sec)
✅ Validation:       25 tests in 3.3s   (7.6 tests/sec)
✅ Stress Tests:     9 tests in 480s    (0.02 tests/sec)
✅ ServiceNow:       16 tests in ~5400s (0.003 tests/sec)

Total Automated:     418 tests in ~9 minutes
Full Suite:          434 tests in ~90-150 minutes (with ServiceNow)
```

---

## More Information

See `/home/coltrip/claude/TESTING_GUIDE.md` for comprehensive documentation including:
- Detailed test descriptions
- Performance optimization tips
- Best practices
- Advanced usage
- Test maintenance guide

---

**Test Suite Status:** ✅ Fully Operational
**Coverage:** ~75%
**Pass Rate:** 100% (418/418 automated tests)
**Last Updated:** 2025-11-15
