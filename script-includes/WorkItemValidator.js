/**
 * WorkItemValidator Script Include
 *
 * Purpose: Validates work items (campaigns, projects, tasks) ensuring data integrity
 * Type: Server-side Script Include
 * Tables Accessed: x_cadso_work_campaign, x_cadso_work_project, x_cadso_work_task
 *
 * @class WorkItemValidator
 *
 * POTENTIAL ISSUES & CONSTRAINTS:
 *
 * Technical Constraints:
 * - Query Overhead: Each validation requires 1-3 database queries
 * - GlideDBObjectManager dependency for table validation (may not detect all custom tables)
 * - Runs with system-level permissions (bypasses ACLs)
 *
 * Business Constraints:
 * - Validation is synchronous (~100-200ms per operation)
 * - Logs all validation events (log growth in high-volume environments)
 *
 * Data Integrity Constraints:
 * - Enforces required fields: name, state
 * - Validates date ranges: start_date must be before end_date
 * - Validates budget: cannot be negative
 * - Validates priority: must be 1-5 for projects
 * - Enforces referential integrity via checkReferences()
 *
 * Security Constraints:
 * - NOT client-callable (must remain server-side only)
 * - No built-in role checks (implement in calling code)
 * - Error messages may expose sys_id values
 * - Uses GlideRecord (SQL injection protected)
 */
var WorkItemValidator = Class.create();
WorkItemValidator.prototype = {

    /**
     * Constructor
     */
    initialize: function() {
        this.LOG_SOURCE = 'WorkItemValidator';
        this.TABLES = {
            CAMPAIGN: 'x_cadso_work_campaign',
            PROJECT: 'x_cadso_work_project',
            TASK: 'x_cadso_work_task'
        };
    },

    /**
     * Validates campaign data
     *
     * @param {string} campaignSysId - System ID of the campaign to validate
     * @returns {Object} Validation result {valid: boolean, errors: Array, warnings: Array}
     */
    validateCampaign: function(campaignSysId) {
        var result = {
            valid: true,
            errors: [],
            warnings: []
        };

        try {
            // Validate sys_id parameter
            if (!campaignSysId || campaignSysId === '') {
                result.valid = false;
                result.errors.push('Campaign sys_id is required');
                this._log('ERROR', 'validateCampaign: Missing sys_id parameter');
                return result;
            }

            // Retrieve campaign record
            var gr = new GlideRecord(this.TABLES.CAMPAIGN);
            if (!gr.get(campaignSysId)) {
                result.valid = false;
                result.errors.push('Campaign not found: ' + campaignSysId);
                this._log('ERROR', 'validateCampaign: Campaign not found - ' + campaignSysId);
                return result;
            }

            // Validate required fields
            if (!gr.getValue('name') || gr.getValue('name') === '') {
                result.valid = false;
                result.errors.push('Campaign name is required');
            }

            if (!gr.getValue('description') || gr.getValue('description') === '') {
                result.warnings.push('Campaign description is empty - recommended to provide description');
            }

            // Validate state field
            var state = gr.getValue('state');
            if (!state || state === '') {
                result.valid = false;
                result.errors.push('Campaign state is required');
            }

            // Validate dates if present
            var startDate = gr.getValue('start_date');
            var endDate = gr.getValue('end_date');

            if (startDate && endDate) {
                var start = new GlideDateTime(startDate);
                var end = new GlideDateTime(endDate);

                if (start.after(end)) {
                    result.valid = false;
                    result.errors.push('Campaign start date must be before end date');
                }
            }

            // Check for duplicate campaign names (warning only)
            var dupCheck = new GlideRecord(this.TABLES.CAMPAIGN);
            dupCheck.addQuery('name', gr.getValue('name'));
            dupCheck.addQuery('sys_id', '!=', campaignSysId);
            dupCheck.query();

            if (dupCheck.hasNext()) {
                result.warnings.push('Another campaign with the same name exists');
            }

            // Validate budget if present
            var budget = gr.getValue('budget');
            if (budget && parseFloat(budget) < 0) {
                result.valid = false;
                result.errors.push('Campaign budget cannot be negative');
            }

            this._log('INFO', 'validateCampaign: Campaign ' + campaignSysId + ' validation ' +
                     (result.valid ? 'passed' : 'failed') +
                     ' - Errors: ' + result.errors.length +
                     ', Warnings: ' + result.warnings.length);

        } catch (ex) {
            result.valid = false;
            result.errors.push('Validation error: ' + ex.message);
            this._log('ERROR', 'validateCampaign: Exception - ' + ex.message);
        }

        return result;
    },

    /**
     * Validates project data
     *
     * @param {string} projectSysId - System ID of the project to validate
     * @returns {Object} Validation result {valid: boolean, errors: Array, warnings: Array}
     */
    validateProject: function(projectSysId) {
        var result = {
            valid: true,
            errors: [],
            warnings: []
        };

        try {
            // Validate sys_id parameter
            if (!projectSysId || projectSysId === '') {
                result.valid = false;
                result.errors.push('Project sys_id is required');
                this._log('ERROR', 'validateProject: Missing sys_id parameter');
                return result;
            }

            // Retrieve project record
            var gr = new GlideRecord(this.TABLES.PROJECT);
            if (!gr.get(projectSysId)) {
                result.valid = false;
                result.errors.push('Project not found: ' + projectSysId);
                this._log('ERROR', 'validateProject: Project not found - ' + projectSysId);
                return result;
            }

            // Validate required fields
            if (!gr.getValue('name') || gr.getValue('name') === '') {
                result.valid = false;
                result.errors.push('Project name is required');
            }

            if (!gr.getValue('state') || gr.getValue('state') === '') {
                result.valid = false;
                result.errors.push('Project state is required');
            }

            // Validate parent campaign reference
            var campaignSysId = gr.getValue('campaign');
            if (!campaignSysId || campaignSysId === '') {
                result.valid = false;
                result.errors.push('Project must be associated with a campaign');
            } else {
                // Use checkReferences to validate parent campaign
                var refResult = this.checkReferences(this.TABLES.CAMPAIGN, campaignSysId);
                if (!refResult.valid) {
                    result.valid = false;
                    result.errors.push('Invalid campaign reference: ' + refResult.errors.join(', '));
                }
            }

            // Validate dates if present
            var startDate = gr.getValue('start_date');
            var endDate = gr.getValue('end_date');

            if (startDate && endDate) {
                var start = new GlideDateTime(startDate);
                var end = new GlideDateTime(endDate);

                if (start.after(end)) {
                    result.valid = false;
                    result.errors.push('Project start date must be before end date');
                }
            }

            // Validate priority if present
            var priority = gr.getValue('priority');
            if (priority && (parseInt(priority) < 1 || parseInt(priority) > 5)) {
                result.valid = false;
                result.errors.push('Project priority must be between 1 and 5');
            }

            this._log('INFO', 'validateProject: Project ' + projectSysId + ' validation ' +
                     (result.valid ? 'passed' : 'failed') +
                     ' - Errors: ' + result.errors.length +
                     ', Warnings: ' + result.warnings.length);

        } catch (ex) {
            result.valid = false;
            result.errors.push('Validation error: ' + ex.message);
            this._log('ERROR', 'validateProject: Exception - ' + ex.message);
        }

        return result;
    },

    /**
     * Validates task data
     *
     * @param {string} taskSysId - System ID of the task to validate
     * @returns {Object} Validation result {valid: boolean, errors: Array, warnings: Array}
     */
    validateTask: function(taskSysId) {
        var result = {
            valid: true,
            errors: [],
            warnings: []
        };

        try {
            // Validate sys_id parameter
            if (!taskSysId || taskSysId === '') {
                result.valid = false;
                result.errors.push('Task sys_id is required');
                this._log('ERROR', 'validateTask: Missing sys_id parameter');
                return result;
            }

            // Retrieve task record
            var gr = new GlideRecord(this.TABLES.TASK);
            if (!gr.get(taskSysId)) {
                result.valid = false;
                result.errors.push('Task not found: ' + taskSysId);
                this._log('ERROR', 'validateTask: Task not found - ' + taskSysId);
                return result;
            }

            // Validate required fields
            if (!gr.getValue('short_description') || gr.getValue('short_description') === '') {
                result.valid = false;
                result.errors.push('Task short description is required');
            }

            if (!gr.getValue('state') || gr.getValue('state') === '') {
                result.valid = false;
                result.errors.push('Task state is required');
            }

            // Validate parent project reference
            var projectSysId = gr.getValue('project');
            if (!projectSysId || projectSysId === '') {
                result.valid = false;
                result.errors.push('Task must be associated with a project');
            } else {
                // Use checkReferences to validate parent project
                var refResult = this.checkReferences(this.TABLES.PROJECT, projectSysId);
                if (!refResult.valid) {
                    result.valid = false;
                    result.errors.push('Invalid project reference: ' + refResult.errors.join(', '));
                }
            }

            // Validate assigned_to reference if present
            var assignedTo = gr.getValue('assigned_to');
            if (assignedTo && assignedTo !== '') {
                var refResult = this.checkReferences('sys_user', assignedTo);
                if (!refResult.valid) {
                    result.valid = false;
                    result.errors.push('Invalid assigned_to user: ' + refResult.errors.join(', '));
                }
            } else {
                result.warnings.push('Task has no assigned user');
            }

            // Validate dates if present
            var dueDate = gr.getValue('due_date');
            if (dueDate) {
                var due = new GlideDateTime(dueDate);
                var now = new GlideDateTime();

                if (due.before(now)) {
                    result.warnings.push('Task due date is in the past');
                }
            }

            // Validate work notes length
            var workNotes = gr.getValue('work_notes');
            if (workNotes && workNotes.length > 4000) {
                result.warnings.push('Work notes exceed recommended length');
            }

            this._log('INFO', 'validateTask: Task ' + taskSysId + ' validation ' +
                     (result.valid ? 'passed' : 'failed') +
                     ' - Errors: ' + result.errors.length +
                     ', Warnings: ' + result.warnings.length);

        } catch (ex) {
            result.valid = false;
            result.errors.push('Validation error: ' + ex.message);
            this._log('ERROR', 'validateTask: Exception - ' + ex.message);
        }

        return result;
    },

    /**
     * Validates reference integrity for a record
     *
     * @param {string} tableName - Table name to check
     * @param {string} sysId - System ID of the record to validate
     * @returns {Object} Validation result {valid: boolean, errors: Array, warnings: Array}
     */
    checkReferences: function(tableName, sysId) {
        var result = {
            valid: true,
            errors: [],
            warnings: []
        };

        try {
            // Validate parameters
            if (!tableName || tableName === '') {
                result.valid = false;
                result.errors.push('Table name is required');
                this._log('ERROR', 'checkReferences: Missing table name');
                return result;
            }

            if (!sysId || sysId === '') {
                result.valid = false;
                result.errors.push('System ID is required');
                this._log('ERROR', 'checkReferences: Missing sys_id for table ' + tableName);
                return result;
            }

            // Check if table exists
            if (!GlideDBObjectManager.get().isValidTable(tableName)) {
                result.valid = false;
                result.errors.push('Invalid table name: ' + tableName);
                this._log('ERROR', 'checkReferences: Invalid table - ' + tableName);
                return result;
            }

            // Check if record exists
            var gr = new GlideRecord(tableName);
            if (!gr.get(sysId)) {
                result.valid = false;
                result.errors.push('Record not found in table ' + tableName + ': ' + sysId);
                this._log('ERROR', 'checkReferences: Record not found - ' + tableName + '/' + sysId);
                return result;
            }

            // Check if record is active (if table has active field)
            if (gr.isValidField('active')) {
                if (gr.getValue('active') === 'false' || gr.getValue('active') === '0') {
                    result.warnings.push('Referenced record is inactive: ' + tableName + '/' + sysId);
                }
            }

            this._log('INFO', 'checkReferences: Reference validation ' +
                     (result.valid ? 'passed' : 'failed') +
                     ' for ' + tableName + '/' + sysId);

        } catch (ex) {
            result.valid = false;
            result.errors.push('Reference check error: ' + ex.message);
            this._log('ERROR', 'checkReferences: Exception - ' + ex.message);
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

    type: 'WorkItemValidator'
};
