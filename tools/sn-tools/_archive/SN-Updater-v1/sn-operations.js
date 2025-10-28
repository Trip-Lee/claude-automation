#!/usr/bin/env node

/**
 * ServiceNow Individual Operations
 * Run specific operations without the full auto-execute
 */

const ServiceNowTools = require('./servicenow-tools-v2');
const fs = require('fs');
const path = require('path');

async function main() {
    const args = process.argv.slice(2);
    const operation = args[0];

    if (!operation) {
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
        console.log('  test            - Test connections to all configured instances');
        console.log('');
        console.log('Update usage:');
        console.log('  node sn-operations.js update --type [type] --sys_id [id] --field [field] --file [file]');
        console.log('');
        process.exit(0);
    }

    try {
        const tools = new ServiceNowTools();

        switch (operation) {
            case 'fetch-data':
                console.log('Fetching ServiceNow data...');
                await tools.fetchData();
                console.log('✓ Data fetch completed');
                break;

            case 'fetch-stories':
                console.log('Fetching ServiceNow stories...');
                await tools.fetchStories();
                console.log('✓ Story fetch completed');
                break;

            case 'process-updates':
                console.log('Processing pending updates...');
                await tools.processPendingUpdates();
                console.log('✓ Updates processed');
                break;

            case 'update':
                // Parse update parameters
                const params = {};
                for (let i = 1; i < args.length; i += 2) {
                    const key = args[i].replace('--', '');
                    const value = args[i + 1];
                    
                    if (key === 'sys_id') {
                        params.sysId = value;
                    } else {
                        params[key] = value;
                    }
                }

                if (!params.type || !params.sysId || !params.field || !params.file) {
                    console.error('Missing required parameters for update');
                    console.error('Required: --type [type] --sys_id [id] --field [field] --file [file]');
                    process.exit(1);
                }

                console.log('Updating ServiceNow record...');
                await tools.updateRecord(params);
                console.log('✓ Update completed');
                break;

            case 'test':
                console.log('Testing connections to all configured instances...');
                const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'sn-config.json'), 'utf8'));
                
                for (const [name, instance] of Object.entries(config.instances)) {
                    process.stdout.write(`Testing ${name} (${instance.instance})... `);
                    
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
                                    console.log('✓ Connected');
                                    resolve();
                                } else {
                                    console.log(`✗ HTTP ${res.statusCode}`);
                                    reject(new Error(`HTTP ${res.statusCode}`));
                                }
                                res.on('data', () => {}); // Consume response
                            });

                            req.on('error', (error) => {
                                console.log(`✗ ${error.message}`);
                                reject(error);
                            });

                            req.setTimeout(5000, () => {
                                req.destroy();
                                console.log('✗ Timeout');
                                reject(new Error('Timeout'));
                            });

                            req.end();
                        }).catch(() => {}); // Errors already logged
                    } catch (error) {
                        // Error already logged
                    }
                }
                break;

            default:
                console.error(`Unknown operation: ${operation}`);
                console.log('Run without arguments to see available operations');
                process.exit(1);
        }

    } catch (error) {
        console.error('');
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();