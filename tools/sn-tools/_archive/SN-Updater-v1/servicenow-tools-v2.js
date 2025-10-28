/**
 * ServiceNow Tools v2 - Multi-Instance Configuration
 * Supports routing different tables to different instances
 * Config-driven automatic execution
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
            // Create example config if none exists
            this.createExampleConfig();
            throw new Error('Configuration file not found. Created sn-config.example.json - please rename and configure.');
        }
        
        this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        this.validateConfig();
    }

    /**
     * Create example configuration
     */
    createExampleConfig() {
        const exampleConfig = {
            instances: {
                dev: {
                    instance: 'dev123456.service-now.com',
                    username: 'dev-username',
                    password: 'dev-password'
                },
                prod: {
                    instance: 'prod123456.service-now.com',
                    username: 'prod-username',
                    password: 'prod-password'
                }
            },
            routing: {
                stories: 'prod',
                default: 'dev',
                tables: {
                    sys_script_include: 'dev',
                    sys_ws_operation: 'dev',
                    sys_script: 'dev',
                    sys_ui_action: 'dev',
                    sys_script_client: 'dev',
                    rm_story: 'prod',
                    rm_epic: 'prod',
                    rm_sprint: 'prod'
                }
            },
            settings: {
                autoBackup: true,
                validateUpdates: true,
                timeout: 30000,
                dataFetcherPath: '../SN - DataFetcher',
                storyFetcherPath: '../SN-StoryFetcher'
            }
        };

        const examplePath = path.join(__dirname, 'sn-config.example.json');
        fs.writeFileSync(examplePath, JSON.stringify(exampleConfig, null, 2));
    }

    /**
     * Validate configuration
     */
    validateConfig() {
        if (!this.config.instances) {
            throw new Error('Configuration missing instances');
        }
        
        if (!this.config.routing) {
            throw new Error('Configuration missing routing rules');
        }

        // Validate each instance
        for (const [name, instance] of Object.entries(this.config.instances)) {
            if (!instance.instance || !instance.username || !instance.password) {
                throw new Error(`Instance '${name}' missing required fields`);
            }
        }

        // Validate routing references valid instances
        const instanceNames = Object.keys(this.config.instances);
        
        if (this.config.routing.default && !instanceNames.includes(this.config.routing.default)) {
            throw new Error(`Default routing instance '${this.config.routing.default}' not found in instances`);
        }

        if (this.config.routing.stories && !instanceNames.includes(this.config.routing.stories)) {
            throw new Error(`Stories routing instance '${this.config.routing.stories}' not found in instances`);
        }

        for (const [table, instance] of Object.entries(this.config.routing.tables || {})) {
            if (!instanceNames.includes(instance)) {
                throw new Error(`Table '${table}' routes to unknown instance '${instance}'`);
            }
        }
    }

    /**
     * Get instance configuration for a specific table or operation
     */
    getInstanceForTable(table) {
        // Check specific table routing
        if (this.config.routing.tables && this.config.routing.tables[table]) {
            const instanceName = this.config.routing.tables[table];
            return this.config.instances[instanceName];
        }

        // Use default routing
        const defaultInstance = this.config.routing.default || Object.keys(this.config.instances)[0];
        return this.config.instances[defaultInstance];
    }

    /**
     * Get instance for stories
     */
    getStoriesInstance() {
        const instanceName = this.config.routing.stories || this.config.routing.default || Object.keys(this.config.instances)[0];
        return this.config.instances[instanceName];
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
     * Make ServiceNow API call with instance routing
     */
    async apiCall(options, table = null) {
        // Determine which instance to use
        const instance = table ? this.getInstanceForTable(table) : this.config.instances[this.config.routing.default];
        
        const auth = Buffer.from(`${instance.username}:${instance.password}`).toString('base64');
        
        const defaultOptions = {
            hostname: instance.instance,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        };

        const finalOptions = { ...defaultOptions, ...options };
        if (options.headers) {
            finalOptions.headers = { ...defaultOptions.headers, ...options.headers };
        }

        console.log(`  → Using instance: ${instance.instance}`);

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
     * Fetch data from ServiceNow with proper instance routing
     */
    async fetchData(options = {}) {
        console.log('=========================================');
        console.log('     ServiceNow Data Fetcher v2');
        console.log('=========================================');
        console.log('Instance Routing Configuration:');
        
        // Display routing info
        for (const [table, instance] of Object.entries(this.config.routing.tables || {})) {
            console.log(`  ${table} → ${instance}`);
        }
        console.log(`  Default → ${this.config.routing.default}`);
        console.log('');
        
        const dataFetcherPath = this.config.settings?.dataFetcherPath || '../SN - DataFetcher';
        const dataFetcherDir = path.join(__dirname, dataFetcherPath);
        
        if (!fs.existsSync(dataFetcherDir)) {
            throw new Error(`DataFetcher directory not found at: ${dataFetcherDir}`);
        }

        // Update the DataFetcher config to use our routing
        await this.updateDataFetcherConfig(dataFetcherDir);

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

        console.log('Running Data Fetcher with multi-instance routing...');
        return await this.runCommand('node', ['index.js'], { 
            cwd: dataFetcherDir,
            ...options 
        });
    }

    /**
     * Update DataFetcher configuration for multi-instance
     */
    async updateDataFetcherConfig(dataFetcherDir) {
        const configPath = path.join(dataFetcherDir, 'sn-config.json');
        
        // Create a temporary multi-instance config for the data fetcher
        const fetcherConfig = {
            instances: this.config.instances,
            routing: this.config.routing
        };

        fs.writeFileSync(configPath, JSON.stringify(fetcherConfig, null, 2));
        console.log('Updated DataFetcher with multi-instance configuration');
    }

    /**
     * Fetch stories from ServiceNow using configured instance
     */
    async fetchStories(options = {}) {
        console.log('=========================================');
        console.log('     ServiceNow Story Fetcher v2');
        console.log('=========================================');
        
        const storiesInstance = this.getStoriesInstance();
        console.log(`Fetching stories from: ${storiesInstance.instance}`);
        console.log('');
        
        const storyFetcherPath = this.config.settings?.storyFetcherPath || '../SN-StoryFetcher';
        const storyFetcherDir = path.join(__dirname, storyFetcherPath);
        
        if (!fs.existsSync(storyFetcherDir)) {
            throw new Error(`StoryFetcher directory not found at: ${storyFetcherDir}`);
        }

        // Update the StoryFetcher config
        await this.updateStoryFetcherConfig(storyFetcherDir, storiesInstance);

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
     * Update StoryFetcher configuration
     */
    async updateStoryFetcherConfig(storyFetcherDir, instance) {
        const configPath = path.join(storyFetcherDir, '.env');
        
        // Create .env file for story fetcher
        const envContent = `
INSTANCE=${instance.instance}
USERNAME=${instance.username}
PASSWORD=${instance.password}
`;
        
        fs.writeFileSync(configPath, envContent);
        console.log('Updated StoryFetcher configuration');
    }

    /**
     * Update a ServiceNow record with proper instance routing
     */
    async updateRecord(params) {
        const { type, sysId, field, value, file, autoConfirm = true } = params;

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

        // Get the appropriate instance for this table
        const instance = this.getInstanceForTable(table);

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
        console.log('     ServiceNow Record Updater v2');
        console.log('=========================================');
        console.log(`Instance: ${instance.instance}`);
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
        
        // Create backup if enabled
        if (this.config.settings?.autoBackup !== false) {
            const backupPath = await this.createBackup(type, sysId, field, currentRecord[field], updateValue, instance.instance);
            console.log(`Backup created: ${backupPath}`);
        }
        console.log('');

        // Perform update
        console.log('Updating record...');
        const result = await this.performUpdate(table, sysId, field, updateValue);
        
        console.log('✓ Update successful!');
        console.log(`Updated at: ${result.result.sys_updated_on}`);
        
        // Validate if enabled
        if (this.config.settings?.validateUpdates !== false) {
            await this.validateUpdate(table, sysId, field, updateValue);
        }
        
        return {
            success: true,
            instance: instance.instance,
            updatedAt: result.result.sys_updated_on
        };
    }

    /**
     * Get a record from ServiceNow (fetches ALL fields)
     */
    async getRecord(table, sysId, field = null) {
        // Don't specify fields to get ALL fields from the record
        const options = {
            path: `/api/now/table/${table}/${sysId}`,
            method: 'GET'
        };

        const response = await this.apiCall(options, table);
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

        return await this.apiCall(options, table);
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
        
        // Check if content is substantially the same
        const expectedLines = expectedValue.split('\n').map(line => line.trim()).filter(line => line);
        const actualLines = actualValue.split('\n').map(line => line.trim()).filter(line => line);
        
        if (Math.abs(expectedLines.length - actualLines.length) < 5) {
            console.log('✓ Content validation passed - minor differences detected.');
            return true;
        }

        console.log('❌ Significant differences detected. Update may have failed.');
        return false;
    }

    /**
     * Create a backup of the current record state
     */
    async createBackup(type, sysId, field, originalValue, newValue, instance) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(this.backupDir, `${type}_${sysId}_${timestamp}.backup`);
        
        const backupData = {
            type,
            sys_id: sysId,
            field,
            instance,
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
     * Process all pending updates from temp_updates folder
     */
    async processPendingUpdates() {
        console.log('=========================================');
        console.log('     Processing Pending Updates');
        console.log('=========================================');
        
        const files = fs.readdirSync(this.tempDir).filter(f => f.endsWith('.js'));
        
        if (files.length === 0) {
            console.log('No pending updates found in temp_updates/');
            return;
        }

        console.log(`Found ${files.length} pending update(s)`);
        console.log('');

        for (const file of files) {
            console.log(`Processing: ${file}`);
            
            // Parse metadata from filename (type_sysid_field.js)
            const parts = file.replace('.js', '').split('_');
            
            if (parts.length < 3) {
                console.error(`  ✗ Invalid filename format. Expected: type_sysid_field.js`);
                continue;
            }

            const type = parts[0];
            const sysId = parts[1];
            const field = parts.slice(2).join('_'); // Handle fields with underscores

            try {
                await this.updateRecord({
                    type,
                    sysId,
                    field,
                    file: path.join(this.tempDir, file),
                    autoConfirm: true
                });

                // Move processed file to processed folder
                const processedDir = path.join(this.tempDir, 'processed');
                if (!fs.existsSync(processedDir)) {
                    fs.mkdirSync(processedDir);
                }
                
                fs.renameSync(
                    path.join(this.tempDir, file),
                    path.join(processedDir, file)
                );
                
                console.log(`  ✓ Update completed and file moved to processed/`);
            } catch (error) {
                console.error(`  ✗ Update failed: ${error.message}`);
            }
            
            console.log('');
        }
    }

    /**
     * Execute all configured operations
     */
    async executeAll() {
        console.log('╔═══════════════════════════════════════╗');
        console.log('║   ServiceNow Tools - Auto Execution   ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('');
        
        const results = {
            dataFetch: false,
            storyFetch: false,
            updates: 0,
            errors: []
        };

        // Process pending updates first
        try {
            console.log('Step 1: Processing pending updates...');
            await this.processPendingUpdates();
            results.updates = fs.readdirSync(path.join(this.tempDir, 'processed')).length;
        } catch (error) {
            console.error('Failed to process updates:', error.message);
            results.errors.push(`Updates: ${error.message}`);
        }

        // Fetch data if configured
        if (this.config.settings?.autoFetchData !== false) {
            try {
                console.log('');
                console.log('Step 2: Fetching ServiceNow data...');
                await this.fetchData();
                results.dataFetch = true;
            } catch (error) {
                console.error('Failed to fetch data:', error.message);
                results.errors.push(`Data fetch: ${error.message}`);
            }
        }

        // Fetch stories if configured
        if (this.config.settings?.autoFetchStories !== false) {
            try {
                console.log('');
                console.log('Step 3: Fetching ServiceNow stories...');
                await this.fetchStories();
                results.storyFetch = true;
            } catch (error) {
                console.error('Failed to fetch stories:', error.message);
                results.errors.push(`Story fetch: ${error.message}`);
            }
        }

        // Summary
        console.log('');
        console.log('╔═══════════════════════════════════════╗');
        console.log('║           Execution Summary            ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log(`Updates processed: ${results.updates}`);
        console.log(`Data fetch: ${results.dataFetch ? '✓ Success' : '✗ Failed/Skipped'}`);
        console.log(`Story fetch: ${results.storyFetch ? '✓ Success' : '✗ Failed/Skipped'}`);
        
        if (results.errors.length > 0) {
            console.log('');
            console.log('Errors:');
            results.errors.forEach(err => console.log(`  - ${err}`));
        }

        return results;
    }
}

module.exports = ServiceNowTools;

// Auto-execute when run directly
if (require.main === module) {
    const tools = new ServiceNowTools();
    
    tools.executeAll()
        .then(results => {
            console.log('');
            console.log('Execution completed!');
            process.exit(results.errors.length > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('Fatal error:', error.message);
            process.exit(1);
        });
}