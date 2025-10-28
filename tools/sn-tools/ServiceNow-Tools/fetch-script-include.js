/**
 * Fetch Script Include with complete script content
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

class ScriptIncludeFetcher {
    constructor(config) {
        this.config = config;
        this.instance = config.instance;
        this.auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    }

    async makeRequest(url) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.instance,
                path: url,
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${this.auth}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(new Error(`Failed to parse JSON: ${error.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    async fetchScriptInclude(sysId) {
        console.log(`Fetching Script Include: ${sysId}`);
        
        const url = `/api/now/table/sys_script_include/${sysId}?sysparm_display_value=all&sysparm_exclude_reference_link=false`;
        const response = await this.makeRequest(url);
        
        if (response.result) {
            return response.result;
        }
        
        throw new Error(`Script Include not found: ${sysId}`);
    }

    async updateScriptIncludeWithComment(sysId, comment) {
        try {
            // Fetch current script include
            const scriptInclude = await this.fetchScriptInclude(sysId);
            
            console.log(`Found Script Include: ${scriptInclude.name.display_value}`);
            
            // Get current script content
            const currentScript = scriptInclude.script?.value || '';
            
            // Add comment at the beginning
            const updatedScript = `${comment}\n${currentScript}`;
            
            // Save to temp_updates for processing
            const filename = `${scriptInclude.name.display_value}_updated.js`;
            const filepath = path.join(__dirname, 'temp_updates', filename);
            await fs.writeFile(filepath, updatedScript);
            
            console.log(`✓ Updated script saved to: ${filepath}`);
            console.log(`Script Include: ${scriptInclude.name.display_value}`);
            console.log(`sys_id: ${sysId}`);
            console.log(`Comment added: ${comment}`);
            
            return {
                name: scriptInclude.name.display_value,
                sysId: sysId,
                updatedScript: updatedScript,
                filepath: filepath
            };
            
        } catch (error) {
            console.error(`Error updating Script Include ${sysId}: ${error.message}`);
            throw error;
        }
    }
}

// CLI Usage
async function main() {
    const configPath = path.join(__dirname, 'sn-config.json');
    
    try {
        const configData = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        // Use default instance or first available
        const instanceKey = config.routing?.default || Object.keys(config.instances)[0];
        const instanceConfig = config.instances[instanceKey];
        
        if (!instanceConfig) {
            throw new Error(`No instance configuration found for: ${instanceKey}`);
        }
        
        const fetcher = new ScriptIncludeFetcher(instanceConfig);
        
        const args = process.argv.slice(2);
        
        if (args.length < 2) {
            console.log('Usage:');
            console.log('  node fetch-script-include.js [sys_id] [comment]');
            console.log('');
            console.log('Examples:');
            console.log('  node fetch-script-include.js 96028aa6c36f065085b196c4e4013109 "// Updated by Trevor for testing purposes"');
            return;
        }
        
        const sysId = args[0];
        const comment = args[1];
        
        const result = await fetcher.updateScriptIncludeWithComment(sysId, comment);
        
        console.log('\n🎉 Script Include updated successfully!');
        console.log(`📁 File saved: ${result.filepath}`);
        console.log(`\nTo apply the changes to ServiceNow, run:`);
        console.log(`node sn-operations.js update --type script_include --sys_id ${result.sysId} --field script --file "${result.filepath}"`);
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = ScriptIncludeFetcher;