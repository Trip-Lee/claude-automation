#!/usr/bin/env node

/**
 * ServiceNow Agent System
 * Main launcher for the multi-agent analysis system
 */

const readline = require('readline');
const FlowOrchestratorAgent = require('./agents/orchestrator-agent');

class ServiceNowAgentSystem {
    constructor() {
        this.orchestrator = new FlowOrchestratorAgent();
        this.initialized = false;
        
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
        this.logHeader('ServiceNow Agent System - Initializing');
        
        try {
            await this.orchestrator.initialize();
            this.initialized = true;
            this.log('\nSystem ready! All agents initialized successfully.', 'green');
        } catch (error) {
            this.log(`Initialization failed: ${error.message}`, 'red');
            process.exit(1);
        }
    }

    async interactiveMenu() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (query) => new Promise(resolve => rl.question(query, resolve));

        while (true) {
            this.logHeader('ServiceNow Agent System - Main Menu');
            console.log('\n=== Story Analysis ===');
            console.log('1. Trace Story to Implementation');
            console.log('2. Validate Story Implementation');
            console.log('3. Generate Implementation Plan');
            console.log('4. Find Stories by Component');
            
            console.log('\n=== Component Analysis ===');
            console.log('5. Analyze Component Impact');
            console.log('6. Get Full Component Flow');
            console.log('7. Component Health Check');
            console.log('8. Component Dependencies');
            
            console.log('\n=== System Operations ===');
            console.log('9. System Health Status');
            console.log('10. Search Everything');
            
            console.log('\n0. Exit\n');

            const choice = await question('Enter your choice: ');

            try {
                switch (choice.trim()) {
                    case '1':
                        await this.traceStoryToImplementation(question);
                        break;

                    case '2':
                        await this.validateStoryImplementation(question);
                        break;

                    case '3':
                        await this.generateImplementationPlan(question);
                        break;

                    case '4':
                        await this.findStoriesByComponent(question);
                        break;

                    case '5':
                        await this.analyzeComponentImpact(question);
                        break;

                    case '6':
                        await this.getFullComponentFlow(question);
                        break;

                    case '7':
                        await this.componentHealthCheck(question);
                        break;

                    case '8':
                        await this.getComponentDependencies(question);
                        break;

                    case '9':
                        await this.getSystemHealth();
                        break;

                    case '10':
                        await this.searchEverything(question);
                        break;

                    case '0':
                        rl.close();
                        return;

                    default:
                        this.log('Invalid choice!', 'red');
                }
            } catch (error) {
                this.log(`Error: ${error.message}`, 'red');
            }

            await question('\nPress Enter to continue...');
        }
    }

    async traceStoryToImplementation(question) {
        const storyNumber = await question('Enter story number (e.g., STORY0001): ');
        
        this.log('\nTracing story to implementation...', 'yellow');
        
        const result = await this.orchestrator.process({
            type: 'trace_story_to_implementation',
            storyNumber: storyNumber.trim()
        });
        
        if (result.success) {
            this.displayImplementationTrace(result.result);
        } else {
            this.log(`Failed: ${result.error}`, 'red');
        }
    }

    async validateStoryImplementation(question) {
        const storyNumber = await question('Enter story number: ');
        
        this.log('\nValidating implementation...', 'yellow');
        
        const result = await this.orchestrator.process({
            type: 'validate_story_implementation',
            storyNumber: storyNumber.trim()
        });
        
        if (result.success) {
            this.displayValidationResults(result.result);
        } else {
            this.log(`Failed: ${result.error}`, 'red');
        }
    }

    async generateImplementationPlan(question) {
        const storyNumber = await question('Enter story number: ');
        
        this.log('\nGenerating implementation plan...', 'yellow');
        
        const result = await this.orchestrator.process({
            type: 'suggest_implementation_plan',
            storyNumber: storyNumber.trim()
        });
        
        if (result.success) {
            this.displayImplementationPlan(result.result);
        } else {
            this.log(`Failed: ${result.error}`, 'red');
        }
    }

    async findStoriesByComponent(question) {
        const componentName = await question('Enter component name: ');
        
        this.log('\nSearching for related stories...', 'yellow');
        
        const result = await this.orchestrator.queryAgent('story', {
            type: 'find_stories_by_component',
            componentName: componentName.trim()
        });
        
        if (result.success) {
            this.displayStoriesList(result.result);
        } else {
            this.log(`Failed: ${result.error}`, 'red');
        }
    }

    async analyzeComponentImpact(question) {
        const componentName = await question('Enter component name: ');
        
        this.log('\nAnalyzing component impact...', 'yellow');
        
        const result = await this.orchestrator.process({
            type: 'analyze_component_impact',
            componentName: componentName.trim()
        });
        
        if (result.success) {
            this.displayImpactAnalysis(result.result);
        } else {
            this.log(`Failed: ${result.error}`, 'red');
        }
    }

    async getFullComponentFlow(question) {
        const componentName = await question('Enter component name: ');
        
        this.log('\nGetting full component flow...', 'yellow');
        
        const result = await this.orchestrator.process({
            type: 'get_full_flow',
            componentName: componentName.trim()
        });
        
        if (result.success) {
            this.displayComponentFlow(result.result);
        } else {
            this.log(`Failed: ${result.error}`, 'red');
        }
    }

    async componentHealthCheck(question) {
        const componentName = await question('Enter component name: ');
        
        this.log('\nPerforming health check...', 'yellow');
        
        const result = await this.orchestrator.queryAgent('component', {
            type: 'suggest_refactoring',
            componentName: componentName.trim()
        });
        
        if (result.success) {
            this.displayHealthCheck(result.result);
        } else {
            this.log(`Failed: ${result.error}`, 'red');
        }
    }

    async getComponentDependencies(question) {
        const componentName = await question('Enter component name: ');
        
        this.log('\nAnalyzing dependencies...', 'yellow');
        
        const result = await this.orchestrator.queryAgent('component', {
            type: 'get_dependencies',
            componentName: componentName.trim()
        });
        
        if (result.success) {
            this.displayDependencies(result.result);
        } else {
            this.log(`Failed: ${result.error}`, 'red');
        }
    }

    async getSystemHealth() {
        this.log('\nChecking system health...', 'yellow');
        
        const result = await this.orchestrator.process({
            type: 'get_system_health'
        });
        
        if (result.success) {
            this.displaySystemHealth(result.result);
        } else {
            this.log(`Failed: ${result.error}`, 'red');
        }
    }

    async searchEverything(question) {
        const query = await question('Enter search term: ');
        
        this.log('\nSearching across all agents...', 'yellow');
        
        // Search in stories
        const storyResult = await this.orchestrator.queryAgent('story', {
            type: 'search_stories',
            query: query.trim()
        });
        
        // Search in components
        const componentResult = await this.orchestrator.queryAgent('component', {
            type: 'search_components',
            query: query.trim()
        });
        
        this.logSection('Search Results');
        
        if (storyResult.success && storyResult.result.length > 0) {
            this.log('\nStories:', 'green');
            storyResult.result.forEach(story => {
                this.log(`  - ${story.number}: ${story.title}`, 'dim');
            });
        }
        
        if (componentResult.success && componentResult.result.length > 0) {
            this.log('\nComponents:', 'green');
            componentResult.result.forEach(comp => {
                this.log(`  - ${comp.name} (${comp.repo})`, 'dim');
            });
        }
    }

    // Display helper methods
    displayImplementationTrace(trace) {
        this.logSection('Implementation Trace Results');
        
        this.log(`\nStory: ${trace.story.number} - ${trace.story.title}`, 'green');
        this.log(`State: ${trace.story.state}`, 'dim');
        
        if (trace.components.length > 0) {
            this.log('\nComponents:', 'cyan');
            trace.components.forEach(comp => {
                const statusColor = comp.status === 'Found' ? 'green' : 'yellow';
                this.log(`  - ${comp.name}: ${comp.status}`, statusColor);
                if (comp.action) {
                    this.log(`    Action: ${comp.action}`, 'dim');
                }
            });
        }
        
        if (trace.flows.length > 0) {
            this.log('\nData Flows:', 'cyan');
            trace.flows.forEach(flow => {
                this.log(`  ${flow.component}:`, 'blue');
                if (flow.apis.length > 0) {
                    this.log(`    APIs: ${flow.apis.join(', ')}`, 'dim');
                }
                if (flow.events.length > 0) {
                    this.log(`    Events: ${flow.events.join(', ')}`, 'dim');
                }
            });
        }
    }

    displayValidationResults(validation) {
        this.logSection('Validation Results');
        
        this.log(`\nStory: ${validation.story.number} - ${validation.story.title}`, 'green');
        
        const statusColor = validation.overallStatus === 'Complete' ? 'green' :
                           validation.overallStatus === 'Incomplete' ? 'yellow' : 'red';
        this.log(`Overall Status: ${validation.overallStatus}`, statusColor);
        
        if (validation.componentsStatus.length > 0) {
            this.log('\nComponent Validation:', 'cyan');
            validation.componentsStatus.forEach(comp => {
                const color = comp.valid ? 'green' : 'red';
                this.log(`  - ${comp.name}: ${comp.valid ? 'Valid' : 'Invalid'}`, color);
                if (comp.issues.length > 0) {
                    comp.issues.forEach(issue => {
                        this.log(`    Issue: ${issue}`, 'dim');
                    });
                }
            });
        }
        
        if (validation.missingPieces.length > 0) {
            this.log('\nMissing Pieces:', 'yellow');
            validation.missingPieces.forEach(piece => {
                this.log(`  - ${piece}`, 'dim');
            });
        }
    }

    displayImplementationPlan(plan) {
        this.logSection('Implementation Plan');
        
        this.log(`\nStory: ${plan.story.number} - ${plan.story.title}`, 'green');
        this.log(`Estimated Effort: ${plan.estimatedEffort}`, 'yellow');
        
        plan.phases.forEach(phase => {
            this.log(`\nPhase ${phase.phase}: ${phase.name}`, 'cyan');
            this.log(`Duration: ${phase.duration}`, 'dim');
            this.log('Tasks:', 'blue');
            phase.tasks.forEach(task => {
                this.log(`  - ${task}`, 'dim');
            });
        });
    }

    displayStoriesList(data) {
        this.logSection(`Stories for Component: ${data.component}`);
        
        this.log(`\nTotal Stories: ${data.storyCount}`, 'green');
        
        if (data.stories.length > 0) {
            this.log('\nStories:', 'cyan');
            data.stories.forEach(story => {
                this.log(`  ${story.number}: ${story.title}`, 'blue');
                this.log(`    State: ${story.state}, Priority: ${story.priority}`, 'dim');
            });
        }
    }

    displayImpactAnalysis(impact) {
        this.logSection(`Impact Analysis: ${impact.component}`);
        
        const riskColor = impact.riskLevel === 'Low' ? 'green' :
                         impact.riskLevel === 'Medium' ? 'yellow' : 'red';
        this.log(`\nRisk Level: ${impact.riskLevel}`, riskColor);
        
        this.log('\nDirect Impact:', 'cyan');
        this.log(`  Components: ${impact.directImpact.components.join(', ') || 'None'}`, 'dim');
        this.log(`  APIs: ${impact.directImpact.apis.join(', ') || 'None'}`, 'dim');
        
        this.log('\nIndirect Impact:', 'cyan');
        this.log(`  Stories: ${impact.indirectImpact.stories.length} affected`, 'dim');
        this.log(`  Child Components: ${impact.indirectImpact.childComponents.join(', ') || 'None'}`, 'dim');
    }

    displayComponentFlow(flow) {
        this.logSection(`Component Flow: ${flow.component.name}`);
        
        this.log(`\nRepository: ${flow.component.repo}`, 'green');
        this.log(`Path: ${flow.component.path}`, 'dim');
        
        this.log('\nData Flow:', 'cyan');
        this.log(`  Inputs (props): ${flow.dataFlow.inputs.join(', ') || 'None'}`, 'dim');
        this.log(`  Outputs (events): ${flow.dataFlow.outputs.join(', ') || 'None'}`, 'dim');
        this.log(`  API Calls: ${flow.dataFlow.apiCalls.join(', ') || 'None'}`, 'dim');
        
        if (flow.stories.length > 0) {
            this.log('\nRelated Stories:', 'cyan');
            flow.stories.forEach(story => {
                this.log(`  - ${story.number}: ${story.title}`, 'dim');
            });
        }
        
        if (flow.dependencies.length > 0) {
            this.log('\nDependency Chain:', 'cyan');
            this.log(`  ${flow.dependencies.join(' → ')}`, 'dim');
        }
    }

    displayHealthCheck(health) {
        this.logSection(`Component Health: ${health.component}`);
        
        const healthColor = health.overallHealth === 'Healthy' ? 'green' :
                           health.overallHealth === 'Fair' ? 'yellow' : 'red';
        this.log(`\nOverall Health: ${health.overallHealth}`, healthColor);
        
        if (health.suggestions.length > 0) {
            this.log('\nRecommendations:', 'cyan');
            health.suggestions.forEach(suggestion => {
                const severityColor = suggestion.severity === 'high' ? 'red' :
                                     suggestion.severity === 'medium' ? 'yellow' : 'dim';
                this.log(`  [${suggestion.severity.toUpperCase()}] ${suggestion.type}`, severityColor);
                this.log(`    ${suggestion.suggestion}`, 'dim');
            });
        } else {
            this.log('\nNo recommendations - component is healthy!', 'green');
        }
    }

    displayDependencies(deps) {
        this.logSection(`Dependencies: ${deps.component}`);
        
        this.log('\nDirect Dependencies:', 'cyan');
        if (deps.directDependencies.length > 0) {
            deps.directDependencies.forEach(dep => {
                this.log(`  - ${dep}`, 'dim');
            });
        } else {
            this.log('  None', 'dim');
        }
        
        this.log('\nUsed By:', 'cyan');
        if (deps.usedBy.length > 0) {
            deps.usedBy.forEach(comp => {
                this.log(`  - ${comp}`, 'dim');
            });
        } else {
            this.log('  None', 'dim');
        }
        
        this.log('\nAPI Dependencies:', 'cyan');
        if (deps.apiDependencies.length > 0) {
            deps.apiDependencies.forEach(api => {
                this.log(`  - ${api}`, 'dim');
            });
        } else {
            this.log('  None', 'dim');
        }
    }

    displaySystemHealth(health) {
        this.logSection('System Health Status');
        
        const healthColor = health.overall === 'Healthy' ? 'green' : 'yellow';
        this.log(`\nOverall Status: ${health.overall}`, healthColor);
        this.log(`Timestamp: ${health.timestamp}`, 'dim');
        
        this.log('\nAgent Status:', 'cyan');
        for (const [name, status] of Object.entries(health.agents)) {
            const statusColor = status.status === 'ready' ? 'green' : 'yellow';
            this.log(`  ${name}: ${status.status}`, statusColor);
            this.log(`    Tasks: ${status.metrics.tasksCompleted}, Cache: ${status.cacheSize} items`, 'dim');
        }
    }
}

// Main execution
async function main() {
    const system = new ServiceNowAgentSystem();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        // Interactive mode
        await system.initialize();
        await system.interactiveMenu();
    } else {
        // Command mode
        await system.initialize();
        
        const command = args[0];
        const target = args[1];
        
        try {
            switch (command) {
                case 'trace':
                    if (!target) {
                        console.error('Please provide a story number');
                        process.exit(1);
                    }
                    const traceResult = await system.orchestrator.process({
                        type: 'trace_story_to_implementation',
                        storyNumber: target
                    });
                    if (traceResult.success) {
                        system.displayImplementationTrace(traceResult.result);
                    }
                    break;
                    
                case 'validate':
                    if (!target) {
                        console.error('Please provide a story number');
                        process.exit(1);
                    }
                    const validateResult = await system.orchestrator.process({
                        type: 'validate_story_implementation',
                        storyNumber: target
                    });
                    if (validateResult.success) {
                        system.displayValidationResults(validateResult.result);
                    }
                    break;
                    
                case 'impact':
                    if (!target) {
                        console.error('Please provide a component name');
                        process.exit(1);
                    }
                    const impactResult = await system.orchestrator.process({
                        type: 'analyze_component_impact',
                        componentName: target
                    });
                    if (impactResult.success) {
                        system.displayImpactAnalysis(impactResult.result);
                    }
                    break;
                    
                case 'health':
                    const healthResult = await system.orchestrator.process({
                        type: 'get_system_health'
                    });
                    if (healthResult.success) {
                        system.displaySystemHealth(healthResult.result);
                    }
                    break;
                    
                default:
                    console.error(`Unknown command: ${command}`);
                    console.log('\nUsage:');
                    console.log('  node sn-agents.js                    - Interactive mode');
                    console.log('  node sn-agents.js trace <story>      - Trace story to implementation');
                    console.log('  node sn-agents.js validate <story>   - Validate story implementation');
                    console.log('  node sn-agents.js impact <component> - Analyze component impact');
                    console.log('  node sn-agents.js health             - System health check');
                    process.exit(1);
            }
        } catch (error) {
            system.log(`Error: ${error.message}`, 'red');
            process.exit(1);
        }
    }
}

// Run the system
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ServiceNowAgentSystem;