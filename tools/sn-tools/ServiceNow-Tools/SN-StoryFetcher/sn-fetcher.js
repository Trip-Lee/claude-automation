#!/usr/bin/env node

/**
 * ServiceNow Data Fetcher
 * Connects to ServiceNow instance and fetches records for offline development
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const ora = require('ora');
const chalk = require('chalk');
const figlet = require('figlet');

class ServiceNowFetcher {
    constructor(config) {
        this.instance = config.instance;
        this.username = config.username;
        this.password = config.password;
        this.outputDir = config.outputDir || "./sn-data";
        this.cleanBeforeFetch = config.cleanBeforeFetch !== false; // Default to true
        this.isInteractive = process.stdout.isTTY && !process.env.CI;
    }

    /**
     * Create basic auth header
     */
    getAuthHeader() {
        const auth = Buffer.from(`${this.username}:${this.password}`).toString("base64");
        return `Basic ${auth}`;
    }

    /**
     * Test authentication
     */
    async testAuth() {
        // Handle instances that already include .service-now.com for display
        const displayHostname = this.instance.endsWith('.service-now.com') ?
            this.instance : `${this.instance}.service-now.com`;

        const spinner = ora({
            text: chalk.blue(`Testing connection to: ${displayHostname}`),
            spinner: 'dots',
            color: 'blue'
        });

        if (this.isInteractive) {
            spinner.start();
        } else {
            console.log(`Testing connection to: ${displayHostname}`);
        }
        
        return new Promise((resolve, reject) => {
            // Handle instances that already include .service-now.com
            const hostname = this.instance.endsWith('.service-now.com') ?
                this.instance : `${this.instance}.service-now.com`;

            const options = {
                hostname: hostname,
                path: `/api/now/table/sys_user?sysparm_limit=1&sysparm_query=user_name=${this.username}`,
                method: "GET",
                headers: {
                    "Authorization": this.getAuthHeader(),
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            };

            const req = https.request(options, (res) => {
                if (res.statusCode === 200) {
                    if (this.isInteractive) {
                        spinner.succeed(chalk.green('Authentication successful'));
                    } else {
                        console.log('✓ Authentication successful');
                    }
                    resolve(true);
                } else if (res.statusCode === 401) {
                    if (this.isInteractive) {
                        spinner.fail(chalk.red('Authentication failed'));
                    }
                    reject(new Error("Authentication failed. Please check:\n  1. Username (try lowercase)\n  2. Password\n  3. Account has API access enabled"));
                } else {
                    if (this.isInteractive) {
                        spinner.fail(chalk.red(`Connection test failed with status ${res.statusCode}`));
                    }
                    reject(new Error(`Connection test failed with status ${res.statusCode}`));
                }
            });

            req.on("error", (error) => {
                if (this.isInteractive) {
                    spinner.fail(chalk.red(`Connection failed: ${error.message}`));
                } else {
                    console.log(`✗ Connection failed: ${error.message}`);
                }
                reject(new Error(`Connection failed: ${error.message}`));
            });

            req.end();
        });
    }

    /**
     * Fetch records from ServiceNow
     * @param {string} table - Table name
     * @param {string} query - Encoded query string
     * @param {Array} fields - Fields to retrieve (optional)
     * @param {number} limit - Maximum records to fetch
     * @param {Object} metrics - Optional metrics object to track fetch details
     */
    async fetchRecords(table, query = "", fields = [], limit = 1000, metrics = null) {
        const startTime = new Date();
        
        return new Promise((resolve, reject) => {
            const fieldParam = fields.length > 0 ? `&sysparm_fields=${fields.join(",")}` : "";
            const queryParam = query ? `&sysparm_query=${encodeURIComponent(query)}` : "";

            // Handle instances that already include .service-now.com
            const hostname = this.instance.endsWith('.service-now.com') ?
                this.instance : `${this.instance}.service-now.com`;

            const options = {
                hostname: hostname,
                path: `/api/now/table/${table}?sysparm_limit=${limit}${queryParam}${fieldParam}`,
                method: "GET",
                headers: {
                    "Authorization": this.getAuthHeader(),
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            };

            // Track metrics if provided
            if (metrics) {
                metrics.apiStartTime = startTime;
                metrics.apiUrl = options.path;
                metrics.query = query || "All records";
                metrics.fieldsRequested = fields.length;
            }

            const req = https.request(options, (res) => {
                let data = "";

                res.on("data", (chunk) => {
                    data += chunk;
                });

                res.on("end", () => {
                    const endTime = new Date();
                    if (metrics) {
                        metrics.apiDuration = ((endTime - startTime) / 1000).toFixed(2);
                        metrics.responseSize = data.length;
                    }
                    
                    if (res.statusCode === 200) {
                        try {
                            const jsonData = JSON.parse(data);
                            if (metrics) {
                                metrics.recordsRetrieved = jsonData.result.length;
                                metrics.success = true;
                            }
                            resolve(jsonData.result);
                        } catch (error) {
                            if (metrics) {
                                metrics.success = false;
                                metrics.error = `Failed to parse response: ${error.message}`;
                            }
                            reject(new Error(`Failed to parse response: ${error.message}`));
                        }
                    } else {
                        if (metrics) {
                            metrics.success = false;
                            metrics.error = `HTTP ${res.statusCode}: ${data}`;
                        }
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on("error", (error) => {
                if (metrics) {
                    metrics.success = false;
                    metrics.error = `Request failed: ${error.message}`;
                    metrics.apiDuration = ((new Date() - startTime) / 1000).toFixed(2);
                }
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.end();
        });
    }

    /**
     * Clean old data for a table
     */
    cleanOldData(table) {
        const tableDir = path.join(this.outputDir, table);
        
        if (fs.existsSync(tableDir)) {
            console.log(`Cleaning old data for ${table}...`);
            
            // Remove all files and subdirectories
            const files = fs.readdirSync(tableDir);
            files.forEach(file => {
                const filePath = path.join(tableDir, file);
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory()) {
                    // Remove directory recursively
                    fs.rmSync(filePath, { recursive: true, force: true });
                } else {
                    // Remove file
                    fs.unlinkSync(filePath);
                }
            });
            
            console.log(`✓ Cleaned old data for ${table}`);
        }
    }
    
    /**
     * Clean old data for a table (silent version for consolidated logging)
     */
    cleanOldDataSilent(table) {
        const tableDir = path.join(this.outputDir, table);
        
        if (fs.existsSync(tableDir)) {
            // Remove all files and subdirectories
            const files = fs.readdirSync(tableDir);
            files.forEach(file => {
                const filePath = path.join(tableDir, file);
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory()) {
                    // Remove directory recursively
                    fs.rmSync(filePath, { recursive: true, force: true });
                } else {
                    // Remove file
                    fs.unlinkSync(filePath);
                }
            });
        }
    }

    /**
     * Save records to file system
     * @param {Array} records - Records to save
     * @param {string} table - Table name
     * @param {string} query - Query used
     * @param {Object} metrics - Optional metrics object to track save details
     */
    saveRecords(records, table, query, metrics = null) {
        const startTime = new Date();
        let individualFilesCreated = 0;
        
        // Create output directory if it doesn't exist
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // Clean old data first if enabled (suppress individual logging)
        if (this.cleanBeforeFetch) {
            this.cleanOldDataSilent(table);
        }

        // Create subdirectory for table
        const tableDir = path.join(this.outputDir, table);
        if (!fs.existsSync(tableDir)) {
            fs.mkdirSync(tableDir, { recursive: true });
        }

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const querySlug = query ? `_${query.substring(0, 50).replace(/[^a-z0-9]/gi, "_")}` : "";
        const filename = `${table}${querySlug}_${timestamp}.json`;
        const filepath = path.join(tableDir, filename);

        // Save main data file
        fs.writeFileSync(filepath, JSON.stringify(records, null, 2));

        // Create index file for easy access
        const indexPath = path.join(tableDir, "index.json");
        let index = {};
        if (fs.existsSync(indexPath)) {
            index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
        }
        
        index[filename] = {
            timestamp: new Date().toISOString(),
            query: query || "All records",
            count: records.length,
            fields: records.length > 0 ? Object.keys(records[0]) : []
        };
        
        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

        // Create individual record files for large datasets
        if (records.length <= 100) {
            const recordsDir = path.join(tableDir, `records_${timestamp}`);
            fs.mkdirSync(recordsDir, { recursive: true });
            
            records.forEach((record, index) => {
                // Use meaningful identifiers for filename
                let identifier = index.toString();
                if (record.sys_id) {
                    identifier = record.sys_id;
                } else if (record.number) {
                    identifier = record.number;
                } else if (record.short_description) {
                    identifier = record.short_description.substring(0, 50).replace(/[^a-z0-9]/gi, "_");
                }
                
                const recordFilename = `${index.toString().padStart(3, "0")}_${identifier}.json`;
                fs.writeFileSync(
                    path.join(recordsDir, recordFilename),
                    JSON.stringify(record, null, 2)
                );
                individualFilesCreated++;
            });
        }
        
        // Track metrics if provided
        if (metrics) {
            metrics.saveStartTime = startTime;
            metrics.saveDuration = ((new Date() - startTime) / 1000).toFixed(2);
            metrics.mainFilePath = filepath;
            metrics.individualFilesCreated = individualFilesCreated;
            metrics.totalFilesCreated = individualFilesCreated + 2; // main file + index file
        }

        return filepath;
    }

    /**
     * Fetch related records based on reference fields
     */
    async fetchRelatedRecords(records, referenceFields = []) {
        const relatedData = {};

        for (const field of referenceFields) {
            const referencedIds = new Set();
            
            // Collect all referenced sys_ids
            records.forEach(record => {
                if (record[field] && record[field].value) {
                    referencedIds.add(record[field].value);
                }
            });

            if (referencedIds.size > 0) {
                // Determine table from reference (this is simplified - you might need a mapping)
                const refTable = field.replace(/_/g, "");  // This is a guess - adjust as needed
                
                console.log(`Fetching ${referencedIds.size} related records from ${field}`);
                
                const query = `sys_idIN${Array.from(referencedIds).join(",")}`;
                try {
                    const relatedRecords = await this.fetchRecords(refTable, query);
                    relatedData[field] = relatedRecords;
                } catch (error) {
                    console.error(`Failed to fetch related records for ${field}: ${error.message}`);
                }
            }
        }

        return relatedData;
    }

    /**
     * Interactive mode for entering credentials
     */
    static async getCredentials() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (query) => new Promise((resolve) => rl.question(query, resolve));

        const config = {};
        config.instance = await question("ServiceNow Instance (e.g., dev123456): ");
        config.username = await question("Username: ");
        
        // Hide password input
        process.stdout.write("Password: ");
        config.password = await new Promise((resolve) => {
            const stdin = process.stdin;
            stdin.resume();
            stdin.setRawMode(true);
            stdin.resume();
            stdin.setEncoding("utf8");

            let password = "";
            stdin.on("data", (ch) => {
                ch = ch.toString("utf8");
                if (ch === "\n" || ch === "\r" || ch === "\u0004") {
                    stdin.setRawMode(false);
                    stdin.pause();
                    console.log();
                    resolve(password);
                } else if (ch === "\u0003") {
                    process.exit();
                } else if (ch === "\u007f" || ch === "\b") {
                    password = password.slice(0, -1);
                } else {
                    password += ch;
                }
            });
        });

        rl.close();
        return config;
    }
}

/**
 * Main execution
 */
async function main() {
    const isInteractive = process.stdout.isTTY && !process.env.CI;
    
    if (isInteractive) {
        console.log(chalk.cyan(figlet.textSync('Story\nFetcher', { 
            font: 'Small',
            horizontalLayout: 'fitted'
        })));
        console.log(chalk.gray('═'.repeat(60)));
        console.log(chalk.blue('📖 ServiceNow Story Fetcher v2.1.0'));
        console.log(chalk.gray('═'.repeat(60)));
        console.log();
    } else {
        console.log("ServiceNow Data Fetcher");
        console.log("=======================\n");
    }

    // Check for config file from environment or default
    const configFileName = process.env.CONFIG_FILE || "sn-config.json";
    const configPath = path.join(__dirname, configFileName);
    let config = {};

    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        if (isInteractive) {
            console.log(chalk.blue(`📋 Using configuration from ${chalk.white(configFileName)}`));
        } else {
            console.log(`Using configuration from ${configFileName}`);
        }
    } else {
        if (isInteractive) {
            console.log(chalk.yellow('⚠️  No configuration file found. Please enter credentials:'));
        } else {
            console.log("No configuration file found. Please enter credentials:");
        }
        config = await ServiceNowFetcher.getCredentials();
        
        // Optionally save config (without password)
        const saveConfig = await new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            rl.question("Save configuration (without password)? (y/n): ", (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === "y");
            });
        });

        if (saveConfig) {
            const configToSave = { ...config };
            delete configToSave.password;
            fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2));
            if (isInteractive) {
                console.log(chalk.green('✅ Configuration saved (you\'ll need to enter password next time)'));
            } else {
                console.log("Configuration saved (you'll need to enter password next time)");
            }
        }
    }

    // If password not in config, prompt for it
    if (!config.password || config.password === "your-password-here") {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        config.password = await new Promise((resolve) => {
            rl.question("Password: ", (answer) => {
                rl.close();
                resolve(answer);
            });
        });
    }

    const fetcher = new ServiceNowFetcher(config);

    // Test authentication first
    try {
        if (!isInteractive) {
            console.log("\nTesting authentication...");
        }
        await fetcher.testAuth();
        if (!isInteractive) {
            console.log("✓ Authentication successful\n");
        }
    } catch (error) {
        if (isInteractive) {
            console.log(chalk.red('\n❌ Authentication Error:'));
            console.log(chalk.yellow('   ' + error.message));
            console.log(chalk.blue('\n💡 Troubleshooting tips:'));
            console.log(chalk.white('   • Try username in lowercase (trevor.offen instead of Trevor.offen)'));
            console.log(chalk.white('   • Verify your password is correct'));
            console.log(chalk.white('   • Check if your account has REST API access enabled'));
            console.log(chalk.white('   • Ensure the instance name is correct (just \'tenon\', not the full URL)'));
        } else {
            console.error(`\n✗ ${error.message}`);
            console.error("\nTroubleshooting tips:");
            console.error("- Try username in lowercase (trevor.offen instead of Trevor.offen)");
            console.error("- Verify your password is correct");
            console.error("- Check if your account has REST API access enabled");
            console.error("- Ensure the instance name is correct (just 'tenon', not the full URL)");
        }
        process.exit(1);
    }

    // Use default table or prompt for table name
    let table;
    if (config.defaultTable) {
        table = config.defaultTable;
        if (isInteractive) {
            console.log(chalk.blue(`📋 Using default table: ${chalk.white(table)}`));
        } else {
            console.log(`Using default table: ${table}`);
        }
    } else {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        table = await new Promise((resolve) => {
            rl.question("Table name (e.g., incident, sys_user): ", resolve);
        });
        rl.close();
    }

    // Check for default configuration for this table
    let defaultConfig = null;
    let query = "";
    let fields = [];
    let limit = 1000;

    if (config.defaultTables && config.defaultTables[table]) {
        defaultConfig = config.defaultTables[table];
        
        if (isInteractive) {
            console.log(chalk.blue(`\n⚙️  Using default configuration for ${chalk.white(table)}:`));
        } else {
            console.log(`\nUsing default configuration for ${table}:`);
        }
        
        // Use defaults automatically
        query = defaultConfig.defaultQuery || "";
        fields = defaultConfig.fields || [];
        
        if (isInteractive) {
            if (query) {
                console.log(chalk.white(`   🔍 Query: ${chalk.gray(query.substring(0, 100) + (query.length > 100 ? '...' : ''))}`));
            }
            if (fields.length > 0) {
                console.log(chalk.white(`   📋 Fields: ${chalk.green(fields.length)} fields configured`));
            }
            console.log(chalk.white(`   📊 Max records: ${chalk.green(limit)}`));
        } else {
            if (query) {
                console.log(`  Query: ${query}`);
            }
            if (fields.length > 0) {
                console.log(`  Fields: ${fields.length} fields configured`);
            }
            console.log(`  Max records: ${limit}`);
        }
        
    } else {
        // No defaults available, prompt for input
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        query = await new Promise((resolve) => {
            rl.question("Query (optional, press Enter for all): ", resolve);
        });

        const fieldsInput = await new Promise((resolve) => {
            rl.question("Fields to retrieve (comma-separated, or Enter for all): ", resolve);
        });

        fields = fieldsInput ? fieldsInput.split(",").map(f => f.trim()) : [];

        limit = await new Promise((resolve) => {
            rl.question("Maximum records (default 1000): ", (answer) => {
                resolve(answer ? parseInt(answer) : 1000);
            });
        });

        rl.close();
    }

    try {
        // Create metrics object to track the entire operation
        const operationMetrics = {
            table,
            query: query || "All records",
            fieldsRequested: fields.length,
            limit,
            startTime: new Date(),
            totalDuration: 0,
            success: false
        };
        
        // Fetch records with metrics tracking
        const records = await fetcher.fetchRecords(table, query, fields, limit, operationMetrics);
        
        // Save records with metrics tracking
        const filepath = fetcher.saveRecords(records, table, query, operationMetrics);
        
        // Calculate total operation time
        operationMetrics.endTime = new Date();
        operationMetrics.totalDuration = ((operationMetrics.endTime - operationMetrics.startTime) / 1000).toFixed(2);
        operationMetrics.success = true;
        
        // Log comprehensive summary
        if (isInteractive) {
            console.log('\n' + chalk.green('🎉 STORY FETCH COMPLETE') + '\n');
            console.log(chalk.gray('═'.repeat(60)));
            console.log(chalk.blue('📊 Fetch Summary:'));
            console.log(chalk.gray('═'.repeat(60)));
            console.log(chalk.white(`🔍 Query: ${chalk.gray(operationMetrics.query.substring(0, 80) + (operationMetrics.query.length > 80 ? '...' : ''))}`));
            console.log(chalk.white(`📋 Fields: ${operationMetrics.fieldsRequested > 0 ? chalk.blue(`${operationMetrics.fieldsRequested} specific fields`) : chalk.blue('ALL fields')}`));
            console.log(chalk.white(`⏱️  Total Duration: ${chalk.green(operationMetrics.totalDuration + 's')}`));
            console.log(chalk.white(`🌐 API Duration: ${chalk.green(operationMetrics.apiDuration + 's')}`));
            console.log(chalk.white(`📄 Records Retrieved: ${chalk.green(operationMetrics.recordsRetrieved.toLocaleString())}`));
            console.log(chalk.white(`💿 Response Size: ${chalk.blue((operationMetrics.responseSize / 1024).toFixed(1) + ' KB')}`));
            console.log(chalk.white(`✅ Status: ${chalk.green('Success')}`));
            console.log(chalk.white(`📂 Output: ${chalk.blue(filepath)}`));
            console.log(chalk.gray('═'.repeat(60)));
        } else {
            console.log('═'.repeat(80));
            console.log(`📊 STORY FETCH SUMMARY: ${table}`);
            console.log('═'.repeat(80));
            console.log(`🔍 Query: ${operationMetrics.query}`);
            console.log(`📋 Fields: ${operationMetrics.fieldsRequested > 0 ? `${operationMetrics.fieldsRequested} specific fields` : 'ALL fields'}`);
            console.log(`⏱️  Total Duration: ${operationMetrics.totalDuration}s`);
            console.log(`🌐 API Duration: ${operationMetrics.apiDuration}s`);
            console.log(`📄 Records Retrieved: ${operationMetrics.recordsRetrieved}`);
            console.log(`💿 Response Size: ${(operationMetrics.responseSize / 1024).toFixed(1)} KB`);
            console.log(`✅ Status: Success`);
            console.log(`📂 Output: ${filepath}`);
            console.log('═'.repeat(80));
        }
        
    } catch (error) {
        if (isInteractive) {
            console.log('\n' + chalk.red('❌ STORY FETCH ERROR') + '\n');
            console.log(chalk.gray('═'.repeat(60)));
            console.log(chalk.white(`📋 Table: ${chalk.blue(table)}`));
            console.log(chalk.white(`🔍 Query: ${chalk.gray(query || "All records")}`));
            console.log(chalk.white(`⚠️  Error: ${chalk.red(error.message)}`));
            console.log(chalk.gray('═'.repeat(60)));
        } else {
            console.log('═'.repeat(80));
            console.log(`❌ STORY FETCH ERROR: ${table}`);
            console.log('═'.repeat(80));
            console.log(`🔍 Query: ${query || "All records"}`);
            console.log(`⚠️  Error: ${error.message}`);
            console.log('═'.repeat(80));
        }
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ServiceNowFetcher;