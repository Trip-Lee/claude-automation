/**
 * Component Analyzer Agent
 * Specializes in analyzing UI components from both Sashimono and component-library
 * Can identify dependencies, API usage, props, events, and component relationships
 */

const BaseAgent = require('./base-agent');
const path = require('path');
const fs = require('fs');

class ComponentAnalyzerAgent extends BaseAgent {
    constructor(config = {}) {
        super('ComponentAnalyzer', config);
        
        this.sashimonoPath = path.join(this.rootPath, 'Tenon Repo', 'Sashimono');
        this.componentLibPath = path.join(this.rootPath, 'Tenon Repo', 'component-library');
        
        this.components = new Map();
        this.componentDependencies = new Map();
        this.apiUsageMap = new Map();
        
        // Pattern matchers for component analysis
        this.patterns = {
            imports: /import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/gm,
            exports: /export\s+(?:default\s+)?(?:const|function|class)\s+(\w+)/gm,
            props: /properties:\s*{([^}]+)}/gms,
            events: /dispatch\(['"]([^'"]+)['"]/gm,
            apiCalls: {
                httpEffect: /createHttpEffect\([^,]*,\s*{[^}]*(?:url|path):\s*['"`]([^'"`]+)['"`]/gm,
                dispatch: /dispatch\(['"`]([A-Z_]+)['"`]/gm,
                actionTypes: /actionTypes\.([A-Z_]+)/gm,
                apiPaths: /['"`](\/api\/[^'"`]+)['"`]/gm
            },
            stateManagement: {
                useState: /useState\(([^)]*)\)/gm,
                useEffect: /useEffect\(/gm,
                redux: /connect\(/gm,
                context: /useContext\(/gm
            },
            componentReferences: /['"]x-(?:tenon|cadso)-([^'"]+)['"]/gm
        };
    }

    async loadData() {
        this.log('Loading UI components...', 'yellow');
        
        // Load Sashimono components
        await this.loadComponentsFromRepo(this.sashimonoPath, 'Sashimono');
        
        // Load component-library components
        await this.loadComponentsFromRepo(this.componentLibPath, 'component-library');
        
        this.log(`Loaded ${this.components.size} components`, 'green');
        
        // Analyze component relationships
        await this.analyzeComponentRelationships();
    }

    async loadComponentsFromRepo(repoPath, repoName) {
        if (!fs.existsSync(repoPath)) {
            this.log(`Repository path not found: ${repoPath}`, 'yellow');
            return;
        }
        
        const dirs = fs.readdirSync(repoPath).filter(d => 
            fs.statSync(path.join(repoPath, d)).isDirectory() &&
            !d.startsWith('.') &&
            d !== 'node_modules'
        );
        
        for (const dir of dirs) {
            const componentPath = path.join(repoPath, dir);
            const component = await this.analyzeComponent(componentPath, dir, repoName);
            
            if (component) {
                this.components.set(component.name, component);
                
                // Map API usage
                component.apiCalls.forEach(api => {
                    if (!this.apiUsageMap.has(api)) {
                        this.apiUsageMap.set(api, []);
                    }
                    this.apiUsageMap.get(api).push(component.name);
                });
            }
        }
    }

    async analyzeComponent(componentPath, componentName, repoName) {
        const mainFiles = [
            path.join(componentPath, 'index.js'),
            path.join(componentPath, 'src', 'index.js'),
            path.join(componentPath, `${componentName}.js`),
            path.join(componentPath, 'src', `${componentName}.js`)
        ];
        
        let mainFile = null;
        let content = null;
        
        for (const file of mainFiles) {
            if (fs.existsSync(file)) {
                mainFile = file;
                content = fs.readFileSync(file, 'utf8');
                break;
            }
        }
        
        if (!mainFile) {
            return null;
        }
        
        const component = {
            name: componentName,
            repo: repoName,
            path: componentPath,
            mainFile: mainFile,
            imports: [],
            exports: [],
            props: [],
            events: [],
            apiCalls: [],
            dependencies: [],
            stateManagement: {
                hasState: false,
                hasEffects: false,
                hasRedux: false,
                hasContext: false
            },
            childComponents: [],
            metadata: {}
        };
        
        // Extract imports
        let match;
        this.patterns.imports.lastIndex = 0;
        while ((match = this.patterns.imports.exec(content)) !== null) {
            const importPath = match[1];
            component.imports.push(importPath);
            
            // Track component dependencies
            if (importPath.includes('x-tenon-') || importPath.includes('x-cadso-')) {
                const depName = importPath.split('/').pop();
                component.dependencies.push(depName);
            }
        }
        
        // Extract exports
        this.patterns.exports.lastIndex = 0;
        while ((match = this.patterns.exports.exec(content)) !== null) {
            component.exports.push(match[1]);
        }
        
        // Extract props
        this.patterns.props.lastIndex = 0;
        match = this.patterns.props.exec(content);
        if (match) {
            const propsContent = match[1];
            const propMatches = propsContent.match(/(\w+):\s*{[^}]+}/g) || [];
            component.props = propMatches.map(p => p.split(':')[0].trim());
        }
        
        // Extract events
        this.patterns.events.lastIndex = 0;
        while ((match = this.patterns.events.exec(content)) !== null) {
            if (!component.events.includes(match[1])) {
                component.events.push(match[1]);
            }
        }
        
        // Extract API calls
        for (const [type, pattern] of Object.entries(this.patterns.apiCalls)) {
            pattern.lastIndex = 0;
            while ((match = pattern.exec(content)) !== null) {
                if (!component.apiCalls.includes(match[1])) {
                    component.apiCalls.push(match[1]);
                }
            }
        }
        
        // Analyze state management
        if (this.patterns.stateManagement.useState.test(content)) {
            component.stateManagement.hasState = true;
        }
        if (this.patterns.stateManagement.useEffect.test(content)) {
            component.stateManagement.hasEffects = true;
        }
        if (this.patterns.stateManagement.redux.test(content)) {
            component.stateManagement.hasRedux = true;
        }
        if (this.patterns.stateManagement.context.test(content)) {
            component.stateManagement.hasContext = true;
        }
        
        // Extract child component references
        this.patterns.componentReferences.lastIndex = 0;
        while ((match = this.patterns.componentReferences.exec(content)) !== null) {
            if (!component.childComponents.includes(match[1])) {
                component.childComponents.push(match[1]);
            }
        }
        
        // Load metadata from package.json if exists
        const packagePath = path.join(componentPath, 'package.json');
        if (fs.existsSync(packagePath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                component.metadata = {
                    version: packageJson.version,
                    description: packageJson.description,
                    dependencies: Object.keys(packageJson.dependencies || {})
                };
            } catch (e) {
                // Ignore package.json parsing errors
            }
        }
        
        // Check for test files
        const testFiles = this.getAllFiles(componentPath, '.test.js');
        component.hasTests = testFiles.length > 0;
        component.testCount = testFiles.length;
        
        // Check for documentation
        const readmePath = path.join(componentPath, 'README.md');
        component.hasDocumentation = fs.existsSync(readmePath);
        
        return component;
    }

    async analyzeComponentRelationships() {
        this.log('Analyzing component relationships...', 'yellow');
        
        for (const [name, component] of this.components) {
            const dependencies = {
                directDependencies: component.dependencies,
                usedBy: [],
                apiDependencies: component.apiCalls,
                childComponents: component.childComponents
            };
            
            // Find components that use this one
            for (const [otherName, otherComponent] of this.components) {
                if (otherName !== name && otherComponent.dependencies.includes(name)) {
                    dependencies.usedBy.push(otherName);
                }
            }
            
            this.componentDependencies.set(name, dependencies);
        }
        
        this.log('Component relationship analysis complete', 'green');
    }

    async handleRequest(request) {
        switch (request.type) {
            case 'get_component':
                return this.getComponent(request.componentName);
                
            case 'analyze_component':
                return this.analyzeComponentDetails(request.componentName);
                
            case 'get_dependencies':
                return this.getComponentDependencies(request.componentName);
                
            case 'find_components_by_api':
                return this.findComponentsByAPI(request.api);
                
            case 'get_component_tree':
                return this.getComponentTree(request.componentName);
                
            case 'search_components':
                return this.searchComponents(request.query);
                
            case 'get_component_metrics':
                return this.getComponentMetrics(request.componentName);
                
            case 'suggest_refactoring':
                return this.suggestRefactoring(request.componentName);
                
            case 'validate_component':
                return this.validateComponent(request.componentName);
                
            default:
                throw new Error(`Unknown request type: ${request.type}`);
        }
    }

    getComponent(componentName) {
        const component = this.components.get(componentName);
        if (!component) {
            // Try fuzzy match
            for (const [name, comp] of this.components) {
                if (name.toLowerCase().includes(componentName.toLowerCase())) {
                    return comp;
                }
            }
            throw new Error(`Component ${componentName} not found`);
        }
        return component;
    }

    analyzeComponentDetails(componentName) {
        const component = this.getComponent(componentName);
        const dependencies = this.componentDependencies.get(component.name) || {};
        
        return {
            name: component.name,
            repo: component.repo,
            path: component.path,
            analysis: {
                complexity: this.calculateComponentComplexity(component),
                apiIntegration: component.apiCalls.length > 0,
                stateManagement: component.stateManagement,
                testCoverage: component.hasTests ? 'Has tests' : 'No tests found',
                documentation: component.hasDocumentation ? 'Documented' : 'No documentation',
                dependencies: dependencies.directDependencies.length,
                usedBy: dependencies.usedBy?.length || 0,
                maintainability: this.assessMaintainability(component)
            },
            props: component.props,
            events: component.events,
            apiCalls: component.apiCalls,
            recommendations: this.generateRecommendations(component)
        };
    }

    getComponentDependencies(componentName) {
        const component = this.getComponent(componentName);
        const deps = this.componentDependencies.get(component.name) || {};
        
        return {
            component: component.name,
            directDependencies: deps.directDependencies || [],
            usedBy: deps.usedBy || [],
            apiDependencies: deps.apiDependencies || [],
            childComponents: deps.childComponents || [],
            dependencyGraph: this.buildDependencyGraph(component.name)
        };
    }

    findComponentsByAPI(api) {
        const components = this.apiUsageMap.get(api) || [];
        
        return {
            api: api,
            componentCount: components.length,
            components: components.map(name => {
                const comp = this.components.get(name);
                return {
                    name: comp.name,
                    repo: comp.repo,
                    path: comp.path
                };
            })
        };
    }

    getComponentTree(componentName, visited = new Set()) {
        if (visited.has(componentName)) {
            return { name: componentName, circular: true };
        }
        
        visited.add(componentName);
        const component = this.components.get(componentName);
        
        if (!component) {
            return { name: componentName, notFound: true };
        }
        
        const tree = {
            name: component.name,
            repo: component.repo,
            children: []
        };
        
        component.childComponents.forEach(child => {
            tree.children.push(this.getComponentTree(child, visited));
        });
        
        return tree;
    }

    searchComponents(query) {
        const queryLower = query.toLowerCase();
        const results = [];
        
        for (const [name, component] of this.components) {
            const searchText = `
                ${component.name}
                ${component.props.join(' ')}
                ${component.events.join(' ')}
                ${component.apiCalls.join(' ')}
                ${component.metadata.description || ''}
            `.toLowerCase();
            
            if (searchText.includes(queryLower)) {
                results.push({
                    name: component.name,
                    repo: component.repo,
                    matchedIn: this.getMatchContext(component, queryLower)
                });
            }
        }
        
        return results;
    }

    getComponentMetrics(componentName) {
        const component = this.getComponent(componentName);
        const deps = this.componentDependencies.get(component.name) || {};
        
        return {
            name: component.name,
            metrics: {
                linesOfCode: this.estimateLineCount(component),
                complexity: this.calculateComponentComplexity(component),
                dependencies: deps.directDependencies?.length || 0,
                usedBy: deps.usedBy?.length || 0,
                apiCalls: component.apiCalls.length,
                props: component.props.length,
                events: component.events.length,
                testCoverage: component.testCount,
                maintainabilityScore: this.calculateMaintainabilityScore(component)
            }
        };
    }

    suggestRefactoring(componentName) {
        const component = this.getComponent(componentName);
        const suggestions = [];
        
        // Check component size
        if (this.estimateLineCount(component) > 500) {
            suggestions.push({
                type: 'size',
                severity: 'high',
                suggestion: 'Consider splitting this component into smaller, more focused components'
            });
        }
        
        // Check dependencies
        if (component.dependencies.length > 10) {
            suggestions.push({
                type: 'dependencies',
                severity: 'medium',
                suggestion: 'High number of dependencies. Consider reducing coupling'
            });
        }
        
        // Check API calls
        if (component.apiCalls.length > 5) {
            suggestions.push({
                type: 'api',
                severity: 'medium',
                suggestion: 'Multiple API calls in one component. Consider using a data service layer'
            });
        }
        
        // Check state management
        if (component.stateManagement.hasState && !component.stateManagement.hasContext) {
            suggestions.push({
                type: 'state',
                severity: 'low',
                suggestion: 'Consider using Context API for shared state management'
            });
        }
        
        // Check testing
        if (!component.hasTests) {
            suggestions.push({
                type: 'testing',
                severity: 'high',
                suggestion: 'No tests found. Add unit tests for better maintainability'
            });
        }
        
        // Check documentation
        if (!component.hasDocumentation) {
            suggestions.push({
                type: 'documentation',
                severity: 'medium',
                suggestion: 'Missing documentation. Add README.md with usage examples'
            });
        }
        
        return {
            component: component.name,
            suggestions: suggestions,
            overallHealth: this.calculateHealthScore(suggestions)
        };
    }

    validateComponent(componentName) {
        const component = this.getComponent(componentName);
        const issues = [];
        const warnings = [];
        
        // Check for required files
        if (!component.mainFile) {
            issues.push('No main entry point found');
        }
        
        // Check for circular dependencies
        const circular = this.detectCircularDependencies(component.name);
        if (circular.length > 0) {
            issues.push(`Circular dependencies detected: ${circular.join(' -> ')}`);
        }
        
        // Check for unused props
        if (component.props.length > 10) {
            warnings.push('Large number of props. Consider using composition');
        }
        
        // Check for missing error handling in API calls
        if (component.apiCalls.length > 0 && !component.events.includes('ERROR')) {
            warnings.push('API calls detected but no error handling events found');
        }
        
        return {
            component: component.name,
            valid: issues.length === 0,
            issues: issues,
            warnings: warnings
        };
    }

    // Helper methods
    calculateComponentComplexity(component) {
        let complexity = 0;
        
        complexity += component.dependencies.length * 2;
        complexity += component.apiCalls.length * 3;
        complexity += component.props.length;
        complexity += component.events.length;
        complexity += component.childComponents.length * 2;
        
        if (component.stateManagement.hasState) complexity += 2;
        if (component.stateManagement.hasEffects) complexity += 2;
        if (component.stateManagement.hasRedux) complexity += 3;
        
        if (complexity <= 10) return 'Low';
        if (complexity <= 25) return 'Medium';
        return 'High';
    }

    assessMaintainability(component) {
        const factors = [];
        
        if (component.hasTests) factors.push('Has tests');
        if (component.hasDocumentation) factors.push('Documented');
        if (component.dependencies.length <= 5) factors.push('Low coupling');
        if (component.props.length <= 10) factors.push('Simple interface');
        
        if (factors.length >= 3) return 'Good';
        if (factors.length >= 2) return 'Fair';
        return 'Needs improvement';
    }

    generateRecommendations(component) {
        const recommendations = [];
        
        if (!component.hasTests) {
            recommendations.push('Add unit tests for this component');
        }
        
        if (!component.hasDocumentation) {
            recommendations.push('Add documentation with usage examples');
        }
        
        if (component.apiCalls.length > 3) {
            recommendations.push('Consider extracting API calls to a service layer');
        }
        
        if (component.dependencies.length > 8) {
            recommendations.push('Review dependencies and reduce coupling where possible');
        }
        
        return recommendations;
    }

    buildDependencyGraph(componentName, depth = 0, maxDepth = 3, visited = new Set()) {
        if (depth > maxDepth || visited.has(componentName)) {
            return null;
        }
        
        visited.add(componentName);
        const component = this.components.get(componentName);
        
        if (!component) {
            return { name: componentName, type: 'unknown' };
        }
        
        const node = {
            name: component.name,
            repo: component.repo,
            dependencies: []
        };
        
        component.dependencies.forEach(dep => {
            const child = this.buildDependencyGraph(dep, depth + 1, maxDepth, visited);
            if (child) {
                node.dependencies.push(child);
            }
        });
        
        return node;
    }

    detectCircularDependencies(componentName, path = [], visited = new Set()) {
        if (path.includes(componentName)) {
            return [...path, componentName];
        }
        
        if (visited.has(componentName)) {
            return [];
        }
        
        visited.add(componentName);
        path.push(componentName);
        
        const component = this.components.get(componentName);
        if (component) {
            for (const dep of component.dependencies) {
                const circular = this.detectCircularDependencies(dep, [...path], visited);
                if (circular.length > 0) {
                    return circular;
                }
            }
        }
        
        return [];
    }

    estimateLineCount(component) {
        // Rough estimate based on component characteristics
        let estimate = 100; // Base
        
        estimate += component.props.length * 10;
        estimate += component.events.length * 20;
        estimate += component.apiCalls.length * 30;
        estimate += component.dependencies.length * 5;
        
        if (component.stateManagement.hasState) estimate += 50;
        if (component.stateManagement.hasEffects) estimate += 30;
        if (component.stateManagement.hasRedux) estimate += 100;
        
        return estimate;
    }

    calculateMaintainabilityScore(component) {
        let score = 100;
        
        // Deduct points for complexity
        const complexity = this.calculateComponentComplexity(component);
        if (complexity === 'Medium') score -= 20;
        if (complexity === 'High') score -= 40;
        
        // Deduct for missing tests/docs
        if (!component.hasTests) score -= 20;
        if (!component.hasDocumentation) score -= 15;
        
        // Deduct for high coupling
        if (component.dependencies.length > 10) score -= 15;
        if (component.apiCalls.length > 5) score -= 10;
        
        return Math.max(0, score);
    }

    calculateHealthScore(suggestions) {
        const severityScores = {
            high: 30,
            medium: 15,
            low: 5
        };
        
        let totalDeduction = 0;
        suggestions.forEach(s => {
            totalDeduction += severityScores[s.severity] || 0;
        });
        
        const score = Math.max(0, 100 - totalDeduction);
        
        if (score >= 80) return 'Healthy';
        if (score >= 60) return 'Fair';
        if (score >= 40) return 'Needs attention';
        return 'Critical';
    }

    getMatchContext(component, query) {
        const contexts = [];
        
        if (component.name.toLowerCase().includes(query)) {
            contexts.push('name');
        }
        if (component.props.some(p => p.toLowerCase().includes(query))) {
            contexts.push('props');
        }
        if (component.events.some(e => e.toLowerCase().includes(query))) {
            contexts.push('events');
        }
        if (component.apiCalls.some(a => a.toLowerCase().includes(query))) {
            contexts.push('api calls');
        }
        
        return contexts.join(', ') || 'metadata';
    }
}

module.exports = ComponentAnalyzerAgent;