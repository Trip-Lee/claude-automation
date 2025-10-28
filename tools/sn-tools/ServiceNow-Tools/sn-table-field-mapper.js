#!/usr/bin/env node

/**
 * ServiceNow Table-Field Relationship Mapper
 *
 * This module creates a relationship system between sys_db_object (tables) and sys_dictionary (fields)
 * with support for table inheritance through the super_class field.
 *
 * Features:
 * - Maps tables to their fields via sys_dictionary
 * - Supports inheritance chains through super_class relationships
 * - Provides field lookup with inheritance resolution
 * - Caches relationships for performance
 *
 * Author: ServiceNow Tools
 * Version: 1.0.0
 */

const fs = require('fs').promises;
const path = require('path');
// Use unified core module with fallback
let ErrorHandler;
try {
    const UnifiedCore = require('./sn-core');
    ErrorHandler = UnifiedCore.ErrorHandler; // Get the class, not the instance
} catch (error) {
    try {
        ErrorHandler = require('./sn-error-handler').ErrorHandler;
    } catch (fallbackError) {
        // Create a minimal error handler class if neither is available
        ErrorHandler = class {
            handle(error, context) {
                console.error('Error:', error.message);
                return { message: error.message, context };
            }
            safeFileOperation(operation) {
                return operation();
            }
        };
    }
}
const ora = require('ora');
const chalk = require('chalk');

class TableFieldMapper {
    constructor(dataPath = null) {
        // Auto-detect data path similar to sn-operations.js
        if (!dataPath) {
            const possiblePaths = [
                path.join(__dirname, '..', 'ServiceNow-Data', 'Data'),
                path.join(process.cwd(), '..', 'ServiceNow-Data', 'Data'),
                'G:/Work/sn-tools/ServiceNow-Data/Data'
            ];

            for (const testPath of possiblePaths) {
                try {
                    if (require('fs').existsSync(testPath)) {
                        dataPath = testPath;
                        console.log(`Auto-detected data path: ${dataPath}`);
                        break;
                    }
                } catch (e) {
                    // Continue to next path
                }
            }

            if (!dataPath) {
                dataPath = path.join(__dirname, '..', 'ServiceNow-Data', 'Data');
            }
        }

        this.dataPath = dataPath;
        this.errorHandler = new ErrorHandler();

        // Cache objects
        this.tableCache = new Map();
        this.fieldCache = new Map();
        this.inheritanceCache = new Map();
        this.relationshipCache = new Map();

        // Track loading state
        this.isLoaded = false;
        this.loadingPromise = null;
    }

    /**
     * Initialize the mapper by loading table and field data
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        if (this.isLoaded) return true;
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = this._loadData();
        const result = await this.loadingPromise;
        this.isLoaded = result;
        return result;
    }

    /**
     * Load sys_db_object and sys_dictionary data from files
     * @private
     * @returns {Promise<boolean>}
     */
    async _loadData() {
        const overallSpinner = ora({
            text: chalk.blue('Initializing ServiceNow table-field mapper...'),
            spinner: 'dots',
            color: 'blue'
        }).start();

        try {
            // Load tables (sys_db_object)
            overallSpinner.text = chalk.blue('Loading table definitions...');
            await this._loadTables();
            overallSpinner.succeed(chalk.green(`Loaded ${this.tableCache.size} table definitions`));

            // Load fields (sys_dictionary)
            const fieldSpinner = ora({
                text: chalk.blue('Loading field definitions...'),
                spinner: 'dots',
                color: 'blue'
            }).start();
            await this._loadFields();
            fieldSpinner.succeed(chalk.green(`Loaded ${this.fieldCache.size} field definitions`));

            // Build inheritance chains
            const inheritanceSpinner = ora({
                text: chalk.blue('Building inheritance chains...'),
                spinner: 'dots',
                color: 'blue'
            }).start();
            await this._buildInheritanceChains();
            inheritanceSpinner.succeed(chalk.green(`Built inheritance chains for ${this.inheritanceCache.size} tables`));

            console.log(chalk.green('✅ Table-field mapper ready!'));
            return true;
        } catch (error) {
            overallSpinner.fail(chalk.red('Failed to initialize table-field mapper'));
            this.errorHandler.logError('TableFieldMapper._loadData', error, {
                dataPath: this.dataPath
            });
            return false;
        }
    }

    /**
     * Load sys_db_object data
     * @private
     */
    async _loadTables() {
        const tablesPath = path.join(this.dataPath, 'sys_db_object');

        try {
            // Check if directory exists
            const stat = await fs.stat(tablesPath);
            if (!stat.isDirectory()) {
                throw new Error(`sys_db_object path is not a directory: ${tablesPath}`);
            }

            const scopes = await fs.readdir(tablesPath);
            let totalFiles = 0;
            let processedFiles = 0;
            let loadedTables = 0;

            // Count total files first for progress tracking
            for (const scope of scopes) {
                const scopePath = path.join(tablesPath, scope);
                try {
                    const scopeStat = await fs.stat(scopePath);
                    if (scopeStat.isDirectory()) {
                        const files = await fs.readdir(scopePath);
                        totalFiles += files.filter(file => file.endsWith('.json')).length;
                    }
                } catch (e) {
                    // Skip non-directory entries
                }
            }

            console.log(chalk.blue(`📁 Found ${scopes.length} scope directories with ${totalFiles} table definitions`));

            for (const scope of scopes) {
                const scopePath = path.join(tablesPath, scope);

                try {
                    const scopeStat = await fs.stat(scopePath);

                    if (scopeStat.isDirectory()) {
                        const files = await fs.readdir(scopePath);
                        const jsonFiles = files.filter(file => file.endsWith('.json'));

                        for (const file of jsonFiles) {
                            try {
                                const filePath = path.join(scopePath, file);
                                const content = await fs.readFile(filePath, 'utf8');
                                const tableData = JSON.parse(content);

                                const tableName = tableData.name?.value || tableData.name;
                                if (tableName) {
                                    this.tableCache.set(tableName, {
                                        name: tableName,
                                        label: tableData.label?.value || tableData.label || tableName,
                                        super_class: tableData.super_class?.value || tableData.super_class || null,
                                        scope: tableData.sys_scope?.display_value || scope,
                                        sys_id: tableData.sys_id?.value || tableData.sys_id,
                                        extends_table: tableData.extends_table?.value || tableData.extends_table || null,
                                        _raw: tableData
                                    });
                                    loadedTables++;
                                }
                                processedFiles++;

                                // Progress indicator every 10 files
                                if (processedFiles % 10 === 0) {
                                    const progress = Math.round((processedFiles / totalFiles) * 100);
                                    process.stdout.write(`\r${chalk.blue('📂')} Processing tables: ${progress}% (${processedFiles}/${totalFiles}) - Loaded: ${loadedTables}`);
                                }
                            } catch (fileError) {
                                console.warn(chalk.yellow(`\n⚠️  Error processing file ${file}: ${fileError.message}`));
                                processedFiles++;
                            }
                        }
                    }
                } catch (scopeError) {
                    console.warn(chalk.yellow(`⚠️  Error processing scope ${scope}: ${scopeError.message}`));
                }
            }

            // Clear progress line
            if (totalFiles > 0) {
                process.stdout.write('\r' + ' '.repeat(80) + '\r');
            }

        } catch (error) {
            throw new Error(`Failed to load table data: ${error.message}`);
        }
    }

    /**
     * Load sys_dictionary data
     * @private
     */
    async _loadFields() {
        const fieldsPath = path.join(this.dataPath, 'sys_dictionary');

        try {
            // Check if directory exists
            const stat = await fs.stat(fieldsPath);
            if (!stat.isDirectory()) {
                throw new Error(`sys_dictionary path is not a directory: ${fieldsPath}`);
            }

            const scopes = await fs.readdir(fieldsPath);
            let totalFiles = 0;
            let processedFiles = 0;
            let loadedFields = 0;
            let errors = 0;

            // Count total files first for progress tracking
            for (const scope of scopes) {
                const scopePath = path.join(fieldsPath, scope);
                try {
                    const scopeStat = await fs.stat(scopePath);
                    if (scopeStat.isDirectory()) {
                        const files = await fs.readdir(scopePath);
                        totalFiles += files.filter(file => file.endsWith('.json')).length;
                    }
                } catch (e) {
                    // Skip non-directory entries
                }
            }

            console.log(chalk.blue(`📁 Found ${scopes.length} scope directories with ${totalFiles} field definitions`));

            for (const scope of scopes) {
                const scopePath = path.join(fieldsPath, scope);

                try {
                    const scopeStat = await fs.stat(scopePath);

                    if (scopeStat.isDirectory()) {
                        const files = await fs.readdir(scopePath);
                        const jsonFiles = files.filter(file => file.endsWith('.json'));

                        for (const file of jsonFiles) {
                            try {
                                const filePath = path.join(scopePath, file);
                                const content = await fs.readFile(filePath, 'utf8');
                                const fieldData = JSON.parse(content);

                                const tableName = fieldData.name?.value || fieldData.name;
                                const element = fieldData.element?.value || fieldData.element;

                                // Skip collection fields with empty element names (these are table-level collection fields)
                                if (tableName && element && typeof element === 'string' && element.trim() !== '') {
                                    const fieldKey = `${tableName}.${element}`;

                                    this.fieldCache.set(fieldKey, {
                                        table: tableName,
                                        element: element,
                                        column_label: fieldData.column_label?.value || fieldData.column_label || element,
                                        internal_type: fieldData.internal_type?.value || fieldData.internal_type,
                                        reference: fieldData.reference?.value || fieldData.reference || null,
                                        max_length: fieldData.max_length?.value || fieldData.max_length || null,
                                        mandatory: fieldData.mandatory?.value === 'true' || fieldData.mandatory === true,
                                        read_only: fieldData.read_only?.value === 'true' || fieldData.read_only === true,
                                        active: fieldData.active?.value !== 'false' && fieldData.active !== false,
                                        scope: fieldData.sys_scope?.display_value || scope,
                                        sys_id: fieldData.sys_id?.value || fieldData.sys_id,
                                        _raw: fieldData
                                    });

                                    loadedFields++;
                                }
                                processedFiles++;

                                // Progress indicator every 100 files (more frequent due to large dataset)
                                if (processedFiles % 100 === 0) {
                                    const progress = Math.round((processedFiles / totalFiles) * 100);
                                    process.stdout.write(`\r${chalk.blue('📋')} Processing fields: ${progress}% (${processedFiles}/${totalFiles}) - Loaded: ${loadedFields}, Errors: ${errors}`);
                                }
                            } catch (fileError) {
                                errors++;
                                processedFiles++;
                                // Only log first few errors to avoid spam
                                if (errors <= 5) {
                                    console.warn(chalk.yellow(`\n⚠️  Error processing field file ${file}: ${fileError.message}`));
                                }
                            }
                        }
                    }
                } catch (scopeError) {
                    console.warn(chalk.yellow(`⚠️  Error processing scope ${scope}: ${scopeError.message}`));
                }
            }

            // Clear progress line and show summary
            if (totalFiles > 0) {
                process.stdout.write('\r' + ' '.repeat(120) + '\r');
            }

            if (errors > 5) {
                console.log(chalk.yellow(`⚠️  ${errors} total errors encountered during field loading (only first 5 shown)`));
            }

        } catch (error) {
            throw new Error(`Failed to load field data: ${error.message}`);
        }
    }

    /**
     * Build inheritance chain mappings
     * @private
     */
    async _buildInheritanceChains() {
        for (const [tableName, tableData] of this.tableCache) {
            const chain = this._getInheritanceChain(tableName);
            this.inheritanceCache.set(tableName, chain);
        }
    }

    /**
     * Get inheritance chain for a table
     * @private
     * @param {string} tableName
     * @param {Set} visited - To prevent circular references
     * @returns {string[]} Array of table names in inheritance order
     */
    _getInheritanceChain(tableName, visited = new Set()) {
        if (visited.has(tableName)) {
            console.warn(`⚠️  Circular inheritance detected for table: ${tableName}`);
            return [tableName];
        }

        visited.add(tableName);
        const chain = [tableName];

        const tableData = this.tableCache.get(tableName);
        if (tableData && tableData.super_class) {
            const parentChain = this._getInheritanceChain(tableData.super_class, visited);
            chain.push(...parentChain);
        }

        return chain;
    }

    /**
     * Get all fields for a table including inherited fields
     * @param {string} tableName - The table name
     * @param {boolean} includeInherited - Whether to include inherited fields (default: true)
     * @returns {Promise<Array>} Array of field objects
     */
    async getFieldsForTable(tableName, includeInherited = true) {
        await this.initialize();

        const cacheKey = `${tableName}:${includeInherited}`;
        if (this.relationshipCache.has(cacheKey)) {
            return this.relationshipCache.get(cacheKey);
        }

        const fields = [];
        const tablesToCheck = includeInherited
            ? (this.inheritanceCache.get(tableName) || [tableName])
            : [tableName];

        const seenFields = new Set();

        for (const table of tablesToCheck) {
            for (const [fieldKey, fieldData] of this.fieldCache) {
                if (fieldData.table === table && !seenFields.has(fieldData.element)) {
                    seenFields.add(fieldData.element);
                    fields.push({
                        ...fieldData,
                        inherited_from: table !== tableName ? table : null,
                        is_inherited: table !== tableName
                    });
                }
            }
        }

        // Sort fields by label
        fields.sort((a, b) => (a.column_label || a.element).localeCompare(b.column_label || b.element));

        this.relationshipCache.set(cacheKey, fields);
        return fields;
    }

    /**
     * Get specific field information including inheritance
     * @param {string} tableName - The table name
     * @param {string} fieldName - The field name
     * @returns {Promise<Object|null>} Field object or null if not found
     */
    async getField(tableName, fieldName) {
        await this.initialize();

        const inheritanceChain = this.inheritanceCache.get(tableName) || [tableName];

        for (const table of inheritanceChain) {
            const fieldKey = `${table}.${fieldName}`;
            const fieldData = this.fieldCache.get(fieldKey);

            if (fieldData) {
                return {
                    ...fieldData,
                    inherited_from: table !== tableName ? table : null,
                    is_inherited: table !== tableName
                };
            }
        }

        return null;
    }

    /**
     * Search for fields across all tables
     * @param {string} searchTerm - Search term for field names or labels
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Array of matching fields
     */
    async searchFields(searchTerm, options = {}) {
        await this.initialize();

        const {
            tables = null,           // Array of table names to search in
            fieldTypes = null,       // Array of field types to filter by
            includeInherited = true, // Include inherited fields
            limit = 100             // Max results
        } = options;

        const results = [];
        const searchLower = searchTerm.toLowerCase();

        for (const [fieldKey, fieldData] of this.fieldCache) {
            // Filter by tables if specified
            if (tables && !tables.includes(fieldData.table)) continue;

            // Filter by field types if specified
            if (fieldTypes && !fieldTypes.includes(fieldData.internal_type)) continue;

            // Check if field matches search term
            const elementMatch = fieldData.element.toLowerCase().includes(searchLower);
            const labelMatch = (fieldData.column_label || '').toLowerCase().includes(searchLower);

            if (elementMatch || labelMatch) {
                results.push(fieldData);

                if (results.length >= limit) break;
            }
        }

        return results;
    }

    /**
     * Get table information including inheritance
     * @param {string} tableName - The table name
     * @returns {Promise<Object|null>} Table object with inheritance info
     */
    async getTable(tableName) {
        await this.initialize();

        const tableData = this.tableCache.get(tableName);
        if (!tableData) return null;

        const inheritanceChain = this.inheritanceCache.get(tableName) || [];
        const childTables = [];

        // Find child tables
        for (const [name, data] of this.tableCache) {
            if (data.super_class === tableName) {
                childTables.push(name);
            }
        }

        return {
            ...tableData,
            inheritance_chain: inheritanceChain,
            child_tables: childTables,
            field_count: await this._getFieldCount(tableName)
        };
    }

    /**
     * Get field count for a table
     * @private
     * @param {string} tableName
     * @returns {Promise<number>}
     */
    async _getFieldCount(tableName) {
        const fields = await this.getFieldsForTable(tableName, false);
        return fields.length;
    }

    /**
     * Get statistics about the loaded data
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        await this.initialize();

        const tableTypes = new Map();
        const fieldTypes = new Map();
        let inheritedTables = 0;

        for (const [name, data] of this.tableCache) {
            const scope = data.scope || 'Unknown';
            tableTypes.set(scope, (tableTypes.get(scope) || 0) + 1);

            if (data.super_class) inheritedTables++;
        }

        for (const [key, data] of this.fieldCache) {
            const type = data.internal_type || 'Unknown';
            fieldTypes.set(type, (fieldTypes.get(type) || 0) + 1);
        }

        return {
            tables: {
                total: this.tableCache.size,
                inherited: inheritedTables,
                by_scope: Object.fromEntries(tableTypes)
            },
            fields: {
                total: this.fieldCache.size,
                by_type: Object.fromEntries(fieldTypes)
            },
            inheritance_chains: this.inheritanceCache.size,
            cache_hits: this.relationshipCache.size
        };
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.relationshipCache.clear();
        console.log('🧹 Relationship cache cleared');
    }

    /**
     * Reload data from files
     * @returns {Promise<boolean>}
     */
    async reload() {
        this.isLoaded = false;
        this.loadingPromise = null;
        this.tableCache.clear();
        this.fieldCache.clear();
        this.inheritanceCache.clear();
        this.relationshipCache.clear();

        return await this.initialize();
    }
}

module.exports = { TableFieldMapper };

// CLI usage
if (require.main === module) {
    const mapper = new TableFieldMapper();

    async function main() {
        const args = process.argv.slice(2);
        const command = args[0];

        switch (command) {
            case 'stats':
                console.log('📊 Table-Field Mapper Statistics');
                console.log('================================');
                const stats = await mapper.getStatistics();
                console.log(JSON.stringify(stats, null, 2));
                break;

            case 'table':
                const tableName = args[1];
                if (!tableName) {
                    console.error('❌ Usage: node sn-table-field-mapper.js table <table_name>');
                    process.exit(1);
                }
                const table = await mapper.getTable(tableName);
                if (table) {
                    console.log(`📋 Table: ${tableName}`);
                    console.log('========================');
                    console.log(JSON.stringify(table, null, 2));
                } else {
                    console.log(`❌ Table not found: ${tableName}`);
                }
                break;

            case 'fields':
                const tableForFields = args[1];
                const includeInherited = args[2] !== 'false';
                if (!tableForFields) {
                    console.error('❌ Usage: node sn-table-field-mapper.js fields <table_name> [include_inherited]');
                    process.exit(1);
                }
                const fields = await mapper.getFieldsForTable(tableForFields, includeInherited);
                console.log(`📋 Fields for ${tableForFields} (${fields.length} total):`);
                console.log('================================================');
                fields.forEach(field => {
                    const inherited = field.is_inherited ? ` (from ${field.inherited_from})` : '';
                    console.log(`  ${field.element} (${field.internal_type}) - ${field.column_label}${inherited}`);
                });
                break;

            case 'search':
                const searchTerm = args[1];
                if (!searchTerm) {
                    console.error('❌ Usage: node sn-table-field-mapper.js search <search_term>');
                    process.exit(1);
                }
                const results = await mapper.searchFields(searchTerm);
                console.log(`🔍 Search results for "${searchTerm}" (${results.length} found):`);
                console.log('=============================================');
                results.forEach(field => {
                    console.log(`  ${field.table}.${field.element} - ${field.column_label} (${field.internal_type})`);
                });
                break;

            default:
                console.log('📊 ServiceNow Table-Field Mapper');
                console.log('=================================');
                console.log('Commands:');
                console.log('  stats                           - Show statistics');
                console.log('  table <name>                   - Show table details');
                console.log('  fields <table> [inherited]     - Show fields for table');
                console.log('  search <term>                  - Search for fields');
        }
    }

    main().catch(console.error);
}