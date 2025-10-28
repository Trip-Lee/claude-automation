/**
 * Enhanced AI Integration for ServiceNow Tools
 * Supports Claude Code (MCP) and Claude API
 */

const chalk = require('chalk');
const { TableFieldMapper } = require('./sn-table-field-mapper');

class EnhancedAIIntegration {
    constructor() {
        this.mapper = new TableFieldMapper();
        this.hasClaudeCode = this.detectClaudeCode();
    }

    /**
     * Detect if running inside Claude Code environment
     */
    detectClaudeCode() {
        // Check for Claude Code environment variables or indicators
        return process.env.CLAUDE_CODE === 'true' ||
               process.env.MCP_ENABLED === 'true' ||
               typeof global.claudeCode !== 'undefined';
    }

    /**
     * Create a record using AI assistance
     * @param {string} table - Table name
     * @param {string} userPrompt - User's description of what to create
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Result with record data
     */
    async createRecord(table, userPrompt, options = {}) {
        const {
            includeContext = true,
            includeSchema = true,
            includeExamples = true,
            exampleFile = null
        } = options;

        try {
            console.log(chalk.blue('🤖 Using AI to generate record...'));

            // Get table schema for context
            let schema = null;
            if (includeSchema) {
                schema = await this.getTableSchema(table);
            }

            // Build the AI prompt with context
            const aiPrompt = this.buildAIPrompt(table, userPrompt, schema, {
                includeContext,
                includeExamples,
                exampleFile
            });

            // Try Claude Code first, then fall back to API
            let recordData;
            let provider;

            if (this.hasClaudeCode) {
                console.log(chalk.blue('   Using Claude Code (MCP)...'));
                recordData = await this.generateViaClaudeCode(aiPrompt, table, schema);
                provider = 'Claude Code';
            } else {
                console.log(chalk.blue('   Using Claude API...'));
                recordData = await this.generateViaClaudeAPI(aiPrompt, table, schema);
                provider = 'Claude API';
            }

            return {
                success: true,
                record: recordData,
                provider: provider,
                metadata: {
                    summary: `Generated ${table} record from user prompt`,
                    confidence: 0.85
                }
            };

        } catch (error) {
            console.error(chalk.red(`❌ AI generation error: ${error.message}`));
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get table schema information
     */
    async getTableSchema(table) {
        try {
            const fields = await this.mapper.getFieldsForTable(table, true);

            if (!fields || fields.length === 0) {
                console.log(chalk.gray('   No fields found, proceeding without schema'));
                return null;
            }

            // Filter to important fields for AI (but keep sys_class_name for inheritance)
            const relevantFields = fields.filter(f =>
                !f.read_only &&
                !f.element.startsWith('sys_') &&
                f.element !== 'sys_id' &&
                f.element !== 'sys_created_by' &&
                f.element !== 'sys_created_on' &&
                f.element !== 'sys_updated_by' &&
                f.element !== 'sys_updated_on' &&
                f.element !== 'sys_mod_count'
            );

            return {
                table: table,
                fields: relevantFields.map(f => ({
                    name: f.element,
                    label: f.column_label || f.element,
                    type: f.internal_type,
                    mandatory: f.mandatory || false,
                    reference: f.reference || null,
                    max_length: f.max_length || null,
                    choices: f.choices || null
                }))
            };
        } catch (error) {
            console.log(chalk.gray(`   Could not fetch schema (${error.message}), proceeding without it`));
            return null;
        }
    }

    /**
     * Build a comprehensive AI prompt
     */
    buildAIPrompt(table, userPrompt, schema, options) {
        let prompt = `Generate a ServiceNow ${table} record based on this description:\n\n`;
        prompt += `"${userPrompt}"\n\n`;

        if (schema && schema.fields) {
            prompt += `The ${table} table has the following fields:\n\n`;

            schema.fields.forEach(field => {
                const mandatory = field.mandatory ? ' (REQUIRED)' : '';
                const ref = field.reference ? ` -> references ${field.reference}` : '';
                prompt += `- ${field.name} (${field.label})${mandatory}: ${field.type}${ref}\n`;
            });

            prompt += `\n`;
        }

        prompt += `Requirements:\n`;
        prompt += `1. Generate valid JSON with appropriate field values\n`;
        prompt += `2. Use realistic, meaningful data based on the description\n`;
        prompt += `3. Fill all REQUIRED fields\n`;
        prompt += `4. For reference fields, use valid sys_ids or provide placeholder values\n`;
        prompt += `5. For script fields, generate actual working JavaScript code\n`;
        prompt += `6. Return ONLY the JSON object, no explanations\n\n`;

        prompt += `Example format:\n`;
        prompt += `{\n`;
        prompt += `  "field_name": "value",\n`;
        prompt += `  "another_field": "value"\n`;
        prompt += `}\n`;

        return prompt;
    }

    /**
     * Generate record via Claude Code (when running inside Claude Code)
     */
    async generateViaClaudeCode(prompt, table, schema) {
        // When running in Claude Code, we can use console output to communicate
        // Claude Code will see this request and can help generate the record

        console.log(chalk.yellow('\n╔════════════════════════════════════════════════════════════╗'));
        console.log(chalk.yellow('║  🤖 AI ASSISTANCE REQUESTED                                ║'));
        console.log(chalk.yellow('╚════════════════════════════════════════════════════════════╝'));
        console.log();
        console.log(chalk.cyan('Please generate a JSON object for this record:'));
        console.log(chalk.white(prompt));
        console.log();
        console.log(chalk.gray('Paste the generated JSON below (or press Ctrl+C to cancel):'));
        console.log();

        // Read from stdin
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve, reject) => {
            let jsonInput = '';
            let lineCount = 0;

            rl.on('line', (line) => {
                jsonInput += line + '\n';
                lineCount++;

                // Try to parse after each line to detect completion
                try {
                    const parsed = JSON.parse(jsonInput.trim());
                    rl.close();
                    resolve(parsed);
                } catch (e) {
                    // Not complete JSON yet, continue reading
                    if (lineCount > 200) {
                        rl.close();
                        reject(new Error('Input too long, please provide valid JSON'));
                    }
                }
            });

            rl.on('close', () => {
                if (jsonInput.trim()) {
                    try {
                        const parsed = JSON.parse(jsonInput.trim());
                        resolve(parsed);
                    } catch (error) {
                        reject(new Error(`Invalid JSON: ${error.message}`));
                    }
                } else {
                    reject(new Error('No input provided - operation cancelled'));
                }
            });

            // Handle Ctrl+C gracefully
            rl.on('SIGINT', () => {
                rl.close();
                reject(new Error('Operation cancelled by user'));
            });
        });
    }

    /**
     * Generate record via Claude API
     */
    async generateViaClaudeAPI(prompt, table, schema) {
        // Check for API key first
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY not found in environment variables.\n\nTo use Claude API:\n1. Set ANTHROPIC_API_KEY environment variable\n2. Or install @anthropic-ai/sdk: npm install @anthropic-ai/sdk\n3. Or use Claude Code for manual input');
        }

        // Try to load the SDK
        let anthropic;
        try {
            anthropic = require('@anthropic-ai/sdk');
        } catch (error) {
            throw new Error('@anthropic-ai/sdk not installed.\n\nInstall it with: npm install @anthropic-ai/sdk\n\nOr run this inside Claude Code for manual AI assistance.');
        }

        const client = new anthropic.Anthropic({
            apiKey: apiKey
        });

        console.log(chalk.blue('   Calling Claude API...'));

        try {
            const response = await client.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 4096,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7
            });

            const content = response.content[0].text;

            // Extract JSON from response (Claude might add explanation text)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Could not extract JSON from AI response');
            }

            const recordData = JSON.parse(jsonMatch[0]);

            console.log(chalk.green('   ✓ AI generated record data'));
            return recordData;
        } catch (error) {
            if (error.status === 401) {
                throw new Error('Invalid ANTHROPIC_API_KEY. Please check your API key.');
            } else if (error.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            } else {
                throw new Error(`Claude API error: ${error.message}`);
            }
        }
    }

    /**
     * Update a record using AI assistance
     */
    async updateRecord(table, sysId, userPrompt, currentRecord, options = {}) {
        // Similar to createRecord but for updates
        // TODO: Implement if needed
        throw new Error('AI-assisted updates not yet implemented');
    }
}

module.exports = { EnhancedAIIntegration };
