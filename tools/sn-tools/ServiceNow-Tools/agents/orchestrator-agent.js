/**
 * Flow Orchestrator Agent
 * Coordinates between all agents to provide comprehensive flow analysis
 * Acts as the main controller for complex multi-agent operations
 */

const BaseAgent = require('./base-agent');
const StoryAnalyzerAgent = require('./story-agent');
const ComponentAnalyzerAgent = require('./component-agent');
const EventEmitter = require('events');

class FlowOrchestratorAgent extends BaseAgent {
    constructor(config = {}) {
        super('FlowOrchestrator', config);
        
        this.agents = new Map();
        this.workflows = new Map();
        this.activeFlows = new Map();
        
        // Message bus for inter-agent communication
        this.messageBus = new EventEmitter();
        
        // Initialize child agents
        this.initializeAgents();
    }

    initializeAgents() {
        // Create agent instances
        const storyAgent = new StoryAnalyzerAgent();
        const componentAgent = new ComponentAnalyzerAgent();
        
        // Register agents
        this.registerAgent('story', storyAgent);
        this.registerAgent('component', componentAgent);
        
        // Set up message bus for all agents
        this.agents.forEach(agent => {
            agent.messageBus = this.messageBus;
        });
    }

    registerAgent(name, agent) {
        this.agents.set(name, agent);
        
        // Set up message routing
        this.messageBus.on(`message-to-${name}`, async (message) => {
            const response = await agent.process(message.request);
            this.messageBus.emit(`response-${message.id}`, response);
        });
    }

    async loadData() {
        this.log('Initializing all agents...', 'yellow');
        
        // Initialize all agents in parallel
        const initPromises = Array.from(this.agents.values()).map(agent => 
            agent.initialize()
        );
        
        await Promise.all(initPromises);
        
        this.log('All agents initialized', 'green');
    }

    async handleRequest(request) {
        switch (request.type) {
            case 'trace_story_to_implementation':
                return this.traceStoryToImplementation(request.storyNumber);
                
            case 'analyze_component_impact':
                return this.analyzeComponentImpact(request.componentName);
                
            case 'get_full_flow':
                return this.getFullFlow(request.componentName);
                
            case 'validate_story_implementation':
                return this.validateStoryImplementation(request.storyNumber);
                
            case 'suggest_implementation_plan':
                return this.suggestImplementationPlan(request.storyNumber);
                
            case 'get_system_health':
                return this.getSystemHealth();
                
            default:
                throw new Error(`Unknown request type: ${request.type}`);
        }
    }

    async traceStoryToImplementation(storyNumber) {
        this.log(`Tracing story ${storyNumber} to implementation...`, 'cyan');
        
        // Get story details from Story Agent
        const storyResponse = await this.queryAgent('story', {
            type: 'analyze_story',
            storyNumber: storyNumber
        });
        
        if (!storyResponse.success) {
            throw new Error(`Failed to get story: ${storyResponse.error}`);
        }
        
        const story = storyResponse.result;
        const implementation = {
            story: {
                number: story.number,
                title: story.title,
                state: story.state
            },
            components: [],
            flows: []
        };
        
        // Analyze each component mentioned in the story
        for (const componentName of story.analysis.components) {
            const componentResponse = await this.queryAgent('component', {
                type: 'analyze_component',
                componentName: componentName
            });
            
            if (componentResponse.success) {
                implementation.components.push({
                    name: componentResponse.result.name,
                    status: 'Found',
                    details: componentResponse.result
                });
                
                // Create flow for this component
                implementation.flows.push({
                    component: componentName,
                    apis: componentResponse.result.apiCalls,
                    events: componentResponse.result.events
                });
            } else {
                implementation.components.push({
                    name: componentName,
                    status: 'Not Found',
                    action: 'Needs to be created'
                });
            }
        }
        
        return implementation;
    }

    async analyzeComponentImpact(componentName) {
        this.log(`Analyzing impact of changes to ${componentName}...`, 'cyan');
        
        // Get component details
        const componentResponse = await this.queryAgent('component', {
            type: 'get_dependencies',
            componentName: componentName
        });
        
        if (!componentResponse.success) {
            throw new Error(`Failed to analyze component: ${componentResponse.error}`);
        }
        
        const dependencies = componentResponse.result;
        
        // Find stories that might be affected
        const affectedStories = [];
        for (const usedBy of dependencies.usedBy) {
            const storiesResponse = await this.queryAgent('story', {
                type: 'find_stories_by_component',
                componentName: usedBy
            });
            
            if (storiesResponse.success && storiesResponse.result.stories) {
                affectedStories.push(...storiesResponse.result.stories);
            }
        }
        
        return {
            component: componentName,
            directImpact: {
                components: dependencies.usedBy,
                apis: dependencies.apiDependencies
            },
            indirectImpact: {
                stories: affectedStories,
                childComponents: dependencies.childComponents
            },
            riskLevel: this.assessRiskLevel(dependencies)
        };
    }

    async getFullFlow(componentName) {
        this.log(`Getting full flow for ${componentName}...`, 'cyan');
        
        // Get component details
        const componentResponse = await this.queryAgent('component', {
            type: 'get_component',
            componentName: componentName
        });
        
        if (!componentResponse.success) {
            throw new Error(`Component not found: ${componentResponse.error}`);
        }
        
        const component = componentResponse.result;
        
        // Get related stories
        const storiesResponse = await this.queryAgent('story', {
            type: 'find_stories_by_component',
            componentName: componentName
        });
        
        const flow = {
            component: {
                name: component.name,
                repo: component.repo,
                path: component.path
            },
            dataFlow: {
                inputs: component.props,
                outputs: component.events,
                apiCalls: component.apiCalls,
                stateManagement: component.stateManagement
            },
            stories: storiesResponse.success ? storiesResponse.result.stories : [],
            dependencies: await this.getDependencyChain(componentName)
        };
        
        return flow;
    }

    async validateStoryImplementation(storyNumber) {
        this.log(`Validating implementation for story ${storyNumber}...`, 'cyan');
        
        // Get story details
        const storyResponse = await this.queryAgent('story', {
            type: 'get_implementation_guide',
            storyNumber: storyNumber
        });
        
        if (!storyResponse.success) {
            throw new Error(`Failed to get story: ${storyResponse.error}`);
        }
        
        const guide = storyResponse.result;
        const validation = {
            story: guide.story,
            componentsStatus: [],
            apisStatus: [],
            overallStatus: 'Unknown',
            missingPieces: []
        };
        
        // Validate components
        for (const componentName of guide.components) {
            const componentResponse = await this.queryAgent('component', {
                type: 'validate_component',
                componentName: componentName
            });
            
            if (componentResponse.success) {
                validation.componentsStatus.push({
                    name: componentName,
                    valid: componentResponse.result.valid,
                    issues: componentResponse.result.issues
                });
            } else {
                validation.missingPieces.push(`Component: ${componentName}`);
            }
        }
        
        // Determine overall status
        const allComponentsValid = validation.componentsStatus.every(c => c.valid);
        const hasMissingPieces = validation.missingPieces.length > 0;
        
        if (allComponentsValid && !hasMissingPieces) {
            validation.overallStatus = 'Complete';
        } else if (hasMissingPieces) {
            validation.overallStatus = 'Incomplete';
        } else {
            validation.overallStatus = 'Has Issues';
        }
        
        return validation;
    }

    async suggestImplementationPlan(storyNumber) {
        this.log(`Generating implementation plan for story ${storyNumber}...`, 'cyan');
        
        // Get story implementation guide
        const guideResponse = await this.queryAgent('story', {
            type: 'get_implementation_guide',
            storyNumber: storyNumber
        });
        
        if (!guideResponse.success) {
            throw new Error(`Failed to get story: ${guideResponse.error}`);
        }
        
        const guide = guideResponse.result;
        const plan = {
            story: guide.story,
            phases: [],
            estimatedEffort: '',
            dependencies: []
        };
        
        // Phase 1: Component Analysis
        plan.phases.push({
            phase: 1,
            name: 'Analysis',
            tasks: [
                'Review story requirements',
                'Identify affected components',
                'Check existing implementations'
            ],
            duration: '2-4 hours'
        });
        
        // Phase 2: Frontend Implementation
        if (guide.components.length > 0) {
            const componentTasks = [];
            for (const comp of guide.components) {
                const exists = await this.componentExists(comp);
                if (exists) {
                    componentTasks.push(`Update ${comp} component`);
                } else {
                    componentTasks.push(`Create ${comp} component`);
                }
            }
            
            plan.phases.push({
                phase: 2,
                name: 'Frontend Development',
                tasks: componentTasks,
                duration: `${guide.components.length * 4}-${guide.components.length * 8} hours`
            });
        }
        
        // Phase 3: Testing
        plan.phases.push({
            phase: 3,
            name: 'Testing',
            tasks: [
                'Unit tests for components',
                'Integration testing',
                'User acceptance testing'
            ],
            duration: '4-8 hours'
        });
        
        // Calculate total effort
        const minHours = plan.phases.reduce((sum, p) => {
            const match = p.duration.match(/(\d+)/);
            return sum + (match ? parseInt(match[1]) : 0);
        }, 0);
        
        plan.estimatedEffort = `${minHours}-${minHours * 2} hours`;
        
        return plan;
    }

    async getSystemHealth() {
        const health = {
            timestamp: new Date().toISOString(),
            agents: {},
            overall: 'Unknown'
        };
        
        // Get status from all agents
        for (const [name, agent] of this.agents) {
            health.agents[name] = agent.getStatus();
        }
        
        // Calculate overall health
        const allReady = Object.values(health.agents).every(a => a.status === 'ready');
        health.overall = allReady ? 'Healthy' : 'Degraded';
        
        return health;
    }

    // Helper methods
    async queryAgent(agentName, request) {
        const agent = this.agents.get(agentName);
        if (!agent) {
            return {
                success: false,
                error: `Agent ${agentName} not found`
            };
        }
        
        return agent.process(request);
    }

    async componentExists(componentName) {
        const response = await this.queryAgent('component', {
            type: 'get_component',
            componentName: componentName
        });
        return response.success;
    }

    async getDependencyChain(componentName, depth = 0, maxDepth = 3) {
        if (depth >= maxDepth) return [];
        
        const response = await this.queryAgent('component', {
            type: 'get_dependencies',
            componentName: componentName
        });
        
        if (!response.success) return [];
        
        const chain = [componentName];
        for (const dep of response.result.directDependencies || []) {
            const subChain = await this.getDependencyChain(dep, depth + 1, maxDepth);
            chain.push(...subChain);
        }
        
        return chain;
    }

    assessRiskLevel(dependencies) {
        const impactScore = 
            dependencies.usedBy.length * 3 +
            dependencies.apiDependencies.length * 2 +
            dependencies.childComponents.length;
        
        if (impactScore <= 5) return 'Low';
        if (impactScore <= 15) return 'Medium';
        return 'High';
    }
}

module.exports = FlowOrchestratorAgent;