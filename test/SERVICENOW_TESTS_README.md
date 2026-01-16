# ServiceNow Capability Tests

**Purpose**: Evaluate the AI's ability to complete real-world ServiceNow development tasks using the current claude-automation toolset.

**Version**: 1.0
**Date**: 2025-11-13
**Total Tests**: 10 (3 Simple + 4 Medium + 3 Complex)
**Max Score**: 485 points

---

## Overview

This test suite evaluates AI capabilities across three difficulty levels for ServiceNow development:

| Level | Tests | Points | Description |
|-------|-------|--------|-------------|
| **SIMPLE** | 3 | 35 | Basic ServiceNow development (1-2 files, straightforward logic) |
| **MEDIUM** | 4 | 125 | Moderate complexity (3-5 files, some integration) |
| **COMPLEX** | 3 | 370 | Advanced tasks (multiple components, integrations, security) |

---

## Test Breakdown

### SIMPLE Tests (35 points)

#### SN-SIMPLE-001: Create Basic Business Rule (10 points)
- **Time**: 2-3 minutes
- **Task**: Auto-set incident priority based on impact/urgency
- **Artifacts**: 1 business rule file
- **Agents**: architect → sn-scripting → reviewer

#### SN-SIMPLE-002: Create Client Script for Form Validation (10 points)
- **Time**: 2-3 minutes
- **Task**: Validate short description on form submission
- **Artifacts**: 1 client script file
- **Agents**: architect → sn-scripting → reviewer

#### SN-SIMPLE-003: Create Script Include for Utility Function (15 points)
- **Time**: 3-4 minutes
- **Task**: Reusable function to count open incidents by user
- **Artifacts**: 1 script include file
- **Agents**: architect → sn-scripting → reviewer

---

### MEDIUM Tests (125 points)

#### SN-MEDIUM-001: Create REST API Endpoint with Error Handling (25 points)
- **Time**: 5-7 minutes
- **Task**: Build Scripted REST API for incident creation
- **Artifacts**: 2 files (API definition + POST method)
- **Agents**: architect → sn-api → sn-security → reviewer

#### SN-MEDIUM-002: Create Service Portal Widget (30 points)
- **Time**: 8-10 minutes
- **Task**: Widget to display user's open incidents with styling
- **Artifacts**: 4 files (server, client, HTML, CSS)
- **Agents**: architect → sn-ui → sn-testing → reviewer

#### SN-MEDIUM-003: Create Flow with Approval and Notifications (35 points)
- **Time**: 10-12 minutes
- **Task**: Flow Designer flow for incident escalation with approvals
- **Artifacts**: 2 files (flow JSON + documentation)
- **Agents**: architect → sn-flows → sn-testing → reviewer

#### SN-MEDIUM-004: Create Import Set with Transform Map (35 points)
- **Time**: 10-12 minutes
- **Task**: Import external users via CSV with validation and lookups
- **Artifacts**: 5 files (table, transform map, scripts, test data)
- **Agents**: architect → sn-integration → sn-security → sn-testing → reviewer

---

### COMPLEX Tests (370 points)

#### SN-COMPLEX-001: Build Complete Incident Management Enhancement (100 points)
- **Time**: 20-30 minutes
- **Task**: Smart incident assignment system with ML-like logic
- **Artifacts**: 11 files (script includes, business rules, REST API, client scripts, scheduled jobs, ACLs, tests, docs)
- **Agents**: architect → sn-scripting → sn-api → sn-ui → sn-security → sn-performance → sn-testing → documenter → reviewer

**Components**:
- Script Include for assignment engine
- Business rule for auto-assignment
- REST API for manual override
- Client script for feedback collection
- Scheduled job for reporting
- ACLs for security
- ATF tests for all components

#### SN-COMPLEX-002: Build Service Portal Application with Backend (120 points)
- **Time**: 30-40 minutes
- **Task**: Complete "Team Dashboard" portal with multiple pages and widgets
- **Artifacts**: 25+ files (portal pages, widgets, REST APIs, script includes, scheduled jobs, tests, docs)
- **Agents**: architect → sn-ui → sn-api → sn-scripting → sn-integration → sn-security → sn-performance → sn-testing → documenter → reviewer

**Features**:
- 3 portal pages (dashboard, incidents, analytics)
- 7+ widgets (metrics, activity feed, incident list, charts, etc.)
- REST API backend
- Real-time updates
- Responsive design
- Dark/light theme
- Export functionality

#### SN-COMPLEX-003: Build Integration Hub Spoke with External API (150 points)
- **Time**: 35-45 minutes
- **Task**: Complete IntegrationHub spoke for Slack integration
- **Artifacts**: 22+ files (connection, credentials, 8 flow actions, 3 subflows, scripts, tests, docs)
- **Agents**: architect → sn-flows → sn-integration → sn-api → sn-scripting → sn-security → sn-testing → documenter → reviewer

**Components**:
- OAuth 2.0 connection setup
- 8 flow actions (send message, create channel, upload file, etc.)
- 3 subflows (incident notification, user sync, war room creation)
- Comprehensive error handling
- Integration tests with mocks
- Professional documentation

---

## Running Tests

### Manual Execution (Current)

```bash
# View all tests
node test/servicenow-capability-tests.js

# Run individual test with dev-tools
dev-tools task sn-tools "Create a business rule on the Incident table that automatically sets Priority to 1..."

# Validate results manually against success criteria
```

### Automated Execution (Future)

```bash
# Run all tests automatically
node test/servicenow-capability-tests.js --automated

# Run specific difficulty level
node test/servicenow-capability-tests.js --automated --level simple
node test/servicenow-capability-tests.js --automated --level medium
node test/servicenow-capability-tests.js --automated --level complex

# Run specific test
node test/servicenow-capability-tests.js --automated --test SN-MEDIUM-001
```

---

## Success Criteria

Each test includes specific success criteria to validate completion. Examples:

**Code Quality**:
- Proper error handling (try-catch blocks)
- Logging statements (gs.log, gs.info, gs.error)
- Comments and documentation
- JSDoc for functions
- Follows ServiceNow best practices

**Functionality**:
- All required features implemented
- Edge cases handled
- Validation logic included
- Security considerations addressed
- Performance optimized

**Testing**:
- ATF tests provided where applicable
- Test coverage adequate
- Mock data included
- Test scenarios comprehensive

**Documentation**:
- Clear explanations of logic
- Usage examples included
- Setup instructions provided
- Troubleshooting guidance

---

## Scoring System

### Point Values

| Complexity | Point Range | Competency Level |
|------------|-------------|------------------|
| 0-35 | Basic | Can complete simple ServiceNow tasks |
| 36-160 | Intermediate | Can build moderate ServiceNow solutions |
| 161-485 | Advanced | Can architect complex ServiceNow systems |

### Grading Rubric

Each test is scored based on:

1. **Completion** (40%): All required artifacts created
2. **Correctness** (30%): Logic is sound and follows requirements
3. **Quality** (20%): Code quality, error handling, documentation
4. **Performance** (10%): Efficient queries, optimized logic

**Scoring Scale**:
- 100%: Exceeds all criteria, production-ready
- 80-99%: Meets all criteria with minor issues
- 60-79%: Meets most criteria with some gaps
- 40-59%: Partially complete or significant issues
- 0-39%: Incomplete or incorrect

---

## Test Validation

### Simple Test Validation

For SIMPLE tests, validate:
- [ ] File created in expected location
- [ ] Code syntax is valid
- [ ] Logic matches requirements
- [ ] Basic error handling present
- [ ] Comments explain logic

### Medium Test Validation

For MEDIUM tests, also validate:
- [ ] All components integrate correctly
- [ ] Security considerations addressed
- [ ] Error handling comprehensive
- [ ] Test scenarios included
- [ ] Documentation adequate

### Complex Test Validation

For COMPLEX tests, also validate:
- [ ] Architecture is sound
- [ ] All components work together
- [ ] Performance is optimized
- [ ] Security audit passed
- [ ] Full test coverage
- [ ] Professional documentation

---

## Expected Agent Behavior

### Agent Sequences

The AI should intelligently route tasks to appropriate agents:

**Simple Tasks**: 3 agents
- architect (analyze) → sn-scripting (implement) → reviewer (validate)

**Medium Tasks**: 4-5 agents
- architect → specialized agent (sn-api, sn-ui, etc.) → sn-security/sn-testing → reviewer

**Complex Tasks**: 6-10 agents
- architect → multiple specialized agents → sn-security → sn-performance → sn-testing → documenter → reviewer

### Dynamic Routing

The system should exhibit:
- Intelligent agent selection based on task keywords
- Appropriate handoffs between agents
- Security reviews for API/integration work
- Performance optimization for database operations
- Testing for all implementation work
- Documentation for complex systems

---

## Known Limitations

### Current System Limitations

1. **No Real ServiceNow Instance**: Tests produce code files but can't validate in actual ServiceNow
2. **No ATF Execution**: Can't run Automated Test Framework tests
3. **No API Testing**: Can't test REST APIs against real endpoints
4. **No UI Rendering**: Can't validate Service Portal widgets visually

### Workarounds

1. **Code Analysis**: Validate code logic through static analysis
2. **Mock Data**: Use sample data to test logic
3. **Simulation**: Simulate ServiceNow behavior in test environment
4. **Human Review**: Manual code review against ServiceNow best practices

---

## Future Enhancements

### Phase 1: Automated Validation (Q1 2025)
- [ ] Automated artifact detection
- [ ] Code syntax validation
- [ ] Logic pattern matching
- [ ] Automated scoring

### Phase 2: ServiceNow Simulation (Q2 2025)
- [ ] Mock ServiceNow environment
- [ ] GlideRecord simulation
- [ ] API endpoint simulation
- [ ] Basic UI rendering

### Phase 3: Real Instance Testing (Q3 2025)
- [ ] Connect to ServiceNow PDI
- [ ] Deploy artifacts automatically
- [ ] Run ATF tests
- [ ] Validate in real environment

### Phase 4: Continuous Testing (Q4 2025)
- [ ] CI/CD integration
- [ ] Automated regression testing
- [ ] Performance benchmarking
- [ ] Quality metrics tracking

---

## Usage Examples

### Example 1: Running Simple Test

```bash
# View test details
node test/servicenow-capability-tests.js

# Copy task prompt from SN-SIMPLE-001
dev-tools task sn-tools "Create a business rule on the Incident table that automatically sets Priority to 1 (Critical) when Impact is 1 (High) and Urgency is 1 (High)"

# Wait for completion (~2-3 minutes)

# Validate artifacts
ls -la ~/projects/sn-tools/business-rules/

# Check success criteria
cat ~/projects/sn-tools/business-rules/auto_set_critical_priority.js

# Score: Did it meet all criteria? Award points accordingly
```

### Example 2: Running Medium Test

```bash
# Run test SN-MEDIUM-002
dev-tools task sn-tools "Create a Service Portal widget named 'My Open Incidents' that shows table of user's open incidents..."

# Wait for completion (~8-10 minutes)

# Validate all 4 artifacts created
ls -la ~/projects/sn-tools/widgets/my_open_incidents/

# Check each file against success criteria
# Score based on rubric
```

### Example 3: Running Complex Test

```bash
# Run test SN-COMPLEX-001 (large prompt)
dev-tools task sn-tools "Build a comprehensive 'Smart Incident Assignment' system with..."

# Monitor progress (~20-30 minutes)
dev-tools status

# Follow logs
dev-tools logs -f <taskId>

# After completion, validate all 11 artifacts
# Review code quality, documentation, tests
# Score comprehensively
```

---

## Reporting Results

### Test Report Format

```
ServiceNow Capability Test Results
Date: 2025-11-13
System Version: v0.14.0

SIMPLE TESTS (35 points max):
- SN-SIMPLE-001: PASS (10/10) - 2.5 minutes
- SN-SIMPLE-002: PASS (10/10) - 2.8 minutes
- SN-SIMPLE-003: PASS (14/15) - 3.2 minutes
Total: 34/35 points (97%)

MEDIUM TESTS (125 points max):
- SN-MEDIUM-001: PASS (24/25) - 6.5 minutes
- SN-MEDIUM-002: PASS (28/30) - 9.2 minutes
- SN-MEDIUM-003: FAIL (15/35) - Error in flow logic
- SN-MEDIUM-004: PASS (32/35) - 11.5 minutes
Total: 99/125 points (79%)

COMPLEX TESTS (370 points max):
- SN-COMPLEX-001: PASS (92/100) - 25.3 minutes
- SN-COMPLEX-002: PASS (105/120) - 32.1 minutes
- SN-COMPLEX-003: PASS (138/150) - 38.7 minutes
Total: 335/370 points (91%)

OVERALL SCORE: 468/485 points (96%)
COMPETENCY LEVEL: Advanced ServiceNow Expert

OBSERVATIONS:
- Excellent code quality throughout
- Minor documentation gaps in some tests
- Flow Designer logic needs improvement
- REST APIs well-designed
- Security best practices followed
- Performance optimization excellent
```

---

## Contributing

To add new tests:

1. Add test object to appropriate array (SIMPLE_TESTS, MEDIUM_TESTS, COMPLEX_TESTS)
2. Include all required fields:
   - id, name, description, taskPrompt
   - expectedArtifacts, successCriteria
   - estimatedTime, expectedAgents
   - complexity, pointValue
3. Update README.md with test details
4. Test manually before committing

---

## Support

For questions or issues:
- Review this documentation
- Check test output for details
- Examine validation logs
- Report issues: https://github.com/Trip-Lee/claude-automation/issues

---

**Status**: Ready for manual execution
**Automated Testing**: Coming in Phase 1 (Q1 2025)
