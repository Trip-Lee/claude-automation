/**
 * Flow Analyzer Agent
 * Specializes in analyzing ServiceNow Flow Designer flows, subflows, and actions
 * Maps flow triggers, steps, conditions, and integrations with other components
 */

const BaseAgent = require('./base-agent');
const path = require('path');
const fs = require('fs');

class FlowAnalyzerAgent extends BaseAgent {
    constructor(config = {}) {
        super('FlowAnalyzer', config);
        
        this.flowPath = path.join(this.rootPath, 'ServiceNow-Data', 'Tenon', 'Flows');
        
        this.flows = new Map();
        this.flowSteps = new Map();
        this.subflows = new Map();
        this.actionTypes = new Map();
        this.flowVariables = new Map();
        
        // Flow-to-component mapping
        this.flowIntegrations = new Map();
        this.triggerMappings = new Map();
        
        // Analysis patterns for flows
        this.patterns = {
            scriptReferences: /gs\.(\w+)\(/gm,
            tableReferences: /['"`](\w+)['"`]\.(\w+)/gm,
            apiCalls: /api\/now\/(\w+)/gm,
            componentReferences: /component['"`]:\s*['"`]([^'"`]+)['"`]/gm,
            subflowCalls: /subflow['"`]:\s*['"`]([^'"`]+)['"`]/gm
        };
    }

    async loadData() {
        this.log('Loading ServiceNow Flow records...', 'yellow');
        
        // Load all flow-related data
        await this.loadFlows();
        await this.loadFlowSteps();
        await this.loadSubflows();
        await this.loadActionTypes();
        await this.loadFlowVariables();
        
        this.log(`Loaded ${this.flows.size} flows, ${this.flowSteps.size} steps, ${this.subflows.size} subflows`, 'green');
        
        // Analyze flow relationships
        await this.analyzeFlowRelationships();
    }

    async loadFlows() {
        const flowFiles = ['Flows.json', 'Flow_Designer_Detailed.json'];
        
        for (const fileName of flowFiles) {
            const filePath = path.join(this.flowPath, fileName);
            if (!fs.existsSync(filePath)) continue;
            
            const data = this.readJSON(filePath);
            if (data && data.result) {
                data.result.forEach(flow => {
                    const flowInfo = {
                        sys_id: flow.sys_id,
                        name: flow.name,
                        description: flow.description,
                        active: flow.active,
                        state: flow.state,
                        trigger_type: flow.trigger_type,
                        trigger_table: flow.trigger_table,
                        trigger_condition: flow.trigger_condition,
                        trigger_conditions: flow.trigger_conditions,
                        created_on: flow.created_on,
                        created_by: flow.created_by,
                        updated_on: flow.updated_on,
                        updated_by: flow.updated_by,
                        file: filePath,
                        // Analysis results
                        steps: [],
                        integrations: [],
                        triggers: [],
                        complexity: 'Unknown'
                    };
                    
                    this.flows.set(flow.sys_id, flowInfo);
                    
                    // Map by name for easy lookup
                    if (flow.name) {
                        this.flows.set(flow.name, flowInfo);
                    }
                });
            }
        }
    }

    async loadFlowSteps() {
        const filePath = path.join(this.flowPath, 'Flow_Steps.json');
        if (!fs.existsSync(filePath)) return;
        
        const data = this.readJSON(filePath);
        if (data && data.result) {
            data.result.forEach(step => {
                const stepInfo = {
                    sys_id: step.sys_id,
                    name: step.name,
                    description: step.description,
                    flow: step.flow,
                    step_type: step.step_type,
                    sequence: step.sequence,
                    inputs: step.inputs,
                    outputs: step.outputs,
                    script: step.script,
                    condition: step.condition,
                    created_on: step.created_on,
                    created_by: step.created_by,
                    // Analysis results
                    scriptReferences: [],
                    apiCalls: [],
                    componentReferences: []
                };
                
                // Analyze step content
                this.analyzeStepContent(stepInfo);
                
                this.flowSteps.set(step.sys_id, stepInfo);
                
                // Add step to parent flow
                const parentFlow = this.flows.get(step.flow);
                if (parentFlow) {
                    parentFlow.steps.push(stepInfo);
                }
            });
        }
    }

    async loadSubflows() {
        const filePath = path.join(this.flowPath, 'Subflows.json');
        if (!fs.existsSync(filePath)) return;
        
        const data = this.readJSON(filePath);
        if (data && data.result) {
            data.result.forEach(subflow => {
                this.subflows.set(subflow.sys_id, {
                    sys_id: subflow.sys_id,
                    name: subflow.name,
                    description: subflow.description,
                    active: subflow.active,
                    inputs: subflow.inputs,
                    outputs: subflow.outputs,
                    created_on: subflow.created_on,
                    created_by: subflow.created_by,
                    updated_on: subflow.updated_on,
                    updated_by: subflow.updated_by
                });
                
                // Map by name
                if (subflow.name) {
                    this.subflows.set(subflow.name, this.subflows.get(subflow.sys_id));
                }
            });
        }
    }

    async loadActionTypes() {
        const filePath = path.join(this.flowPath, 'Action_Definitions.json');
        if (!fs.existsSync(filePath)) return;
        
        const data = this.readJSON(filePath);
        if (data && data.result) {
            data.result.forEach(action => {
                this.actionTypes.set(action.sys_id, {
                    sys_id: action.sys_id,
                    name: action.name,
                    description: action.description,
                    action_type: action.action_type,
                    inputs: action.inputs,
                    outputs: action.outputs,
                    script_api: action.script_api,
                    script_api_name: action.script_api_name,
                    created_on: action.created_on,
                    created_by: action.created_by
                });
            });
        }
    }

    async loadFlowVariables() {
        const filePath = path.join(this.flowPath, 'Flow_Variables.json');
        if (!fs.existsSync(filePath)) return;
        
        const data = this.readJSON(filePath);
        if (data && data.result) {
            data.result.forEach(variable => {
                const varInfo = {
                    sys_id: variable.sys_id,
                    name: variable.name,
                    type: variable.type,
                    value: variable.value,
                    flow: variable.flow,
                    created_on: variable.created_on
                };
                
                this.flowVariables.set(variable.sys_id, varInfo);
                
                // Add to parent flow
                const parentFlow = this.flows.get(variable.flow);
                if (parentFlow) {
                    if (!parentFlow.variables) parentFlow.variables = [];
                    parentFlow.variables.push(varInfo);
                }
            });
        }
    }

    analyzeStepContent(step) {
        const content = `
            ${step.script || ''}
            ${step.inputs || ''}
            ${step.outputs || ''}
            ${step.condition || ''}
        `;
        
        // Extract script references
        let match;
        this.patterns.scriptReferences.lastIndex = 0;
        while ((match = this.patterns.scriptReferences.exec(content)) !== null) {
            if (!step.scriptReferences.includes(match[1])) {
                step.scriptReferences.push(match[1]);
            }
        }
        
        // Extract API calls
        this.patterns.apiCalls.lastIndex = 0;
        while ((match = this.patterns.apiCalls.exec(content)) !== null) {
            if (!step.apiCalls.includes(match[1])) {
                step.apiCalls.push(match[1]);
            }
        }
        
        // Extract component references
        this.patterns.componentReferences.lastIndex = 0;
        while ((match = this.patterns.componentReferences.exec(content)) !== null) {
            if (!step.componentReferences.includes(match[1])) {
                step.componentReferences.push(match[1]);
            }
        }
    }

    async analyzeFlowRelationships() {
        this.log('Analyzing flow relationships...', 'yellow');
        
        for (const [flowId, flow] of this.flows) {
            if (typeof flowId !== 'string' || !flowId.startsWith('sys_id_')) continue;
            
            // Analyze trigger relationships
            if (flow.trigger_table) {
                if (!this.triggerMappings.has(flow.trigger_table)) {
                    this.triggerMappings.set(flow.trigger_table, []);
                }
                this.triggerMappings.get(flow.trigger_table).push(flowId);
            }
            
            // Calculate complexity
            flow.complexity = this.calculateFlowComplexity(flow);
            
            // Find integrations
            flow.integrations = this.findFlowIntegrations(flow);
        }
        
        this.log('Flow relationship analysis complete', 'green');
    }

    async handleRequest(request) {
        switch (request.type) {
            case 'get_flow':
                return this.getFlow(request.flowName);
                
            case 'analyze_flow':
                return this.analyzeFlow(request.flowName);
                
            case 'get_flows_by_trigger':
                return this.getFlowsByTrigger(request.triggerTable);
                
            case 'find_flow_dependencies':
                return this.findFlowDependencies(request.flowName);
                
            case 'get_flow_performance':
                return this.getFlowPerformance(request.flowName);
                
            case 'search_flows':
                return this.searchFlows(request.query);
                
            case 'validate_flow':
                return this.validateFlow(request.flowName);
                
            case 'get_flow_integrations':
                return this.getFlowIntegrations(request.flowName);
                
            default:
                throw new Error(`Unknown request type: ${request.type}`);
        }
    }

    getFlow(flowName) {
        const flow = this.flows.get(flowName);
        if (!flow) {
            // Try fuzzy match
            for (const [name, f] of this.flows) {
                if (typeof name === 'string' && name.toLowerCase().includes(flowName.toLowerCase())) {
                    return f;
                }
            }
            throw new Error(`Flow ${flowName} not found`);
        }
        return flow;
    }

    analyzeFlow(flowName) {
        const flow = this.getFlow(flowName);
        
        return {
            name: flow.name,
            sys_id: flow.sys_id,
            active: flow.active,
            state: flow.state,
            analysis: {
                complexity: flow.complexity,
                stepCount: flow.steps.length,
                hasScripts: flow.steps.some(s => s.script),
                hasConditions: flow.steps.some(s => s.condition),
                triggerType: flow.trigger_type,
                triggerTable: flow.trigger_table,
                integrations: flow.integrations,
                variableCount: flow.variables?.length || 0
            },
            trigger: {
                type: flow.trigger_type,
                table: flow.trigger_table,
                condition: flow.trigger_condition
            },
            steps: flow.steps.map(step => ({
                name: step.name,
                type: step.step_type,
                sequence: step.sequence,
                hasScript: !!step.script,
                scriptReferences: step.scriptReferences,
                apiCalls: step.apiCalls,
                componentReferences: step.componentReferences
            })),
            recommendations: this.generateFlowRecommendations(flow)
        };
    }

    getFlowsByTrigger(triggerTable) {
        const flows = this.triggerMappings.get(triggerTable) || [];
        
        return {
            triggerTable: triggerTable,
            flowCount: flows.length,
            flows: flows.map(flowId => {
                const flow = this.flows.get(flowId);
                return {
                    sys_id: flow.sys_id,
                    name: flow.name,
                    active: flow.active,
                    state: flow.state,
                    trigger_condition: flow.trigger_condition
                };
            })
        };
    }

    findFlowDependencies(flowName) {
        const flow = this.getFlow(flowName);
        const dependencies = {
            scriptIncludes: new Set(),
            tables: new Set(),
            subflows: new Set(),
            apis: new Set(),
            components: new Set()
        };
        
        // Analyze each step for dependencies
        flow.steps.forEach(step => {
            step.scriptReferences.forEach(ref => dependencies.scriptIncludes.add(ref));
            step.apiCalls.forEach(api => dependencies.apis.add(api));
            step.componentReferences.forEach(comp => dependencies.components.add(comp));
            
            // Check for subflow calls
            if (step.step_type === 'subflow') {
                dependencies.subflows.add(step.name);
            }
        });
        
        // Convert sets to arrays
        return {
            flow: flow.name,
            dependencies: {
                scriptIncludes: Array.from(dependencies.scriptIncludes),
                tables: Array.from(dependencies.tables),
                subflows: Array.from(dependencies.subflows),
                apis: Array.from(dependencies.apis),
                components: Array.from(dependencies.components)
            }
        };
    }

    getFlowPerformance(flowName) {
        const flow = this.getFlow(flowName);
        
        // Calculate performance metrics
        const metrics = {
            complexity: flow.complexity,
            stepCount: flow.steps.length,
            scriptStepCount: flow.steps.filter(s => s.script).length,
            conditionStepCount: flow.steps.filter(s => s.condition).length,
            estimatedRunTime: this.estimateFlowRunTime(flow),
            optimizationSuggestions: []
        };
        
        // Generate optimization suggestions
        if (metrics.stepCount > 20) {
            metrics.optimizationSuggestions.push('Consider breaking into subflows');
        }
        
        if (metrics.scriptStepCount > 5) {
            metrics.optimizationSuggestions.push('High script usage - consider Script Includes');
        }
        
        if (flow.steps.some(s => s.apiCalls.length > 0)) {
            metrics.optimizationSuggestions.push('API calls detected - check for rate limiting');
        }
        
        return {
            flow: flow.name,
            performance: metrics
        };
    }

    searchFlows(query) {
        const queryLower = query.toLowerCase();
        const results = [];
        
        for (const [key, flow] of this.flows) {
            if (typeof key !== 'string' || key.startsWith('sys_id_')) continue;
            
            const searchText = `
                ${flow.name || ''}
                ${flow.description || ''}
                ${flow.trigger_table || ''}
                ${flow.steps.map(s => s.name).join(' ')}
            `.toLowerCase();
            
            if (searchText.includes(queryLower)) {
                results.push({
                    name: flow.name,
                    sys_id: flow.sys_id,
                    active: flow.active,
                    trigger_table: flow.trigger_table,
                    complexity: flow.complexity,
                    matchedIn: this.getFlowMatchContext(flow, queryLower)
                });
            }
        }
        
        return results;
    }

    validateFlow(flowName) {
        const flow = this.getFlow(flowName);
        const issues = [];
        const warnings = [];
        
        // Check if flow is active
        if (!flow.active) {
            warnings.push('Flow is inactive');
        }
        
        // Check for steps with no sequence
        const unorderedSteps = flow.steps.filter(s => !s.sequence);
        if (unorderedSteps.length > 0) {
            issues.push(`${unorderedSteps.length} steps without sequence numbers`);
        }
        
        // Check for empty steps
        const emptySteps = flow.steps.filter(s => !s.script && !s.condition);
        if (emptySteps.length > 0) {
            warnings.push(`${emptySteps.length} steps without logic`);
        }
        
        // Check trigger configuration
        if (flow.trigger_type && !flow.trigger_table) {
            issues.push('Trigger type specified but no trigger table');
        }
        
        return {
            flow: flow.name,
            valid: issues.length === 0,
            issues: issues,
            warnings: warnings
        };
    }

    getFlowIntegrations(flowName) {
        const flow = this.getFlow(flowName);
        
        return {
            flow: flow.name,
            integrations: flow.integrations,
            trigger: flow.trigger_table,
            dependencies: this.findFlowDependencies(flowName).dependencies
        };
    }

    // Helper methods
    calculateFlowComplexity(flow) {
        let complexity = 0;
        
        complexity += flow.steps.length * 2;
        complexity += flow.steps.filter(s => s.script).length * 3;
        complexity += flow.steps.filter(s => s.condition).length * 2;
        complexity += (flow.variables?.length || 0);
        
        if (flow.trigger_condition) complexity += 2;
        
        if (complexity <= 10) return 'Low';
        if (complexity <= 25) return 'Medium';
        return 'High';
    }

    findFlowIntegrations(flow) {
        const integrations = [];
        
        // Check for REST API integrations
        flow.steps.forEach(step => {
            if (step.apiCalls.length > 0) {
                integrations.push({
                    type: 'REST API',
                    details: step.apiCalls
                });
            }
            
            if (step.componentReferences.length > 0) {
                integrations.push({
                    type: 'UI Component',
                    details: step.componentReferences
                });
            }
        });
        
        // Check for table integrations
        if (flow.trigger_table) {
            integrations.push({
                type: 'Database Table',
                details: [flow.trigger_table]
            });
        }
        
        return integrations;
    }

    estimateFlowRunTime(flow) {
        let estimatedMs = 0;
        
        flow.steps.forEach(step => {
            // Base step execution time
            estimatedMs += 100;
            
            // Script steps take longer
            if (step.script) {
                estimatedMs += 500;
            }
            
            // API calls add latency
            if (step.apiCalls.length > 0) {
                estimatedMs += step.apiCalls.length * 200;
            }
            
            // Conditional steps add processing time
            if (step.condition) {
                estimatedMs += 50;
            }
        });
        
        return `${estimatedMs}ms`;
    }

    generateFlowRecommendations(flow) {
        const recommendations = [];
        
        if (flow.steps.length > 15) {
            recommendations.push('Consider breaking this flow into smaller subflows');
        }
        
        if (flow.steps.filter(s => s.script).length > 3) {
            recommendations.push('High script usage - consider using Script Includes');
        }
        
        if (!flow.description) {
            recommendations.push('Add a description to document the flow purpose');
        }
        
        if (flow.steps.some(s => s.apiCalls.length > 2)) {
            recommendations.push('Multiple API calls detected - consider batch operations');
        }
        
        const scriptSteps = flow.steps.filter(s => s.script);
        if (scriptSteps.length > 0 && !scriptSteps.some(s => s.scriptReferences.length > 0)) {
            recommendations.push('Script steps found but no Script Include references - consider refactoring');
        }
        
        return recommendations;
    }

    getFlowMatchContext(flow, query) {
        const contexts = [];
        
        if (flow.name && flow.name.toLowerCase().includes(query)) {
            contexts.push('name');
        }
        if (flow.description && flow.description.toLowerCase().includes(query)) {
            contexts.push('description');
        }
        if (flow.trigger_table && flow.trigger_table.toLowerCase().includes(query)) {
            contexts.push('trigger table');
        }
        if (flow.steps.some(s => s.name && s.name.toLowerCase().includes(query))) {
            contexts.push('step names');
        }
        
        return contexts.join(', ') || 'content';
    }
}

module.exports = FlowAnalyzerAgent;