/**
 * Agent Orchestrator
 * Central coordinator for the multi-agent system
 */

const EventEmitter = require('events');
const { generateUUID } = require('../base/utils');

class AgentOrchestrator extends EventEmitter {
    constructor(config = {}) {
        super();

        this.id = 'orchestrator';
        this.config = config;

        // Agent registry
        this.agents = new Map(); // agentId -> agent instance
        this.agentsByType = new Map(); // agentType -> Set of agent instances
        this.agentCapabilities = new Map(); // capability -> Set of agent instances

        // Communication
        this.messageBus = null;
        this.stateManager = null;

        // Monitoring
        this.healthMonitor = null;
        this.metrics = {
            tasksRouted: 0,
            tasksCompleted: 0,
            tasksFailed: 0,
            agentsRegistered: 0,
            agentsUnregistered: 0,
            startTime: null
        };

        // Workflows
        this.workflows = new Map();
        this.activeWorkflows = new Map();

        // State
        this.initialized = false;
        this.running = false;
    }

    // ==================== Lifecycle ====================

    /**
     * Initialize the orchestrator
     * @param {Object} messageBus - Message bus instance
     * @param {Object} stateManager - State manager instance
     */
    async initialize(messageBus, stateManager) {
        console.log('[Orchestrator] Initializing...');

        this.messageBus = messageBus;
        this.stateManager = stateManager;
        this.metrics.startTime = Date.now();

        // Register orchestrator with message bus
        this.messageBus.registerAgent(this.id, this);

        // Subscribe to orchestrator messages
        await this.setupMessageHandlers();

        this.initialized = true;
        console.log('[Orchestrator] Initialized successfully');
    }

    /**
     * Start the orchestrator
     */
    async start() {
        if (!this.initialized) {
            throw new Error('Orchestrator must be initialized before starting');
        }

        console.log('[Orchestrator] Starting...');
        this.running = true;

        // Start health monitoring
        this.startHealthMonitoring();

        this.emit('started');
        console.log('[Orchestrator] Started successfully');
    }

    /**
     * Stop the orchestrator
     */
    async stop() {
        console.log('[Orchestrator] Stopping...');
        this.running = false;

        // Stop all agents
        for (const agent of this.agents.values()) {
            try {
                await agent.stop();
            } catch (error) {
                console.error(`[Orchestrator] Error stopping agent ${agent.name}:`, error);
            }
        }

        this.emit('stopped');
        console.log('[Orchestrator] Stopped successfully');
    }

    // ==================== Agent Management ====================

    /**
     * Register an agent
     * @param {Object} agent - Agent instance
     */
    async registerAgent(agent) {
        console.log(`[Orchestrator] Registering agent: ${agent.name} (${agent.type})`);

        // Store agent
        this.agents.set(agent.id, agent);

        // Index by type
        if (!this.agentsByType.has(agent.type)) {
            this.agentsByType.set(agent.type, new Set());
        }
        this.agentsByType.get(agent.type).add(agent);

        // Index by capabilities
        for (const capability of agent.capabilities) {
            if (!this.agentCapabilities.has(capability)) {
                this.agentCapabilities.set(capability, new Set());
            }
            this.agentCapabilities.get(capability).add(agent);
        }

        // Register agent with message bus
        this.messageBus.registerAgent(agent.id, agent);

        // Configure agent with message bus and orchestrator
        agent.messageBus = this.messageBus;
        agent.orchestratorId = this.id;

        this.metrics.agentsRegistered++;

        // Store in state manager
        await this.stateManager.set(`agent:${agent.id}`, {
            id: agent.id,
            name: agent.name,
            type: agent.type,
            capabilities: agent.capabilities,
            registeredAt: Date.now()
        }, { namespace: 'orchestrator' });

        this.emit('agent-registered', { agent });
        console.log(`[Orchestrator] Agent registered: ${agent.name}`);
    }

    /**
     * Unregister an agent
     * @param {string} agentId - Agent ID
     */
    async unregisterAgent(agentId) {
        const agent = this.agents.get(agentId);

        if (!agent) {
            console.warn(`[Orchestrator] Agent not found: ${agentId}`);
            return;
        }

        console.log(`[Orchestrator] Unregistering agent: ${agent.name}`);

        // Remove from indices
        this.agents.delete(agentId);
        this.agentsByType.get(agent.type)?.delete(agent);

        for (const capability of agent.capabilities) {
            this.agentCapabilities.get(capability)?.delete(agent);
        }

        // Unregister from message bus
        this.messageBus.unregisterAgent(agentId);

        // Remove from state manager
        await this.stateManager.delete(`agent:${agentId}`, { namespace: 'orchestrator' });

        this.metrics.agentsUnregistered++;
        this.emit('agent-unregistered', { agentId });
    }

    /**
     * Get agent by ID
     * @param {string} agentId - Agent ID
     * @returns {Object|null} Agent instance
     */
    getAgent(agentId) {
        return this.agents.get(agentId) || null;
    }

    /**
     * Get agents by type
     * @param {string} type - Agent type
     * @returns {Array} Array of agent instances
     */
    getAgentsByType(type) {
        return Array.from(this.agentsByType.get(type) || []);
    }

    /**
     * Get agents by capability
     * @param {string} capability - Capability name
     * @returns {Array} Array of agent instances
     */
    getAgentsByCapability(capability) {
        return Array.from(this.agentCapabilities.get(capability) || []);
    }

    // ==================== Task Routing ====================

    /**
     * Route a task to the appropriate agent
     * @param {Object} task - Task to route
     * @returns {Promise<any>} Task result
     */
    async routeTask(task) {
        console.log(`[Orchestrator] Routing task: ${task.action}`);
        this.metrics.tasksRouted++;

        try {
            // Determine target agent type
            const targetAgentType = this.determineAgentType(task);

            if (!targetAgentType) {
                throw new Error(`No agent type found for task action: ${task.action}`);
            }

            // Select best agent
            const agent = await this.selectAgent(targetAgentType, task);

            if (!agent) {
                throw new Error(`No available agent of type: ${targetAgentType}`);
            }

            // Send task to agent
            const result = await this.sendTaskToAgent(agent, task);

            this.metrics.tasksCompleted++;
            return result;
        } catch (error) {
            this.metrics.tasksFailed++;
            console.error(`[Orchestrator] Task routing failed:`, error);
            throw error;
        }
    }

    /**
     * Determine which agent type should handle a task
     * @private
     */
    determineAgentType(task) {
        const actionMappings = {
            // Record operations
            'create-record': 'record-ops',
            'update-record': 'record-ops',
            'delete-record': 'record-ops',
            'validate-record': 'validation',

            // Schema operations
            'get-schema': 'schema',
            'get-fields': 'schema',

            // AI operations
            'ai-generate': 'ai',
            'ai-enhance': 'ai',
            'ai-analyze': 'ai',

            // File operations
            'watch-files': 'file-watch',
            'sync-file': 'file-watch',

            // Dependency operations
            'track-dependency': 'dependency',
            'analyze-impact': 'dependency',

            // Config operations
            'get-config': 'config',
            'update-config': 'config'
        };

        return actionMappings[task.action] || null;
    }

    /**
     * Select the best agent to handle a task
     * @private
     */
    async selectAgent(agentType, task) {
        const agents = this.getAgentsByType(agentType);

        if (agents.length === 0) {
            return null;
        }

        // If only one agent, return it
        if (agents.length === 1) {
            return agents[0];
        }

        // Load balancing: select least busy agent
        const agentLoads = await Promise.all(
            agents.map(async (agent) => ({
                agent,
                load: await this.calculateAgentLoad(agent)
            }))
        );

        // Filter out unhealthy agents
        const healthyAgents = agentLoads.filter(({ agent }) =>
            agent.state !== 'error' && agent.state !== 'stopped'
        );

        if (healthyAgents.length === 0) {
            // No healthy agents, try any agent
            return agents[0];
        }

        // Sort by load (ascending)
        healthyAgents.sort((a, b) => a.load - b.load);

        // Return agent with lowest load
        return healthyAgents[0].agent;
    }

    /**
     * Calculate agent load
     * @private
     */
    async calculateAgentLoad(agent) {
        try {
            const health = await agent.healthCheck();

            // Busy agents have higher load
            if (health.state === 'busy') {
                return 100;
            }

            // Base load on queue size
            return health.queueSize || 0;
        } catch (error) {
            console.error(`[Orchestrator] Error checking agent health:`, error);
            return 1000; // High load if health check fails
        }
    }

    /**
     * Send a task to a specific agent
     * @private
     */
    async sendTaskToAgent(agent, task) {
        console.log(`[Orchestrator] Sending task to agent: ${agent.name}`);

        const message = {
            id: generateUUID(),
            type: 'request',
            from: this.id,
            fromName: 'Orchestrator',
            to: agent.id,
            payload: task,
            timestamp: Date.now(),
            correlationId: generateUUID(),
            priority: task.priority || 5,
            requiresAck: true,
            timeout: task.timeout || 30000
        };

        try {
            const response = await this.messageBus.send(message);
            return response;
        } catch (error) {
            console.error(`[Orchestrator] Failed to send task to ${agent.name}:`, error);
            throw error;
        }
    }

    // ==================== Workflow Management ====================

    /**
     * Register a workflow
     * @param {string} name - Workflow name
     * @param {Object} workflow - Workflow definition
     */
    registerWorkflow(name, workflow) {
        this.workflows.set(name, workflow);
        console.log(`[Orchestrator] Workflow registered: ${name}`);
    }

    /**
     * Execute a workflow
     * @param {string} workflowName - Workflow name
     * @param {Object} params - Workflow parameters
     * @returns {Promise<Object>} Workflow results
     */
    async executeWorkflow(workflowName, params = {}) {
        const workflow = this.workflows.get(workflowName);

        if (!workflow) {
            throw new Error(`Unknown workflow: ${workflowName}`);
        }

        const workflowId = generateUUID();
        console.log(`[Orchestrator] Executing workflow: ${workflowName} (${workflowId})`);

        const context = {
            workflowId,
            workflowName,
            startTime: Date.now(),
            params,
            results: {},
            errors: []
        };

        this.activeWorkflows.set(workflowId, context);

        try {
            // Execute workflow steps
            for (let i = 0; i < workflow.steps.length; i++) {
                const step = workflow.steps[i];

                console.log(`[Orchestrator] Executing workflow step ${i + 1}/${workflow.steps.length}: ${step.name}`);

                try {
                    const result = await this.executeWorkflowStep(step, context);
                    context.results[step.name] = result;
                } catch (error) {
                    console.error(`[Orchestrator] Workflow step failed: ${step.name}`, error);
                    context.errors.push({ step: step.name, error: error.message });

                    if (step.optional) {
                        console.log(`[Orchestrator] Step ${step.name} is optional, continuing...`);
                        continue;
                    } else {
                        throw new Error(`Workflow failed at step ${step.name}: ${error.message}`);
                    }
                }
            }

            context.endTime = Date.now();
            context.duration = context.endTime - context.startTime;
            context.success = true;

            console.log(`[Orchestrator] Workflow completed: ${workflowName} (${context.duration}ms)`);

            return context;
        } catch (error) {
            context.endTime = Date.now();
            context.duration = context.endTime - context.startTime;
            context.success = false;
            context.error = error.message;

            console.error(`[Orchestrator] Workflow failed: ${workflowName}`, error);

            throw error;
        } finally {
            this.activeWorkflows.delete(workflowId);
        }
    }

    /**
     * Execute a single workflow step
     * @private
     */
    async executeWorkflowStep(step, context) {
        // Resolve payload variables
        const payload = this.resolvePayload(step.payload, context);

        // Create task
        const task = {
            action: step.action,
            ...payload,
            workflowId: context.workflowId,
            stepName: step.name
        };

        // Route task to appropriate agent
        const result = await this.routeTask(task);

        return result;
    }

    /**
     * Resolve variables in payload
     * @private
     */
    resolvePayload(payload, context) {
        if (typeof payload === 'string' && payload.startsWith('$')) {
            // Variable reference: $params.table or $results.step-name.field
            const path = payload.substring(1).split('.');
            let value = path[0] === 'params' ? context.params : context.results;

            for (let i = 1; i < path.length; i++) {
                value = value?.[path[i]];
            }

            return value;
        } else if (typeof payload === 'object' && !Array.isArray(payload)) {
            // Recursively resolve object properties
            const resolved = {};
            for (const [key, val] of Object.entries(payload)) {
                resolved[key] = this.resolvePayload(val, context);
            }
            return resolved;
        } else if (Array.isArray(payload)) {
            // Recursively resolve array elements
            return payload.map(item => this.resolvePayload(item, context));
        }

        return payload;
    }

    // ==================== Health Monitoring ====================

    /**
     * Start health monitoring loop
     */
    startHealthMonitoring() {
        const interval = this.config.healthCheckInterval || 10000;

        const checkHealth = async () => {
            if (!this.running) {
                return;
            }

            try {
                await this.performHealthCheck();
            } catch (error) {
                console.error('[Orchestrator] Health check failed:', error);
            }

            setTimeout(checkHealth, interval);
        };

        checkHealth();
    }

    /**
     * Perform health check on all agents
     */
    async performHealthCheck() {
        const healthReports = [];

        for (const agent of this.agents.values()) {
            try {
                const health = await agent.healthCheck();
                healthReports.push(health);

                // Store in state manager
                await this.stateManager.set(`agent:${agent.id}:health`, health, {
                    namespace: 'orchestrator',
                    ttl: 30000
                });
            } catch (error) {
                console.error(`[Orchestrator] Health check failed for ${agent.name}:`, error);
            }
        }

        // Emit health report
        this.emit('health-check-completed', { agents: healthReports });

        return healthReports;
    }

    // ==================== Message Handling ====================

    /**
     * Setup message handlers
     */
    async setupMessageHandlers() {
        // Listen for messages to orchestrator
        this.messageBus.on('message-to-orchestrator', async (message) => {
            await this.handleMessage(message);
        });
    }

    /**
     * Handle incoming message
     */
    async handleMessage(message) {
        const { payload } = message;

        try {
            let result;

            switch (payload.action) {
                case 'register-agent':
                    // Agent registration is handled separately
                    result = { success: true, message: 'Agent registered' };
                    break;

                case 'unregister-agent':
                    await this.unregisterAgent(payload.agentId);
                    result = { success: true, message: 'Agent unregistered' };
                    break;

                case 'route-task':
                    result = await this.routeTask(payload.task);
                    break;

                case 'execute-workflow':
                    result = await this.executeWorkflow(payload.workflowName, payload.params);
                    break;

                case 'get-agents':
                    result = this.getAgentsList();
                    break;

                case 'get-stats':
                    result = this.getStats();
                    break;

                default:
                    throw new Error(`Unknown action: ${payload.action}`);
            }

            // Send response
            if (message.requiresAck) {
                const response = {
                    id: generateUUID(),
                    type: 'response',
                    from: this.id,
                    to: message.from,
                    payload: result,
                    correlationId: message.correlationId,
                    timestamp: Date.now()
                };

                await this.messageBus.send(response);
            }
        } catch (error) {
            console.error('[Orchestrator] Error handling message:', error);

            if (message.requiresAck) {
                const response = {
                    id: generateUUID(),
                    type: 'response',
                    from: this.id,
                    to: message.from,
                    error: error.message,
                    correlationId: message.correlationId,
                    timestamp: Date.now()
                };

                await this.messageBus.send(response);
            }
        }
    }

    /**
     * Receive message (for compatibility with message bus)
     */
    async receiveMessage(message) {
        await this.handleMessage(message);
    }

    // ==================== Statistics ====================

    /**
     * Get orchestrator statistics
     */
    getStats() {
        return {
            uptime: Date.now() - this.metrics.startTime,
            agents: {
                total: this.agents.size,
                byType: Array.from(this.agentsByType.entries()).map(([type, agents]) => ({
                    type,
                    count: agents.size
                })),
                registered: this.metrics.agentsRegistered,
                unregistered: this.metrics.agentsUnregistered
            },
            tasks: {
                routed: this.metrics.tasksRouted,
                completed: this.metrics.tasksCompleted,
                failed: this.metrics.tasksFailed,
                successRate: this.metrics.tasksRouted > 0
                    ? (this.metrics.tasksCompleted / this.metrics.tasksRouted * 100).toFixed(2) + '%'
                    : 'N/A'
            },
            workflows: {
                registered: this.workflows.size,
                active: this.activeWorkflows.size
            }
        };
    }

    /**
     * Get list of agents
     */
    getAgentsList() {
        return Array.from(this.agents.values()).map(agent => ({
            id: agent.id,
            name: agent.name,
            type: agent.type,
            state: agent.state,
            capabilities: agent.capabilities
        }));
    }
}

module.exports = { AgentOrchestrator };
