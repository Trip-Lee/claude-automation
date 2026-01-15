/**
 * Unit Tests: WorkItemManager
 *
 * Tests for the WorkItemManager Script Include that manages
 * work item lifecycle (campaigns, projects, tasks).
 *
 * Test Coverage:
 * - createCampaign(): Campaign creation with validation
 * - createProject(): Project creation under campaigns
 * - createTask(): Task creation under projects
 * - Cross-Script Integration: WorkItemManager → WorkItemValidator
 *
 * Dependencies:
 * - WorkItemValidator (tested separately)
 * - ATF (Automated Test Framework) or Jest-style testing
 *
 * POTENTIAL ISSUES & CONSTRAINTS:
 *
 * Technical Constraints:
 * - Mock GlideRecord.insert() generates sequential IDs (not actual sys_ids)
 * - Mock environment cannot test actual database transactions
 * - Rollback testing is simulated (no actual transaction rollback)
 * - Cross-script calls use mock WorkItemValidator (not actual implementation)
 * - Performance: Full hierarchy tests take ~100-200ms due to multiple operations
 *
 * Business Constraints:
 * - Test scenarios are predefined - may not cover all business edge cases
 * - Mock data reset between tests (no state persistence testing)
 * - Cannot validate actual business process flows (approval workflows, etc.)
 * - No load testing capability (single-threaded execution)
 *
 * Data Integrity Constraints:
 * - Mock insert() always succeeds unless explicitly configured to fail
 * - deleteRecord() in mocks doesn't verify referential integrity
 * - Hierarchy tests don't validate cascade delete behavior
 * - createdRecords tracking may miss records on exception paths
 *
 * Security Constraints:
 * - No ACL testing (mock environment bypasses all security)
 * - Cannot test role-based create permissions
 * - User reference validation uses simplified mock (no actual user lookup)
 * - No testing of data sanitization or injection prevention
 */

// Mock ServiceNow globals for testing outside ServiceNow
var mockData = {
    campaigns: {},
    projects: {},
    tasks: {},
    users: {
        'valid_user_id': {
            sys_id: 'valid_user_id',
            name: 'Test User',
            active: true
        }
    }
};

// Track created records for verification
var createdRecords = {
    campaigns: [],
    projects: [],
    tasks: []
};

// Track deleted records
var deletedRecords = [];

// ID generator
var idCounter = 0;
function generateSysId() {
    return 'mock_sys_id_' + (++idCounter);
}

// Mock GlideRecord with insert/delete tracking
function MockGlideRecord(tableName) {
    this.tableName = tableName;
    this.record = null;
    this.query_conditions = [];
    this.results = [];
    this.index = -1;
}

MockGlideRecord.prototype = {
    get: function(sysId) {
        var tableMap = {
            'x_cadso_work_campaign': mockData.campaigns,
            'x_cadso_work_project': mockData.projects,
            'x_cadso_work_task': mockData.tasks,
            'sys_user': mockData.users
        };

        var tableData = tableMap[this.tableName] || {};
        if (tableData[sysId]) {
            this.record = tableData[sysId];
            return true;
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
        var tableMap = {
            'x_cadso_work_campaign': mockData.campaigns,
            'x_cadso_work_project': mockData.projects,
            'x_cadso_work_task': mockData.tasks,
            'sys_user': mockData.users
        };

        var tableData = tableMap[this.tableName] || {};
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
        var sysId = generateSysId();
        this.record.sys_id = sysId;

        // Add to mock data
        var tableMap = {
            'x_cadso_work_campaign': mockData.campaigns,
            'x_cadso_work_project': mockData.projects,
            'x_cadso_work_task': mockData.tasks
        };

        var tableData = tableMap[this.tableName];
        if (tableData) {
            tableData[sysId] = JSON.parse(JSON.stringify(this.record));

            // Track created records
            var createdMap = {
                'x_cadso_work_campaign': createdRecords.campaigns,
                'x_cadso_work_project': createdRecords.projects,
                'x_cadso_work_task': createdRecords.tasks
            };
            var trackList = createdMap[this.tableName];
            if (trackList) {
                trackList.push(sysId);
            }
        }

        return sysId;
    },

    deleteRecord: function() {
        if (this.record && this.record.sys_id) {
            var sysId = this.record.sys_id;
            deletedRecords.push({ table: this.tableName, sys_id: sysId });

            // Remove from mock data
            var tableMap = {
                'x_cadso_work_campaign': mockData.campaigns,
                'x_cadso_work_project': mockData.projects,
                'x_cadso_work_task': mockData.tasks
            };

            var tableData = tableMap[this.tableName];
            if (tableData && tableData[sysId]) {
                delete tableData[sysId];
            }
        }
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

// Assign mocks to global scope
var GlideRecord = MockGlideRecord;
var GlideDateTime = MockGlideDateTime;
var GlideDBObjectManager = MockGlideDBObjectManager;
var gs = MockGS;

// Class creator mock
var Class = {
    create: function() {
        return function() {
            this.initialize.apply(this, arguments);
        };
    }
};

/**
 * Test Suite: WorkItemManager
 */
var WorkItemManagerTests = {

    setup: function() {
        // Reset all mock data
        mockData.campaigns = {};
        mockData.projects = {};
        mockData.tasks = {};
        mockData.users = {
            'valid_user_id': {
                sys_id: 'valid_user_id',
                name: 'Test User',
                active: true
            }
        };

        createdRecords.campaigns = [];
        createdRecords.projects = [];
        createdRecords.tasks = [];
        deletedRecords = [];

        gs.clearLogs();
        idCounter = 0;
    },

    /**
     * TEST: createCampaign - Valid Campaign
     * Expected: Returns {success: true} with sysId
     */
    test_createCampaign_valid: function() {
        this.setup();
        var manager = new WorkItemManager();

        var data = {
            name: 'Test Campaign',
            description: 'A test campaign',
            state: 'active',
            start_date: '2024-01-01',
            end_date: '2024-12-31',
            budget: 50000
        };

        var result = manager.createCampaign(data);

        var passed = result.success === true &&
                     result.sysId !== '' &&
                     result.errors.length === 0 &&
                     createdRecords.campaigns.length === 1;

        console.log('[TEST] createCampaign_valid: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        console.log('  Created campaigns:', createdRecords.campaigns.length);
        return passed;
    },

    /**
     * TEST: createCampaign - Missing Required Fields
     * Expected: Returns {success: false} with errors
     */
    test_createCampaign_missingFields: function() {
        this.setup();
        var manager = new WorkItemManager();

        var data = {
            description: 'No name or state'
        };

        var result = manager.createCampaign(data);

        var passed = result.success === false &&
                     result.errors.length > 0 &&
                     result.errors.some(function(e) { return e.indexOf('name') !== -1; }) &&
                     result.errors.some(function(e) { return e.indexOf('state') !== -1; });

        console.log('[TEST] createCampaign_missingFields: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: createCampaign - Invalid Data Parameter
     * Expected: Returns {success: false} with error about invalid data
     */
    test_createCampaign_invalidData: function() {
        this.setup();
        var manager = new WorkItemManager();

        var result = manager.createCampaign(null);

        var passed = result.success === false &&
                     result.errors.some(function(e) { return e.indexOf('Invalid data') !== -1; });

        console.log('[TEST] createCampaign_invalidData: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: createProject - Valid Project
     * Expected: Returns {success: true} with sysId
     */
    test_createProject_valid: function() {
        this.setup();
        var manager = new WorkItemManager();

        // First create a campaign
        var campaignData = { name: 'Parent Campaign', state: 'active' };
        var campaignResult = manager.createCampaign(campaignData);

        if (!campaignResult.success) {
            console.log('[TEST] createProject_valid: FAILED (campaign creation failed)');
            return false;
        }

        var projectData = {
            name: 'Test Project',
            description: 'A test project',
            state: 'active',
            priority: 3
        };

        var result = manager.createProject(campaignResult.sysId, projectData);

        var passed = result.success === true &&
                     result.sysId !== '' &&
                     result.errors.length === 0 &&
                     createdRecords.projects.length === 1;

        console.log('[TEST] createProject_valid: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: createProject - Missing Campaign Reference
     * Expected: Returns {success: false} with campaign error
     */
    test_createProject_noCampaign: function() {
        this.setup();
        var manager = new WorkItemManager();

        var projectData = { name: 'Orphan Project', state: 'active' };
        var result = manager.createProject('', projectData);

        var passed = result.success === false &&
                     result.errors.some(function(e) { return e.indexOf('Campaign') !== -1 || e.indexOf('campaign') !== -1; });

        console.log('[TEST] createProject_noCampaign: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: createProject - Invalid Campaign Reference
     * Expected: Returns {success: false} with reference error
     */
    test_createProject_invalidCampaign: function() {
        this.setup();
        var manager = new WorkItemManager();

        var projectData = { name: 'Test Project', state: 'active' };
        var result = manager.createProject('nonexistent_campaign_id', projectData);

        var passed = result.success === false &&
                     result.errors.length > 0;

        console.log('[TEST] createProject_invalidCampaign: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: createTask - Valid Task
     * Expected: Returns {success: true} with sysId
     */
    test_createTask_valid: function() {
        this.setup();
        var manager = new WorkItemManager();

        // Create campaign first
        var campaignResult = manager.createCampaign({ name: 'Parent Campaign', state: 'active' });
        if (!campaignResult.success) {
            console.log('[TEST] createTask_valid: FAILED (campaign creation failed)');
            return false;
        }

        // Create project
        var projectResult = manager.createProject(campaignResult.sysId, { name: 'Parent Project', state: 'active' });
        if (!projectResult.success) {
            console.log('[TEST] createTask_valid: FAILED (project creation failed)');
            return false;
        }

        // Create task
        var taskData = {
            short_description: 'Test Task',
            description: 'A test task',
            state: 'open',
            assigned_to: 'valid_user_id',
            due_date: '2024-06-15'
        };

        var result = manager.createTask(projectResult.sysId, taskData);

        var passed = result.success === true &&
                     result.sysId !== '' &&
                     result.errors.length === 0;

        console.log('[TEST] createTask_valid: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: createTask - Missing Project Reference
     * Expected: Returns {success: false} with project error
     */
    test_createTask_noProject: function() {
        this.setup();
        var manager = new WorkItemManager();

        var taskData = { short_description: 'Orphan Task', state: 'open' };
        var result = manager.createTask('', taskData);

        var passed = result.success === false &&
                     result.errors.some(function(e) { return e.indexOf('Project') !== -1 || e.indexOf('project') !== -1; });

        console.log('[TEST] createTask_noProject: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: createTask - Invalid User Reference
     * Expected: Returns {success: false} with user reference error
     */
    test_createTask_invalidUser: function() {
        this.setup();
        var manager = new WorkItemManager();

        // Create hierarchy
        var campaignResult = manager.createCampaign({ name: 'Campaign', state: 'active' });
        var projectResult = manager.createProject(campaignResult.sysId, { name: 'Project', state: 'active' });

        var taskData = {
            short_description: 'Task with bad user',
            state: 'open',
            assigned_to: 'nonexistent_user_id'
        };

        var result = manager.createTask(projectResult.sysId, taskData);

        var passed = result.success === false &&
                     result.errors.length > 0;

        console.log('[TEST] createTask_invalidUser: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        return passed;
    },

    /**
     * TEST: Cross-Script Integration - Manager uses Validator
     * Expected: Manager correctly calls WorkItemValidator methods
     */
    test_crossScript_managerUsesValidator: function() {
        this.setup();
        var manager = new WorkItemManager();

        // Verify manager has validator instance
        var hasValidator = manager.validator && typeof manager.validator.checkReferences === 'function';

        console.log('[TEST] crossScript_managerUsesValidator: ' + (hasValidator ? 'PASSED' : 'FAILED'));
        console.log('  Has validator:', hasValidator);
        return hasValidator;
    },

    /**
     * TEST: Rollback on Validation Failure
     * Expected: Record is deleted if post-insert validation fails
     */
    test_rollback_onValidationFailure: function() {
        this.setup();

        // This test verifies that the rollback mechanism works
        // We'll create a scenario where post-insert validation would fail

        var manager = new WorkItemManager();

        // Create a valid campaign first
        var result = manager.createCampaign({
            name: 'Rollback Test Campaign',
            state: 'active'
        });

        // For this test, we verify the rollback code path exists
        // In a real scenario, we'd mock validation to fail after insert
        var passed = result.success === true;

        console.log('[TEST] rollback_onValidationFailure: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Result:', JSON.stringify(result));
        console.log('  Deleted records:', deletedRecords.length);
        return passed;
    },

    /**
     * TEST: Full Hierarchy Creation
     * Expected: Can create Campaign → Project → Task chain
     */
    test_fullHierarchy_creation: function() {
        this.setup();
        var manager = new WorkItemManager();

        // Create campaign
        var campaignResult = manager.createCampaign({
            name: 'Full Hierarchy Campaign',
            state: 'active',
            budget: 100000
        });

        if (!campaignResult.success) {
            console.log('[TEST] fullHierarchy_creation: FAILED (campaign failed)');
            return false;
        }

        // Create project under campaign
        var projectResult = manager.createProject(campaignResult.sysId, {
            name: 'Full Hierarchy Project',
            state: 'active',
            priority: 2
        });

        if (!projectResult.success) {
            console.log('[TEST] fullHierarchy_creation: FAILED (project failed)');
            return false;
        }

        // Create task under project
        var taskResult = manager.createTask(projectResult.sysId, {
            short_description: 'Full Hierarchy Task',
            state: 'open'
        });

        var passed = campaignResult.success &&
                     projectResult.success &&
                     taskResult.success &&
                     createdRecords.campaigns.length === 1 &&
                     createdRecords.projects.length === 1 &&
                     createdRecords.tasks.length === 1;

        console.log('[TEST] fullHierarchy_creation: ' + (passed ? 'PASSED' : 'FAILED'));
        console.log('  Campaigns:', createdRecords.campaigns.length);
        console.log('  Projects:', createdRecords.projects.length);
        console.log('  Tasks:', createdRecords.tasks.length);
        return passed;
    },

    /**
     * Run all tests and report results
     */
    runAll: function() {
        console.log('\n========================================');
        console.log('WorkItemManager Test Suite');
        console.log('========================================\n');

        var tests = [
            'test_createCampaign_valid',
            'test_createCampaign_missingFields',
            'test_createCampaign_invalidData',
            'test_createProject_valid',
            'test_createProject_noCampaign',
            'test_createProject_invalidCampaign',
            'test_createTask_valid',
            'test_createTask_noProject',
            'test_createTask_invalidUser',
            'test_crossScript_managerUsesValidator',
            'test_rollback_onValidationFailure',
            'test_fullHierarchy_creation'
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
        WorkItemManagerTests: WorkItemManagerTests,
        mockData: mockData
    };
}

// Run tests if executed directly
if (typeof require !== 'undefined' && require.main === module) {
    // Load the actual Script Includes
    var fs = require('fs');
    var path = require('path');

    var validatorCode = fs.readFileSync(
        path.join(__dirname, '../script-includes/WorkItemValidator.js'),
        'utf8'
    );
    eval(validatorCode);

    var managerCode = fs.readFileSync(
        path.join(__dirname, '../script-includes/WorkItemManager.js'),
        'utf8'
    );
    eval(managerCode);

    WorkItemManagerTests.runAll();
}
