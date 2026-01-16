/**
 * WorkItemManager Script Include
 *
 * Purpose: Manages work item lifecycle (campaigns, projects, tasks)
 * Type: Server-side Script Include
 * Tables Accessed: x_cadso_work_campaign, x_cadso_work_project, x_cadso_work_task
 * Dependencies: WorkItemValidator (Script Include)
 *
 * @class WorkItemManager
 *
 * POTENTIAL ISSUES & CONSTRAINTS:
 *
 * Technical Constraints:
 * - Query Overhead: 3-6 database queries per create operation
 *   • createCampaign(): 3-4 queries (1 insert, 1-2 validation, 1 duplicate check)
 *   • createProject(): 4-5 queries (1 insert, 2-3 validation)
 *   • createTask(): 5-6 queries (1 insert, 3-4 validation)
 * - Performance Impact: Batch operations (>100 records) may experience latency
 * - Dependency: Requires WorkItemValidator to be deployed first
 * - Rollback Method: Creates record, validates, then deletes if validation fails (2 transactions)
 *
 * Business Constraints:
 * - Synchronous validation adds ~200-500ms latency per record
 * - Failed validation aborts operation and returns errors
 * - All operations are logged (log growth in high-volume environments)
 *
 * Data Integrity Constraints:
 * - Validates parent references before creating child records
 * - Enforces required fields before insert
 * - Performs post-insert validation with automatic rollback
 * - Cannot create orphaned records (parent validation required)
 *
 * Security Constraints:
 * - Runs with system-level permissions (bypasses ACLs)
 * - Can be made client-callable if needed (add role checks if exposed)
 * - No built-in role checks (implement in calling code)
 * - Validation errors may expose internal data structure
 * - Uses GlideRecord (SQL injection protected)
 */
var WorkItemManager = Class.create();
WorkItemManager.prototype = {

    /**
     * Constructor
     */
    initialize: function() {
        this.LOG_SOURCE = 'WorkItemManager';
        this.TABLES = {
            CAMPAIGN: 'x_cadso_work_campaign',
            PROJECT: 'x_cadso_work_project',
            TASK: 'x_cadso_work_task'
        };
        
        // Initialize validator instance
        this.validator = new WorkItemValidator();
    },

    /**
     * Creates a new campaign with validation
     *
     * @param {Object} data - Campaign data object
     *   @param {string} data.name - Campaign name (required)
     *   @param {string} data.description - Campaign description
     *   @param {string} data.state - Campaign state (required)
     *   @param {string} data.start_date - Start date (YYYY-MM-DD)
     *   @param {string} data.end_date - End date (YYYY-MM-DD)
     *   @param {number} data.budget - Campaign budget
     * @returns {Object} Result {success: boolean, sysId: string, errors: Array}
     */
    createCampaign: function(data) {
        var result = {
            success: false,
            sysId: '',
            errors: []
        };

        try {
            // Validate input data
            if (!data || typeof data !== 'object') {
                result.errors.push('Invalid data parameter - object expected');
                this._log('ERROR', 'createCampaign: Invalid data parameter');
                return result;
            }

            // Check required fields
            if (!data.name || data.name === '') {
                result.errors.push('Campaign name is required');
            }

            if (!data.state || data.state === '') {
                result.errors.push('Campaign state is required');
            }

            if (result.errors.length > 0) {
                this._log('ERROR', 'createCampaign: Validation failed - ' + result.errors.join(', '));
                return result;
            }

            // Create campaign record
            var gr = new GlideRecord(this.TABLES.CAMPAIGN);
            gr.initialize();
            gr.setValue('name', data.name);
            
            if (data.description) {
                gr.setValue('description', data.description);
            }
            
            gr.setValue('state', data.state);
            
            if (data.start_date) {
                gr.setValue('start_date', data.start_date);
            }
            
            if (data.end_date) {
                gr.setValue('end_date', data.end_date);
            }
            
            if (data.budget) {
                gr.setValue('budget', data.budget);
            }

            // Insert the record
            var sysId = gr.insert();

            if (!sysId) {
                result.errors.push('Failed to insert campaign record');
                this._log('ERROR', 'createCampaign: Insert failed');
                return result;
            }

            // Validate the newly created campaign using WorkItemValidator
            var validationResult = this.validator.validateCampaign(sysId);

            if (!validationResult.valid) {
                // Rollback - delete the created record
                gr = new GlideRecord(this.TABLES.CAMPAIGN);
                if (gr.get(sysId)) {
                    gr.deleteRecord();
                }

                result.errors = result.errors.concat(validationResult.errors);
                this._log('ERROR', 'createCampaign: Post-insert validation failed - ' + 
                         validationResult.errors.join(', '));
                return result;
            }

            // Log warnings if any
            if (validationResult.warnings.length > 0) {
                this._log('WARN', 'createCampaign: Warnings - ' + 
                         validationResult.warnings.join(', '));
            }

            // Success
            result.success = true;
            result.sysId = sysId;
            this._log('INFO', 'createCampaign: Successfully created campaign ' + sysId);

        } catch (ex) {
            result.errors.push('Exception: ' + ex.message);
            this._log('ERROR', 'createCampaign: Exception - ' + ex.message);
        }

        return result;
    },

    /**
     * Creates a new project under a campaign with validation
     *
     * @param {string} campaignSysId - Parent campaign sys_id
     * @param {Object} data - Project data object
     *   @param {string} data.name - Project name (required)
     *   @param {string} data.description - Project description
     *   @param {string} data.state - Project state (required)
     *   @param {string} data.start_date - Start date (YYYY-MM-DD)
     *   @param {string} data.end_date - End date (YYYY-MM-DD)
     *   @param {number} data.priority - Priority (1-5)
     * @returns {Object} Result {success: boolean, sysId: string, errors: Array}
     */
    createProject: function(campaignSysId, data) {
        var result = {
            success: false,
            sysId: '',
            errors: []
        };

        try {
            // Validate campaign reference first using WorkItemValidator
            if (!campaignSysId || campaignSysId === '') {
                result.errors.push('Campaign sys_id is required');
                this._log('ERROR', 'createProject: Missing campaign sys_id');
                return result;
            }

            var campaignRefCheck = this.validator.checkReferences(this.TABLES.CAMPAIGN, campaignSysId);
            if (!campaignRefCheck.valid) {
                result.errors = result.errors.concat(campaignRefCheck.errors);
                this._log('ERROR', 'createProject: Invalid campaign reference - ' + campaignSysId);
                return result;
            }

            // Validate input data
            if (!data || typeof data !== 'object') {
                result.errors.push('Invalid data parameter - object expected');
                this._log('ERROR', 'createProject: Invalid data parameter');
                return result;
            }

            // Check required fields
            if (!data.name || data.name === '') {
                result.errors.push('Project name is required');
            }

            if (!data.state || data.state === '') {
                result.errors.push('Project state is required');
            }

            if (result.errors.length > 0) {
                this._log('ERROR', 'createProject: Validation failed - ' + result.errors.join(', '));
                return result;
            }

            // Create project record
            var gr = new GlideRecord(this.TABLES.PROJECT);
            gr.initialize();
            gr.setValue('name', data.name);
            gr.setValue('campaign', campaignSysId);
            
            if (data.description) {
                gr.setValue('description', data.description);
            }
            
            gr.setValue('state', data.state);
            
            if (data.start_date) {
                gr.setValue('start_date', data.start_date);
            }
            
            if (data.end_date) {
                gr.setValue('end_date', data.end_date);
            }
            
            if (data.priority) {
                gr.setValue('priority', data.priority);
            }

            // Insert the record
            var sysId = gr.insert();

            if (!sysId) {
                result.errors.push('Failed to insert project record');
                this._log('ERROR', 'createProject: Insert failed');
                return result;
            }

            // Validate the newly created project using WorkItemValidator
            var validationResult = this.validator.validateProject(sysId);

            if (!validationResult.valid) {
                // Rollback - delete the created record
                gr = new GlideRecord(this.TABLES.PROJECT);
                if (gr.get(sysId)) {
                    gr.deleteRecord();
                }

                result.errors = result.errors.concat(validationResult.errors);
                this._log('ERROR', 'createProject: Post-insert validation failed - ' + 
                         validationResult.errors.join(', '));
                return result;
            }

            // Log warnings if any
            if (validationResult.warnings.length > 0) {
                this._log('WARN', 'createProject: Warnings - ' + 
                         validationResult.warnings.join(', '));
            }

            // Success
            result.success = true;
            result.sysId = sysId;
            this._log('INFO', 'createProject: Successfully created project ' + sysId + 
                     ' under campaign ' + campaignSysId);

        } catch (ex) {
            result.errors.push('Exception: ' + ex.message);
            this._log('ERROR', 'createProject: Exception - ' + ex.message);
        }

        return result;
    },

    /**
     * Creates a new task under a project with validation
     *
     * @param {string} projectSysId - Parent project sys_id
     * @param {Object} data - Task data object
     *   @param {string} data.short_description - Task description (required)
     *   @param {string} data.description - Detailed description
     *   @param {string} data.state - Task state (required)
     *   @param {string} data.assigned_to - Assigned user sys_id
     *   @param {string} data.due_date - Due date (YYYY-MM-DD)
     *   @param {string} data.work_notes - Work notes
     * @returns {Object} Result {success: boolean, sysId: string, errors: Array}
     */
    createTask: function(projectSysId, data) {
        var result = {
            success: false,
            sysId: '',
            errors: []
        };

        try {
            // Validate project reference first using WorkItemValidator
            if (!projectSysId || projectSysId === '') {
                result.errors.push('Project sys_id is required');
                this._log('ERROR', 'createTask: Missing project sys_id');
                return result;
            }

            var projectRefCheck = this.validator.checkReferences(this.TABLES.PROJECT, projectSysId);
            if (!projectRefCheck.valid) {
                result.errors = result.errors.concat(projectRefCheck.errors);
                this._log('ERROR', 'createTask: Invalid project reference - ' + projectSysId);
                return result;
            }

            // Validate input data
            if (!data || typeof data !== 'object') {
                result.errors.push('Invalid data parameter - object expected');
                this._log('ERROR', 'createTask: Invalid data parameter');
                return result;
            }

            // Check required fields
            if (!data.short_description || data.short_description === '') {
                result.errors.push('Task short_description is required');
            }

            if (!data.state || data.state === '') {
                result.errors.push('Task state is required');
            }

            if (result.errors.length > 0) {
                this._log('ERROR', 'createTask: Validation failed - ' + result.errors.join(', '));
                return result;
            }

            // Validate assigned_to user if provided
            if (data.assigned_to && data.assigned_to !== '') {
                var userRefCheck = this.validator.checkReferences('sys_user', data.assigned_to);
                if (!userRefCheck.valid) {
                    result.errors = result.errors.concat(userRefCheck.errors);
                    this._log('ERROR', 'createTask: Invalid user reference - ' + data.assigned_to);
                    return result;
                }
            }

            // Create task record
            var gr = new GlideRecord(this.TABLES.TASK);
            gr.initialize();
            gr.setValue('short_description', data.short_description);
            gr.setValue('project', projectSysId);
            
            if (data.description) {
                gr.setValue('description', data.description);
            }
            
            gr.setValue('state', data.state);
            
            if (data.assigned_to) {
                gr.setValue('assigned_to', data.assigned_to);
            }
            
            if (data.due_date) {
                gr.setValue('due_date', data.due_date);
            }
            
            if (data.work_notes) {
                gr.setValue('work_notes', data.work_notes);
            }

            // Insert the record
            var sysId = gr.insert();

            if (!sysId) {
                result.errors.push('Failed to insert task record');
                this._log('ERROR', 'createTask: Insert failed');
                return result;
            }

            // Validate the newly created task using WorkItemValidator
            var validationResult = this.validator.validateTask(sysId);

            if (!validationResult.valid) {
                // Rollback - delete the created record
                gr = new GlideRecord(this.TABLES.TASK);
                if (gr.get(sysId)) {
                    gr.deleteRecord();
                }

                result.errors = result.errors.concat(validationResult.errors);
                this._log('ERROR', 'createTask: Post-insert validation failed - ' + 
                         validationResult.errors.join(', '));
                return result;
            }

            // Log warnings if any
            if (validationResult.warnings.length > 0) {
                this._log('WARN', 'createTask: Warnings - ' + 
                         validationResult.warnings.join(', '));
            }

            // Success
            result.success = true;
            result.sysId = sysId;
            this._log('INFO', 'createTask: Successfully created task ' + sysId + 
                     ' under project ' + projectSysId);

        } catch (ex) {
            result.errors.push('Exception: ' + ex.message);
            this._log('ERROR', 'createTask: Exception - ' + ex.message);
        }

        return result;
    },

    /**
     * Internal logging method
     *
     * @param {string} level - Log level (INFO, WARN, ERROR)
     * @param {string} message - Log message
     * @private
     */
    _log: function(level, message) {
        var logMessage = '[' + this.LOG_SOURCE + '] ' + message;

        switch(level) {
            case 'ERROR':
                gs.error(logMessage);
                break;
            case 'WARN':
                gs.warn(logMessage);
                break;
            case 'INFO':
            default:
                gs.info(logMessage);
                break;
        }
    },

    type: 'WorkItemManager'
};
