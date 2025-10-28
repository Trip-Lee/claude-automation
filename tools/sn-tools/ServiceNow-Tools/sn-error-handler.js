#!/usr/bin/env node

/**
 * ServiceNow Tools - Error Handler Module
 * Extracted from sn-core.js for standalone usage
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class ErrorHandler {
    constructor() {
        this.logFile = path.join(__dirname, 'error.log');
        this.errorCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.criticalErrors = new Set(['ENOENT', 'EACCES', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED']);
    }

    handle(error, context = {}) {
        const errorInfo = this.analyzeError(error, context);
        this.logError(errorInfo);
        this.displayError(errorInfo);
        return errorInfo;
    }

    analyzeError(error, context) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            message: error.message || 'Unknown error',
            stack: error.stack,
            code: error.code,
            context: context,
            severity: 'medium',
            category: 'unknown',
            recoverable: true,
            suggestions: []
        };

        if (error.code) {
            errorInfo.category = this.classifyErrorCode(error.code);
            errorInfo.severity = this.criticalErrors.has(error.code) ? 'critical' : 'medium';
        }

        if (error.message) {
            const message = error.message.toLowerCase();
            if (message.includes('network') || message.includes('connection')) {
                errorInfo.category = 'network';
                errorInfo.suggestions.push('Check network connectivity', 'Verify ServiceNow instance URL');
            }
            if (message.includes('authentication') || message.includes('unauthorized')) {
                errorInfo.category = 'auth';
                errorInfo.severity = 'high';
                errorInfo.suggestions.push('Check username and password', 'Verify user permissions');
            }
            if (message.includes('timeout')) {
                errorInfo.category = 'timeout';
                errorInfo.recoverable = true;
                errorInfo.suggestions.push('Retry the operation', 'Check network speed');
            }
        }

        return errorInfo;
    }

    classifyErrorCode(code) {
        const codeMap = {
            'ENOENT': 'filesystem',
            'EACCES': 'permissions',
            'ENOTFOUND': 'network',
            'ETIMEDOUT': 'timeout',
            'ECONNREFUSED': 'connection',
            'EMFILE': 'resources'
        };
        return codeMap[code] || 'unknown';
    }

    logError(errorInfo) {
        try {
            const logEntry = { ...errorInfo, sequence: ++this.errorCount };
            fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
        } catch (logError) {
            console.error('Failed to log error:', logError.message);
        }
    }

    displayError(errorInfo) {
        const severityColors = {
            low: 'yellow',
            medium: 'red',
            high: 'red',
            critical: 'red'
        };
        const color = severityColors[errorInfo.severity] || 'red';
        const icon = errorInfo.severity === 'critical' ? '💥' : '❌';

        console.log(chalk[color](`\n${icon} Error: ${errorInfo.message}`));

        if (errorInfo.context.operation) {
            console.log(chalk.gray(`   Operation: ${errorInfo.context.operation}`));
        }

        if (errorInfo.suggestions.length > 0) {
            console.log(chalk.blue('\n💡 Suggestions:'));
            errorInfo.suggestions.forEach(suggestion => {
                console.log(chalk.blue(`   • ${suggestion}`));
            });
        }

        console.log('');
    }

    async retry(operation, context = {}) {
        let lastError;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                const errorInfo = this.analyzeError(error, { ...context, attempt });

                if (!errorInfo.recoverable || attempt === this.maxRetries) {
                    throw error;
                }

                const delay = this.retryDelay * Math.pow(2, attempt - 1);
                console.log(chalk.yellow(`⏳ Retry ${attempt}/${this.maxRetries} in ${delay}ms...`));
                await this.sleep(delay);
            }
        }
        throw lastError;
    }

    safeFileOperation(operation, filePath, context = {}) {
        try {
            return operation();
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`File not found: ${filePath}`);
            } else if (error.code === 'EACCES') {
                throw new Error(`Permission denied: ${filePath}`);
            }
            throw error;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    clearLog() {
        try {
            if (fs.existsSync(this.logFile)) {
                fs.unlinkSync(this.logFile);
            }
            this.errorCount = 0;
            console.log('✅ Error log cleared');
        } catch (error) {
            console.error('Failed to clear error log:', error.message);
        }
    }

    getStats() {
        try {
            if (!fs.existsSync(this.logFile)) {
                return { total: 0, categories: {}, severities: {} };
            }

            const logContent = fs.readFileSync(this.logFile, 'utf8');
            const lines = logContent.trim().split('\n').filter(line => line);

            const stats = {
                total: lines.length,
                categories: {},
                severities: {},
                recent: []
            };

            lines.forEach(line => {
                try {
                    const entry = JSON.parse(line);
                    stats.categories[entry.category] = (stats.categories[entry.category] || 0) + 1;
                    stats.severities[entry.severity] = (stats.severities[entry.severity] || 0) + 1;
                } catch (parseError) {
                    // Skip invalid log entries
                }
            });

            // Get recent errors (last 5)
            stats.recent = lines.slice(-5).map(line => {
                try {
                    const entry = JSON.parse(line);
                    return {
                        timestamp: entry.timestamp,
                        message: entry.message,
                        category: entry.category,
                        severity: entry.severity
                    };
                } catch (parseError) {
                    return null;
                }
            }).filter(Boolean);

            return stats;
        } catch (error) {
            return { total: 0, categories: {}, severities: {}, error: error.message };
        }
    }
}

module.exports = {
    ErrorHandler
};

// CLI interface
if (require.main === module) {
    const errorHandler = new ErrorHandler();
    const command = process.argv[2];

    switch (command) {
        case 'clear':
            errorHandler.clearLog();
            break;
        case 'stats':
            console.log(JSON.stringify(errorHandler.getStats(), null, 2));
            break;
        case 'test':
            // Test the error handler
            try {
                throw new Error('Test error for error handler');
            } catch (error) {
                errorHandler.handle(error, { operation: 'test', test: true });
            }
            break;
        default:
            console.log('ServiceNow Tools - Error Handler');
            console.log('');
            console.log('Usage:');
            console.log('  node sn-error-handler.js clear  # Clear error log');
            console.log('  node sn-error-handler.js stats  # Show error statistics');
            console.log('  node sn-error-handler.js test   # Test error handler');
    }
}