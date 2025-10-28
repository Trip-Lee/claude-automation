/**
 * ServiceNow Tools - Unified Package
 * Combines data fetching, story fetching, and record updating into a single reusable module
 * 
 * Features:
 * - Fetch ServiceNow data (Script Includes, REST APIs, etc.)
 * - Fetch user stories and requirements
 * - Update ServiceNow records directly
 * - Automatic backup creation
 * - Configuration management
 * - CLI and programmatic API
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class ServiceNowTools {
    constructor(configPath = null) {
        this.configPath = configPath || path.join(__dirname, 'sn-config.json');
        this.config = null;
        this.rootDir = path.join(__dirname, '..');
        this.backupDir = path.join(__dirname, 'backups');
        this.tempDir = path.join(__dirname, 'temp_updates');
        
        this.loadConfig();
        this.ensureDirectories();
    }

    /**
     * Load configuration from file
     */
    loadConfig() {
        if (!fs.existsSync(this.configPath)) {
            console.error('Error: sn-config.json not found.');
            console.log('Please create it with your ServiceNow instance details.');
            console.log('Example sn-config.json:');
            console.log(JSON.stringify({
                instance: 'your-instance.service-now.com',
                username: 'your-username',
                password: 'your-password'
            }, null, 2));
            throw new Error('Configuration file not found');
        }
        
        this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    }

    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Make ServiceNow API call
     */
    async apiCall(options) {
        const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
        
        const defaultOptions = {
            hostname: this.config.instance,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        };

        const finalOptions = { ...defaultOptions, ...options };
        if (options.headers) {
            finalOptions.headers = { ...defaultOptions.headers, ...options.headers };
        }

        return new Promise((resolve, reject) => {
            const req = https.request(finalOptions, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const result = JSON.parse(responseData);
                            resolve(result);
                        } catch (e) {
                            resolve(responseData);
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (options.data) {
                req.write(options.data);
            }

            req.end();
        });
    }

    /**
     * Fetch data from ServiceNow
     */
    async fetchData(options = {}) {
        console.log('=========================================');
        console.log('     ServiceNow Data Fetcher');
        console.log('=========================================');
        
        const dataFetcherDir = path.join(this.rootDir, 'SN - DataFetcher');
        
        if (!fs.existsSync(dataFetcherDir)) {
            throw new Error('SN - DataFetcher directory not found');
        }

        const fetcherScript = path.join(dataFetcherDir, 'index.js');
        if (!fs.existsSync(fetcherScript)) {
            throw new Error('DataFetcher index.js not found');
        }

        // Check if node_modules exists
        const nodeModulesDir = path.join(dataFetcherDir, 'node_modules');
        if (!fs.existsSync(nodeModulesDir) && !options.skipInstall) {
            console.log('Installing npm dependencies...');
            await this.runCommand('npm', ['install'], { cwd: dataFetcherDir });
        }

        console.log('Running Data Fetcher...');
        return await this.runCommand('node', ['index.js'], { 
            cwd: dataFetcherDir,
            ...options 
        });
    }

    /**
     * Fetch stories from ServiceNow
     */
    async fetchStories(options = {}) {
        console.log('=========================================');
        console.log('     ServiceNow Story Fetcher');
        console.log('=========================================');
        
        const storyFetcherDir = path.join(this.rootDir, 'SN-StoryFetcher');
        
        if (!fs.existsSync(storyFetcherDir)) {
            throw new Error('SN-StoryFetcher directory not found');
        }

        const fetcherScript = path.join(storyFetcherDir, 'sn-fetcher.js');
        if (!fs.existsSync(fetcherScript)) {
            throw new Error('Story fetcher script not found');
        }

        console.log('Running Story Fetcher...');
        return await this.runCommand('node', ['sn-fetcher.js'], { 
            cwd: storyFetcherDir,
            ...options 
        });
    }

    /**
     * Update a ServiceNow record
     */
    async updateRecord(params) {
        const { type, sysId, field, value, file, autoConfirm = false } = params;

        // Validate parameters
        if (!type || !sysId || !field) {
            throw new Error('Missing required parameters: type, sysId, field');
        }

        if (!value && !file) {
            throw new Error('Must provide either value or file');
        }

        // Determine table
        const tableMap = {
            'script_include': 'sys_script_include',
            'rest_api': 'sys_ws_operation',
            'business_rule': 'sys_script',
            'ui_action': 'sys_ui_action',
            'client_script': 'sys_script_client'
        };

        const table = tableMap[type];
        if (!table) {
            throw new Error(`Invalid type: ${type}. Valid types: ${Object.keys(tableMap).join(', ')}`);
        }

        // Get update value
        let updateValue = value;
        if (file) {
            const filePath = path.resolve(file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            updateValue = fs.readFileSync(filePath, 'utf8');
        }

        console.log('=========================================');
        console.log('     ServiceNow Record Updater');
        console.log('=========================================');
        console.log(`Instance: ${this.config.instance}`);
        console.log(`Type: ${type}`);
        console.log(`Table: ${table}`);
        console.log(`Sys ID: ${sysId}`);
        console.log(`Field: ${field}`);
        console.log('');

        // Get current record
        console.log('Fetching current record...');
        const currentRecord = await this.getRecord(table, sysId, field);
        console.log(`Record Name: ${currentRecord.name || 'N/A'}`);
        console.log(`Last Updated: ${currentRecord.sys_updated_on}`);
        
        // Create backup
        const backupPath = await this.createBackup(type, sysId, field, currentRecord[field], updateValue);
        console.log(`Backup created: ${backupPath}`);
        console.log('');

        // Show preview
        if (field === 'script' || field === 'operation_script') {
            console.log('Update Preview (first 500 chars):');
            console.log('-----------------------------------');
            console.log(updateValue.substring(0, 500));
            if (updateValue.length > 500) {
                console.log(`... (${updateValue.length - 500} more characters)`);
            }
            console.log('-----------------------------------');
            console.log('');
        }

        // Confirm if not auto-confirm
        if (!autoConfirm) {
            console.log('Ready to update. Press Enter to continue or Ctrl+C to cancel...');
            await new Promise(resolve => {
                process.stdin.once('data', resolve);
            });
        } else {
            console.log('Auto-confirm enabled - proceeding with update...');
        }

        // Perform update
        console.log('Updating record...');
        const result = await this.performUpdate(table, sysId, field, updateValue);
        
        console.log('✓ Update successful!');
        console.log(`Updated at: ${result.result.sys_updated_on}`);
        
        // Validate update
        await this.validateUpdate(table, sysId, field, updateValue);
        
        return {
            success: true,
            backupPath,
            updatedAt: result.result.sys_updated_on
        };
    }

    /**
     * Get a record from ServiceNow
     */
    async getRecord(table, sysId, field) {
        const options = {
            path: `/api/now/table/${table}/${sysId}?sysparm_fields=name,sys_updated_on,${field}`,
            method: 'GET'
        };

        const response = await this.apiCall(options);
        return response.result;
    }

    /**
     * Perform the actual update
     */
    async performUpdate(table, sysId, field, value) {
        const data = JSON.stringify({ [field]: value });

        const options = {
            path: `/api/now/table/${table}/${sysId}`,
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            },
            data
        };

        return await this.apiCall(options);
    }

    /**
     * Validate the update
     */
    async validateUpdate(table, sysId, field, expectedValue) {
        console.log('');
        console.log('Validating update...');
        
        const updatedRecord = await this.getRecord(table, sysId, field);
        const actualValue = updatedRecord[field];
        
        if (actualValue === expectedValue) {
            console.log('✓ Validation successful! Record was updated correctly.');
            return true;
        }

        console.log('⚠ Validation warning: Updated value may not match exactly.');
        console.log('This could be due to ServiceNow formatting or transformation.');
        
        // Check if content is substantially the same
        const expectedLines = expectedValue.split('\n').map(line => line.trim()).filter(line => line);
        const actualLines = actualValue.split('\n').map(line => line.trim()).filter(line => line);
        
        if (expectedLines.length === actualLines.length) {
            let differences = 0;
            for (let i = 0; i < expectedLines.length; i++) {
                if (expectedLines[i] !== actualLines[i]) {
                    differences++;
                }
            }
            
            if (differences === 0) {
                console.log('✓ Content validation passed - only formatting differences detected.');
                return true;
            } else if (differences < 5) {
                console.log(`⚠ Minor differences detected (${differences} lines). This may be normal.`);
                return true;
            }
        }

        console.log('❌ Significant differences detected. Update may have failed.');
        return false;
    }

    /**
     * Create a backup of the current record state
     */
    async createBackup(type, sysId, field, originalValue, newValue) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(this.backupDir, `${type}_${sysId}_${timestamp}.backup`);
        
        const backupData = {
            type,
            sys_id: sysId,
            field,
            original_value: originalValue,
            new_value: newValue,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        return backupFile;
    }

    /**
     * Run a command and return a promise
     */
    runCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                stdio: options.silent ? 'pipe' : 'inherit',
                ...options
            });

            let output = '';
            let errorOutput = '';

            if (options.silent) {
                child.stdout.on('data', (data) => {
                    output += data.toString();
                });

                child.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });
            }

            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ code, output, errorOutput });
                } else {
                    reject(new Error(`Command failed with exit code ${code}: ${errorOutput}`));
                }
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * List all backups
     */
    listBackups(filter = {}) {
        const files = fs.readdirSync(this.backupDir);
        const backups = [];

        for (const file of files) {
            if (file.endsWith('.backup')) {
                const backupPath = path.join(this.backupDir, file);
                const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
                
                // Apply filters
                if (filter.type && backup.type !== filter.type) continue;
                if (filter.sysId && backup.sys_id !== filter.sysId) continue;
                if (filter.field && backup.field !== filter.field) continue;

                backups.push({
                    file,
                    ...backup
                });
            }
        }

        return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Restore from a backup
     */
    async restoreBackup(backupFile, autoConfirm = false) {
        const backupPath = path.join(this.backupDir, backupFile);
        
        if (!fs.existsSync(backupPath)) {
            throw new Error(`Backup file not found: ${backupFile}`);
        }

        const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        
        console.log('=========================================');
        console.log('     ServiceNow Backup Restore');
        console.log('=========================================');
        console.log(`Type: ${backup.type}`);
        console.log(`Sys ID: ${backup.sys_id}`);
        console.log(`Field: ${backup.field}`);
        console.log(`Backup Date: ${backup.timestamp}`);
        console.log('');

        if (!autoConfirm) {
            console.log('This will restore the original value. Continue? (y/N): ');
            const response = await new Promise(resolve => {
                process.stdin.once('data', (data) => {
                    resolve(data.toString().trim().toLowerCase());
                });
            });

            if (response !== 'y' && response !== 'yes') {
                console.log('Restore cancelled.');
                return false;
            }
        }

        return await this.updateRecord({
            type: backup.type,
            sysId: backup.sys_id,
            field: backup.field,
            value: backup.original_value,
            autoConfirm: true
        });
    }
}

module.exports = ServiceNowTools;

// CLI interface when run directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const tools = new ServiceNowTools();
    
    async function main() {
        try {
            switch (command) {
                case 'fetch-data':
                    await tools.fetchData();
                    break;
                    
                case 'fetch-stories':
                    await tools.fetchStories();
                    break;
                    
                case 'update':
                    const updateParams = {};
                    for (let i = 1; i < args.length; i += 2) {
                        const key = args[i].replace('--', '');
                        updateParams[key] = args[i + 1];
                    }
                    
                    // Convert camelCase
                    if (updateParams['sys_id']) {
                        updateParams.sysId = updateParams['sys_id'];
                        delete updateParams['sys_id'];
                    }
                    if (updateParams['auto-confirm']) {
                        updateParams.autoConfirm = true;
                        delete updateParams['auto-confirm'];
                    }
                    
                    await tools.updateRecord(updateParams);
                    break;
                    
                case 'list-backups':
                    const backups = tools.listBackups();
                    console.log('Available backups:');
                    backups.forEach(backup => {
                        console.log(`  ${backup.file} - ${backup.type} (${backup.timestamp})`);
                    });
                    break;
                    
                case 'restore':
                    const backupFile = args[1];
                    if (!backupFile) {
                        console.error('Please specify a backup file');
                        process.exit(1);
                    }
                    await tools.restoreBackup(backupFile, args.includes('--auto-confirm'));
                    break;
                    
                default:
                    console.log('ServiceNow Tools - Unified Interface');
                    console.log('');
                    console.log('Commands:');
                    console.log('  fetch-data              - Fetch ServiceNow data');
                    console.log('  fetch-stories           - Fetch user stories');
                    console.log('  update                  - Update a ServiceNow record');
                    console.log('    --type [type]         - Record type (script_include, rest_api, etc.)');
                    console.log('    --sys_id [id]         - System ID of the record');
                    console.log('    --field [field]       - Field to update');
                    console.log('    --file [path]         - File containing the new value');
                    console.log('    --value [value]       - Direct value (alternative to --file)');
                    console.log('    --auto-confirm        - Skip confirmation prompt');
                    console.log('  list-backups            - List all available backups');
                    console.log('  restore [file]          - Restore from a backup file');
                    console.log('    --auto-confirm        - Skip confirmation prompt');
                    console.log('');
                    console.log('Examples:');
                    console.log('  node servicenow-tools.js fetch-data');
                    console.log('  node servicenow-tools.js fetch-stories');
                    console.log('  node servicenow-tools.js update --type script_include --sys_id abc123 --field script --file update.js');
                    console.log('  node servicenow-tools.js list-backups');
                    console.log('  node servicenow-tools.js restore script_include_abc123_2024-01-15.backup');
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    }
    
    main();
}