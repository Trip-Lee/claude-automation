/**
 * ServiceNow Record Updater
 * Updates Script Includes and REST API operations directly in ServiceNow
 * 
 * Usage:
 * node servicenow-updater.js --type [script_include|rest_api] --sys_id [sys_id] --field [field_name] --value [value]
 * 
 * Examples:
 * node servicenow-updater.js --type script_include --sys_id 3c89fec44752b15098519fd8036d4327 --field script --file updated_script.js
 * node servicenow-updater.js --type rest_api --sys_id 12e65e93c35c5a5085b196c4e40131fa --field operation_script --file updated_api.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load configuration
const configPath = path.join(__dirname, 'sn-config.json');
if (!fs.existsSync(configPath)) {
    console.error('Error: sn-config.json not found. Please create it with your ServiceNow instance details.');
    console.log('Example sn-config.json:');
    console.log(JSON.stringify({
        instance: 'your-instance.service-now.com',
        username: 'your-username',
        password: 'your-password'
    }, null, 2));
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Parse command line arguments
const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    params[key] = args[i + 1];
}

// Validate required parameters
if (!params.type || !params.sys_id || !params.field) {
    console.error('Missing required parameters');
    console.log('Required: --type [script_include|rest_api] --sys_id [sys_id] --field [field_name]');
    console.log('Optional: --value [direct_value] OR --file [file_path]');
    process.exit(1);
}

// Determine table based on type
const tableMap = {
    'script_include': 'sys_script_include',
    'rest_api': 'sys_ws_operation',
    'business_rule': 'sys_script',
    'ui_action': 'sys_ui_action',
    'client_script': 'sys_script_client'
};

const table = tableMap[params.type];
if (!table) {
    console.error(`Invalid type: ${params.type}`);
    console.log('Valid types:', Object.keys(tableMap).join(', '));
    process.exit(1);
}

// Get the value to update
let updateValue;
if (params.file) {
    // Read from file
    const filePath = path.resolve(params.file);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    updateValue = fs.readFileSync(filePath, 'utf8');
} else if (params.value) {
    // Use direct value
    updateValue = params.value;
} else {
    console.error('Must provide either --value or --file');
    process.exit(1);
}

// Function to make ServiceNow API call
function updateServiceNowRecord(table, sysId, field, value) {
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    
    const data = JSON.stringify({
        [field]: value
    });

    const options = {
        hostname: config.instance,
        path: `/api/now/table/${table}/${sysId}`,
        method: 'PATCH',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    const result = JSON.parse(responseData);
                    resolve(result);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

// Function to get record details before update
function getServiceNowRecord(table, sysId) {
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    const options = {
        hostname: config.instance,
        path: `/api/now/table/${table}/${sysId}?sysparm_fields=name,sys_updated_on,${params.field}`,
        method: 'GET',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    const result = JSON.parse(responseData);
                    resolve(result.result);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

// Main execution
async function main() {
    try {
        console.log('=========================================');
        console.log('ServiceNow Record Updater');
        console.log('=========================================');
        console.log(`Instance: ${config.instance}`);
        console.log(`Type: ${params.type}`);
        console.log(`Table: ${table}`);
        console.log(`Sys ID: ${params.sys_id}`);
        console.log(`Field: ${params.field}`);
        console.log('');

        // Get current record
        console.log('Fetching current record...');
        const currentRecord = await getServiceNowRecord(table, params.sys_id);
        console.log(`Record Name: ${currentRecord.name || 'N/A'}`);
        console.log(`Last Updated: ${currentRecord.sys_updated_on}`);
        console.log('');

        // Show preview if updating script
        if (params.field === 'script' || params.field === 'operation_script') {
            console.log('Update Preview (first 500 chars):');
            console.log('-----------------------------------');
            console.log(updateValue.substring(0, 500));
            if (updateValue.length > 500) {
                console.log(`... (${updateValue.length - 500} more characters)`);
            }
            console.log('-----------------------------------');
            console.log('');
        }

        // Confirm update
        console.log('Ready to update. Press Enter to continue or Ctrl+C to cancel...');
        await new Promise(resolve => {
            process.stdin.once('data', resolve);
        });

        // Perform update
        console.log('Updating record...');
        const result = await updateServiceNowRecord(table, params.sys_id, params.field, updateValue);
        
        console.log('✓ Update successful!');
        console.log(`Updated at: ${result.result.sys_updated_on}`);
        
        // Validation step - verify the update actually worked
        console.log('');
        console.log('Validating update...');
        const updatedRecord = await getServiceNowRecord(table, params.sys_id);
        const updatedValue = updatedRecord[params.field];
        
        if (updatedValue === updateValue) {
            console.log('✓ Validation successful! Record was updated correctly.');
        } else {
            console.log('⚠ Validation warning: Updated value may not match exactly.');
            console.log('This could be due to ServiceNow formatting or transformation.');
            
            // Check if the content is substantially the same (ignoring minor formatting)
            const originalLines = updateValue.split('\n').map(line => line.trim()).filter(line => line);
            const updatedLines = updatedValue.split('\n').map(line => line.trim()).filter(line => line);
            
            if (originalLines.length === updatedLines.length) {
                let significantDifferences = 0;
                for (let i = 0; i < originalLines.length; i++) {
                    if (originalLines[i] !== updatedLines[i]) {
                        significantDifferences++;
                    }
                }
                
                if (significantDifferences === 0) {
                    console.log('✓ Content validation passed - only formatting differences detected.');
                } else if (significantDifferences < 5) {
                    console.log(`⚠ Minor differences detected (${significantDifferences} lines). This may be normal.`);
                } else {
                    console.log(`❌ Significant differences detected (${significantDifferences} lines). Update may have failed.`);
                    console.log('First few characters of what was actually saved:');
                    console.log(updatedValue.substring(0, 200) + '...');
                }
            } else {
                console.log(`❌ Line count mismatch. Expected: ${originalLines.length}, Got: ${updatedLines.length}`);
                console.log('Update may have failed or been truncated.');
            }
        }
        
        // Save backup
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `${params.type}_${params.sys_id}_${timestamp}.backup`);
        fs.writeFileSync(backupFile, JSON.stringify({
            table,
            sys_id: params.sys_id,
            field: params.field,
            original_value: currentRecord[params.field],
            updated_value: updateValue,
            timestamp: new Date().toISOString()
        }, null, 2));
        
        console.log(`Backup saved: ${backupFile}`);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run the updater
main();