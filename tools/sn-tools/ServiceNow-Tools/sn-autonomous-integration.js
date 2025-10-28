/**
 * ServiceNow Tools Autonomous Integration
 * Bridges the autonomous agent system with existing sn-tools functionality
 */

const path = require('path');
const fs = require('fs').promises;
const EventEmitter = require('events');
const AutonomousOrchestrator = require('./agents/autonomous-orchestrator');
const ServiceNowTools = require('./servicenow-tools');

class SNAutonomousIntegration extends EventEmitter {
    constructor(configPath = null) {
        super();
        this.configPath = configPath || path.join(__dirname, 'agent-configs', 'orchestrator-config.json');
        this.snTools = null;
        this.orchestrator = null;
        this.isRunning = false;
        this.integrationMap = new Map();
    }

    /**
     * Initialize the autonomous integration
     */
    async initialize() {
        console.log('[Integration] Initializing ServiceNow Autonomous Integration...');
        
        // Load configuration
        const config = await this.loadConfiguration();
        
        // Initialize ServiceNow Tools
        this.snTools = new ServiceNowTools();
        
        // Initialize Autonomous Orchestrator
        this.orchestrator = new AutonomousOrchestrator(config.config);
        await this.orchestrator.initialize();
        
        // Setup integration mappings
        this.setupIntegrationMappings();
        
        // Setup event bridges
        this.setupEventBridges();
        
        // Register autonomous capabilities with sn-tools
        await this.registerAutonomousCapabilities();
        
        console.log('[Integration] Initialization complete');
    }

    /**
     * Load configuration
     */
    async loadConfiguration() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            return JSON.parse(configData);
        } catch (err) {
            console.error('[Integration] Failed to load configuration:', err);
            return { config: {}, agents: {} };
        }
    }

    /**
     * Setup integration mappings between agents and sn-tools
     */
    setupIntegrationMappings() {
        // Map agent capabilities to sn-tools functions
        this.integrationMap.set('file-watch', {
            snTool: 'sn-file-watcher',
            method: 'watch',
            agent: 'monitor'
        });
        
        this.integrationMap.set('dependency-tracking', {
            snTool: 'sn-dependency-tracker',
            method: 'scan',
            agent: 'analyzer'
        });
        
        this.integrationMap.set('update', {
            snTool: 'sn-operations',
            method: 'update',
            agent: 'executor'
        });
        
        this.integrationMap.set('fetch-data', {
            snTool: 'sn-operations',
            method: 'fetchData',
            agent: 'executor'
        });
        
        this.integrationMap.set('flow-trace', {
            snTool: 'sn-flow-tracer',
            method: 'traceFlow',
            agent: 'analyzer'
        });
        
        console.log('[Integration] Mapped', this.integrationMap.size, 'capabilities');
    }

    /**
     * Setup event bridges between orchestrator and sn-tools
     */
    setupEventBridges() {
        // Bridge orchestrator events to sn-tools
        this.orchestrator.on('agent_decision', async (event) => {
            await this.handleAgentDecision(event);
        });
        
        this.orchestrator.on('task_completed', async (event) => {
            await this.handleTaskCompletion(event);
        });
        
        this.orchestrator.on('anomaly-detected', async (event) => {
            await this.handleAnomalyDetection(event);
        });
        
        this.orchestrator.on('alert', async (alert) => {
            await this.handleAlert(alert);
        });
        
        // Bridge sn-tools events to orchestrator
        this.setupSNToolsEventHandlers();
        
        console.log('[Integration] Event bridges established');
    }

    /**
     * Setup ServiceNow Tools event handlers
     */
    setupSNToolsEventHandlers() {
        try {
            // Monitor file changes from sn-file-watcher
            const fileWatcher = require('./sn-file-watcher');
            if (fileWatcher && fileWatcher.on) {
                fileWatcher.on('file-changed', (file) => {
                    this.orchestrator.queueTask({
                        type: 'analyze-change',
                        target: file,
                        source: 'sn-file-watcher'
                    });
                });
            }
        } catch (err) {
            console.log('[Integration] sn-file-watcher not available:', err.message);
        }
        
        try {
            // Monitor dependencies from sn-dependency-tracker
            const depTracker = require('./sn-dependency-tracker');
            if (depTracker && depTracker.on) {
                depTracker.on('dependency-found', (dep) => {
                    this.orchestrator.queueTask({
                        type: 'track-dependency',
                        target: dep,
                        source: 'sn-dependency-tracker'
                    });
                });
            }
        } catch (err) {
            console.log('[Integration] sn-dependency-tracker not available:', err.message);
        }
    }

    /**
     * Register autonomous capabilities with sn-tools
     */
    async registerAutonomousCapabilities() {
        // Add autonomous mode to sn-operations
        if (this.snTools) {
            this.snTools.autonomousMode = true;
            this.snTools.orchestrator = this.orchestrator;
            
            // Override decision points with autonomous decisions
            const originalUpdate = this.snTools.updateRecord;
            this.snTools.updateRecord = async (table, sysId, data) => {
                // Check if autonomous decision should be made
                const decision = await this.makeAutonomousDecision('update', {
                    table,
                    sysId,
                    data
                });
                
                if (decision.approved) {
                    return originalUpdate.call(this.snTools, table, sysId, data);
                } else {
                    console.log('[Integration] Update blocked by autonomous decision');
                    return { success: false, reason: 'Autonomous decision: ' + decision.reason };
                }
            };
        }
        
        console.log('[Integration] Autonomous capabilities registered');
    }

    /**
     * Make an autonomous decision
     */
    async makeAutonomousDecision(action, params) {
        const context = {
            action,
            params,
            timestamp: Date.now()
        };
        
        // Get decision from orchestrator
        const agentDecision = await this.requestAgentDecision(action, context);
        
        return {
            approved: agentDecision.confidence >= 0.7,
            confidence: agentDecision.confidence,
            reason: agentDecision.reason || 'Confidence threshold not met'
        };
    }

    /**
     * Request decision from appropriate agent
     */
    async requestAgentDecision(action, context) {
        const mapping = this.integrationMap.get(action);
        
        if (!mapping) {
            return { confidence: 0.5, reason: 'No mapping for action' };
        }
        
        const agent = this.orchestrator.agents.get(mapping.agent);
        
        if (!agent) {
            return { confidence: 0.5, reason: 'Agent not available' };
        }
        
        // Queue decision task
        return new Promise((resolve) => {
            const taskId = Date.now().toString();
            
            agent.once(`decision_${taskId}`, (decision) => {
                resolve(decision);
            });
            
            agent.queueTask({
                id: taskId,
                type: 'decide',
                context
            });
            
            // Timeout after 5 seconds
            setTimeout(() => {
                resolve({ confidence: 0.5, reason: 'Decision timeout' });
            }, 5000);
        });
    }

    /**
     * Handle agent decision event
     */
    async handleAgentDecision(event) {
        const { agent, decision } = event;
        
        console.log(`[Integration] Agent ${agent} made decision:`, decision.actions);
        
        // Execute decision through appropriate sn-tool
        for (const action of decision.actions) {
            await this.executeAgentAction(agent, action);
        }
    }

    /**
     * Execute agent action through sn-tools
     */
    async executeAgentAction(agentName, action) {
        const mapping = this.integrationMap.get(action.type);
        
        if (!mapping) {
            console.log(`[Integration] No mapping for action type: ${action.type}`);
            return;
        }
        
        try {
            // Load the appropriate sn-tool module
            const toolModule = require(`./${mapping.snTool}`);
            
            // Execute the method
            if (toolModule && toolModule[mapping.method]) {
                const result = await toolModule[mapping.method](action.params);
                console.log(`[Integration] Executed ${action.type} through ${mapping.snTool}`);
                return result;
            }
        } catch (err) {
            console.error(`[Integration] Failed to execute action:`, err);
        }
    }

    /**
     * Handle task completion event
     */
    async handleTaskCompletion(event) {
        const { agent, result } = event;
        
        console.log(`[Integration] Task completed by ${agent}:`, result);
        
        // Update metrics
        this.emit('task_completed', event);
        
        // Learn from outcome
        if (this.orchestrator.config.learningEnabled) {
            const learner = this.orchestrator.agents.get('learner');
            if (learner) {
                learner.queueTask({
                    type: 'learn',
                    data: { agent, result }
                });
            }
        }
    }

    /**
     * Handle anomaly detection
     */
    async handleAnomalyDetection(anomaly) {
        console.log(`[Integration] Anomaly detected:`, anomaly);
        
        // Trigger appropriate sn-tools response
        if (anomaly.severity >= 7) {
            // High severity - pause operations
            if (this.snTools) {
                this.snTools.pauseOperations = true;
            }
            
            // Create backup
            await this.createEmergencyBackup();
        }
        
        this.emit('anomaly', anomaly);
    }

    /**
     * Handle alert
     */
    async handleAlert(alert) {
        console.log(`[Integration] ALERT:`, alert.message);
        
        // Log to file
        const alertLog = {
            timestamp: new Date().toISOString(),
            alert
        };
        
        try {
            const logPath = path.join(__dirname, 'logs', 'alerts.log');
            await fs.appendFile(logPath, JSON.stringify(alertLog) + '\n');
        } catch (err) {
            console.error('[Integration] Failed to log alert:', err);
        }
        
        this.emit('alert', alert);
    }

    /**
     * Create emergency backup
     */
    async createEmergencyBackup() {
        console.log('[Integration] Creating emergency backup...');
        
        try {
            const backupDir = path.join(__dirname, 'backups', 'emergency', Date.now().toString());
            await fs.mkdir(backupDir, { recursive: true });
            
            // Backup critical files
            const criticalPaths = [
                'sn-config.json',
                'local_development',
                'temp_updates'
            ];
            
            for (const criticalPath of criticalPaths) {
                const sourcePath = path.join(__dirname, criticalPath);
                const targetPath = path.join(backupDir, criticalPath);
                
                try {
                    await this.copyRecursive(sourcePath, targetPath);
                } catch (err) {
                    console.error(`[Integration] Failed to backup ${criticalPath}:`, err);
                }
            }
            
            console.log('[Integration] Emergency backup created at:', backupDir);
        } catch (err) {
            console.error('[Integration] Emergency backup failed:', err);
        }
    }

    /**
     * Copy directory recursively
     */
    async copyRecursive(source, target) {
        const stats = await fs.stat(source);
        
        if (stats.isDirectory()) {
            await fs.mkdir(target, { recursive: true });
            const files = await fs.readdir(source);
            
            for (const file of files) {
                await this.copyRecursive(
                    path.join(source, file),
                    path.join(target, file)
                );
            }
        } else {
            await fs.copyFile(source, target);
        }
    }

    /**
     * Start autonomous operations
     */
    async start() {
        if (this.isRunning) {
            console.log('[Integration] Already running');
            return;
        }
        
        console.log('[Integration] Starting autonomous operations...');
        
        this.isRunning = true;
        
        // Start orchestrator
        await this.orchestrator.start();
        
        // Start monitoring
        this.startMonitoring();
        
        console.log('[Integration] Autonomous operations started');
        this.emit('started');
    }

    /**
     * Start monitoring loop
     */
    startMonitoring() {
        this.monitoringInterval = setInterval(async () => {
            const status = await this.getSystemStatus();
            
            // Check for issues
            if (status.issues.length > 0) {
                for (const issue of status.issues) {
                    this.orchestrator.queueTask({
                        type: 'resolve-issue',
                        target: issue,
                        priority: 'high'
                    });
                }
            }
            
            // Update metrics
            this.emit('status', status);
        }, 30000); // Every 30 seconds
    }

    /**
     * Get system status
     */
    async getSystemStatus() {
        const status = {
            timestamp: Date.now(),
            integration: {
                running: this.isRunning,
                mappings: this.integrationMap.size
            },
            orchestrator: this.orchestrator.getStatus(),
            autonomy: {
                enabled: this.orchestrator.isAutonomyEnabled(),
                globalConfig: this.orchestrator.globalConfig?.autonomy || {},
                emergencyDisabled: this.orchestrator.globalConfig?.autonomy?.emergencyDisable || false
            },
            issues: [],
            metrics: {}
        };
        
        // Check for issues
        if (!this.orchestrator.isRunning) {
            status.issues.push({
                type: 'orchestrator-stopped',
                severity: 'high'
            });
        }
        
        // Collect metrics
        status.metrics = {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage()
        };
        
        return status;
    }

    /**
     * Stop autonomous operations
     */
    async stop() {
        console.log('[Integration] Stopping autonomous operations...');
        
        this.isRunning = false;
        
        // Stop monitoring
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        // Stop orchestrator
        if (this.orchestrator) {
            await this.orchestrator.shutdown();
        }
        
        console.log('[Integration] Stopped');
        this.emit('stopped');
    }

    /**
     * CLI interface for autonomous operations
     */
    async executeCommand(command, args = []) {
        switch (command) {
            case 'start':
                await this.start();
                break;
            case 'stop':
                await this.stop();
                break;
            case 'status':
                const status = await this.getSystemStatus();
                console.log('System Status:', JSON.stringify(status, null, 2));
                break;
            case 'queue':
                this.orchestrator.queueTask({
                    type: args[0] || 'analyze',
                    target: args[1] || 'system',
                    priority: args[2] || 'normal'
                });
                console.log('Task queued');
                break;
            case 'agents':
                const agents = this.orchestrator.getStatus().agents;
                console.log('Active Agents:', agents);
                break;
            case 'learn':
                const learner = this.orchestrator.agents.get('learner');
                if (learner) {
                    learner.performLearningCycle();
                    console.log('Learning cycle triggered');
                }
                break;
            case 'autonomy':
                await this.handleAutonomyCommand(args);
                break;
            case 'enable-autonomy':
                await this.orchestrator.toggleAutonomy(true, args[0] || 'Manual enable', 'CLI');
                console.log('Autonomy ENABLED');
                break;
            case 'disable-autonomy':
                await this.orchestrator.toggleAutonomy(false, args[0] || 'Manual disable', 'CLI');
                console.log('Autonomy DISABLED');
                break;
            case 'emergency-stop':
                await this.orchestrator.emergencyDisableAutonomy(args[0] || 'CLI emergency stop');
                console.log('*** EMERGENCY STOP ACTIVATED ***');
                break;
            default:
                console.log('Unknown command:', command);
                console.log('Available commands: start, stop, status, queue, agents, learn, autonomy, enable-autonomy, disable-autonomy, emergency-stop');
        }
    }

    /**
     * Handle autonomy-related commands
     */
    async handleAutonomyCommand(args) {
        const subcommand = args[0];
        
        switch (subcommand) {
            case 'status':
                const isEnabled = this.orchestrator.isAutonomyEnabled();
                const config = this.orchestrator.globalConfig?.autonomy;
                console.log('\n=== AUTONOMY STATUS ===');
                console.log(`Enabled: ${isEnabled ? 'YES' : 'NO'}`);
                console.log(`Emergency Disabled: ${config?.emergencyDisable ? 'YES' : 'NO'}`);
                console.log(`Confidence Threshold: ${config?.confidenceThreshold || 0.7}`);
                console.log(`Last Toggled: ${config?.lastToggled || 'Never'}`);
                console.log(`Toggled By: ${config?.toggledBy || 'N/A'}`);
                console.log(`Manual Approval Required: ${config?.requireManualApproval ? 'YES' : 'NO'}`);
                break;
            case 'enable':
                await this.orchestrator.toggleAutonomy(true, args[1] || 'CLI command', 'CLI');
                console.log('✓ Autonomy ENABLED');
                break;
            case 'disable':
                await this.orchestrator.toggleAutonomy(false, args[1] || 'CLI command', 'CLI');
                console.log('✓ Autonomy DISABLED');
                break;
            case 'reset':
                if (this.orchestrator.globalConfig?.autonomy) {
                    this.orchestrator.globalConfig.autonomy.emergencyDisable = false;
                    await this.orchestrator.toggleAutonomy(false, 'Reset to default', 'CLI');
                    console.log('✓ Autonomy reset to default (disabled)');
                }
                break;
            default:
                console.log('Autonomy commands:');
                console.log('  autonomy status       - Show current autonomy status');
                console.log('  autonomy enable       - Enable autonomous operations');
                console.log('  autonomy disable      - Disable autonomous operations');
                console.log('  autonomy reset        - Reset autonomy settings');
        }
    }
}

// Export for use as module
module.exports = SNAutonomousIntegration;

// CLI support
if (require.main === module) {
    const integration = new SNAutonomousIntegration();
    
    (async () => {
        await integration.initialize();
        
        const command = process.argv[2];
        const args = process.argv.slice(3);
        
        if (command) {
            await integration.executeCommand(command, args);
        } else {
            // Start in autonomous mode by default
            await integration.start();
            
            console.log('Autonomous integration running. Press Ctrl+C to stop.');
            
            // Handle shutdown
            process.on('SIGINT', async () => {
                await integration.stop();
                process.exit(0);
            });
        }
    })();
}