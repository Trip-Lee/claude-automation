/**
 * ServiceNow File Watcher
 * Watches local files and automatically generates update files
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ServiceNowClaudeAPI = require('./sn-claude-api');

class ServiceNowFileWatcher {
    constructor(config) {
        this.config = config;
        this.watchedFiles = new Map(); // filepath -> {sysId, type, field, hash}
        this.tempDir = path.join(__dirname, 'temp_updates');
        this.watchDir = config.watchDir || path.join(__dirname, 'local_development');
        this.autoUpdate = config.autoUpdate || false;
        this.debounceTime = config.debounceTime || 1000;
        this.debounceTimers = new Map();
        
        this.ensureDirectories();
        this.loadWatchedFiles();

        // Initialize Claude API integration
        this.claudeAPI = new ServiceNowClaudeAPI(config);
    }

    ensureDirectories() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        if (!fs.existsSync(this.watchDir)) {
            fs.mkdirSync(this.watchDir, { recursive: true });
        }
        
        // Create subdirectories for different types
        const types = ['script_includes', 'rest_apis', 'business_rules', 'ui_actions', 'client_scripts'];
        types.forEach(type => {
            const dir = path.join(this.watchDir, type);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    loadWatchedFiles() {
        const mapFile = path.join(__dirname, 'file-mappings.json');
        if (fs.existsSync(mapFile)) {
            const mappings = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
            mappings.forEach(mapping => {
                this.watchedFiles.set(mapping.filepath, mapping);
            });
        }
    }

    saveWatchedFiles() {
        const mapFile = path.join(__dirname, 'file-mappings.json');
        const mappings = Array.from(this.watchedFiles.values());
        fs.writeFileSync(mapFile, JSON.stringify(mappings, null, 2));
    }

    /**
     * Register a file to watch
     */
    registerFile(filepath, sysId, type, field = 'script', recordName = '') {
        const fullPath = path.join(this.watchDir, filepath);
        
        // Calculate initial hash
        let hash = '';
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            hash = this.calculateHash(content);
        }

        this.watchedFiles.set(fullPath, {
            filepath: fullPath,
            sysId,
            type,
            field,
            recordName,
            hash,
            lastModified: new Date().toISOString()
        });

        this.saveWatchedFiles();
        console.log(`✓ Registered: ${recordName || filepath} -> ${type}:${sysId}`);
    }

    /**
     * Start watching files
     */
    startWatching() {
        console.log('╔═══════════════════════════════════════╗');
        console.log('║   ServiceNow File Watcher Started     ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('');
        console.log(`Watching directory: ${this.watchDir}`);
        console.log(`Auto-update: ${this.autoUpdate ? 'Enabled' : 'Disabled'}`);
        console.log(`Files tracked: ${this.watchedFiles.size}`);
        console.log('');

        // Watch the entire directory recursively
        fs.watch(this.watchDir, { recursive: true }, (eventType, filename) => {
            if (!filename) return;
            
            const fullPath = path.join(this.watchDir, filename);
            
            // Skip if not a .js file
            if (!filename.endsWith('.js')) return;
            
            // Skip if not in our watch list
            if (!this.watchedFiles.has(fullPath)) {
                // Check if it's a new file that matches our pattern
                this.checkNewFile(fullPath);
                return;
            }

            // Debounce the file change
            this.handleFileChange(fullPath);
        });

        console.log('Watching for changes... Press Ctrl+C to stop.');
        
        // Also watch for new mappings
        this.watchForNewMappings();
    }

    /**
     * Handle file change with debouncing
     */
    handleFileChange(filepath) {
        // Clear existing timer
        if (this.debounceTimers.has(filepath)) {
            clearTimeout(this.debounceTimers.get(filepath));
        }

        // Set new timer
        const timer = setTimeout(() => {
            this.processFileChange(filepath);
            this.debounceTimers.delete(filepath);
        }, this.debounceTime);

        this.debounceTimers.set(filepath, timer);
    }

    /**
     * Process actual file change
     */
    async processFileChange(filepath) {
        const mapping = this.watchedFiles.get(filepath);
        if (!mapping) return;

        try {
            // Read new content
            const content = fs.readFileSync(filepath, 'utf8');
            const newHash = this.calculateHash(content);

            // Check if actually changed
            if (newHash === mapping.hash) {
                return; // No actual change
            }

            console.log(`\n⚡ Change detected: ${mapping.recordName || path.basename(filepath)}`);

            // Generate update file
            const updateFilename = `${mapping.type}_${mapping.sysId}_${mapping.field}.js`;
            const updatePath = path.join(this.tempDir, updateFilename);
            
            fs.writeFileSync(updatePath, content);
            console.log(`  ✓ Update file created: ${updateFilename}`);

            // Update hash
            mapping.hash = newHash;
            mapping.lastModified = new Date().toISOString();
            this.saveWatchedFiles();

            // Claude auto-analysis if enabled
            if (this.claudeAPI.isAvailable()) {
                console.log('  🤖 Running Claude analysis...');
                try {
                    const oldContent = mapping.lastContent || '';
                    mapping.lastContent = content; // Store for next comparison

                    const analysis = await this.claudeAPI.analyzeFileChange(
                        filepath,
                        'modified',
                        oldContent,
                        content
                    );

                    if (analysis) {
                        const analysisFile = path.join(this.tempDir, `analysis_${mapping.type}_${mapping.sysId}_${Date.now()}.md`);
                        fs.writeFileSync(analysisFile, `# Claude Analysis - ${mapping.recordName}\n\n${analysis}`);
                        console.log(`  📋 Claude analysis saved: ${path.basename(analysisFile)}`);
                    }
                } catch (error) {
                    console.log(`  ⚠️ Claude analysis failed: ${error.message}`);
                }
            }

            // Auto-update if enabled
            if (this.autoUpdate) {
                console.log('  ⏳ Auto-updating ServiceNow...');
                await this.pushUpdate(mapping, updatePath);
            } else {
                console.log('  💡 Run sn-process-updates.bat to push changes');
            }

        } catch (error) {
            console.error(`  ✗ Error processing ${filepath}: ${error.message}`);
        }
    }

    /**
     * Check if a new file matches our naming pattern
     */
    checkNewFile(filepath) {
        const basename = path.basename(filepath, '.js');
        const dirname = path.basename(path.dirname(filepath));
        
        // Pattern: sysid_fieldname.js or name_sysid_field.js
        const patterns = [
            /^([a-f0-9]{32})(?:_(\w+))?$/,  // sysid or sysid_field
            /^(.+)_([a-f0-9]{32})(?:_(\w+))?$/  // name_sysid or name_sysid_field
        ];

        for (const pattern of patterns) {
            const match = basename.match(pattern);
            if (match) {
                // Determine type from directory
                const typeMap = {
                    'script_includes': 'script_include',
                    'rest_apis': 'rest_api',
                    'business_rules': 'business_rule',
                    'ui_actions': 'ui_action',
                    'client_scripts': 'client_script'
                };

                const type = typeMap[dirname];
                if (type) {
                    const sysId = match[2] || match[1];
                    const field = match[3] || match[2] || 'script';
                    const name = match[1] !== sysId ? match[1] : '';
                    
                    console.log(`\n🔍 New file detected: ${basename}`);
                    console.log(`  Auto-registering as ${type} (${sysId})`);
                    
                    this.registerFile(
                        path.relative(this.watchDir, filepath),
                        sysId,
                        type,
                        field,
                        name
                    );
                }
                break;
            }
        }
    }

    /**
     * Push update to ServiceNow
     */
    async pushUpdate(mapping, updatePath) {
        const ServiceNowTools = require('./servicenow-tools');
        const tools = new ServiceNowTools();

        try {
            await tools.updateRecord({
                type: mapping.type,
                sysId: mapping.sysId,
                field: mapping.field,
                file: updatePath,
                autoConfirm: true
            });

            // Move to processed
            const processedDir = path.join(this.tempDir, 'processed');
            if (!fs.existsSync(processedDir)) {
                fs.mkdirSync(processedDir);
            }

            const processedPath = path.join(processedDir, path.basename(updatePath));
            fs.renameSync(updatePath, processedPath);

            console.log('  ✓ Successfully updated in ServiceNow');
        } catch (error) {
            console.error(`  ✗ Failed to update: ${error.message}`);
        }
    }

    /**
     * Watch for new mapping requests
     */
    watchForNewMappings() {
        const requestFile = path.join(this.watchDir, 'register.json');
        
        // Create example if doesn't exist
        if (!fs.existsSync(requestFile)) {
            const example = {
                comment: "Add new files to watch here, then delete this file",
                files: [
                    {
                        filepath: "script_includes/MyScriptInclude.js",
                        sysId: "abc123def456",
                        type: "script_include",
                        field: "script",
                        recordName: "MyScriptInclude"
                    }
                ]
            };
            fs.writeFileSync(requestFile, JSON.stringify(example, null, 2));
        }

        // Watch for changes to register.json
        fs.watchFile(requestFile, (curr, prev) => {
            if (curr.mtime > prev.mtime) {
                try {
                    const data = JSON.parse(fs.readFileSync(requestFile, 'utf8'));
                    if (data.files && Array.isArray(data.files)) {
                        console.log('\n📝 Processing registration requests...');
                        data.files.forEach(file => {
                            this.registerFile(
                                file.filepath,
                                file.sysId,
                                file.type,
                                file.field,
                                file.recordName
                            );
                        });
                        
                        // Clear the file
                        fs.writeFileSync(requestFile, JSON.stringify({
                            comment: "Add new files to watch here",
                            files: []
                        }, null, 2));
                    }
                } catch (error) {
                    console.error('Error processing register.json:', error.message);
                }
            }
        });
    }

    /**
     * Calculate hash of content
     */
    calculateHash(content) {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Import existing files from ServiceNow
     */
    async importFromServiceNow(type, sysId, recordName) {
        const ServiceNowTools = require('./servicenow-tools');
        const tools = new ServiceNowTools();

        try {
            // Determine table
            const tableMap = {
                'script_include': 'sys_script_include',
                'rest_api': 'sys_ws_operation',
                'business_rule': 'sys_script',
                'ui_action': 'sys_ui_action',
                'client_script': 'sys_script_client'
            };

            const table = tableMap[type];
            const field = type === 'rest_api' ? 'operation_script' : 'script';

            // Fetch record
            console.log(`Importing ${recordName} from ServiceNow...`);
            const record = await tools.getRecord(table, sysId);

            // Determine directory
            const dirMap = {
                'script_include': 'script_includes',
                'rest_api': 'rest_apis',
                'business_rule': 'business_rules',
                'ui_action': 'ui_actions',
                'client_script': 'client_scripts'
            };

            const dir = path.join(this.watchDir, dirMap[type]);
            const filename = `${recordName.replace(/[^a-z0-9_]/gi, '_')}_${sysId}_${field}.js`;
            const filepath = path.join(dir, filename);

            // Write file
            fs.writeFileSync(filepath, record[field] || '// Empty script');

            // Register for watching
            this.registerFile(
                path.relative(this.watchDir, filepath),
                sysId,
                type,
                field,
                recordName || record.name
            );

            console.log(`✓ Imported to: ${filepath}`);
            return filepath;

        } catch (error) {
            console.error(`Failed to import: ${error.message}`);
            throw error;
        }
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    const config = {
        watchDir: path.join(__dirname, 'local_development'),
        autoUpdate: args.includes('--auto-update'),
        debounceTime: 1000
    };

    const watcher = new ServiceNowFileWatcher(config);

    switch (command) {
        case 'watch':
            watcher.startWatching();
            break;

        case 'import':
            if (args.length < 4) {
                console.log('Usage: node sn-file-watcher.js import [type] [sysId] [name]');
                process.exit(1);
            }
            watcher.importFromServiceNow(args[1], args[2], args[3])
                .then(() => process.exit(0))
                .catch(() => process.exit(1));
            break;

        case 'register':
            if (args.length < 4) {
                console.log('Usage: node sn-file-watcher.js register [filepath] [sysId] [type] [field] [name]');
                process.exit(1);
            }
            watcher.registerFile(args[1], args[2], args[3], args[4] || 'script', args[5] || '');
            console.log('Registration complete!');
            break;

        default:
            console.log('ServiceNow File Watcher');
            console.log('');
            console.log('Commands:');
            console.log('  watch                - Start watching files');
            console.log('  watch --auto-update  - Watch and auto-push changes');
            console.log('  import [type] [sysId] [name] - Import from ServiceNow');
            console.log('  register [filepath] [sysId] [type] - Register file to watch');
            console.log('');
            console.log('Examples:');
            console.log('  node sn-file-watcher.js watch');
            console.log('  node sn-file-watcher.js watch --auto-update');
            console.log('  node sn-file-watcher.js import script_include abc123 UserUtils');
    }
}

module.exports = ServiceNowFileWatcher;