/**
 * Enhanced REST API Detail Fetcher
 * Fetches complete sys_ws_operation records with operation_script and Script Include references
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

class RestApiDetailFetcher {
    constructor(config) {
        this.config = config;
        this.instance = config.instance;
        this.auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
        this.outputDir = path.join(__dirname, 'temp_updates');
    }

    async ensureOutputDir() {
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
        } catch (error) {
            // Directory already exists
        }
    }

    async makeRequest(url) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.instance,
                path: url,
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${this.auth}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
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

            req.end();
        });
    }

    async fetchApiOperationBySysId(sysId) {
        console.log(`Fetching REST API operation: ${sysId}`);
        
        const url = `/api/now/table/sys_ws_operation/${sysId}?sysparm_display_value=all&sysparm_exclude_reference_link=false`;
        const response = await this.makeRequest(url);
        
        if (response.result) {
            const operation = response.result;
            console.log(`Found: ${operation.name.display_value} - ${operation.operation_uri.value}`);
            return operation;
        }
        
        throw new Error(`API operation not found: ${sysId}`);
    }

    async fetchApiOperationsByPattern(pattern) {
        console.log(`Searching for API operations matching: ${pattern}`);
        
        // Create multiple search patterns to catch more variations
        const searchTerms = [
            pattern,                                    // Exact pattern
            pattern.replace(/\s+/g, ''),               // Remove spaces
            pattern.replace(/\s+/g, '_'),              // Replace spaces with underscores
            pattern.replace(/\s+/g, '-'),              // Replace spaces with hyphens
            ...pattern.split(/\s+/)                    // Individual words
        ];
        
        const queries = searchTerms.map(term => `nameSTARTSWITH${encodeURIComponent(term)}^ORnameCONTAINS${encodeURIComponent(term)}`);
        const encodedQuery = queries.join('^OR');
        
        const url = `/api/now/table/sys_ws_operation?sysparm_query=${encodedQuery}&sysparm_display_value=all&sysparm_exclude_reference_link=false&sysparm_limit=100`;
        
        const response = await this.makeRequest(url);
        
        if (response.result && response.result.length > 0) {
            // Remove duplicates based on sys_id
            const uniqueResults = response.result.filter((op, index, self) => 
                self.findIndex(o => o.sys_id.value === op.sys_id.value) === index
            );
            
            console.log(`Found ${uniqueResults.length} unique operations:`);
            uniqueResults.forEach(op => {
                console.log(`  - ${op.name.display_value} (${op.sys_id.value})`);
            });
            return uniqueResults;
        }
        
        return [];
    }

    async fetchScriptInclude(name) {
        console.log(`Fetching Script Include: ${name}`);
        
        const encodedQuery = `name=${name}`;
        const url = `/api/now/table/sys_script_include?sysparm_query=${encodedQuery}&sysparm_display_value=all&sysparm_exclude_reference_link=false`;
        
        const response = await this.makeRequest(url);
        
        if (response.result && response.result.length > 0) {
            return response.result[0];
        }
        
        return null;
    }

    extractScriptIncludeReferences(operationScript) {
        if (!operationScript) return [];
        
        const references = [];
        
        // Pattern for x_scope.ClassName style references
        const scopedPattern = /x_[a-zA-Z_]+\.[A-Za-z][A-Za-z0-9_]*/g;
        const scopedMatches = operationScript.match(scopedPattern);
        if (scopedMatches) {
            references.push(...scopedMatches);
        }
        
        // Pattern for direct class instantiation: new ClassName()
        const newPattern = /new\s+([A-Za-z][A-Za-z0-9_]*)\s*\(/g;
        let match;
        while ((match = newPattern.exec(operationScript)) !== null) {
            references.push(match[1]);
        }
        
        // Pattern for static method calls: ClassName.method()
        const staticPattern = /([A-Za-z][A-Za-z0-9_]*)\.[a-zA-Z][a-zA-Z0-9_]*\s*\(/g;
        while ((match = staticPattern.exec(operationScript)) !== null) {
            if (!match[1].includes('.') && match[1] !== 'gs' && match[1] !== 'JSON') {
                references.push(match[1]);
            }
        }
        
        return [...new Set(references)]; // Remove duplicates
    }

    async saveOperationDetails(operation, filename) {
        await this.ensureOutputDir();
        
        const enhanced = {
            ...operation,
            _analysis: {
                extracted_at: new Date().toISOString(),
                script_include_references: [],
                has_ms_pattern: false
            }
        };
        
        // Extract Script Include references
        if (operation.operation_script && operation.operation_script.value) {
            enhanced._analysis.script_include_references = this.extractScriptIncludeReferences(
                operation.operation_script.value
            );
            
            // Check for MS pattern
            enhanced._analysis.has_ms_pattern = enhanced._analysis.script_include_references.some(
                ref => ref.endsWith('MS') || ref.includes('MS.')
            );
        }
        
        const filepath = path.join(this.outputDir, `${filename}.json`);
        await fs.writeFile(filepath, JSON.stringify(enhanced, null, 2));
        console.log(`Saved: ${filepath}`);
        
        return enhanced;
    }

    async traceComponentApis(componentName) {
        console.log(`\n=== Tracing APIs for component: ${componentName} ===`);
        
        const operations = await this.fetchApiOperationsByPattern(componentName);
        const results = [];
        
        for (const operation of operations) {
            const enhanced = await this.saveOperationDetails(
                operation, 
                `${operation.name.display_value.replace(/[^a-zA-Z0-9\-_]/g, '_')}_complete`
            );
            
            console.log(`\nAPI: ${operation.name.display_value}`);
            console.log(`URI: ${operation.operation_uri.value}`);
            console.log(`Method: ${operation.http_method.display_value}`);
            console.log(`Script Includes: ${enhanced._analysis.script_include_references.join(', ')}`);
            console.log(`MS Pattern: ${enhanced._analysis.has_ms_pattern ? 'Yes' : 'No'}`);
            
            results.push(enhanced);
        }
        
        return results;
    }

    async fetchBySysIds(sysIds) {
        console.log(`\n=== Fetching operations by sys_id ===`);
        
        const results = [];
        
        for (const sysId of sysIds) {
            try {
                const operation = await this.fetchApiOperationBySysId(sysId);
                const enhanced = await this.saveOperationDetails(
                    operation,
                    `${operation.name.display_value.replace(/[^a-zA-Z0-9\-_]/g, '_')}_complete`
                );
                results.push(enhanced);
            } catch (error) {
                console.error(`Failed to fetch ${sysId}: ${error.message}`);
            }
        }
        
        return results;
    }
}

// CLI Usage
async function main() {
    const configPath = path.join(__dirname, 'sn-config.json');
    
    try {
        const configData = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        // Use default instance or first available
        const instanceKey = config.routing?.default || Object.keys(config.instances)[0];
        const instanceConfig = config.instances[instanceKey];
        
        if (!instanceConfig) {
            throw new Error(`No instance configuration found for: ${instanceKey}`);
        }
        
        const fetcher = new RestApiDetailFetcher(instanceConfig);
        
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            console.log('Usage:');
            console.log('  node fetch-rest-api-details.js component <componentName>');
            console.log('  node fetch-rest-api-details.js sysids <id1> <id2> <id3>...');
            console.log('');
            console.log('Examples:');
            console.log('  node fetch-rest-api-details.js component "Audience Builder"');
            console.log('  node fetch-rest-api-details.js sysids 05afff0087ab0a10369f33373cbb3586');
            return;
        }
        
        const command = args[0];
        
        if (command === 'component') {
            const componentName = args[1];
            if (!componentName) {
                console.error('Component name required');
                return;
            }
            await fetcher.traceComponentApis(componentName);
        } else if (command === 'sysids') {
            const sysIds = args.slice(1);
            if (sysIds.length === 0) {
                console.error('At least one sys_id required');
                return;
            }
            await fetcher.fetchBySysIds(sysIds);
        } else {
            console.error('Unknown command. Use "component" or "sysids"');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = RestApiDetailFetcher;