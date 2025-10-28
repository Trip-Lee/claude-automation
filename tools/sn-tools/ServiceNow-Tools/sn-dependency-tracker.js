/**
 * ServiceNow Dependency Tracker
 * Maps relationships between components, APIs, and Script Includes
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

class ServiceNowDependencyTracker {
    constructor() {
        this.dependencies = {
            components: new Map(),    // component -> APIs used
            apis: new Map(),          // API -> Script Includes called
            scriptIncludes: new Map(), // Script Include -> other dependencies
            reverseMap: new Map()     // dependency -> what uses it
        };
        
        // Load configuration for dynamic paths
        this.config = this.loadConfig();
        this.componentRepoPath = path.join(__dirname, '..', this.config.paths?.componentRepoName || 'Component Repo');
        this.serviceNowDataPath = path.join(__dirname, '..', 'ServiceNow-Data', this.config.paths?.dataSubdir || 'Data');
        
        this.loadCache();
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
                dataSubdir: 'Data',
                componentDirectories: ['Sashimono', 'component-library']
            }
        };
    }

    /**
     * Scan entire codebase for dependencies
     */
    async scanAll() {
        console.log('╔═══════════════════════════════════════╗');
        console.log('║    ServiceNow Dependency Scanner      ║');
        console.log('╚═══════════════════════════════════════╝');
        console.log('');

        // Clear existing dependencies
        this.dependencies.components.clear();
        this.dependencies.apis.clear();
        this.dependencies.scriptIncludes.clear();
        this.dependencies.reverseMap.clear();

        // Scan components
        await this.scanComponents();
        
        // Scan REST APIs
        await this.scanRestApis();
        
        // Scan Script Includes
        await this.scanScriptIncludes();
        
        // Build reverse mapping
        this.buildReverseMap();
        
        // Save cache
        this.saveCache();
        
        console.log('');
        console.log('Dependency scan complete!');
        console.log(`Found ${this.dependencies.components.size} components`);
        console.log(`Found ${this.dependencies.apis.size} REST APIs`);
        console.log(`Found ${this.dependencies.scriptIncludes.size} Script Includes`);
    }

    /**
     * Scan UI components for API usage
     */
    async scanComponents() {
        console.log('Scanning UI components...');

        const componentDirectories = this.config.paths?.componentDirectories || ['Sashimono', 'component-library'];
        const componentDirs = componentDirectories.map(dir =>
            path.join(this.componentRepoPath, dir)
        );

        for (const baseDir of componentDirs) {
            if (!fs.existsSync(baseDir)) continue;

            // Find all component directories
            const components = fs.readdirSync(baseDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            for (const componentName of components) {
                const componentPath = path.join(baseDir, componentName);
                await this.scanComponent(componentName, componentPath);
            }
        }
    }

    /**
     * Scan individual component for dependencies
     */
    async scanComponent(componentName, componentPath) {
        try {
            // Look for JavaScript files
            const jsFiles = glob.sync('**/*.js', { cwd: componentPath });
            
            const componentDeps = {
                name: componentName,
                path: componentPath,
                apis: new Set(),
                actions: new Set(),
                imports: new Set(),
                type: this.getComponentType(componentPath)
            };

            for (const jsFile of jsFiles) {
                const filePath = path.join(componentPath, jsFile);
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Find API calls
                this.findApiCalls(content, componentDeps);
                
                // Find action dispatches
                this.findActionDispatches(content, componentDeps);
                
                // Find imports
                this.findImports(content, componentDeps);
            }

            if (componentDeps.apis.size > 0 || componentDeps.actions.size > 0) {
                this.dependencies.components.set(componentName, componentDeps);
                process.stdout.write(`  ${componentName} (${componentDeps.apis.size} APIs) `);
            }

        } catch (error) {
            console.error(`Error scanning component ${componentName}:`, error.message);
        }
    }

    /**
     * Find API calls in component code
     */
    findApiCalls(content, componentDeps) {
        // Pattern: createHttpEffect
        const httpEffectRegex = /createHttpEffect\s*\(\s*['"](.*?)['"]|createHttpEffect\s*\(\s*`([^`]*)`/g;
        let match;
        while ((match = httpEffectRegex.exec(content)) !== null) {
            const apiPath = match[1] || match[2];
            if (apiPath) {
                componentDeps.apis.add(apiPath);
            }
        }

        // Pattern: api.now.table or direct API paths
        const apiPathRegex = /(['"`])\/api\/now\/.*?\1|(['"`])\w+\/\w+\/\w+\2/g;
        while ((match = apiPathRegex.exec(content)) !== null) {
            const apiPath = match[0].replace(/['"`]/g, '');
            if (apiPath.includes('/api/now/') || this.isProjectApiPath(apiPath)) {
                componentDeps.apis.add(apiPath);
            }
        }
    }

    /**
     * Find action dispatches
     */
    findActionDispatches(content, componentDeps) {
        const actionRegex = /dispatch\s*\(\s*['"`]([^'"`]+)['"`]|\.dispatch\s*\(\s*['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = actionRegex.exec(content)) !== null) {
            const action = match[1] || match[2];
            if (action) {
                componentDeps.actions.add(action);
            }
        }
    }

    /**
     * Find imports
     */
    findImports(content, componentDeps) {
        const importRegex = /import.*?from\s+['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1];
            if (!importPath.startsWith('.') && !importPath.startsWith('@servicenow')) {
                componentDeps.imports.add(importPath);
            }
        }
    }

    /**
     * Scan REST APIs
     */
    async scanRestApis() {
        console.log('\nScanning REST APIs...');
        
        const apiDir = path.join(this.serviceNowDataPath, 'Rest_APIs');
        if (!fs.existsSync(apiDir)) return;

        const apiFiles = fs.readdirSync(apiDir).filter(f => f.endsWith('.json'));
        
        for (const apiFile of apiFiles) {
            const filePath = path.join(apiDir, apiFile);
            await this.scanRestApi(apiFile, filePath);
        }
    }

    /**
     * Scan individual REST API
     */
    async scanRestApi(filename, filePath) {
        try {
            const apiData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (apiData.records) {
                apiData.records.forEach(record => {
                    const apiDeps = {
                        name: record.name,
                        resource: record.resource_name,
                        method: record.http_method,
                        scriptIncludes: new Set(),
                        tables: new Set(),
                        path: record.relative_path,
                        sysId: record.sys_id
                    };

                    // Parse operation script
                    if (record.operation_script) {
                        this.findScriptIncludeCalls(record.operation_script, apiDeps);
                        this.findTableReferences(record.operation_script, apiDeps);
                    }

                    const apiKey = `${record.resource_name}/${record.http_method}/${record.relative_path}`;
                    this.dependencies.apis.set(apiKey, apiDeps);
                });
            }

        } catch (error) {
            console.error(`Error scanning API ${filename}:`, error.message);
        }
    }

    /**
     * Find Script Include calls in API code
     */
    findScriptIncludeCalls(script, apiDeps) {
        // Common patterns for Script Include calls
        const patterns = [
            /new\s+(\w+)\s*\(/g,                    // new ClassName()
            /(\w+)\.(\w+)\s*\(/g,                   // ClassName.methodName()
            /gs\.include\s*\(\s*['"`]([^'"`]+)['"`]/g, // gs.include('ClassName')
            /sn_ws\.ServiceNowUtil\.getScriptInclude\s*\(\s*['"`]([^'"`]+)['"`]/g
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(script)) !== null) {
                let className = match[1];
                
                // Skip common ServiceNow classes that aren't Script Includes
                const skipClasses = ['GlideRecord', 'GlideDateTime', 'GlideUser', 'GlideSession', 'Array', 'Object', 'String'];
                if (skipClasses.includes(className)) continue;
                
                // Skip lowercase (likely variables)
                if (className && className[0] === className[0].toUpperCase()) {
                    apiDeps.scriptIncludes.add(className);
                }
            }
        });
    }

    /**
     * Find table references
     */
    findTableReferences(script, apiDeps) {
        // GlideRecord table references
        const glideRecordRegex = /new\s+GlideRecord\s*\(\s*['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = glideRecordRegex.exec(script)) !== null) {
            apiDeps.tables.add(match[1]);
        }
    }

    /**
     * Scan Script Includes
     */
    async scanScriptIncludes() {
        console.log('\nScanning Script Includes...');
        
        const scriptDir = path.join(this.serviceNowDataPath, 'Script_Includes');
        if (!fs.existsSync(scriptDir)) return;

        const scriptFiles = fs.readdirSync(scriptDir).filter(f => f.endsWith('.json'));
        
        for (const scriptFile of scriptFiles) {
            const filePath = path.join(scriptDir, scriptFile);
            await this.scanScriptInclude(scriptFile, filePath);
        }
    }

    /**
     * Scan individual Script Include
     */
    async scanScriptInclude(filename, filePath) {
        try {
            const scriptData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (scriptData.records) {
                scriptData.records.forEach(record => {
                    const scriptDeps = {
                        name: record.name,
                        scriptIncludes: new Set(),
                        tables: new Set(),
                        apis: new Set(),
                        sysId: record.sys_id
                    };

                    if (record.script) {
                        // Parse the escaped script content
                        let script;
                        try {
                            script = JSON.parse(`"${record.script}"`);
                        } catch (e) {
                            script = record.script;
                        }

                        this.findScriptIncludeCalls(script, scriptDeps);
                        this.findTableReferences(script, scriptDeps);
                        this.findApiCalls(script, scriptDeps);
                    }

                    this.dependencies.scriptIncludes.set(record.name, scriptDeps);
                });
            }

        } catch (error) {
            console.error(`Error scanning Script Include ${filename}:`, error.message);
        }
    }

    /**
     * Build reverse dependency map
     */
    buildReverseMap() {
        // Clear existing
        this.dependencies.reverseMap.clear();

        // Components -> APIs
        this.dependencies.components.forEach((comp, compName) => {
            comp.apis.forEach(api => {
                if (!this.dependencies.reverseMap.has(api)) {
                    this.dependencies.reverseMap.set(api, { components: [], apis: [], scriptIncludes: [] });
                }
                this.dependencies.reverseMap.get(api).components.push(compName);
            });
        });

        // APIs -> Script Includes
        this.dependencies.apis.forEach((api, apiName) => {
            api.scriptIncludes.forEach(script => {
                if (!this.dependencies.reverseMap.has(script)) {
                    this.dependencies.reverseMap.set(script, { components: [], apis: [], scriptIncludes: [] });
                }
                this.dependencies.reverseMap.get(script).apis.push(apiName);
            });
        });

        // Script Includes -> Other Script Includes
        this.dependencies.scriptIncludes.forEach((script, scriptName) => {
            script.scriptIncludes.forEach(depScript => {
                if (!this.dependencies.reverseMap.has(depScript)) {
                    this.dependencies.reverseMap.set(depScript, { components: [], apis: [], scriptIncludes: [] });
                }
                this.dependencies.reverseMap.get(depScript).scriptIncludes.push(scriptName);
            });
        });
    }

    /**
     * Get what depends on a given item
     */
    getWhatDependsOn(item) {
        return this.dependencies.reverseMap.get(item) || { components: [], apis: [], scriptIncludes: [] };
    }

    /**
     * Generate impact analysis report
     */
    generateImpactAnalysis(scriptIncludeName) {
        const impacts = this.getWhatDependsOn(scriptIncludeName);
        
        console.log(`\n╔═══════════════════════════════════════╗`);
        console.log(`║     Impact Analysis: ${scriptIncludeName.padEnd(18, ' ')} ║`);
        console.log(`╚═══════════════════════════════════════╝`);
        
        if (impacts.components.length > 0) {
            console.log('\n🎨 Components affected:');
            impacts.components.forEach(comp => console.log(`  - ${comp}`));
        }
        
        if (impacts.apis.length > 0) {
            console.log('\n🔌 REST APIs affected:');
            impacts.apis.forEach(api => console.log(`  - ${api}`));
        }
        
        if (impacts.scriptIncludes.length > 0) {
            console.log('\n📜 Script Includes affected:');
            impacts.scriptIncludes.forEach(script => console.log(`  - ${script}`));
        }
        
        const totalImpact = impacts.components.length + impacts.apis.length + impacts.scriptIncludes.length;
        
        if (totalImpact === 0) {
            console.log('\n✅ No dependencies found - safe to modify');
        } else {
            console.log(`\n⚠️  Total items potentially affected: ${totalImpact}`);
        }

        return impacts;
    }

    /**
     * Generate dependency graph
     */
    generateGraph(format = 'text') {
        if (format === 'dot') {
            return this.generateDotGraph();
        }
        
        console.log('\n╔═══════════════════════════════════════╗');
        console.log('║        Dependency Graph               ║');
        console.log('╚═══════════════════════════════════════╝');
        
        // Components
        console.log('\n🎨 Components:');
        this.dependencies.components.forEach((comp, name) => {
            console.log(`\n  ${name} (${comp.type})`);
            if (comp.apis.size > 0) {
                console.log('    APIs:');
                comp.apis.forEach(api => console.log(`      → ${api}`));
            }
        });
        
        // APIs
        console.log('\n🔌 REST APIs:');
        this.dependencies.apis.forEach((api, name) => {
            console.log(`\n  ${name}`);
            if (api.scriptIncludes.size > 0) {
                console.log('    Script Includes:');
                api.scriptIncludes.forEach(script => console.log(`      → ${script}`));
            }
        });
    }

    /**
     * Generate DOT format graph for GraphViz
     */
    generateDotGraph() {
        let dot = 'digraph ServiceNowDependencies {\n';
        dot += '  rankdir=LR;\n';
        dot += '  node [shape=box, style=filled];\n\n';
        
        const nodeIds = new Map();
        let nodeCounter = 0;
        
        // Helper to get safe node ID
        const getNodeId = (id) => {
            if (!nodeIds.has(id)) {
                nodeIds.set(id, `node${nodeCounter++}`);
            }
            return nodeIds.get(id);
        };
        
        // Add component nodes
        this.dependencies.components.forEach((comp, name) => {
            const nodeId = getNodeId(`comp:${name}`);
            dot += `  ${nodeId} [label="${name}", fillcolor="#4CAF50", shape=ellipse];\n`;
        });
        
        // Add API nodes
        this.dependencies.apis.forEach((api, name) => {
            const nodeId = getNodeId(`api:${name}`);
            dot += `  ${nodeId} [label="${api.name || name}", fillcolor="#2196F3"];\n`;
        });
        
        // Add Script Include nodes
        this.dependencies.scriptIncludes.forEach((script, name) => {
            const nodeId = getNodeId(`script:${name}`);
            dot += `  ${nodeId} [label="${name}", fillcolor="#FF9800", shape=diamond];\n`;
        });
        
        dot += '\n  // Edges\n';
        
        // Component -> API edges
        this.dependencies.components.forEach((comp, compName) => {
            const compId = getNodeId(`comp:${compName}`);
            comp.apis.forEach(api => {
                // Find matching API
                let apiKey = null;
                this.dependencies.apis.forEach((apiData, key) => {
                    if (key.includes(api) || apiData.path === api) {
                        apiKey = key;
                    }
                });
                if (apiKey) {
                    const apiId = getNodeId(`api:${apiKey}`);
                    dot += `  ${compId} -> ${apiId} [label="calls"];\n`;
                }
            });
        });
        
        // API -> Script Include edges
        this.dependencies.apis.forEach((api, apiName) => {
            const apiId = getNodeId(`api:${apiName}`);
            api.scriptIncludes.forEach(script => {
                const scriptId = getNodeId(`script:${script}`);
                dot += `  ${apiId} -> ${scriptId} [label="invokes"];\n`;
            });
        });
        
        // Script Include -> Script Include edges
        this.dependencies.scriptIncludes.forEach((script, scriptName) => {
            const scriptId = getNodeId(`script:${scriptName}`);
            script.scriptIncludes.forEach(depScript => {
                const depScriptId = getNodeId(`script:${depScript}`);
                dot += `  ${scriptId} -> ${depScriptId} [label="depends"];\n`;
            });
        });
        
        dot += '}\n';
        
        const filename = `dependency-graph-${Date.now()}.dot`;
        const outputPath = path.join(__dirname, 'dependency-graphs', filename);
        
        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, dot);
        console.log(`\n✅ DOT graph saved to: ${outputPath}`);
        console.log('💡 To convert to image, run:');
        console.log(`   dot -Tpng "${outputPath}" -o graph.png`);
        
        return outputPath;
    }

    /**
     * Helper methods
     */
    getComponentType(componentPath) {
        const componentDirectories = this.config.paths?.componentDirectories || ['Sashimono', 'component-library'];

        for (const dir of componentDirectories) {
            if (componentPath.includes(dir)) {
                // Convert directory name to display name (e.g., 'component-library' -> 'Component Library')
                return dir.split('-').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ');
            }
        }

        return 'Unknown';
    }

    isProjectApiPath(path) {
        const projectName = this.config.project?.name?.toLowerCase() || 'myproject';
        const scopePrefix = this.config.project?.scopePrefix || 'x_custom';

        return path.includes(projectName) ||
               path.includes(scopePrefix) ||
               path.includes('marketing') ||
               path.includes('journey') ||
               path.includes('automation');
    }

    /**
     * Cache management
     */
    saveCache() {
        const cacheFile = path.join(__dirname, 'dependency-cache.json');
        const cacheData = {
            lastScan: new Date().toISOString(),
            components: Array.from(this.dependencies.components.entries()).map(([k, v]) => [k, {
                ...v,
                apis: Array.from(v.apis),
                actions: Array.from(v.actions),
                imports: Array.from(v.imports)
            }]),
            apis: Array.from(this.dependencies.apis.entries()).map(([k, v]) => [k, {
                ...v,
                scriptIncludes: Array.from(v.scriptIncludes),
                tables: Array.from(v.tables)
            }]),
            scriptIncludes: Array.from(this.dependencies.scriptIncludes.entries()).map(([k, v]) => [k, {
                ...v,
                scriptIncludes: Array.from(v.scriptIncludes),
                tables: Array.from(v.tables),
                apis: Array.from(v.apis)
            }]),
            reverseMap: Array.from(this.dependencies.reverseMap.entries())
        };
        
        fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
    }

    loadCache() {
        const cacheFile = path.join(__dirname, 'dependency-cache.json');
        if (!fs.existsSync(cacheFile)) return;

        try {
            const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            
            // Restore Maps with Sets
            if (cacheData.components) {
                cacheData.components.forEach(([k, v]) => {
                    this.dependencies.components.set(k, {
                        ...v,
                        apis: new Set(v.apis),
                        actions: new Set(v.actions),
                        imports: new Set(v.imports)
                    });
                });
            }
            
            if (cacheData.apis) {
                cacheData.apis.forEach(([k, v]) => {
                    this.dependencies.apis.set(k, {
                        ...v,
                        scriptIncludes: new Set(v.scriptIncludes),
                        tables: new Set(v.tables)
                    });
                });
            }
            
            if (cacheData.scriptIncludes) {
                cacheData.scriptIncludes.forEach(([k, v]) => {
                    this.dependencies.scriptIncludes.set(k, {
                        ...v,
                        scriptIncludes: new Set(v.scriptIncludes),
                        tables: new Set(v.tables),
                        apis: new Set(v.apis)
                    });
                });
            }
            
            if (cacheData.reverseMap) {
                cacheData.reverseMap.forEach(([k, v]) => {
                    this.dependencies.reverseMap.set(k, v);
                });
            }
            
        } catch (error) {
            console.error('Error loading dependency cache:', error.message);
        }
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    const tracker = new ServiceNowDependencyTracker();

    async function main() {
        switch (command) {
            case 'scan':
                await tracker.scanAll();
                break;

            case 'impact':
                if (!args[1]) {
                    console.error('Usage: node sn-dependency-tracker.js impact [ScriptIncludeName]');
                    process.exit(1);
                }
                tracker.generateImpactAnalysis(args[1]);
                break;

            case 'graph':
                tracker.generateGraph();
                break;

            case 'depends-on':
                if (!args[1]) {
                    console.error('Usage: node sn-dependency-tracker.js depends-on [item]');
                    process.exit(1);
                }
                const deps = tracker.getWhatDependsOn(args[1]);
                console.log('\nWhat depends on', args[1] + ':');
                console.log(JSON.stringify(deps, null, 2));
                break;

            default:
                console.log('ServiceNow Dependency Tracker');
                console.log('');
                console.log('Commands:');
                console.log('  scan                    - Scan entire codebase for dependencies');
                console.log('  impact [ScriptInclude]  - Show impact analysis for changes');
                console.log('  graph                   - Show dependency graph');
                console.log('  depends-on [item]       - Show what depends on an item');
                console.log('');
                console.log('Examples:');
                console.log('  node sn-dependency-tracker.js scan');
                console.log('  node sn-dependency-tracker.js impact UserUtils');
                console.log('  node sn-dependency-tracker.js graph');
        }
    }

    main().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}

module.exports = ServiceNowDependencyTracker;