/**
 * Enhanced Autonomous Agent
 * Extends base agent with true autonomous decision-making capabilities
 */

const BaseAgent = require('./base-agent');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class AutonomousAgent extends BaseAgent {
    constructor(name, config = {}) {
        super(name, config);
        
        // Autonomous capabilities
        this.autonomousConfig = {
            enabled: true,
            confidenceThreshold: 0.7,
            learningRate: 0.1,
            maxMemorySize: 1000,
            decisionInterval: 5000,
            ...config.autonomous
        };
        
        // Decision-making components
        this.decisionEngine = new DecisionEngine(this);
        this.memory = new MemorySystem();
        this.learningModule = new LearningModule(this.autonomousConfig.learningRate);
        
        // Task management
        this.taskQueue = [];
        this.currentTask = null;
        this.pendingDecisions = new Map();
        
        // Behavioral patterns
        this.patterns = new Map();
        this.rules = new Map();
        this.strategies = new Map();
        
        // Metrics specific to autonomous operation
        this.autonomousMetrics = {
            decisionssMade: 0,
            autonomousActions: 0,
            confidenceAverage: 0,
            learningCycles: 0
        };
    }

    /**
     * Initialize autonomous capabilities
     */
    async initialize() {
        await super.initialize();
        
        this.log('Initializing autonomous capabilities...', 'cyan');
        
        // Load behavioral rules
        await this.loadRules();
        
        // Load learned patterns
        await this.loadPatterns();
        
        // Initialize decision engine
        await this.decisionEngine.initialize();
        
        // Start autonomous operation if enabled
        if (this.autonomousConfig.enabled) {
            this.startAutonomousOperation();
        }
        
        this.status = 'ready';
        this.emit('initialized');
    }

    /**
     * Load decision rules
     */
    async loadRules() {
        const rulesPath = path.join(__dirname, '..', 'agent-rules', `${this.name}.json`);
        try {
            const rulesData = await fs.readFile(rulesPath, 'utf8');
            const rules = JSON.parse(rulesData);
            
            for (const rule of rules) {
                this.rules.set(rule.id, new Rule(rule));
            }
            
            this.log(`Loaded ${this.rules.size} decision rules`, 'green');
        } catch (err) {
            this.log('No rules file found, using default rules', 'yellow');
            this.loadDefaultRules();
        }
    }

    /**
     * Load default rules
     */
    loadDefaultRules() {
        // File change detection rule
        this.rules.set('file-change', new Rule({
            id: 'file-change',
            conditions: [
                { type: 'event', value: 'file-modified' }
            ],
            actions: [
                { type: 'analyze', target: 'file' },
                { type: 'validate', target: 'syntax' }
            ],
            priority: 5,
            confidence: 0.8
        }));

        // Error detection rule
        this.rules.set('error-detection', new Rule({
            id: 'error-detection',
            conditions: [
                { type: 'pattern', value: 'error', operator: 'contains' }
            ],
            actions: [
                { type: 'investigate', target: 'error' },
                { type: 'suggest-fix', target: 'error' }
            ],
            priority: 9,
            confidence: 0.9
        }));

        // Optimization opportunity rule
        this.rules.set('optimization', new Rule({
            id: 'optimization',
            conditions: [
                { type: 'metric', value: 'performance', operator: 'below', threshold: 0.7 }
            ],
            actions: [
                { type: 'analyze', target: 'performance' },
                { type: 'optimize', target: 'code' }
            ],
            priority: 3,
            confidence: 0.6
        }));
    }

    /**
     * Load learned patterns
     */
    async loadPatterns() {
        const patternsPath = path.join(__dirname, '..', 'knowledge-base', `${this.name}-patterns.json`);
        try {
            const patternsData = await fs.readFile(patternsPath, 'utf8');
            const patterns = JSON.parse(patternsData);
            
            for (const [key, pattern] of Object.entries(patterns)) {
                this.patterns.set(key, pattern);
            }
            
            this.log(`Loaded ${this.patterns.size} learned patterns`, 'green');
        } catch (err) {
            this.log('No patterns file found, starting fresh', 'yellow');
        }
    }

    /**
     * Start autonomous operation
     */
    startAutonomousOperation() {
        this.log('Starting autonomous operation', 'bright');
        
        // Decision-making loop
        this.decisionLoop = setInterval(() => {
            this.makeAutonomousDecision();
        }, this.autonomousConfig.decisionInterval);
        
        // Learning loop
        this.learningLoop = setInterval(() => {
            this.performLearningCycle();
        }, 30000); // Every 30 seconds
        
        this.status = 'autonomous';
    }

    /**
     * Make an autonomous decision
     */
    async makeAutonomousDecision() {
        if (this.status !== 'autonomous' && this.status !== 'ready') return;
        
        try {
            // Gather context
            const context = await this.gatherContext();
            
            // Check if action is needed
            if (!this.shouldTakeAction(context)) return;
            
            // Generate decision
            const decision = await this.decisionEngine.decide(context);
            
            // Validate confidence
            if (decision.confidence < this.autonomousConfig.confidenceThreshold) {
                this.log(`Decision confidence too low (${decision.confidence.toFixed(2)})`, 'yellow');
                this.pendingDecisions.set(decision.id, decision);
                this.emit('decision_pending', decision);
                return;
            }
            
            // Execute decision
            this.log(`Executing autonomous decision (confidence: ${decision.confidence.toFixed(2)})`, 'green');
            await this.executeDecision(decision);
            
            // Learn from outcome
            await this.learningModule.learn(decision, context);
            
            // Update metrics
            this.autonomousMetrics.decisionssMade++;
            this.autonomousMetrics.autonomousActions++;
            this.updateConfidenceAverage(decision.confidence);
            
        } catch (err) {
            this.log(`Autonomous decision error: ${err.message}`, 'red');
            this.metrics.errors++;
        }
    }

    /**
     * Gather current context
     */
    async gatherContext() {
        const context = {
            timestamp: Date.now(),
            status: this.status,
            metrics: this.metrics,
            queue: this.taskQueue.length,
            memory: this.memory.getRecentMemories(10),
            environment: await this.scanEnvironment()
        };
        
        return context;
    }

    /**
     * Scan the environment for relevant information
     */
    async scanEnvironment() {
        const env = {
            files: [],
            changes: [],
            errors: [],
            opportunities: []
        };
        
        // Check for recent file changes
        try {
            const tempUpdatesPath = path.join(__dirname, '..', 'temp_updates');
            const files = await fs.readdir(tempUpdatesPath);
            env.files = files.filter(f => !f.startsWith('.'));
            
            if (env.files.length > 0) {
                env.changes.push({ type: 'pending-updates', count: env.files.length });
            }
        } catch (err) {
            // Directory might not exist
        }
        
        // Check for errors in logs
        try {
            const logPath = path.join(__dirname, '..', 'logs', `agent-${this.name}.log`);
            const logData = await fs.readFile(logPath, 'utf8');
            const lines = logData.split('\n').slice(-100); // Last 100 lines
            
            const errorCount = lines.filter(l => l.includes('ERROR')).length;
            if (errorCount > 0) {
                env.errors.push({ type: 'log-errors', count: errorCount });
            }
        } catch (err) {
            // Log file might not exist
        }
        
        return env;
    }

    /**
     * Determine if action should be taken
     */
    shouldTakeAction(context) {
        // Check rules
        for (const [ruleId, rule] of this.rules) {
            if (rule.evaluate(context)) {
                return true;
            }
        }
        
        // Check for pending tasks
        if (this.taskQueue.length > 0 && !this.currentTask) {
            return true;
        }
        
        // Check for environmental triggers
        if (context.environment.changes.length > 0 || context.environment.errors.length > 0) {
            return true;
        }
        
        return false;
    }

    /**
     * Execute a decision
     */
    async executeDecision(decision) {
        this.status = 'executing';
        this.emit('decision_executing', decision);
        
        const results = [];
        
        for (const action of decision.actions) {
            try {
                const result = await this.executeAction(action);
                results.push({ action, result, success: true });
            } catch (err) {
                this.log(`Action failed: ${action.type} - ${err.message}`, 'red');
                results.push({ action, result: null, success: false, error: err.message });
            }
        }
        
        decision.results = results;
        decision.executed = Date.now();
        
        // Store in memory
        this.memory.store('decision', decision);
        
        this.status = 'autonomous';
        this.emit('decision_completed', decision);
        
        return decision;
    }

    /**
     * Execute a single action
     */
    async executeAction(action) {
        this.log(`Executing action: ${action.type} on ${action.target}`, 'cyan');
        
        switch (action.type) {
            case 'analyze':
                return await this.analyzeTarget(action.target, action.params);
            case 'validate':
                return await this.validateTarget(action.target, action.params);
            case 'optimize':
                return await this.optimizeTarget(action.target, action.params);
            case 'investigate':
                return await this.investigateIssue(action.target, action.params);
            case 'suggest-fix':
                return await this.suggestFix(action.target, action.params);
            case 'update':
                return await this.updateTarget(action.target, action.params);
            case 'alert':
                return await this.sendAlert(action.params);
            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }
    }

    /**
     * Perform a learning cycle
     */
    async performLearningCycle() {
        this.log('Performing learning cycle', 'magenta');
        
        // Analyze recent decisions
        const recentDecisions = this.memory.getByType('decision', 20);
        
        // Update patterns
        for (const decision of recentDecisions) {
            if (decision.results) {
                const success = decision.results.every(r => r.success);
                await this.updatePattern(decision, success);
            }
        }
        
        // Optimize rules based on patterns
        await this.optimizeRules();
        
        // Save learned patterns
        await this.savePatterns();
        
        this.autonomousMetrics.learningCycles++;
    }

    /**
     * Update a pattern based on decision outcome
     */
    async updatePattern(decision, success) {
        const patternKey = this.generatePatternKey(decision);
        const pattern = this.patterns.get(patternKey) || {
            occurrences: 0,
            successes: 0,
            confidence: 0.5
        };
        
        pattern.occurrences++;
        if (success) pattern.successes++;
        pattern.confidence = pattern.successes / pattern.occurrences;
        
        this.patterns.set(patternKey, pattern);
    }

    /**
     * Generate a pattern key from decision
     */
    generatePatternKey(decision) {
        const actions = decision.actions.map(a => a.type).sort().join('-');
        const context = decision.context?.environment?.changes?.[0]?.type || 'default';
        return `${context}:${actions}`;
    }

    /**
     * Optimize rules based on learned patterns
     */
    async optimizeRules() {
        for (const [ruleId, rule] of this.rules) {
            const relatedPatterns = Array.from(this.patterns.entries())
                .filter(([key]) => key.includes(rule.id));
            
            if (relatedPatterns.length > 0) {
                const avgConfidence = relatedPatterns.reduce((sum, [, p]) => sum + p.confidence, 0) / relatedPatterns.length;
                rule.confidence = rule.confidence * 0.7 + avgConfidence * 0.3; // Weighted average
            }
        }
    }

    /**
     * Save learned patterns
     */
    async savePatterns() {
        const patternsPath = path.join(__dirname, '..', 'knowledge-base', `${this.name}-patterns.json`);
        const patterns = Object.fromEntries(this.patterns);
        
        try {
            await fs.mkdir(path.dirname(patternsPath), { recursive: true });
            await fs.writeFile(patternsPath, JSON.stringify(patterns, null, 2));
        } catch (err) {
            this.log(`Failed to save patterns: ${err.message}`, 'red');
        }
    }

    /**
     * Update confidence average
     */
    updateConfidenceAverage(confidence) {
        const count = this.autonomousMetrics.decisionsMade;
        const currentAvg = this.autonomousMetrics.confidenceAverage;
        this.autonomousMetrics.confidenceAverage = (currentAvg * (count - 1) + confidence) / count;
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
        this.emit('task_queued', task);
    }

    /**
     * Get agent status
     */
    getStatus() {
        const baseStatus = super.getStatus();
        return {
            ...baseStatus,
            autonomous: this.autonomousConfig.enabled,
            currentTask: this.currentTask,
            queueLength: this.taskQueue.length,
            pendingDecisions: this.pendingDecisions.size,
            patterns: this.patterns.size,
            rules: this.rules.size,
            autonomousMetrics: this.autonomousMetrics
        };
    }

    /**
     * Stop autonomous operation
     */
    stop() {
        this.log('Stopping autonomous operation', 'yellow');
        
        if (this.decisionLoop) {
            clearInterval(this.decisionLoop);
        }
        
        if (this.learningLoop) {
            clearInterval(this.learningLoop);
        }
        
        this.status = 'stopped';
        this.emit('stopped');
    }

    // Action implementations (can be overridden by specialized agents)
    
    async analyzeTarget(target, params) {
        return { analysis: `Analyzed ${target}`, params };
    }
    
    async validateTarget(target, params) {
        return { validation: `Validated ${target}`, params };
    }
    
    async optimizeTarget(target, params) {
        return { optimization: `Optimized ${target}`, params };
    }
    
    async investigateIssue(target, params) {
        return { investigation: `Investigated ${target}`, params };
    }
    
    async suggestFix(target, params) {
        return { suggestion: `Fix for ${target}`, params };
    }
    
    async updateTarget(target, params) {
        return { update: `Updated ${target}`, params };
    }
    
    async sendAlert(params) {
        this.emit('alert', params);
        return { alert: 'Sent', params };
    }
}

/**
 * Decision Engine for autonomous decision-making
 */
class DecisionEngine {
    constructor(agent) {
        this.agent = agent;
        this.strategies = new Map();
    }
    
    async initialize() {
        // Load decision strategies
        this.loadStrategies();
    }
    
    loadStrategies() {
        // Rule-based strategy
        this.strategies.set('rule-based', this.ruleBasedStrategy.bind(this));
        
        // Pattern-based strategy
        this.strategies.set('pattern-based', this.patternBasedStrategy.bind(this));
        
        // Hybrid strategy
        this.strategies.set('hybrid', this.hybridStrategy.bind(this));
    }
    
    async decide(context) {
        // Use hybrid strategy by default
        const strategy = this.strategies.get('hybrid');
        return await strategy(context);
    }
    
    async ruleBasedStrategy(context) {
        const decision = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            context,
            actions: [],
            confidence: 0,
            strategy: 'rule-based'
        };
        
        // Evaluate all rules
        const applicableRules = [];
        for (const [ruleId, rule] of this.agent.rules) {
            if (rule.evaluate(context)) {
                applicableRules.push(rule);
            }
        }
        
        if (applicableRules.length > 0) {
            // Use highest priority rule
            applicableRules.sort((a, b) => b.priority - a.priority);
            const selectedRule = applicableRules[0];
            
            decision.actions = selectedRule.actions;
            decision.confidence = selectedRule.confidence;
            decision.ruleId = selectedRule.id;
        }
        
        return decision;
    }
    
    async patternBasedStrategy(context) {
        const decision = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            context,
            actions: [],
            confidence: 0,
            strategy: 'pattern-based'
        };
        
        // Find matching patterns
        let bestPattern = null;
        let bestConfidence = 0;
        
        for (const [key, pattern] of this.agent.patterns) {
            if (pattern.confidence > bestConfidence) {
                bestPattern = pattern;
                bestConfidence = pattern.confidence;
            }
        }
        
        if (bestPattern && bestPattern.actions) {
            decision.actions = bestPattern.actions;
            decision.confidence = bestPattern.confidence;
        }
        
        return decision;
    }
    
    async hybridStrategy(context) {
        // Get decisions from both strategies
        const ruleDecision = await this.ruleBasedStrategy(context);
        const patternDecision = await this.patternBasedStrategy(context);
        
        // Choose the one with higher confidence
        if (ruleDecision.confidence >= patternDecision.confidence) {
            ruleDecision.strategy = 'hybrid-rule';
            return ruleDecision;
        } else {
            patternDecision.strategy = 'hybrid-pattern';
            return patternDecision;
        }
    }
}

/**
 * Memory System for storing and retrieving experiences
 */
class MemorySystem {
    constructor() {
        this.memories = [];
        this.index = new Map(); // Type-based index
    }
    
    store(type, data) {
        const memory = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            type,
            data
        };
        
        this.memories.push(memory);
        
        // Update index
        if (!this.index.has(type)) {
            this.index.set(type, []);
        }
        this.index.get(type).push(memory);
        
        // Limit memory size
        if (this.memories.length > 1000) {
            this.memories.shift();
            // Rebuild index
            this.rebuildIndex();
        }
    }
    
    getRecentMemories(count) {
        return this.memories.slice(-count);
    }
    
    getByType(type, count) {
        const typeMemories = this.index.get(type) || [];
        return typeMemories.slice(-count);
    }
    
    rebuildIndex() {
        this.index.clear();
        for (const memory of this.memories) {
            if (!this.index.has(memory.type)) {
                this.index.set(memory.type, []);
            }
            this.index.get(memory.type).push(memory);
        }
    }
}

/**
 * Learning Module for improving decision-making
 */
class LearningModule {
    constructor(learningRate) {
        this.learningRate = learningRate;
        this.knowledge = new Map();
    }
    
    async learn(decision, context) {
        // Simple reinforcement learning
        const key = this.generateKey(decision, context);
        const knowledge = this.knowledge.get(key) || {
            value: 0.5,
            count: 0
        };
        
        // Calculate reward based on success
        const success = decision.results?.every(r => r.success) ? 1 : 0;
        
        // Update value using learning rate
        knowledge.value = knowledge.value * (1 - this.learningRate) + success * this.learningRate;
        knowledge.count++;
        
        this.knowledge.set(key, knowledge);
    }
    
    generateKey(decision, context) {
        const actions = decision.actions.map(a => a.type).join('-');
        const contextType = context.environment?.changes?.[0]?.type || 'default';
        return `${contextType}:${actions}`;
    }
    
    getKnowledge(key) {
        return this.knowledge.get(key);
    }
}

/**
 * Rule class for decision-making
 */
class Rule {
    constructor(config) {
        this.id = config.id;
        this.conditions = config.conditions || [];
        this.actions = config.actions || [];
        this.priority = config.priority || 5;
        this.confidence = config.confidence || 0.5;
    }
    
    evaluate(context) {
        for (const condition of this.conditions) {
            if (!this.evaluateCondition(condition, context)) {
                return false;
            }
        }
        return true;
    }
    
    evaluateCondition(condition, context) {
        switch (condition.type) {
            case 'event':
                return context.lastEvent === condition.value;
            case 'pattern':
                return JSON.stringify(context).includes(condition.value);
            case 'metric':
                const metricValue = context.metrics?.[condition.value];
                return this.compareValue(metricValue, condition.operator, condition.threshold);
            default:
                return false;
        }
    }
    
    compareValue(value, operator, threshold) {
        switch (operator) {
            case 'equals': return value === threshold;
            case 'above': return value > threshold;
            case 'below': return value < threshold;
            case 'contains': return value?.includes?.(threshold);
            default: return false;
        }
    }
}

module.exports = AutonomousAgent;