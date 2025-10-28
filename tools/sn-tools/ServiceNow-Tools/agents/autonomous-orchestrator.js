/**
 * Autonomous Agent Orchestrator
 * Manages and coordinates autonomous agents with decision-making capabilities
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const BaseAgent = require('./base-agent');

class AutonomousOrchestrator extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            maxConcurrentAgents: 5,
            decisionThreshold: 0.7,
            learningEnabled: true,
            autoStart: false,
            monitoringInterval: 10000,
            ...config
        };
        
        this.agents = new Map();
        this.runningAgents = new Set();
        this.taskQueue = [];
        this.decisionHistory = [];
        this.knowledgeBase = new Map();
        this.isRunning = false;
        
        // Autonomy control
        this.autonomyEnabled = false;
        this.globalConfig = null;
        this.autonomyConfigPath = path.join(__dirname, '..', 'sn-config.json');
        
        this.metrics = {
            startTime: Date.now(),
            tasksProcessed: 0,
            decisionsMade: 0,
            autonomousActions: 0,
            successRate: 100
        };
    }

    /**
     * Initialize the orchestrator
     */
    async initialize() {
        console.log('[Orchestrator] Initializing autonomous agent system...');
        
        // Load autonomy configuration
        await this.loadAutonomyConfig();
        
        // Create necessary directories
        await this.ensureDirectories();
        
        // Load knowledge base
        await this.loadKnowledgeBase();
        
        // Register default agents
        await this.registerDefaultAgents();
        
        // Setup event handlers
        this.setupEventHandlers();
        
        if (this.config.autoStart) {
            await this.start();
        }
        
        console.log('[Orchestrator] Initialization complete');
    }

    /**
     * Ensure required directories exist
     */
    async ensureDirectories() {
        const dirs = [
            path.join(__dirname, '..', 'logs'),
            path.join(__dirname, '..', 'agent-configs'),
            path.join(__dirname, '..', 'agent-rules'),
            path.join(__dirname, '..', 'knowledge-base')
        ];
        
        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (err) {
                // Directory might already exist
            }
        }
    }

    /**
     * Load knowledge base from persistent storage
     */
    async loadKnowledgeBase() {
        const kbPath = path.join(__dirname, '..', 'knowledge-base', 'orchestrator.json');
        try {
            const data = await fs.readFile(kbPath, 'utf8');
            const kb = JSON.parse(data);
            
            // Convert arrays back to Maps
            this.knowledgeBase = new Map(kb.knowledge || []);
            this.decisionHistory = kb.decisionHistory || [];
            
            console.log(`[Orchestrator] Loaded knowledge base with ${this.knowledgeBase.size} entries`);
        } catch (err) {
            console.log('[Orchestrator] No existing knowledge base found, starting fresh');
        }
    }

    /**
     * Save knowledge base to persistent storage
     */
    async saveKnowledgeBase() {
        const kbPath = path.join(__dirname, '..', 'knowledge-base', 'orchestrator.json');
        const data = {
            knowledge: Array.from(this.knowledgeBase.entries()),
            decisionHistory: this.decisionHistory.slice(-1000), // Keep last 1000 decisions
            lastSaved: new Date().toISOString()
        };
        
        await fs.writeFile(kbPath, JSON.stringify(data, null, 2));
    }

    /**
     * Load autonomy configuration from global config
     */
    async loadAutonomyConfig() {
        try {
            const configData = await fs.readFile(this.autonomyConfigPath, 'utf8');
            this.globalConfig = JSON.parse(configData);
            
            if (this.globalConfig.autonomy) {
                this.autonomyEnabled = this.globalConfig.autonomy.enabled && !this.globalConfig.autonomy.emergencyDisable;
                
                // Override config thresholds if specified
                if (this.globalConfig.autonomy.confidenceThreshold) {
                    this.config.decisionThreshold = this.globalConfig.autonomy.confidenceThreshold;
                }
                
                console.log(`[Orchestrator] Autonomy ${this.autonomyEnabled ? 'ENABLED' : 'DISABLED'}`);
            }
        } catch (err) {
            console.log('[Orchestrator] No global autonomy config found, using defaults');
            this.autonomyEnabled = false;
        }
    }

    /**
     * Check if autonomy is currently enabled
     */
    isAutonomyEnabled() {
        return this.autonomyEnabled && !this.globalConfig?.autonomy?.emergencyDisable;
    }

    /**
     * Toggle autonomy on/off
     */
    async toggleAutonomy(enabled, reason = '', user = 'system') {
        const wasEnabled = this.autonomyEnabled;
        this.autonomyEnabled = enabled;
        
        // Update global config
        if (this.globalConfig && this.globalConfig.autonomy) {
            this.globalConfig.autonomy.enabled = enabled;
            this.globalConfig.autonomy.lastToggled = new Date().toISOString();
            this.globalConfig.autonomy.toggledBy = user;
            
            try {
                await fs.writeFile(this.autonomyConfigPath, JSON.stringify(this.globalConfig, null, 2));
            } catch (err) {
                console.error('[Orchestrator] Failed to save autonomy config:', err);
            }
        }
        
        console.log(`[Orchestrator] Autonomy ${enabled ? 'ENABLED' : 'DISABLED'} by ${user}${reason ? ': ' + reason : ''}`);
        
        // Notify agents of autonomy change
        for (const [name, agent] of this.agents) {
            if (agent.config && agent.config.autonomous) {
                agent.config.autonomous.enabled = enabled;
                agent.emit('autonomy_changed', { enabled, reason, user });
            }
        }
        
        this.emit('autonomy_toggled', { enabled, wasEnabled, reason, user });
        
        // If disabling, clear pending autonomous actions
        if (!enabled && wasEnabled) {
            await this.pauseAutonomousActions();
        }
    }

    /**
     * Emergency disable autonomy
     */
    async emergencyDisableAutonomy(reason = 'Emergency stop') {
        console.log(`[Orchestrator] *** EMERGENCY AUTONOMY DISABLE *** - ${reason}`);
        
        if (this.globalConfig && this.globalConfig.autonomy) {
            this.globalConfig.autonomy.emergencyDisable = true;
            this.globalConfig.autonomy.enabled = false;
            this.globalConfig.autonomy.lastToggled = new Date().toISOString();
            this.globalConfig.autonomy.toggledBy = 'EMERGENCY_SYSTEM';
            
            try {
                await fs.writeFile(this.autonomyConfigPath, JSON.stringify(this.globalConfig, null, 2));
            } catch (err) {
                console.error('[Orchestrator] Failed to save emergency config:', err);
            }
        }
        
        this.autonomyEnabled = false;
        await this.pauseAutonomousActions();
        this.emit('emergency_disable', { reason });
    }

    /**
     * Pause all autonomous actions
     */
    async pauseAutonomousActions() {
        console.log('[Orchestrator] Pausing all autonomous actions...');
        
        // Stop all agents' autonomous operations
        for (const [name, agent] of this.agents) {
            if (agent.autonomousConfig && agent.autonomousConfig.enabled) {
                agent.autonomousConfig.enabled = false;
                if (agent.decisionLoop) {
                    clearInterval(agent.decisionLoop);
                }
                console.log(`[Orchestrator] Paused autonomous operations for agent: ${name}`);
            }
        }
        
        // Clear task queue of autonomous tasks
        const manualTasks = this.taskQueue.filter(task => !task.autonomous);
        const removedCount = this.taskQueue.length - manualTasks.length;
        this.taskQueue = manualTasks;
        
        if (removedCount > 0) {
            console.log(`[Orchestrator] Removed ${removedCount} autonomous tasks from queue`);
        }
    }

    /**
     * Register default autonomous agents
     */
    async registerDefaultAgents() {
        // Monitor Agent - Watches for changes and anomalies
        await this.registerAgent('monitor', {
            type: 'MonitorAgent',
            capabilities: ['file-watch', 'error-detection', 'pattern-recognition'],
            autonomous: {
                enabled: true,
                confidenceThreshold: 0.6,
                actions: ['alert', 'auto-fix', 'escalate']
            }
        });

        // Analyzer Agent - Analyzes data and makes recommendations
        await this.registerAgent('analyzer', {
            type: 'AnalyzerAgent',
            capabilities: ['data-analysis', 'dependency-tracking', 'impact-assessment'],
            autonomous: {
                enabled: true,
                confidenceThreshold: 0.7,
                actions: ['analyze', 'recommend', 'optimize']
            }
        });

        // Executor Agent - Executes approved actions
        await this.registerAgent('executor', {
            type: 'ExecutorAgent',
            capabilities: ['update', 'deploy', 'rollback', 'test'],
            autonomous: {
                enabled: true,
                confidenceThreshold: 0.8,
                actions: ['execute', 'validate', 'report']
            }
        });

        // Learner Agent - Learns from outcomes and improves decision-making
        await this.registerAgent('learner', {
            type: 'LearnerAgent',
            capabilities: ['pattern-learning', 'outcome-analysis', 'strategy-optimization'],
            autonomous: {
                enabled: true,
                confidenceThreshold: 0.5,
                actions: ['learn', 'update-rules', 'share-knowledge']
            }
        });
    }

    /**
     * Register a new agent
     */
    async registerAgent(name, config) {
        try {
            let agent;
            
            // Check if it's a specialized agent type
            if (config.type === 'MonitorAgent') {
                const MonitorAgent = require('./monitor-agent');
                agent = new MonitorAgent(name, config);
            } else if (config.type === 'AnalyzerAgent') {
                const AnalyzerAgent = require('./analyzer-agent');
                agent = new AnalyzerAgent(name, config);
            } else if (config.type === 'ExecutorAgent') {
                const ExecutorAgent = require('./executor-agent');
                agent = new ExecutorAgent(name, config);
            } else if (config.type === 'LearnerAgent') {
                const LearnerAgent = require('./learner-agent');
                agent = new LearnerAgent(name, config);
            } else {
                // Default to enhanced base agent
                const AutonomousAgent = require('./autonomous-agent');
                agent = new AutonomousAgent(name, config);
            }
            
            // Setup agent event handlers
            agent.on('decision_made', (decision) => this.handleAgentDecision(name, decision));
            agent.on('task_completed', (result) => this.handleTaskCompletion(name, result));
            agent.on('message', (msg) => this.handleAgentMessage(name, msg));
            agent.on('error', (err) => this.handleAgentError(name, err));
            
            // Initialize the agent
            await agent.initialize();
            
            this.agents.set(name, agent);
            console.log(`[Orchestrator] Registered agent: ${name}`);
            
        } catch (err) {
            console.error(`[Orchestrator] Failed to register agent ${name}:`, err.message);
            // Continue with default autonomous agent
            const AutonomousAgent = require('./autonomous-agent');
            const agent = new AutonomousAgent(name, config);
            await agent.initialize();
            this.agents.set(name, agent);
        }
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Handle process signals
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
        
        // Periodic knowledge base save
        setInterval(() => this.saveKnowledgeBase(), 60000); // Save every minute
    }

    /**
     * Start the orchestrator
     */
    async start() {
        if (this.isRunning) {
            console.log('[Orchestrator] Already running');
            return;
        }
        
        this.isRunning = true;
        console.log('[Orchestrator] Starting autonomous operations...');
        
        // Start monitoring loop
        this.startMonitoringLoop();
        
        // Start decision loop
        this.startDecisionLoop();
        
        // Start all autonomous agents
        for (const [name, agent] of this.agents) {
            if (agent.config.autonomous?.enabled) {
                await this.startAgent(name);
            }
        }
        
        this.emit('started');
    }

    /**
     * Start monitoring loop
     */
    startMonitoringLoop() {
        const monitor = async () => {
            if (!this.isRunning) return;
            
            try {
                // Monitor system state
                const systemState = await this.assessSystemState();
                
                // Make autonomous decisions based on state
                if (this.shouldTakeAction(systemState)) {
                    await this.makeAutonomousDecision(systemState);
                }
                
                // Check agent health
                await this.checkAgentHealth();
                
            } catch (err) {
                console.error('[Orchestrator] Monitoring error:', err);
            }
            
            setTimeout(monitor, this.config.monitoringInterval);
        };
        
        monitor();
    }

    /**
     * Start decision loop
     */
    startDecisionLoop() {
        const decide = async () => {
            if (!this.isRunning) return;
            
            try {
                // Process task queue
                while (this.taskQueue.length > 0 && this.runningAgents.size < this.config.maxConcurrentAgents) {
                    const task = this.taskQueue.shift();
                    await this.assignTask(task);
                }
                
                // Review pending decisions
                await this.reviewPendingDecisions();
                
            } catch (err) {
                console.error('[Orchestrator] Decision loop error:', err);
            }
            
            setTimeout(decide, 5000);
        };
        
        decide();
    }

    /**
     * Assess current system state
     */
    async assessSystemState() {
        const state = {
            timestamp: Date.now(),
            agents: {},
            queue: this.taskQueue.length,
            metrics: this.metrics,
            issues: [],
            opportunities: []
        };
        
        // Collect agent states
        for (const [name, agent] of this.agents) {
            state.agents[name] = agent.getStatus();
        }
        
        // Check for issues
        if (this.taskQueue.length > 10) {
            state.issues.push({ type: 'backlog', severity: 'medium', detail: 'Task queue growing' });
        }
        
        if (this.metrics.successRate < 80) {
            state.issues.push({ type: 'performance', severity: 'high', detail: 'Low success rate' });
        }
        
        // Identify opportunities
        if (this.runningAgents.size < this.config.maxConcurrentAgents && this.taskQueue.length > 0) {
            state.opportunities.push({ type: 'capacity', action: 'scale-up' });
        }
        
        return state;
    }

    /**
     * Determine if autonomous action should be taken
     */
    shouldTakeAction(systemState) {
        // Check for critical issues
        if (systemState.issues.some(i => i.severity === 'high')) {
            return true;
        }
        
        // Check for opportunities with high confidence
        if (systemState.opportunities.length > 0) {
            const confidence = this.calculateActionConfidence(systemState);
            return confidence >= this.config.decisionThreshold;
        }
        
        return false;
    }

    /**
     * Calculate confidence for taking action
     */
    calculateActionConfidence(systemState) {
        let confidence = 0.5; // Base confidence
        
        // Adjust based on historical success
        if (this.metrics.successRate > 90) confidence += 0.2;
        else if (this.metrics.successRate < 70) confidence -= 0.2;
        
        // Adjust based on system load
        if (systemState.queue < 5) confidence += 0.1;
        else if (systemState.queue > 20) confidence -= 0.1;
        
        // Learn from past decisions
        const similarDecisions = this.findSimilarDecisions(systemState);
        if (similarDecisions.length > 0) {
            const avgSuccess = similarDecisions.reduce((sum, d) => sum + (d.success ? 1 : 0), 0) / similarDecisions.length;
            confidence = confidence * 0.7 + avgSuccess * 0.3;
        }
        
        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Make an autonomous decision
     */
    async makeAutonomousDecision(systemState) {
        // Check if autonomy is enabled
        if (!this.isAutonomyEnabled()) {
            console.log('[Orchestrator] Autonomous decision skipped - autonomy disabled');
            return;
        }
        
        const decision = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            context: systemState,
            actions: [],
            confidence: this.calculateActionConfidence(systemState),
            autonomous: true
        };
        
        // Determine actions based on issues and opportunities
        for (const issue of systemState.issues) {
            if (issue.severity === 'high') {
                decision.actions.push({
                    type: 'resolve-issue',
                    target: issue.type,
                    params: issue
                });
            }
        }
        
        for (const opportunity of systemState.opportunities) {
            decision.actions.push({
                type: 'exploit-opportunity',
                target: opportunity.type,
                params: opportunity
            });
        }
        
        // Execute decision if confidence is high enough
        if (decision.confidence >= this.config.decisionThreshold) {
            console.log(`[Orchestrator] Making autonomous decision (confidence: ${decision.confidence.toFixed(2)})`);
            await this.executeDecision(decision);
            this.metrics.autonomousActions++;
        } else {
            console.log(`[Orchestrator] Decision confidence too low (${decision.confidence.toFixed(2)}), seeking confirmation`);
            this.emit('decision_pending', decision);
        }
        
        // Record decision
        this.decisionHistory.push(decision);
        this.metrics.decisionsMade++;
    }

    /**
     * Execute a decision
     */
    async executeDecision(decision) {
        console.log(`[Orchestrator] Executing decision ${decision.id}`);
        
        for (const action of decision.actions) {
            try {
                switch (action.type) {
                    case 'resolve-issue':
                        await this.resolveIssue(action.params);
                        break;
                    case 'exploit-opportunity':
                        await this.exploitOpportunity(action.params);
                        break;
                    case 'scale-up':
                        await this.scaleUp();
                        break;
                    case 'optimize':
                        await this.optimize(action.params);
                        break;
                    default:
                        // Delegate to appropriate agent
                        await this.delegateAction(action);
                }
                
                decision.success = true;
            } catch (err) {
                console.error(`[Orchestrator] Action failed:`, err);
                decision.success = false;
                decision.error = err.message;
            }
        }
        
        // Learn from outcome
        if (this.config.learningEnabled) {
            await this.learnFromDecision(decision);
        }
    }

    /**
     * Resolve an identified issue
     */
    async resolveIssue(issue) {
        console.log(`[Orchestrator] Resolving ${issue.type} issue`);
        
        switch (issue.type) {
            case 'backlog':
                // Scale up processing
                await this.scaleUp();
                break;
            case 'performance':
                // Trigger optimization
                await this.optimize({ target: 'performance' });
                break;
            case 'error':
                // Attempt recovery
                await this.recoverFromError(issue);
                break;
        }
    }

    /**
     * Exploit an identified opportunity
     */
    async exploitOpportunity(opportunity) {
        console.log(`[Orchestrator] Exploiting ${opportunity.type} opportunity`);
        
        switch (opportunity.type) {
            case 'capacity':
                // Use available capacity
                if (opportunity.action === 'scale-up') {
                    await this.processMoreTasks();
                }
                break;
            case 'optimization':
                // Apply optimization
                await this.optimize(opportunity);
                break;
        }
    }

    /**
     * Assign a task to an appropriate agent
     */
    async assignTask(task) {
        // Find best agent for the task
        const agent = this.selectBestAgent(task);
        
        if (!agent) {
            console.log('[Orchestrator] No suitable agent available, queuing task');
            this.taskQueue.push(task);
            return;
        }
        
        const [agentName, agentInstance] = agent;
        console.log(`[Orchestrator] Assigning task to ${agentName}`);
        
        this.runningAgents.add(agentName);
        agentInstance.queueTask(task);
        
        // Track task
        this.metrics.tasksProcessed++;
    }

    /**
     * Select the best agent for a task
     */
    selectBestAgent(task) {
        let bestAgent = null;
        let bestScore = 0;
        
        for (const [name, agent] of this.agents) {
            // Skip busy agents
            if (this.runningAgents.has(name)) continue;
            
            // Calculate suitability score
            const score = this.calculateAgentSuitability(agent, task);
            
            if (score > bestScore) {
                bestScore = score;
                bestAgent = [name, agent];
            }
        }
        
        return bestAgent;
    }

    /**
     * Calculate how suitable an agent is for a task
     */
    calculateAgentSuitability(agent, task) {
        let score = 0;
        
        // Check capabilities match
        if (task.requiredCapabilities) {
            for (const cap of task.requiredCapabilities) {
                if (agent.capabilities.has(cap)) {
                    score += 1;
                }
            }
        }
        
        // Check agent performance
        score += agent.metrics?.successRate ? agent.metrics.successRate / 100 : 0.5;
        
        // Check agent availability
        if (agent.state === 'ready' || agent.state === 'active') {
            score += 0.5;
        }
        
        return score;
    }

    /**
     * Start an agent
     */
    async startAgent(name) {
        const agent = this.agents.get(name);
        if (!agent) {
            console.error(`[Orchestrator] Agent ${name} not found`);
            return;
        }
        
        try {
            await agent.start();
            console.log(`[Orchestrator] Started agent: ${name}`);
        } catch (err) {
            console.error(`[Orchestrator] Failed to start agent ${name}:`, err);
        }
    }

    /**
     * Stop an agent
     */
    async stopAgent(name) {
        const agent = this.agents.get(name);
        if (!agent) return;
        
        try {
            await agent.stop();
            this.runningAgents.delete(name);
            console.log(`[Orchestrator] Stopped agent: ${name}`);
        } catch (err) {
            console.error(`[Orchestrator] Failed to stop agent ${name}:`, err);
        }
    }

    /**
     * Check health of all agents
     */
    async checkAgentHealth() {
        for (const [name, agent] of this.agents) {
            const status = agent.getStatus();
            
            // Restart crashed agents
            if (status.state === 'error' || status.state === 'stopped') {
                if (agent.config.autonomous?.enabled) {
                    console.log(`[Orchestrator] Restarting failed agent: ${name}`);
                    await this.startAgent(name);
                }
            }
            
            // Check for stuck agents
            if (status.state === 'processing' && status.uptime > 300000) {
                console.log(`[Orchestrator] Agent ${name} appears stuck, restarting`);
                await this.stopAgent(name);
                await this.startAgent(name);
            }
        }
    }

    /**
     * Learn from a decision outcome
     */
    async learnFromDecision(decision) {
        const key = this.generateDecisionKey(decision.context);
        const knowledge = this.knowledgeBase.get(key) || {
            occurrences: 0,
            successes: 0,
            failures: 0,
            avgConfidence: 0
        };
        
        knowledge.occurrences++;
        if (decision.success) {
            knowledge.successes++;
        } else {
            knowledge.failures++;
        }
        
        knowledge.avgConfidence = (knowledge.avgConfidence * (knowledge.occurrences - 1) + decision.confidence) / knowledge.occurrences;
        knowledge.successRate = knowledge.successes / knowledge.occurrences;
        
        this.knowledgeBase.set(key, knowledge);
        
        // Share knowledge with learner agent
        const learner = this.agents.get('learner');
        if (learner) {
            learner.queueTask({
                type: 'learn',
                data: { decision, knowledge }
            });
        }
    }

    /**
     * Find similar past decisions
     */
    findSimilarDecisions(context) {
        const key = this.generateDecisionKey(context);
        const knowledge = this.knowledgeBase.get(key);
        
        if (!knowledge) return [];
        
        return this.decisionHistory.filter(d => {
            const dKey = this.generateDecisionKey(d.context);
            return dKey === key;
        }).slice(-10); // Last 10 similar decisions
    }

    /**
     * Generate a key for decision context
     */
    generateDecisionKey(context) {
        // Simple key based on issues and opportunities
        const issues = context.issues?.map(i => i.type).sort().join(',') || '';
        const opportunities = context.opportunities?.map(o => o.type).sort().join(',') || '';
        return `${issues}|${opportunities}`;
    }

    /**
     * Handle agent decision
     */
    handleAgentDecision(agentName, decision) {
        console.log(`[Orchestrator] Agent ${agentName} made decision:`, decision);
        this.emit('agent_decision', { agent: agentName, decision });
    }

    /**
     * Handle task completion
     */
    handleTaskCompletion(agentName, result) {
        console.log(`[Orchestrator] Agent ${agentName} completed task:`, result);
        this.runningAgents.delete(agentName);
        
        // Update metrics
        if (result.success) {
            this.metrics.successRate = (this.metrics.successRate * this.metrics.tasksProcessed + 100) / (this.metrics.tasksProcessed + 1);
        } else {
            this.metrics.successRate = (this.metrics.successRate * this.metrics.tasksProcessed) / (this.metrics.tasksProcessed + 1);
        }
        
        this.emit('task_completed', { agent: agentName, result });
    }

    /**
     * Handle agent message
     */
    handleAgentMessage(agentName, message) {
        console.log(`[Orchestrator] Message from ${agentName}:`, message);
        
        // Broadcast to other agents if needed
        if (message.broadcast) {
            for (const [name, agent] of this.agents) {
                if (name !== agentName) {
                    agent.emit('message', { from: agentName, ...message });
                }
            }
        }
        
        this.emit('agent_message', { agent: agentName, message });
    }

    /**
     * Handle agent error
     */
    handleAgentError(agentName, error) {
        console.error(`[Orchestrator] Error from ${agentName}:`, error);
        this.emit('agent_error', { agent: agentName, error });
    }

    /**
     * Queue a task for processing
     */
    queueTask(task) {
        this.taskQueue.push({
            id: Date.now().toString(),
            timestamp: Date.now(),
            ...task
        });
        console.log(`[Orchestrator] Task queued: ${task.type}`);
    }

    /**
     * Get orchestrator status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            agents: Array.from(this.agents.keys()),
            runningAgents: Array.from(this.runningAgents),
            queueLength: this.taskQueue.length,
            metrics: this.metrics,
            knowledgeSize: this.knowledgeBase.size,
            uptime: Date.now() - this.metrics.startTime
        };
    }

    /**
     * Shutdown the orchestrator
     */
    async shutdown() {
        console.log('[Orchestrator] Shutting down...');
        this.isRunning = false;
        
        // Stop all agents
        for (const [name, agent] of this.agents) {
            await this.stopAgent(name);
        }
        
        // Save knowledge base
        await this.saveKnowledgeBase();
        
        console.log('[Orchestrator] Shutdown complete');
        process.exit(0);
    }

    // Additional helper methods
    
    async scaleUp() {
        console.log('[Orchestrator] Scaling up processing capacity');
        // Implementation for scaling
    }
    
    async optimize(params) {
        console.log('[Orchestrator] Running optimization:', params);
        // Implementation for optimization
    }
    
    async recoverFromError(error) {
        console.log('[Orchestrator] Recovering from error:', error);
        // Implementation for error recovery
    }
    
    async processMoreTasks() {
        console.log('[Orchestrator] Processing additional tasks');
        // Implementation for processing more tasks
    }

    /**
     * Review pending decisions that need confirmation
     */
    async reviewPendingDecisions() {
        // Implementation for reviewing decisions below confidence threshold
    }
}

module.exports = AutonomousOrchestrator;