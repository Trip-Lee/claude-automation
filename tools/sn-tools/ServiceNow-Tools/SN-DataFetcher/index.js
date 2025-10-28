#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const cliProgress = require('cli-progress');
const ora = require('ora');
const chalk = require('chalk');
const figlet = require('figlet');
require('dotenv').config();

class ServiceNowExtractor {
    constructor(config) {
        this.config = config;
        this.instance = process.env.SN_INSTANCE || config.instance;
        this.username = process.env.SN_USERNAME || config.auth.username;
        this.password = process.env.SN_PASSWORD || config.auth.password;
        this.baseDir = process.env.OUTPUT_DIR || config.output?.baseDir || './data';
        this.debug = process.env.DEBUG === 'true';
        this.organizeByApplication = config.output?.organizeByApplication || false;
        this.applicationMapping = config.applications?.mapping || {};
        this.defaultApplication = config.applications?.defaultApplication || 'Unknown';
        
        // Sync configuration
        this.enableIncremental = config.sync?.enableIncremental || false;
        this.stateFile = path.join(this.baseDir, config.sync?.stateFile || 'sync_state.json');
        this.cleanupDeleted = config.sync?.cleanupDeleted || false;
        this.fullSyncInterval = config.sync?.fullSyncInterval || 7; // days
        
        if (!this.instance || !this.username || !this.password) {
            throw new Error('Missing required configuration: instance, username, or password');
        }

        this.client = axios.create({
            baseURL: `https://${this.instance}`,
            auth: {
                username: this.username,
                password: this.password
            },
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        this.stats = {
            tablesProcessed: 0,
            recordsExtracted: 0,
            recordsUpdated: 0,
            recordsDeleted: 0,
            filesCreated: 0,
            filesVerified: 0,
            pathValidations: 0,
            errors: 0,
            applicationCounts: {},
            startTime: new Date()
        };
        
        // CLI components
        this.spinner = null;
        this.progressBar = null;
        this.isInteractive = process.stdout.isTTY && !process.env.CI;
        
        this.syncState = null;
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        
        if (level === 'debug' && !this.debug) return;
        
        // Stop any active spinner to prevent interference
        if (this.spinner && this.spinner.isSpinning) {
            this.spinner.stop();
        }
        
        let coloredMessage;
        switch (level) {
            case 'error':
                coloredMessage = chalk.red(`❌ ${message}`);
                break;
            case 'warn':
                coloredMessage = chalk.yellow(`⚠️  ${message}`);
                break;
            case 'success':
                coloredMessage = chalk.green(`✅ ${message}`);
                break;
            case 'info':
                coloredMessage = chalk.blue(`ℹ️  ${message}`);
                break;
            case 'debug':
                coloredMessage = chalk.gray(`🔍 ${message}`);
                break;
            default:
                coloredMessage = message;
        }
        
        if (this.isInteractive) {
            console.log(coloredMessage);
        } else {
            // Fallback for non-interactive environments
            const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
            console.log(`${prefix} ${message}`);
        }
        
        // Restart spinner if it was active
        if (this.spinner && !this.spinner.isSpinning) {
            this.spinner.start();
        }
    }

    sanitizeFilename(name) {
        if (!name || typeof name !== 'string') {
            return 'unnamed_record';
        }
        
        // Remove or replace invalid Windows filename characters
        return name
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '')
            .substring(0, 100) || 'unnamed_record';
    }

    async validatePath(dirPath) {
        try {
            // Check if path is valid and within reasonable limits
            if (!dirPath || typeof dirPath !== 'string') {
                throw new Error('Invalid directory path: path must be a non-empty string');
            }
            
            // Check path length (Windows limit is ~260 characters)
            if (dirPath.length > 240) {
                throw new Error(`Path too long (${dirPath.length} chars): ${dirPath.substring(0, 50)}...`);
            }
            
            // Resolve path to check for invalid components
            const resolvedPath = path.resolve(dirPath);
            
            // Check for potentially dangerous path components
            const dangerousPatterns = ['..']; 
            for (const pattern of dangerousPatterns) {
                if (resolvedPath.includes(pattern)) {
                    this.log(`Warning: Path contains '${pattern}': ${resolvedPath}`, 'warn');
                }
            }
            
            // Verify the path is within our expected base directory
            const expectedBase = path.resolve(this.baseDir);
            if (!resolvedPath.startsWith(expectedBase)) {
                this.log(`Warning: Path outside base directory: ${resolvedPath}`, 'warn');
            }
            
            this.log(`Path validated: ${resolvedPath}`, 'debug');
            return resolvedPath;
            
        } catch (error) {
            this.log(`Path validation failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async ensureDirectoryExists(dirPath) {
        try {
            const validatedPath = await this.validatePath(dirPath);
            
            // Check if directory already exists
            if (await fs.pathExists(validatedPath)) {
                const stats = await fs.stat(validatedPath);
                if (!stats.isDirectory()) {
                    throw new Error(`Path exists but is not a directory: ${validatedPath}`);
                }
                this.log(`Directory exists: ${validatedPath}`, 'debug');
                return validatedPath;
            }
            
            // Create directory with verification
            await fs.ensureDir(validatedPath);
            
            // Verify directory was created successfully
            if (!await fs.pathExists(validatedPath)) {
                throw new Error(`Failed to create directory: ${validatedPath}`);
            }
            
            const stats = await fs.stat(validatedPath);
            if (!stats.isDirectory()) {
                throw new Error(`Created path is not a directory: ${validatedPath}`);
            }
            
            // Test write permissions
            const testFile = path.join(validatedPath, '.write_test');
            try {
                await fs.writeFile(testFile, 'test');
                await fs.remove(testFile);
            } catch (error) {
                throw new Error(`Directory not writable: ${validatedPath} - ${error.message}`);
            }
            
            this.log(`✓ Directory created and verified: ${validatedPath}`, 'debug');
            return validatedPath;
            
        } catch (error) {
            this.log(`Directory creation failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async verifyFileCreation(filePath, expectedData) {
        try {
            // Check if file was created
            if (!await fs.pathExists(filePath)) {
                throw new Error(`File was not created: ${filePath}`);
            }
            
            // Check file size
            const stats = await fs.stat(filePath);
            if (stats.size === 0) {
                throw new Error(`File created but is empty: ${filePath}`);
            }
            
            // Verify file is readable and contains valid JSON
            let fileContent;
            try {
                fileContent = await fs.readJson(filePath);
            } catch (error) {
                throw new Error(`File created but contains invalid JSON: ${filePath} - ${error.message}`);
            }
            
            // Basic content verification
            if (!fileContent._metadata || !fileContent._metadata.sys_id) {
                throw new Error(`File created but missing required metadata: ${filePath}`);
            }
            
            // Verify sys_id matches expected
            if (expectedData && expectedData.sys_id && 
                fileContent._metadata.sys_id !== expectedData.sys_id) {
                throw new Error(`File content mismatch - expected sys_id: ${expectedData.sys_id}, got: ${fileContent._metadata.sys_id}`);
            }
            
            this.log(`✓ File verified: ${path.basename(filePath)} (${stats.size} bytes)`, 'debug');
            return true;
            
        } catch (error) {
            this.log(`File verification failed: ${error.message}`, 'error');
            return false;
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async makeRequest(url, retryCount = 0) {
        try {
            this.log(`Making request to: ${url}`, 'debug');
            const response = await this.client.get(url);
            return response.data;
        } catch (error) {
            // Log detailed error information
            if (error.response) {
                this.log(`HTTP ${error.response.status}: ${error.response.statusText}`, 'error');
                if (error.response.data?.error?.message) {
                    this.log(`ServiceNow Error: ${error.response.data.error.message}`, 'error');
                }
                if (error.response.data?.error?.detail) {
                    this.log(`Detail: ${error.response.data.error.detail}`, 'error');
                }
            } else if (error.code) {
                this.log(`Network Error: ${error.code} - ${error.message}`, 'error');
            }
            
            const maxRetries = this.config.api?.retryAttempts || 3;
            
            // Don't retry on authentication errors
            if (error.response?.status === 401 || error.response?.status === 403) {
                this.log('Authentication/Permission error - not retrying', 'error');
                throw error;
            }
            
            if (retryCount < maxRetries) {
                const delayMs = (retryCount + 1) * 2000; // Exponential backoff
                this.log(`Request failed, retrying in ${delayMs}ms... (attempt ${retryCount + 1}/${maxRetries})`, 'warn');
                await this.delay(delayMs);
                return this.makeRequest(url, retryCount + 1);
            }
            
            this.log(`Request failed after ${maxRetries} attempts`, 'error');
            throw error;
        }
    }

    getApplicationName(sysScope) {
        if (!sysScope) return this.defaultApplication;
        
        // Use sys_scope for application folder grouping
        if (typeof sysScope === 'object') {
            // First try to get mapped name using scope ID
            const scopeId = sysScope.value;
            const mappedName = this.applicationMapping[scopeId];
            
            if (mappedName) {
                return mappedName;
            }
            
            // If no mapping found, use the scope display name (sys_scope.name)
            const scopeName = sysScope.display_value || scopeId;
            return this.sanitizeFilename(scopeName) || this.defaultApplication;
        }
        
        // Handle string value (fallback)
        const mappedName = this.applicationMapping[sysScope];
        return mappedName || sysScope || this.defaultApplication;
    }

    async loadSyncState() {
        try {
            if (await fs.pathExists(this.stateFile)) {
                this.syncState = await fs.readJson(this.stateFile);
                this.log(`Loaded sync state from ${this.stateFile}`, 'debug');
            } else {
                this.syncState = {
                    lastFullSync: null,
                    tables: {},
                    version: '1.0'
                };
                this.log('No sync state found, starting fresh', 'debug');
            }
        } catch (error) {
            this.log(`Failed to load sync state: ${error.message}`, 'warn');
            this.syncState = {
                lastFullSync: null,
                tables: {},
                version: '1.0'
            };
        }
    }

    async saveSyncState() {
        try {
            // Validate sync state file path
            const validatedPath = await this.validatePath(this.stateFile);
            
            // Ensure parent directory exists
            const parentDir = path.dirname(validatedPath);
            await this.ensureDirectoryExists(parentDir);
            
            await fs.writeJson(validatedPath, this.syncState, { spaces: 2 });
            this.stats.filesCreated++;
            
            // Verify sync state file
            if (await fs.pathExists(validatedPath)) {
                const stats = await fs.stat(validatedPath);
                if (stats.size > 0) {
                    this.stats.filesVerified++;
                    this.log(`✓ Sync state saved and verified: ${validatedPath}`, 'debug');
                } else {
                    this.log(`✗ Sync state file created but is empty: ${validatedPath}`, 'warn');
                    this.stats.errors++;
                }
            } else {
                this.log(`✗ Sync state file creation failed: ${validatedPath}`, 'error');
                this.stats.errors++;
            }
        } catch (error) {
            this.log(`Failed to save sync state: ${error.message}`, 'error');
            this.stats.errors++;
        }
    }

    needsFullSync(tableName) {
        if (!this.enableIncremental) return true;
        if (!this.syncState || !this.syncState.lastFullSync) return true;
        
        // Force full sync if environment variable is set
        if (process.env.FORCE_FULL_SYNC === 'true') {
            this.log('Forcing full sync due to FORCE_FULL_SYNC environment variable', 'info');
            return true;
        }
        
        const lastFullSync = new Date(this.syncState.lastFullSync);
        const daysSinceFullSync = (new Date() - lastFullSync) / (1000 * 60 * 60 * 24);
        
        return daysSinceFullSync >= this.fullSyncInterval;
    }

    getLastSyncTime(tableName) {
        if (!this.syncState || !this.syncState.tables || !this.syncState.tables[tableName]) return null;
        return this.syncState.tables[tableName].lastSync;
    }

    updateTableSyncState(tableName, recordCount, deletedCount = 0) {
        if (!this.syncState) return; // Don't update sync state if it doesn't exist
        
        if (!this.syncState.tables[tableName]) {
            this.syncState.tables[tableName] = {};
        }
        
        this.syncState.tables[tableName].lastSync = new Date().toISOString();
        this.syncState.tables[tableName].recordCount = recordCount;
        this.syncState.tables[tableName].deletedCount = deletedCount;
        
        if (this.needsFullSync(tableName)) {
            this.syncState.lastFullSync = new Date().toISOString();
        }
    }

    async extractTable(tableConfig) {
        const { name, displayName, query, fields } = tableConfig;
        const batchSize = this.config.api?.batchSize || 100;
        const rateLimitDelay = this.config.api?.rateLimitDelay || 1000;
        
        const isFullSync = this.needsFullSync(name);
        const lastSyncTime = this.getLastSyncTime(name);
        const syncType = isFullSync ? 'full' : 'incremental';
        
        // Track table extraction metrics
        const tableMetrics = {
            startTime: new Date(),
            tableName: name,
            displayName: displayName || name,
            syncType,
            query: query || 'NO QUERY SPECIFIED',
            fields: fields ? `${fields.length} fields` : 'ALL fields',
            batchCount: 0,
            totalRecords: 0,
            updatedRecords: 0,
            deletedRecords: 0,
            errors: [],
            apiCalls: 0,
            filesCreated: 0,
            filesVerified: 0
        };
        
        // Create and validate base table directory using displayName
        const folderName = this.sanitizeFilename(displayName || name);
        const tableDir = path.join(this.baseDir, folderName);
        await this.ensureDirectoryExists(tableDir);
        this.stats.pathValidations++;
        
        // Track existing records for deletion detection
        const existingRecords = new Set();
        if (this.cleanupDeleted && !isFullSync) {
            await this.collectExistingRecords(name, existingRecords, displayName);
        }
        
        let offset = 0;
        let totalRecords = 0;
        let updatedRecords = 0;
        let hasMore = true;
        
        // Initialize progress bar for this table
        let progressBar = null;
        let estimatedTotal = 1000; // Default estimate
        
        // Try to get estimated record count for better progress tracking
        try {
            const countUrl = `/api/now/stats/${name}?sysparm_count=true&sysparm_query=${encodeURIComponent(tableMetrics.finalQuery || '')}`;
            const countData = await this.makeRequest(countUrl);
            if (countData.result && countData.result.stats && countData.result.stats.count) {
                estimatedTotal = parseInt(countData.result.stats.count);
            }
        } catch (error) {
            // Count failed, use default estimate
        }
        
        if (this.isInteractive && estimatedTotal > 50) {
            progressBar = new cliProgress.SingleBar({
                format: chalk.blue('  Fetching') + ' |{bar}| {percentage}% | {value}/{total} records | ETA: {eta}s',
                barCompleteChar: '█',
                barIncompleteChar: '░',
                hideCursor: true,
                etaBuffer: 100
            }, cliProgress.Presets.shades_classic);
            
            progressBar.start(estimatedTotal, 0);
        }

        while (hasMore) {
            try {
                // Build query with incremental sync filter
                let finalQuery = query || '';
                if (!isFullSync && lastSyncTime) {
                    const incrementalFilter = `sys_updated_on>=${lastSyncTime}`;
                    finalQuery = finalQuery ? `${finalQuery}^${incrementalFilter}` : incrementalFilter;
                }
                
                // Store final query for metrics (only once)
                if (tableMetrics.batchCount === 0) {
                    tableMetrics.finalQuery = finalQuery || 'EMPTY QUERY';
                }
                
                // Build API URL
                const params = new URLSearchParams({
                    sysparm_query: finalQuery,
                    sysparm_limit: batchSize,
                    sysparm_offset: offset,
                    sysparm_display_value: 'all'
                });
                
                // Add sorting to get most recent records first
                const orderByQuery = finalQuery ? `${finalQuery}^ORDERBYDESCsys_created_on` : 'ORDERBYDESCsys_created_on';
                params.set('sysparm_query', orderByQuery);
                
                // Only add sysparm_fields if we have specific fields (null means fetch all fields)
                if (fields && Array.isArray(fields)) {
                    params.set('sysparm_fields', fields.join(','));
                }

                const url = `/api/now/table/${name}?${params}`;
                const data = await this.makeRequest(url);
                tableMetrics.apiCalls++;
                
                const records = data.result || [];
                tableMetrics.batchCount++;
                
                // Update progress bar (early update with batch size)
                if (progressBar) {
                    const currentProgress = Math.min(totalRecords + records.length, estimatedTotal);
                    progressBar.update(currentProgress);
                }
                
                if (records.length === 0) {
                    if (offset === 0) {
                        tableMetrics.errors.push('No records found - query may not match any records or table may not be accessible');
                    }
                    hasMore = false;
                    break;
                }

                // Process each record
                for (const record of records) {
                    let recordDir = tableDir;
                    const recordId = record.sys_id?.value || record.sys_id;
                    
                    // Remove from existing records set (for deletion detection)
                    if (this.cleanupDeleted && !isFullSync) {
                        existingRecords.delete(recordId);
                    }
                    
                    // If organizing by application, determine the app-specific directory within table
                    if (this.organizeByApplication) {
                        const appName = this.getApplicationName(record.sys_scope);
                        recordDir = path.join(this.baseDir, folderName, appName);
                        await this.ensureDirectoryExists(recordDir);
                        this.stats.pathValidations++;
                        
                        // Track application statistics
                        this.stats.applicationCounts[appName] = (this.stats.applicationCounts[appName] || 0) + 1;
                    }
                    
                    const wasUpdated = await this.saveRecord(recordDir, record, name, lastSyncTime);
                    totalRecords++;
                    tableMetrics.totalRecords++;
                    tableMetrics.filesCreated++;
                    this.stats.recordsExtracted++;
                    
                    if (wasUpdated) {
                        updatedRecords++;
                        tableMetrics.updatedRecords++;
                        this.stats.recordsUpdated++;
                    }
                }

                offset += records.length;
                hasMore = records.length === batchSize;

                // Update progress bar with actual progress (after totalRecords updated)
                if (progressBar) {
                    // If we exceed the estimate, update the total dynamically
                    if (totalRecords > estimatedTotal) {
                        progressBar.setTotal(totalRecords + batchSize); // Add buffer for next batch
                    }
                    progressBar.update(totalRecords);
                }

                // Rate limiting
                if (hasMore && rateLimitDelay > 0) {
                    await this.delay(rateLimitDelay);
                }

            } catch (error) {
                const errorMsg = `Error at offset ${offset}: ${error.message}`;
                tableMetrics.errors.push(errorMsg);
                this.stats.errors++;
                
                // Continue with next batch instead of failing completely
                offset += batchSize;
                if (offset > 10000) { // Safety limit
                    tableMetrics.errors.push('Reached safety limit (10,000 records), stopping extraction');
                    break;
                }
            }
        }
        
        // Complete progress bar to 100%
        if (progressBar) {
            // Set the final total to actual records fetched to ensure 100%
            progressBar.setTotal(totalRecords);
            progressBar.update(totalRecords);
            progressBar.stop();
        }

        // Clean up deleted records
        let deletedCount = 0;
        if (this.cleanupDeleted && !isFullSync && existingRecords.size > 0) {
            deletedCount = await this.cleanupDeletedRecords(name, existingRecords, displayName);
            tableMetrics.deletedRecords = deletedCount;
        }
        
        // Update sync state
        this.updateTableSyncState(name, totalRecords, deletedCount);
        
        // Calculate timing and log comprehensive summary
        const endTime = new Date();
        const duration = ((endTime - tableMetrics.startTime) / 1000).toFixed(2);
        
        // Log consolidated table summary
        if (this.isInteractive) {
            console.log(chalk.blue('  ━'.repeat(50)));
            console.log(chalk.white(`  📄 Records: ${chalk.green(tableMetrics.totalRecords.toLocaleString())}`));
            console.log(chalk.white(`  ⏱️  Duration: ${chalk.green(duration + 's')}`));
            console.log(chalk.white(`  📡 API Calls: ${chalk.blue(tableMetrics.apiCalls)} batches`));
            
            if (!isFullSync) {
                console.log(chalk.white(`  ✏️  Updated: ${chalk.yellow(tableMetrics.updatedRecords.toLocaleString())}`));
                if (tableMetrics.deletedRecords > 0) {
                    console.log(chalk.white(`  🗑️  Deleted: ${chalk.red(tableMetrics.deletedRecords.toLocaleString())}`));
                }
            }
            
            if (tableMetrics.errors.length > 0) {
                console.log(chalk.white(`  ⚠️  Errors: ${chalk.red(tableMetrics.errors.length)}`));
                tableMetrics.errors.forEach(error => {
                    console.log(chalk.red(`    • ${error}`));
                });
            } else {
                console.log(chalk.white(`  ✅ Status: ${chalk.green('Success')}`));
            }
        } else {
            this.log('═'.repeat(80));
            this.log(`📊 TABLE EXTRACTION SUMMARY: ${tableMetrics.displayName}`);
            this.log('═'.repeat(80));
            this.log(`🔍 Query: ${tableMetrics.finalQuery}`);
            this.log(`📋 Fields: ${tableMetrics.fields}`);
            this.log(`🔄 Sync Type: ${tableMetrics.syncType}`);
            this.log(`⏱️  Duration: ${duration}s`);
            this.log(`📡 API Calls: ${tableMetrics.apiCalls} batches`);
            this.log(`📄 Total Records: ${tableMetrics.totalRecords}`);
            if (!isFullSync) {
                this.log(`✏️  Updated Records: ${tableMetrics.updatedRecords}`);
                this.log(`🗑️  Deleted Records: ${tableMetrics.deletedRecords}`);
            }
            this.log(`💾 Files Created: ${tableMetrics.filesCreated}`);
            if (tableMetrics.errors.length > 0) {
                this.log(`⚠️  Errors (${tableMetrics.errors.length}):`);
                tableMetrics.errors.forEach(error => this.log(`   • ${error}`));
            } else {
                this.log(`✅ Status: Success - No errors`);
            }
            this.log('═'.repeat(80));
        }
        
        return totalRecords;
    }

    async collectExistingRecords(tableName, existingRecords, displayName = null) {
        try {
            const folderName = this.sanitizeFilename(displayName || tableName);
            const tablePattern = this.organizeByApplication ? 
                path.join(this.baseDir, folderName, '*', '*.json') :
                path.join(this.baseDir, folderName, '*.json');
            
            const files = await this.globPattern(tablePattern);
            
            for (const file of files) {
                try {
                    const record = await fs.readJson(file);
                    if (record._metadata?.sys_id) {
                        existingRecords.add(record._metadata.sys_id);
                    }
                } catch (error) {
                    this.log(`Failed to read existing record ${file}: ${error.message}`, 'warn');
                }
            }
            
            this.log(`Found ${existingRecords.size} existing records for ${tableName}`, 'debug');
        } catch (error) {
            this.log(`Failed to collect existing records for ${tableName}: ${error.message}`, 'warn');
        }
    }

    async globPattern(pattern) {
        // Simple glob implementation for Windows compatibility
        const parts = pattern.split('*');
        if (parts.length === 1) {
            return await fs.pathExists(pattern) ? [pattern] : [];
        }
        
        // For complex patterns, fallback to recursive directory search
        const baseDir = parts[0];
        const files = [];
        
        try {
            await this.findFiles(baseDir, files, pattern);
        } catch (error) {
            this.log(`Glob pattern failed: ${error.message}`, 'debug');
        }
        
        return files;
    }

    async findFiles(dir, files, pattern) {
        try {
            if (!await fs.pathExists(dir)) return;
            
            const items = await fs.readdir(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                
                if (item.isDirectory()) {
                    await this.findFiles(fullPath, files, pattern);
                } else if (item.isFile() && fullPath.endsWith('.json')) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            this.log(`Error reading directory ${dir}: ${error.message}`, 'debug');
        }
    }

    async cleanupDeletedRecords(tableName, deletedRecords, displayName = null) {
        let deletedCount = 0;
        
        this.log(`Cleaning up ${deletedRecords.size} deleted records from ${tableName}`, 'debug');
        
        for (const recordId of deletedRecords) {
            try {
                const deleted = await this.deleteRecordFiles(tableName, recordId, displayName);
                if (deleted) {
                    deletedCount++;
                    this.stats.recordsDeleted++;
                }
            } catch (error) {
                this.log(`Failed to delete record ${recordId}: ${error.message}`, 'warn');
                this.stats.errors++;
            }
        }
        
        if (deletedCount > 0) {
            this.log(`Deleted ${deletedCount} records from ${tableName}`);
        }
        
        return deletedCount;
    }

    async deleteRecordFiles(tableName, recordId, displayName = null) {
        // Find and delete record files across all applications
        const folderName = this.sanitizeFilename(displayName || tableName);
        const searchPatterns = this.organizeByApplication ? 
            [path.join(this.baseDir, folderName, '*', '*.json')] :
            [path.join(this.baseDir, folderName, '*.json')];
        
        let deletedAny = false;
        
        for (const pattern of searchPatterns) {
            const files = await this.globPattern(pattern);
            
            for (const file of files) {
                try {
                    const record = await fs.readJson(file);
                    if (record._metadata?.sys_id === recordId) {
                        await fs.remove(file);
                        
                        // Verify file was actually deleted
                        if (!await fs.pathExists(file)) {
                            this.log(`✓ Deleted file: ${path.basename(file)}`, 'debug');
                            deletedAny = true;
                        } else {
                            this.log(`✗ Failed to delete file: ${file}`, 'warn');
                            this.stats.errors++;
                        }
                    }
                } catch (error) {
                    this.log(`Error checking file ${file}: ${error.message}`, 'debug');
                    this.stats.errors++;
                }
            }
        }
        
        return deletedAny;
    }

    async saveRecord(tableDir, record, tableName, lastSyncTime = null) {
        try {
            // Validate the target directory exists and is writable
            await this.ensureDirectoryExists(tableDir);
            
            // Determine filename from display value or name field
            const displayValue = record.name?.display_value || 
                               record.name?.value || 
                               record.sys_id?.value || 
                               `record_${Date.now()}`;
            
            // Include sys_id to ensure unique filenames for records with same display name
            const sysId = record.sys_id?.value || record.sys_id || 'unknown_id';
            const filename = `${this.sanitizeFilename(displayValue)}_${sysId}.json`;
            const filepath = await this.validatePath(path.join(tableDir, filename));
            
            // Get application info for metadata
            const appName = this.organizeByApplication ? this.getApplicationName(record.sys_scope) : null;
            
            // Format the record for better readability
            const formattedRecord = {
                _metadata: {
                    table: tableName,
                    sys_id: record.sys_id?.value || record.sys_id,
                    extracted_at: new Date().toISOString(),
                    display_value: displayValue,
                    ...(appName && { application: appName }),
                    ...(record.sys_scope && { scope: record.sys_scope })
                },
                ...this.formatRecordFields(record)
            };

            // Check if record was updated since last sync
            let wasUpdated = true;
            if (lastSyncTime && record.sys_updated_on) {
                const recordUpdatedTime = typeof record.sys_updated_on === 'object' ? 
                    record.sys_updated_on.value : record.sys_updated_on;
                wasUpdated = new Date(recordUpdatedTime) > new Date(lastSyncTime);
            }
            
            // Write file with error handling
            await fs.writeJson(filepath, formattedRecord, { spaces: 2 });
            this.stats.filesCreated++;
            
            // Verify file was created successfully
            const verificationData = {
                sys_id: record.sys_id?.value || record.sys_id
            };
            
            const verified = await this.verifyFileCreation(filepath, verificationData);
            if (verified) {
                this.stats.filesVerified++;
                // Removed individual file logging - now consolidated in table summary
            } else {
                // Only log verification failures (these are important)
                this.log(`✗ File verification failed: ${filename}`, 'warn');
                this.stats.errors++;
            }
            
            return wasUpdated;
            
        } catch (error) {
            this.log(`Error saving record: ${error.message}`, 'error');
            this.stats.errors++;
            return false;
        }
    }

    formatRecordFields(record) {
        const formatted = {};
        
        for (const [key, value] of Object.entries(record)) {
            if (key === 'sys_id') continue; // Already in metadata
            
            if (typeof value === 'object' && value !== null) {
                // Handle ServiceNow field objects with display_value and value
                if (value.hasOwnProperty('display_value') && value.hasOwnProperty('value')) {
                    formatted[key] = {
                        value: value.value,
                        display_value: value.display_value
                    };
                } else {
                    formatted[key] = value;
                }
            } else {
                formatted[key] = value;
            }
            
            // Special formatting for script fields
            if (key === 'script' && formatted[key]?.value) {
                formatted[key].formatted_script = this.formatScript(formatted[key].value);
            }
        }
        
        return formatted;
    }

    formatScript(script) {
        if (!script) return null;
        
        return {
            line_count: script.split('\n').length,
            char_count: script.length,
            preview: script.substring(0, 200) + (script.length > 200 ? '...' : ''),
            full_script: script
        };
    }

    async testAuthentication() {
        const spinner = ora({
            text: chalk.blue('Testing authentication...'),
            spinner: 'dots',
            color: 'blue'
        });
        
        if (this.isInteractive) {
            spinner.start();
        } else {
            this.log('Testing authentication...');
        }
        
        try {
            const testUrl = '/api/now/table/sys_user?sysparm_limit=1';
            const response = await this.makeRequest(testUrl);
            
            if (this.isInteractive) {
                spinner.succeed(chalk.green('Authentication successful'));
            } else {
                this.log('Authentication successful', 'success');
            }
            return true;
        } catch (error) {
            if (this.isInteractive) {
                spinner.fail(chalk.red(`Authentication failed: ${error.message}`));
            } else {
                this.log(`Authentication failed: ${error.message}`, 'error');
            }
            
            if (error.response?.status === 401) {
                this.log('Check your username and password in config.json', 'error');
            } else if (error.response?.status === 403) {
                this.log('User may not have table_api role or sufficient permissions', 'error');
            } else if (error.code === 'ENOTFOUND') {
                this.log(`Cannot resolve instance URL: ${this.instance}`, 'error');
            }
            return false;
        }
    }

    async validateTable(tableConfig) {
        const spinner = ora({
            text: chalk.blue(`Validating table: ${tableConfig.name}`),
            spinner: 'dots2',
            color: 'blue'
        });
        
        if (this.isInteractive) {
            spinner.start();
        }
        
        try {
            const { name, fields } = tableConfig;
            
            // Test with minimal query to check table access and fields
            const params = new URLSearchParams({
                sysparm_limit: 1,
                sysparm_display_value: 'all'
            });
            
            // Only add specific fields for testing if we have them (null means fetch all)
            if (fields && Array.isArray(fields)) {
                const testFields = ['sys_id', ...fields.slice(0, 3)]; // Test first few fields
                params.set('sysparm_fields', testFields.join(','));
            }
            
            const testUrl = `/api/now/table/${name}?${params}`;
            await this.makeRequest(testUrl);
            
            if (this.isInteractive) {
                spinner.succeed(chalk.green(`Table ${name} is accessible`));
            } else {
                this.log(`Table ${name} is accessible`, 'success');
            }
            return true;
        } catch (error) {
            if (this.isInteractive) {
                spinner.fail(chalk.red(`Table validation failed for ${tableConfig.name}`));
            } else {
                this.log(`Table validation failed for ${tableConfig.name}: ${error.message}`, 'warn');
            }
            
            if (error.response?.status === 404) {
                this.log(`Table ${tableConfig.name} does not exist or is not accessible`, 'error');
            }
            return false;
        }
    }

    async run() {
        try {
            // Display banner
            if (this.isInteractive) {
                console.log(chalk.cyan(figlet.textSync('ServiceNow\nExtractor', { 
                    font: 'Small',
                    horizontalLayout: 'fitted'
                })));
                console.log(chalk.gray('━'.repeat(60)));
                console.log(chalk.blue(`🌐 Instance: ${chalk.white(this.instance)}`));
                console.log(chalk.blue(`📁 Output: ${chalk.white(this.baseDir)}`));
                console.log(chalk.gray('━'.repeat(60)));
                console.log();
            } else {
                this.log('Starting ServiceNow data extraction...');
                this.log(`Instance: ${this.instance}`);
                this.log(`Output directory: ${this.baseDir}`);
            }
            
            // Test authentication first
            const authSuccess = await this.testAuthentication();
            if (!authSuccess) {
                throw new Error('Authentication failed - cannot proceed with extraction');
            }
            
            // Validate all tables before starting extraction
            if (this.isInteractive) {
                console.log(chalk.blue('\n📋 Validating table access...'));
            } else {
                this.log('Validating table access...');
            }
            
            const validTables = [];
            for (const tableConfig of this.config.tables) {
                const isValid = await this.validateTable(tableConfig);
                if (isValid) {
                    validTables.push(tableConfig);
                } else {
                    this.log(`Skipping table ${tableConfig.name} due to validation failure`, 'warn');
                }
            }
            
            if (validTables.length === 0) {
                throw new Error('No valid tables found - check your configuration and permissions');
            }
            
            if (this.isInteractive) {
                console.log(chalk.green(`\n✅ Found ${validTables.length}/${this.config.tables.length} valid tables\n`));
            } else {
                this.log(`Found ${validTables.length}/${this.config.tables.length} valid tables`);
            }
            
            // Validate and ensure base directory exists
            const dirSpinner = ora({
                text: chalk.blue(`Validating base directory: ${this.baseDir}`),
                spinner: 'dots3',
                color: 'blue'
            });
            
            if (this.isInteractive) {
                dirSpinner.start();
            }
            
            await this.ensureDirectoryExists(this.baseDir);
            this.stats.pathValidations++;
            
            if (this.isInteractive) {
                dirSpinner.succeed(chalk.green('Base directory validated'));
            } else {
                this.log(`Validating base directory: ${this.baseDir}`);
            }
            
            // Always load sync state (needed for metadata and state tracking)
            await this.loadSyncState();
            this.log(`Incremental sync: ${this.enableIncremental ? 'enabled' : 'disabled'}`);
            
            // Create extraction metadata
            const metadata = {
                extraction_info: {
                    timestamp: new Date().toISOString(),
                    instance: this.instance,
                    config_file: process.env.CONFIG_FILE || 'config.json',
                    version: '1.2.0',
                    organize_by_application: this.organizeByApplication,
                    incremental_sync: this.enableIncremental,
                    last_full_sync: this.syncState?.lastFullSync
                },
                applications: this.organizeByApplication ? {
                    mapping: this.applicationMapping,
                    default: this.defaultApplication
                } : null,
                tables: this.config.tables.map(t => ({
                    name: t.name,
                    displayName: t.displayName,
                    query: t.query,
                    field_count: t.fields ? t.fields.length : 'ALL'
                }))
            };
            
            // Save extraction metadata with verification
            const metadataPath = path.join(this.baseDir, 'extraction_metadata.json');
            const validatedMetadataPath = await this.validatePath(metadataPath);
            await fs.writeJson(validatedMetadataPath, metadata, { spaces: 2 });
            this.stats.filesCreated++;
            
            // Verify metadata file
            if (await fs.pathExists(validatedMetadataPath)) {
                const stats = await fs.stat(validatedMetadataPath);
                if (stats.size > 0) {
                    this.stats.filesVerified++;
                    this.log('✓ Extraction metadata created and verified', 'debug');
                } else {
                    this.log('✗ Metadata file created but is empty', 'warn');
                    this.stats.errors++;
                }
            } else {
                this.log('✗ Metadata file creation failed', 'error');
                this.stats.errors++;
            }
            
            // Process each valid table
            if (this.isInteractive) {
                console.log(chalk.blue('\n🚀 Starting table extraction...\n'));
            }
            
            for (let i = 0; i < validTables.length; i++) {
                const tableConfig = validTables[i];
                
                if (this.isInteractive) {
                    console.log(chalk.blue(`[${i + 1}/${validTables.length}] Processing table: ${chalk.white(tableConfig.name)}`));
                }
                
                try {
                    await this.extractTable(tableConfig);
                    this.stats.tablesProcessed++;
                } catch (error) {
                    this.log(`Failed to extract table ${tableConfig.name}: ${error.message}`, 'error');
                    this.stats.errors++;
                }
                
                // Add spacing between tables
                if (this.isInteractive && i < validTables.length - 1) {
                    console.log();
                }
            }
            
            // Final statistics
            const endTime = new Date();
            const duration = ((endTime - this.stats.startTime) / 1000).toFixed(2);
            
            if (this.isInteractive) {
                console.log('\n' + chalk.green('🎉 EXTRACTION COMPLETE') + '\n');
                console.log(chalk.gray('━'.repeat(60)));
                console.log(chalk.blue('📊 Final Statistics:'));
                console.log(chalk.gray('━'.repeat(60)));
                console.log(chalk.white(`⏱️  Duration: ${chalk.green(duration)} seconds`));
                console.log(chalk.white(`📋 Tables processed: ${chalk.green(this.stats.tablesProcessed)}/${validTables.length}`));
                console.log(chalk.white(`📄 Records extracted: ${chalk.green(this.stats.recordsExtracted.toLocaleString())}`));
                
                if (this.enableIncremental) {
                    console.log(chalk.white(`✏️  Records updated: ${chalk.yellow(this.stats.recordsUpdated.toLocaleString())}`));
                    console.log(chalk.white(`🗑️  Records deleted: ${chalk.red(this.stats.recordsDeleted.toLocaleString())}`));
                }
                
                console.log(chalk.white(`💾 Files created: ${chalk.green(this.stats.filesCreated.toLocaleString())}`));
                console.log(chalk.white(`✅ Files verified: ${chalk.green(this.stats.filesVerified.toLocaleString())}`));
                
                if (this.stats.errors > 0) {
                    console.log(chalk.white(`❌ Errors: ${chalk.red(this.stats.errors)}`));
                } else {
                    console.log(chalk.white(`❌ Errors: ${chalk.green('0')}`));
                }
                
                // Calculate verification success rate
                if (this.stats.filesCreated > 0) {
                    const verificationRate = ((this.stats.filesVerified / this.stats.filesCreated) * 100).toFixed(1);
                    console.log(chalk.white(`🔍 Verification rate: ${chalk.green(verificationRate + '%')}`));
                }
                
                if (this.organizeByApplication && Object.keys(this.stats.applicationCounts).length > 0) {
                    console.log(chalk.gray('━'.repeat(60)));
                    console.log(chalk.blue('📱 Records by Application:'));
                    Object.entries(this.stats.applicationCounts)
                        .sort(([,a], [,b]) => b - a)
                        .forEach(([app, count]) => {
                            console.log(chalk.white(`  • ${app}: ${chalk.green(count.toLocaleString())} records`));
                        });
                }
                
                console.log(chalk.gray('━'.repeat(60)));
                console.log(chalk.white(`📂 Output: ${chalk.blue(path.resolve(this.baseDir))}`));
                console.log(chalk.gray('━'.repeat(60)));
            } else {
                this.log('='.repeat(50));
                this.log('EXTRACTION COMPLETE');
                this.log(`Duration: ${duration} seconds`);
                this.log(`Tables processed: ${this.stats.tablesProcessed}/${validTables.length}`);
                this.log(`Records extracted: ${this.stats.recordsExtracted}`);
                if (this.enableIncremental) {
                    this.log(`Records updated: ${this.stats.recordsUpdated}`);
                    this.log(`Records deleted: ${this.stats.recordsDeleted}`);
                }
                this.log(`Files created: ${this.stats.filesCreated}`);
                this.log(`Files verified: ${this.stats.filesVerified}`);
                this.log(`Path validations: ${this.stats.pathValidations}`);
                this.log(`Errors: ${this.stats.errors}`);
                
                // Calculate verification success rate
                if (this.stats.filesCreated > 0) {
                    const verificationRate = ((this.stats.filesVerified / this.stats.filesCreated) * 100).toFixed(1);
                    this.log(`Verification success rate: ${verificationRate}%`);
                }
                
                if (this.organizeByApplication && Object.keys(this.stats.applicationCounts).length > 0) {
                    this.log('Records by Application:');
                    Object.entries(this.stats.applicationCounts)
                        .sort(([,a], [,b]) => b - a)
                        .forEach(([app, count]) => {
                            this.log(`  ${app}: ${count} records`);
                        });
                }
                
                this.log(`Output location: ${path.resolve(this.baseDir)}`);
                this.log('='.repeat(50));
            }
            
            // Save sync state
            if (this.enableIncremental && this.syncState) {
                await this.saveSyncState();
            }
            
        } catch (error) {
            this.log(`Fatal error: ${error.message}`, 'error');
            process.exit(1);
        }
    }
}

// Main execution
async function main() {
    try {
        // Check for config file from command line args
        const args = process.argv.slice(2);
        let configFile = 'config.json';
        
        // Parse command line arguments
        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--config' && args[i + 1]) {
                configFile = args[i + 1];
                break;
            }
        }
        
        // Also check environment variable
        configFile = process.env.CONFIG_FILE || configFile;
        
        if (!await fs.pathExists(configFile)) {
            console.error(`Configuration file not found: ${configFile}`);
            console.error('Please create config.json or specify with --config flag');
            process.exit(1);
        }
        
        const config = await fs.readJson(configFile);
        const extractor = new ServiceNowExtractor(config);
        
        await extractor.run();
        
    } catch (error) {
        console.error(`Startup error: ${error.message}`);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

if (require.main === module) {
    main();
}

module.exports = ServiceNowExtractor;