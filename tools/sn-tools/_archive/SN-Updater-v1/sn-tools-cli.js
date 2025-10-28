#!/usr/bin/env node

/**
 * ServiceNow Tools CLI
 * User-friendly command-line interface for ServiceNow operations
 */

const ServiceNowTools = require('./servicenow-tools');
const ConfigManager = require('./config-manager');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

class ServiceNowCLI {
    constructor() {
        this.configManager = new ConfigManager();
        this.tools = null;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async init() {
        // Check if configuration exists
        if (!this.configManager.exists()) {
            console.log('No configuration found. Starting setup...');
            console.log('');
            const setupComplete = await this.configManager.setup();
            if (!setupComplete) {
                console.log('Setup cancelled. Exiting.');
                process.exit(1);
            }
        }

        try {
            this.tools = new ServiceNowTools();
        } catch (error) {
            console.error('Failed to initialize ServiceNow Tools:', error.message);
            console.log('Please run: node sn-tools-cli.js setup');
            process.exit(1);
        }
    }

    question(prompt) {
        return new Promise(resolve => {
            this.rl.question(prompt, resolve);
        });
    }

    async showMenu() {
        console.clear();
        console.log('╔═══════════════════════════════════════╗');
        console.log('║     ServiceNow Tools - Main Menu      ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('');
        console.log('1. Fetch Data (Script Includes, REST APIs, etc.)');
        console.log('2. Fetch Stories (User stories and requirements)');
        console.log('3. Update Record (Modify ServiceNow records)');
        console.log('4. Quick Update from File');
        console.log('5. Backup Management');
        console.log('6. Configuration');
        console.log('7. Help');
        console.log('0. Exit');
        console.log('');

        const choice = await this.question('Select an option: ');
        return choice;
    }

    async fetchDataMenu() {
        console.clear();
        console.log('╔═══════════════════════════════════════╗');
        console.log('║        Fetch ServiceNow Data          ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('');
        console.log('This will fetch all ServiceNow data including:');
        console.log('- Script Includes');
        console.log('- REST API Operations');
        console.log('- Business Rules');
        console.log('- UI Actions');
        console.log('- Client Scripts');
        console.log('');

        const confirm = await this.question('Proceed with data fetch? (Y/n): ');
        if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'no') {
            return;
        }

        try {
            await this.tools.fetchData();
            console.log('\n✓ Data fetch completed successfully!');
        } catch (error) {
            console.error('\n✗ Data fetch failed:', error.message);
        }

        await this.question('\nPress Enter to continue...');
    }

    async fetchStoriesMenu() {
        console.clear();
        console.log('╔═══════════════════════════════════════╗');
        console.log('║      Fetch ServiceNow Stories         ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('');
        console.log('This will fetch user stories and requirements.');
        console.log('');

        const confirm = await this.question('Proceed with story fetch? (Y/n): ');
        if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'no') {
            return;
        }

        try {
            await this.tools.fetchStories();
            console.log('\n✓ Story fetch completed successfully!');
        } catch (error) {
            console.error('\n✗ Story fetch failed:', error.message);
        }

        await this.question('\nPress Enter to continue...');
    }

    async updateRecordMenu() {
        console.clear();
        console.log('╔═══════════════════════════════════════╗');
        console.log('║      Update ServiceNow Record         ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('');

        // Record type
        console.log('Select record type:');
        console.log('1. Script Include');
        console.log('2. REST API Operation');
        console.log('3. Business Rule');
        console.log('4. UI Action');
        console.log('5. Client Script');
        console.log('');

        const typeChoice = await this.question('Select type (1-5): ');
        const typeMap = {
            '1': 'script_include',
            '2': 'rest_api',
            '3': 'business_rule',
            '4': 'ui_action',
            '5': 'client_script'
        };

        const type = typeMap[typeChoice];
        if (!type) {
            console.log('Invalid selection.');
            await this.question('Press Enter to continue...');
            return;
        }

        // System ID
        const sysId = await this.question('Enter System ID (sys_id): ');
        if (!sysId) {
            console.log('System ID is required.');
            await this.question('Press Enter to continue...');
            return;
        }

        // Field
        console.log('\nCommon fields:');
        if (type === 'script_include') {
            console.log('- script (JavaScript code)');
            console.log('- name');
            console.log('- description');
        } else if (type === 'rest_api') {
            console.log('- operation_script (JavaScript code)');
            console.log('- name');
            console.log('- description');
        } else {
            console.log('- script (JavaScript code)');
            console.log('- name');
            console.log('- condition');
        }

        const field = await this.question('\nEnter field name: ');
        if (!field) {
            console.log('Field name is required.');
            await this.question('Press Enter to continue...');
            return;
        }

        // Value source
        console.log('\nHow would you like to provide the new value?');
        console.log('1. From file');
        console.log('2. Enter directly');
        
        const valueSource = await this.question('Select (1-2): ');

        let value, file;
        if (valueSource === '1') {
            file = await this.question('Enter file path: ');
            if (!fs.existsSync(file)) {
                console.log('File not found.');
                await this.question('Press Enter to continue...');
                return;
            }
        } else if (valueSource === '2') {
            console.log('Enter the new value (type END on a new line when done):');
            const lines = [];
            let line;
            while ((line = await this.question('')) !== 'END') {
                lines.push(line);
            }
            value = lines.join('\n');
        } else {
            console.log('Invalid selection.');
            await this.question('Press Enter to continue...');
            return;
        }

        // Confirm
        console.log('\nReview your update:');
        console.log(`  Type: ${type}`);
        console.log(`  Sys ID: ${sysId}`);
        console.log(`  Field: ${field}`);
        console.log(`  Source: ${file || 'Direct input'}`);
        console.log('');

        const confirm = await this.question('Proceed with update? (y/N): ');
        if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
            console.log('Update cancelled.');
            await this.question('Press Enter to continue...');
            return;
        }

        try {
            await this.tools.updateRecord({
                type,
                sysId,
                field,
                value,
                file,
                autoConfirm: true
            });
            console.log('\n✓ Update completed successfully!');
        } catch (error) {
            console.error('\n✗ Update failed:', error.message);
        }

        await this.question('\nPress Enter to continue...');
    }

    async quickUpdateMenu() {
        console.clear();
        console.log('╔═══════════════════════════════════════╗');
        console.log('║      Quick Update from File           ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('');
        console.log('This allows quick updates from temp_updates folder.');
        console.log('');

        const tempDir = path.join(__dirname, 'temp_updates');
        if (!fs.existsSync(tempDir)) {
            console.log('No temp_updates directory found.');
            await this.question('Press Enter to continue...');
            return;
        }

        const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.js'));
        if (files.length === 0) {
            console.log('No .js files found in temp_updates.');
            await this.question('Press Enter to continue...');
            return;
        }

        console.log('Available files:');
        files.forEach((file, index) => {
            console.log(`${index + 1}. ${file}`);
        });
        console.log('');

        const fileChoice = await this.question('Select file (number): ');
        const selectedFile = files[parseInt(fileChoice) - 1];
        
        if (!selectedFile) {
            console.log('Invalid selection.');
            await this.question('Press Enter to continue...');
            return;
        }

        // Try to parse metadata from filename
        // Expected format: type_sysid_field.js
        const parts = selectedFile.replace('.js', '').split('_');
        
        const type = await this.question(`Record type (e.g., script_include) [${parts[0] || ''}]: `) || parts[0];
        const sysId = await this.question(`System ID [${parts[1] || ''}]: `) || parts[1];
        const field = await this.question(`Field name [${parts[2] || 'script'}]: `) || parts[2] || 'script';

        if (!type || !sysId) {
            console.log('Type and System ID are required.');
            await this.question('Press Enter to continue...');
            return;
        }

        const filePath = path.join(tempDir, selectedFile);

        console.log('\nReview quick update:');
        console.log(`  File: ${selectedFile}`);
        console.log(`  Type: ${type}`);
        console.log(`  Sys ID: ${sysId}`);
        console.log(`  Field: ${field}`);
        console.log('');

        const confirm = await this.question('Proceed with update? (y/N): ');
        if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
            console.log('Update cancelled.');
            await this.question('Press Enter to continue...');
            return;
        }

        try {
            await this.tools.updateRecord({
                type,
                sysId,
                field,
                file: filePath,
                autoConfirm: true
            });
            console.log('\n✓ Update completed successfully!');
            
            // Offer to delete the file
            const deleteFile = await this.question('Delete the update file? (Y/n): ');
            if (deleteFile.toLowerCase() !== 'n' && deleteFile.toLowerCase() !== 'no') {
                fs.unlinkSync(filePath);
                console.log('File deleted.');
            }
        } catch (error) {
            console.error('\n✗ Update failed:', error.message);
        }

        await this.question('\nPress Enter to continue...');
    }

    async backupMenu() {
        console.clear();
        console.log('╔═══════════════════════════════════════╗');
        console.log('║        Backup Management              ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('');
        console.log('1. List all backups');
        console.log('2. Restore from backup');
        console.log('3. Delete old backups');
        console.log('4. Export backup');
        console.log('0. Back to main menu');
        console.log('');

        const choice = await this.question('Select an option: ');

        switch (choice) {
            case '1':
                await this.listBackups();
                break;
            case '2':
                await this.restoreBackup();
                break;
            case '3':
                await this.deleteOldBackups();
                break;
            case '4':
                await this.exportBackup();
                break;
            case '0':
                return;
            default:
                console.log('Invalid selection.');
        }

        await this.question('\nPress Enter to continue...');
    }

    async listBackups() {
        const backups = this.tools.listBackups();
        
        if (backups.length === 0) {
            console.log('No backups found.');
            return;
        }

        console.log('\nAvailable backups:');
        console.log('');
        
        backups.forEach((backup, index) => {
            console.log(`${index + 1}. ${backup.file}`);
            console.log(`   Type: ${backup.type}, Field: ${backup.field}`);
            console.log(`   Date: ${backup.timestamp}`);
            console.log('');
        });
    }

    async restoreBackup() {
        const backups = this.tools.listBackups();
        
        if (backups.length === 0) {
            console.log('No backups found.');
            return;
        }

        console.log('\nSelect backup to restore:');
        backups.forEach((backup, index) => {
            console.log(`${index + 1}. ${backup.file.substring(0, 50)}...`);
        });
        console.log('');

        const choice = await this.question('Select backup (number): ');
        const selectedBackup = backups[parseInt(choice) - 1];

        if (!selectedBackup) {
            console.log('Invalid selection.');
            return;
        }

        console.log(`\nRestoring: ${selectedBackup.file}`);
        const confirm = await this.question('This will overwrite current value. Continue? (y/N): ');
        
        if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
            console.log('Restore cancelled.');
            return;
        }

        try {
            await this.tools.restoreBackup(selectedBackup.file, true);
            console.log('✓ Backup restored successfully!');
        } catch (error) {
            console.error('✗ Restore failed:', error.message);
        }
    }

    async deleteOldBackups() {
        const backups = this.tools.listBackups();
        
        if (backups.length === 0) {
            console.log('No backups found.');
            return;
        }

        console.log(`\nFound ${backups.length} backup(s).`);
        const days = await this.question('Delete backups older than (days): ');
        const daysNum = parseInt(days);

        if (isNaN(daysNum) || daysNum < 0) {
            console.log('Invalid number of days.');
            return;
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysNum);

        const toDelete = backups.filter(backup => {
            return new Date(backup.timestamp) < cutoffDate;
        });

        if (toDelete.length === 0) {
            console.log('No backups match the criteria.');
            return;
        }

        console.log(`\nFound ${toDelete.length} backup(s) to delete.`);
        const confirm = await this.question('Proceed with deletion? (y/N): ');
        
        if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
            console.log('Deletion cancelled.');
            return;
        }

        toDelete.forEach(backup => {
            const backupPath = path.join(this.tools.backupDir, backup.file);
            fs.unlinkSync(backupPath);
        });

        console.log(`✓ Deleted ${toDelete.length} backup(s).`);
    }

    async exportBackup() {
        const backups = this.tools.listBackups();
        
        if (backups.length === 0) {
            console.log('No backups found.');
            return;
        }

        console.log('\nSelect backup to export:');
        backups.forEach((backup, index) => {
            console.log(`${index + 1}. ${backup.file.substring(0, 50)}...`);
        });
        console.log('');

        const choice = await this.question('Select backup (number): ');
        const selectedBackup = backups[parseInt(choice) - 1];

        if (!selectedBackup) {
            console.log('Invalid selection.');
            return;
        }

        const exportPath = await this.question('Export path (e.g., C:\\Backups\\): ');
        if (!exportPath) {
            console.log('Export path required.');
            return;
        }

        const sourcePath = path.join(this.tools.backupDir, selectedBackup.file);
        const destPath = path.join(exportPath, selectedBackup.file);

        try {
            fs.copyFileSync(sourcePath, destPath);
            console.log(`✓ Backup exported to: ${destPath}`);
        } catch (error) {
            console.error('✗ Export failed:', error.message);
        }
    }

    async configMenu() {
        console.clear();
        console.log('╔═══════════════════════════════════════╗');
        console.log('║        Configuration Menu             ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('');
        console.log('1. View current configuration');
        console.log('2. Test connection');
        console.log('3. Reconfigure');
        console.log('4. Export configuration');
        console.log('0. Back to main menu');
        console.log('');

        const choice = await this.question('Select an option: ');

        switch (choice) {
            case '1':
                this.configManager.display();
                break;
            case '2':
                try {
                    const config = this.configManager.load();
                    await this.configManager.testConnection(config);
                    console.log('✓ Connection successful!');
                } catch (error) {
                    console.error('✗ Connection failed:', error.message);
                }
                break;
            case '3':
                await this.configManager.setup({ force: true });
                // Reinitialize tools with new config
                this.tools = new ServiceNowTools();
                break;
            case '4':
                const exportPath = await this.question('Export filename: ') || 'config-export.json';
                this.configManager.export(exportPath);
                break;
            case '0':
                return;
            default:
                console.log('Invalid selection.');
        }

        await this.question('\nPress Enter to continue...');
    }

    async showHelp() {
        console.clear();
        console.log('╔═══════════════════════════════════════╗');
        console.log('║           Help & Usage                ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('');
        console.log('ServiceNow Tools - Unified Package');
        console.log('===================================');
        console.log('');
        console.log('This tool combines three main functions:');
        console.log('');
        console.log('1. Data Fetching');
        console.log('   - Extracts ServiceNow records for local development');
        console.log('   - Includes Script Includes, REST APIs, Business Rules, etc.');
        console.log('');
        console.log('2. Story Fetching');
        console.log('   - Retrieves user stories and requirements');
        console.log('   - Helps understand project context');
        console.log('');
        console.log('3. Record Updating');
        console.log('   - Directly updates ServiceNow records');
        console.log('   - Automatic backup creation');
        console.log('   - Validation of updates');
        console.log('');
        console.log('Command Line Usage:');
        console.log('-------------------');
        console.log('node sn-tools-cli.js              - Interactive menu');
        console.log('node sn-tools-cli.js setup        - Configure connection');
        console.log('node sn-tools-cli.js fetch-data   - Fetch all data');
        console.log('node sn-tools-cli.js fetch-stories - Fetch stories');
        console.log('node sn-tools-cli.js update [options] - Update record');
        console.log('');
        console.log('For programmatic usage, see servicenow-tools.js');
        
        await this.question('\nPress Enter to continue...');
    }

    async run() {
        await this.init();

        // Check for command line arguments
        const args = process.argv.slice(2);
        if (args.length > 0) {
            await this.handleCommand(args);
            process.exit(0);
        }

        // Interactive menu
        let running = true;
        while (running) {
            const choice = await this.showMenu();

            switch (choice) {
                case '1':
                    await this.fetchDataMenu();
                    break;
                case '2':
                    await this.fetchStoriesMenu();
                    break;
                case '3':
                    await this.updateRecordMenu();
                    break;
                case '4':
                    await this.quickUpdateMenu();
                    break;
                case '5':
                    await this.backupMenu();
                    break;
                case '6':
                    await this.configMenu();
                    break;
                case '7':
                    await this.showHelp();
                    break;
                case '0':
                    console.log('Goodbye!');
                    running = false;
                    break;
                default:
                    console.log('Invalid selection. Please try again.');
                    await this.question('Press Enter to continue...');
            }
        }

        this.rl.close();
    }

    async handleCommand(args) {
        const command = args[0];

        switch (command) {
            case 'setup':
                await this.configManager.setup({ force: args.includes('--force') });
                break;
                
            case 'fetch-data':
                await this.tools.fetchData();
                break;
                
            case 'fetch-stories':
                await this.tools.fetchStories();
                break;
                
            case 'update':
                const params = {};
                for (let i = 1; i < args.length; i += 2) {
                    const key = args[i].replace('--', '');
                    params[key] = args[i + 1];
                }
                
                if (params['sys_id']) {
                    params.sysId = params['sys_id'];
                    delete params['sys_id'];
                }
                if (params['auto-confirm']) {
                    params.autoConfirm = true;
                    delete params['auto-confirm'];
                }
                
                await this.tools.updateRecord(params);
                break;
                
            default:
                console.log('Unknown command:', command);
                console.log('Run without arguments for interactive menu.');
        }
    }
}

// Run the CLI
const cli = new ServiceNowCLI();
cli.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});