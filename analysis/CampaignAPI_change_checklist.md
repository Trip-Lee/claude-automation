# CampaignAPI estimated_budget Change - Executive Checklist

**Project:** Add estimated_budget Property to Campaign API
**Status:** Ready for Implementation
**Total Estimated Effort:** 28-41 hours (3-4 weeks)
**Team Size:** 2-3 developers
**Risk Level:** 🟢 LOW

---

## Quick Reference

| Phase | Duration | Dependencies | Owner |
|-------|----------|--------------|-------|
| Phase 1: Database | 1 day | None | DBA/DevOps |
| Phase 2: Validation | 2-3 days | Phase 1 | Backend Dev |
| Phase 3: API & Scripts | 2-3 days | Phase 1 | Backend Dev |
| Phase 4: Testing | 3-4 days | Phase 2-3 | QA/Testing |
| Phase 5: Documentation | 1-2 days | All previous | Tech Writer |
| Phase 6: Deployment | 1 day | All previous | DevOps |

---

## Phase 1: Database & Schema Setup

### 1.1 Create Database Field

- [ ] Log into ServiceNow instance (Dev environment)
- [ ] Navigate to: System Definition → Tables → Campaign (x_cadso_work_campaign)
- [ ] Click on the table to open Table Designer
- [ ] Add new field:
  - [ ] Field name: `u_estimated_budget`
  - [ ] Type: `Currency`
  - [ ] Label: `Estimated Budget`
  - [ ] Required: `No` (unchecked)
  - [ ] Searchable: `Yes` (checked)
  - [ ] Auditable: `Yes` (checked)
  - [ ] Comments: "Estimated budget for campaign planning"
- [ ] Save the field
- [ ] Verify field appears in campaign form

**Acceptance Criteria:**
- ✅ Field visible in Form Designer
- ✅ Field accessible via API
- ✅ Field shows in campaign list view (optional)
- ✅ No errors in system logs

**Owner:** DBA/DevOps
**Time:** 30 minutes

---

### 1.2 Create Database Index

- [ ] Navigate to: System Definition → Database → Table Indexes
- [ ] Create index on `x_cadso_work_campaign.u_estimated_budget`
- [ ] Test query performance

**Acceptance Criteria:**
- ✅ Index created successfully
- ✅ Query performance acceptable
- ✅ No duplicate index warnings

**Owner:** DBA
**Time:** 30 minutes

---

### 1.3 Data Migration (if needed)

**Option: Copy existing budget to estimated_budget**

- [ ] Write migration script (see script below)
- [ ] Test on dev environment:
  - [ ] Test on empty database
  - [ ] Test on database with existing campaigns
  - [ ] Verify data integrity
  - [ ] Check for NULL values
- [ ] Document rollback procedure
- [ ] Run on staging environment (optional)

```javascript
// Background script to populate estimated_budget
var updateCount = 0;
var gr = new GlideRecord('x_cadso_work_campaign');
gr.query();

while (gr.next()) {
    if (gr.getValue('budget') && !gr.getValue('u_estimated_budget')) {
        gr.setValue('u_estimated_budget', gr.getValue('budget'));
        gr.update();
        updateCount++;
    }
}

gs.log('CampaignAPI Migration: Updated ' + updateCount + ' campaigns', 'BudgetMigration');
```

**Acceptance Criteria:**
- ✅ All campaigns with budget have estimated_budget populated
- ✅ No data loss or corruption
- ✅ Migration is reversible
- ✅ No NULL value issues

**Owner:** DBA
**Time:** 2-3 hours (or skip if using NULL default)

---

### 1.4 Schema Documentation

- [ ] Document field in schema documentation
- [ ] Update data model diagram
- [ ] Add to table reference guide
- [ ] Create field description document

**Acceptance Criteria:**
- ✅ Field documented with purpose
- ✅ Data type and constraints documented
- ✅ Example usage provided
- ✅ Relationships documented

**Owner:** Tech Writer
**Time:** 1 hour

---

## Phase 2: Validation & Business Rules

### 2.1 Update WorkItemValidator.js

- [ ] Open `/script-includes/WorkItemValidator.js`
- [ ] Add budget validation method:
  - [ ] Create `_validateBudgets()` method
  - [ ] Add negative number check
  - [ ] Add type validation
  - [ ] Add variance warning (20%+ check)
  - [ ] Return validation result object

```javascript
_validateBudgets: function(gr) {
    var result = {
        valid: true,
        errors: [],
        warnings: []
    };

    var budget = gr.getValue('budget');
    var estimatedBudget = gr.getValue('u_estimated_budget');

    // Validate budget
    if (budget) {
        var budgetNum = parseFloat(budget);
        if (isNaN(budgetNum)) {
            result.valid = false;
            result.errors.push('Budget must be a valid number');
        } else if (budgetNum < 0) {
            result.valid = false;
            result.errors.push('Budget cannot be negative');
        }
    }

    // Validate estimated_budget
    if (estimatedBudget) {
        var estimatedNum = parseFloat(estimatedBudget);
        if (isNaN(estimatedNum)) {
            result.valid = false;
            result.errors.push('Estimated budget must be a valid number');
        } else if (estimatedNum < 0) {
            result.valid = false;
            result.errors.push('Estimated budget cannot be negative');
        }

        // Variance warning
        if (budget && estimatedNum > parseFloat(budget) * 1.2) {
            var variance = Math.round(((estimatedNum - parseFloat(budget)) / parseFloat(budget)) * 100);
            result.warnings.push('Estimated budget exceeds actual budget by ' + variance + '%');
        }
    }

    return result;
}
```

- [ ] Update `validateCampaign()` method:
  - [ ] Call `_validateBudgets()` instead of inline budget check
  - [ ] Process returned errors and warnings
  - [ ] Maintain existing behavior for budget field

- [ ] Update `_extractRecordData()` method:
  - [ ] Add `estimated_budget: gr.getValue('u_estimated_budget')`

- [ ] Update JSDoc comments:
  - [ ] Document new field in @param
  - [ ] Document validation rules
  - [ ] Add @example showing estimated_budget

- [ ] Test changes:
  - [ ] Run unit tests (see test cases)
  - [ ] Test validation with positive numbers
  - [ ] Test validation with negative numbers
  - [ ] Test validation with non-numeric values
  - [ ] Test variance warnings

**Acceptance Criteria:**
- ✅ _validateBudgets() method works correctly
- ✅ All validation tests pass
- ✅ Warnings generated for 20%+ variance
- ✅ validateCampaign() includes new field
- ✅ JSDoc comments updated
- ✅ No breaking changes

**Owner:** Backend Developer
**Time:** 2-3 hours

---

### 2.2 Update Business Rule: validate_before_campaign_insert

- [ ] Open `/business-rules/validate_before_campaign_insert.js`
- [ ] Add estimated_budget validation block after budget validation:

```javascript
// Validate estimated_budget
var estimatedBudget = current.getValue('u_estimated_budget');
if (estimatedBudget) {
    var estimatedNum = parseFloat(estimatedBudget);
    if (isNaN(estimatedNum)) {
        validationResult.valid = false;
        validationResult.errors.push('Estimated budget must be a valid number');
    } else if (estimatedNum < 0) {
        validationResult.valid = false;
        validationResult.errors.push('Estimated budget cannot be negative');
    }

    // Variance check
    var budget = current.getValue('budget');
    if (budget) {
        var actualBudget = parseFloat(budget);
        if (estimatedNum > actualBudget * 1.2) {
            var variance = Math.round(((estimatedNum - actualBudget) / actualBudget) * 100);
            validationResult.warnings.push(
                'Estimated budget exceeds actual budget by ' + variance + '%'
            );
        }
    }
}
```

- [ ] Test business rule:
  - [ ] Insert campaign with valid estimated_budget
  - [ ] Insert campaign with negative estimated_budget (should abort)
  - [ ] Insert campaign with non-numeric estimated_budget (should abort)
  - [ ] Verify error messages in campaign form
  - [ ] Verify warnings displayed (not errors)

**Acceptance Criteria:**
- ✅ Validation runs on insert
- ✅ Invalid values rejected
- ✅ Warnings displayed correctly
- ✅ Error messages clear and helpful
- ✅ Campaigns still create without estimated_budget

**Owner:** Backend Developer
**Time:** 1-2 hours

---

### 2.3 Create Optional Roll Up Rule

- [ ] Create new business rule: `roll_up_estimated_budget.js`
- [ ] Table: `x_cadso_work_campaign`
- [ ] When: After
- [ ] Insert: Yes, Update: Yes
- [ ] Order: 150

```javascript
/**
 * Business Rule: Roll Up Estimated Budget to Campaign
 * Aggregates estimated budget from child projects
 */
(function executeRule(current, previous) {
    var LOG_SOURCE = '[BR: Roll Up Estimated Budget]';

    try {
        var campaignId = current.getValue('sys_id');

        // Skip if no change in estimated_budget
        if (!current.isNewRecord() &&
            current.getValue('u_estimated_budget') === previous.getValue('u_estimated_budget')) {
            return;
        }

        // Calculate total from projects
        var projectGr = new GlideRecord('x_cadso_work_project');
        projectGr.addQuery('campaign', campaignId);
        projectGr.query();

        var totalEstimate = 0;
        while (projectGr.next()) {
            var projectEstimate = projectGr.getValue('u_estimated_budget');
            if (projectEstimate) {
                totalEstimate += parseFloat(projectEstimate);
            }
        }

        // Update if no explicit estimate exists
        if (!current.getValue('u_estimated_budget') && totalEstimate > 0) {
            current.setValue('u_estimated_budget', totalEstimate);
            gs.info(LOG_SOURCE + ' Rolled up estimate: ' + totalEstimate);
        }

    } catch (ex) {
        gs.warn(LOG_SOURCE + ' Exception: ' + ex.message);
    }

})(current, previous);
```

- [ ] Test rollup rule:
  - [ ] Create campaign with projects
  - [ ] Update project estimated_budget
  - [ ] Verify campaign estimate updates
  - [ ] Test with multiple projects

**Note:** This is OPTIONAL - can be deployed in next release

**Acceptance Criteria:**
- ✅ Rule fires on campaign update
- ✅ Rollup calculation correct
- ✅ Logging works
- ✅ No performance impact

**Owner:** Backend Developer
**Time:** 1-2 hours (optional)

---

## Phase 3: API & Script Includes

### 3.1 Update WorkItemManager.js

- [ ] Open `/script-includes/WorkItemManager.js`
- [ ] Update `createCampaign()` JSDoc:
  ```javascript
  * @param {number} data.estimated_budget - Estimated budget (optional)
  ```
- [ ] Update `updateCampaign()` JSDoc:
  ```javascript
  * @param {number} data.estimated_budget - Update estimated budget (optional)
  ```
- [ ] Verify `_setRecordFields()` handles estimated_budget (should auto-work):
  - [ ] Test setting field value
  - [ ] Test NULL values
  - [ ] Test numeric conversions

- [ ] Add response serialization (if applicable):
  ```javascript
  _serializeCampaignResponse: function(gr) {
      return {
          sys_id: gr.getValue('sys_id'),
          name: gr.getValue('name'),
          // ... other fields ...
          estimated_budget: gr.getValue('u_estimated_budget'),
          // ...
      };
  }
  ```

- [ ] Test changes:
  - [ ] Create campaign with estimated_budget
  - [ ] Create campaign without estimated_budget
  - [ ] Update campaign estimated_budget
  - [ ] Retrieve campaign and verify field present

**Acceptance Criteria:**
- ✅ createCampaign() accepts estimated_budget
- ✅ updateCampaign() accepts estimated_budget
- ✅ Response includes estimated_budget
- ✅ JSDoc comments accurate
- ✅ No breaking changes

**Owner:** Backend Developer
**Time:** 1-2 hours

---

### 3.2 Update API Documentation

- [ ] Update Swagger/OpenAPI specification:
  - [ ] Add to Campaign schema
  - [ ] Mark as optional
  - [ ] Type: number (currency)
  - [ ] Example: 50000.50

- [ ] Update API endpoint documentation:
  - [ ] POST /campaign - Add estimated_budget to request body example
  - [ ] GET /campaign/{sys_id} - Add estimated_budget to response example
  - [ ] PUT /campaign/{sys_id} - Add estimated_budget to request example

- [ ] Update API reference guide:
  - [ ] Document field purpose
  - [ ] Document constraints
  - [ ] Document examples
  - [ ] Note backward compatibility

- [ ] Update integration guide:
  - [ ] Add usage examples
  - [ ] Document variance warnings
  - [ ] Provide sample requests/responses

**Acceptance Criteria:**
- ✅ OpenAPI spec updated
- ✅ Examples accurate
- ✅ Backward compatibility noted
- ✅ Field constraints documented
- ✅ Integration guide clear

**Owner:** Tech Writer
**Time:** 1-2 hours

---

### 3.3 API Integration Testing Setup

- [ ] Prepare test environment:
  - [ ] REST client ready (Postman/Insomnia)
  - [ ] Test database populated
  - [ ] API endpoint accessible
  - [ ] Logging configured

- [ ] Create test collection:
  - [ ] POST /campaign with estimated_budget
  - [ ] POST /campaign without estimated_budget
  - [ ] GET /campaign/{id}
  - [ ] PUT /campaign/{id}
  - [ ] Error cases

**Acceptance Criteria:**
- ✅ Test environment ready
- ✅ All endpoints accessible
- ✅ Test cases prepared
- ✅ Expected responses documented

**Owner:** QA/Testing
**Time:** 1 hour

---

## Phase 4: Testing

### 4.1 Unit Tests

- [ ] Create test file: `/test/campaign-budget-tests.js`
- [ ] Test validation logic:
  - [ ] ✅ Valid positive number
  - [ ] ✅ Valid zero
  - [ ] ✅ Valid decimal (50000.50)
  - [ ] ✅ NULL/undefined (should accept)
  - [ ] ❌ Negative number (should reject)
  - [ ] ❌ Non-numeric string (should reject)
  - [ ] ❌ NaN value (should reject)

- [ ] Test variance warnings:
  - [ ] ✅ estimated < actual (no warning)
  - [ ] ✅ estimated = actual (no warning)
  - [ ] ✅ estimated 20% over actual (no warning at exactly 20%)
  - [ ] ✅ estimated 21% over actual (should warn)
  - [ ] ❌ estimated 100% over actual (should warn)

- [ ] Test validation method:
  - [ ] ✅ _validateBudgets() returns correct structure
  - [ ] ✅ Error messages are descriptive
  - [ ] ✅ Warning messages are clear

- [ ] Run tests:
  ```bash
  npm run test:unit -- test/campaign-budget-tests.js
  ```

**Acceptance Criteria:**
- ✅ All tests pass
- ✅ 100% code coverage for validation logic
- ✅ Error messages clear
- ✅ Edge cases covered

**Owner:** QA/Testing
**Time:** 2-3 hours

---

### 4.2 Integration Tests

- [ ] Test campaign creation flow:
  - [ ] ✅ POST /campaign with estimated_budget
  - [ ] ✅ POST /campaign without estimated_budget
  - [ ] ✅ Response includes field in both cases
  - [ ] ✅ Validation errors prevent creation

- [ ] Test campaign update flow:
  - [ ] ✅ PUT /campaign/{id} with estimated_budget
  - [ ] ✅ Update partial fields
  - [ ] ✅ Clear estimated_budget (set to NULL)

- [ ] Test backward compatibility:
  - [ ] ✅ Old API client (no estimated_budget) still works
  - [ ] ✅ Response parsing doesn't break
  - [ ] ✅ Existing campaigns unaffected

- [ ] Test business rule integration:
  - [ ] ✅ Rule fires on insert
  - [ ] ✅ Rule validates field
  - [ ] ✅ Error prevents insert
  - [ ] ✅ Warnings display correctly

- [ ] Run tests:
  ```bash
  npm run test:integration
  ```

**Acceptance Criteria:**
- ✅ All integration tests pass
- ✅ Backward compatibility verified
- ✅ Business rule integration confirmed
- ✅ No performance degradation

**Owner:** QA/Testing
**Time:** 2-3 hours

---

### 4.3 API Tests

- [ ] Test POST /campaign:
  - [ ] With estimated_budget → 201 Created
  - [ ] Without estimated_budget → 201 Created
  - [ ] With invalid estimated_budget → 400 Bad Request
  - [ ] With missing required fields → 400 Bad Request
  - [ ] Response includes estimated_budget field

- [ ] Test GET /campaign/{id}:
  - [ ] Valid ID → 200 OK with data
  - [ ] Response includes estimated_budget
  - [ ] Invalid ID → 404 Not Found

- [ ] Test PUT /campaign/{id}:
  - [ ] Update estimated_budget → 200 OK
  - [ ] Response shows updated value
  - [ ] Invalid value → 400 Bad Request

- [ ] Test error responses:
  - [ ] Validation error → clear message
  - [ ] Type error → clear message
  - [ ] Constraint violation → clear message

**Acceptance Criteria:**
- ✅ All HTTP status codes correct
- ✅ Response bodies match documentation
- ✅ Error messages helpful
- ✅ Field included in all responses

**Owner:** QA/Testing
**Time:** 1-2 hours

---

### 4.4 Performance Tests

- [ ] Measure campaign creation time:
  - [ ] Without estimated_budget < 100ms
  - [ ] With estimated_budget < 100ms
  - [ ] Difference < 5ms

- [ ] Measure bulk operations:
  - [ ] Create 100 campaigns < 10s
  - [ ] Update 100 campaigns < 10s
  - [ ] Query 1000 campaigns < 5s

- [ ] Monitor resource usage:
  - [ ] CPU usage normal
  - [ ] Memory usage stable
  - [ ] Database query performance acceptable

```bash
# Run performance tests
npm run test:performance
```

**Acceptance Criteria:**
- ✅ No performance degradation
- ✅ Bulk operations < acceptable time
- ✅ Query performance acceptable
- ✅ Resource usage normal

**Owner:** QA/Testing
**Time:** 1 hour

---

### 4.5 Test Summary Report

- [ ] Generate test report:
  - [ ] Total tests: [count]
  - [ ] Passed: [count]
  - [ ] Failed: [count]
  - [ ] Coverage: [%]
  - [ ] Performance: [metrics]

- [ ] Review test results:
  - [ ] All tests passing ✅
  - [ ] Coverage > 80% ✅
  - [ ] Performance acceptable ✅
  - [ ] No regressions ✅

**Acceptance Criteria:**
- ✅ All tests passing
- ✅ No outstanding issues
- ✅ Ready for deployment

**Owner:** QA Lead
**Time:** 1 hour

---

## Phase 5: Documentation

### 5.1 Release Notes

```markdown
# Version X.X.X - Release Notes

## New Features

### Campaign API: Estimated Budget Support

Added support for estimated_budget property to the Campaign API.

**What's New:**
- New optional `estimated_budget` field in campaign records
- Automatic variance detection when estimated > actual budget
- Updated validation rules
- Full backward compatibility maintained

**For Developers:**
- POST /campaign now accepts `estimated_budget`
- GET /campaign returns `estimated_budget` field
- PUT /campaign/{id} can update `estimated_budget`

**API Examples:**

Create campaign with estimated budget:
```javascript
POST /api/campaign
{
  "name": "Q1 Campaign",
  "budget": 50000,
  "estimated_budget": 45000
}
```

Response:
```javascript
{
  "success": true,
  "sysId": "abc123",
  "data": {
    "name": "Q1 Campaign",
    "budget": 50000,
    "estimated_budget": 45000
  }
}
```

**Breaking Changes:** None
**Backward Compatible:** Yes
**Migration Required:** No (optional field)

## Known Issues

None known at this time.

## Support

For issues or questions:
- Documentation: [link]
- Bug reports: [link]
- Support: [email]
```

**Acceptance Criteria:**
- ✅ Release notes complete
- ✅ Examples accurate
- ✅ No breaking changes listed
- ✅ Links verified

**Owner:** Tech Writer
**Time:** 1 hour

---

### 5.2 API Documentation

- [ ] Update API Reference:
  - [ ] POST /campaign endpoint
  - [ ] GET /campaign/{id} endpoint
  - [ ] PUT /campaign/{id} endpoint
  - [ ] Include estimated_budget in examples

- [ ] Update integration guide:
  - [ ] Add estimated_budget to request payload
  - [ ] Document response includes field
  - [ ] Note variance warnings
  - [ ] Provide code samples

- [ ] Update field reference:
  - [ ] Field name: estimated_budget
  - [ ] Type: Currency
  - [ ] Required: No
  - [ ] Description: Estimated budget for campaign planning

**Acceptance Criteria:**
- ✅ API docs updated
- ✅ Examples accurate
- ✅ Field constraints documented
- ✅ Integration guide clear

**Owner:** Tech Writer
**Time:** 1-2 hours

---

### 5.3 User Documentation

- [ ] Update campaign form documentation:
  - [ ] Field location
  - [ ] Field purpose
  - [ ] Input constraints
  - [ ] Example values

- [ ] Create field comparison guide:
  ```
  Budget vs Estimated Budget:

  Budget: Actual allocated/approved budget for campaign
  Estimated Budget: Budget estimate for planning/forecasting

  Both fields are optional and independent.
  ```

- [ ] Update FAQ:
  - [ ] What is estimated_budget?
  - [ ] How is it different from budget?
  - [ ] Is it required?
  - [ ] Can I use it for reporting?

**Acceptance Criteria:**
- ✅ User documentation updated
- ✅ Clear examples provided
- ✅ FAQ addresses common questions
- ✅ No conflicting information

**Owner:** Tech Writer
**Time:** 1-2 hours

---

### 5.4 Developer Documentation

- [ ] Update Script Include docs:
  - [ ] WorkItemManager.createCampaign()
  - [ ] WorkItemValidator._validateBudgets()
  - [ ] Field mapping documentation

- [ ] Create implementation guide:
  - [ ] Step-by-step integration
  - [ ] Code samples
  - [ ] Common patterns
  - [ ] Best practices

- [ ] Update architecture documentation:
  - [ ] Field location in schema
  - [ ] Validation flow diagram
  - [ ] API response structure

**Acceptance Criteria:**
- ✅ Developer docs complete
- ✅ Code samples accurate
- ✅ Architecture clear
- ✅ Best practices documented

**Owner:** Tech Writer
**Time:** 1-2 hours

---

## Phase 6: Deployment

### 6.1 Pre-Deployment Checklist

- [ ] Code review completed ✅
- [ ] All tests passing ✅
- [ ] Documentation complete ✅
- [ ] Release notes ready ✅
- [ ] Rollback procedure documented ✅
- [ ] Monitoring configured ✅
- [ ] Stakeholders notified ✅
- [ ] Deployment window scheduled ✅

**Sign-off Required:** Technical Lead, DevOps Lead

**Owner:** Deployment Manager
**Time:** 1 hour

---

### 6.2 Deployment Execution

#### Step 1: Database Changes (5-10 min)

- [ ] Connect to production database
- [ ] Execute field creation:
  ```sql
  -- Field should already exist from Table Designer
  -- Verify it's present
  SELECT * FROM sys_dictionary
  WHERE name = 'x_cadso_work_campaign.u_estimated_budget';
  ```
- [ ] Verify field accessible via API
- [ ] Check for errors in logs

#### Step 2: Code Deployment (5-10 min)

- [ ] Deploy WorkItemValidator.js:
  - [ ] Replace file in script-includes
  - [ ] Clear script cache
  - [ ] Test endpoint responds

- [ ] Deploy WorkItemManager.js:
  - [ ] Replace file in script-includes
  - [ ] Clear script cache
  - [ ] Test endpoint responds

- [ ] Deploy business rule:
  - [ ] Update validate_before_campaign_insert
  - [ ] Activate business rule
  - [ ] Verify in system logs

#### Step 3: Verification (5-10 min)

- [ ] Test POST /campaign with estimated_budget
  ```bash
  curl -X POST /api/campaign \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Test Campaign",
      "estimated_budget": 50000
    }'
  ```

- [ ] Test GET /campaign/{id}
  ```bash
  curl /api/campaign/abc123
  ```

- [ ] Verify estimated_budget in response

- [ ] Test validation:
  ```bash
  # Should fail with negative value
  curl -X POST /api/campaign \
    -d '{
      "name": "Test",
      "estimated_budget": -1000
    }'
  ```

- [ ] Check error logs for exceptions
  - [ ] ServiceNow system log
  - [ ] Application error log
  - [ ] Database error log

**Acceptance Criteria:**
- ✅ Field created successfully
- ✅ API accepting estimated_budget
- ✅ Validation working
- ✅ No errors in logs

**Owner:** DevOps Engineer
**Time:** 20-30 minutes

---

### 6.3 Post-Deployment

- [ ] Monitor error logs (2 hours minimum):
  - [ ] Check for validation errors
  - [ ] Watch for exceptions
  - [ ] Monitor API response times

- [ ] Verify user experience:
  - [ ] Test in UI (campaign form)
  - [ ] Verify field visible
  - [ ] Test create/update workflow

- [ ] Collect initial feedback:
  - [ ] Check support tickets
  - [ ] Monitor usage analytics
  - [ ] Solicit user feedback

- [ ] Document deployment:
  - [ ] Deployment timestamp
  - [ ] Changes deployed
  - [ ] No issues encountered
  - [ ] Rollback not needed

- [ ] Update status:
  - [ ] Notify stakeholders of success
  - [ ] Update deployment log
  - [ ] Close deployment ticket

**Owner:** DevOps Engineer & QA Lead
**Time:** 1-2 hours

---

## Risk Checklist

### Identify & Mitigate Risks

- [ ] **Data Type Mismatch**
  - ✅ Mitigation: Validate numeric input, test with multiple formats
  - ✅ Monitoring: Watch for parsing errors in logs

- [ ] **Backward Compatibility Break**
  - ✅ Mitigation: Keep field optional in API
  - ✅ Testing: Run backward compatibility tests

- [ ] **Business Rule Failure**
  - ✅ Mitigation: Test rule firing before deploy
  - ✅ Monitoring: Check business rule logs

- [ ] **Performance Degradation**
  - ✅ Mitigation: Load test before deploy
  - ✅ Monitoring: Monitor query performance metrics

- [ ] **Validation Logic Error**
  - ✅ Mitigation: Unit test all validation paths
  - ✅ Monitoring: Watch for unexpected errors

- [ ] **API Response Format Change**
  - ✅ Mitigation: Keep new field optional in responses
  - ✅ Testing: Test response parsing

---

## Success Metrics

### Technical Success

- ✅ All unit tests passing (100%)
- ✅ All integration tests passing (100%)
- ✅ No critical errors in logs post-deployment
- ✅ API response time < 200ms
- ✅ Validation success rate > 99%

### Business Success

- ✅ Customers adopting new field
- ✅ No support escalations related to feature
- ✅ Data accuracy validated
- ✅ Performance acceptable

### Deployment Success

- ✅ Deployment completed without rollback
- ✅ Zero downtime deployment
- ✅ All systems operational post-deployment
- ✅ Stakeholders satisfied

---

## Sign-Off

| Role | Name | Date | Sign-Off |
|------|------|------|----------|
| Technical Lead | [Name] | [Date] | ☐ |
| QA Lead | [Name] | [Date] | ☐ |
| DevOps Lead | [Name] | [Date] | ☐ |
| Product Manager | [Name] | [Date] | ☐ |

---

**Deployment Completed:** [Date/Time]
**Total Time:** [Hours]
**Issues Encountered:** [None / List]
**Rollback Required:** [Yes / No]

---

**END OF CHECKLIST**
