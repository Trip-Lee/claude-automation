/**
 * Unit Tests: WorkItemValidator
 *
 * Tests for the WorkItemValidator Script Include that validates
 * work items (campaigns, projects, tasks).
 *
 * Test Coverage:
 * - validateCampaign(): Campaign validation logic
 * - validateProject(): Project validation logic
 * - validateTask(): Task validation logic
 * - checkReferences(): Reference integrity validation
 *
 * Dependencies: ATF (Automated Test Framework) or Jest-style testing
 *
 * POTENTIAL ISSUES & CONSTRAINTS:
 *
 * Technical Constraints:
 * - Mock implementations may not perfectly replicate GlideRecord behavior
 * - Tests run outside ServiceNow environment (no access to actual DB)
 * - GlideDBObjectManager mock only validates predefined table list
 * - GlideDateTime mock uses JavaScript Date (potential timezone differences)
 * - Performance: Tests execute synchronously (~50ms per test)
 *
 * Business Constraints:
 * - Test data is static (mockData object) - not representative of production
 * - Cannot test actual ACL enforcement (mocked environment)
 * - Test coverage limited to defined scenarios in mockData
 * - No integration testing with actual ServiceNow instance
 *
 * Data Integrity Constraints:
 * - Mock GlideRecord.get() only finds records by exact sys_id match
 * - Mock query conditions support only '=' and '!=' operators
 * - Reference validation depends on mockData having correct relationships
 * - isValidField() only checks if property exists, not actual field definitions
 *
 * Security Constraints:
 * - Tests do not validate ACL behavior (ACLs are bypassed in mocks)
 * - No authentication/authorization testing in mock environment
 * - Mock gs.error/warn/info do not validate log output format
 * - Cannot test role-based access in isolation
 */

// Mock ServiceNow globals for testing outside ServiceNow
var mockData = {
    campaigns: {
        valid_campaign: {
            sys_id: 'valid_campaign_id',
            name: 'Test Campaign',
            description: 'A test campaign',
            state: 'active',
            start_date: '2024-01-01',
            end_date: '2024-12-31',
            budget: 50000,
            active: true
        },
        invalid_no_name: {
            sys_id: 'no_name_campaign_id',
            name: '',
            state: 'active'
        },
        invalid_dates: {
            sys_id: 'invalid_dates_id',
            name: 'Bad Dates Campaign',
            state: 'active',
            start_date: '2024-12-31',
            end_date: '2024-01-01'
        },
        negative_budget: {
            sys_id: 'negative_budget_id',
            name: 'Negative Budget',
            state: 'active',
            budget: -1000
        }
    },
    projects: {
        valid_project: {
            sys_id: 'valid_project_id',
            name: 'Test Project',
            state: 'active',
            campaign: 'valid_campaign_id',
            priority: 3,
            start_date: '2024-02-01',
            end_date: '2024-06-30'
        },
        no_campaign: {
            sys_id: 'no_campaign_project_id',
            name: 'Orphan Project',
            state: 'active',
            campaign: ''
        },
        invalid_priority: {
            sys_id: 'invalid_priority_id',
            name: 'Bad Priority',
            state: 'active',
            campaign: 'valid_campaign_id',
            priority: 10
        }
    },
    tasks: {
        valid_task: {
            sys_id: 'valid_task_id',
            short_description: 'Test Task',
            state: 'open',
            project: 'valid_project_id',
            assigned_to: 'valid_user_id',
            due_date: '2024-03-15'
        },
        no_project: {
            sys_id: 'no_project_task_id',
            short_description: 'Orphan Task',
            state: 'open',
            project: ''
        },
        no_description: {
            sys_id: 'no_desc_task_id',
            short_description: '',
            state: 'open',
            project: 'valid_project_id'
        }
    },
    users: {
        valid_user_id: {
            sys_id: 'valid_user_id',
            name: 'Test User',
            active: true
        }
    }
};

// Mock GlideRecord
function MockGlideRecord(tableName) {
    this.tableName = tableName;
    this.record = null;
    this.query_conditions = [];
    this.results = [];
    this.index = -1;
}

MockGlideRecord.prototype = {
    get: function(sysId) {
        var tables = {
            'x_cadso_work_campaign': mockData.campaigns,
            'x_cadso_work_project': mockData.projects,
            'x_cadso_work_task': mockData.tasks,
            'sys_user': mockData.users
        };

        var tableData = tables[this.tableName] || {};
        for (var key in tableData) {
            if (tableData[key].sys_id === sysId) {
                this.record = tableData[key];
                return true;
            }
        }
        return false;
    },

    addQuery: function(field, operator, value) {
        if (value === undefined) {
            value = operator;
            operator = '=';
        }
        this.query_conditions.push({ field: field, operator: operator, value: value });
    },

    query: function() {
        var tables = {
            'x_cadso_work_campaign': mockData.campaigns,
            'x_cadso_work_project': mockData.projects,
            'x_cadso_work_task': mockData.tasks,
            'sys_user': mockData.users
        };

        var tableData = tables[this.tableName] || {};
        this.results = [];

        for (var key in tableData) {
            var record = tableData[key];
            var matches = true;

            for (var i = 0; i < this.query_conditions.length; i++) {
                var cond = this.query_conditions[i];
                if (cond.operator === '=' && record[cond.field] !== cond.value) {
                    matches = false;
                } else if (cond.operator === '!=' && record[cond.field] === cond.value) {
                    matches = false;
                }
            }

            if (matches) {
                this.results.push(record);
            }
        }
        this.index = -1;
    },

    hasNext: function() {
        return this.index + 1 < this.results.length;
    },

    next: function() {
        this.index++;
        if (this.index < this.results.length) {
            this.record = this.results[this.index];
            return true;
        }
        return false;
    },

    getValue: function(field) {
        return this.record ? (this.record[field] || '') : '';
    },

    isValidField: function(field) {
        return this.record ? this.record.hasOwnProperty(field) : false;
    },

    initialize: function() {
        this.record = {};
    },

    setValue: function(field, value) {
        this.record[field] = value;
    },

    insert: function() {
        return 'new_sys_id_' + Date.now();
    },

    deleteRecord: function() {
        return true;
    }
};

// Mock GlideDateTime
function MockGlideDateTime(dateStr) {
    this.date = dateStr ? new Date(dateStr) : new Date();
}

MockGlideDateTime.prototype = {
    after: function(other) {
        return this.date > other.date;
    },
    before: function(other) {
        return this.date < other.date;
    }
};

// Mock GlideDBObjectManager
var MockGlideDBObjectManager = {
    _instance: {
        isValidTable: function(tableName) {
            var validTables = [
                'x_cadso_work_campaign',
                'x_cadso_work_project',
                'x_cadso_work_task',
                'sys_user'
            ];
            return validTables.indexOf(tableName) !== -1;
        }
    },
    get: function() {
        return this._instance;
    }
};

// Mock gs (GlideSystem)
var mockLogs = { info: [], warn: [], error: [] };
var MockGS = {
    info: function(msg) { mockLogs.info.push(msg); },
    warn: function(msg) { mockLogs.warn.push(msg); },
    error: function(msg) { mockLogs.error.push(msg); },
    clearLogs: function() { mockLogs = { info: [], warn: [], error: [] }; }
};

// Assign mocks to global scope for WorkItemValidator
var GlideRecord = MockGlideRecord;
var GlideDateTime = MockGlideDateTime;
var GlideDBObjectManager = MockGlideDBObjectManager;
var gs = MockGS;

// Import WorkItemValidator class definition
var Class = {
    create: function() {
        return function() {
            this.initialize.apply(this, arguments);
        };
    }
};

/**
 * Test Suite: WorkItemValidator
 */
var WorkItemValidatorTests = {

    setup: function() {
        gs.clearLogs();
    },

    /**
     * TEST: validateCampaign - Valid Campaign
     * Expected: Returns {valid: true} with no errors
     */
    test_validateCampaign_valid: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.validateCampaign('valid_campaign_id');

        var passed = result.valid === true && result.errors.length === 0;
        console.log('[TEST] validateCampaign_valid: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: validateCampaign - Missing sys_id
     * Expected: Returns {valid: false} with error about missing sys_id
     */
    test_validateCampaign_missingSysId: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.validateCampaign('');

        var passed = result.valid === false &&
                     result.errors.some(function(e) { return e.indexOf('sys_id') !== -1; });
        console.log('[TEST] validateCampaign_missingSysId: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: validateCampaign - Campaign Not Found
     * Expected: Returns {valid: false} with error about campaign not found
     */
    test_validateCampaign_notFound: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.validateCampaign('nonexistent_id');

        var passed = result.valid === false &&
                     result.errors.some(function(e) { return e.indexOf('not found') !== -1; });
        console.log('[TEST] validateCampaign_notFound: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: validateCampaign - Invalid Dates (start after end)
     * Expected: Returns {valid: false} with date error
     */
    test_validateCampaign_invalidDates: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.validateCampaign('invalid_dates_id');

        var passed = result.valid === false &&
                     result.errors.some(function(e) { return e.indexOf('date') !== -1; });
        console.log('[TEST] validateCampaign_invalidDates: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: validateCampaign - Negative Budget
     * Expected: Returns {valid: false} with budget error
     */
    test_validateCampaign_negativeBudget: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.validateCampaign('negative_budget_id');

        var passed = result.valid === false &&
                     result.errors.some(function(e) { return e.indexOf('budget') !== -1; });
        console.log('[TEST] validateCampaign_negativeBudget: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: validateProject - Valid Project
     * Expected: Returns {valid: true} with no errors
     */
    test_validateProject_valid: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.validateProject('valid_project_id');

        var passed = result.valid === true && result.errors.length === 0;
        console.log('[TEST] validateProject_valid: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: validateProject - Missing Campaign Reference
     * Expected: Returns {valid: false} with campaign error
     */
    test_validateProject_noCampaign: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.validateProject('no_campaign_project_id');

        var passed = result.valid === false &&
                     result.errors.some(function(e) { return e.indexOf('campaign') !== -1; });
        console.log('[TEST] validateProject_noCampaign: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: validateProject - Invalid Priority
     * Expected: Returns {valid: false} with priority error
     */
    test_validateProject_invalidPriority: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.validateProject('invalid_priority_id');

        var passed = result.valid === false &&
                     result.errors.some(function(e) { return e.indexOf('priority') !== -1; });
        console.log('[TEST] validateProject_invalidPriority: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: validateTask - Valid Task
     * Expected: Returns {valid: true} with no errors
     */
    test_validateTask_valid: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.validateTask('valid_task_id');

        var passed = result.valid === true && result.errors.length === 0;
        console.log('[TEST] validateTask_valid: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: validateTask - Missing Project Reference
     * Expected: Returns {valid: false} with project error
     */
    test_validateTask_noProject: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.validateTask('no_project_task_id');

        var passed = result.valid === false &&
                     result.errors.some(function(e) { return e.indexOf('project') !== -1; });
        console.log('[TEST] validateTask_noProject: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: validateTask - Missing Description
     * Expected: Returns {valid: false} with description error
     */
    test_validateTask_noDescription: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.validateTask('no_desc_task_id');

        var passed = result.valid === false &&
                     result.errors.some(function(e) { return e.indexOf('description') !== -1; });
        console.log('[TEST] validateTask_noDescription: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: checkReferences - Valid Reference
     * Expected: Returns {valid: true}
     */
    test_checkReferences_valid: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.checkReferences('x_cadso_work_campaign', 'valid_campaign_id');

        var passed = result.valid === true && result.errors.length === 0;
        console.log('[TEST] checkReferences_valid: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: checkReferences - Missing Table Name
     * Expected: Returns {valid: false} with table error
     */
    test_checkReferences_missingTable: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.checkReferences('', 'some_id');

        var passed = result.valid === false &&
                     result.errors.some(function(e) { return e.indexOf('Table') !== -1 || e.indexOf('table') !== -1; });
        console.log('[TEST] checkReferences_missingTable: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: checkReferences - Invalid Table
     * Expected: Returns {valid: false} with invalid table error
     */
    test_checkReferences_invalidTable: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.checkReferences('nonexistent_table', 'some_id');

        var passed = result.valid === false &&
                     result.errors.some(function(e) { return e.indexOf('Invalid table') !== -1; });
        console.log('[TEST] checkReferences_invalidTable: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: checkReferences - Record Not Found
     * Expected: Returns {valid: false} with not found error
     */
    test_checkReferences_notFound: function() {
        this.setup();
        var validator = new WorkItemValidator();
        var result = validator.checkReferences('x_cadso_work_campaign', 'nonexistent_id');

        var passed = result.valid === false &&
                     result.errors.some(function(e) { return e.indexOf('not found') !== -1; });
        console.log('[TEST] checkReferences_notFound: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * Run all tests and report results
     */
    runAll: function() {
        console.log('\n========================================');
        console.log('WorkItemValidator Test Suite');
        console.log('========================================\n');

        var tests = [
            'test_validateCampaign_valid',
            'test_validateCampaign_missingSysId',
            'test_validateCampaign_notFound',
            'test_validateCampaign_invalidDates',
            'test_validateCampaign_negativeBudget',
            'test_validateProject_valid',
            'test_validateProject_noCampaign',
            'test_validateProject_invalidPriority',
            'test_validateTask_valid',
            'test_validateTask_noProject',
            'test_validateTask_noDescription',
            'test_checkReferences_valid',
            'test_checkReferences_missingTable',
            'test_checkReferences_invalidTable',
            'test_checkReferences_notFound'
        ];

        var passed = 0;
        var failed = 0;
        var failedTests = [];

        for (var i = 0; i < tests.length; i++) {
            try {
                if (this[tests[i]]()) {
                    passed++;
                } else {
                    failed++;
                    failedTests.push(tests[i]);
                }
            } catch (ex) {
                failed++;
                failedTests.push(tests[i] + ' (Exception: ' + ex.message + ')');
                console.log('[TEST] ' + tests[i] + ': FAILED (Exception)');
                console.log('  Error:', ex.message);
            }
        }

        console.log('\n========================================');
        console.log('Test Results: ' + passed + '/' + (passed + failed) + ' passed');
        console.log('========================================');

        if (failedTests.length > 0) {
            console.log('\nFailed Tests:');
            failedTests.forEach(function(t) {
                console.log('  - ' + t);
            });
        }

        return {
            total: passed + failed,
            passed: passed,
            failed: failed,
            failedTests: failedTests
        };
    }
};

// Export for ServiceNow ATF or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WorkItemValidatorTests: WorkItemValidatorTests,
        mockData: mockData
    };
}

// Run tests if executed directly
if (typeof require !== 'undefined' && require.main === module) {
    // Load the actual WorkItemValidator
    var fs = require('fs');
    var path = require('path');
    var validatorCode = fs.readFileSync(
        path.join(__dirname, '../script-includes/WorkItemValidator.js'),
        'utf8'
    );
    eval(validatorCode);

    WorkItemValidatorTests.runAll();
}
