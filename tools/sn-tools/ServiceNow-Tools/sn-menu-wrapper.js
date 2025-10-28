#!/usr/bin/env node

/**
 * Menu Wrapper Script
 * Runs operations and returns to interactive menu
 */

const { spawn } = require('child_process');
const path = require('path');

async function runOperationAndShowMenu(operation) {
    console.log(`Running operation: ${operation}...`);

    return new Promise((resolve, reject) => {
        const child = spawn('node', ['sn-operations.js', operation], {
            stdio: 'inherit',
            cwd: __dirname
        });

        child.on('close', (code) => {
            console.log(`\nOperation completed with code: ${code}`);

            if (code === 0) {
                console.log('\n✅ Operation completed successfully!');
            } else {
                console.log('\n⚠️  Operation completed with warnings or errors.');
            }

            console.log('\nReturning to main menu...');

            // Now show the interactive launcher
            const launcher = spawn('node', ['sn-launcher.js'], {
                stdio: 'inherit',
                cwd: __dirname
            });

            launcher.on('close', (launcherCode) => {
                resolve(launcherCode);
            });

            launcher.on('error', (error) => {
                reject(error);
            });
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

// Get the operation from command line arguments
const operation = process.argv[2];

if (!operation) {
    console.error('Usage: node sn-menu-wrapper.js <operation>');
    console.error('Example: node sn-menu-wrapper.js fetch-data');
    process.exit(1);
}

// Run the operation and then show menu
runOperationAndShowMenu(operation)
    .then((code) => {
        process.exit(code || 0);
    })
    .catch((error) => {
        console.error('Error:', error.message);
        process.exit(1);
    });