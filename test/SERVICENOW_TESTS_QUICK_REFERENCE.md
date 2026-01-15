# ServiceNow Capability Tests - Quick Reference

**Version**: 1.0
**Date**: 2025-11-13
**Total**: 10 tests (3 Simple + 4 Medium + 3 Complex) = 485 points max

---

## Quick Test Index

### SIMPLE (35 points) - 2-4 minutes each

| ID | Test | Points | Time | Files |
|----|------|--------|------|-------|
| **SN-SIMPLE-001** | Basic Business Rule | 10 | 2-3 min | 1 |
| **SN-SIMPLE-002** | Client Script Validation | 10 | 2-3 min | 1 |
| **SN-SIMPLE-003** | Script Include Utility | 15 | 3-4 min | 1 |

### MEDIUM (125 points) - 5-12 minutes each

| ID | Test | Points | Time | Files |
|----|------|--------|------|-------|
| **SN-MEDIUM-001** | REST API with Error Handling | 25 | 5-7 min | 2 |
| **SN-MEDIUM-002** | Service Portal Widget | 30 | 8-10 min | 4 |
| **SN-MEDIUM-003** | Flow with Approvals | 35 | 10-12 min | 2 |
| **SN-MEDIUM-004** | Import Set + Transform Map | 35 | 10-12 min | 5 |

### COMPLEX (370 points) - 20-45 minutes each

| ID | Test | Points | Time | Files |
|----|------|--------|------|-------|
| **SN-COMPLEX-001** | Smart Incident Assignment System | 100 | 20-30 min | 11 |
| **SN-COMPLEX-002** | Team Dashboard Portal App | 120 | 30-40 min | 25+ |
| **SN-COMPLEX-003** | IntegrationHub Slack Spoke | 150 | 35-45 min | 22+ |

---

## How to Run

### View All Tests
```bash
node test/servicenow-capability-tests.js
```

### Run Individual Test
```bash
# Copy the task prompt from test output
dev-tools task sn-tools "[paste task prompt here]"

# Monitor progress
dev-tools status

# Follow logs
dev-tools logs -f <taskId>
```

### Validate Results
```bash
# Check artifacts were created
ls -la ~/projects/sn-tools/[artifact-path]

# Review code against success criteria
cat ~/projects/sn-tools/[artifact-path]/[file]

# Score based on rubric (completion, correctness, quality, performance)
```

---

## Scoring Guide

### Point Ranges
- **0-35 points**: Basic ServiceNow competency
- **36-160 points**: Intermediate ServiceNow developer
- **161-485 points**: Advanced ServiceNow expert

### Grading Scale
- **100%**: Exceeds all criteria, production-ready
- **80-99%**: Meets all criteria with minor issues
- **60-79%**: Meets most criteria with some gaps
- **40-59%**: Partially complete or significant issues
- **0-39%**: Incomplete or incorrect

### Scoring Factors
1. **Completion** (40%): All required artifacts created
2. **Correctness** (30%): Logic is sound and follows requirements
3. **Quality** (20%): Code quality, error handling, documentation
4. **Performance** (10%): Efficient queries, optimized logic

---

## Expected Agent Sequences

### Simple Tests (3 agents)
`architect → sn-scripting → reviewer`

### Medium Tests (4-5 agents)
- **API**: `architect → sn-api → sn-security → reviewer`
- **UI**: `architect → sn-ui → sn-testing → reviewer`
- **Flow**: `architect → sn-flows → sn-testing → reviewer`
- **Integration**: `architect → sn-integration → sn-security → sn-testing → reviewer`

### Complex Tests (6-10 agents)
`architect → [multiple specialized] → sn-security → sn-performance → sn-testing → documenter → reviewer`

---

## Success Criteria Checklist

### All Tests Must Have:
- [ ] Correct file structure
- [ ] Valid code syntax
- [ ] Logic matches requirements
- [ ] Error handling (try-catch)
- [ ] Logging statements
- [ ] Code comments
- [ ] Follows ServiceNow conventions

### Medium/Complex Tests Must Also Have:
- [ ] Component integration
- [ ] Security considerations
- [ ] Validation logic
- [ ] Test scenarios
- [ ] Documentation

### Complex Tests Must Also Have:
- [ ] Sound architecture
- [ ] Performance optimization
- [ ] Comprehensive testing
- [ ] Professional documentation
- [ ] Production-ready quality

---

## Test Details by ID

### SN-SIMPLE-001: Basic Business Rule
**Task**: Auto-set incident priority to Critical when Impact=High AND Urgency=High
**Key Checks**:
- Before insert/update
- Condition: `current.impact == 1 && current.urgency == 1`
- Action: `current.priority = 1`
- Proper comments

---

### SN-SIMPLE-002: Client Script Validation
**Task**: Validate Short Description is not empty on form submit
**Key Checks**:
- Type: onSubmit
- Get value: `g_form.getValue('short_description')`
- Show error: `g_form.addErrorMessage()`
- Return false to prevent submission

---

### SN-SIMPLE-003: Script Include Utility
**Task**: Create IncidentUtils with getOpenIncidentCount(userId) function
**Key Checks**:
- Class definition
- GlideRecord query on incident table
- Filters: assigned_to = userId AND state < 6
- Returns count
- JSDoc comments

---

### SN-MEDIUM-001: REST API Endpoint
**Task**: Create POST /incident API with validation and error handling
**Key Checks**:
- JSON parsing
- Required field validation
- GlideRecord insert
- HTTP status codes (201, 400, 500)
- JSON response with sys_id and number
- Error logging

---

### SN-MEDIUM-002: Service Portal Widget
**Task**: Display user's open incidents in responsive table with color-coded priority
**Key Checks**:
- Server script queries user's incidents
- Client controller handles data
- HTML template with Bootstrap table
- CSS for priority colors
- Row click navigation
- Empty state message
- Mobile responsive

---

### SN-MEDIUM-003: Flow with Approvals
**Task**: Build incident escalation flow with approval and notifications
**Key Checks**:
- Trigger on priority change to Critical
- Lookup assignment group manager
- Create approval
- Branch on approval/rejection
- Add work notes
- Send email notifications
- Error handling
- Documentation

---

### SN-MEDIUM-004: Import Set + Transform Map
**Task**: Import external users via CSV with validation and lookups
**Key Checks**:
- Import Set table defined
- Transform map with field mappings
- Coalesce on email
- Department and manager lookups
- onBefore email validation
- onAfter welcome email
- Sample CSV with test data

---

### SN-COMPLEX-001: Smart Incident Assignment System
**Task**: Complete system with ML-like assignment, API, UI, jobs, ACLs, tests
**Components**:
1. SmartAssignmentEngine script include
2. Auto Assign business rule
3. Assignment Override REST API
4. Assignment Feedback client script
5. Performance Report scheduled job
6. ACLs for security
7. ATF tests for all components
8. Complete documentation

**Key Checks**: All 11 artifacts, integrated functionality, security, performance, tests

---

### SN-COMPLEX-002: Team Dashboard Portal Application
**Task**: Complete portal with 3 pages, 7+ widgets, REST API backend
**Components**:
1. Dashboard page (metrics, activity, quick actions, calendar)
2. Incident Management page (list, detail, creation)
3. Analytics page (charts, trends, performance)
4. REST API backend (4 endpoints)
5. Script includes (utilities, calculators, analytics)
6. Scheduled jobs (caching, snapshots)
7. Features: real-time updates, responsive, theme toggle, export

**Key Checks**: All 25+ artifacts, integrated system, responsive design, performance < 2s

---

### SN-COMPLEX-003: IntegrationHub Slack Spoke
**Task**: Complete spoke with 8 flow actions, 3 subflows, full documentation
**Components**:
1. OAuth 2.0 connection
2. 8 flow actions (message, channel, file, search, etc.)
3. 3 subflows (incident notify, user sync, war room)
4. Error handling with retry logic
5. Integration tests with mocks
6. 4 documentation guides

**Key Checks**: All 22+ artifacts, proper OAuth, all actions functional, comprehensive docs

---

## Common Validation Points

### Code Quality
✓ No syntax errors
✓ Proper indentation
✓ Meaningful variable names
✓ Comments explain complex logic
✓ JSDoc for functions

### ServiceNow Best Practices
✓ Uses GlideRecord correctly
✓ Proper query filters
✓ Error handling with try-catch
✓ Logging with gs.log()
✓ Security considerations (ACLs, input validation)
✓ Performance (indexed fields, query limits)

### Error Handling
✓ Try-catch blocks
✓ Meaningful error messages
✓ Proper status codes (APIs)
✓ Logging on errors
✓ Graceful degradation

### Documentation
✓ README or documentation file
✓ Inline code comments
✓ Function/API documentation
✓ Usage examples
✓ Setup instructions (if needed)

---

## Time Benchmarks

### Expected Completion Times

| Complexity | Min | Max | Average |
|------------|-----|-----|---------|
| Simple | 2 min | 4 min | 3 min |
| Medium | 5 min | 12 min | 8 min |
| Complex | 20 min | 45 min | 32 min |

**Total Suite**: ~2-3 hours for all 10 tests

### Time Quality Indicators

**Fast** (< expected min):
- May indicate missing features
- Check thoroughly against criteria

**On Target** (within range):
- Good indicator of proper completion
- Still verify all criteria

**Slow** (> expected max):
- May indicate struggles or complexity
- Check if extra features added
- Verify quality is high

---

## Next Steps After Testing

### 1. Collect Results
Record for each test:
- Pass/Fail status
- Points awarded
- Time taken
- Issues encountered
- Quality observations

### 2. Calculate Score
```
Total Score = Sum of all points awarded
Percentage = (Total Score / 485) × 100%
```

### 3. Analyze Patterns
Look for:
- Which complexity levels work best
- Which ServiceNow domains are strong/weak
- Common failure patterns
- Agent routing effectiveness

### 4. Report Findings
Document:
- Overall score and competency level
- Strengths and weaknesses
- Specific test failures and reasons
- Recommendations for improvement

### 5. Iterate
- Fix issues identified
- Rerun failed tests
- Improve agent prompts if needed
- Update toolset as needed

---

## Files Created

```
test/servicenow-capability-tests.js           # Main test runner
test/SERVICENOW_TESTS_README.md               # Full documentation
test/SERVICENOW_TESTS_QUICK_REFERENCE.md      # This file
```

---

## Support

**View Full Documentation**:
```bash
cat test/SERVICENOW_TESTS_README.md
```

**Run Tests**:
```bash
node test/servicenow-capability-tests.js
```

**Questions**: See main README or file an issue

---

**Status**: ✅ Ready for manual execution
**Automated Testing**: 🚧 Coming Q1 2025
