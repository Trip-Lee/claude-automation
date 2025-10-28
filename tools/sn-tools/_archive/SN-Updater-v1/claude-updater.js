/**
 * Claude ServiceNow Updater
 * Allows Claude to directly update ServiceNow records
 * 
 * Usage:
 * node claude-updater.js --type [type] --sys_id [sys_id] --field [field] --file [file] --auto-confirm
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    params[key] = args[i + 1];
}

// Validate required parameters
if (!params.type || !params.sys_id || !params.field || !params.file) {
    console.error('Missing required parameters');
    console.log('Required: --type [script_include|rest_api] --sys_id [sys_id] --field [field] --file [file]');
    console.log('Optional: --auto-confirm (skip confirmation prompt)');
    process.exit(1);
}

// Check if file exists
const filePath = path.resolve(params.file);
if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

// Check if sn-config.json exists
const configPath = path.join(__dirname, 'sn-config.json');
if (!fs.existsSync(configPath)) {
    console.error('Error: sn-config.json not found!');
    console.log('Please copy sn-config.example.json to sn-config.json and update with your credentials.');
    process.exit(1);
}

console.log('=========================================');
console.log('     Claude ServiceNow Updater');
console.log('=========================================');
console.log(`Type: ${params.type}`);
console.log(`Sys ID: ${params.sys_id}`);
console.log(`Field: ${params.field}`);
console.log(`File: ${params.file}`);
console.log('');

// Build command arguments
const updateArgs = [
    'servicenow-updater.js',
    '--type', params.type,
    '--sys_id', params.sys_id,
    '--field', params.field,
    '--file', filePath
];

// Function to run the updater
function runUpdater() {
    const updater = spawn('node', updateArgs, {
        cwd: __dirname,
        stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    updater.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);
    });

    updater.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        process.stderr.write(text);
    });

    updater.on('close', (code) => {
        if (code === 0) {
            console.log('\n✓ Update completed successfully!');
            
            // Parse output to find backup location
            const backupMatch = output.match(/Backup saved: (.+)/);
            if (backupMatch) {
                console.log(`Backup created: ${backupMatch[1]}`);
            }
        } else {
            console.error(`\nUpdate failed with exit code ${code}`);
            if (errorOutput) {
                console.error('Error details:', errorOutput);
            }
        }
        process.exit(code);
    });

    // Handle auto-confirm
    if (params['auto-confirm']) {
        // Wait for the "Press Enter to continue" prompt
        setTimeout(() => {
            updater.stdin.write('\n');
        }, 2000);
    } else {
        // For manual confirmation, we need to pipe stdin
        process.stdin.pipe(updater.stdin);
    }
}

// If auto-confirm is enabled, run immediately
if (params['auto-confirm']) {
    console.log('Auto-confirm enabled - proceeding with update...');
    runUpdater();
} else {
    // Ask for confirmation
    console.log('Ready to update ServiceNow. Continue? (y/N): ');
    process.stdin.once('data', (data) => {
        const input = data.toString().trim().toLowerCase();
        if (input === 'y' || input === 'yes') {
            runUpdater();
        } else {
            console.log('Update cancelled.');
            process.exit(0);
        }
    });
}