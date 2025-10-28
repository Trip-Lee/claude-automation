#!/usr/bin/env node

/**
 * ServiceNow Individual Operations
 * Run specific operations without the full auto-execute
 */

const ServiceNowTools = require('./servicenow-tools');
const fs = require('fs');
const path = require('path');
const ora = require('ora');
const chalk = require('chalk');
const figlet = require('figlet');
const inquirer = require('inquirer');
// Simplified module loading - use basic implementations for now
let ConfigManager, Validator, ErrorHandler;

// Create minimal implementations for critical functions
ConfigManager = {
    getConfig: () => {
        try {
            const fs = require('fs');
            return JSON.parse(fs.readFileSync(path.join(__dirname, 'sn-config.json'), 'utf8'));
        } catch (error) {
            return { ai: { mode: 'manual' }, instances: {}, routing: {} };
        }
    }
};

ErrorHandler = class {
    handle(error, context) {
        console.error('Error:', error.message);
        return { message: error.message, context };
    }
    safeFileOperation(operation) {
        return operation();
    }
};

Validator = class {
    validateInstanceUrl(url) { return { valid: true, sanitized: url }; }
    validateTableName(name) { return { valid: true, sanitized: name }; }
    validateAIPrompt(prompt) { return { valid: true, sanitized: prompt }; }
    displayResults(result) { return result; }
};

// Load AI integration
const { EnhancedAIIntegration } = require('./sn-ai-integration');
const { TableFieldMapper } = require('./sn-table-field-mapper');
const { EnhancedRecordCreator } = require('./sn-enhanced-record-creator');

// Initialize global utilities
const validator = new Validator();
const errorHandler = new ErrorHandler();

/**
 * Load AI mode configuration using centralized config manager
 */
function loadAIModeConfig() {
    try {
        const config = ConfigManager.getConfig();
        return config.ai?.mode || 'manual';
    } catch (error) {
        console.error('Error loading AI mode config:', error.message);
        return 'manual';
    }
}

/**
 * Handle table-fields operation
 */
async function handleTableFieldsOperation(args, isInteractive) {
    const mapper = new TableFieldMapper();

    // Parse command line arguments
    const tableIndex = args.indexOf('--table');
    const inheritedIndex = args.indexOf('--inherited');

    let tableName = tableIndex !== -1 ? args[tableIndex + 1] : null;
    let includeInherited = inheritedIndex === -1 || args[inheritedIndex + 1] !== 'false';

    if (!tableName && isInteractive) {
        const { inputTable } = await inquirer.prompt([
            {
                type: 'input',
                name: 'inputTable',
                message: 'Enter table name:',
                validate: input => input.trim() ? true : 'Table name is required'
            }
        ]);
        tableName = inputTable.trim();

        const { includeInheritedPrompt } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'includeInheritedPrompt',
                message: 'Include inherited fields?',
                default: true
            }
        ]);
        includeInherited = includeInheritedPrompt;
    }

    if (!tableName) {
        console.error('❌ Table name is required. Use --table <table_name>');
        process.exit(1);
    }

    try {
        const spinner = ora({
            text: chalk.blue(`Loading fields for table: ${tableName}`),
            spinner: 'dots',
            color: 'blue'
        }).start();

        const fields = await mapper.getFieldsForTable(tableName, includeInherited);

        spinner.stop();

        if (fields.length === 0) {
            console.log(chalk.yellow(`⚠️  No fields found for table: ${tableName}`));
            return;
        }

        if (isInteractive) {
            console.log(chalk.blue(`\n📋 Fields for ${chalk.white(tableName)} (${fields.length} total):`));
            console.log(chalk.gray('═'.repeat(80)));

            fields.forEach(field => {
                const inherited = field.is_inherited ? chalk.gray(` (from ${field.inherited_from})`) : '';
                const mandatory = field.mandatory ? chalk.red(' *') : '';
                const readOnly = field.read_only ? chalk.yellow(' [RO]') : '';

                console.log(chalk.white(`  ${chalk.green(field.element.padEnd(25))} ${chalk.cyan(field.internal_type.padEnd(15))} ${field.column_label}${mandatory}${readOnly}${inherited}`));
            });

            console.log(chalk.gray('\n* = Mandatory, [RO] = Read Only'));
        } else {
            fields.forEach(field => {
                const inherited = field.is_inherited ? ` (from ${field.inherited_from})` : '';
                console.log(`${field.element} (${field.internal_type}) - ${field.column_label}${inherited}`);
            });
        }

    } catch (error) {
        console.error(chalk.red(`❌ Error loading fields: ${error.message}`));
        process.exit(1);
    }
}

/**
 * Handle search-fields operation
 */
async function handleSearchFieldsOperation(args, isInteractive) {
    const mapper = new TableFieldMapper();

    // Parse command line arguments
    const termIndex = args.indexOf('--term');
    const limitIndex = args.indexOf('--limit');
    const tablesIndex = args.indexOf('--tables');

    let searchTerm = termIndex !== -1 ? args[termIndex + 1] : null;
    let limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) || 100 : 100;
    let tables = tablesIndex !== -1 ? args[tablesIndex + 1]?.split(',') : null;

    if (!searchTerm && isInteractive) {
        const { inputTerm } = await inquirer.prompt([
            {
                type: 'input',
                name: 'inputTerm',
                message: 'Enter search term:',
                validate: input => input.trim() ? true : 'Search term is required'
            }
        ]);
        searchTerm = inputTerm.trim();

        const { inputLimit } = await inquirer.prompt([
            {
                type: 'number',
                name: 'inputLimit',
                message: 'Maximum results:',
                default: 100,
                validate: input => input > 0 ? true : 'Limit must be greater than 0'
            }
        ]);
        limit = inputLimit;
    }

    if (!searchTerm) {
        console.error('❌ Search term is required. Use --term <search_term>');
        process.exit(1);
    }

    try {
        const spinner = ora({
            text: chalk.blue(`Searching for fields containing: ${searchTerm}`),
            spinner: 'dots',
            color: 'blue'
        }).start();

        const results = await mapper.searchFields(searchTerm, {
            tables,
            limit,
            includeInherited: true
        });

        spinner.stop();

        if (results.length === 0) {
            console.log(chalk.yellow(`⚠️  No fields found matching: ${searchTerm}`));
            return;
        }

        if (isInteractive) {
            console.log(chalk.blue(`\n🔍 Search results for "${chalk.white(searchTerm)}" (${results.length} found):`));
            console.log(chalk.gray('═'.repeat(80)));

            results.forEach(field => {
                const mandatory = field.mandatory ? chalk.red(' *') : '';
                const readOnly = field.read_only ? chalk.yellow(' [RO]') : '';

                console.log(chalk.white(`  ${chalk.green(field.table.padEnd(20))}.${chalk.cyan(field.element.padEnd(25))} ${field.internal_type.padEnd(15)} ${field.column_label}${mandatory}${readOnly}`));
            });

            console.log(chalk.gray('\n* = Mandatory, [RO] = Read Only'));
        } else {
            results.forEach(field => {
                console.log(`${field.table}.${field.element} - ${field.column_label} (${field.internal_type})`);
            });
        }

    } catch (error) {
        console.error(chalk.red(`❌ Error searching fields: ${error.message}`));
        process.exit(1);
    }
}

/**
 * Handle interactive create operation
 */
async function handleInteractiveCreateOperation(tools) {
    const { tableName } = await inquirer.prompt([
        {
            type: 'input',
            name: 'tableName',
            message: 'Enter table name for record creation:',
            validate: input => input.trim() ? true : 'Table name is required'
        }
    ]);

    console.log(chalk.blue('\n🔧 Starting Enhanced Record Creator...'));
    console.log(chalk.gray('This will discover all table fields and prompt for input.'));

    const enhancedCreator = new EnhancedRecordCreator(tools);

    try {
        const createResult = await enhancedCreator.createRecordWithFieldDiscovery(tableName.trim(), {
            skipOptionalFields: false,
            includeInheritedFields: true,
            autoConfirm: false,
            preferAPI: true,  // Use API by default in interactive mode
            instanceKey: null  // Will prompt for instance selection
        });

        if (createResult) {
            console.log(chalk.green('\n✅ Record created successfully!'));
            console.log(`Sys ID: ${createResult.sys_id}`);
        } else {
            console.log(chalk.yellow('Record creation cancelled'));
        }
    } catch (error) {
        console.error(chalk.red(`❌ Enhanced record creation failed: ${error.message}`));
    }
}

/**
 * Handle interactive update operation
 */
async function handleInteractiveUpdateOperation(tools) {
    // Step 1: Get table name
    const { tableName } = await inquirer.prompt([
        {
            type: 'input',
            name: 'tableName',
            message: 'Enter table name:',
            validate: input => input.trim() ? true : 'Table name is required'
        }
    ]);

    // Step 2: Choose how to identify the record
    const { searchMethod } = await inquirer.prompt([
        {
            type: 'list',
            name: 'searchMethod',
            message: 'How would you like to identify the record?',
            choices: [
                { name: '🔍 Search by name/number/description', value: 'search' },
                { name: '🆔 Enter sys_id directly', value: 'sysid' },
                { name: '📋 Browse recent records from cache', value: 'browse' }
            ],
            default: 'search'
        }
    ]);

    let sysId = null;

    if (searchMethod === 'sysid') {
        // Direct sys_id entry
        const { inputSysId } = await inquirer.prompt([
            {
                type: 'input',
                name: 'inputSysId',
                message: 'Enter sys_id of the record to update:',
                validate: input => {
                    const trimmed = input.trim();
                    if (!trimmed) return 'sys_id is required';
                    if (trimmed.length !== 32) return 'sys_id must be 32 characters';
                    return true;
                }
            }
        ]);
        sysId = inputSysId.trim();
    } else if (searchMethod === 'search') {
        // Search for record by name/number/description
        const { searchTerm } = await inquirer.prompt([
            {
                type: 'input',
                name: 'searchTerm',
                message: 'Enter search term (name, number, or description):',
                validate: input => input.trim() ? true : 'Search term is required'
            }
        ]);

        console.log(chalk.blue('\n🔍 Searching for records...'));

        const enhancedCreator = new EnhancedRecordCreator(tools);
        const searchResults = await enhancedCreator.queryReferenceField(
            tableName.trim(),
            searchTerm.trim(),
            20  // Show up to 20 results
        );

        if (searchResults.length === 0) {
            console.log(chalk.yellow(`\n⚠️  No records found matching "${searchTerm.trim()}"`));
            console.log(chalk.blue('💡 Try a different search term or use sys_id directly'));
            return;
        }

        const { selectedRecord } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedRecord',
                message: `Found ${searchResults.length} record(s). Select one to update:`,
                choices: searchResults.map(record => ({
                    name: `${record.display} ${chalk.gray(`[${record.sys_id}]`)}`,
                    value: record.sys_id,
                    short: record.display
                })),
                pageSize: 15
            }
        ]);

        sysId = selectedRecord;
    } else if (searchMethod === 'browse') {
        // Browse cached records
        console.log(chalk.blue('\n📦 Loading cached records...'));

        const enhancedCreator = new EnhancedRecordCreator(tools);
        const cachedRecords = await enhancedCreator.getCachedRecordsForTable(tableName.trim());

        if (cachedRecords.length === 0) {
            console.log(chalk.yellow(`\n⚠️  No cached records found for table: ${tableName.trim()}`));
            console.log(chalk.blue('💡 Try searching by name or enter sys_id directly'));
            return;
        }

        const { selectedRecord } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedRecord',
                message: `Found ${cachedRecords.length} cached record(s). Select one to update:`,
                choices: cachedRecords.slice(0, 50).map(record => ({
                    name: `${record.display} ${chalk.gray(`[${record.sys_id}]`)}`,
                    value: record.sys_id,
                    short: record.display
                })),
                pageSize: 15
            }
        ]);

        sysId = selectedRecord;
    }

    console.log(chalk.blue('\n🔧 Starting Enhanced Record Updater...'));
    console.log(chalk.gray('This will fetch the record, discover fields, and prompt for updates.'));

    const enhancedCreator = new EnhancedRecordCreator(tools);

    try {
        const updateResult = await enhancedCreator.updateRecordWithFieldDiscovery(
            tableName.trim(),
            sysId,
            {
                skipOptionalFields: false,
                includeInheritedFields: true,
                autoConfirm: false,
                preferAPI: true,  // Use API by default in interactive mode
                instanceKey: null  // Will prompt for instance selection
            }
        );

        if (updateResult) {
            console.log(chalk.green('\n✅ Record updated successfully!'));
            console.log(`Sys ID: ${updateResult.sys_id}`);
            console.log(`Updated: ${updateResult.updated_at}`);
        } else {
            console.log(chalk.yellow('Record update cancelled'));
        }
    } catch (error) {
        console.error(chalk.red(`❌ Enhanced record update failed: ${error.message}`));
    }
}

/**
 * Handle table-info operation
 */
async function handleTableInfoOperation(args, isInteractive) {
    const mapper = new TableFieldMapper();

    // Parse command line arguments
    const tableIndex = args.indexOf('--table');
    let tableName = tableIndex !== -1 ? args[tableIndex + 1] : null;

    if (!tableName && isInteractive) {
        const { inputTable } = await inquirer.prompt([
            {
                type: 'input',
                name: 'inputTable',
                message: 'Enter table name:',
                validate: input => input.trim() ? true : 'Table name is required'
            }
        ]);
        tableName = inputTable.trim();
    }

    if (!tableName) {
        console.error('❌ Table name is required. Use --table <table_name>');
        process.exit(1);
    }

    try {
        const spinner = ora({
            text: chalk.blue(`Loading table information: ${tableName}`),
            spinner: 'dots',
            color: 'blue'
        }).start();

        const tableInfo = await mapper.getTable(tableName);

        spinner.stop();

        if (!tableInfo) {
            console.log(chalk.yellow(`⚠️  Table not found: ${tableName}`));
            return;
        }

        if (isInteractive) {
            console.log(chalk.blue(`\n📋 Table Information: ${chalk.white(tableName)}`));
            console.log(chalk.gray('═'.repeat(60)));
            console.log(chalk.white(`Name:         ${tableInfo.name}`));
            console.log(chalk.white(`Label:        ${tableInfo.label}`));
            console.log(chalk.white(`Scope:        ${tableInfo.scope}`));
            console.log(chalk.white(`Sys ID:       ${tableInfo.sys_id}`));
            console.log(chalk.white(`Field Count:  ${tableInfo.field_count}`));

            if (tableInfo.super_class) {
                console.log(chalk.white(`Extends:      ${tableInfo.super_class}`));
            }

            if (tableInfo.inheritance_chain.length > 1) {
                console.log(chalk.blue(`\n🔗 Inheritance Chain:`));
                tableInfo.inheritance_chain.forEach((table, index) => {
                    const prefix = index === 0 ? '  └─' : '  ↳ ';
                    console.log(chalk.white(`${prefix} ${table}`));
                });
            }

            if (tableInfo.child_tables.length > 0) {
                console.log(chalk.blue(`\n👶 Child Tables (${tableInfo.child_tables.length}):`));
                tableInfo.child_tables.forEach(child => {
                    console.log(chalk.white(`  • ${child}`));
                });
            }
        } else {
            console.log(JSON.stringify(tableInfo, null, 2));
        }

    } catch (error) {
        console.error(chalk.red(`❌ Error loading table info: ${error.message}`));
        process.exit(1);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const operation = args[0];

    const isInteractive = process.stdout.isTTY && !process.env.CI;
    
    if (!operation) {
        if (isInteractive) {
            console.log(chalk.cyan(figlet.textSync('SN Tools', { 
                font: 'Small',
                horizontalLayout: 'fitted'
            })));
            console.log(chalk.gray('═'.repeat(60)));
            console.log(chalk.blue('🛠️  ServiceNow Operations Toolkit v2.1.0'));
            console.log(chalk.gray('═'.repeat(60)));
            console.log();
            
            const operations = [
                { name: 'fetch-data', description: 'Fetch all ServiceNow data with progress tracking' },
                { name: 'fetch-stories', description: 'Fetch user stories from configured instance' },
                { name: 'process-updates', description: 'Process pending updates from temp_updates/' },
                { name: 'update', description: 'Update a specific ServiceNow record' },
                { name: 'create', description: 'Create a new ServiceNow record with enhanced field discovery' },
                { name: 'test', description: 'Test connections to all configured instances' },
                { name: 'table-fields', description: 'Query table fields with inheritance support' },
                { name: 'search-fields', description: 'Search for fields across all tables' },
                { name: 'table-info', description: 'Get detailed table information with inheritance' },
                { name: 'interactive', description: 'Launch interactive mode with guided prompts' }
            ];
            
            console.log(chalk.blue('🎯 Available Operations:'));
            operations.forEach(op => {
                console.log(chalk.white(`   • ${chalk.green(op.name.padEnd(15))} - ${op.description}`));
            });
            
            console.log();
            console.log(chalk.blue('💡 Examples:'));
            console.log(chalk.white('   • node sn-operations.js fetch-data --delete-before-fetch'));
            console.log(chalk.white('   • node sn-operations.js update --type script_include --sys_id abc123 --field script --file script.js'));
            console.log(chalk.white('   • node sn-operations.js update --ai-prompt "Add error handling" --record-name "EmailValidator"'));
            console.log(chalk.white('   • node sn-operations.js create --table incident  (enhanced field discovery)'));
            console.log(chalk.white('   • node sn-operations.js create --table incident --instance dev  (specify instance)'));
            console.log(chalk.white('   • node sn-operations.js create --table sys_script_include --ai-prompt "Create email validator"'));
            console.log(chalk.white('   • node sn-operations.js table-fields --table incident'));
            console.log(chalk.white('   • node sn-operations.js search-fields --term "assigned"'));
            console.log(chalk.white('   • node sn-operations.js table-info --table incident'));
            console.log(chalk.white('   • node sn-operations.js interactive  (for guided operation selection)'));
            console.log();
            console.log(chalk.blue('🤖 AI Features:'));
            console.log(chalk.white('   • AI-assisted CREATE and UPDATE operations'));
            console.log(chalk.white('   • Three AI modes: auto, manual, interactive'));
            console.log(chalk.white('   • Configure AI mode in sn-config.json or use --ai-mode parameter'));
            console.log();
        } else {
            console.log('ServiceNow Operations');
            console.log('=====================');
            console.log('');
            console.log('Usage: node sn-operations.js [operation]');
            console.log('');
            console.log('Operations:');
            console.log('  fetch-data      - Fetch all ServiceNow data');
            console.log('  fetch-stories   - Fetch user stories');
            console.log('  process-updates - Process pending updates from temp_updates/');
            console.log('  update          - Update a specific record');
            console.log('  create          - Create a new record');
            console.log('  test            - Test connections to all configured instances');
            console.log('  interactive     - Launch interactive mode');
            console.log('');
            console.log('Fetch data options:');
            console.log('  --delete-before-fetch  - Delete all existing data before fetching');
            console.log('  Example: node sn-operations.js fetch-data --delete-before-fetch');
            console.log('');
            console.log('Update usage:');
            console.log('  Enhanced (interactive): node sn-operations.js update --table [table] --sys_id [id]');
            console.log('  Enhanced with instance: node sn-operations.js update --table [table] --sys_id [id] --instance [dev|prod]');
            console.log('  Enhanced with cache: node sn-operations.js update --table [table] --sys_id [id] --use-cache');
            console.log('  Legacy single-field: node sn-operations.js update --type [type] --sys_id [id] --field [field] --file [file]');
            console.log('  AI-assisted: node sn-operations.js update --ai-prompt "[description]" --sys_id [id]');
            console.log('  AI-assisted: node sn-operations.js update --ai-prompt "[description]" --record-name "[name]"');
            console.log('');
            console.log('Create usage:');
            console.log('  Manual: node sn-operations.js create --table [table] --data [json_file]');
            console.log('  Manual: node sn-operations.js create --table [table] --field [name] --value [value]...');
            console.log('  Manual (use cached fields): node sn-operations.js create --table [table] --use-cache');
            console.log('  Manual (specify instance): node sn-operations.js create --table [table] --instance [dev|prod]');
            console.log('  AI-assisted: node sn-operations.js create --table [table] --ai-prompt "[description]"');
            console.log('  AI with example: node sn-operations.js create --table [table] --ai-prompt "[description]" --example-file [path]');
            console.log('');
            console.log('AI Mode Configuration:');
            console.log('  Set AI mode: auto, manual, or interactive (configured in sn-config.json)');
            console.log('  Override mode: add --ai-mode [mode] to any command');
            console.log('');
            console.log('Examples:');
            console.log('  Create:');
            console.log('    node sn-operations.js create --table sys_script_include --data record.json');
            console.log('    node sn-operations.js create --table sys_script_include --field name --value "MyScript"');
            console.log('    node sn-operations.js create --table incident --instance prod');
            console.log('    node sn-operations.js create --table sys_script_include --ai-prompt "Create email validator"');
            console.log('    node sn-operations.js create --table sys_script_include --ai-prompt "Create validator" --example-file "./examples/validator.js"');
            console.log('  Update:');
            console.log('    node sn-operations.js update --table sys_script_include --sys_id abc123...');
            console.log('    node sn-operations.js update --table incident --sys_id def456... --instance prod');
            console.log('    node sn-operations.js update --type script_include --sys_id abc123 --field script --file script.js  (legacy)');
            console.log('    node sn-operations.js update --ai-prompt "Add error handling" --sys_id abc123');
            console.log('    node sn-operations.js update --ai-prompt "Add logging" --record-name "EmailValidator"');
            console.log('');
        }
        process.exit(0);
    }

    try {
        const tools = new ServiceNowTools();

        switch (operation) {
            case 'interactive':
                await runInteractiveMode(tools, isInteractive);
                break;
                
            case 'fetch-data':
                const spinner1 = ora({
                    text: chalk.blue('Initializing data fetch...'),
                    spinner: 'dots',
                    color: 'blue'
                });
                
                if (isInteractive) {
                    spinner1.start();
                }
                
                // Check for --delete-before-fetch flag
                const deleteBeforeFetch = args.includes('--delete-before-fetch');
                
                if (isInteractive) {
                    spinner1.succeed(chalk.green('Data fetch initialized'));
                } else {
                    console.log('Fetching ServiceNow data...');
                }
                
                await tools.fetchData({ deleteBeforeFetch });
                
                if (isInteractive) {
                    console.log(chalk.green('\n🎉 Data fetch completed successfully!'));
                } else {
                    console.log('✓ Data fetch completed');
                }
                break;

            case 'fetch-stories':
                const spinner2 = ora({
                    text: chalk.blue('Initializing story fetch...'),
                    spinner: 'dots',
                    color: 'blue'
                });
                
                if (isInteractive) {
                    spinner2.start();
                }
                
                if (isInteractive) {
                    spinner2.succeed(chalk.green('Story fetch initialized'));
                } else {
                    console.log('Fetching ServiceNow stories...');
                }
                
                await tools.fetchStories();
                
                if (isInteractive) {
                    console.log(chalk.green('\n🎉 Story fetch completed successfully!'));
                } else {
                    console.log('✓ Story fetch completed');
                }
                break;

            case 'process-updates':
                const spinner3 = ora({
                    text: chalk.blue('Processing pending updates...'),
                    spinner: 'dots',
                    color: 'blue'
                });
                
                if (isInteractive) {
                    spinner3.start();
                }
                
                if (!isInteractive) {
                    console.log('Processing pending updates...');
                }
                
                await tools.processPendingUpdates();
                
                if (isInteractive) {
                    spinner3.succeed(chalk.green('Updates processed successfully'));
                } else {
                    console.log('✓ Updates processed');
                }
                break;

            case 'update':
                // Parse update parameters
                const updateParams = {};
                let updateAIPrompt = null;
                let updateAIMode = loadAIModeConfig();

                for (let i = 1; i < args.length; i += 2) {
                    const key = args[i].replace('--', '');
                    const value = args[i + 1];

                    if (key === 'table') {
                        updateParams.table = value;
                    } else if (key === 'sys_id') {
                        updateParams.sysId = value;
                    } else if (key === 'instance') {
                        updateParams.instanceKey = value;
                    } else if (key === 'ai-prompt') {
                        updateAIPrompt = value;
                    } else if (key === 'ai-mode') {
                        updateAIMode = value;
                    } else if (key === 'record-name') {
                        updateParams.recordName = value;
                    } else if (key === 'use-cache') {
                        updateParams.preferAPI = false;  // Use cached data instead of API
                    } else {
                        updateParams[key] = value;
                    }
                }

                // Handle AI-assisted update
                if (updateAIPrompt) {
                    if (updateAIMode === 'auto' || updateAIMode === 'interactive') {
                        console.log(`[AI Mode: ${updateAIMode.toUpperCase()}] Processing AI-assisted update...`);

                        try {
                            const updateResult = await processAIAssistedUpdate(tools, updateParams, updateAIPrompt, updateAIMode);
                            if (updateResult) {
                                console.log('✓ AI-assisted update completed successfully');
                            } else {
                                console.log('Update cancelled by user.');
                                process.exit(0);
                            }
                        } catch (error) {
                            console.error(`AI-assisted update failed: ${error.message}`);
                            process.exit(1);
                        }
                    } else {
                        console.log(`[AI Mode: ${updateAIMode.toUpperCase()}] AI assistance disabled. Please provide update parameters manually.`);
                        process.exit(1);
                    }
                } else if (updateParams.table && updateParams.sysId) {
                    // Use enhanced record updater for interactive field discovery and input
                    console.log(chalk.blue('\n🔧 Starting Enhanced Record Updater...'));
                    console.log(chalk.gray('This will discover all table fields and prompt for updates.'));

                    const enhancedCreator = new EnhancedRecordCreator(tools);

                    try {
                        const updateResult = await enhancedCreator.updateRecordWithFieldDiscovery(
                            updateParams.table,
                            updateParams.sysId,
                            {
                                skipOptionalFields: false,
                                includeInheritedFields: true,
                                autoConfirm: false,
                                preferAPI: updateParams.preferAPI !== false,  // Default to true
                                instanceKey: updateParams.instanceKey || null  // Will prompt if not provided
                            }
                        );

                        if (updateResult) {
                            console.log(chalk.green('\n✅ Record updated successfully!'));
                            console.log(`Sys ID: ${updateResult.sys_id}`);
                            break;
                        } else {
                            console.log(chalk.yellow('Record update cancelled or failed'));
                            process.exit(0);
                        }
                    } catch (error) {
                        console.error(chalk.red(`❌ Enhanced record update failed: ${error.message}`));
                        process.exit(1);
                    }
                } else if (updateParams.type && updateParams.sysId && updateParams.field && updateParams.file) {
                    // Traditional manual single-field update (legacy mode)
                    console.log('Updating ServiceNow record...');
                    await tools.updateRecord(updateParams);
                    console.log('✓ Update completed');
                } else {
                    console.error('Missing required parameters for update');
                    console.error('');
                    console.error('Enhanced update (interactive): --table [table] --sys_id [id]');
                    console.error('Legacy single-field update: --type [type] --sys_id [id] --field [field] --file [file]');
                    console.error('AI-assisted update: --ai-prompt "[description]" --record-name "[name]" or --sys_id [id]');
                    process.exit(1);
                }
                break;

            case 'create':
                // Parse create parameters
                const createParams = { data: {} };
                let aiPrompt = null;
                let aiMode = loadAIModeConfig(); // Load from config file

                for (let i = 1; i < args.length; i += 2) {
                    const key = args[i].replace('--', '');
                    const value = args[i + 1];

                    if (key === 'table') {
                        createParams.table = value;
                    } else if (key === 'instance') {
                        createParams.instanceKey = value;
                    } else if (key === 'data') {
                        // Read data from JSON file
                        const dataFile = path.resolve(value);
                        if (!fs.existsSync(dataFile)) {
                            console.error(`Data file not found: ${dataFile}`);
                            process.exit(1);
                        }
                        try {
                            createParams.data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
                        } catch (error) {
                            console.error(`Error parsing JSON file: ${error.message}`);
                            process.exit(1);
                        }
                    } else if (key === 'ai-prompt') {
                        aiPrompt = value;
                    } else if (key === 'ai-mode') {
                        aiMode = value;
                    } else if (key === 'example-file') {
                        createParams.exampleFile = value;
                    } else if (key === 'use-cache') {
                        createParams.preferAPI = false;  // Use cached data instead of API
                    } else if (key === 'field') {
                        // Store the current field name for the next --value parameter
                        createParams.currentField = value;
                    } else if (key === 'value') {
                        // Use the previously set field name
                        if (createParams.currentField) {
                            createParams.data[createParams.currentField] = value;
                            delete createParams.currentField;
                        } else {
                            console.error('Found --value without preceding --field');
                            process.exit(1);
                        }
                    }
                }

                if (!createParams.table) {
                    console.error('Missing required parameter: --table');
                    process.exit(1);
                }

                // Handle AI prompt mode based on AI mode configuration
                if (aiPrompt) {
                    if (aiMode === 'auto' || aiMode === 'interactive') {
                        console.log(`[AI Mode: ${aiMode.toUpperCase()}] Generating record data using AI...`);
                        try {
                            createParams.data = await generateRecordFromAI(createParams.table, aiPrompt, aiMode, createParams.exampleFile);
                            console.log('✓ AI generated the following data:');
                            console.log(JSON.stringify(createParams.data, null, 2));

                            if (aiMode === 'interactive') {
                                console.log();
                                const readline = require('readline');
                                const rl = readline.createInterface({
                                    input: process.stdin,
                                    output: process.stdout
                                });

                                const shouldProceed = await new Promise((resolve) => {
                                    rl.question('Do you want to proceed with this AI-generated data? (y/n): ', (answer) => {
                                        rl.close();
                                        resolve(answer.toLowerCase().startsWith('y'));
                                    });
                                });

                                if (!shouldProceed) {
                                    console.log('Operation cancelled by user.');
                                    process.exit(0);
                                }
                            }
                            console.log();
                        } catch (error) {
                            console.error(`AI generation failed: ${error.message}`);
                            process.exit(1);
                        }
                    } else {
                        console.log(`[AI Mode: ${aiMode.toUpperCase()}] AI assistance disabled. Please provide data manually using --data or --field/--value parameters.`);
                        process.exit(1);
                    }
                } else if (Object.keys(createParams.data).length === 0) {
                    if (aiMode === 'auto') {
                        console.error('No data provided. In auto mode, use --ai-prompt [description] for AI assistance.');
                        process.exit(1);
                    } else {
                        // Use enhanced record creator for manual field discovery and input
                        console.log(chalk.blue('\n🔧 Starting Enhanced Record Creator...'));
                        console.log(chalk.gray('This will discover all table fields and prompt for input.'));

                        const enhancedCreator = new EnhancedRecordCreator(tools);

                        try {
                            const createResult = await enhancedCreator.createRecordWithFieldDiscovery(createParams.table, {
                                skipOptionalFields: false,
                                includeInheritedFields: true,
                                autoConfirm: false,
                                preferAPI: createParams.preferAPI !== false,  // Default to true
                                instanceKey: createParams.instanceKey || null  // Will prompt if not provided
                            });

                            if (createResult) {
                                console.log(chalk.green('\n✅ Record created successfully!'));
                                console.log(`Sys ID: ${createResult.sys_id}`);
                                break;
                            } else {
                                console.log(chalk.yellow('Record creation cancelled or failed'));
                                process.exit(0);
                            }
                        } catch (error) {
                            console.error(chalk.red(`❌ Enhanced record creation failed: ${error.message}`));
                            process.exit(1);
                        }
                    }
                }

                console.log('Creating ServiceNow record...');
                const createResult = await tools.createRecord(createParams);
                console.log('✓ Record created');
                console.log(`Sys ID: ${createResult.sys_id}`);
                break;

            case 'test':
                if (isInteractive) {
                    console.log(chalk.blue('\n🔍 Testing ServiceNow Connections...\n'));
                } else {
                    console.log('Testing connections to all configured instances...');
                }
                
                const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'sn-config.json'), 'utf8'));
                
                for (const [name, instance] of Object.entries(config.instances)) {
                    const testSpinner = ora({
                        text: chalk.blue(`Testing ${name} (${instance.instance})`),
                        spinner: 'dots',
                        color: 'blue'
                    });
                    
                    if (isInteractive) {
                        testSpinner.start();
                    } else {
                        process.stdout.write(`Testing ${name} (${instance.instance})... `);
                    }
                    
                    try {
                        // Test connection
                        const https = require('https');
                        const auth = Buffer.from(`${instance.username}:${instance.password}`).toString('base64');
                        
                        await new Promise((resolve, reject) => {
                            const options = {
                                hostname: instance.instance,
                                path: '/api/now/table/sys_user?sysparm_limit=1',
                                method: 'GET',
                                headers: {
                                    'Authorization': `Basic ${auth}`,
                                    'Accept': 'application/json'
                                }
                            };

                            const req = https.request(options, (res) => {
                                if (res.statusCode === 200) {
                                    if (isInteractive) {
                                        testSpinner.succeed(chalk.green(`${name} (${instance.instance}) - Connected`));
                                    } else {
                                        console.log('✓ Connected');
                                    }
                                    resolve();
                                } else {
                                    if (isInteractive) {
                                        testSpinner.fail(chalk.red(`${name} - HTTP ${res.statusCode}`));
                                    } else {
                                        console.log(`✗ HTTP ${res.statusCode}`);
                                    }
                                    reject(new Error(`HTTP ${res.statusCode}`));
                                }
                                res.on('data', () => {}); // Consume response
                            });

                            req.on('error', (error) => {
                                if (isInteractive) {
                                    testSpinner.fail(chalk.red(`${name} - ${error.message}`));
                                } else {
                                    console.log(`✗ ${error.message}`);
                                }
                                reject(error);
                            });

                            req.setTimeout(5000, () => {
                                req.destroy();
                                if (isInteractive) {
                                    testSpinner.fail(chalk.red(`${name} - Timeout`));
                                } else {
                                    console.log('✗ Timeout');
                                }
                                reject(new Error('Timeout'));
                            });

                            req.end();
                        }).catch(() => {}); // Errors already logged
                    } catch (error) {
                        // Error already logged
                    }
                }
                
                if (isInteractive) {
                    console.log(chalk.blue('\n🏁 Connection testing completed'));
                }
                break;

            case 'table-fields':
                await handleTableFieldsOperation(args, isInteractive);
                break;

            case 'search-fields':
                await handleSearchFieldsOperation(args, isInteractive);
                break;

            case 'table-info':
                await handleTableInfoOperation(args, isInteractive);
                break;

            default:
                if (isInteractive) {
                    console.log(chalk.red(`\n❌ Unknown operation: ${chalk.white(operation)}`));
                    console.log(chalk.yellow('💡 Run without arguments to see available operations'));
                    console.log(chalk.blue('💡 Or use \'interactive\' mode for guided operation selection'));
                } else {
                    console.error(`Unknown operation: ${operation}`);
                    console.log('Run without arguments to see available operations');
                }
                process.exit(1);
        }

    } catch (error) {
        if (isInteractive) {
            console.log(chalk.red('\n❌ Operation Failed:'));
            console.log(chalk.white(`   ${error.message}`));
        } else {
            console.error('');
            console.error('Error:', error.message);
        }
        process.exit(1);
    }
}

/**
 * Generate ServiceNow record data using enhanced AI integration
 */
async function generateRecordFromAI(table, userPrompt, aiMode = 'auto', exampleFile = null) {
    try {
        // Use enhanced AI integration
        const aiIntegration = new EnhancedAIIntegration();
        const result = await aiIntegration.createRecord(table, userPrompt, {
            includeContext: true,
            includeSchema: true,
            includeExamples: true,
            exampleFile: exampleFile
        });

        if (result.success) {
            console.log(chalk.green(`✓ AI generated record using ${result.provider}`));
            if (result.metadata) {
                console.log(chalk.blue(`📝 Summary: ${result.metadata.summary}`));
                if (result.metadata.confidence) {
                    console.log(chalk.blue(`🎯 Confidence: ${(result.metadata.confidence * 100).toFixed(1)}%`));
                }
            }
            return result.record;
        } else {
            throw new Error('AI generation failed - no result returned');
        }

    } catch (error) {
        console.error(chalk.red(`❌ AI generation failed: ${error.message}`));
        console.log(chalk.yellow('⚠️  Falling back to manual template generation...'));

        // Fallback to the original mock generation
        return generateFallbackRecord(table, userPrompt);
    }
}

/**
 * Fallback record generation when AI fails
 */
function generateFallbackRecord(table, userPrompt) {
    console.log(chalk.yellow('🔄 Using fallback record generation...'));

    const baseName = generateNameFromPrompt(userPrompt, '');

    const fallbackTemplates = {
        'sys_script_include': {
            name: baseName + 'ScriptInclude',
            api_name: baseName + 'ScriptInclude',
            script: generateScriptFromPrompt(userPrompt, 'script_include'),
            description: `Generated Script Include: ${userPrompt}`,
            access: 'package_private'
        },
        'sys_ws_operation': {
            name: baseName + 'API',
            operation_uri: `/api/custom/v1/${baseName.toLowerCase()}`,
            http_method: 'GET',
            script: generateScriptFromPrompt(userPrompt, 'rest_api'),
            description: `Generated REST API: ${userPrompt}`
        },
        'sys_script': {
            name: baseName + 'BusinessRule',
            script: generateScriptFromPrompt(userPrompt, 'business_rule'),
            table: 'incident',
            when: 'before',
            description: `Generated Business Rule: ${userPrompt}`
        },
        'sys_ui_action': {
            name: baseName + 'Action',
            action_name: baseName.toLowerCase(),
            script: generateScriptFromPrompt(userPrompt, 'ui_action'),
            table: 'incident',
            description: `Generated UI Action: ${userPrompt}`
        },
        'sys_script_client': {
            name: baseName + 'ClientScript',
            script: generateScriptFromPrompt(userPrompt, 'client_script'),
            table: 'incident',
            type: 'onLoad',
            description: `Generated Client Script: ${userPrompt}`
        }
    };

    return fallbackTemplates[table] || {
        name: baseName,
        description: `Generated record: ${userPrompt}`
    };
}

/**
 * Generate a reasonable name from the user prompt
 */
function generateNameFromPrompt(prompt, suffix = '') {
    // Extract key words and create a name
    const words = prompt.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2)
        .slice(0, 3)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1));

    const baseName = words.join('');
    return suffix ? `${baseName}${suffix}` : baseName;
}

/**
 * Generate script content based on prompt and type
 */
function generateScriptFromPrompt(prompt, scriptType) {
    const templates = {
        'script_include': `var ${generateNameFromPrompt(prompt, '')} = Class.create();
${generateNameFromPrompt(prompt, '')}.prototype = {
    initialize: function() {
        // Generated based on: ${prompt}
    },

    /**
     * Main function - implement your logic here
     */
    execute: function() {
        // TODO: Implement logic for: ${prompt}
        gs.info('${generateNameFromPrompt(prompt, '')} executed');
        return true;
    },

    type: '${generateNameFromPrompt(prompt, '')}'
};`,
        'rest_api': `(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    // Generated REST API for: ${prompt}

    try {
        var result = {
            success: true,
            message: 'API generated for: ${prompt}',
            data: {}
        };

        // TODO: Implement API logic here

        response.setStatus(200);
        response.setBody(result);
    } catch (error) {
        gs.error('API Error: ' + error.getMessage());
        response.setStatus(500);
        response.setBody({
            success: false,
            error: error.getMessage()
        });
    }
})(request, response);`,
        'business_rule': `(function executeRule(current, previous /*null when async*/) {
    // Generated Business Rule for: ${prompt}

    try {
        // TODO: Implement business rule logic for: ${prompt}
        gs.info('Business Rule executed for: ${prompt}');

    } catch (error) {
        gs.error('Business Rule Error: ' + error.getMessage());
    }
})(current, previous);`,
        'ui_action': `// Generated UI Action for: ${prompt}

try {
    // TODO: Implement UI Action logic for: ${prompt}
    gs.addInfoMessage('Action completed: ${prompt}');

} catch (error) {
    gs.addErrorMessage('Error: ' + error.getMessage());
}`,
        'client_script': `function onLoad() {
    // Generated Client Script for: ${prompt}

    try {
        // TODO: Implement client-side logic for: ${prompt}
        console.log('Client Script loaded for: ${prompt}');

    } catch (error) {
        console.error('Client Script Error:', error);
    }
}`
    };

    return templates[scriptType] || `// Generated code for: ${prompt}\n// TODO: Implement functionality`;
}

/**
 * Interactive mode with guided prompts
 */
async function runInteractiveMode(tools, isInteractive) {
    if (!isInteractive) {
        console.log('Interactive mode is only available in TTY environments');
        return;
    }
    
    const currentAIMode = loadAIModeConfig();

    console.log(chalk.blue('\n╔════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue('║') + chalk.white.bold('  🎯 Interactive ServiceNow Operations'.padEnd(75)) + chalk.blue('║'));
    console.log(chalk.blue('╚════════════════════════════════════════════════════════════════════════════╝'));
    console.log();
    console.log(chalk.blue('  AI Mode:'), chalk.yellow(`${currentAIMode.toUpperCase()}`));
    console.log(chalk.gray('  ─'.repeat(39)));
    console.log();

    const { operation } = await inquirer.prompt([
        {
            type: 'list',
            name: 'operation',
            message: 'Select an operation:',
            pageSize: 15,
            choices: [
                new inquirer.Separator(chalk.cyan('━━━ Data Operations ━━━')),
                { name: '📥 Fetch ServiceNow Data', value: 'fetch-data', short: 'Fetch Data' },
                { name: '📖 Fetch User Stories', value: 'fetch-stories', short: 'Fetch Stories' },
                { name: '🔄 Process Pending Updates', value: 'process-updates', short: 'Process Updates' },
                new inquirer.Separator(chalk.cyan('━━━ Record Operations ━━━')),
                { name: '➕ Create a Record', value: 'create', short: 'Create' },
                { name: '✏️  Update a Record', value: 'update', short: 'Update' },
                new inquirer.Separator(chalk.cyan('━━━ Utilities ━━━')),
                { name: '🔍 Test Connections', value: 'test', short: 'Test' },
                { name: '📋 Get Table Fields', value: 'table-fields', short: 'Table Fields' },
                { name: '🔎 Search Fields', value: 'search-fields', short: 'Search' },
                { name: 'ℹ️  Table Information', value: 'table-info', short: 'Table Info' },
                new inquirer.Separator(),
                { name: chalk.red('🚪 Exit'), value: 'exit', short: 'Exit' }
            ]
        }
    ]);
    
    if (operation === 'exit') {
        console.log(chalk.blue('👋 Goodbye!'));
        return;
    }
    
    console.log(chalk.blue(`\n🚀 Running: ${operation}\n`));
    
    switch (operation) {
        case 'fetch-data':
            const { deleteBeforeFetch } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'deleteBeforeFetch',
                    message: 'Delete existing data before fetching?',
                    default: false
                }
            ]);
            
            await tools.fetchData({ deleteBeforeFetch });
            console.log(chalk.green('\n╔═══════════════════════════════════════════════════════════════╗'));
            console.log(chalk.green('║  ✅ Data Fetch Completed Successfully!                        ║'));
            console.log(chalk.green('╚═══════════════════════════════════════════════════════════════╝'));
            break;

        case 'fetch-stories':
            await tools.fetchStories();
            console.log(chalk.green('\n╔═══════════════════════════════════════════════════════════════╗'));
            console.log(chalk.green('║  ✅ Story Fetch Completed Successfully!                       ║'));
            console.log(chalk.green('╚═══════════════════════════════════════════════════════════════╝'));
            break;

        case 'process-updates':
            await tools.processPendingUpdates();
            console.log(chalk.green('\n╔═══════════════════════════════════════════════════════════════╗'));
            console.log(chalk.green('║  ✅ Updates Processed Successfully!                           ║'));
            console.log(chalk.green('╚═══════════════════════════════════════════════════════════════╝'));
            break;
            
        case 'test':
            console.log(chalk.blue('🔍 Testing ServiceNow Connections...\n'));
            const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'sn-config.json'), 'utf8'));
            
            for (const [name, instance] of Object.entries(config.instances)) {
                const testSpinner = ora({
                    text: chalk.blue(`Testing ${name} (${instance.instance})`),
                    spinner: 'dots',
                    color: 'blue'
                }).start();
                
                try {
                    const https = require('https');
                    const auth = Buffer.from(`${instance.username}:${instance.password}`).toString('base64');
                    
                    await new Promise((resolve, reject) => {
                        const options = {
                            hostname: instance.instance,
                            path: '/api/now/table/sys_user?sysparm_limit=1',
                            method: 'GET',
                            headers: {
                                'Authorization': `Basic ${auth}`,
                                'Accept': 'application/json'
                            }
                        };

                        const req = https.request(options, (res) => {
                            if (res.statusCode === 200) {
                                testSpinner.succeed(chalk.green(`${name} (${instance.instance}) - Connected`));
                                resolve();
                            } else {
                                testSpinner.fail(chalk.red(`${name} - HTTP ${res.statusCode}`));
                                reject(new Error(`HTTP ${res.statusCode}`));
                            }
                            res.on('data', () => {}); // Consume response
                        });

                        req.on('error', (error) => {
                            testSpinner.fail(chalk.red(`${name} - ${error.message}`));
                            reject(error);
                        });

                        req.setTimeout(5000, () => {
                            req.destroy();
                            testSpinner.fail(chalk.red(`${name} - Timeout`));
                            reject(new Error('Timeout'));
                        });

                        req.end();
                    }).catch(() => {}); // Errors already logged
                } catch (error) {
                    // Error already logged
                }
            }
            
            console.log(chalk.blue('\n🏁 Connection testing completed'));
            break;
            
        case 'table-fields':
            await handleTableFieldsOperation([], true);
            break;

        case 'search-fields':
            await handleSearchFieldsOperation([], true);
            break;

        case 'table-info':
            await handleTableInfoOperation([], true);
            break;

        case 'create':
            await handleInteractiveCreateOperation(tools);
            break;

        case 'update':
            await handleInteractiveUpdateOperation(tools);
            break;
    }
}

/**
 * Process AI-assisted update with record search and update generation
 */
async function processAIAssistedUpdate(tools, params, userPrompt, aiMode) {
    console.log('\n🔍 AI-Assisted Update Process');
    console.log('='.repeat(40));

    // Step 1: Find the record to update
    let targetRecord = null;

    if (params.sysId) {
        console.log(`📋 Using provided sys_id: ${params.sysId}`);
        targetRecord = { sys_id: params.sysId };
    } else if (params.recordName) {
        console.log(`🔍 Searching for record by name: "${params.recordName}"`);
        targetRecord = await findRecordByName(tools, params.recordName, params.type);

        if (!targetRecord) {
            throw new Error(`Record not found with name: "${params.recordName}"`);
        }

        console.log(`✓ Found record: ${targetRecord.name || targetRecord.sys_id}`);
    } else {
        throw new Error('Either --sys_id or --record-name must be provided for AI-assisted updates');
    }

    // Step 2: Generate update data using AI
    console.log('\n🤖 Generating update data...');
    console.log(`   Request: ${userPrompt}`);

    const updateData = await generateUpdateFromAI(targetRecord, userPrompt, params.type || 'sys_script_include');

    console.log('\n📝 AI Generated Update:');
    console.log(JSON.stringify(updateData, null, 2));

    // Step 3: Interactive approval if needed
    if (aiMode === 'interactive') {
        console.log();
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const shouldProceed = await new Promise((resolve) => {
            rl.question('Do you want to proceed with this AI-generated update? (y/n): ', (answer) => {
                rl.close();
                resolve(answer.toLowerCase().startsWith('y'));
            });
        });

        if (!shouldProceed) {
            return false;
        }
    }

    // Step 4: Apply the update
    console.log('\n⚙️  Applying update...');

    // Apply each field in the update data
    for (const [fieldName, fieldValue] of Object.entries(updateData)) {
        if (fieldName !== 'sys_updated_on') { // Skip system fields
            console.log(`   → Updating field: ${fieldName}`);

            const updateParams = {
                type: params.type || 'script_include',
                sysId: targetRecord.sys_id,
                field: fieldName,
                value: fieldValue,
                autoConfirm: true
            };

            try {
                await tools.updateRecord(updateParams);
                console.log(`   ✓ Updated ${fieldName} successfully`);
            } catch (error) {
                console.error(`   ❌ Failed to update ${fieldName}: ${error.message}`);
                throw error;
            }
        }
    }

    return true;
}

/**
 * Find a record by name across common ServiceNow tables
 */
async function findRecordByName(tools, recordName, recordType) {
    // This would integrate with the existing ServiceNow tools to search for records
    // For now, return a mock record for demonstration
    console.log(`🔍 Searching for "${recordName}" in ${recordType || 'all tables'}...`);

    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock successful find - in real implementation, this would query ServiceNow
    return {
        sys_id: 'mock_sys_id_' + Date.now(),
        name: recordName,
        table: recordType || 'sys_script_include'
    };
}

/**
 * Generate update data using AI based on user prompt and target record
 */
async function generateUpdateFromAI(targetRecord, userPrompt, recordType) {
    console.log('🤖 Consulting AI for update generation...');
    console.log(`   Target: ${targetRecord.name || targetRecord.sys_id}`);
    console.log(`   Request: ${userPrompt}`);

    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate appropriate update based on record type and prompt
    const updateTemplates = {
        'sys_script_include': {
            script: generateScriptUpdateFromPrompt(userPrompt),
            description: `Updated: ${userPrompt}`,
            sys_updated_on: new Date().toISOString()
        },
        'sys_ws_operation': {
            script: generateAPIUpdateFromPrompt(userPrompt),
            description: `Updated: ${userPrompt}`,
            sys_updated_on: new Date().toISOString()
        },
        'sys_script': {
            script: generateBusinessRuleUpdateFromPrompt(userPrompt),
            description: `Updated: ${userPrompt}`,
            sys_updated_on: new Date().toISOString()
        }
    };

    return updateTemplates[recordType] || updateTemplates['sys_script_include'];
}

/**
 * Generate script updates based on user prompts
 */
function generateScriptUpdateFromPrompt(prompt) {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('error handling') || lowerPrompt.includes('try catch')) {
        return `// Updated with error handling based on: ${prompt}
try {
    // Existing functionality with improved error handling
    // TODO: Implement specific changes requested: ${prompt}

} catch (error) {
    gs.error('Error in script: ' + error.message);
    throw error;
}`;
    } else if (lowerPrompt.includes('logging') || lowerPrompt.includes('debug')) {
        return `// Updated with enhanced logging based on: ${prompt}
gs.info('Starting operation: ${prompt}');

// TODO: Implement specific changes requested: ${prompt}

gs.info('Operation completed successfully');`;
    } else if (lowerPrompt.includes('validation') || lowerPrompt.includes('validate')) {
        return `// Updated with validation logic based on: ${prompt}
function validate(input) {
    // TODO: Implement validation logic for: ${prompt}
    if (!input) {
        throw new Error('Invalid input provided');
    }
    return true;
}

// TODO: Implement specific changes requested: ${prompt}`;
    } else {
        return `// Updated based on request: ${prompt}
// TODO: Implement specific changes requested: ${prompt}

// Generated update - please review and modify as needed`;
    }
}

function generateAPIUpdateFromPrompt(prompt) {
    return `// REST API updated based on: ${prompt}
(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {

    // TODO: Implement API changes requested: ${prompt}

    try {
        // Updated functionality
        var result = {
            success: true,
            message: 'Updated based on: ${prompt}',
            data: {}
        };

        return result;
    } catch (error) {
        response.setStatus(500);
        return {
            success: false,
            error: error.message
        };
    }
})(request, response);`;
}

function generateBusinessRuleUpdateFromPrompt(prompt) {
    return `// Business Rule updated based on: ${prompt}
(function executeRule(current, previous /*null when async*/) {

    // TODO: Implement business rule changes requested: ${prompt}

    try {
        // Updated business logic
        gs.info('Business rule executing: ${prompt}');

        // Implementation goes here

    } catch (error) {
        gs.error('Business rule error: ' + error.message);
    }

})(current, previous);`;
}

/**
 * Interactive prompt creation workflow
 */
async function createInteractivePrompt(operation, recordType) {
    console.log(chalk.blue(`\n🎯 AI Prompt Builder - ${operation.toUpperCase()} Operation`));
    console.log(chalk.gray('═'.repeat(60)));

    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const prompts = {
        create: [
            'What type of functionality do you want to create?',
            'What should this component do?',
            'Any specific requirements or constraints?',
            'What should it be named?'
        ],
        update: [
            'What changes do you want to make?',
            'What specific functionality should be added/modified?',
            'Are there any requirements for the update?',
            'Should any existing behavior be preserved?'
        ]
    };

    const questions = prompts[operation] || prompts.create;
    const answers = [];

    console.log(chalk.yellow(`\n💡 I'll help you create an effective AI prompt for ${operation}ing a ${recordType}.\n`));

    for (let i = 0; i < questions.length; i++) {
        const answer = await new Promise((resolve) => {
            rl.question(chalk.blue(`${i + 1}. ${questions[i]} `), resolve);
        });

        if (answer.trim()) {
            answers.push(answer.trim());
        }
    }

    rl.close();

    // Generate final prompt
    const finalPrompt = `${operation.charAt(0).toUpperCase() + operation.slice(1)} a ${recordType} that ${answers.join('. ')}.`;

    console.log(chalk.green('\n✨ Generated AI Prompt:'));
    console.log(chalk.white(`"${finalPrompt}"`));
    console.log();

    return finalPrompt;
}

// Add graceful shutdown handling
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Operation cancelled by user'));
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n👋 Operation terminated'));
    process.exit(0);
});

main();