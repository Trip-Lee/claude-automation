# CampaignAPI: estimated_budget Implementation Checklist

**Status:** Ready for Implementation
**Last Updated:** November 14, 2025
**Version:** 1.0

---

## 📋 MASTER CHECKLIST

### ⚪ PRE-IMPLEMENTATION PHASE (Day -1)

#### Team Preparation
- [ ] Schedule kickoff meeting with entire team
- [ ] Distribute analysis documents to team
- [ ] Review implementation timeline with team
- [ ] Assign task ownership
- [ ] Verify dev/test environment access for all
- [ ] Create shared Slack/Teams channel for coordination

#### Environment Verification
- [ ] Verify DEV environment database connectivity
- [ ] Verify TEST environment database connectivity
- [ ] Verify PROD database backup strategy
- [ ] Test backup restoration procedure
- [ ] Verify CI/CD pipeline working
- [ ] Verify deployment credentials valid

#### Documentation Preparation
- [ ] Create release notes template
- [ ] Create deployment runbook
- [ ] Create rollback runbook
- [ ] Set up status page update schedule
- [ ] Create customer communication template
- [ ] Prepare FAQ document

#### Stakeholder Communication
- [ ] Notify product managers
- [ ] Brief support team on change
- [ ] Schedule customer notification (if needed)
- [ ] Set up monitoring alerts
- [ ] Document escalation contacts
- [ ] Create incident response plan

---

## 🗄️ PHASE 1: DATABASE & SCHEMA (Days 1-2, 4-6 hours)

### Database Schema Changes

#### 1.1 Create Database Field ✅
- [ ] Access ServiceNow Table Designer
- [ ] Navigate to `x_cadso_work_campaign` table
- [ ] Create new field with these specifications:
  - [ ] **Field Name:** `u_estimated_budget`
  - [ ] **Display Name:** `Estimated Budget`
  - [ ] **Type:** `Currency` (or `Decimal`)
  - [ ] **Required:** `No`
  - [ ] **Searchable:** `Yes`
  - [ ] **Auditable:** `Yes`
  - [ ] **Read-Only:** `No`
  - [ ] **Max Length:** Auto (currency fields auto-length)
  - [ ] **Comments:** "Estimated budget for campaign, may differ from actual budget"
- [ ] Verify field appears in database
- [ ] Document field ID/sys_id for reference

**Time Estimate:** 30 minutes
**Dependencies:** None
**Risk:** Very Low

---

#### 1.2 Verify Dictionary Entry ✅
- [ ] Query `sys_dictionary` for `x_cadso_work_campaign.u_estimated_budget`
- [ ] Verify entry created successfully
- [ ] Confirm field type is `currency`
- [ ] Verify auditable flag is set
- [ ] Test API access to field
  - [ ] `GET` should return null for existing records
  - [ ] `POST` should accept the field
  - [ ] `PUT` should accept the field
- [ ] Document API field reference

**Time Estimate:** 30 minutes
**Dependencies:** Step 1.1
**Risk:** Very Low

---

#### 1.3 Create Optional Index ⚠️ (Optional but Recommended)
- [ ] Create index on `u_estimated_budget` column
  - [ ] Index name: `idx_estimated_budget`
  - [ ] Column: `u_estimated_budget`
  - [ ] Unique: `No`
- [ ] Verify index created successfully
- [ ] Test query performance before/after:
  ```sql
  SELECT * FROM x_cadso_work_campaign
  WHERE u_estimated_budget > 50000
  ORDER BY u_estimated_budget DESC
  ```
- [ ] Document baseline performance metrics

**Time Estimate:** 30 minutes
**Dependencies:** Step 1.1
**Risk:** Very Low
**Priority:** Medium (optimization, not critical)

---

#### 1.4 Data Migration Strategy ⚙️
Choose ONE strategy and implement:

**Option A: Null Default (Recommended for Safety)**
- [ ] Leave all existing records with `u_estimated_budget = NULL`
- [ ] New campaigns will populate on creation
- [ ] Existing campaigns update on next edit
- [ ] Minimal risk, zero data loss
- [ ] Document strategy in release notes

**Option B: Copy from Existing Budget (Safe Default)**
- [ ] Create migration script:
  ```javascript
  var gr = new GlideRecord('x_cadso_work_campaign');
  gr.query();
  var count = 0;
  while (gr.next()) {
      if (gr.getValue('budget') && !gr.getValue('u_estimated_budget')) {
          gr.setValue('u_estimated_budget', gr.getValue('budget'));
          gr.update();
          count++;
      }
  }
  gs.log('Migrated ' + count + ' records', 'EstimatedBudgetMigration');
  ```
- [ ] Test script on DEV with sample data
- [ ] Verify data integrity post-migration
- [ ] Run on TEST environment
- [ ] Document row count affected
- [ ] Have backup ready before PROD run

**Option C: Calculate from Projects (Advanced)**
- [ ] Create aggregation script
- [ ] Test with sample project hierarchies
- [ ] Document calculation logic
- [ ] Verify accuracy of results
- [ ] Only recommended if projects table is well-populated

---

**Selected Strategy:** [ ] Option A / [ ] Option B / [ ] Option C

- [ ] Migration script created and tested
- [ ] Backup taken before migration
- [ ] Migration executed on TEST
- [ ] Data verification passed
- [ ] Migration readiness confirmed for PROD
- [ ] Rollback plan documented and tested

**Time Estimate:** 2-3 hours
**Dependencies:** Step 1.1 & 1.2
**Risk:** Low (if testing done properly)

---

### Schema Verification

#### 1.5 Form Integration Verification ✅
- [ ] Open campaign form in ServiceNow UI
- [ ] Verify `estimated_budget` field appears on form
- [ ] Verify field is accessible (not hidden)
- [ ] Verify field accepts numeric input
- [ ] Test entering values:
  - [ ] Valid: `50000`, `50000.50`, `0`
  - [ ] Invalid: `-100`, `abc`, (should show error or validation)
  - [ ] Empty: Leave blank (should be OK)
- [ ] Verify field label displays correctly
- [ ] Test form save/load cycle
- [ ] Document any UI issues

**Time Estimate:** 30 minutes
**Dependencies:** Step 1.1
**Risk:** Very Low

---

#### 1.6 API Accessibility Verification ✅
- [ ] Test API GET on campaign record:
  ```bash
  GET /api/now/table/x_cadso_work_campaign/[sys_id]?sysparm_fields=sys_id,name,budget,u_estimated_budget
  ```
- [ ] Verify response includes `u_estimated_budget` field
- [ ] Verify value is null or populated (depending on migration strategy)
- [ ] Test POST request with `estimated_budget`:
  ```json
  POST /api/now/table/x_cadso_work_campaign
  {
    "name": "Test Campaign",
    "short_description": "Test",
    "start_date": "2025-12-01",
    "end_date": "2025-12-31",
    "state": "draft",
    "u_estimated_budget": "50000"
  }
  ```
- [ ] Verify campaign created with field populated
- [ ] Test PUT request to update field
- [ ] Document any API issues

**Time Estimate:** 1 hour
**Dependencies:** Step 1.1, 1.2
**Risk:** Low

---

#### 1.7 Audit & Compliance Check ✅
- [ ] Verify `sys_created_on` tracking enabled
- [ ] Verify `sys_updated_on` tracking enabled
- [ ] Verify `sys_created_by` tracking enabled
- [ ] Verify `sys_updated_by` tracking enabled
- [ ] Test audit log captures field changes:
  - [ ] Create campaign with estimated_budget
  - [ ] Update estimated_budget value
  - [ ] Verify changes logged in sys_audit
- [ ] Document audit trail for compliance
- [ ] Verify no sensitive data concerns

**Time Estimate:** 30 minutes
**Dependencies:** Step 1.1
**Risk:** Very Low

---

## 🔍 PHASE 2: VALIDATION LAYER (Days 3-5, 6-8 hours)

### WorkItemValidator Updates

#### 2.1 Add Budget Validation Method ✅

**File:** `/script-includes/WorkItemValidator.js`

- [ ] Locate `WorkItemValidator` script include
- [ ] Add new method `_validateBudgets()`:

```javascript
/**
 * Validates budget and estimated_budget fields
 * @private
 * @param {GlideRecord} gr - Campaign record
 * @returns {Object} Validation result {valid, errors, warnings}
 */
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

        // Variance warning: if estimated > actual by 20%+
        if (budget) {
            var actualBudget = parseFloat(budget);
            var variance = ((estimatedNum - actualBudget) / actualBudget) * 100;
            if (variance > 20) {
                result.warnings.push(
                    'Estimated budget exceeds actual budget by ' +
                    Math.round(variance) + '%'
                );
            }
        }
    }

    return result;
}
```

- [ ] Add method to script include
- [ ] Verify syntax is correct
- [ ] Test method in isolation with unit tests

**Time Estimate:** 1 hour
**Dependencies:** None
**Risk:** Low

---

#### 2.2 Update validateCampaign() Method ✅

**File:** `/script-includes/WorkItemValidator.js`

- [ ] Find `validateCampaign()` method
- [ ] Add call to `_validateBudgets()`:

```javascript
// In validateCampaign() method:
var budgetValidation = this._validateBudgets(gr);
if (!budgetValidation.valid) {
    result.errors = result.errors.concat(budgetValidation.errors);
    result.valid = false;
}
result.warnings = result.warnings.concat(budgetValidation.warnings);
```

- [ ] Update method documentation/JSDoc
- [ ] Verify method still returns correct result object
- [ ] Test with various budget combinations

**Time Estimate:** 30 minutes
**Dependencies:** Step 2.1
**Risk:** Low

---

#### 2.3 Update Data Extraction Method ✅

**File:** `/script-includes/WorkItemValidator.js`

- [ ] Find `_extractRecordData()` method
- [ ] Add `estimated_budget` to returned object:

```javascript
_extractRecordData: function(gr) {
    return {
        sys_id: gr.getValue('sys_id'),
        name: gr.getValue('name'),
        short_description: gr.getValue('short_description'),
        start_date: gr.getValue('start_date'),
        end_date: gr.getValue('end_date'),
        state: gr.getValue('state'),
        assigned_to: gr.getValue('assigned_to'),
        budget: gr.getValue('budget'),
        estimated_budget: gr.getValue('u_estimated_budget'),  // NEW
        priority: gr.getValue('priority'),
        createdOn: gr.getValue('sys_created_on'),
        updatedOn: gr.getValue('sys_updated_on')
    };
}
```

- [ ] Verify field is extracted correctly
- [ ] Test data object includes field
- [ ] Verify serialization works properly

**Time Estimate:** 30 minutes
**Dependencies:** Step 2.2
**Risk:** Low

---

#### 2.4 Update JSDoc Comments ✅

**File:** `/script-includes/WorkItemValidator.js`

- [ ] Update class-level documentation:
  - [ ] Add note about estimated_budget validation
  - [ ] Update supported fields list

- [ ] Update method JSDoc for:
  - [ ] `validateCampaign()` - note estimated_budget validation
  - [ ] `_validateBudgets()` - document parameters and returns
  - [ ] `_extractRecordData()` - note new field in return object

- [ ] Verify documentation is clear and complete
- [ ] Add examples if helpful

**Time Estimate:** 30 minutes
**Dependencies:** All of 2.1-2.3
**Risk:** Very Low

---

### Business Rule Updates

#### 2.5 Update validate_before_campaign_insert Rule ✅

**File:** `/business-rules/validate_before_campaign_insert.js`

- [ ] Open business rule script
- [ ] Locate budget validation block (around line 109)
- [ ] Add estimated_budget validation:

```javascript
// ADD AFTER EXISTING BUDGET VALIDATION (line 120):

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

    // Variance check (warning only, not error)
    if (budget) {
        var actualBudget = parseFloat(budget);
        var variance = ((estimatedNum - actualBudget) / actualBudget) * 100;
        if (variance > 20) {
            validationResult.warnings.push(
                'Estimated budget exceeds actual budget by ' +
                Math.round(variance) + '%'
            );
        }
    }
}
```

- [ ] Add code to business rule
- [ ] Update comments/documentation in rule
- [ ] Test rule execution:
  - [ ] Create campaign with valid estimated_budget
  - [ ] Create campaign with invalid estimated_budget (should abort)
  - [ ] Create campaign with estimated > budget (should warn)
- [ ] Verify abort action works on validation failure
- [ ] Verify warning messages display correctly

**Time Estimate:** 1.5 hours
**Dependencies:** Step 2.1-2.3
**Risk:** Medium (must test thoroughly)

---

#### 2.6 Verify Business Rule Order ✅

- [ ] Check business rule execution order
- [ ] Ensure `validate_before_campaign_insert` order is 100
- [ ] Verify no conflicts with other rules
- [ ] Confirm rule is set to "before insert"
- [ ] Confirm rule is active
- [ ] Document execution sequence

**Time Estimate:** 30 minutes
**Dependencies:** Step 2.5
**Risk:** Low

---

## 🔧 PHASE 3: API & SCRIPT INCLUDES (Days 6-7, 5-7 hours)

### WorkItemManager Updates

#### 3.1 Update createCampaign() JSDoc ✅

**File:** `/script-includes/WorkItemManager.js`

- [ ] Locate `createCampaign()` method
- [ ] Update JSDoc @param section:

```javascript
/**
 * Creates a new campaign with validation
 *
 * @param {Object} data - Campaign data object
 * @param {string} data.name - Campaign name (required)
 * @param {string} data.short_description - Campaign description (required)
 * @param {string} data.start_date - Start date in YYYY-MM-DD format (required)
 * @param {string} data.end_date - End date in YYYY-MM-DD format (required)
 * @param {string} data.state - Campaign state (optional, defaults to 'draft')
 * @param {string} data.assigned_to - User sys_id (optional)
 * @param {number} data.budget - Campaign budget (optional, non-negative)
 * @param {number} data.estimated_budget - Campaign estimated budget (optional, non-negative) [NEW]
 * @param {number} data.priority - Priority 1-5 (optional, defaults to 3)
 *
 * @returns {Object} Result object with success status and data
 */
```

- [ ] Verify documentation is clear
- [ ] Add example with estimated_budget to documentation
- [ ] Confirm method properly passes field to record insertion

**Time Estimate:** 30 minutes
**Dependencies:** None
**Risk:** Very Low

---

#### 3.2 Update updateCampaign() JSDoc ✅

**File:** `/script-includes/WorkItemManager.js`

- [ ] Locate `updateCampaign()` method
- [ ] Update JSDoc @param section to include estimated_budget
- [ ] Example:

```javascript
/**
 * Updates an existing campaign
 *
 * @param {string} campaignSysId - Campaign sys_id to update
 * @param {Object} data - Fields to update
 * @param {string} data.name - Campaign name
 * @param {number} data.budget - Campaign budget
 * @param {number} data.estimated_budget - Campaign estimated budget [NEW]
 * @param {string} data.state - Campaign state
 */
```

- [ ] Verify documentation updated
- [ ] Add example with estimated_budget

**Time Estimate:** 30 minutes
**Dependencies:** None
**Risk:** Very Low

---

#### 3.3 Verify Field Serialization ✅

**File:** `/script-includes/WorkItemManager.js`

- [ ] Locate `_serializeCampaignResponse()` or similar method
- [ ] Verify method includes estimated_budget:

```javascript
_serializeCampaignResponse: function(gr) {
    return {
        sys_id: gr.getValue('sys_id'),
        name: gr.getValue('name'),
        short_description: gr.getValue('short_description'),
        start_date: gr.getValue('start_date'),
        end_date: gr.getValue('end_date'),
        state: gr.getValue('state'),
        assigned_to: gr.getValue('assigned_to'),
        budget: gr.getValue('budget'),
        estimated_budget: gr.getValue('u_estimated_budget'),  // NEW
        priority: gr.getValue('priority'),
        projectCount: this._getProjectCount(gr.getValue('sys_id'))
    };
}
```

- [ ] If method doesn't exist, create it
- [ ] If method exists but missing estimated_budget, add it
- [ ] Test serialization works correctly
- [ ] Verify null values handled properly

**Time Estimate:** 1 hour
**Dependencies:** None
**Risk:** Low

---

#### 3.4 Verify _setRecordFields() Method ✅

**File:** `/script-includes/WorkItemManager.js`

- [ ] Locate `_setRecordFields()` method
- [ ] Verify it handles field with `u_` prefix properly
- [ ] Method should automatically handle `u_estimated_budget`
- [ ] Test with sample data:
  - [ ] Pass `estimated_budget` in data object
  - [ ] Verify it's set to record as `u_estimated_budget`
- [ ] No code changes should be needed, but verify it works

**Time Estimate:** 30 minutes
**Dependencies:** None
**Risk:** Very Low

---

### API Documentation Updates

#### 3.5 Update OpenAPI/Swagger Schema ✅

**File:** API specification file (Swagger/OpenAPI)

- [ ] Locate campaign schema definition
- [ ] Add `estimated_budget` property:

```yaml
Campaign:
  type: object
  properties:
    sys_id:
      type: string
      description: System ID
    name:
      type: string
      description: Campaign name
      maxLength: 100
    short_description:
      type: string
      description: Campaign description
      maxLength: 1000
    budget:
      type: number
      format: decimal
      description: Actual budget allocated
    estimated_budget:  # NEW
      type: number
      format: decimal
      description: Estimated budget for planning purposes
      nullable: true
    state:
      type: string
      enum: [draft, planned, active, completed, cancelled]
    priority:
      type: integer
      minimum: 1
      maximum: 5
```

- [ ] Mark field as optional/nullable
- [ ] Add description explaining difference from budget
- [ ] Test schema validation

**Time Estimate:** 1 hour
**Dependencies:** None
**Risk:** Low

---

#### 3.6 Update API Request Example ✅

- [ ] Update POST /campaign request example:

```json
{
  "name": "Q1 2026 Campaign",
  "short_description": "Holiday promotion campaign",
  "start_date": "2026-11-01",
  "end_date": "2026-12-31",
  "state": "planned",
  "budget": 50000,
  "estimated_budget": 45000,
  "priority": 2
}
```

- [ ] Update PUT /campaign/{id} example
- [ ] Document optional nature of field
- [ ] Add note about variance calculation

**Time Estimate:** 30 minutes
**Dependencies:** Step 3.5
**Risk:** Very Low

---

#### 3.7 Update API Response Example ✅

- [ ] Update GET /campaign/{id} response example:

```json
{
  "success": true,
  "sysId": "abc123def456",
  "data": {
    "sys_id": "abc123def456",
    "name": "Q1 2026 Campaign",
    "short_description": "Holiday promotion campaign",
    "start_date": "2026-11-01",
    "end_date": "2026-12-31",
    "state": "planned",
    "budget": 50000,
    "estimated_budget": 45000,
    "priority": 2,
    "createdOn": "2025-11-14T10:30:00Z",
    "updatedOn": "2025-11-14T10:30:00Z"
  }
}
```

- [ ] Update POST /campaign response example
- [ ] Update PUT /campaign/{id} response example
- [ ] Ensure consistency across all examples

**Time Estimate:** 30 minutes
**Dependencies:** Step 3.5
**Risk:** Very Low

---

#### 3.8 Add API Documentation Notes ✅

- [ ] Add section explaining new field
- [ ] Note backward compatibility
- [ ] Document variance logic (if present)
- [ ] Add migration notes for existing clients
- [ ] Include usage examples

**Time Estimate:** 1 hour
**Dependencies:** All of 3.5-3.7
**Risk:** Very Low

---

## ✅ PHASE 4: TESTING (Days 8-11, 8-12 hours)

### Unit Tests

#### 4.1 Create Unit Test File ✅

**File:** `/tests/test_campaign_budget.js`

- [ ] Create new test file
- [ ] Set up test framework (Jest, Mocha, etc.)
- [ ] Create test suite structure
- [ ] Add test utilities/helpers

**Time Estimate:** 1 hour
**Dependencies:** None
**Risk:** Very Low

---

#### 4.2 Write Validation Logic Tests ✅

```javascript
describe('CampaignAPI - estimated_budget Validation', () => {
    describe('Input Validation', () => {
        test('should accept valid estimated_budget number', () => {
            const validator = new WorkItemValidator();
            // Test implementation
        });

        test('should reject negative estimated_budget', () => {
            // Test implementation
        });

        test('should reject non-numeric estimated_budget', () => {
            // Test implementation
        });

        test('should accept null/undefined estimated_budget', () => {
            // Test implementation
        });

        test('should warn if estimated > budget by 20%+', () => {
            // Test implementation
        });

        test('should not warn if variance < 20%', () => {
            // Test implementation
        });
    });
});
```

- [ ] Implement all validation tests
- [ ] Test edge cases
- [ ] Test error messages
- [ ] Run tests and verify passing

**Time Estimate:** 2-3 hours
**Dependencies:** Step 4.1
**Risk:** Low

---

#### 4.3 Write Business Rule Tests ✅

- [ ] Test business rule fires on insert
- [ ] Test validation aborts on error
- [ ] Test warnings generated correctly
- [ ] Test audit metadata set properly
- [ ] Run tests and verify passing

**Time Estimate:** 1.5-2 hours
**Dependencies:** Step 4.1
**Risk:** Low

---

#### 4.4 Write API Response Tests ✅

- [ ] Test POST /campaign returns estimated_budget in response
- [ ] Test GET /campaign returns estimated_budget field
- [ ] Test PUT /campaign updates estimated_budget
- [ ] Test null/empty values handled correctly
- [ ] Run tests and verify passing

**Time Estimate:** 1-1.5 hours
**Dependencies:** Step 4.1
**Risk:** Low

---

#### 4.5 Verify Test Coverage ✅

- [ ] Run coverage tool (Jest coverage, etc.)
- [ ] Target: >85% coverage for new code
- [ ] Target: >90% coverage for critical paths
- [ ] Add missing tests if needed
- [ ] Document coverage metrics

**Time Estimate:** 1 hour
**Dependencies:** All unit tests above
**Risk:** Low

---

### Integration Tests

#### 4.6 Campaign Creation Flow Test ✅

- [ ] Test complete campaign creation:
  - [ ] POST /campaign with estimated_budget
  - [ ] Verify record created in database
  - [ ] Verify business rule executed
  - [ ] Verify field persisted correctly
- [ ] Test with various budget combinations:
  - [ ] estimated_budget only (no budget)
  - [ ] budget only (no estimated_budget)
  - [ ] both budget and estimated_budget
  - [ ] neither budget nor estimated_budget
- [ ] Test variance calculations
- [ ] Verify warnings displayed

**Time Estimate:** 2 hours
**Dependencies:** Step 4.1
**Risk:** Medium

---

#### 4.7 Campaign Update Flow Test ✅

- [ ] Test updating estimated_budget
- [ ] Test updating budget only
- [ ] Test updating both
- [ ] Verify updates persist to database
- [ ] Verify audit trail updated
- [ ] Test business rule on update

**Time Estimate:** 1.5 hours
**Dependencies:** Step 4.1
**Risk:** Medium

---

#### 4.8 Backward Compatibility Test ✅

- [ ] Test old API request (no estimated_budget):
  ```json
  {
    "name": "Campaign",
    "budget": 50000
  }
  ```
- [ ] Verify campaign still creates
- [ ] Verify estimated_budget defaults to null
- [ ] Verify response includes estimated_budget field
- [ ] Test parsing doesn't break for old clients
- [ ] Test multiple old/new mixed requests

**Time Estimate:** 1.5 hours
**Dependencies:** Step 4.1
**Risk:** Medium

---

#### 4.9 Error Scenario Tests ✅

- [ ] Test invalid estimated_budget (negative):
  - [ ] Verify error returned
  - [ ] Verify campaign not created
  - [ ] Verify error message clear
- [ ] Test invalid type:
  - [ ] Test string value
  - [ ] Test object value
  - [ ] Test array value
- [ ] Test boundary values:
  - [ ] Zero: 0
  - [ ] Very large: 999999999.99
  - [ ] Decimal precision: 12345.67
- [ ] Verify all error messages clear and actionable

**Time Estimate:** 1.5 hours
**Dependencies:** Step 4.1
**Risk:** Medium

---

### Performance Tests

#### 4.10 Campaign Creation Performance ✅

- [ ] Measure campaign creation time with estimated_budget
- [ ] Compare against baseline (without field)
- [ ] Target: <5ms slower than baseline
- [ ] Run 100+ iterations for statistical significance
- [ ] Document results

**Time Estimate:** 1 hour
**Dependencies:** Step 4.1
**Risk:** Low

---

#### 4.11 Bulk Update Performance ✅

- [ ] Create 1000 test campaigns
- [ ] Bulk update estimated_budget field
- [ ] Measure time: Target <5 seconds for 1000 records
- [ ] Monitor database query performance
- [ ] Monitor API response times
- [ ] Document baseline and post-update metrics

**Time Estimate:** 1.5 hours
**Dependencies:** Step 4.1
**Risk:** Low

---

#### 4.12 Query Performance Test ✅

- [ ] Test query: `SELECT * WHERE u_estimated_budget > X`
- [ ] Verify index helps performance
- [ ] Measure before/after index
- [ ] Test with 10K+ records
- [ ] Document performance improvement

**Time Estimate:** 1 hour
**Dependencies:** Step 1.3
**Risk:** Low

---

### Test Results Documentation

#### 4.13 Test Summary Report ✅

- [ ] Compile all test results
- [ ] Document passing/failing tests
- [ ] Document coverage metrics
- [ ] Document performance results
- [ ] Note any issues found and fixes applied
- [ ] Get test report reviewed by QA lead

**Time Estimate:** 1 hour
**Dependencies:** All tests above
**Risk:** Very Low

---

## 📝 PHASE 5: DOCUMENTATION (Days 12, 3-4 hours)

#### 5.1 Create Release Notes ✅

**File:** Release notes document

- [ ] Title: "CampaignAPI Enhancement: estimated_budget Property"
- [ ] Executive summary
- [ ] What's new:
  - [ ] New estimated_budget field
  - [ ] Budget variance tracking
  - [ ] Enhanced validation
- [ ] Backward compatibility note
- [ ] Migration guidance
- [ ] API examples
- [ ] Known limitations (if any)

**Time Estimate:** 1 hour
**Risk:** Very Low

---

#### 5.2 Update API Reference ✅

- [ ] Update API documentation site
- [ ] Add estimated_budget to:
  - [ ] POST /campaign endpoint docs
  - [ ] GET /campaign endpoint docs
  - [ ] PUT /campaign endpoint docs
- [ ] Add examples with estimated_budget
- [ ] Update schema reference
- [ ] Verify documentation renders correctly

**Time Estimate:** 1.5 hours
**Risk:** Very Low

---

#### 5.3 Create User Guide Section ✅

- [ ] Document estimated_budget vs budget
- [ ] Explain why you'd use estimated_budget
- [ ] Provide use cases
- [ ] Add best practices
- [ ] Include form field description

**Time Estimate:** 30 minutes
**Risk:** Very Low

---

#### 5.4 Create Admin/Developer Guide ✅

- [ ] Document database migration performed
- [ ] Document business rule changes
- [ ] Document validation logic
- [ ] Document Script Include changes
- [ ] Include code snippets
- [ ] Document any configuration needed

**Time Estimate:** 30 minutes
**Risk:** Very Low

---

## 🚀 PHASE 6: DEPLOYMENT (Days 13-14)

### Pre-Deployment Verification

#### 6.1 Code Review ✅

- [ ] All code reviewed by senior developer
- [ ] All changes approved
- [ ] No security issues found
- [ ] No performance concerns
- [ ] Documentation approved
- [ ] Code follows standards

**Owner:** [Code Review Lead]
**Time Estimate:** 1-2 hours
**Risk:** Low

---

#### 6.2 Test Results Review ✅

- [ ] All unit tests passing ✅ 100%
- [ ] All integration tests passing ✅ 100%
- [ ] All API tests passing ✅ 100%
- [ ] Performance tests acceptable ✅
- [ ] No regressions found ✅
- [ ] Coverage >85% ✅

**Owner:** [QA Lead]
**Sign-off Required:** YES

---

#### 6.3 Rollback Procedure Test ✅

- [ ] Rollback procedure documented
- [ ] All rollback steps tested
- [ ] Rollback estimated time: 15-30 min
- [ ] Verified quick enough for production
- [ ] Alternative rollback procedures identified
- [ ] Rollback team briefed

**Owner:** [DevOps Lead]
**Sign-off Required:** YES

---

#### 6.4 Stakeholder Notifications ✅

- [ ] Product managers notified
- [ ] Support team briefed
- [ ] Customer notification (if needed) prepared
- [ ] Status page message prepared
- [ ] Status: [Pending] [Scheduled for Day X]

**Owner:** [Project Manager]
**Time Estimate:** 30 minutes

---

#### 6.5 Deployment Readiness Checklist ✅

- [ ] All code changes committed to git
- [ ] All tests passing
- [ ] Code review approved
- [ ] Database backup strategy verified
- [ ] Deployment script prepared
- [ ] Monitoring configured
- [ ] Escalation contacts identified
- [ ] Team briefed and ready

**Go/No-Go Decision:** [ ] GO [ ] NO-GO
**Decision Owner:** [Deployment Lead]

---

### Production Deployment

#### 6.6 Database Deployment ✅

**Timeline:** 5-10 minutes
**Owner:** [DBA/DevOps]

- [ ] Take backup of x_cadso_work_campaign table
- [ ] Execute field creation script
- [ ] Verify field created successfully
- [ ] Verify field accessible via API
- [ ] Test with sample data
- [ ] Monitor error logs
- [ ] Document completion time
- [ ] Proceed to next step ONLY if successful

**Rollback if:** Field not created OR field not accessible via API

---

#### 6.7 Code Deployment ✅

**Timeline:** 5-10 minutes
**Owner:** [DevOps]

Deploy in this order:
1. [ ] Deploy WorkItemValidator.js update
2. [ ] Deploy WorkItemManager.js update
3. [ ] Deploy validate_before_campaign_insert rule update
4. [ ] Deploy optional business rules (if included)

After each deployment:
- [ ] Verify deployment successful
- [ ] Check error logs
- [ ] Confirm no blocking issues

---

#### 6.8 Smoke Tests ✅

**Timeline:** 10-15 minutes
**Owner:** [QA]

- [ ] Create test campaign with estimated_budget
  - [ ] Verify record created
  - [ ] Verify field populated
  - [ ] Verify validation passed
- [ ] Retrieve campaign via GET /api
  - [ ] Verify field returned in response
  - [ ] Verify value correct
- [ ] Update campaign estimated_budget
  - [ ] Verify update successful
  - [ ] Verify field updated
- [ ] Test with legacy format (no estimated_budget)
  - [ ] Verify campaign still creates
  - [ ] Verify field defaults to null
- [ ] Test validation
  - [ ] Invalid value (negative)
  - [ ] Variance warning (>20%)
- [ ] Check logs for errors: [ ] None found

**Stop here if:** Any smoke test fails

---

#### 6.9 Post-Deployment Monitoring ✅

**Timeline:** First 2 hours critical, then 24-48 hours

**Within 15 minutes of deployment:**
- [ ] Check application logs for exceptions
- [ ] Check database logs for errors
- [ ] Verify no cascading failures
- [ ] Confirm API endpoints responding

**Within 1 hour:**
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify no customer impact
- [ ] Review user feedback (if applicable)

**Within 2 hours:**
- [ ] Confirm no unusual activity
- [ ] Verify field being used as expected
- [ ] Document deployment metrics

**Ongoing (24-48 hours):**
- [ ] Monitor for issues
- [ ] Track adoption rate
- [ ] Collect user feedback
- [ ] Document lessons learned

---

#### 6.10 Release Communication ✅

**Owner:** [Communications/Product]

- [ ] Publish release notes
- [ ] Update API documentation site
- [ ] Notify development teams
- [ ] Notify support teams
- [ ] Notify customers (if external facing)
- [ ] Update status page
- [ ] Close announcement ticket

---

## 📊 SIGN-OFF & APPROVAL

### Team Sign-Offs

- [ ] Architecture Lead: ________________ Date: ___________
- [ ] Backend Developer: ________________ Date: ___________
- [ ] QA Lead: ________________ Date: ___________
- [ ] DevOps Lead: ________________ Date: ___________
- [ ] Product Manager: ________________ Date: ___________

### Pre-Deployment Approval

**Status:** [ ] APPROVED [ ] PENDING [ ] BLOCKED

**Approved By:** ________________
**Date:** ___________

### Post-Deployment Approval

**Deployment Success:** [ ] YES [ ] NO

**Deployed By:** ________________
**Date & Time:** ___________

**Post-Deployment Status:** [ ] SUCCESSFUL [ ] ROLLED BACK

---

## 📋 QUICK REFERENCE

### File Changes Summary

| File | Changes | Effort |
|------|---------|--------|
| `x_cadso_work_campaign` table | Add field | 30 min |
| `WorkItemValidator.js` | Add validation | 2 hr |
| `validate_before_campaign_insert.js` | Update BR | 1.5 hr |
| `WorkItemManager.js` | Update JSDoc | 1 hr |
| API documentation | Update schemas | 2 hr |
| Test files | Create tests | 4-6 hr |

### Rollback Quick Steps

```
1. Revert WorkItemValidator.js from git
2. Revert WorkItemManager.js from git
3. Revert business rule code
4. Deploy reverted code
5. Test API responding
6. Done (field can be cleaned up later)

Estimated Time: 15-30 minutes
```

### Key Contacts

- **Database Issues:** [DBA Name]
- **Code Issues:** [Backend Lead]
- **Testing Issues:** [QA Lead]
- **Deployment Issues:** [DevOps Lead]
- **Escalation:** [Manager Name]

---

**Checklist Version:** 1.0
**Last Updated:** November 14, 2025
**Status:** READY TO USE

