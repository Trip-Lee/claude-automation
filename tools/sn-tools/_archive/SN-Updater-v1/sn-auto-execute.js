#!/usr/bin/env node

/**
 * ServiceNow Auto-Execute
 * Config-driven automatic execution of all ServiceNow operations
 * No CLI interface - everything controlled by configuration
 */

const ServiceNowTools = require('./servicenow-tools-v2');
const fs = require('fs');
const path = require('path');

class ServiceNowAutoExecutor {
    constructor() {
        this.configPath = path.join(__dirname, 'sn-config.json');
        this.tools = null;
    }

    async init() {
        // Check if configuration exists
        if (!fs.existsSync(this.configPath)) {
            console.error('═══════════════════════════════════════════════════════════');
            console.error('  ERROR: No configuration file found!');
            console.error('═══════════════════════════════════════════════════════════');
            console.error('');
            console.error('Please create sn-config.json based on sn-config.example.json');
            console.error('');
            console.error('Example configuration structure:');
            console.error('');
            
            const exampleConfig = {
                instances: {
                    dev: {
                        instance: 'dev123456.service-now.com',
                        username: 'your-username',
                        password: 'your-password'
                    },
                    prod: {
                        instance: 'prod123456.service-now.com',
                        username: 'your-username',
                        password: 'your-password'
                    }
                },
                routing: {
                    stories: 'prod',
                    default: 'dev',
                    tables: {
                        sys_script_include: 'dev',
                        sys_ws_operation: 'dev',
                        rm_story: 'prod'
                    }
                },
                settings: {
                    autoBackup: true,
                    validateUpdates: true,
                    autoFetchData: true,
                    autoFetchStories: true,
                    autoProcessUpdates: true
                }
            };
            
            console.error(JSON.stringify(exampleConfig, null, 2));
            console.error('');
            console.error('Save this configuration to:', this.configPath);
            process.exit(1);
        }

        try {
            this.tools = new ServiceNowTools();
            console.log('✓ Configuration loaded successfully');
            console.log('');
        } catch (error) {
            console.error('Failed to initialize:', error.message);
            process.exit(1);
        }
    }

    async execute() {
        await this.init();
        
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        
        console.log('╔═══════════════════════════════════════╗');
        console.log('║   ServiceNow Auto-Execute Starting    ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('');
        console.log('Configuration Summary:');
        console.log('----------------------');
        console.log(`Instances configured: ${Object.keys(config.instances).join(', ')}`);
        console.log(`Default instance: ${config.routing.default}`);
        console.log(`Stories instance: ${config.routing.stories}`);
        console.log('');
        console.log('Enabled Operations:');
        console.log(`  • Process Updates: ${config.settings?.autoProcessUpdates !== false ? 'Yes' : 'No'}`);
        console.log(`  • Fetch Data: ${config.settings?.autoFetchData !== false ? 'Yes' : 'No'}`);
        console.log(`  • Fetch Stories: ${config.settings?.autoFetchStories !== false ? 'Yes' : 'No'}`);
        console.log(`  • Auto Backup: ${config.settings?.autoBackup !== false ? 'Yes' : 'No'}`);
        console.log(`  • Validate Updates: ${config.settings?.validateUpdates !== false ? 'Yes' : 'No'}`);
        console.log('');
        console.log('═══════════════════════════════════════');
        console.log('');

        const startTime = Date.now();
        const results = await this.tools.executeAll();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('');
        console.log('═══════════════════════════════════════');
        console.log(`Execution completed in ${duration} seconds`);
        
        if (results.errors.length === 0) {
            console.log('Status: ✓ All operations successful');
        } else {
            console.log('Status: ⚠ Completed with errors');
        }
        
        return results;
    }
}

// Run immediately when executed
if (require.main === module) {
    const executor = new ServiceNowAutoExecutor();
    
    executor.execute()
        .then(results => {
            process.exit(results.errors.length > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('');
            console.error('═══════════════════════════════════════');
            console.error('FATAL ERROR:', error.message);
            console.error('═══════════════════════════════════════');
            process.exit(1);
        });
}