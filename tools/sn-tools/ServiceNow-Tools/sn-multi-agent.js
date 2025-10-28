#!/usr/bin/env node

/**
 * ServiceNow Multi-Agent System
 * Main entry point for the collaborative agent architecture
 */

const fs = require('fs');
const path = require('path');

// Core components
const { MessageBus } = require('./communication/message-bus');
const { StateManager } = require('./state/state-manager');
const { AgentOrchestrator } = require('./agents/orchestrator/agent-orchestrator');

// Specialized agents
const { RecordOperationsAgent } = require('./agents/specialized/record-ops-agent');
const { SchemaAgent } = require('./agents/specialized/schema-agent');
const { AIAgent } = require('./agents/specialized/ai-agent');
const { ValidationAgent } = require('./agents/specialized/validation-agent');

// Workflow definitions
const { WorkflowDefinitions } = require('./agents/workflows/workflow-definitions');

// Existing ServiceNow tools
const ServiceNowTools = require('./servicenow-tools');
const { TableFieldMapper } = require('./sn-table-field-mapper');
const { EnhancedAIIntegration } = require('./sn-ai-integration');
const { FieldValidator } = require('./sn-field-validator');
const { EnhancedRecordCreator } = require('./sn-enhanced-record-creator');

class ServiceNowMultiAgentSystem {
    constructor(config = {}) {
        this.config = this.loadConfig(config);
        this.initialized = false;
        this.running = false;

        // Core components
        this.messageBus = null;
        this.stateManager = null;
        this.orchestrator = null;

        // ServiceNow tools
        this.snTools = null;
        this.tableFieldMapper = null;
        this.aiIntegration = null;
        this.fieldValidator = null;
        this.enhancedRecordCreator = null;

        // Agents
        this.agents = {
            recordOps: null,
            schema: null,
            ai: null,
            validation: null
        };
    }

    /**
     * Load configuration
     */
    loadConfig(overrides = {}) {
        const configPath = path.join(__dirname, 'sn-config.json');
        let config = {};

        try {
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf8');
                config = JSON.parse(configData);
            }
        } catch (error) {
            console.warn('Could not load configuration:', error.message);
        }

        // Merge with overrides
        return { ...config, ...overrides };
    }

    /**
     * Initialize the multi-agent system
     */
    async initialize() {
        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║  ServiceNow Multi-Agent System - Initialization               ║');
        console.log('╚════════════════════════════════════════════════════════════════╝\n');

        try {
            // Check if multi-agent system is enabled
            if (!this.config.multiAgent || !this.config.multiAgent.enabled) {
                console.log('❌ Multi-agent system is not enabled in configuration');
                console.log('   Set multiAgent.enabled = true in sn-config.json\n');
                return false;
            }

            // Step 1: Initialize core components
            console.log('📦 Step 1/5: Initializing core components...');
            await this.initializeCoreComponents();

            // Step 2: Initialize ServiceNow tools
            console.log('🔧 Step 2/5: Initializing ServiceNow tools...');
            await this.initializeServiceNowTools();

            // Step 3: Create and register agents
            console.log('🤖 Step 3/5: Creating and registering agents...');
            await this.createAgents();

            // Step 4: Initialize and register workflows
            console.log('⚙️  Step 4/5: Registering workflows...');
            await this.registerWorkflows();

            // Step 5: Start all components
            console.log('🚀 Step 5/5: Starting system...');
            await this.start();

            this.initialized = true;
            console.log('\n✅ Multi-agent system initialized successfully!\n');

            // Display system status
            this.displayStatus();

            return true;
        } catch (error) {
            console.error('\n❌ Initialization failed:', error.message);
            console.error(error.stack);
            return false;
        }
    }

    /**
     * Initialize core components
     */
    async initializeCoreComponents() {
        // Message Bus
        this.messageBus = new MessageBus({
            backend: this.config.multiAgent?.communication?.backend || 'memory',
            ...this.config.multiAgent?.communication
        });
        await this.messageBus.initialize();
        console.log('   ✓ Message bus initialized');

        // State Manager
        this.stateManager = new StateManager({
            backend: this.config.multiAgent?.communication?.backend || 'memory'
        });
        await this.stateManager.initialize();
        console.log('   ✓ State manager initialized');

        // Make state manager accessible via message bus
        this.messageBus.stateManager = this.stateManager;

        // Orchestrator
        this.orchestrator = new AgentOrchestrator({
            ...this.config.multiAgent?.orchestrator
        });
        await this.orchestrator.initialize(this.messageBus, this.stateManager);
        console.log('   ✓ Orchestrator initialized');
    }

    /**
     * Initialize ServiceNow tools
     */
    async initializeServiceNowTools() {
        try {
            this.snTools = new ServiceNowTools();
            console.log('   ✓ ServiceNow tools loaded');

            this.tableFieldMapper = new TableFieldMapper();
            console.log('   ✓ Table field mapper loaded');

            this.aiIntegration = new EnhancedAIIntegration();
            console.log('   ✓ AI integration loaded');

            this.fieldValidator = new FieldValidator();
            console.log('   ✓ Field validator loaded');

            this.enhancedRecordCreator = new EnhancedRecordCreator(this.snTools);
            console.log('   ✓ Enhanced record creator loaded');
        } catch (error) {
            console.warn('   ⚠️  Some tools failed to load:', error.message);
        }
    }

    /**
     * Create and register agents
     */
    async createAgents() {
        const agentConfigs = this.config.multiAgent?.agents || {};

        // Record Operations Agent
        if (!agentConfigs.recordOps || agentConfigs.recordOps.instances > 0) {
            this.agents.recordOps = new RecordOperationsAgent({
                serviceNowTools: this.snTools,
                enhancedRecordCreator: this.enhancedRecordCreator,
                agentConfig: agentConfigs.recordOps?.config || {}
            });
            await this.orchestrator.registerAgent(this.agents.recordOps);
            await this.agents.recordOps.initialize();
            console.log('   ✓ RecordOperationsAgent registered');
        }

        // Schema Agent
        if (!agentConfigs.schema || agentConfigs.schema.instances > 0) {
            this.agents.schema = new SchemaAgent({
                tableFieldMapper: this.tableFieldMapper,
                agentConfig: agentConfigs.schema?.config || {}
            });
            await this.orchestrator.registerAgent(this.agents.schema);
            await this.agents.schema.initialize();
            console.log('   ✓ SchemaAgent registered');
        }

        // AI Agent
        if (!agentConfigs.ai || agentConfigs.ai.instances > 0) {
            this.agents.ai = new AIAgent({
                aiIntegration: this.aiIntegration,
                agentConfig: agentConfigs.ai?.config || {}
            });
            await this.orchestrator.registerAgent(this.agents.ai);
            await this.agents.ai.initialize();
            console.log('   ✓ AIAgent registered');
        }

        // Validation Agent
        if (!agentConfigs.validation || agentConfigs.validation?.instances > 0) {
            this.agents.validation = new ValidationAgent({
                fieldValidator: this.fieldValidator,
                agentConfig: agentConfigs.validation?.config || {}
            });
            await this.orchestrator.registerAgent(this.agents.validation);
            await this.agents.validation.initialize();
            console.log('   ✓ ValidationAgent registered');
        }
    }

    /**
     * Register workflows
     */
    async registerWorkflows() {
        for (const [name, workflow] of Object.entries(WorkflowDefinitions)) {
            this.orchestrator.registerWorkflow(name, workflow);
        }
        console.log(`   ✓ ${Object.keys(WorkflowDefinitions).length} workflows registered`);
    }

    /**
     * Start the system
     */
    async start() {
        if (!this.initialized) {
            throw new Error('System must be initialized before starting');
        }

        // Start orchestrator
        await this.orchestrator.start();

        // Start all agents
        for (const [name, agent] of Object.entries(this.agents)) {
            if (agent) {
                await agent.start();
            }
        }

        this.running = true;
        console.log('   ✓ All agents started');
    }

    /**
     * Stop the system
     */
    async stop() {
        console.log('\n🛑 Shutting down multi-agent system...');

        // Stop orchestrator
        if (this.orchestrator) {
            await this.orchestrator.stop();
        }

        // Stop all agents
        for (const [name, agent] of Object.entries(this.agents)) {
            if (agent) {
                await agent.stop();
            }
        }

        // Shutdown core components
        if (this.messageBus) {
            await this.messageBus.shutdown();
        }

        if (this.stateManager) {
            await this.stateManager.shutdown();
        }

        this.running = false;
        console.log('✅ Shutdown complete\n');
    }

    /**
     * Execute a workflow
     */
    async executeWorkflow(workflowName, params = {}) {
        if (!this.running) {
            throw new Error('System is not running');
        }

        console.log(`\n🚀 Executing workflow: ${workflowName}`);
        console.log(`   Parameters:`, JSON.stringify(params, null, 2));

        try {
            const result = await this.orchestrator.executeWorkflow(workflowName, params);
            console.log(`\n✅ Workflow completed successfully`);
            console.log(`   Duration: ${result.duration}ms`);
            return result;
        } catch (error) {
            console.error(`\n❌ Workflow failed:`, error.message);
            throw error;
        }
    }

    /**
     * Route a task to the appropriate agent
     */
    async routeTask(task) {
        if (!this.running) {
            throw new Error('System is not running');
        }

        return await this.orchestrator.routeTask(task);
    }

    /**
     * Get system statistics
     */
    getStats() {
        return {
            orchestrator: this.orchestrator?.getStats(),
            messageBus: this.messageBus?.getStats(),
            stateManager: this.stateManager?.getStats()
        };
    }

    /**
     * Display system status
     */
    displayStatus() {
        const stats = this.getStats();

        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log('║  System Status                                                 ║');
        console.log('╠════════════════════════════════════════════════════════════════╣');
        console.log(`║  Agents Registered: ${String(stats.orchestrator?.agents?.total || 0).padEnd(42)} ║`);
        console.log(`║  Workflows Available: ${String(stats.orchestrator?.workflows?.registered || 0).padEnd(40)} ║`);
        console.log(`║  Message Bus: ${(stats.messageBus?.backend || 'unknown').padEnd(48)} ║`);
        console.log('╚════════════════════════════════════════════════════════════════╝\n');
    }

    /**
     * Get reference to specific agent
     */
    getAgent(type) {
        return this.agents[type] || null;
    }

    /**
     * Get orchestrator
     */
    getOrchestrator() {
        return this.orchestrator;
    }
}

// Export the class
module.exports = { ServiceNowMultiAgentSystem };

// CLI usage
if (require.main === module) {
    async function main() {
        const system = new ServiceNowMultiAgentSystem();

        try {
            // Initialize the system
            const success = await system.initialize();

            if (!success) {
                process.exit(1);
            }

            // Handle Ctrl+C gracefully
            process.on('SIGINT', async () => {
                console.log('\n\nReceived SIGINT, shutting down...');
                await system.stop();
                process.exit(0);
            });

            // Keep the process running
            console.log('System is running. Press Ctrl+C to stop.\n');

            // Example: Execute a workflow
            if (process.argv[2] === 'test') {
                console.log('Running test workflow...\n');

                const result = await system.executeWorkflow('fetch-stories', {
                    instance: 'prod'
                });

                console.log('\nTest workflow result:', result);
            }

        } catch (error) {
            console.error('Fatal error:', error);
            await system.stop();
            process.exit(1);
        }
    }

    main();
}
