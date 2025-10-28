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
        this.initializePaths();
        this.ensureDirectories();

        // Initialize AI integration (consolidated system)
        try {
            const UnifiedAI = require('./sn-ai-unified');
            this.aiIntegration = UnifiedAI.getInstance();
        } catch (error) {
            console.warn('AI integration not available:', error.message);
            this.aiIntegration = null;
        }
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
        
        try {
            this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        } catch (error) {
            throw new Error(`Failed to read or parse configuration file: ${error.message}`);
        }
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
            stories: {
                instance: 'prod',
                table: 'rm_story',
                query: 'active=true^assigned_toISNOTEMPTY^state!=6',
                fields: 'number,short_description,assigned_to,state,sprint'
            },
            tables: {
                sys_script_include: {
                    instance: 'dev',
                    query: 'active=true^name!=sn_',
                    fields: null  // null means all fields
                },
                sys_ws_operation: {
                    instance: 'dev',
                    query: 'active=true',
                    fields: null
                },
                sys_script: {
                    instance: 'dev',
                    query: 'active=true',
                    fields: null
                },
                sys_ui_action: {
                    instance: 'dev',
                    query: 'active=true',
                    fields: null
                },
                sys_script_client: {
                    instance: 'dev',
                    query: 'active=true',
                    fields: null
                },
                sys_db_object: {
                    instance: 'dev',
                    query: 'name=x_cadso_tenon_ma^ORname=x_cadso_tenon_mwm^ORname=x_cadso_tenon_mjb^ORsys_scope.nameSTARTSWITHx_cadso^ORsys_scope.name=global',
                    fields: null
                },
                sys_dictionary: {
                    instance: 'dev',
                    query: 'sys_scope.nameSTARTSWITHx_cadso^ORsys_scope.name=global',
                    fields: null
                }
            },
            paths: {
                outputBase: "../ServiceNow-Data",
                dataSubdir: "Data",
                autoDetect: true,
                fallbackPaths: ["./ServiceNow-Data", "../Data"],
                componentRepoName: "Component Repo",
                componentDirectories: ["Sashimono", "component-library"]
            },
            project: {
                name: "MyProject",
                scopePrefix: "x_custom",
                companyName: "MyCompany"
            },
            settings: {
                autoBackup: true,
                validateUpdates: true,
                timeout: 30000,
                dataFetcherPath: './SN-DataFetcher',
                storyFetcherPath: './SN-StoryFetcher',
                fetchAllFields: true,  // Global setting to fetch all fields by default
                sync: {
                    enableIncremental: true,  // Only fetch updated/new records
                    cleanupDeleted: true,    // Remove locally deleted records
                    fullSyncInterval: 7       // Full sync every 7 days
                }
            }
        };

        const examplePath = path.join(__dirname, 'sn-config.example.json');
        try {
            fs.writeFileSync(examplePath, JSON.stringify(exampleConfig, null, 2));
        } catch (error) {
            console.warn(`Could not create example config: ${error.message}`);
        }
    }

    /**
     * Validate configuration
     */
    validateConfig() {
        if (!this.config.instances) {
            throw new Error('Configuration missing instances');
        }
        
        // Validate each instance
        for (const [name, instance] of Object.entries(this.config.instances)) {
            if (!instance.instance || !instance.username || !instance.password) {
                throw new Error(`Instance '${name}' missing required fields`);
            }
        }

        const instanceNames = Object.keys(this.config.instances);
        
        // Validate stories configuration
        if (this.config.stories) {
            if (!this.config.stories.instance || !instanceNames.includes(this.config.stories.instance)) {
                throw new Error(`Stories instance '${this.config.stories.instance}' not found in instances`);
            }
            if (!this.config.stories.table) {
                throw new Error('Stories configuration missing table name');
            }
        }
        
        // Validate tables configuration
        if (this.config.tables) {
            for (const [tableName, tableConfig] of Object.entries(this.config.tables)) {
                if (!tableConfig.instance || !instanceNames.includes(tableConfig.instance)) {
                    throw new Error(`Table '${tableName}' instance '${tableConfig.instance}' not found`);
                }
            }
        }
        
        // Support legacy routing format
        if (this.config.routing && !this.config.tables) {
            console.log('Migrating from legacy routing format to new format...');
            this.migrateConfig();
        }
    }

    /**
     * Migrate from old config format to new format
     */
    migrateConfig() {
        // Migrate stories configuration
        if (this.config.routing.stories) {
            this.config.stories = {
                instance: this.config.routing.stories,
                table: 'rm_story',
                query: 'active=true',
                fields: null
            };
        }
        
        // Migrate tables configuration
        if (this.config.routing.tables) {
            const newTables = {};
            for (const [table, instance] of Object.entries(this.config.routing.tables)) {
                newTables[table] = {
                    instance: instance,
                    query: 'active=true',
                    fields: null
                };
            }
            this.config.tables = newTables;
        }
    }

    /**
     * Initialize dynamic paths based on configuration
     */
    initializePaths() {
        // Set default paths configuration if not present
        if (!this.config.paths) {
            this.config.paths = {
                outputBase: "../ServiceNow-Data",
                dataSubdir: "Data",
                autoDetect: true,
                fallbackPaths: ["./ServiceNow-Data", "../Data"],
                componentRepoName: "Component Repo",
                componentDirectories: ["Sashimono", "component-library"]
            };
        }

        // Set default project configuration if not present
        if (!this.config.project) {
            this.config.project = {
                name: "MyProject",
                scopePrefix: "x_custom",
                companyName: "MyCompany"
            };
        }

        // Resolve the actual output path
        this.dataOutputPath = this.resolveDataPath();
        this.dataTenonPath = path.join(this.dataOutputPath, this.config.paths.dataSubdir || "Tenon");

        console.log(`Data output path: ${this.dataOutputPath}`);
        console.log(`Project data path: ${this.dataTenonPath}`);
    }

    /**
     * Resolve the actual data output path using auto-detection and configuration
     */
    resolveDataPath() {
        const pathConfig = this.config.paths;

        // If auto-detect is enabled, try to find existing ServiceNow-Data folder
        if (pathConfig.autoDetect) {
            const detectedPath = this.autoDetectDataPath();
            if (detectedPath) {
                console.log(`Auto-detected existing data path: ${detectedPath}`);
                return detectedPath;
            }
        }

        // Use configured outputBase (resolve relative to ServiceNow-Tools directory)
        const configuredPath = path.resolve(__dirname, pathConfig.outputBase);
        if (this.isPathValid(configuredPath)) {
            return configuredPath;
        }

        // Try fallback paths
        for (const fallbackPath of pathConfig.fallbackPaths || []) {
            const resolvedFallback = path.resolve(__dirname, fallbackPath);
            if (this.isPathValid(resolvedFallback) || this.canCreatePath(resolvedFallback)) {
                console.log(`Using fallback path: ${resolvedFallback}`);
                return resolvedFallback;
            }
        }

        // Final fallback: create in ServiceNow-Tools directory
        const finalFallback = path.join(__dirname, 'ServiceNow-Data');
        console.log(`Using final fallback path: ${finalFallback}`);
        return finalFallback;
    }

    /**
     * Auto-detect existing ServiceNow-Data folder in parent directories
     */
    autoDetectDataPath() {
        let currentDir = __dirname;
        const maxLevels = 5; // Prevent infinite loop

        for (let i = 0; i < maxLevels; i++) {
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) break; // Reached root

            const potentialDataPath = path.join(parentDir, 'ServiceNow-Data');
            if (fs.existsSync(potentialDataPath) && fs.statSync(potentialDataPath).isDirectory()) {
                return potentialDataPath;
            }

            currentDir = parentDir;
        }

        return null;
    }

    /**
     * Check if a path is valid and accessible
     */
    isPathValid(dirPath) {
        try {
            return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if we can create a path (parent directory exists and is writable)
     */
    canCreatePath(dirPath) {
        try {
            const parentDir = path.dirname(dirPath);
            return fs.existsSync(parentDir) && fs.statSync(parentDir).isDirectory();
        } catch (error) {
            return false;
        }
    }

    /**
     * Get configuration for a specific table
     */
    getTableConfig(tableName) {
        if (this.config.tables && this.config.tables[tableName]) {
            const tableConfig = this.config.tables[tableName];
            return {
                instance: this.config.instances[tableConfig.instance],
                query: tableConfig.query || 'active=true',
                fields: tableConfig.fields,
                tableName: tableName
            };
        }
        
        // Default configuration if table not specified
        const defaultInstance = Object.keys(this.config.instances)[0];
        return {
            instance: this.config.instances[defaultInstance],
            query: 'active=true',
            fields: null,
            tableName: tableName
        };
    }

    /**
     * Get instance configuration for a specific table
     */
    getInstanceForTable(tableName) {
        if (this.config.tables && this.config.tables[tableName]) {
            const tableConfig = this.config.tables[tableName];
            const instance = this.config.instances[tableConfig.instance];
            if (!instance) {
                throw new Error(`No instance configuration found for '${tableConfig.instance}' (table: ${tableName})`);
            }
            return instance;
        }

        // Fall back to default instance if table not specified
        const defaultInstanceName = this.config.routing?.default || Object.keys(this.config.instances)[0];
        const defaultInstance = this.config.instances[defaultInstanceName];

        if (!defaultInstance) {
            throw new Error(`No default instance configuration found`);
        }

        return defaultInstance;
    }

    /**
     * Get configuration for stories
     */
    getStoriesConfig() {
        if (this.config.stories) {
            return {
                instance: this.config.instances[this.config.stories.instance],
                table: this.config.stories.table,
                query: this.config.stories.query || 'active=true',
                fields: this.config.stories.fields
            };
        }
        
        // Default stories configuration
        const defaultInstance = Object.keys(this.config.instances)[0];
        return {
            instance: this.config.instances[defaultInstance],
            table: 'rm_story',
            query: 'active=true',
            fields: null
        };
    }

    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        // Internal directories (ServiceNow-Tools)
        if (!fs.existsSync(this.backupDir)) {
            try {
                fs.mkdirSync(this.backupDir, { recursive: true });
            } catch (error) {
                console.warn(`Could not create backup directory: ${error.message}`);
                return;
            }
            console.log(`Created backup directory: ${this.backupDir}`);
        }
        if (!fs.existsSync(this.tempDir)) {
            try {
                fs.mkdirSync(this.tempDir, { recursive: true });
            } catch (error) {
                console.warn(`Could not create temp directory: ${error.message}`);
                return;
            }
            console.log(`Created temp directory: ${this.tempDir}`);
        }
        // Ensure processed subdirectory exists
        const processedDir = path.join(this.tempDir, 'processed');
        if (!fs.existsSync(processedDir)) {
            try {
                fs.mkdirSync(processedDir, { recursive: true });
            } catch (error) {
                console.warn(`Could not create processed directory: ${error.message}`);
                return;
            }
            console.log(`Created processed directory: ${processedDir}`);
        }

        // External directories (main project structure) - using dynamic paths
        const componentRepoName = this.config.paths.componentRepoName || 'Component Repo';
        const componentDirectories = this.config.paths.componentDirectories || ['Sashimono', 'component-library'];

        const externalDirs = [
            this.dataOutputPath,
            this.dataTenonPath,
            path.join(__dirname, '..', componentRepoName),
            ...componentDirectories.map(dir => path.join(__dirname, '..', componentRepoName, dir)),
            path.join(__dirname, '..', 'Scripts'),
            path.join(__dirname, '..', 'nvm')
        ];

        externalDirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                try {
                    fs.mkdirSync(dir, { recursive: true });
                    console.log(`Created external directory: ${dir}`);
                } catch (error) {
                    console.warn(`Could not create directory ${dir}: ${error.message}`);
                }
            }
        });

        // Ensure local development directory exists
        const localDevDir = path.join(__dirname, 'local_development');
        if (!fs.existsSync(localDevDir)) {
            try {
                fs.mkdirSync(localDevDir, { recursive: true });
            } catch (error) {
                console.warn(`Could not create local development directory: ${error.message}`);
            }
            console.log(`Created local development directory: ${localDevDir}`);
        }
    }

    /**
     * Make ServiceNow API call with instance routing
     */
    async apiCall(options, table = null) {
        // Determine which instance to use
        let instance;
        if (table) {
            const tableConfig = this.getTableConfig(table);
            instance = tableConfig.instance;
        } else {
            const defaultInstance = Object.keys(this.config.instances)[0];
            instance = this.config.instances[defaultInstance];
        }
        
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
     * Generate scope-based query
     */
    generateScopeQuery(additionalConditions = 'active=true') {
        const projectName = this.config.project?.name?.toLowerCase() || 'myproject';
        return `${additionalConditions}^sys_scope.nameLIKE${projectName}`;
    }

    /**
     * Get application mapping based on configuration
     */
    getApplicationMapping() {
        const projectName = this.config.project?.name || 'MyProject';
        const scopePrefix = this.config.project?.scopePrefix || 'x_custom';

        // Return configurable application mapping
        return {
            [`${scopePrefix}_work`]: `${projectName} Work Management`,
            [`${scopePrefix}_automate`]: `${projectName} Automation`,
            [`${scopePrefix}_core`]: `${projectName} - Core`,
            [`${scopePrefix}_journey`]: `${projectName} Journey Builder`,
            [`${scopePrefix}_cloud`]: `${projectName} Cloud Management`,
            [`${scopePrefix}_ti_gitint`]: `${projectName} GitHub Integration`,
            [`${scopePrefix}_ti_agile`]: `${projectName} Internal Agile`,
            [`${scopePrefix}_ti_devkit`]: `${projectName} Internal Developer Toolkit`,
            [`${scopePrefix}_lead`]: `${projectName} Lead Management`,
            [`${scopePrefix}_form`]: `${projectName} Form Builder`,
            [`${scopePrefix}_email_spok`]: `${projectName} Email Spoke`
        };
    }

    /**
     * Fetch data from ServiceNow with proper instance routing
     */
    async fetchData(options = {}) {
        console.log('=========================================');
        console.log('     ServiceNow Data Fetcher v2');
        console.log('=========================================');
        console.log('Table Configuration:');
        
        // Display table configuration
        if (this.config.tables) {
            for (const [table, config] of Object.entries(this.config.tables)) {
                console.log(`  ${table}:`);
                console.log(`    Instance: ${config.instance}`);
                console.log(`    Query: ${config.query || 'active=true'}`);
                console.log(`    Fields: ${config.fields || 'ALL'}`);
            }
        }
        console.log('');
        
        // Check if we should delete all data before fetching
        const shouldDeleteBeforeFetch = options.deleteBeforeFetch || this.config.settings?.deleteBeforeFetch;
        let deletedData = shouldDeleteBeforeFetch; // Set to true if delete-before-fetch is requested, regardless of whether data exists
        
        if (shouldDeleteBeforeFetch) {
            console.log('=========================================');
            console.log('     Deleting All Existing Data');
            console.log('=========================================');
            
            // Use dynamic data directory
            const dataDir = this.dataTenonPath;
            console.log(`Using data directory: ${dataDir}`);
            
            if (dataDir) {
                try {
                    // Get all entries in the directory
                    const entries = fs.readdirSync(dataDir, { withFileTypes: true });
                    const dirs = entries.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
                    const files = entries.filter(dirent => dirent.isFile()).map(dirent => dirent.name);
                    
                    if (dirs.length > 0 || files.length > 0) {
                        if (dirs.length > 0) {
                            console.log('Deleting the following directories:');
                            dirs.forEach(dir => console.log(`  - ${dir}`));
                            
                            // Delete each directory
                            for (const dir of dirs) {
                                const dirPath = path.join(dataDir, dir);
                                await fs.promises.rm(dirPath, { recursive: true, force: true });
                                console.log(`✓ Deleted directory: ${dir}`);
                            }
                        }
                        
                        if (files.length > 0) {
                            console.log('Deleting the following files:');
                            files.forEach(file => console.log(`  - ${file}`));
                            
                            // Delete each file
                            for (const file of files) {
                                const filePath = path.join(dataDir, file);
                                await fs.promises.unlink(filePath);
                                console.log(`✓ Deleted file: ${file}`);
                            }
                        }
                        
                        console.log('\n✓ All existing data deleted successfully\n');
                        deletedData = true;
                    } else {
                        console.log('No existing data found to delete.\n');
                    }
                } catch (error) {
                    console.error(`Error deleting existing data: ${error.message}`);
                    throw error;
                }
            } else {
                console.log('Data directory does not exist. Nothing to delete.\n');
            }
        }
        
        const dataFetcherPath = this.config.settings?.dataFetcherPath || './SN-DataFetcher';
        const dataFetcherDir = path.join(__dirname, dataFetcherPath);
        
        if (!fs.existsSync(dataFetcherDir)) {
            throw new Error(`DataFetcher directory not found at: ${dataFetcherDir}`);
        }

        // Prepare configuration for DataFetcher
        const fetcherConfig = await this.prepareDataFetcherConfig(deletedData);
        
        // Write config to temp file that fetcher will read
        const tempConfigPath = path.join(dataFetcherDir, '.temp-config.json');
        try {
            fs.writeFileSync(tempConfigPath, JSON.stringify(fetcherConfig, null, 2));
        } catch (error) {
            throw new Error(`Could not write temp config: ${error.message}`);
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

        console.log('Running Data Fetcher with multi-instance routing...');
        
        try {
            const result = await this.runCommand('node', ['index.js', '--config', '.temp-config.json'], {
                cwd: dataFetcherDir,
                ...options
            });

            // Clean up temp config
            if (fs.existsSync(tempConfigPath)) {
                try {
                    fs.unlinkSync(tempConfigPath);
                } catch (error) {
                    console.warn(`Could not remove temp config: ${error.message}`);
                }
            }

            return result;
        } catch (error) {
            // Clean up temp config on error
            if (fs.existsSync(tempConfigPath)) {
                fs.unlinkSync(tempConfigPath);
            }

            // AI error analysis if available
            if (this.aiIntegration) {
                console.log('🤖 AI error analysis available but not implemented yet...');
                // TODO: Implement AI error analysis in consolidated system
                /*
                try {
                    await this.aiIntegration.analyzeError(error, {
                        operation: 'fetchData',
                        config: this.config.tables ? Object.keys(this.config.tables) : 'unknown'
                    });
                } catch (aiError) {
                    console.log(`AI analysis failed: ${aiError.message}`);
                }
                */
            }

            throw error;
        }
    }

    /**
     * Prepare DataFetcher configuration for multi-instance
     */
    async prepareDataFetcherConfig(forceFullSync = false) {
        // Get first instance for base config (will be overridden per table)
        const firstInstance = Object.values(this.config.instances)[0];
        
        // Create config for each table
        const tablesToFetch = [];
        if (this.config.tables) {
            console.log(`Processing ${Object.keys(this.config.tables).length} tables from config`);
            for (const [tableName, tableConfig] of Object.entries(this.config.tables)) {
                const instance = this.config.instances[tableConfig.instance];
                if (!instance) {
                    console.log(`Warning: No instance config found for ${tableName} (instance: ${tableConfig.instance})`);
                    continue;
                }
                tablesToFetch.push({
                    name: tableName,
                    table: tableName,
                    instance: instance.instance,
                    username: instance.username,
                    password: instance.password,
                    query: tableConfig.query || 'active=true',
                    fields: tableConfig.fields === null ? null : (tableConfig.fields || ['sys_id', 'name', 'sys_created_on', 'sys_updated_on', 'sys_scope']),
                    fetchAllFields: tableConfig.fields === null
                });
            }
            console.log(`Successfully prepared ${tablesToFetch.length} tables for fetching`);
        }
        
        // Build fetcher config
        const fetcherConfig = {
            instance: firstInstance.instance,
            auth: {
                username: firstInstance.username,
                password: firstInstance.password
            },
            output: {
                baseDir: this.dataTenonPath,
                createTimestamp: false,
                organizeByApplication: true
            },
            tables: tablesToFetch,
            fetchAllFields: this.config.settings?.fetchAllFields !== false,
            sync: {
                enableIncremental: forceFullSync ? false : (this.config.settings?.sync?.enableIncremental !== false),
                cleanupDeleted: this.config.settings?.sync?.cleanupDeleted !== false,
                fullSyncInterval: this.config.settings?.sync?.fullSyncInterval || 7,
                stateFile: 'sync_state.json'
            },
            applications: {
                mapping: this.getApplicationMapping(),
                defaultApplication: "Unknown"
            }
        };

        // If we deleted data, reset sync state
        if (forceFullSync) {
            const syncStatePath = path.join(this.dataTenonPath, 'sync_state.json');
            if (fs.existsSync(syncStatePath)) {
                try {
                    fs.unlinkSync(syncStatePath);
                } catch (error) {
                    console.warn(`Could not remove sync state: ${error.message}`);
                }
                console.log('Reset sync state for full data fetch');
            }
        }
        
        return fetcherConfig;
    }

    /**
     * Fetch stories from ServiceNow using configured instance
     */
    async fetchStories(options = {}) {
        console.log('=========================================');
        console.log('     ServiceNow Story Fetcher v2');
        console.log('=========================================');
        
        const storiesConfig = this.getStoriesConfig();
        console.log(`Stories Configuration:`);
        console.log(`  Instance: ${storiesConfig.instance.instance}`);
        console.log(`  Table: ${storiesConfig.table}`);
        console.log(`  Query: ${storiesConfig.query}`);
        console.log(`  Fields: ${storiesConfig.fields || 'ALL'}`);
        console.log('');
        
        const storyFetcherPath = this.config.settings?.storyFetcherPath || './SN-StoryFetcher';
        const storyFetcherDir = path.join(__dirname, storyFetcherPath);
        
        if (!fs.existsSync(storyFetcherDir)) {
            throw new Error(`StoryFetcher directory not found at: ${storyFetcherDir}`);
        }

        // Prepare config for StoryFetcher
        const fetcherConfig = {
            instance: storiesConfig.instance.instance,
            username: storiesConfig.instance.username,
            password: storiesConfig.instance.password,
            defaultTable: storiesConfig.table,
            defaultTables: {
                [storiesConfig.table]: {
                    defaultQuery: storiesConfig.query || '',
                    fields: storiesConfig.fields ? storiesConfig.fields.split(',') : [],
                    limit: 10000
                }
            }
        };
        
        // Write config to temp file
        const tempConfigPath = path.join(storyFetcherDir, '.temp-story-config.json');
        try {
            fs.writeFileSync(tempConfigPath, JSON.stringify(fetcherConfig, null, 2));
        } catch (error) {
            throw new Error(`Could not write story config: ${error.message}`);
        }
        console.log('Prepared StoryFetcher configuration');

        const fetcherScript = path.join(storyFetcherDir, 'sn-fetcher.js');
        if (!fs.existsSync(fetcherScript)) {
            throw new Error('Story fetcher script not found');
        }

        console.log('Running Story Fetcher...');
        
        try {
            // Set environment variable to point to temp config
            const env = { ...process.env, CONFIG_FILE: '.temp-story-config.json' };
            const result = await this.runCommand('node', ['sn-fetcher.js'], { 
                cwd: storyFetcherDir,
                env,
                ...options 
            });
            
            // Clean up temp config
            if (fs.existsSync(tempConfigPath)) {
                try {
                    fs.unlinkSync(tempConfigPath);
                } catch (error) {
                    console.warn(`Could not remove temp config: ${error.message}`);
                }
            }
            
            return result;
        } catch (error) {
            // Clean up temp config on error
            if (fs.existsSync(tempConfigPath)) {
                fs.unlinkSync(tempConfigPath);
            }
            throw error;
        }
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
            try {
                updateValue = fs.readFileSync(filePath, 'utf8');
            } catch (error) {
                throw new Error(`Could not read file ${filePath}: ${error.message}`);
            }
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
     * Create a new record in ServiceNow
     *
     * IMPORTANT NOTES:
     * - For 'sysauto' table: sys_class_name is MANDATORY
     *   - Use 'sysauto_script' if the job has a script
     *   - Use 'sysauto' for non-scripted jobs
     *   - This is automatically handled if not provided
     */
    async createRecord(params) {
        const { table, data, autoConfirm = true } = params;

        // Validate parameters
        if (!table) {
            throw new Error('Missing required parameter: table');
        }

        if (!data || typeof data !== 'object') {
            throw new Error('Data must be a valid object with field/value pairs');
        }

        // IMPORTANT: sys_class_name is mandatory for sysauto records
        // Default to 'sysauto_script' if creating a scheduled job with a script
        if (table === 'sysauto' && !data.sys_class_name) {
            if (data.script && data.script.trim()) {
                data.sys_class_name = 'sysauto_script';
                console.log('🔧 Auto-added sys_class_name: sysauto_script (required for scripted scheduled jobs)');
            } else {
                data.sys_class_name = 'sysauto';
                console.log('🔧 Auto-added sys_class_name: sysauto (required for scheduled jobs)');
            }
        }

        // Get the appropriate instance for this table
        const instance = this.getInstanceForTable(table);

        console.log('=========================================');
        console.log('     ServiceNow Record Creator v2');
        console.log('=========================================');
        console.log(`Instance: ${instance.instance}`);
        console.log(`Table: ${table}`);
        console.log('');
        console.log('Record Data:');
        Object.entries(data).forEach(([key, value]) => {
            const displayValue = typeof value === 'string' && value.length > 100 
                ? value.substring(0, 100) + '...' 
                : value;
            console.log(`  ${key}: ${displayValue}`);
        });
        console.log('');

        // Perform create operation
        console.log('Creating record...');
        const result = await this.performCreate(table, data);
        
        const createdRecord = result.result;
        console.log('✓ Record created successfully!');
        console.log(`Sys ID: ${createdRecord.sys_id}`);
        console.log(`Created at: ${createdRecord.sys_created_on}`);
        
        if (createdRecord.number) {
            console.log(`Number: ${createdRecord.number}`);
        }
        if (createdRecord.name) {
            console.log(`Name: ${createdRecord.name}`);
        }
        
        // Create a backup/log of the created record if enabled
        if (this.config.settings?.autoBackup !== false) {
            const backupPath = await this.createCreationLog(table, createdRecord, instance.instance);
            console.log(`Creation log saved: ${backupPath}`);
        }
        
        return {
            success: true,
            instance: instance.instance,
            sys_id: createdRecord.sys_id,
            created_at: createdRecord.sys_created_on,
            record: createdRecord
        };
    }

    /**
     * Perform the actual record creation
     */
    async performCreate(table, recordData) {
        const data = JSON.stringify(recordData);

        const options = {
            path: `/api/now/table/${table}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            },
            data
        };

        return await this.apiCall(options, table);
    }

    /**
     * Create a log of the newly created record
     */
    async createCreationLog(table, record, instance) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFile = path.join(this.backupDir, `create_${table}_${timestamp}.log`);
        
        const logData = {
            operation: 'CREATE',
            table,
            sys_id: record.sys_id,
            instance,
            record,
            timestamp: new Date().toISOString()
        };

        try {
            fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
        } catch (error) {
            console.warn(`Could not write log file: ${error.message}`);
        }
        return logFile;
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

        try {
            fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        } catch (error) {
            console.warn(`Could not write backup file: ${error.message}`);
        }
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
        
        let files;
        try {
            files = fs.readdirSync(this.tempDir).filter(f => f.endsWith('.js'));
        } catch (error) {
            console.error(`Could not read temp directory: ${error.message}`);
            return { processed: 0, errors: 1 };
        }
        
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
                    try {
                        fs.mkdirSync(processedDir);
                    } catch (error) {
                        console.warn(`Could not create processed directory: ${error.message}`);
                    }
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
            const processedDir = path.join(this.tempDir, 'processed');
            if (fs.existsSync(processedDir)) {
                try {
                    results.updates = fs.readdirSync(processedDir).length;
                } catch (error) {
                    results.updates = 0;
                }
            } else {
                results.updates = 0;
            }
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