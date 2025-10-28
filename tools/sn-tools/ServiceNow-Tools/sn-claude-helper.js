/**
 * ServiceNow Claude Helper
 * Features designed to help Claude assist with development tasks more effectively
 */

const fs = require('fs');
const path = require('path');

class ServiceNowClaudeHelper {
    constructor() {
        this.logFile = path.join(__dirname, 'claude-activity.log');
        this.contextFile = path.join(__dirname, 'claude-context.json');
        this.errorFile = path.join(__dirname, 'claude-errors.log');
        this.summaryFile = path.join(__dirname, 'claude-summary.md');

        // Load configuration for dynamic paths
        this.config = this.loadConfig();
        this.setupPaths();
    }

    /**
     * Load configuration from file
     */
    loadConfig() {
        try {
            const configPath = path.join(__dirname, 'sn-config.json');
            if (fs.existsSync(configPath)) {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
        } catch (error) {
            console.warn('Could not load configuration, using defaults');
        }

        // Return default configuration
        return {
            paths: {
                componentRepoName: 'Component Repo',
                componentDirectories: ['Sashimono', 'component-library']
            }
        };
    }

    /**
     * Setup dynamic paths based on configuration
     */
    setupPaths() {
        const componentRepoName = this.config.paths?.componentRepoName || 'Component Repo';
        const componentDirectories = this.config.paths?.componentDirectories || ['Sashimono', 'component-library'];

        this.componentBasePath = path.join(__dirname, '..', componentRepoName);
        this.componentDirectories = componentDirectories.map(dir =>
            path.join(this.componentBasePath, dir)
        );
    }

    /**
     * Log Claude activity for context
     */
    logActivity(action, details, success = true) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            action,
            details,
            success,
            duration: details.duration || 0
        };

        // Append to log file
        const logLine = `${timestamp} | ${success ? '✓' : '✗'} | ${action} | ${JSON.stringify(details)}\n`;
        try {
            fs.appendFileSync(this.logFile, logLine);
        } catch (error) {
            console.warn(`Could not write to log file: ${error.message}`);
        }

        // Update context
        this.updateContext(logEntry);

        console.log(`📝 Logged: ${action} (${success ? 'Success' : 'Failed'})`);
    }

    /**
     * Update Claude context file
     */
    updateContext(logEntry) {
        let context = { recentActions: [], statistics: {}, lastUpdate: '' };
        
        if (fs.existsSync(this.contextFile)) {
            try {
                context = JSON.parse(fs.readFileSync(this.contextFile, 'utf8'));
            } catch (e) {
                // File corrupted, start fresh
            }
        }

        // Add to recent actions (keep last 20)
        context.recentActions.unshift(logEntry);
        context.recentActions = context.recentActions.slice(0, 20);

        // Update statistics
        if (!context.statistics[logEntry.action]) {
            context.statistics[logEntry.action] = { total: 0, success: 0, failures: 0 };
        }
        context.statistics[logEntry.action].total++;
        if (logEntry.success) {
            context.statistics[logEntry.action].success++;
        } else {
            context.statistics[logEntry.action].failures++;
        }

        context.lastUpdate = new Date().toISOString();

        try {
            fs.writeFileSync(this.contextFile, JSON.stringify(context, null, 2));
        } catch (error) {
            console.warn(`Could not write context file: ${error.message}`);
        }
    }

    /**
     * Create context summary for Claude
     */
    generateContextSummary() {
        let summary = '# Claude Development Context\n\n';
        
        // Recent activity
        if (fs.existsSync(this.contextFile)) {
            let context;
            try {
                context = JSON.parse(fs.readFileSync(this.contextFile, 'utf8'));
            } catch (error) {
                console.warn(`Could not read context file: ${error.message}`);
                return summary + 'Context file unavailable.\n';
            }
            
            summary += '## Recent Activity\n\n';
            context.recentActions.slice(0, 5).forEach(action => {
                const status = action.success ? '✓' : '✗';
                const time = new Date(action.timestamp).toLocaleString();
                summary += `- ${status} **${action.action}** - ${time}\n`;
                if (action.details.error) {
                    summary += `  - Error: ${action.details.error}\n`;
                }
                if (action.details.files) {
                    summary += `  - Files: ${action.details.files.join(', ')}\n`;
                }
            });

            summary += '\n## Statistics\n\n';
            Object.entries(context.statistics).forEach(([action, stats]) => {
                const successRate = ((stats.success / stats.total) * 100).toFixed(1);
                summary += `- **${action}**: ${stats.total} total, ${successRate}% success rate\n`;
            });
        }

        // Current project state
        summary += '\n## Current Project State\n\n';
        summary += this.generateProjectState();

        // Recent errors
        if (fs.existsSync(this.errorFile)) {
            summary += '\n## Recent Errors\n\n';
            try {
                const errors = fs.readFileSync(this.errorFile, 'utf8').split('\n').slice(-10);
                errors.filter(err => err.trim()).forEach(error => {
                    summary += `- ${error}\n`;
                });
            } catch (error) {
                summary += 'Error reading error log file.\n';
            }
        }

        // Pending items
        summary += '\n## Pending Items\n\n';
        summary += this.getPendingItems();

        // Save summary
        try {
            fs.writeFileSync(this.summaryFile, summary);
        } catch (error) {
            console.warn(`Could not write summary file: ${error.message}`);
        }
        console.log('📋 Context summary generated: claude-summary.md');
        
        return summary;
    }

    /**
     * Generate project state info
     */
    generateProjectState() {
        let state = '';
        
        // Check temp_updates
        const tempDir = path.join(__dirname, 'temp_updates');
        if (fs.existsSync(tempDir)) {
            try {
                const pending = fs.readdirSync(tempDir).filter(f => f.endsWith('.js'));
                state += `- Pending updates: ${pending.length} files\n`;
                if (pending.length > 0) {
                    state += `  - Files: ${pending.slice(0, 5).join(', ')}${pending.length > 5 ? '...' : ''}\n`;
                }
            } catch (error) {
                state += '- Pending updates: Error reading directory\n';
            }
        }

        // Check backups
        const backupDir = path.join(__dirname, 'backups');
        if (fs.existsSync(backupDir)) {
            try {
                const backups = fs.readdirSync(backupDir).filter(f => f.endsWith('.backup'));
                state += `- Available backups: ${backups.length}\n`;
            } catch (error) {
                state += '- Available backups: Error reading directory\n';
            }
        }

        // Check configuration
        const configFile = path.join(__dirname, 'sn-config.json');
        if (fs.existsSync(configFile)) {
            try {
                const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                const instances = Object.keys(config.instances || {});
                state += `- Configured instances: ${instances.join(', ')}\n`;
            } catch (e) {
                state += '- Configuration: Error reading config\n';
            }
        } else {
            state += '- Configuration: Not configured\n';
        }

        return state || '- No significant state information available\n';
    }

    /**
     * Get pending items
     */
    getPendingItems() {
        let items = '';
        
        // Check for common issues
        const issuesFile = path.join(__dirname, 'known-issues.json');
        if (fs.existsSync(issuesFile)) {
            try {
                const issues = JSON.parse(fs.readFileSync(issuesFile, 'utf8'));
                issues.forEach(issue => {
                    items += `- **${issue.type}**: ${issue.description}\n`;
                });
            } catch (e) {
                // Ignore
            }
        }
        
        return items || '- No pending items identified\n';
    }

    /**
     * Log error for Claude context
     */
    logError(error, context = {}) {
        const timestamp = new Date().toISOString();
        const errorEntry = `${timestamp} | ${error.message || error} | ${JSON.stringify(context)}`;
        
        try {
            fs.appendFileSync(this.errorFile, errorEntry + '\n');
        } catch (err) {
            console.warn(`Could not write to error log: ${err.message}`);
        }
        
        this.logActivity('error_occurred', {
            error: error.message || error,
            context
        }, false);
    }

    /**
     * Create code change documentation
     */
    documentCodeChange(file, changeType, description, sysId = null) {
        const timestamp = new Date().toISOString();
        const changeDoc = {
            timestamp,
            file: path.relative(__dirname, file),
            changeType, // 'created', 'modified', 'deleted'
            description,
            sysId
        };

        // Update CLAUDE.md with change
        this.updateClaudeMd(changeDoc);

        this.logActivity('code_change', changeDoc, true);
    }

    /**
     * Update CLAUDE.md with change information
     */
    updateClaudeMd(changeDoc) {
        const claudeMdPath = path.join(__dirname, '..', 'CLAUDE.md');
        
        if (!fs.existsSync(claudeMdPath)) return;

        let content;
        try {
            content = fs.readFileSync(claudeMdPath, 'utf8');
        } catch (error) {
            console.warn(`Could not read CLAUDE.md: ${error.message}`);
            return;
        }
        
        // Find or create recent changes section
        const recentChangesMarker = '## Recent Changes (Auto-Generated)';
        
        if (!content.includes(recentChangesMarker)) {
            content += '\n\n' + recentChangesMarker + '\n\n';
        }

        // Add new change
        const changeEntry = `- **${changeDoc.timestamp.split('T')[0]}**: ${changeDoc.changeType} \`${changeDoc.file}\` - ${changeDoc.description}\n`;
        
        const lines = content.split('\n');
        const markerIndex = lines.findIndex(line => line.includes(recentChangesMarker));
        
        if (markerIndex !== -1) {
            lines.splice(markerIndex + 2, 0, changeEntry.trim());
            
            // Keep only last 10 changes
            const changeLines = lines.slice(markerIndex + 2).filter(line => line.startsWith('- **'));
            const otherLines = lines.slice(markerIndex + 2).filter(line => !line.startsWith('- **'));
            
            const recentChangeLines = changeLines.slice(0, 10);
            lines.splice(markerIndex + 2, lines.length - markerIndex - 2, ...recentChangeLines, ...otherLines);
        }

        try {
            fs.writeFileSync(claudeMdPath, lines.join('\n'));
        } catch (error) {
            console.warn(`Could not write CLAUDE.md: ${error.message}`);
        }
    }

    /**
     * Generate fix script from error
     */
    generateFixScript(errorMessage, context = {}) {
        const fixes = {
            'HTTP 401': 'Check credentials in sn-config.json',
            'HTTP 404': 'Verify sys_id and table name are correct',
            'Connection timeout': 'Check network connection and firewall settings',
            'File not found': 'Verify file paths are correct',
            'Invalid type': 'Check supported types: script_include, rest_api, business_rule, ui_action, client_script',
            'Configuration not found': 'Run sn-setup.bat to configure'
        };

        let fixScript = '#!/bin/bash\n';
        fixScript += `# Auto-generated fix script for: ${errorMessage}\n`;
        fixScript += `# Generated: ${new Date().toISOString()}\n\n`;

        // Find matching fix
        const matchingFix = Object.entries(fixes).find(([key]) => 
            errorMessage.toLowerCase().includes(key.toLowerCase())
        );

        if (matchingFix) {
            fixScript += `echo "Suggested fix: ${matchingFix[1]}"\n`;
            
            // Add specific commands based on error type
            if (matchingFix[0] === 'Configuration not found') {
                fixScript += 'node sn-operations.js test\n';
                fixScript += 'echo "If test fails, run sn-setup.bat"\n';
            } else if (matchingFix[0].startsWith('HTTP')) {
                fixScript += 'node sn-operations.js test\n';
                fixScript += 'echo "Testing connection to all configured instances"\n';
            }
        } else {
            fixScript += 'echo "No automatic fix available for this error"\n';
            fixScript += 'echo "Please review error details and check documentation"\n';
        }

        const fixScriptPath = path.join(__dirname, 'auto-fix.sh');
        try {
            fs.writeFileSync(fixScriptPath, fixScript);
        } catch (error) {
            console.warn(`Could not write fix script: ${error.message}`);
            return null;
        }
        
        console.log('🔧 Generated fix script: auto-fix.sh');
        return fixScriptPath;
    }

    /**
     * Auto-trace component data flow including Sashimono dependencies
     */
    async autoTraceComponent(componentName) {
        const RestApiDetailFetcher = require('./fetch-rest-api-details.js');
        
        this.logActivity('auto_trace_start', { component: componentName }, true);
        
        try {
            // Step 1: Find Sashimono component dependencies
            console.log('🔍 Step 1: Scanning for Sashimono component dependencies...');
            const sashimonoComponents = await this.findSashimonoComponents(componentName);
            
            // Step 2: Find REST APIs for main component
            console.log('🔍 Step 2: Scanning REST APIs for main component...');
            const configPath = path.join(__dirname, 'sn-config.json');
            let config;
            try {
                const configData = fs.readFileSync(configPath, 'utf8');
                config = JSON.parse(configData);
            } catch (error) {
                console.error(`Could not read config file: ${error.message}`);
                throw new Error(`Configuration file error: ${error.message}`);
            }
            
            const instanceKey = config.routing?.default || Object.keys(config.instances)[0];
            const instanceConfig = config.instances[instanceKey];
            
            const fetcher = new RestApiDetailFetcher(instanceConfig);
            const mainApiResults = await fetcher.traceComponentApis(componentName);
            
            // Step 3: Find REST APIs for Sashimono components
            console.log('🔍 Step 3: Scanning REST APIs for Sashimono dependencies...');
            const sashimonoApiResults = [];
            for (const sashimonoComp of sashimonoComponents) {
                const apis = await fetcher.traceComponentApis(sashimonoComp.name);
                sashimonoApiResults.push({
                    component: sashimonoComp,
                    apis: apis
                });
            }
            
            // Generate comprehensive trace summary
            const traceSummary = this.generateComprehensiveTraceSummary(
                componentName, 
                mainApiResults, 
                sashimonoComponents,
                sashimonoApiResults
            );
            
            this.logActivity('auto_trace_complete', { 
                component: componentName, 
                mainApisFound: mainApiResults.length,
                sashimonoComponents: sashimonoComponents.length,
                sashimonoApis: sashimonoApiResults.reduce((sum, result) => sum + result.apis.length, 0),
                summary: traceSummary 
            }, true);
            
            return traceSummary;
            
        } catch (error) {
            this.logError(error, { component: componentName, operation: 'auto_trace' });
            throw error;
        }
    }

    /**
     * Find Sashimono component dependencies
     */
    async findSashimonoComponents(componentName) {
        const sashimonoComponents = [];
        
        try {
            // Find the main component directory
            const componentPath = await this.findComponentPath(componentName);
            if (!componentPath) {
                console.log('⚠️  Main component not found in expected locations');
                return sashimonoComponents;
            }
            
            console.log(`📁 Found main component at: ${componentPath}`);
            
            // Scan component files for Sashimono imports
            const sashimonoRefs = await this.scanForSashimonoReferences(componentPath);
            
            // Find actual Sashimono component details
            for (const ref of sashimonoRefs) {
                const sashimonoPath = await this.findSashimonoComponent(ref);
                if (sashimonoPath) {
                    sashimonoComponents.push({
                        name: ref,
                        path: sashimonoPath,
                        usage: 'imported'
                    });
                }
            }
            
            console.log(`📦 Found ${sashimonoComponents.length} Sashimono dependencies:`);
            sashimonoComponents.forEach(comp => {
                console.log(`   - ${comp.name} (${comp.path})`);
            });
            
        } catch (error) {
            console.log(`⚠️  Error scanning for Sashimono components: ${error.message}`);
        }
        
        return sashimonoComponents;
    }

    /**
     * Find component path in both repositories
     */
    async findComponentPath(componentName) {
        const basePaths = this.componentDirectories;
        
        for (const basePath of basePaths) {
            if (!fs.existsSync(basePath)) continue;
            
            try {
                const dirs = fs.readdirSync(basePath, { withFileTypes: true });
                for (const dir of dirs) {
                    if (dir.isDirectory()) {
                        // Check for exact match or kebab-case variations
                        const dirName = dir.name.toLowerCase();
                        const searchName = componentName.toLowerCase().replace(/\s+/g, '');
                        const kebabName = componentName.toLowerCase().replace(/\s+/g, '-');
                        
                        if (dirName === searchName || 
                            dirName === kebabName ||
                            dirName.includes(searchName) ||
                            searchName.includes(dirName)) {
                            return path.join(basePath, dir.name);
                        }
                    }
                }
            } catch (error) {
                // Skip directory if can't read
            }
        }
        
        return null;
    }

    /**
     * Scan component files for Sashimono references
     */
    async scanForSashimonoReferences(componentPath) {
        const sashimonoRefs = new Set();
        
        try {
            await this.scanDirectoryForSashimono(componentPath, sashimonoRefs);
        } catch (error) {
            console.log(`⚠️  Error scanning directory: ${error.message}`);
        }
        
        return Array.from(sashimonoRefs);
    }

    /**
     * Recursively scan directory for Sashimono imports
     */
    async scanDirectoryForSashimono(dirPath, sashimonoRefs) {
        try {
            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const item of items) {
                const itemPath = path.join(dirPath, item.name);
                
                if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
                    await this.scanDirectoryForSashimono(itemPath, sashimonoRefs);
                } else if (item.isFile() && (item.name.endsWith('.js') || item.name.endsWith('.ts'))) {
                    await this.scanFileForSashimono(itemPath, sashimonoRefs);
                }
            }
        } catch (error) {
            // Skip directories we can't read
        }
    }

    /**
     * Scan individual file for Sashimono imports
     */
    async scanFileForSashimono(filePath, sashimonoRefs) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Look for Sashimono imports
            const sashimonoPatterns = [
                /@tenonhq\/([a-zA-Z][a-zA-Z0-9-_]*)/g,  // @tenonhq/component-name
                /from\s+['"`]@tenonhq\/([a-zA-Z][a-zA-Z0-9-_]*)['"`]/g,
                /import\s+.*\s+from\s+['"`]@tenonhq\/([a-zA-Z][a-zA-Z0-9-_]*)['"`]/g,
                /require\s*\(\s*['"`]@tenonhq\/([a-zA-Z][a-zA-Z0-9-_]*)['"`]\s*\)/g
            ];
            
            sashimonoPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    sashimonoRefs.add(match[1]);
                }
            });
            
            // Look for custom element usage (cadso- or tenon- prefixed components)
            const elementPatterns = [
                /<(cadso-[a-zA-Z][a-zA-Z0-9-]*)/g,
                /<(tenon-[a-zA-Z][a-zA-Z0-9-]*)/g,
                /["'`](cadso-[a-zA-Z][a-zA-Z0-9-]*)["'`]/g,
                /["'`](tenon-[a-zA-Z][a-zA-Z0-9-]*)["'`]/g
            ];
            
            elementPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    // Convert element name to component name
                    const elementName = match[1];
                    const componentName = this.elementNameToComponentName(elementName);
                    sashimonoRefs.add(componentName);
                }
            });
            
        } catch (error) {
            // Skip files we can't read
        }
    }

    /**
     * Convert element name to component directory name
     */
    elementNameToComponentName(elementName) {
        // Remove cadso- or tenon- prefix and convert to PascalCase
        const withoutPrefix = elementName.replace(/^(cadso-|tenon-)/, '');
        return withoutPrefix.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join('');
    }

    /**
     * Find Sashimono component path
     */
    async findSashimonoComponent(componentName) {
        // Look in all component directories for the component
        for (const componentDir of this.componentDirectories) {
            if (!fs.existsSync(componentDir)) continue;

            try {
                const dirs = fs.readdirSync(componentDir, { withFileTypes: true });
                for (const dir of dirs) {
                    if (dir.isDirectory()) {
                        // Check for exact match or variations
                        const dirName = dir.name.toLowerCase();
                        const searchName = componentName.toLowerCase();

                        if (dirName === searchName ||
                            dirName.replace(/[-_]/g, '') === searchName.replace(/[-_]/g, '')) {
                            return path.join(componentDir, dir.name);
                        }
                    }
                }
            } catch (error) {
                // Skip if can't read directory
            }
        }

        return null;
    }

    /**
     * Generate comprehensive component trace summary including Sashimono dependencies
     */
    generateComprehensiveTraceSummary(componentName, mainApiResults, sashimonoComponents, sashimonoApiResults) {
        let summary = `# ${componentName} Comprehensive Component Data Flow Summary\n\n`;
        
        // Component hierarchy overview
        summary += `## Component Architecture Overview\n\n`;
        summary += `**Main Component**: ${componentName}\n`;
        summary += `**Sashimono Dependencies**: ${sashimonoComponents.length}\n`;
        
        const totalApis = mainApiResults.length + sashimonoApiResults.reduce((sum, result) => sum + result.apis.length, 0);
        summary += `**Total REST APIs**: ${totalApis}\n\n`;
        
        // Sashimono Dependencies
        if (sashimonoComponents.length > 0) {
            summary += `## Sashimono Component Dependencies\n\n`;
            sashimonoComponents.forEach((comp, index) => {
                const apiCount = sashimonoApiResults.find(r => r.component.name === comp.name)?.apis.length || 0;
                summary += `### ${index + 1}. ${comp.name}\n`;
                summary += `- **Path**: \`${comp.path}\`\n`;
                summary += `- **Usage**: ${comp.usage}\n`;
                summary += `- **REST APIs**: ${apiCount}\n\n`;
            });
        } else {
            summary += `## Sashimono Component Dependencies\n\n`;
            summary += `No Sashimono dependencies found.\n\n`;
        }
        
        // Main Component APIs
        summary += `## Main Component REST APIs (${mainApiResults.length})\n\n`;
        if (mainApiResults.length === 0) {
            summary += `No REST API operations found for main component: ${componentName}\n\n`;
        } else {
            mainApiResults.forEach((api, index) => {
                summary += `### ${index + 1}. ${api.name.display_value}\n`;
                summary += `- **URI**: \`${api.operation_uri.value}\`\n`;
                summary += `- **Method**: ${api.http_method.display_value}\n`;
                summary += `- **sys_id**: ${api.sys_id.value}\n`;
                
                if (api._analysis.script_include_references.length > 0) {
                    summary += `- **Script Includes**: ${api._analysis.script_include_references.join(', ')}\n`;
                }
                
                summary += `- **MS Pattern**: ${api._analysis.has_ms_pattern ? 'Yes' : 'No'}\n\n`;
            });
        }
        
        // Sashimono Component APIs
        sashimonoApiResults.forEach(result => {
            if (result.apis.length > 0) {
                summary += `## ${result.component.name} REST APIs (${result.apis.length})\n\n`;
                result.apis.forEach((api, index) => {
                    summary += `### ${index + 1}. ${api.name.display_value}\n`;
                    summary += `- **URI**: \`${api.operation_uri.value}\`\n`;
                    summary += `- **Method**: ${api.http_method.display_value}\n`;
                    summary += `- **sys_id**: ${api.sys_id.value}\n`;
                    
                    if (api._analysis.script_include_references.length > 0) {
                        summary += `- **Script Includes**: ${api._analysis.script_include_references.join(', ')}\n`;
                    }
                    
                    summary += `- **MS Pattern**: ${api._analysis.has_ms_pattern ? 'Yes' : 'No'}\n\n`;
                });
            }
        });
        
        // Consolidated Script Include Usage
        const allScriptIncludes = {};
        
        // Collect from main component
        mainApiResults.forEach(api => {
            api._analysis.script_include_references.forEach(ref => {
                if (!allScriptIncludes[ref]) {
                    allScriptIncludes[ref] = { main: [], sashimono: {} };
                }
                allScriptIncludes[ref].main.push(api.name.display_value);
            });
        });
        
        // Collect from Sashimono components
        sashimonoApiResults.forEach(result => {
            result.apis.forEach(api => {
                api._analysis.script_include_references.forEach(ref => {
                    if (!allScriptIncludes[ref]) {
                        allScriptIncludes[ref] = { main: [], sashimono: {} };
                    }
                    if (!allScriptIncludes[ref].sashimono[result.component.name]) {
                        allScriptIncludes[ref].sashimono[result.component.name] = [];
                    }
                    allScriptIncludes[ref].sashimono[result.component.name].push(api.name.display_value);
                });
            });
        });
        
        if (Object.keys(allScriptIncludes).length > 0) {
            summary += `## Consolidated Script Include Usage\n\n`;
            Object.entries(allScriptIncludes).forEach(([scriptInclude, usage]) => {
                summary += `### ${scriptInclude}\n`;
                
                if (usage.main.length > 0) {
                    summary += `- **Main Component**: ${usage.main.join(', ')}\n`;
                }
                
                Object.entries(usage.sashimono).forEach(([componentName, apis]) => {
                    summary += `- **${componentName}**: ${apis.join(', ')}\n`;
                });
                
                summary += '\n';
            });
        }
        
        // Architecture Analysis
        const allApis = [...mainApiResults, ...sashimonoApiResults.flatMap(r => r.apis)];
        const msPatternCount = allApis.filter(api => api._analysis.has_ms_pattern).length;
        
        summary += `## Architecture Analysis\n\n`;
        summary += `- **Total Components**: ${1 + sashimonoComponents.length} (1 main + ${sashimonoComponents.length} Sashimono)\n`;
        summary += `- **Total APIs**: ${allApis.length}\n`;
        summary += `- **Using MS Pattern**: ${msPatternCount}/${allApis.length}\n`;
        summary += `- **Pattern Compliance**: ${allApis.length > 0 ? ((msPatternCount / allApis.length) * 100).toFixed(1) : 0}%\n`;
        summary += `- **Unique Script Includes**: ${Object.keys(allScriptIncludes).length}\n\n`;
        
        // Data Flow Map
        summary += `## Complete Data Flow Map\n\n`;
        summary += `\`\`\`\n`;
        summary += `${componentName} (Main Component)\n`;
        if (sashimonoComponents.length > 0) {
            summary += `├── Sashimono Dependencies:\n`;
            sashimonoComponents.forEach((comp, index) => {
                const isLast = index === sashimonoComponents.length - 1;
                summary += `${isLast ? '└──' : '├──'} ${comp.name}\n`;
            });
        }
        if (allApis.length > 0) {
            summary += `├── REST APIs (${allApis.length} total)\n`;
            summary += `├── Script Includes (${Object.keys(allScriptIncludes).length} unique)\n`;
            summary += `└── MS Pattern Usage: ${((msPatternCount / allApis.length) * 100).toFixed(1)}%\n`;
        }
        summary += `\`\`\`\n\n`;
        
        // Save summary
        const summaryPath = path.join(__dirname, 'temp_updates', `${componentName.replace(/[^a-zA-Z0-9]/g, '_')}_comprehensive_trace_summary.md`);
        try {
            fs.writeFileSync(summaryPath, summary);
        } catch (error) {
            console.warn(`Could not write trace summary: ${error.message}`);
        }
        
        return summary;
    }

    /**
     * Generate component trace summary (legacy method for backwards compatibility)
     */
    generateTraceSummary(componentName, apiResults) {
        return this.generateComprehensiveTraceSummary(componentName, apiResults, [], []);
    }

    /**
     * Create development session report
     */
    generateSessionReport() {
        const report = {
            sessionStart: this.getSessionStart(),
            duration: this.getSessionDuration(),
            activitiesCount: this.getActivitiesCount(),
            filesModified: this.getFilesModified(),
            errors: this.getErrorCount(),
            successRate: this.getSuccessRate()
        };

        const reportPath = path.join(__dirname, 'session-report.json');
        try {
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        } catch (error) {
            console.warn(`Could not write session report: ${error.message}`);
        }
        
        console.log('📊 Session report generated');
        return report;
    }

    /**
     * Helper methods for session reporting
     */
    getSessionStart() {
        if (!fs.existsSync(this.contextFile)) return null;
        
        try {
            const context = JSON.parse(fs.readFileSync(this.contextFile, 'utf8'));
            if (context.recentActions.length > 0) {
                return context.recentActions[context.recentActions.length - 1].timestamp;
            }
        } catch (e) {
            // Ignore
        }
        
        return null;
    }

    getSessionDuration() {
        const start = this.getSessionStart();
        if (!start) return 0;
        
        return Date.now() - new Date(start).getTime();
    }

    getActivitiesCount() {
        if (!fs.existsSync(this.contextFile)) return 0;
        
        try {
            const context = JSON.parse(fs.readFileSync(this.contextFile, 'utf8'));
            return context.recentActions.length;
        } catch (e) {
            return 0;
        }
    }

    getFilesModified() {
        const tempDir = path.join(__dirname, 'temp_updates', 'processed');
        if (!fs.existsSync(tempDir)) return 0;

        try {
            return fs.readdirSync(tempDir).filter(f => f.endsWith('.js')).length;
        } catch (error) {
            return 0;
        }
    }

    getErrorCount() {
        if (!fs.existsSync(this.errorFile)) return 0;

        try {
            const content = fs.readFileSync(this.errorFile, 'utf8');
            return content.split('\n').filter(line => line.trim()).length;
        } catch (error) {
            return 0;
        }
    }

    getSuccessRate() {
        if (!fs.existsSync(this.contextFile)) return 0;
        
        try {
            const context = JSON.parse(fs.readFileSync(this.contextFile, 'utf8'));
            const total = Object.values(context.statistics).reduce((sum, stat) => sum + stat.total, 0);
            const success = Object.values(context.statistics).reduce((sum, stat) => sum + stat.success, 0);
            
            return total > 0 ? (success / total * 100) : 0;
        } catch (e) {
            return 0;
        }
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    const helper = new ServiceNowClaudeHelper();

    switch (command) {
        case 'log':
            if (args.length < 3) {
                console.log('Usage: node sn-claude-helper.js log [action] [details] [success]');
                process.exit(1);
            }
            helper.logActivity(args[1], { message: args[2] }, args[3] !== 'false');
            break;

        case 'error':
            if (args.length < 2) {
                console.log('Usage: node sn-claude-helper.js error [error-message] [context]');
                process.exit(1);
            }
            helper.logError(args[1], { context: args[2] || '' });
            helper.generateFixScript(args[1]);
            break;

        case 'summary':
            helper.generateContextSummary();
            break;

        case 'report':
            helper.generateSessionReport();
            break;

        case 'document':
            if (args.length < 4) {
                console.log('Usage: node sn-claude-helper.js document [file] [changeType] [description] [sysId]');
                process.exit(1);
            }
            helper.documentCodeChange(args[1], args[2], args[3], args[4]);
            break;

        case 'trace':
            if (args.length < 2) {
                console.log('Usage: node sn-claude-helper.js trace [componentName]');
                process.exit(1);
            }
            helper.autoTraceComponent(args[1]).then(summary => {
                console.log('🔍 Auto-trace completed');
                console.log(summary);
            }).catch(error => {
                console.error('❌ Auto-trace failed:', error.message);
                process.exit(1);
            });
            break;

        default:
            console.log('ServiceNow Claude Helper');
            console.log('');
            console.log('Commands:');
            console.log('  log [action] [details] [success]  - Log activity');
            console.log('  error [message] [context]         - Log error and generate fix script');
            console.log('  summary                           - Generate context summary');
            console.log('  report                            - Generate session report');
            console.log('  document [file] [type] [desc]     - Document code change');
            console.log('  trace [componentName]             - Auto-trace component data flow');
            console.log('');
            console.log('Examples:');
            console.log('  node sn-claude-helper.js log "update_record" "Updated UserUtils" true');
            console.log('  node sn-claude-helper.js error "HTTP 401" "Failed authentication"');
            console.log('  node sn-claude-helper.js summary');
            console.log('  node sn-claude-helper.js trace "Audience Builder"');
    }
}

module.exports = ServiceNowClaudeHelper;