/**
 * Monitor Agent - Autonomous monitoring and anomaly detection
 * Watches for changes, patterns, and issues in the ServiceNow environment
 */

const AutonomousAgent = require('./autonomous-agent');
const fs = require('fs').promises;
const path = require('path');
// const chokidar = require('chokidar'); // Optional dependency for file watching

class MonitorAgent extends AutonomousAgent {
    constructor(name, config = {}) {
        super(name, {
            ...config,
            autonomous: {
                enabled: true,
                confidenceThreshold: 0.6,
                decisionInterval: 3000,
                ...config.autonomous
            }
        });
        
        this.watchers = new Map();
        this.anomalies = [];
        this.baselines = new Map();
        this.alerts = [];
        
        // Monitoring targets
        this.monitoringTargets = {
            files: new Set(),
            directories: new Set(),
            patterns: new Map(),
            metrics: new Map()
        };
        
        // Thresholds for anomaly detection
        this.thresholds = {
            errorRate: 0.1,
            fileChangeRate: 10, // files per minute
            memoryUsage: 0.8,
            responseTime: 5000,
            ...config.thresholds
        };
    }

    /**
     * Initialize monitoring capabilities
     */
    async initialize() {
        await super.initialize();
        
        this.log('Initializing monitoring capabilities...', 'cyan');
        
        // Setup file watchers
        await this.setupFileWatchers();
        
        // Establish baselines
        await this.establishBaselines();
        
        // Start monitoring loops
        this.startMonitoring();
        
        this.log('Monitor agent ready', 'green');
    }

    /**
     * Setup file watchers for key directories
     */
    async setupFileWatchers() {
        const watchPaths = [
            path.join(this.rootPath, 'ServiceNow-Tools', 'temp_updates'),
            path.join(this.rootPath, 'ServiceNow-Tools', 'local_development'),
            path.join(this.rootPath, 'ServiceNow-Data')
        ];
        
        for (const watchPath of watchPaths) {
            try {
                // Simplified file watching for testing without chokidar
                this.monitoringTargets.directories.add(watchPath);
                this.log(`Would watch: ${watchPath} (simplified mode)`, 'dim');
            } catch (err) {
                this.log(`Failed to setup watch ${watchPath}: ${err.message}`, 'yellow');
            }
        }
    }

    /**
     * Handle file system events
     */
    async handleFileEvent(event, filePath) {
        const fileEvent = {
            type: event,
            path: filePath,
            timestamp: Date.now()
        };
        
        this.memory.store('file-event', fileEvent);
        
        // Check for anomalies
        if (await this.isAnomalousFileActivity(fileEvent)) {
            await this.handleAnomaly('file-activity', fileEvent);
        }
        
        // Trigger autonomous decision if needed
        if (event === 'add' && filePath.includes('temp_updates')) {
            this.emit('pending-update-detected', fileEvent);
            
            // Queue task for processing
            this.queueTask({
                type: 'process-update',
                target: filePath,
                priority: 'high'
            });
        }
    }

    /**
     * Establish performance baselines
     */
    async establishBaselines() {
        this.log('Establishing performance baselines...', 'cyan');
        
        // Memory usage baseline
        const memUsage = process.memoryUsage();
        this.baselines.set('memory', {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            timestamp: Date.now()
        });
        
        // File count baselines
        for (const dir of this.monitoringTargets.directories) {
            try {
                const files = await fs.readdir(dir);
                this.baselines.set(`fileCount-${dir}`, {
                    count: files.length,
                    timestamp: Date.now()
                });
            } catch (err) {
                // Directory might not exist
            }
        }
        
        // Response time baseline
        const startTime = Date.now();
        await this.performHealthCheck();
        const responseTime = Date.now() - startTime;
        this.baselines.set('responseTime', {
            value: responseTime,
            timestamp: Date.now()
        });
    }

    /**
     * Start monitoring loops
     */
    startMonitoring() {
        // Performance monitoring
        setInterval(() => this.monitorPerformance(), 10000);
        
        // Anomaly detection
        setInterval(() => this.detectAnomalies(), 15000);
        
        // Health checks
        setInterval(() => this.performHealthCheck(), 30000);
    }

    /**
     * Monitor system performance
     */
    async monitorPerformance() {
        const metrics = {
            timestamp: Date.now(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            uptime: process.uptime()
        };
        
        this.memory.store('performance', metrics);
        
        // Check against thresholds
        const memoryUsageRatio = metrics.memory.heapUsed / metrics.memory.heapTotal;
        if (memoryUsageRatio > this.thresholds.memoryUsage) {
            await this.handleAnomaly('high-memory', {
                usage: memoryUsageRatio,
                metrics
            });
        }
        
        // Update monitoring metrics
        this.monitoringTargets.metrics.set('performance', metrics);
    }

    /**
     * Detect anomalies in monitored data
     */
    async detectAnomalies() {
        const anomalies = [];
        
        // Check file change rate
        const recentFileEvents = this.memory.getByType('file-event', 100);
        const fileChangeRate = this.calculateRate(recentFileEvents, 60000); // Per minute
        
        if (fileChangeRate > this.thresholds.fileChangeRate) {
            anomalies.push({
                type: 'high-file-change-rate',
                value: fileChangeRate,
                threshold: this.thresholds.fileChangeRate
            });
        }
        
        // Check error rate
        const recentErrors = this.memory.getByType('error', 100);
        const errorRate = recentErrors.length / 100;
        
        if (errorRate > this.thresholds.errorRate) {
            anomalies.push({
                type: 'high-error-rate',
                value: errorRate,
                threshold: this.thresholds.errorRate
            });
        }
        
        // Check for pattern anomalies
        for (const [pattern, config] of this.monitoringTargets.patterns) {
            if (await this.checkPatternAnomaly(pattern, config)) {
                anomalies.push({
                    type: 'pattern-anomaly',
                    pattern,
                    config
                });
            }
        }
        
        // Handle detected anomalies
        for (const anomaly of anomalies) {
            await this.handleAnomaly('detected', anomaly);
        }
        
        this.anomalies = anomalies;
    }

    /**
     * Check for anomalous file activity
     */
    async isAnomalousFileActivity(fileEvent) {
        // Get recent file events
        const recentEvents = this.memory.getByType('file-event', 50);
        
        // Check for rapid succession of changes
        const recentSimilar = recentEvents.filter(e => 
            e.data.path === fileEvent.path &&
            Date.now() - e.timestamp < 5000
        );
        
        if (recentSimilar.length > 3) {
            return true; // Rapid changes to same file
        }
        
        // Check for suspicious patterns
        if (fileEvent.path.includes('node_modules') || 
            fileEvent.path.includes('.git') ||
            fileEvent.path.endsWith('.exe')) {
            return true; // Suspicious location or file type
        }
        
        return false;
    }

    /**
     * Handle detected anomaly
     */
    async handleAnomaly(type, data) {
        const anomaly = {
            id: Date.now().toString(),
            type,
            data,
            timestamp: Date.now(),
            severity: this.calculateSeverity(type, data)
        };
        
        this.log(`Anomaly detected: ${type} (severity: ${anomaly.severity})`, 'yellow');
        
        // Store in memory
        this.memory.store('anomaly', anomaly);
        
        // Create alert if high severity
        if (anomaly.severity >= 7) {
            await this.createAlert(anomaly);
        }
        
        // Trigger autonomous response
        if (anomaly.severity >= 5) {
            this.queueTask({
                type: 'investigate-anomaly',
                target: anomaly,
                priority: anomaly.severity >= 8 ? 'critical' : 'high'
            });
        }
        
        this.emit('anomaly-detected', anomaly);
    }

    /**
     * Calculate anomaly severity
     */
    calculateSeverity(type, data) {
        switch (type) {
            case 'high-memory': return 7;
            case 'high-error-rate': return 8;
            case 'high-file-change-rate': return 6;
            case 'file-activity': return 5;
            case 'pattern-anomaly': return 6;
            default: return 5;
        }
    }

    /**
     * Create an alert
     */
    async createAlert(anomaly) {
        const alert = {
            id: Date.now().toString(),
            anomaly,
            timestamp: Date.now(),
            status: 'active',
            message: `High severity anomaly detected: ${anomaly.type}`
        };
        
        this.alerts.push(alert);
        
        this.log(`ALERT: ${alert.message}`, 'red');
        
        // Emit alert for orchestrator
        this.emit('alert', alert);
        
        // Take immediate action for critical alerts
        if (anomaly.severity >= 9) {
            await this.takeEmergencyAction(anomaly);
        }
    }

    /**
     * Take emergency action for critical issues
     */
    async takeEmergencyAction(anomaly) {
        this.log('Taking emergency action', 'bright');
        
        switch (anomaly.type) {
            case 'high-error-rate':
                // Pause processing
                this.emit('pause-processing', { reason: 'high-error-rate' });
                break;
            case 'security-breach':
                // Lock down system
                this.emit('security-lockdown', anomaly);
                break;
            default:
                // Generic emergency response
                this.emit('emergency', anomaly);
        }
    }

    /**
     * Perform health check
     */
    async performHealthCheck() {
        const health = {
            timestamp: Date.now(),
            status: 'healthy',
            checks: []
        };
        
        // Check file watchers
        for (const [path, watcher] of this.watchers) {
            health.checks.push({
                type: 'watcher',
                path,
                status: watcher ? 'active' : 'inactive'
            });
        }
        
        // Check memory usage
        const memUsage = process.memoryUsage();
        const memRatio = memUsage.heapUsed / memUsage.heapTotal;
        health.checks.push({
            type: 'memory',
            usage: memRatio,
            status: memRatio < this.thresholds.memoryUsage ? 'healthy' : 'warning'
        });
        
        // Check anomaly count
        health.checks.push({
            type: 'anomalies',
            count: this.anomalies.length,
            status: this.anomalies.length < 5 ? 'healthy' : 'warning'
        });
        
        // Determine overall health
        const warnings = health.checks.filter(c => c.status === 'warning').length;
        const errors = health.checks.filter(c => c.status === 'error').length;
        
        if (errors > 0) health.status = 'error';
        else if (warnings > 2) health.status = 'warning';
        
        this.memory.store('health-check', health);
        
        return health;
    }

    /**
     * Calculate rate of events
     */
    calculateRate(events, timeWindow) {
        const now = Date.now();
        const recentEvents = events.filter(e => now - e.timestamp < timeWindow);
        return recentEvents.length / (timeWindow / 60000); // Per minute
    }

    /**
     * Check for pattern anomaly
     */
    async checkPatternAnomaly(pattern, config) {
        // Implementation depends on pattern type
        return false;
    }

    /**
     * Handle watch error
     */
    handleWatchError(error) {
        this.log(`Watch error: ${error.message}`, 'red');
        this.memory.store('error', { type: 'watch-error', error: error.message });
    }

    /**
     * Override action implementations
     */
    async analyzeTarget(target, params) {
        if (target === 'file') {
            // Analyze file for issues
            try {
                const content = await fs.readFile(params.path, 'utf8');
                return {
                    analysis: 'file-analysis',
                    size: content.length,
                    lines: content.split('\n').length,
                    hasErrors: content.includes('error') || content.includes('Error')
                };
            } catch (err) {
                return { analysis: 'file-analysis', error: err.message };
            }
        }
        
        return super.analyzeTarget(target, params);
    }

    async investigateIssue(target, params) {
        const investigation = {
            target,
            timestamp: Date.now(),
            findings: []
        };
        
        if (target === 'error') {
            // Look for error patterns
            const recentErrors = this.memory.getByType('error', 20);
            investigation.findings = recentErrors.map(e => ({
                time: e.timestamp,
                error: e.data
            }));
        } else if (target.type === 'investigate-anomaly') {
            // Investigate the anomaly
            investigation.findings.push({
                anomaly: target.target,
                context: this.memory.getRecentMemories(10)
            });
        }
        
        return investigation;
    }

    /**
     * Get monitoring status
     */
    getStatus() {
        const baseStatus = super.getStatus();
        return {
            ...baseStatus,
            monitoring: {
                directories: Array.from(this.monitoringTargets.directories),
                watchers: this.watchers.size,
                anomalies: this.anomalies.length,
                alerts: this.alerts.filter(a => a.status === 'active').length,
                metrics: Object.fromEntries(this.monitoringTargets.metrics)
            }
        };
    }

    /**
     * Stop monitoring
     */
    async stop() {
        this.log('Stopping monitoring...', 'yellow');
        
        // Close all watchers
        for (const [path, watcher] of this.watchers) {
            await watcher.close();
        }
        
        await super.stop();
    }
}

module.exports = MonitorAgent;