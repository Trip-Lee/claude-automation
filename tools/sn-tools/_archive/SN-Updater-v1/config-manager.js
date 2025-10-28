/**
 * ServiceNow Configuration Manager
 * Handles configuration setup, validation, and management
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

class ConfigManager {
    constructor(configPath = null) {
        this.configPath = configPath || path.join(__dirname, 'sn-config.json');
        this.encryptedConfigPath = path.join(__dirname, '.sn-config.enc');
        this.exampleConfigPath = path.join(__dirname, 'sn-config.example.json');
    }

    /**
     * Check if configuration exists
     */
    exists() {
        return fs.existsSync(this.configPath) || fs.existsSync(this.encryptedConfigPath);
    }

    /**
     * Load configuration
     */
    load() {
        if (fs.existsSync(this.configPath)) {
            return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        } else if (fs.existsSync(this.encryptedConfigPath)) {
            return this.loadEncrypted();
        } else {
            throw new Error('Configuration not found. Run setup first.');
        }
    }

    /**
     * Save configuration
     */
    save(config, encrypt = false) {
        if (encrypt) {
            this.saveEncrypted(config);
            // Remove plain text config if it exists
            if (fs.existsSync(this.configPath)) {
                fs.unlinkSync(this.configPath);
            }
        } else {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
            // Remove encrypted config if it exists
            if (fs.existsSync(this.encryptedConfigPath)) {
                fs.unlinkSync(this.encryptedConfigPath);
            }
        }
    }

    /**
     * Interactive setup
     */
    async setup(options = {}) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (prompt) => new Promise(resolve => {
            rl.question(prompt, resolve);
        });

        console.log('ServiceNow Configuration Setup');
        console.log('==============================');
        console.log('');

        // Check for existing config
        if (this.exists() && !options.force) {
            const overwrite = await question('Configuration already exists. Overwrite? (y/N): ');
            if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
                console.log('Setup cancelled.');
                rl.close();
                return false;
            }
        }

        // Get configuration values
        const config = {};

        // Instance
        console.log('Enter your ServiceNow instance URL');
        console.log('Example: dev123456.service-now.com');
        config.instance = await question('Instance: ');
        
        // Clean up instance URL
        config.instance = config.instance
            .replace('https://', '')
            .replace('http://', '')
            .replace(/\/$/, '');

        // Username
        config.username = await question('Username: ');

        // Password (hidden input would be better, but keeping it simple)
        config.password = await question('Password: ');

        // Optional settings
        const advancedSetup = await question('\nConfigure advanced settings? (y/N): ');
        if (advancedSetup.toLowerCase() === 'y' || advancedSetup.toLowerCase() === 'yes') {
            // Timeout
            const timeout = await question('API timeout in seconds (default: 30): ');
            config.timeout = timeout ? parseInt(timeout) * 1000 : 30000;

            // Proxy
            const useProxy = await question('Use proxy? (y/N): ');
            if (useProxy.toLowerCase() === 'y' || useProxy.toLowerCase() === 'yes') {
                config.proxy = await question('Proxy URL: ');
            }

            // Custom headers
            const customHeaders = await question('Add custom headers? (y/N): ');
            if (customHeaders.toLowerCase() === 'y' || customHeaders.toLowerCase() === 'yes') {
                config.headers = {};
                let addMore = true;
                while (addMore) {
                    const headerName = await question('Header name (or press Enter to finish): ');
                    if (!headerName) {
                        addMore = false;
                    } else {
                        const headerValue = await question(`Header value for ${headerName}: `);
                        config.headers[headerName] = headerValue;
                    }
                }
            }
        }

        // Encryption option
        const encrypt = await question('\nEncrypt configuration? (recommended) (Y/n): ');
        const shouldEncrypt = encrypt.toLowerCase() !== 'n' && encrypt.toLowerCase() !== 'no';

        // Test connection
        console.log('\nTesting connection...');
        try {
            await this.testConnection(config);
            console.log('✓ Connection successful!');
        } catch (error) {
            console.error('✗ Connection failed:', error.message);
            const saveAnyway = await question('Save configuration anyway? (y/N): ');
            if (saveAnyway.toLowerCase() !== 'y' && saveAnyway.toLowerCase() !== 'yes') {
                console.log('Setup cancelled.');
                rl.close();
                return false;
            }
        }

        // Save configuration
        this.save(config, shouldEncrypt);
        console.log(`\n✓ Configuration saved to ${shouldEncrypt ? '.sn-config.enc (encrypted)' : 'sn-config.json'}`);

        // Create example config if it doesn't exist
        if (!fs.existsSync(this.exampleConfigPath)) {
            const exampleConfig = {
                instance: 'your-instance.service-now.com',
                username: 'your-username',
                password: 'your-password',
                timeout: 30000,
                proxy: 'http://proxy.example.com:8080',
                headers: {
                    'X-Custom-Header': 'value'
                }
            };
            fs.writeFileSync(this.exampleConfigPath, JSON.stringify(exampleConfig, null, 2));
        }

        rl.close();
        return true;
    }

    /**
     * Test connection with given configuration
     */
    async testConnection(config) {
        const https = require('https');
        const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

        return new Promise((resolve, reject) => {
            const options = {
                hostname: config.instance,
                path: '/api/now/table/sys_user?sysparm_limit=1',
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else if (res.statusCode === 401) {
                    reject(new Error('Invalid credentials'));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
                res.on('data', () => {}); // Consume response
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Connection timeout'));
            });

            req.end();
        });
    }

    /**
     * Validate configuration
     */
    validate(config) {
        const required = ['instance', 'username', 'password'];
        const missing = required.filter(field => !config[field]);

        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        // Validate instance format
        if (!config.instance.match(/^[a-z0-9-]+\.service-now\.com$/)) {
            console.warn('Warning: Instance URL may be invalid. Expected format: instance-name.service-now.com');
        }

        return true;
    }

    /**
     * Simple encryption for storing credentials
     */
    saveEncrypted(config) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(config.username, 'sn-tools-salt', 32);
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const data = {
            iv: iv.toString('hex'),
            data: encrypted,
            hint: config.instance
        };

        fs.writeFileSync(this.encryptedConfigPath, JSON.stringify(data));
    }

    /**
     * Decrypt configuration
     */
    loadEncrypted() {
        const data = JSON.parse(fs.readFileSync(this.encryptedConfigPath, 'utf8'));
        
        // We need username to decrypt, so we'll need to prompt for it
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log(`Instance: ${data.hint}`);
        rl.question('Username: ', (username) => {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(username, 'sn-tools-salt', 32);
            const iv = Buffer.from(data.iv, 'hex');

            try {
                const decipher = crypto.createDecipheriv(algorithm, key, iv);
                let decrypted = decipher.update(data.data, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                
                rl.close();
                return JSON.parse(decrypted);
            } catch (error) {
                console.error('Failed to decrypt configuration. Wrong username?');
                rl.close();
                throw error;
            }
        });
    }

    /**
     * Display current configuration (with password hidden)
     */
    display() {
        const config = this.load();
        const displayConfig = { ...config };
        
        if (displayConfig.password) {
            displayConfig.password = '********';
        }

        console.log('Current Configuration:');
        console.log(JSON.stringify(displayConfig, null, 2));
    }

    /**
     * Export configuration (without sensitive data)
     */
    export(outputPath) {
        const config = this.load();
        const exportConfig = { ...config };
        
        delete exportConfig.password;
        exportConfig.password = '<REDACTED>';

        fs.writeFileSync(outputPath, JSON.stringify(exportConfig, null, 2));
        console.log(`Configuration exported to ${outputPath} (password redacted)`);
    }
}

module.exports = ConfigManager;

// CLI interface when run directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const manager = new ConfigManager();
    
    async function main() {
        try {
            switch (command) {
                case 'setup':
                    await manager.setup({ force: args.includes('--force') });
                    break;
                    
                case 'test':
                    const config = manager.load();
                    await manager.testConnection(config);
                    console.log('✓ Connection successful!');
                    break;
                    
                case 'display':
                case 'show':
                    manager.display();
                    break;
                    
                case 'export':
                    const outputPath = args[1] || 'config-export.json';
                    manager.export(outputPath);
                    break;
                    
                case 'validate':
                    const configToValidate = manager.load();
                    manager.validate(configToValidate);
                    console.log('✓ Configuration is valid');
                    break;
                    
                default:
                    console.log('ServiceNow Configuration Manager');
                    console.log('');
                    console.log('Commands:');
                    console.log('  setup        - Interactive configuration setup');
                    console.log('    --force    - Overwrite existing configuration');
                    console.log('  test         - Test connection to ServiceNow');
                    console.log('  display      - Show current configuration');
                    console.log('  export [file] - Export configuration (password redacted)');
                    console.log('  validate     - Validate configuration');
                    console.log('');
                    console.log('Examples:');
                    console.log('  node config-manager.js setup');
                    console.log('  node config-manager.js test');
                    console.log('  node config-manager.js display');
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    }
    
    main();
}