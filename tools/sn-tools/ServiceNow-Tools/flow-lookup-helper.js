/**
 * ServiceNow Flow Lookup Helper
 * Helps find the latest flow snapshot and all connected flow records
 */

const fs = require('fs');
const path = require('path');

// Load configuration to get dynamic paths
function getDataBasePath() {
    try {
        const configPath = path.join(__dirname, 'sn-config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const dataSubdir = config.paths?.dataSubdir || 'Data';
            return path.join(__dirname, '..', 'ServiceNow-Data', dataSubdir);
        }
    } catch (error) {
        // Fallback to default if config loading fails
    }
    return path.join(__dirname, '..', 'ServiceNow-Data', 'Data');
}

const DATA_BASE_PATH = getDataBasePath();

/**
 * Find the latest flow snapshot for a given flow name
 * @param {string} flowName - The name of the flow (e.g., "Send Email V3")
 * @returns {object} - The latest snapshot info
 */
function findLatestFlowSnapshot(flowName) {
    console.log(`\n=== Finding Latest Snapshot for: ${flowName} ===`);
    
    // First, find the main flow record
    const flowPath = path.join(DATA_BASE_PATH, 'sys_hub_flow');
    const flowFiles = getAllJsonFiles(flowPath);
    
    let mainFlow = null;
    for (const file of flowFiles) {
        let data;
        try {
            data = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (error) {
            console.warn(`Could not read flow file ${file}: ${error.message}`);
            continue;
        }
        if (data.name && data.name.value === flowName) {
            mainFlow = data;
            console.log(`\nFound Main Flow:`);
            console.log(`  - sys_id: ${data._metadata.sys_id}`);
            console.log(`  - Latest Snapshot: ${data.latest_snapshot?.value}`);
            console.log(`  - Master Snapshot: ${data.master_snapshot?.value}`);
            console.log(`  - Status: ${data.status?.value}`);
            console.log(`  - Updated: ${data.sys_updated_on?.value}`);
            break;
        }
    }
    
    if (!mainFlow) {
        console.log(`Flow "${flowName}" not found`);
        return null;
    }
    
    // Now find the actual snapshot files
    const snapshotPath = path.join(DATA_BASE_PATH, 'sys_hub_flow_block');
    const snapshotFiles = getAllJsonFiles(snapshotPath);
    
    let snapshots = [];
    for (const file of snapshotFiles) {
        if (file.includes(flowName.replace(/ /g, '_'))) {
            let data;
            try {
                data = JSON.parse(fs.readFileSync(file, 'utf8'));
            } catch (error) {
                console.warn(`Could not read snapshot file ${file}: ${error.message}`);
                continue;
            }
            if (data.name && data.name.value === flowName) {
                snapshots.push({
                    sys_id: data._metadata.sys_id,
                    updated: data.sys_updated_on?.value,
                    updated_by: data.sys_updated_by?.value,
                    created: data.sys_created_on?.value,
                    created_by: data.sys_created_by?.value,
                    file: file
                });
            }
        }
    }
    
    // Sort by updated date to find the latest
    snapshots.sort((a, b) => new Date(b.updated) - new Date(a.updated));
    
    if (snapshots.length > 0) {
        console.log(`\n📊 Found ${snapshots.length} snapshots`);
        console.log('\n🔝 Latest Snapshot:');
        console.log(`  - sys_id: ${snapshots[0].sys_id}`);
        console.log(`  - Updated: ${snapshots[0].updated}`);
        console.log(`  - Updated By: ${snapshots[0].updated_by}`);
        console.log(`  - File: ${path.basename(snapshots[0].file)}`);
        
        return {
            flow: mainFlow,
            latestSnapshot: snapshots[0],
            allSnapshots: snapshots
        };
    }
    
    return { flow: mainFlow, latestSnapshot: null, allSnapshots: [] };
}

/**
 * Find all connected flow records (triggers, actions, subflows, etc.)
 * @param {string} flowSysId - The sys_id of the flow
 * @param {object} flowData - The flow data object (optional)
 * @returns {object} - All connected records
 */
function findConnectedFlowRecords(flowSysId, flowData = null) {
    console.log(`\n=== Finding Connected Records for Flow: ${flowSysId} ===`);
    
    const connected = {
        triggers: [],
        actions: [],
        subflows: [],
        variables: [],
        inputs: [],
        outputs: [],
        logic_instances: []
    };
    
    // Find triggers - check if flow has remote_trigger_id
    if (flowData && flowData.remote_trigger_id?.value) {
        const triggerId = flowData.remote_trigger_id.value;
        console.log(`  Looking for trigger: ${triggerId}`);
        
        const triggerTables = [
            'sys_flow_trigger',
            'sys_flow_record_trigger',
            'sys_flow_timer_trigger',
            'sys_flow_rest_trigger'
        ];
        
        for (const table of triggerTables) {
            const tablePath = path.join(DATA_BASE_PATH, table);
            if (fs.existsSync(tablePath)) {
                const files = getAllJsonFiles(tablePath);
                for (const file of files) {
                    if (file.includes(triggerId)) {
                        let data;
                        try {
                            data = JSON.parse(fs.readFileSync(file, 'utf8'));
                        } catch (error) {
                            console.warn(`Could not read trigger file ${file}: ${error.message}`);
                            continue;
                        }
                        connected.triggers.push({
                            type: table,
                            sys_id: data._metadata.sys_id,
                            condition: data.condition?.value,
                            table: data.table?.value,
                            active: data.active?.value,
                            on_insert: data.on_insert?.value,
                            on_update: data.on_update?.value,
                            file: path.basename(file)
                        });
                    }
                }
            }
        }
    }
    
    // Find flow logic instances
    const logicPath = path.join(DATA_BASE_PATH, 'sys_hub_flow_logic_instance_v2');
    if (fs.existsSync(logicPath)) {
        const files = getAllJsonFiles(logicPath);
        for (const file of files) {
            let content, data;
            try {
                content = fs.readFileSync(file, 'utf8');
                if (content.includes(flowSysId)) {
                    data = JSON.parse(content);
                } else {
                    continue;
                }
            } catch (error) {
                console.warn(`Could not read logic file ${file}: ${error.message}`);
                continue;
            }
                connected.logic_instances.push({
                    sys_id: data._metadata.sys_id,
                    file: path.basename(file)
                });
            }
        }
    }
    
    // Find variables
    const varPath = path.join(DATA_BASE_PATH, 'sys_hub_flow_logic_variable');
    if (fs.existsSync(varPath)) {
        const files = getAllJsonFiles(varPath);
        for (const file of files) {
            let content, data;
            try {
                content = fs.readFileSync(file, 'utf8');
                if (!content.includes(flowSysId)) continue;
            } catch (error) {
                console.warn(`Could not read variable file ${file}: ${error.message}`);
                continue;
            }
            try {
                data = JSON.parse(content);
            } catch (error) {
                console.warn(`Could not parse variable file ${file}: ${error.message}`);
                continue;
            }
                connected.variables.push({
                    sys_id: data._metadata.sys_id,
                    name: data.name?.value,
                    type: data.type?.value,
                    file: path.basename(file)
                });
            }
        }
    }
    
    // Find inputs
    const inputPath = path.join(DATA_BASE_PATH, 'sys_hub_flow_input');
    if (fs.existsSync(inputPath)) {
        const files = getAllJsonFiles(inputPath);
        for (const file of files) {
            let content, data;
            try {
                content = fs.readFileSync(file, 'utf8');
                if (!content.includes(flowSysId)) continue;
                data = JSON.parse(content);
            } catch (error) {
                console.warn(`Could not read input file ${file}: ${error.message}`);
                continue;
            }
                connected.inputs.push({
                    sys_id: data._metadata.sys_id,
                    name: data.name?.value,
                    type: data.type?.value,
                    file: path.basename(file)
                });
            }
        }
    }
    
    return connected;
}

/**
 * Get all JSON files recursively from a directory
 */
function getAllJsonFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;

    try {
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const filePath = path.join(dir, file);
            try {
                const stat = fs.statSync(filePath);
                if (stat && stat.isDirectory()) {
                    results = results.concat(getAllJsonFiles(filePath));
                } else if (file.endsWith('.json')) {
                    results.push(filePath);
                }
            } catch (error) {
                // Skip files/directories that can't be accessed
            }
        });
    } catch (error) {
        console.warn(`Could not read directory ${dir}: ${error.message}`);
    }
    return results;
}

/**
 * Main lookup function
 */
function lookupFlow(flowName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`FLOW LOOKUP: ${flowName}`);
    console.log('='.repeat(60));
    
    // Find latest snapshot
    const result = findLatestFlowSnapshot(flowName);
    if (!result) {
        console.log('\n❌ Flow not found');
        return null;
    }
    
    // Find connected records
    const connected = findConnectedFlowRecords(result.flow._metadata.sys_id, result.flow);
    
    // Display connected records
    console.log('\n📎 Connected Records:');
    
    if (connected.triggers.length > 0) {
        console.log(`\n  🔔 Triggers (${connected.triggers.length}):`);
        connected.triggers.forEach(t => {
            console.log(`    - ${t.type}: ${t.sys_id}`);
            if (t.table) console.log(`      Table: ${t.table}`);
            if (t.condition) console.log(`      Condition: ${t.condition}`);
            console.log(`      Active: ${t.active}, Insert: ${t.on_insert}, Update: ${t.on_update}`);
        });
    }
    
    if (connected.logic_instances.length > 0) {
        console.log(`\n  ⚙️ Logic Instances: ${connected.logic_instances.length}`);
    }
    
    if (connected.variables.length > 0) {
        console.log(`\n  📊 Variables: ${connected.variables.length}`);
    }
    
    if (connected.inputs.length > 0) {
        console.log(`\n  📥 Inputs: ${connected.inputs.length}`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    return {
        ...result,
        connected
    };
}

// Export for use in other scripts
module.exports = {
    findLatestFlowSnapshot,
    findConnectedFlowRecords,
    lookupFlow
};

// Run if called directly
if (require.main === module) {
    const flowName = process.argv[2] || 'Send Email V3';
    lookupFlow(flowName);
}