# ServiceNow Capability Tests

**Quick Links**:
- [Main Test Suite](./servicenow-capability-tests.js) - Executable test runner
- [Cleanup Script](./servicenow-test-cleanup.js) - Clean up test artifacts
- [Full Documentation](./SERVICENOW_TESTS_README.md) - Comprehensive guide
- [Quick Reference](./SERVICENOW_TESTS_QUICK_REFERENCE.md) - Fast lookup
- [Results Template](./SERVICENOW_TEST_RESULTS_TEMPLATE.md) - Score recording
- [Cleanup Guide](./SERVICENOW_CLEANUP_GUIDE.md) - Cleanup documentation
- [Overview](../SERVICENOW_TESTING_SUITE.md) - Project summary

---

## What Is This?

A comprehensive testing suite with **10 ServiceNow development tests** across three difficulty levels:

| Level | Tests | Points | Time |
|-------|-------|--------|------|
| **SIMPLE** | 3 | 35 | 7-10 min |
| **MEDIUM** | 4 | 125 | 33-41 min |
| **COMPLEX** | 3 | 370 | 85-115 min |
| **TOTAL** | **10** | **530** | **2-3 hours** |

---

## Quick Start

```bash
# 1. View all tests
node test/servicenow-capability-tests.js

# 2. Run a test (copy prompt from output)
dev-tools task sn-tools "[task prompt]"

# 3. Monitor progress
dev-tools status

# 4. Validate results
ls ~/projects/sn-tools/

# 5. Clean up after test
node test/servicenow-test-cleanup.js --test-id [TEST-ID]
# Or clean all: node test/servicenow-test-cleanup.js --all
```

---

## Test Overview

### SIMPLE (Basic ServiceNow)
- ✓ Business Rule - Auto-set priority
- ✓ Client Script - Form validation
- ✓ Script Include - Utility function

### MEDIUM (Intermediate Development)
- ✓ REST API - Incident creation with error handling
- ✓ Service Portal Widget - Display incidents with styling
- ✓ Flow Designer - Escalation with approvals
- ✓ Import Set - User import with transform map

### COMPLEX (Advanced Architecture)
- ✓ Smart Assignment System - 11 components, ML-like logic
- ✓ Team Dashboard Portal - 25+ files, full application
- ✓ Slack Integration Spoke - 22+ files, IntegrationHub

---

## Documentation

**Start Here**: [SERVICENOW_TESTING_SUITE.md](../SERVICENOW_TESTING_SUITE.md)

**Then Read**:
1. [SERVICENOW_TESTS_README.md](./SERVICENOW_TESTS_README.md) - Full details
2. [SERVICENOW_TESTS_QUICK_REFERENCE.md](./SERVICENOW_TESTS_QUICK_REFERENCE.md) - Quick lookup

**For Recording**:
- [SERVICENOW_TEST_RESULTS_TEMPLATE.md](./SERVICENOW_TEST_RESULTS_TEMPLATE.md) - Results template

---

## What Gets Tested?

✅ **Code Generation**: Can AI create valid ServiceNow code?
✅ **Best Practices**: Does it follow ServiceNow conventions?
✅ **Agent Routing**: Do correct agents get selected?
✅ **Integration**: Do components work together?
✅ **Security**: Are ACLs and validation included?
✅ **Performance**: Is code optimized?
✅ **Documentation**: Are docs comprehensive?
✅ **Testing**: Are tests provided?

---

## Scoring

| Score | Level | Ability |
|-------|-------|---------|
| 0-35 | Basic | Simple tasks |
| 36-160 | Intermediate | Moderate solutions |
| 161-530 | Advanced | Complex systems |

**Grading**: Completion (40%) + Correctness (30%) + Quality (20%) + Performance (10%)

---

## Status

✅ **Ready**: Tests can be run manually now
🚧 **Coming**: Automated execution in Q1 2025

---

**Created**: 2025-11-13
**Version**: 1.0
**Tests**: 10
**Max Points**: 530
