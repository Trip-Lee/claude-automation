/**
 * ServiceNow Claude Helper
 * Features designed to help Claude assist with development tasks more effectively
 */

const fs = require('fs');
const path = require('path');

class ServiceNowClaudeHelper {
    constructor() {
        this.logFile = path.join(__dirname, 'claude-activity.log');
        this.contextFile = path.join(__dirname, 'claude-context.json');
        this.errorFile = path.join(__dirname, 'claude-errors.log');
        this.summaryFile = path.join(__dirname, 'claude-summary.md');
    }

    /**
     * Log Claude activity for context
     */
    logActivity(action, details, success = true) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            action,
            details,
            success,
            duration: details.duration || 0
        };

        // Append to log file
        const logLine = `${timestamp} | ${success ? '✓' : '✗'} | ${action} | ${JSON.stringify(details)}\n`;
        fs.appendFileSync(this.logFile, logLine);

        // Update context
        this.updateContext(logEntry);

        console.log(`📝 Logged: ${action} (${success ? 'Success' : 'Failed'})`);
    }

    /**
     * Update Claude context file
     */
    updateContext(logEntry) {
        let context = { recentActions: [], statistics: {}, lastUpdate: '' };
        
        if (fs.existsSync(this.contextFile)) {
            try {
                context = JSON.parse(fs.readFileSync(this.contextFile, 'utf8'));
            } catch (e) {
                // File corrupted, start fresh
            }
        }

        // Add to recent actions (keep last 20)
        context.recentActions.unshift(logEntry);
        context.recentActions = context.recentActions.slice(0, 20);

        // Update statistics
        if (!context.statistics[logEntry.action]) {
            context.statistics[logEntry.action] = { total: 0, success: 0, failures: 0 };
        }
        context.statistics[logEntry.action].total++;
        if (logEntry.success) {
            context.statistics[logEntry.action].success++;
        } else {
            context.statistics[logEntry.action].failures++;
        }

        context.lastUpdate = new Date().toISOString();
        
        fs.writeFileSync(this.contextFile, JSON.stringify(context, null, 2));
    }

    /**
     * Create context summary for Claude
     */
    generateContextSummary() {
        let summary = '# Claude Development Context\n\n';
        
        // Recent activity
        if (fs.existsSync(this.contextFile)) {
            const context = JSON.parse(fs.readFileSync(this.contextFile, 'utf8'));
            
            summary += '## Recent Activity\n\n';
            context.recentActions.slice(0, 5).forEach(action => {
                const status = action.success ? '✓' : '✗';
                const time = new Date(action.timestamp).toLocaleString();
                summary += `- ${status} **${action.action}** - ${time}\n`;
                if (action.details.error) {
                    summary += `  - Error: ${action.details.error}\n`;
                }
                if (action.details.files) {
                    summary += `  - Files: ${action.details.files.join(', ')}\n`;
                }
            });

            summary += '\n## Statistics\n\n';
            Object.entries(context.statistics).forEach(([action, stats]) => {
                const successRate = ((stats.success / stats.total) * 100).toFixed(1);
                summary += `- **${action}**: ${stats.total} total, ${successRate}% success rate\n`;
            });
        }

        // Current project state
        summary += '\n## Current Project State\n\n';
        summary += this.generateProjectState();

        // Recent errors
        if (fs.existsSync(this.errorFile)) {
            summary += '\n## Recent Errors\n\n';
            const errors = fs.readFileSync(this.errorFile, 'utf8').split('\n').slice(-10);
            errors.filter(err => err.trim()).forEach(error => {
                summary += `- ${error}\n`;
            });
        }

        // Pending items
        summary += '\n## Pending Items\n\n';
        summary += this.getPendingItems();

        // Save summary
        fs.writeFileSync(this.summaryFile, summary);
        console.log('📋 Context summary generated: claude-summary.md');
        
        return summary;
    }

    /**
     * Generate project state info
     */
    generateProjectState() {
        let state = '';
        
        // Check temp_updates
        const tempDir = path.join(__dirname, 'temp_updates');
        if (fs.existsSync(tempDir)) {
            const pending = fs.readdirSync(tempDir).filter(f => f.endsWith('.js'));
            state += `- Pending updates: ${pending.length} files\n`;
            if (pending.length > 0) {
                state += `  - Files: ${pending.slice(0, 5).join(', ')}${pending.length > 5 ? '...' : ''}\n`;
            }
        }

        // Check backups
        const backupDir = path.join(__dirname, 'backups');
        if (fs.existsSync(backupDir)) {
            const backups = fs.readdirSync(backupDir).filter(f => f.endsWith('.backup'));
            state += `- Available backups: ${backups.length}\n`;
        }

        // Check configuration
        const configFile = path.join(__dirname, 'sn-config.json');
        if (fs.existsSync(configFile)) {
            try {
                const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                const instances = Object.keys(config.instances || {});
                state += `- Configured instances: ${instances.join(', ')}\n`;
            } catch (e) {
                state += '- Configuration: Error reading config\n';
            }
        } else {
            state += '- Configuration: Not configured\n';
        }

        return state || '- No significant state information available\n';
    }

    /**
     * Get pending items
     */
    getPendingItems() {
        let items = '';
        
        // Check for common issues
        const issuesFile = path.join(__dirname, 'known-issues.json');
        if (fs.existsSync(issuesFile)) {
            try {
                const issues = JSON.parse(fs.readFileSync(issuesFile, 'utf8'));
                issues.forEach(issue => {
                    items += `- **${issue.type}**: ${issue.description}\n`;
                });
            } catch (e) {
                // Ignore
            }
        }
        
        return items || '- No pending items identified\n';
    }

    /**
     * Log error for Claude context
     */
    logError(error, context = {}) {
        const timestamp = new Date().toISOString();
        const errorEntry = `${timestamp} | ${error.message || error} | ${JSON.stringify(context)}`;
        
        fs.appendFileSync(this.errorFile, errorEntry + '\n');
        
        this.logActivity('error_occurred', {
            error: error.message || error,
            context
        }, false);
    }

    /**
     * Create code change documentation
     */
    documentCodeChange(file, changeType, description, sysId = null) {
        const timestamp = new Date().toISOString();
        const changeDoc = {
            timestamp,
            file: path.relative(__dirname, file),
            changeType, // 'created', 'modified', 'deleted'
            description,
            sysId
        };

        // Update CLAUDE.md with change
        this.updateClaudeMd(changeDoc);

        this.logActivity('code_change', changeDoc, true);
    }

    /**
     * Update CLAUDE.md with change information
     */
    updateClaudeMd(changeDoc) {
        const claudeMdPath = path.join(__dirname, '..', 'CLAUDE.md');
        
        if (!fs.existsSync(claudeMdPath)) return;

        let content = fs.readFileSync(claudeMdPath, 'utf8');
        
        // Find or create recent changes section
        const recentChangesMarker = '## Recent Changes (Auto-Generated)';
        
        if (!content.includes(recentChangesMarker)) {
            content += '\n\n' + recentChangesMarker + '\n\n';
        }

        // Add new change
        const changeEntry = `- **${changeDoc.timestamp.split('T')[0]}**: ${changeDoc.changeType} \`${changeDoc.file}\` - ${changeDoc.description}\n`;
        
        const lines = content.split('\n');
        const markerIndex = lines.findIndex(line => line.includes(recentChangesMarker));
        
        if (markerIndex !== -1) {
            lines.splice(markerIndex + 2, 0, changeEntry.trim());
            
            // Keep only last 10 changes
            const changeLines = lines.slice(markerIndex + 2).filter(line => line.startsWith('- **'));
            const otherLines = lines.slice(markerIndex + 2).filter(line => !line.startsWith('- **'));
            
            const recentChangeLines = changeLines.slice(0, 10);
            lines.splice(markerIndex + 2, lines.length - markerIndex - 2, ...recentChangeLines, ...otherLines);
        }

        fs.writeFileSync(claudeMdPath, lines.join('\n'));
    }

    /**
     * Generate fix script from error
     */
    generateFixScript(errorMessage, context = {}) {
        const fixes = {
            'HTTP 401': 'Check credentials in sn-config.json',
            'HTTP 404': 'Verify sys_id and table name are correct',
            'Connection timeout': 'Check network connection and firewall settings',
            'File not found': 'Verify file paths are correct',
            'Invalid type': 'Check supported types: script_include, rest_api, business_rule, ui_action, client_script',
            'Configuration not found': 'Run sn-setup.bat to configure'
        };

        let fixScript = '#!/bin/bash\n';
        fixScript += `# Auto-generated fix script for: ${errorMessage}\n`;
        fixScript += `# Generated: ${new Date().toISOString()}\n\n`;

        // Find matching fix
        const matchingFix = Object.entries(fixes).find(([key]) => 
            errorMessage.toLowerCase().includes(key.toLowerCase())
        );

        if (matchingFix) {
            fixScript += `echo "Suggested fix: ${matchingFix[1]}"\n`;
            
            // Add specific commands based on error type
            if (matchingFix[0] === 'Configuration not found') {
                fixScript += 'node sn-operations.js test\n';
                fixScript += 'echo "If test fails, run sn-setup.bat"\n';
            } else if (matchingFix[0].startsWith('HTTP')) {
                fixScript += 'node sn-operations.js test\n';
                fixScript += 'echo "Testing connection to all configured instances"\n';
            }
        } else {
            fixScript += 'echo "No automatic fix available for this error"\n';
            fixScript += 'echo "Please review error details and check documentation"\n';
        }

        const fixScriptPath = path.join(__dirname, 'auto-fix.sh');
        fs.writeFileSync(fixScriptPath, fixScript);
        
        console.log('🔧 Generated fix script: auto-fix.sh');
        return fixScriptPath;
    }

    /**
     * Create development session report
     */
    generateSessionReport() {
        const report = {
            sessionStart: this.getSessionStart(),
            duration: this.getSessionDuration(),
            activitiesCount: this.getActivitiesCount(),
            filesModified: this.getFilesModified(),
            errors: this.getErrorCount(),
            successRate: this.getSuccessRate()
        };

        const reportPath = path.join(__dirname, 'session-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log('📊 Session report generated');
        return report;
    }

    /**
     * Helper methods for session reporting
     */
    getSessionStart() {
        if (!fs.existsSync(this.contextFile)) return null;
        
        try {
            const context = JSON.parse(fs.readFileSync(this.contextFile, 'utf8'));
            if (context.recentActions.length > 0) {
                return context.recentActions[context.recentActions.length - 1].timestamp;
            }
        } catch (e) {
            // Ignore
        }
        
        return null;
    }

    getSessionDuration() {
        const start = this.getSessionStart();
        if (!start) return 0;
        
        return Date.now() - new Date(start).getTime();
    }

    getActivitiesCount() {
        if (!fs.existsSync(this.contextFile)) return 0;
        
        try {
            const context = JSON.parse(fs.readFileSync(this.contextFile, 'utf8'));
            return context.recentActions.length;
        } catch (e) {
            return 0;
        }
    }

    getFilesModified() {
        const tempDir = path.join(__dirname, 'temp_updates', 'processed');
        if (!fs.existsSync(tempDir)) return 0;
        
        return fs.readdirSync(tempDir).filter(f => f.endsWith('.js')).length;
    }

    getErrorCount() {
        if (!fs.existsSync(this.errorFile)) return 0;
        
        const content = fs.readFileSync(this.errorFile, 'utf8');
        return content.split('\n').filter(line => line.trim()).length;
    }

    getSuccessRate() {
        if (!fs.existsSync(this.contextFile)) return 0;
        
        try {
            const context = JSON.parse(fs.readFileSync(this.contextFile, 'utf8'));
            const total = Object.values(context.statistics).reduce((sum, stat) => sum + stat.total, 0);
            const success = Object.values(context.statistics).reduce((sum, stat) => sum + stat.success, 0);
            
            return total > 0 ? (success / total * 100) : 0;
        } catch (e) {
            return 0;
        }
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    const helper = new ServiceNowClaudeHelper();

    switch (command) {
        case 'log':
            if (args.length < 3) {
                console.log('Usage: node sn-claude-helper.js log [action] [details] [success]');
                process.exit(1);
            }
            helper.logActivity(args[1], { message: args[2] }, args[3] !== 'false');
            break;

        case 'error':
            if (args.length < 2) {
                console.log('Usage: node sn-claude-helper.js error [error-message] [context]');
                process.exit(1);
            }
            helper.logError(args[1], { context: args[2] || '' });
            helper.generateFixScript(args[1]);
            break;

        case 'summary':
            helper.generateContextSummary();
            break;

        case 'report':
            helper.generateSessionReport();
            break;

        case 'document':
            if (args.length < 4) {
                console.log('Usage: node sn-claude-helper.js document [file] [changeType] [description] [sysId]');
                process.exit(1);
            }
            helper.documentCodeChange(args[1], args[2], args[3], args[4]);
            break;

        default:
            console.log('ServiceNow Claude Helper');
            console.log('');
            console.log('Commands:');
            console.log('  log [action] [details] [success]  - Log activity');
            console.log('  error [message] [context]         - Log error and generate fix script');
            console.log('  summary                           - Generate context summary');
            console.log('  report                            - Generate session report');
            console.log('  document [file] [type] [desc]     - Document code change');
            console.log('');
            console.log('Examples:');
            console.log('  node sn-claude-helper.js log "update_record" "Updated UserUtils" true');
            console.log('  node sn-claude-helper.js error "HTTP 401" "Failed authentication"');
            console.log('  node sn-claude-helper.js summary');
    }
}

module.exports = ServiceNowClaudeHelper;