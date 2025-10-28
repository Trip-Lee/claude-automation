#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class ServiceNowFlowTracer {
    constructor() {
        this.rootPath = path.join(__dirname, '..');
        this.componentsPath = path.join(this.rootPath, 'Tenon Repo');
        this.apiPath = path.join(this.rootPath, 'ServiceNow-Data', 'Tenon', 'Rest_API\'s');
        this.scriptIncludePath = path.join(this.rootPath, 'ServiceNow-Data', 'Tenon', 'Script_Include');
        
        this.flowCache = new Map();
        this.apiCache = new Map();
        this.scriptIncludeCache = new Map();
        this.componentCache = new Map();
        
        this.colors = {
            reset: '\x1b[0m',
            bright: '\x1b[1m',
            dim: '\x1b[2m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            white: '\x1b[37m'
        };
    }

    log(message, color = 'white') {
        console.log(`${this.colors[color]}${message}${this.colors.reset}`);
    }

    logHeader(message) {
        console.log('\n' + '='.repeat(80));
        this.log(message, 'bright');
        console.log('='.repeat(80));
    }

    logSection(message) {
        console.log('\n' + '-'.repeat(60));
        this.log(message, 'cyan');
        console.log('-'.repeat(60));
    }

    async initialize() {
        this.log('Initializing ServiceNow Flow Tracer...', 'yellow');
        await this.loadAPIs();
        await this.loadScriptIncludes();
        await this.loadComponents();
        this.log(`Loaded: ${this.apiCache.size} APIs, ${this.scriptIncludeCache.size} Script Includes, ${this.componentCache.size} Components`, 'green');
    }

    async loadAPIs() {
        if (!fs.existsSync(this.apiPath)) return;
        
        const files = this.getAllFiles(this.apiPath, '.json');
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf8');
                const data = JSON.parse(content);
                
                if (data.result && Array.isArray(data.result)) {
                    data.result.forEach(api => {
                        const apiInfo = {
                            name: api.name,
                            path: api.relative_path,
                            method: api.http_method,
                            script: api.operation_script,
                            file: file,
                            sys_id: api.sys_id,
                            produces: api.produces,
                            consumes: api.consumes
                        };
                        
                        // Store by both name and path for easy lookup
                        this.apiCache.set(api.name, apiInfo);
                        if (api.relative_path) {
                            const fullPath = `${api.relative_path}`;
                            this.apiCache.set(fullPath, apiInfo);
                        }
                    });
                }
            } catch (e) {
                // Skip invalid JSON files
            }
        }
    }

    async loadScriptIncludes() {
        if (!fs.existsSync(this.scriptIncludePath)) return;
        
        const files = this.getAllFiles(this.scriptIncludePath, '.json');
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf8');
                const data = JSON.parse(content);
                
                if (data.result && Array.isArray(data.result)) {
                    data.result.forEach(si => {
                        const scriptInfo = {
                            name: si.name,
                            api_name: si.api_name,
                            description: si.description,
                            script: si.script,
                            file: file,
                            sys_id: si.sys_id,
                            active: si.active
                        };
                        
                        this.scriptIncludeCache.set(si.name, scriptInfo);
                        if (si.api_name && si.api_name !== si.name) {
                            this.scriptIncludeCache.set(si.api_name, scriptInfo);
                        }
                    });
                }
            } catch (e) {
                // Skip invalid JSON files
            }
        }
    }

    async loadComponents() {
        if (!fs.existsSync(this.componentsPath)) return;
        
        // Load from both Sashimono and component-library
        const sashimonoPath = path.join(this.componentsPath, 'Sashimono');
        const componentLibPath = path.join(this.componentsPath, 'component-library');
        
        for (const basePath of [sashimonoPath, componentLibPath]) {
            if (!fs.existsSync(basePath)) continue;
            
            const dirs = fs.readdirSync(basePath).filter(d => 
                fs.statSync(path.join(basePath, d)).isDirectory()
            );
            
            for (const dir of dirs) {
                const componentPath = path.join(basePath, dir);
                const indexPath = path.join(componentPath, 'index.js');
                const srcIndexPath = path.join(componentPath, 'src', 'index.js');
                
                const mainFile = fs.existsSync(indexPath) ? indexPath : 
                                fs.existsSync(srcIndexPath) ? srcIndexPath : null;
                
                if (mainFile) {
                    const componentInfo = {
                        name: dir,
                        path: componentPath,
                        mainFile: mainFile,
                        repo: basePath.includes('Sashimono') ? 'Sashimono' : 'component-library',
                        apiCalls: []
                    };
                    
                    // Extract API calls
                    const content = fs.readFileSync(mainFile, 'utf8');
                    componentInfo.apiCalls = this.extractAPICalls(content);
                    
                    this.componentCache.set(dir, componentInfo);
                }
            }
        }
    }

    extractAPICalls(content) {
        const apiCalls = [];
        const patterns = [
            // createHttpEffect patterns
            /createHttpEffect\([^,]*,\s*{[^}]*url:\s*['"`]([^'"`]+)['"`]/gm,
            /createHttpEffect\([^,]*,\s*{[^}]*path:\s*['"`]([^'"`]+)['"`]/gm,
            
            // dispatch action patterns
            /dispatch\(['"`]([A-Z_]+)['"`]/gm,
            /actionTypes\.([A-Z_]+)/gm,
            
            // Direct API path references
            /['"`](\/api\/[^'"`]+)['"`]/gm,
            /['"`](\/api\/now\/[^'"`]+)['"`]/gm
        ];
        
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                if (!apiCalls.includes(match[1])) {
                    apiCalls.push(match[1]);
                }
            }
        });
        
        return apiCalls;
    }

    extractScriptIncludeCalls(script) {
        const calls = [];
        const patterns = [
            // new ClassName() patterns
            /new\s+([A-Z][a-zA-Z0-9_]+)\s*\(/gm,
            
            // ClassName.method() patterns
            /([A-Z][a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*\(/gm,
            
            // gs.include patterns
            /gs\.include\(['"`]([^'"`]+)['"`]\)/gm,
            
            // MS (Master Script) pattern
            /var\s+ms\s*=\s*new\s+([A-Z][a-zA-Z0-9_]+MS)\s*\(/gm,
            /([A-Z][a-zA-Z0-9_]+MS)\.([a-zA-Z0-9_]+)\s*\(/gm
        ];
        
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(script)) !== null) {
                if (!calls.includes(match[1])) {
                    calls.push(match[1]);
                }
            }
        });
        
        return calls;
    }

    async traceComponentFlow(componentName) {
        this.logHeader(`Tracing Flow for Component: ${componentName}`);
        
        const component = this.componentCache.get(componentName);
        if (!component) {
            this.log(`Component '${componentName}' not found!`, 'red');
            this.listSimilarComponents(componentName);
            return;
        }
        
        this.logSection('Component Details');
        this.log(`Name: ${component.name}`, 'green');
        this.log(`Repository: ${component.repo}`, 'green');
        this.log(`Path: ${component.path}`, 'dim');
        this.log(`Main File: ${component.mainFile}`, 'dim');
        
        if (component.apiCalls.length === 0) {
            this.log('\nNo API calls detected in this component', 'yellow');
            return;
        }
        
        this.logSection('API Calls Detected');
        component.apiCalls.forEach((api, index) => {
            this.log(`${index + 1}. ${api}`, 'blue');
        });
        
        // Trace each API call
        for (const apiCall of component.apiCalls) {
            await this.traceAPIToScriptInclude(apiCall, true);
        }
        
        this.generateFlowDiagram(componentName, component.apiCalls);
    }

    async traceAPIToScriptInclude(apiName, isNested = false) {
        if (!isNested) {
            this.logHeader(`Tracing API: ${apiName}`);
        } else {
            this.logSection(`API Endpoint: ${apiName}`);
        }
        
        // Try to find the API
        const api = this.findAPI(apiName);
        if (!api) {
            this.log(`API '${apiName}' not found in cache`, 'yellow');
            return;
        }
        
        this.log(`Name: ${api.name}`, 'green');
        this.log(`Path: ${api.path}`, 'green');
        this.log(`Method: ${api.method}`, 'green');
        this.log(`Sys ID: ${api.sys_id}`, 'dim');
        
        if (api.script) {
            this.log('\nOperation Script:', 'cyan');
            const scriptPreview = api.script.substring(0, 500);
            console.log(scriptPreview + (api.script.length > 500 ? '...' : ''));
            
            // Extract Script Include references
            const scriptIncludes = this.extractScriptIncludeCalls(api.script);
            if (scriptIncludes.length > 0) {
                this.log('\nReferenced Script Includes:', 'cyan');
                scriptIncludes.forEach((si, index) => {
                    this.log(`${index + 1}. ${si}`, 'magenta');
                    
                    const scriptInclude = this.scriptIncludeCache.get(si);
                    if (scriptInclude) {
                        this.log(`   - Description: ${scriptInclude.description || 'N/A'}`, 'dim');
                        this.log(`   - Active: ${scriptInclude.active}`, 'dim');
                        this.log(`   - Sys ID: ${scriptInclude.sys_id}`, 'dim');
                    }
                });
            }
        }
    }

    async traceScriptIncludeUsage(scriptIncludeName) {
        this.logHeader(`Tracing Script Include Usage: ${scriptIncludeName}`);
        
        const scriptInclude = this.scriptIncludeCache.get(scriptIncludeName);
        if (!scriptInclude) {
            this.log(`Script Include '${scriptIncludeName}' not found!`, 'red');
            this.listSimilarScriptIncludes(scriptIncludeName);
            return;
        }
        
        this.logSection('Script Include Details');
        this.log(`Name: ${scriptInclude.name}`, 'green');
        this.log(`API Name: ${scriptInclude.api_name || 'N/A'}`, 'green');
        this.log(`Description: ${scriptInclude.description || 'N/A'}`, 'green');
        this.log(`Active: ${scriptInclude.active}`, 'green');
        this.log(`Sys ID: ${scriptInclude.sys_id}`, 'dim');
        
        // Find APIs that use this Script Include
        this.logSection('Used by APIs');
        let foundUsage = false;
        for (const [apiName, api] of this.apiCache) {
            if (api.script && api.script.includes(scriptIncludeName)) {
                foundUsage = true;
                this.log(`- ${api.name} (${api.method} ${api.path})`, 'blue');
            }
        }
        
        if (!foundUsage) {
            this.log('No direct API usage found', 'yellow');
        }
        
        // Find components that might use these APIs
        this.logSection('Potentially Used by Components');
        const relatedComponents = new Set();
        
        for (const [apiName, api] of this.apiCache) {
            if (api.script && api.script.includes(scriptIncludeName)) {
                // Find components using this API
                for (const [compName, comp] of this.componentCache) {
                    if (comp.apiCalls.some(call => 
                        call.includes(api.name) || 
                        call.includes(api.path) ||
                        call === api.name
                    )) {
                        relatedComponents.add(compName);
                    }
                }
            }
        }
        
        if (relatedComponents.size > 0) {
            Array.from(relatedComponents).forEach(comp => {
                this.log(`- ${comp}`, 'magenta');
            });
        } else {
            this.log('No component usage detected', 'yellow');
        }
    }

    findAPI(searchTerm) {
        // Direct lookup
        if (this.apiCache.has(searchTerm)) {
            return this.apiCache.get(searchTerm);
        }
        
        // Try to find by partial match
        for (const [key, api] of this.apiCache) {
            if (key.includes(searchTerm) || 
                api.name.includes(searchTerm) || 
                (api.path && api.path.includes(searchTerm))) {
                return api;
            }
        }
        
        return null;
    }

    generateFlowDiagram(componentName, apiCalls) {
        this.logSection('Flow Diagram');
        
        console.log('\n┌─────────────────────┐');
        console.log(`│  ${this.padCenter(componentName, 19)} │`);
        console.log('└─────────────────────┘');
        console.log('           │');
        console.log('           ▼');
        
        apiCalls.forEach((apiCall, index) => {
            const api = this.findAPI(apiCall);
            const apiDisplay = api ? api.name : apiCall;
            
            console.log('┌─────────────────────┐');
            console.log(`│  ${this.padCenter(apiDisplay.substring(0, 19), 19)} │`);
            console.log('└─────────────────────┘');
            
            if (api && api.script) {
                const scriptIncludes = this.extractScriptIncludeCalls(api.script);
                if (scriptIncludes.length > 0) {
                    console.log('           │');
                    console.log('           ▼');
                    
                    scriptIncludes.forEach(si => {
                        console.log('┌─────────────────────┐');
                        console.log(`│  ${this.padCenter(si.substring(0, 19), 19)} │`);
                        console.log('└─────────────────────┘');
                    });
                }
            }
            
            if (index < apiCalls.length - 1) {
                console.log('\n');
            }
        });
    }

    padCenter(str, width) {
        const len = str.length;
        if (len >= width) return str.substring(0, width);
        
        const leftPad = Math.floor((width - len) / 2);
        const rightPad = width - len - leftPad;
        
        return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
    }

    listSimilarComponents(searchTerm) {
        this.log('\nAvailable components:', 'yellow');
        const searchLower = searchTerm.toLowerCase();
        let found = false;
        
        for (const [name, comp] of this.componentCache) {
            if (name.toLowerCase().includes(searchLower)) {
                this.log(`  - ${name} (${comp.repo})`, 'dim');
                found = true;
            }
        }
        
        if (!found) {
            this.log('  No similar components found', 'dim');
        }
    }

    listSimilarScriptIncludes(searchTerm) {
        this.log('\nAvailable Script Includes:', 'yellow');
        const searchLower = searchTerm.toLowerCase();
        let found = false;
        
        for (const [name, si] of this.scriptIncludeCache) {
            if (name.toLowerCase().includes(searchLower)) {
                this.log(`  - ${name}`, 'dim');
                found = true;
            }
        }
        
        if (!found) {
            this.log('  No similar Script Includes found', 'dim');
        }
    }

    getAllFiles(dir, ext) {
        const files = [];
        
        const walk = (currentDir) => {
            try {
                const entries = fs.readdirSync(currentDir);
                
                entries.forEach(entry => {
                    const fullPath = path.join(currentDir, entry);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory()) {
                        walk(fullPath);
                    } else if (fullPath.endsWith(ext)) {
                        files.push(fullPath);
                    }
                });
            } catch (e) {
                // Skip inaccessible directories
            }
        };
        
        walk(dir);
        return files;
    }

    async interactiveMenu() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (query) => new Promise(resolve => rl.question(query, resolve));

        while (true) {
            this.logHeader('ServiceNow Flow Tracer - Main Menu');
            console.log('\n1. Trace Component Flow (Component → API → Script Include)');
            console.log('2. Trace API to Script Include');
            console.log('3. Find Script Include Usage (Reverse trace)');
            console.log('4. List All Components');
            console.log('5. List All APIs');
            console.log('6. List All Script Includes');
            console.log('7. Search Everything');
            console.log('8. Reload Cache');
            console.log('9. Export Flow Report');
            console.log('0. Exit\n');

            const choice = await question('Enter your choice: ');

            switch (choice.trim()) {
                case '1':
                    const compName = await question('Enter component name: ');
                    await this.traceComponentFlow(compName.trim());
                    break;

                case '2':
                    const apiName = await question('Enter API name or path: ');
                    await this.traceAPIToScriptInclude(apiName.trim());
                    break;

                case '3':
                    const siName = await question('Enter Script Include name: ');
                    await this.traceScriptIncludeUsage(siName.trim());
                    break;

                case '4':
                    this.logHeader('All Components');
                    const byRepo = new Map();
                    for (const [name, comp] of this.componentCache) {
                        if (!byRepo.has(comp.repo)) {
                            byRepo.set(comp.repo, []);
                        }
                        byRepo.get(comp.repo).push(name);
                    }
                    for (const [repo, comps] of byRepo) {
                        this.log(`\n${repo}:`, 'cyan');
                        comps.sort().forEach(c => this.log(`  - ${c}`, 'dim'));
                    }
                    break;

                case '5':
                    this.logHeader('All APIs');
                    const uniqueAPIs = new Map();
                    for (const [key, api] of this.apiCache) {
                        if (!uniqueAPIs.has(api.name)) {
                            uniqueAPIs.set(api.name, api);
                        }
                    }
                    for (const [name, api] of uniqueAPIs) {
                        this.log(`${api.method} ${api.path} - ${name}`, 'blue');
                    }
                    break;

                case '6':
                    this.logHeader('All Script Includes');
                    const uniqueSIs = new Map();
                    for (const [key, si] of this.scriptIncludeCache) {
                        if (!uniqueSIs.has(si.name)) {
                            uniqueSIs.set(si.name, si);
                        }
                    }
                    for (const [name, si] of uniqueSIs) {
                        this.log(`${name} - ${si.description || 'No description'}`, 'magenta');
                    }
                    break;

                case '7':
                    const searchTerm = await question('Enter search term: ');
                    await this.searchEverything(searchTerm.trim());
                    break;

                case '8':
                    await this.initialize();
                    this.log('Cache reloaded!', 'green');
                    break;

                case '9':
                    const reportName = await question('Enter component name for report (or "all"): ');
                    await this.exportFlowReport(reportName.trim());
                    break;

                case '0':
                    rl.close();
                    return;

                default:
                    this.log('Invalid choice!', 'red');
            }

            await question('\nPress Enter to continue...');
        }
    }

    async searchEverything(searchTerm) {
        this.logHeader(`Search Results for: ${searchTerm}`);
        const searchLower = searchTerm.toLowerCase();
        
        this.logSection('Components');
        let found = false;
        for (const [name, comp] of this.componentCache) {
            if (name.toLowerCase().includes(searchLower)) {
                this.log(`- ${name} (${comp.repo})`, 'green');
                found = true;
            }
        }
        if (!found) this.log('No components found', 'dim');
        
        this.logSection('APIs');
        found = false;
        const uniqueAPIs = new Set();
        for (const [key, api] of this.apiCache) {
            if ((api.name.toLowerCase().includes(searchLower) || 
                 api.path.toLowerCase().includes(searchLower)) &&
                !uniqueAPIs.has(api.name)) {
                this.log(`- ${api.name} (${api.method} ${api.path})`, 'blue');
                uniqueAPIs.add(api.name);
                found = true;
            }
        }
        if (!found) this.log('No APIs found', 'dim');
        
        this.logSection('Script Includes');
        found = false;
        const uniqueSIs = new Set();
        for (const [key, si] of this.scriptIncludeCache) {
            if (si.name.toLowerCase().includes(searchLower) &&
                !uniqueSIs.has(si.name)) {
                this.log(`- ${si.name}`, 'magenta');
                uniqueSIs.add(si.name);
                found = true;
            }
        }
        if (!found) this.log('No Script Includes found', 'dim');
    }

    async exportFlowReport(componentName) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(this.rootPath, 'ServiceNow-Tools', 'flow-reports');
        
        if (!fs.existsSync(reportPath)) {
            fs.mkdirSync(reportPath, { recursive: true });
        }
        
        const fileName = `flow-report-${componentName}-${timestamp}.md`;
        const filePath = path.join(reportPath, fileName);
        
        let report = `# ServiceNow Flow Report\n\n`;
        report += `Generated: ${new Date().toISOString()}\n\n`;
        
        if (componentName === 'all') {
            report += `## All Component Flows\n\n`;
            
            for (const [name, comp] of this.componentCache) {
                report += await this.generateComponentReport(name, comp);
            }
        } else {
            const comp = this.componentCache.get(componentName);
            if (!comp) {
                this.log(`Component '${componentName}' not found!`, 'red');
                return;
            }
            report += await this.generateComponentReport(componentName, comp);
        }
        
        fs.writeFileSync(filePath, report);
        this.log(`Report exported to: ${filePath}`, 'green');
    }

    async generateComponentReport(name, comp) {
        let report = `### Component: ${name}\n\n`;
        report += `- **Repository:** ${comp.repo}\n`;
        report += `- **Path:** ${comp.path}\n`;
        report += `- **Main File:** ${comp.mainFile}\n\n`;
        
        if (comp.apiCalls.length > 0) {
            report += `#### API Calls\n\n`;
            
            for (const apiCall of comp.apiCalls) {
                const api = this.findAPI(apiCall);
                if (api) {
                    report += `##### ${api.name}\n`;
                    report += `- **Path:** ${api.path}\n`;
                    report += `- **Method:** ${api.method}\n`;
                    report += `- **Sys ID:** ${api.sys_id}\n\n`;
                    
                    if (api.script) {
                        const scriptIncludes = this.extractScriptIncludeCalls(api.script);
                        if (scriptIncludes.length > 0) {
                            report += `**Script Includes Used:**\n`;
                            scriptIncludes.forEach(si => {
                                const siInfo = this.scriptIncludeCache.get(si);
                                if (siInfo) {
                                    report += `- ${si} - ${siInfo.description || 'No description'}\n`;
                                } else {
                                    report += `- ${si}\n`;
                                }
                            });
                            report += '\n';
                        }
                    }
                } else {
                    report += `##### ${apiCall} (Not found in cache)\n\n`;
                }
            }
        } else {
            report += `*No API calls detected*\n\n`;
        }
        
        report += '\n---\n\n';
        return report;
    }
}

// Main execution
async function main() {
    const tracer = new ServiceNowFlowTracer();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        // Interactive mode
        await tracer.initialize();
        await tracer.interactiveMenu();
    } else {
        // Command mode
        await tracer.initialize();
        
        const command = args[0];
        const target = args[1];
        
        switch (command) {
            case 'component':
            case 'comp':
                if (!target) {
                    console.error('Please provide a component name');
                    process.exit(1);
                }
                await tracer.traceComponentFlow(target);
                break;
                
            case 'api':
                if (!target) {
                    console.error('Please provide an API name or path');
                    process.exit(1);
                }
                await tracer.traceAPIToScriptInclude(target);
                break;
                
            case 'script':
            case 'si':
                if (!target) {
                    console.error('Please provide a Script Include name');
                    process.exit(1);
                }
                await tracer.traceScriptIncludeUsage(target);
                break;
                
            case 'search':
                if (!target) {
                    console.error('Please provide a search term');
                    process.exit(1);
                }
                await tracer.searchEverything(target);
                break;
                
            case 'export':
                const exportTarget = target || 'all';
                await tracer.exportFlowReport(exportTarget);
                break;
                
            default:
                console.error(`Unknown command: ${command}`);
                console.log('\nUsage:');
                console.log('  node sn-flow-tracer.js                    - Interactive mode');
                console.log('  node sn-flow-tracer.js component <name>   - Trace component flow');
                console.log('  node sn-flow-tracer.js api <name/path>    - Trace API to Script Include');
                console.log('  node sn-flow-tracer.js script <name>      - Find Script Include usage');
                console.log('  node sn-flow-tracer.js search <term>      - Search everything');
                console.log('  node sn-flow-tracer.js export [name|all]  - Export flow report');
                process.exit(1);
        }
    }
}

// Run the tracer
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ServiceNowFlowTracer;