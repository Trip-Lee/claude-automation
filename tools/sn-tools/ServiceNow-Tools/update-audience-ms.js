/**
 * Direct update of AudienceMS Script Include
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

class DirectUpdater {
    constructor(config) {
        this.config = config;
        this.instance = config.instance;
        this.auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    }

    async makeRequest(url, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.instance,
                path: url,
                method: method,
                headers: {
                    'Authorization': `Basic ${this.auth}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => responseData += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(responseData));
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

            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }

    async updateScriptInclude(sysId, scriptContent) {
        console.log(`Updating Script Include: ${sysId}`);
        
        const url = `/api/now/table/sys_script_include/${sysId}`;
        const data = {
            script: scriptContent
        };
        
        const response = await this.makeRequest(url, 'PUT', data);
        
        if (response.result) {
            console.log(`✓ Successfully updated: ${response.result.name}`);
            return response.result;
        }
        
        throw new Error(`Failed to update Script Include: ${sysId}`);
    }
}

// Main execution
async function main() {
    try {
        const configPath = path.join(__dirname, 'sn-config.json');
        const configData = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        // Use dev instance for script_include updates
        const instanceConfig = config.instances.dev;
        
        const updater = new DirectUpdater(instanceConfig);
        
        // Read the updated script content
        const scriptPath = path.join(__dirname, 'temp_updates', 'AudienceMS_updated.js');
        const scriptContent = await fs.readFile(scriptPath, 'utf8');
        
        // Update the Script Include
        const result = await updater.updateScriptInclude('96028aa6c36f065085b196c4e4013109', scriptContent);
        
        console.log('\n🎉 AudienceMS Script Include updated successfully!');
        console.log(`📝 Script Include: ${result.name}`);
        console.log(`🆔 sys_id: ${result.sys_id}`);
        console.log(`📅 Last Updated: ${result.sys_updated_on}`);
        console.log(`👤 Updated By: ${result.sys_updated_by}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();