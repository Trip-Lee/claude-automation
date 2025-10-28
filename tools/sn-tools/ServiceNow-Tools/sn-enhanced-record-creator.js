#!/usr/bin/env node

/**
 * Enhanced ServiceNow Record Creator with Auto Field Discovery
 *
 * This module enhances record creation by automatically discovering all fields
 * for a table using the TableFieldMapper, prompting for mandatory fields,
 * and allowing optional input for non-mandatory fields.
 *
 * Features:
 * - Automatic field discovery with inheritance support
 * - Mandatory field validation (cannot be empty)
 * - Optional field prompting (can be left empty)
 * - Choice field handling with dropdown options
 * - Reference field suggestions
 * - Field type validation
 *
 * Author: ServiceNow Tools
 * Version: 1.0.0
 */

const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const https = require('https');
const path = require('path');
const { TableFieldMapper } = require('./sn-table-field-mapper');
const { FieldValidator } = require('./sn-field-validator');

class EnhancedRecordCreator {
    constructor(serviceNowTools = null) {
        this.tools = serviceNowTools;
        this.mapper = new TableFieldMapper();
        this.validator = new FieldValidator();

        // Field types that should be skipped in user input
        this.systemFields = [
            'sys_id', 'sys_created_on', 'sys_created_by', 'sys_updated_on', 'sys_updated_by',
            'sys_mod_count', 'sys_domain', 'sys_tags'
        ];

        // Field types that are complex and should be handled specially
        this.complexFieldTypes = [
            'reference', 'glide_list', 'glide_date_time', 'glide_date',
            'glide_time', 'choice', 'journal', 'journal_input'
        ];
    }

    /**
     * Select which instance to use for field discovery
     * @param {string} tableName - The table name
     * @returns {Promise<string>} Selected instance key
     */
    async selectInstance(tableName) {
        if (!this.tools || !this.tools.config) {
            return null;
        }

        const config = this.tools.config;
        const instances = config.instances || {};
        const instanceKeys = Object.keys(instances);

        if (instanceKeys.length === 0) {
            console.log(chalk.yellow('⚠️  No instances configured'));
            return null;
        }

        // Get default from routing
        const routedInstance = config.routing?.tables?.[tableName] || config.routing?.default || instanceKeys[0];

        // If only one instance, use it
        if (instanceKeys.length === 1) {
            console.log(chalk.blue(`📡 Using instance: ${chalk.white(routedInstance)}`));
            return routedInstance;
        }

        // Prompt user to select instance
        const choices = instanceKeys.map(key => ({
            name: `${key} (${instances[key].instance})${key === routedInstance ? ' [default]' : ''}`,
            value: key,
            short: key
        }));

        const { selectedInstance } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedInstance',
                message: `Select instance to fetch fields from for table ${chalk.cyan(tableName)}:`,
                choices: choices,
                default: routedInstance
            }
        ]);

        return selectedInstance;
    }

    /**
     * Make an HTTPS request to ServiceNow
     * @private
     */
    async _makeRequest(instanceConfig, path) {
        const auth = Buffer.from(`${instanceConfig.username}:${instanceConfig.password}`).toString('base64');

        const options = {
            hostname: instanceConfig.instance,
            path: path,
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            timeout: 15000
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.end();
        });
    }

    /**
     * Get inheritance chain for a table from ServiceNow
     * @private
     */
    async _getTableInheritanceChain(tableName, instanceConfig) {
        try {
            const queryParams = new URLSearchParams({
                sysparm_query: `name=${tableName}`,
                sysparm_fields: 'name,super_class,label',
                sysparm_display_value: 'all' // Get both value and display_value
            });

            const response = await this._makeRequest(
                instanceConfig,
                `/api/now/table/sys_db_object?${queryParams.toString()}`
            );

            if (response && response.result && response.result.length > 0) {
                const tableData = response.result[0];
                const chain = [tableName];

                // Extract super_class - use display_value which contains the table name
                let superClass = null;
                if (tableData.super_class) {
                    if (typeof tableData.super_class === 'object') {
                        // Prefer display_value (table name) over value (sys_id)
                        superClass = tableData.super_class.display_value || tableData.super_class.value;
                    } else if (typeof tableData.super_class === 'string') {
                        superClass = tableData.super_class;
                    }
                }

                // Recursively get parent tables
                if (superClass && superClass !== tableName && superClass !== '') {
                    const parentChain = await this._getTableInheritanceChain(superClass, instanceConfig);
                    chain.push(...parentChain);
                }

                return chain;
            }

            return [tableName];
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not fetch inheritance for ${tableName}: ${error.message}`));
            return [tableName];
        }
    }

    /**
     * Fetch table schema directly from ServiceNow API with inheritance
     * @param {string} tableName - The table name
     * @param {string} instanceKey - Optional specific instance to use
     * @returns {Promise<Array>} Array of field definitions
     */
    async fetchTableSchemaFromAPI(tableName, instanceKey = null) {
        if (!this.tools) {
            return null;
        }

        try {
            const config = this.tools.config;
            if (!config || !config.routing || !config.instances) {
                return null;
            }

            // Determine which instance to query
            const targetInstanceKey = instanceKey || config.routing.tables?.[tableName] || config.routing.default || 'dev';
            const instanceConfig = config.instances[targetInstanceKey];

            if (!instanceConfig) {
                console.log(chalk.yellow(`⚠️  No instance config found for: ${targetInstanceKey}`));
                return null;
            }

            console.log(chalk.blue(`🌐 Fetching live schema from ${chalk.white(targetInstanceKey)} instance (${instanceConfig.instance})...`));

            // Step 1: Get inheritance chain
            const spinner = ora({
                text: chalk.blue('Discovering table inheritance...'),
                spinner: 'dots',
                color: 'blue'
            }).start();

            const inheritanceChain = await this._getTableInheritanceChain(tableName, instanceConfig);

            if (inheritanceChain.length > 1) {
                spinner.succeed(chalk.green(`✓ Found inheritance chain: ${inheritanceChain.join(' → ')}`));
            } else {
                spinner.succeed(chalk.green(`✓ No parent tables found`));
            }

            // Step 2: Query sys_dictionary for ALL tables in chain
            const fieldSpinner = ora({
                text: chalk.blue(`Fetching fields for ${inheritanceChain.length} table(s)...`),
                spinner: 'dots',
                color: 'blue'
            }).start();

            // Build query: name=table1^ORname=table2^ORname=table3
            const tableQuery = inheritanceChain.map(t => `name=${t}`).join('^OR');

            const queryParams = new URLSearchParams({
                sysparm_query: `${tableQuery}^ORDERBYname^ORDERBYelement`,
                sysparm_limit: 5000,
                sysparm_fields: 'name,element,column_label,internal_type,max_length,mandatory,reference,read_only,active,default_value',
                sysparm_display_value: 'false'
            });

            const response = await this._makeRequest(
                instanceConfig,
                `/api/now/table/sys_dictionary?${queryParams.toString()}`
            );

            if (response && response.result && response.result.length > 0) {
                fieldSpinner.succeed(chalk.green(`✓ Retrieved ${response.result.length} fields from API (including inherited)`));

                // Track seen fields to handle overrides
                const seenFields = new Map();

                // Group fields by table for ordered processing
                const fieldsByTable = new Map();
                for (const field of response.result) {
                    // Handle both object and string formats for field.name
                    let fieldTable = field.name;
                    if (typeof fieldTable === 'object' && fieldTable.value) {
                        fieldTable = fieldTable.value;
                    }

                    if (!fieldsByTable.has(fieldTable)) {
                        fieldsByTable.set(fieldTable, []);
                    }
                    fieldsByTable.get(fieldTable).push(field);
                }

                // Process fields in inheritance order: child table FIRST, then parents
                // This ensures child table field definitions override parent definitions
                for (const currentTable of inheritanceChain) {
                    const tableFields = fieldsByTable.get(currentTable) || [];

                    for (const field of tableFields) {
                        // Extract field values - handle both object and string formats
                        const fieldElement = typeof field.element === 'object' ? field.element.value : field.element;

                        // Only add field if we haven't seen it yet
                        // Since we process child first, child table fields take precedence
                        if (!seenFields.has(fieldElement)) {
                            const isInherited = currentTable !== tableName;

                            seenFields.set(fieldElement, {
                                table: currentTable,
                                element: fieldElement,
                                column_label: typeof field.column_label === 'object' ? field.column_label.value : field.column_label,
                                internal_type: typeof field.internal_type === 'object' ? field.internal_type.value : field.internal_type,
                                max_length: typeof field.max_length === 'object' ? field.max_length.value : field.max_length,
                                mandatory: field.mandatory === 'true' || field.mandatory === true || (typeof field.mandatory === 'object' && field.mandatory.value === 'true'),
                                reference: field.reference ? (typeof field.reference === 'object' ? field.reference.value : field.reference) : null,
                                read_only: field.read_only === 'true' || field.read_only === true || (typeof field.read_only === 'object' && field.read_only.value === 'true'),
                                active: field.active !== 'false' && field.active !== false && !(typeof field.active === 'object' && field.active.value === 'false'),
                                default_value: typeof field.default_value === 'object' ? field.default_value.value : field.default_value,
                                is_inherited: isInherited,
                                inherited_from: isInherited ? currentTable : null
                            });
                        }
                        // If field already exists, it means child table overrode it - skip parent's version
                    }
                }

                const allFields = Array.from(seenFields.values());

                // Show breakdown
                const directFields = allFields.filter(f => !f.is_inherited).length;
                const inheritedFields = allFields.filter(f => f.is_inherited).length;
                const overriddenCount = response.result.length - allFields.length;

                console.log(chalk.blue(`   📋 ${directFields} direct fields, ${inheritedFields} inherited fields`));
                if (overriddenCount > 0) {
                    console.log(chalk.gray(`   🔄 ${overriddenCount} field(s) overridden by child table`));
                }

                return allFields;
            }

            fieldSpinner.fail(chalk.yellow('No fields found'));
            return null;
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not fetch schema from API: ${error.message}`));
            return null;
        }
    }

    /**
     * Check if table data exists in fetched data
     * @param {string} tableName - The table name
     * @returns {Promise<boolean>}
     */
    async checkFetchedData(tableName) {
        try {
            const dataPath = this.mapper.dataPath;
            const dictionaryPath = path.join(dataPath, 'sys_dictionary');

            if (!require('fs').existsSync(dictionaryPath)) {
                return false;
            }

            // Check if we have dictionary data for this table
            const scopes = await require('fs').promises.readdir(dictionaryPath);
            for (const scope of scopes) {
                const scopePath = path.join(dictionaryPath, scope);
                const stat = await require('fs').promises.stat(scopePath);

                if (stat.isDirectory()) {
                    const files = await require('fs').promises.readdir(scopePath);
                    // Look for files that contain the table name
                    const tableFiles = files.filter(f =>
                        f.includes(tableName) && f.endsWith('.json')
                    );

                    if (tableFiles.length > 0) {
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Fetch a specific record from ServiceNow API by sys_id
     * @param {string} tableName - The table name
     * @param {string} sysId - The sys_id of the record
     * @param {string} instanceKey - Optional specific instance to use
     * @returns {Promise<Object>} Record data
     */
    async fetchRecordByID(tableName, sysId, instanceKey = null) {
        if (!this.tools) {
            return null;
        }

        try {
            const config = this.tools.config;
            if (!config || !config.routing || !config.instances) {
                return null;
            }

            // Determine which instance to query
            const targetInstanceKey = instanceKey || config.routing.tables?.[tableName] || config.routing.default || 'dev';
            const instanceConfig = config.instances[targetInstanceKey];

            if (!instanceConfig) {
                console.log(chalk.yellow(`⚠️  No instance config found for: ${targetInstanceKey}`));
                return null;
            }

            console.log(chalk.blue(`🌐 Fetching record from ${chalk.white(targetInstanceKey)} instance...`));

            const spinner = ora({
                text: chalk.blue(`Retrieving ${tableName} record...`),
                spinner: 'dots',
                color: 'blue'
            }).start();

            const response = await this._makeRequest(
                instanceConfig,
                `/api/now/table/${tableName}/${sysId}`
            );

            if (response && response.result) {
                spinner.succeed(chalk.green(`✓ Record retrieved successfully`));
                return response.result;
            }

            spinner.fail(chalk.yellow('Record not found'));
            return null;
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not fetch record: ${error.message}`));
            return null;
        }
    }

    /**
     * Check if record exists in fetched data
     * @param {string} tableName - The table name
     * @param {string} sysId - The sys_id of the record
     * @returns {Promise<Object|null>} Record data if found, null otherwise
     */
    async checkRecordInFetchedData(tableName, sysId) {
        try {
            const dataPath = this.mapper.dataPath;
            const tablePath = path.join(dataPath, tableName);

            if (!require('fs').existsSync(tablePath)) {
                return null;
            }

            // Search through all scopes
            const scopes = await require('fs').promises.readdir(tablePath);
            for (const scope of scopes) {
                const scopePath = path.join(tablePath, scope);
                const stat = await require('fs').promises.stat(scopePath);

                if (stat.isDirectory()) {
                    const files = await require('fs').promises.readdir(scopePath);

                    // Look for file containing the sys_id
                    for (const file of files) {
                        if (file.endsWith('.json') && file.includes(sysId)) {
                            const filePath = path.join(scopePath, file);
                            const data = JSON.parse(
                                await require('fs').promises.readFile(filePath, 'utf8')
                            );

                            if (data.sys_id === sysId) {
                                return data;
                            }
                        }
                    }
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get all cached records for a table
     * @param {string} tableName - The table name
     * @returns {Promise<Array>} Array of cached records with display info
     */
    async getCachedRecordsForTable(tableName) {
        try {
            const dataPath = this.mapper.dataPath;
            const tablePath = path.join(dataPath, tableName);

            if (!require('fs').existsSync(tablePath)) {
                return [];
            }

            const records = [];
            const scopes = await require('fs').promises.readdir(tablePath);

            for (const scope of scopes) {
                const scopePath = path.join(tablePath, scope);
                const stat = await require('fs').promises.stat(scopePath);

                if (stat.isDirectory()) {
                    const files = await require('fs').promises.readdir(scopePath);

                    for (const file of files) {
                        if (file.endsWith('.json')) {
                            try {
                                const filePath = path.join(scopePath, file);
                                const data = JSON.parse(
                                    await require('fs').promises.readFile(filePath, 'utf8')
                                );

                                // Create display name from available fields
                                const display = data.name || data.number || data.short_description ||
                                              data.title || data.label || data.sys_id || 'Unnamed Record';

                                records.push({
                                    sys_id: data.sys_id,
                                    display: display,
                                    raw: data
                                });
                            } catch (error) {
                                // Skip invalid JSON files
                                continue;
                            }
                        }
                    }
                }
            }

            // Sort by display name
            records.sort((a, b) => a.display.localeCompare(b.display));

            return records;
        } catch (error) {
            return [];
        }
    }

    /**
     * Update a record with enhanced field discovery and prompting
     * @param {string} tableName - The table name
     * @param {string} sysId - The sys_id of the record to update
     * @param {Object} options - Update options
     * @returns {Promise<Object>} Update result
     */
    async updateRecordWithFieldDiscovery(tableName, sysId, options = {}) {
        const {
            skipOptionalFields = false,
            includeInheritedFields = true,
            autoConfirm = false,
            prefilledData = {},
            preferAPI = true,
            instanceKey = null
        } = options;

        try {
            // Prompt for instance selection if not provided
            let selectedInstance = instanceKey;

            if (!selectedInstance && this.tools && this.tools.config) {
                selectedInstance = await this.selectInstance(tableName);
            }

            console.log(chalk.blue(`\n🔍 Fetching record: ${chalk.white(tableName)} [${sysId}]`));
            if (selectedInstance) {
                console.log(chalk.gray(`   Instance: ${selectedInstance}`));
            }

            // Try to get record from fetched data first
            let currentRecord = null;

            if (!preferAPI) {
                console.log(chalk.blue('📦 Checking cached data...'));
                currentRecord = await this.checkRecordInFetchedData(tableName, sysId);

                if (currentRecord) {
                    console.log(chalk.green('✓ Record found in cached data'));
                }
            }

            // If not in cache or preferAPI, fetch from API
            if (!currentRecord) {
                currentRecord = await this.fetchRecordByID(tableName, sysId, selectedInstance);

                if (!currentRecord) {
                    console.log(chalk.red(`❌ Record not found: ${tableName} [${sysId}]`));
                    return null;
                }
            }

            // Show current record summary
            console.log(chalk.blue(`\n📋 Current Record:`));
            console.log(chalk.gray('═'.repeat(60)));
            if (currentRecord.name) {
                console.log(chalk.white(`  Name: ${currentRecord.name}`));
            }
            if (currentRecord.number) {
                console.log(chalk.white(`  Number: ${currentRecord.number}`));
            }
            console.log(chalk.gray(`  Last Updated: ${currentRecord.sys_updated_on || 'N/A'}`));
            console.log(chalk.gray('═'.repeat(60)));

            // Get field schema
            console.log(chalk.blue(`\n🔍 Discovering fields for table: ${chalk.white(tableName)}`));

            let fields = null;
            let dataSource = 'unknown';

            // Check if we have fetched data for schema
            const hasFetchedData = await this.checkFetchedData(tableName);

            if (hasFetchedData && !preferAPI) {
                console.log(chalk.blue('📦 Using cached field data...'));
                fields = await this.mapper.getFieldsForTable(tableName, includeInheritedFields);
                dataSource = 'cached';
            }

            // Try API if we prefer it or don't have cached data
            if (!fields || preferAPI) {
                const apiFields = await this.fetchTableSchemaFromAPI(tableName, selectedInstance);
                if (apiFields && apiFields.length > 0) {
                    fields = apiFields;
                    dataSource = 'api';
                }
            }

            // Fallback to cached data if API failed
            if (!fields && hasFetchedData) {
                console.log(chalk.yellow('⚠️  API fetch failed, falling back to cached data...'));
                fields = await this.mapper.getFieldsForTable(tableName, includeInheritedFields);
                dataSource = 'cached-fallback';
            }

            if (!fields || fields.length === 0) {
                console.log(chalk.yellow(`⚠️  No fields found for table: ${tableName}`));
                return null;
            }

            // Filter fields for user input
            const inputFields = this.filterFieldsForInput(fields);

            const sourceIndicator = dataSource === 'api' ? '🌐 Live API' :
                                  dataSource === 'cached' ? '📦 Cached' :
                                  dataSource === 'cached-fallback' ? '📦 Cached (fallback)' : '❓ Unknown';

            console.log(chalk.blue(`\n📋 Found ${chalk.white(inputFields.length)} user-editable fields (${fields.length} total) - Source: ${chalk.cyan(sourceIndicator)}`));

            // Ask user which fields they want to update
            console.log(chalk.blue(`\n✏️  Select fields to update:`));
            console.log(chalk.gray('   Use ↑↓ to navigate, Space to select/deselect, Enter to confirm\n'));

            // Group fields by category for better UX
            const groupedFields = this.groupFieldsByType(inputFields);
            const fieldChoices = [];

            // Add commonly updated fields first
            const commonFields = ['name', 'short_description', 'description', 'active', 'script'];
            const commonFieldsFound = inputFields.filter(f => commonFields.includes(f.element));

            if (commonFieldsFound.length > 0) {
                fieldChoices.push(new inquirer.Separator(chalk.cyan('━━━ Common Fields ━━━')));
                commonFieldsFound.forEach(field => {
                    const currentValue = currentRecord[field.element];
                    const valuePreview = currentValue
                        ? (typeof currentValue === 'string' && currentValue.length > 40
                            ? currentValue.substring(0, 40) + '...'
                            : currentValue)
                        : chalk.gray('(empty)');

                    const mandatory = field.mandatory ? chalk.red(' *') : '';
                    const type = chalk.gray(`[${field.internal_type}]`);

                    fieldChoices.push({
                        name: `${chalk.green(field.column_label || field.element)}${mandatory} ${type} ${chalk.gray('→')} ${valuePreview}`,
                        value: field.element,
                        short: field.element
                    });
                });
            }

            // Add remaining fields grouped by type
            const remainingFields = inputFields.filter(f => !commonFields.includes(f.element));
            const groupedRemaining = this.groupFieldsByType(remainingFields);

            for (const [groupName, groupFields] of Object.entries(groupedRemaining)) {
                if (groupFields.length > 0) {
                    const groupLabel = groupName.charAt(0).toUpperCase() + groupName.slice(1);
                    fieldChoices.push(new inquirer.Separator(chalk.cyan(`━━━ ${groupLabel} ━━━`)));

                    groupFields.forEach(field => {
                        const currentValue = currentRecord[field.element];
                        const valuePreview = currentValue
                            ? (typeof currentValue === 'string' && currentValue.length > 40
                                ? currentValue.substring(0, 40) + '...'
                                : currentValue)
                            : chalk.gray('(empty)');

                        const inherited = field.is_inherited ? chalk.gray(` [${field.inherited_from}]`) : '';
                        const mandatory = field.mandatory ? chalk.red(' *') : '';

                        fieldChoices.push({
                            name: `${chalk.green(field.column_label || field.element)}${mandatory}${inherited} ${chalk.gray('→')} ${valuePreview}`,
                            value: field.element,
                            short: field.element
                        });
                    });
                }
            }

            const { fieldsToUpdate } = await inquirer.prompt([
                {
                    type: 'checkbox',
                    name: 'fieldsToUpdate',
                    message: 'Select fields to update:',
                    choices: fieldChoices,
                    pageSize: 20,
                    loop: false
                }
            ]);

            if (fieldsToUpdate.length === 0) {
                console.log(chalk.yellow('No fields selected for update'));
                return null;
            }

            // Collect updated values
            const updateData = { ...prefilledData };

            console.log(chalk.blue(`\n📝 Updating ${fieldsToUpdate.length} field(s):`));

            for (const fieldElement of fieldsToUpdate) {
                const field = inputFields.find(f => f.element === fieldElement);
                const currentValue = currentRecord[fieldElement];

                // Show field header
                console.log(chalk.blue(`\n${'─'.repeat(60)}`));
                console.log(chalk.blue(`📝 Updating: ${chalk.white(field.column_label || field.element)}`));
                console.log(chalk.gray(`   Type: ${field.internal_type}`));

                // Show current value with better formatting
                if (currentValue) {
                    const displayValue = typeof currentValue === 'string' && currentValue.length > 200
                        ? currentValue.substring(0, 200) + chalk.gray('... (truncated)')
                        : currentValue;
                    console.log(chalk.gray(`   Current: ${displayValue}`));
                } else {
                    console.log(chalk.gray(`   Current: (empty)`));
                }

                // Ask if they want to keep current value (for optional fields)
                if (!field.mandatory && currentValue) {
                    const { keepCurrent } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'keepCurrent',
                            message: 'Keep current value?',
                            default: false
                        }
                    ]);

                    if (keepCurrent) {
                        console.log(chalk.gray('   ✓ Keeping current value (no change)'));
                        continue; // Skip to next field
                    }
                }

                const value = await this.promptForField(field, field.mandatory, selectedInstance);
                if (value !== null && value !== undefined && value !== '') {
                    updateData[fieldElement] = value;
                } else if (!field.mandatory) {
                    console.log(chalk.yellow('   ⊘ Skipping field (no value provided)'));
                }
            }

            // Show summary
            console.log(chalk.blue(`\n╔${'═'.repeat(78)}╗`));
            console.log(chalk.blue(`║ ${chalk.white.bold('Update Summary').padEnd(77)}║`));
            console.log(chalk.blue(`╠${'═'.repeat(78)}╣`));
            console.log(chalk.blue(`║ ${chalk.white('Table:')} ${chalk.cyan(tableName).padEnd(70)}║`));
            console.log(chalk.blue(`║ ${chalk.white('Sys ID:')} ${chalk.gray(sysId).padEnd(69)}║`));
            console.log(chalk.blue(`╚${'═'.repeat(78)}╝`));

            const updateCount = Object.keys(updateData).length;
            if (updateCount === 0) {
                console.log(chalk.yellow('\n  ⚠️  No fields to update - all changes were skipped'));
                return null;
            }

            console.log(chalk.white(`\n${updateCount} field(s) will be updated:\n`));

            Object.entries(updateData).forEach(([key, value], index) => {
                const field = inputFields.find(f => f.element === key);
                const fieldLabel = field?.column_label || key;
                const inherited = field?.is_inherited ? chalk.gray(` [from ${field.inherited_from}]`) : '';
                const mandatory = field?.mandatory ? chalk.red(' *') : '';

                const displayValue = typeof value === 'string' && value.length > 60
                    ? value.substring(0, 60) + chalk.gray('...')
                    : value;

                const oldValue = currentRecord[key];
                const oldDisplayValue = typeof oldValue === 'string' && oldValue.length > 60
                    ? oldValue.substring(0, 60) + chalk.gray('...')
                    : oldValue || chalk.gray('(empty)');

                console.log(chalk.white(`${index + 1}. ${chalk.bold(fieldLabel)}${mandatory}${inherited}`));
                console.log(chalk.gray(`   Field: ${key}`));
                console.log(chalk.red(`   ❌ Old: ${oldDisplayValue}`));
                console.log(chalk.green(`   ✅ New: ${displayValue}`));

                if (index < Object.keys(updateData).length - 1) {
                    console.log(chalk.gray(`   ${'-'.repeat(75)}`));
                }
            });

            console.log(''); // Empty line for spacing

            // Confirm update
            if (!autoConfirm) {
                const { confirmUpdate } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirmUpdate',
                        message: `Update record in ${tableName}?`,
                        default: true
                    }
                ]);

                if (!confirmUpdate) {
                    console.log(chalk.yellow('Record update cancelled'));
                    return null;
                }
            }

            // Perform the update using existing ServiceNowTools
            if (!this.tools) {
                console.log(chalk.red('❌ ServiceNowTools instance not provided. Cannot update record.'));
                return null;
            }

            // Perform the update with progress indicator
            const updateSpinner = ora({
                text: chalk.blue('Updating record in ServiceNow...'),
                spinner: 'dots',
                color: 'blue'
            }).start();

            try {
                const result = await this.performMultiFieldUpdate(tableName, sysId, updateData);
                updateSpinner.succeed(chalk.green('Record updated successfully!'));
                return result;
            } catch (error) {
                updateSpinner.fail(chalk.red('Update failed'));
                throw error;
            }

        } catch (error) {
            console.error(chalk.red(`❌ Error updating record: ${error.message}`));
            throw error;
        }
    }

    /**
     * Perform multi-field update
     * @private
     */
    async performMultiFieldUpdate(table, sysId, updateData) {
        const data = JSON.stringify(updateData);

        const config = this.tools.config;
        const targetInstanceKey = config.routing.tables?.[table] || config.routing.default || 'dev';
        const instanceConfig = config.instances[targetInstanceKey];

        const auth = Buffer.from(`${instanceConfig.username}:${instanceConfig.password}`).toString('base64');

        const options = {
            hostname: instanceConfig.instance,
            path: `/api/now/table/${table}/${sysId}`,
            method: 'PATCH',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            },
            timeout: 15000
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => { responseData += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);

                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            console.log(chalk.green('✓ Update successful!'));
                            console.log(chalk.gray(`Updated at: ${parsed.result.sys_updated_on}`));

                            resolve({
                                success: true,
                                instance: instanceConfig.instance,
                                sys_id: sysId,
                                updated_at: parsed.result.sys_updated_on,
                                record: parsed.result
                            });
                        } else {
                            reject(new Error(`Update failed: ${parsed.error?.message || 'Unknown error'}`));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(data);
            req.end();
        });
    }

    /**
     * Create a record with enhanced field discovery and prompting
     * @param {string} tableName - The table name
     * @param {Object} options - Creation options
     * @returns {Promise<Object>} Creation result
     */
    async createRecordWithFieldDiscovery(tableName, options = {}) {
        const {
            skipOptionalFields = false,
            includeInheritedFields = true,
            autoConfirm = false,
            prefilledData = {},
            preferAPI = true,  // Prefer API over cached data
            instanceKey = null  // Specific instance to use, if null will prompt or use routing
        } = options;

        try {
            // Prompt for instance selection if not provided
            let selectedInstance = instanceKey;

            if (!selectedInstance && this.tools && this.tools.config) {
                selectedInstance = await this.selectInstance(tableName);
            }

            console.log(chalk.blue(`\n🔍 Discovering fields for table: ${chalk.white(tableName)}`));
            if (selectedInstance) {
                console.log(chalk.gray(`   Instance: ${selectedInstance}`));
            }

            let fields = null;
            let dataSource = 'unknown';

            // Strategy 1: Check if we have fetched data for this table
            const hasFetchedData = await this.checkFetchedData(tableName);

            if (hasFetchedData && !preferAPI) {
                console.log(chalk.blue('📦 Using cached field data...'));
                const spinner = ora({
                    text: chalk.blue('Loading table fields from cache...'),
                    spinner: 'dots',
                    color: 'blue'
                }).start();

                fields = await this.mapper.getFieldsForTable(tableName, includeInheritedFields);
                spinner.stop();
                dataSource = 'cached';
            }

            // Strategy 2: Try API if we prefer it or don't have cached data
            if (!fields || preferAPI) {
                const spinner = ora({
                    text: chalk.blue('Fetching field schema from ServiceNow API...'),
                    spinner: 'dots',
                    color: 'blue'
                }).start();

                const apiFields = await this.fetchTableSchemaFromAPI(tableName, selectedInstance);
                spinner.stop();

                if (apiFields && apiFields.length > 0) {
                    fields = apiFields;
                    dataSource = 'api';
                }
            }

            // Strategy 3: Fallback to cached data if API failed
            if (!fields && hasFetchedData) {
                console.log(chalk.yellow('⚠️  API fetch failed, falling back to cached data...'));
                const spinner = ora({
                    text: chalk.blue('Loading table fields from cache...'),
                    spinner: 'dots',
                    color: 'blue'
                }).start();

                fields = await this.mapper.getFieldsForTable(tableName, includeInheritedFields);
                spinner.stop();
                dataSource = 'cached-fallback';
            }

            if (!fields || fields.length === 0) {
                console.log(chalk.yellow(`⚠️  No fields found for table: ${tableName}`));
                console.log(chalk.yellow(`   Tried: ${dataSource}`));
                return null;
            }

            // Filter fields for user input
            const inputFields = this.filterFieldsForInput(fields);

            // Show data source indicator
            const sourceIndicator = dataSource === 'api' ? '🌐 Live API' :
                                  dataSource === 'cached' ? '📦 Cached' :
                                  dataSource === 'cached-fallback' ? '📦 Cached (fallback)' : '❓ Unknown';

            console.log(chalk.blue(`\n📋 Found ${chalk.white(inputFields.length)} user-inputable fields (${fields.length} total) - Source: ${chalk.cyan(sourceIndicator)}`));

            // Separate mandatory and optional fields
            const mandatoryFields = inputFields.filter(field => field.mandatory && !prefilledData[field.element]);
            const optionalFields = inputFields.filter(field => !field.mandatory && !prefilledData[field.element]);

            console.log(chalk.blue(`\n📝 Field Summary:`));
            console.log(chalk.white(`  • ${chalk.red(mandatoryFields.length)} mandatory fields`));
            console.log(chalk.white(`  • ${chalk.green(optionalFields.length)} optional fields`));
            console.log(chalk.white(`  • ${chalk.gray(Object.keys(prefilledData).length)} pre-filled fields`));

            // Collect record data
            const recordData = { ...prefilledData };

            // Process mandatory fields first
            if (mandatoryFields.length > 0) {
                console.log(chalk.red(`\n🚨 Required Fields (cannot be empty):`));
                for (const field of mandatoryFields) {
                    const value = await this.promptForField(field, true, selectedInstance);
                    if (value !== null && value !== undefined && value !== '') {
                        recordData[field.element] = value;
                    }
                }
            }

            // Process optional fields
            if (optionalFields.length > 0 && !skipOptionalFields) {
                console.log(chalk.green(`\n✨ Optional Fields (press Enter to skip):`));

                // Ask if user wants to fill optional fields
                const { fillOptional } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'fillOptional',
                        message: `Fill optional fields? (${optionalFields.length} available)`,
                        default: false
                    }
                ]);

                if (fillOptional) {
                    // Group fields by type for better UX
                    const groupedFields = this.groupFieldsByType(optionalFields);

                    for (const [type, typeFields] of Object.entries(groupedFields)) {
                        if (typeFields.length > 0) {
                            console.log(chalk.blue(`\n📂 ${type.toUpperCase()} Fields:`));

                            for (const field of typeFields) {
                                const value = await this.promptForField(field, false, selectedInstance);
                                if (value !== null && value !== undefined && value !== '') {
                                    recordData[field.element] = value;
                                }
                            }
                        }
                    }
                }
            }

            // Show summary
            console.log(chalk.blue(`\n📋 Record Summary for ${chalk.white(tableName)}:`));
            console.log(chalk.gray('═'.repeat(60)));

            const fieldCount = Object.keys(recordData).length;
            if (fieldCount === 0) {
                console.log(chalk.yellow('  No fields provided'));
                return null;
            }

            Object.entries(recordData).forEach(([key, value]) => {
                const field = inputFields.find(f => f.element === key);
                const inherited = field?.is_inherited ? chalk.gray(` (from ${field.inherited_from})`) : '';
                const mandatory = field?.mandatory ? chalk.red(' *') : '';

                const displayValue = typeof value === 'string' && value.length > 50
                    ? value.substring(0, 50) + '...'
                    : value;

                console.log(chalk.white(`  ${chalk.green(key.padEnd(25))} ${displayValue}${mandatory}${inherited}`));
            });

            // Confirm creation
            if (!autoConfirm) {
                const { confirmCreate } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirmCreate',
                        message: `Create record in ${tableName}?`,
                        default: true
                    }
                ]);

                if (!confirmCreate) {
                    console.log(chalk.yellow('Record creation cancelled'));
                    return null;
                }
            }

            // Create the record using existing ServiceNowTools
            if (!this.tools) {
                console.log(chalk.red('❌ ServiceNowTools instance not provided. Cannot create record.'));
                return null;
            }

            console.log(chalk.blue('\n🚀 Creating record...'));
            const result = await this.tools.createRecord({
                table: tableName,
                data: recordData,
                autoConfirm: true
            });

            return result;

        } catch (error) {
            console.error(chalk.red(`❌ Error creating record: ${error.message}`));
            throw error;
        }
    }

    /**
     * Filter fields that should be presented to user for input
     * @private
     * @param {Array} fields - All fields from table
     * @returns {Array} Filtered fields for user input
     */
    filterFieldsForInput(fields) {
        return fields.filter(field => {
            // Skip system fields
            if (this.systemFields.includes(field.element)) {
                return false;
            }

            // Skip read-only fields
            if (field.read_only) {
                return false;
            }

            // Skip inactive fields
            if (field.active === false) {
                return false;
            }

            // Skip collection fields
            if (field.internal_type === 'collection') {
                return false;
            }

            return true;
        });
    }

    /**
     * Group fields by type for organized prompting
     * @private
     * @param {Array} fields
     * @returns {Object} Fields grouped by type
     */
    groupFieldsByType(fields) {
        const groups = {
            text: [],
            numbers: [],
            dates: [],
            references: [],
            choices: [],
            other: []
        };

        fields.forEach(field => {
            const type = field.internal_type;

            if (['string', 'url', 'email', 'phone_number'].includes(type)) {
                groups.text.push(field);
            } else if (['integer', 'decimal', 'float', 'currency'].includes(type)) {
                groups.numbers.push(field);
            } else if (['glide_date', 'glide_date_time', 'glide_time'].includes(type)) {
                groups.dates.push(field);
            } else if (['reference', 'glide_list'].includes(type)) {
                groups.references.push(field);
            } else if (type === 'choice') {
                groups.choices.push(field);
            } else {
                groups.other.push(field);
            }
        });

        return groups;
    }

    /**
     * Query ServiceNow for reference field options
     * @param {string} referenceTable - The table being referenced
     * @param {string} searchTerm - Search term for filtering
     * @param {number} limit - Maximum results to return
     * @param {string} instanceKey - Optional specific instance to query
     * @returns {Promise<Array>} Array of reference options
     */
    async queryReferenceField(referenceTable, searchTerm = '', limit = 10, instanceKey = null) {
        if (!this.tools) {
            return [];
        }

        try {
            // Get instance configuration
            const config = this.tools.config;
            if (!config || !config.routing || !config.instances) {
                return [];
            }

            // Determine which instance to query
            const targetInstanceKey = instanceKey || config.routing.tables?.[referenceTable] || config.routing.default || 'dev';
            const instanceConfig = config.instances[targetInstanceKey];

            if (!instanceConfig) {
                console.log(chalk.yellow(`⚠️  No instance config found for: ${targetInstanceKey}`));
                return [];
            }

            // Build query - search in common display fields
            let query = 'active=true';
            if (searchTerm) {
                const searchFields = ['name', 'number', 'short_description', 'title', 'label'];
                const searchQueries = searchFields.map(field => `${field}LIKE${searchTerm}`);
                query += `^${searchQueries.join('^OR')}`;
            }

            // Build query string
            const queryParams = new URLSearchParams({
                sysparm_query: query,
                sysparm_limit: limit,
                sysparm_fields: 'sys_id,name,number,short_description,title,label',
                sysparm_display_value: 'false'
            });

            // Make API request using https
            const auth = Buffer.from(`${instanceConfig.username}:${instanceConfig.password}`).toString('base64');
            const path = `/api/now/table/${referenceTable}?${queryParams.toString()}`;

            const options = {
                hostname: instanceConfig.instance,
                path: path,
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            };

            const response = await new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        try {
                            const parsed = JSON.parse(data);
                            resolve(parsed);
                        } catch (error) {
                            reject(new Error(`Failed to parse response: ${error.message}`));
                        }
                    });
                });

                req.on('error', reject);
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });
                req.end();
            });

            if (response && response.result) {
                return response.result.map(record => ({
                    sys_id: record.sys_id,
                    display: record.name || record.number || record.short_description || record.title || record.label || record.sys_id,
                    raw: record
                }));
            }

            return [];
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not query ${referenceTable}: ${error.message}`));
            return [];
        }
    }

    /**
     * Prompt user for a reference field with autocomplete
     * @param {Object} field - Field definition
     * @param {boolean} isMandatory - Whether field is mandatory
     * @param {string} instanceKey - Optional specific instance to query
     * @returns {Promise<string|null>} sys_id of selected record
     */
    async promptForReferenceField(field, isMandatory, instanceKey = null) {
        const { element, column_label, reference, is_inherited, inherited_from } = field;

        let description = column_label || element;
        if (is_inherited) {
            description += chalk.gray(` (inherited from ${inherited_from})`);
        }
        description += chalk.cyan(` [References: ${reference}]`);
        if (isMandatory) {
            description += chalk.red(' *');
        }

        console.log(chalk.blue(`\n🔍 ${description}`));
        console.log(chalk.gray('Type to search (press Enter with empty input to skip if optional, or "manual" to enter sys_id directly)\n'));

        let searchTerm = '';
        let selectedSysId = null;

        while (!selectedSysId) {
            // Prompt for search term
            const { input } = await inquirer.prompt([{
                type: 'input',
                name: 'input',
                message: 'Search:',
                default: searchTerm
            }]);

            if (!input.trim()) {
                if (isMandatory) {
                    console.log(chalk.red('This field is mandatory. Please provide a value.'));
                    continue;
                } else {
                    return null; // User skipped optional field
                }
            }

            if (input.toLowerCase() === 'manual') {
                const { sysId } = await inquirer.prompt([{
                    type: 'input',
                    name: 'sysId',
                    message: 'Enter sys_id:',
                    validate: (val) => val.length === 32 || 'sys_id must be 32 characters'
                }]);
                return sysId;
            }

            searchTerm = input;

            // Query for options
            const spinner = ora({
                text: chalk.blue(`Searching ${reference}...`),
                spinner: 'dots',
                color: 'blue'
            }).start();

            const options = await this.queryReferenceField(reference, searchTerm, 10, instanceKey);
            spinner.stop();

            if (options.length === 0) {
                console.log(chalk.yellow(`No results found for "${searchTerm}". Try a different search term.`));
                continue;
            }

            // Create choices for inquirer
            const choices = options.map(opt => ({
                name: `${opt.display} [${opt.sys_id}]`,
                value: opt.sys_id,
                short: opt.display
            }));

            // Add option to search again or enter manually
            choices.push(
                new inquirer.Separator(),
                { name: '🔄 Search again', value: '__SEARCH_AGAIN__' },
                { name: '✍️  Enter sys_id manually', value: '__MANUAL__' }
            );

            const { selection } = await inquirer.prompt([{
                type: 'list',
                name: 'selection',
                message: `Select ${column_label || element}:`,
                choices: choices,
                pageSize: 12
            }]);

            if (selection === '__SEARCH_AGAIN__') {
                continue;
            } else if (selection === '__MANUAL__') {
                const { sysId } = await inquirer.prompt([{
                    type: 'input',
                    name: 'sysId',
                    message: 'Enter sys_id:',
                    validate: (val) => val.length === 32 || 'sys_id must be 32 characters'
                }]);
                selectedSysId = sysId;
            } else {
                selectedSysId = selection;
            }
        }

        return selectedSysId;
    }

    /**
     * Prompt user for a specific field value
     * @private
     * @param {Object} field - Field definition
     * @param {boolean} isMandatory - Whether field is mandatory
     * @param {string} instanceKey - Optional specific instance to query
     * @returns {Promise<any>} Field value
     */
    async promptForField(field, isMandatory, instanceKey = null) {
        const { element, column_label, internal_type, max_length, reference, is_inherited, inherited_from } = field;

        // Handle reference fields with autocomplete
        if (internal_type === 'reference' && reference && this.tools) {
            return await this.promptForReferenceField(field, isMandatory, instanceKey);
        }

        // Build field description with validation hints
        let description = column_label || element;
        if (is_inherited) {
            description += chalk.gray(` (inherited from ${inherited_from})`);
        }

        // Add field hints
        const hints = this.validator.getFieldHints(field);
        if (hints) {
            description += ` ${hints}`;
        }

        // Show mandatory indicator
        if (isMandatory) {
            description += chalk.red(' *');
        }

        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            const promptConfig = {
                name: 'value',
                type: this._getPromptType(internal_type),
                message: `${description}:`,
                validate: (input) => {
                    // Use comprehensive validation
                    const validation = this.validator.validateField(input, field, isMandatory);
                    return validation.isValid ? true : validation.message;
                }
            };

            // Customize prompt based on field type
            this._customizePrompt(promptConfig, field);

            try {
                const { value } = await inquirer.prompt([promptConfig]);

                // Final validation and sanitization
                const validation = this.validator.validateField(value, field, isMandatory);
                if (validation.isValid) {
                    return validation.sanitizedValue;
                } else {
                    console.log(validation.message);
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.log(chalk.yellow(`Please try again (${maxAttempts - attempts} attempts remaining)`));
                    }
                }
            } catch (error) {
                console.log(chalk.red(`Error: ${error.message}`));
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(chalk.yellow(`Please try again (${maxAttempts - attempts} attempts remaining)`));
                }
            }
        }

        // If we get here, all attempts failed
        if (isMandatory) {
            throw new Error(`Failed to get valid input for mandatory field: ${column_label || element}`);
        } else {
            console.log(chalk.yellow(`⚠️  Skipping field ${column_label || element} after ${maxAttempts} failed attempts`));
            return null;
        }
    }

    /**
     * Get appropriate prompt type for field
     * @private
     * @param {string} internalType
     * @returns {string}
     */
    _getPromptType(internalType) {
        switch (internalType) {
            case 'boolean':
                return 'confirm';
            case 'integer':
            case 'decimal':
            case 'float':
            case 'currency':
                return 'number';
            case 'journal':
            case 'journal_input':
                return 'editor';
            default:
                return 'input';
        }
    }

    /**
     * Customize prompt configuration for specific field types
     * @private
     * @param {Object} promptConfig
     * @param {Object} field
     */
    _customizePrompt(promptConfig, field) {
        const { internal_type, reference } = field;

        switch (internal_type) {
            case 'boolean':
                promptConfig.default = false;
                break;

            case 'password2':
                promptConfig.type = 'password';
                promptConfig.mask = '*';
                break;

            case 'choice':
                // TODO: In future, could load actual choice options
                promptConfig.type = 'input';
                break;

            case 'script':
            case 'script_plain':
                promptConfig.type = 'editor';
                break;

            case 'html':
                promptConfig.type = 'editor';
                break;

            case 'json':
                promptConfig.type = 'editor';
                promptConfig.message += chalk.gray(' (JSON format)');
                break;
        }
    }

    /**
     * Show available fields for a table (preview mode)
     * @param {string} tableName - The table name
     * @param {Object} options - Display options
     */
    async showTableFields(tableName, options = {}) {
        const { includeInheritedFields = true, showSystemFields = false } = options;

        try {
            console.log(chalk.blue(`\n📋 Fields for table: ${chalk.white(tableName)}`));

            const spinner = ora({
                text: chalk.blue('Loading fields...'),
                spinner: 'dots',
                color: 'blue'
            }).start();

            const fields = await this.mapper.getFieldsForTable(tableName, includeInheritedFields);

            spinner.stop();

            if (fields.length === 0) {
                console.log(chalk.yellow(`⚠️  No fields found for table: ${tableName}`));
                return;
            }

            // Filter fields if needed
            const displayFields = showSystemFields ? fields : this.filterFieldsForInput(fields);

            console.log(chalk.gray('═'.repeat(80)));
            console.log(chalk.blue(`Found ${displayFields.length} fields:`));
            console.log(chalk.gray('═'.repeat(80)));

            // Group fields by mandatory/optional
            const mandatoryFields = displayFields.filter(f => f.mandatory);
            const optionalFields = displayFields.filter(f => !f.mandatory);

            if (mandatoryFields.length > 0) {
                console.log(chalk.red(`\n🚨 Mandatory Fields (${mandatoryFields.length}):`));
                mandatoryFields.forEach(field => {
                    const inherited = field.is_inherited ? chalk.gray(` (from ${field.inherited_from})`) : '';
                    const readonly = field.read_only ? chalk.yellow(' [RO]') : '';
                    console.log(chalk.white(`  ${chalk.red('*')} ${chalk.green(field.element.padEnd(25))} ${chalk.cyan(field.internal_type.padEnd(15))} ${field.column_label}${readonly}${inherited}`));
                });
            }

            if (optionalFields.length > 0) {
                console.log(chalk.green(`\n✨ Optional Fields (${optionalFields.length}):`));
                optionalFields.forEach(field => {
                    const inherited = field.is_inherited ? chalk.gray(` (from ${field.inherited_from})`) : '';
                    const readonly = field.read_only ? chalk.yellow(' [RO]') : '';
                    console.log(chalk.white(`    ${chalk.green(field.element.padEnd(25))} ${chalk.cyan(field.internal_type.padEnd(15))} ${field.column_label}${readonly}${inherited}`));
                });
            }

            console.log(chalk.gray('\n* = Mandatory, [RO] = Read Only'));

        } catch (error) {
            console.error(chalk.red(`❌ Error loading fields: ${error.message}`));
        }
    }
}

module.exports = { EnhancedRecordCreator };

// CLI usage
if (require.main === module) {
    const creator = new EnhancedRecordCreator();

    async function main() {
        const args = process.argv.slice(2);
        const command = args[0];

        switch (command) {
            case 'show-fields':
                const tableName = args[1];
                if (!tableName) {
                    console.error('❌ Usage: node sn-enhanced-record-creator.js show-fields <table_name>');
                    process.exit(1);
                }
                await creator.showTableFields(tableName, {
                    includeInheritedFields: true,
                    showSystemFields: false
                });
                break;

            case 'create':
                const createTable = args[1];
                if (!createTable) {
                    console.error('❌ Usage: node sn-enhanced-record-creator.js create <table_name>');
                    process.exit(1);
                }
                console.log(chalk.yellow('⚠️  ServiceNowTools instance required for record creation. Use via operations interface.'));
                break;

            default:
                console.log('🔧 Enhanced ServiceNow Record Creator');
                console.log('=====================================');
                console.log('Commands:');
                console.log('  show-fields <table>  - Show all fields for a table');
                console.log('  create <table>       - Start guided record creation (requires integration)');
        }
    }

    main().catch(console.error);
}