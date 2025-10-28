#!/usr/bin/env node

/**
 * ServiceNow Field Validation Utilities
 *
 * This module provides comprehensive validation for ServiceNow field types
 * with detailed error messages and type-specific validation rules.
 *
 * Features:
 * - Type-specific validation (string, integer, date, email, etc.)
 * - Length and format validation
 * - Reference field validation
 * - Choice field validation
 * - Custom validation rules
 *
 * Author: ServiceNow Tools
 * Version: 1.0.0
 */

const chalk = require('chalk');

class FieldValidator {
    constructor() {
        // Email regex pattern
        this.emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

        // Phone number patterns
        this.phonePatterns = {
            e164: /^\+[1-9]\d{1,14}$/,
            us: /^(\+1|1)?[\s.-]?\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})$/,
            general: /^[\+]?[0-9\s\-\(\)]{7,15}$/
        };

        // URL pattern
        this.urlPattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

        // ServiceNow sys_id pattern (32-character hexadecimal)
        this.sysIdPattern = /^[a-f0-9]{32}$/i;

        // Date patterns
        this.datePatterns = {
            iso: /^\d{4}-\d{2}-\d{2}$/,
            datetime: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
            time: /^\d{2}:\d{2}:\d{2}$/
        };
    }

    /**
     * Validate a field value based on field definition
     * @param {any} value - The value to validate
     * @param {Object} field - Field definition
     * @param {boolean} isMandatory - Whether the field is mandatory
     * @returns {Object} Validation result with isValid and message
     */
    validateField(value, field, isMandatory = false) {
        const result = {
            isValid: true,
            message: null,
            sanitizedValue: value
        };

        // Handle empty values
        if (value === null || value === undefined || value === '') {
            if (isMandatory) {
                result.isValid = false;
                result.message = chalk.red(`${field.column_label || field.element} is mandatory and cannot be empty`);
            }
            return result;
        }

        // Type-specific validation
        switch (field.internal_type) {
            case 'string':
                return this.validateString(value, field);

            case 'integer':
                return this.validateInteger(value, field);

            case 'decimal':
            case 'float':
            case 'currency':
                return this.validateDecimal(value, field);

            case 'boolean':
                return this.validateBoolean(value, field);

            case 'email':
                return this.validateEmail(value, field);

            case 'phone_number_e164':
                return this.validatePhoneNumber(value, field);

            case 'url':
                return this.validateUrl(value, field);

            case 'reference':
                return this.validateReference(value, field);

            case 'glide_date':
                return this.validateDate(value, field);

            case 'glide_date_time':
                return this.validateDateTime(value, field);

            case 'glide_time':
                return this.validateTime(value, field);

            case 'choice':
                return this.validateChoice(value, field);

            case 'GUID':
                return this.validateGUID(value, field);

            case 'script':
            case 'script_plain':
                return this.validateScript(value, field);

            case 'html':
                return this.validateHtml(value, field);

            case 'json':
                return this.validateJson(value, field);

            case 'password2':
                return this.validatePassword(value, field);

            default:
                // Generic string validation for unknown types
                return this.validateString(value, field);
        }
    }

    /**
     * Validate string fields
     */
    validateString(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        if (typeof value !== 'string') {
            value = String(value);
            result.sanitizedValue = value;
        }

        // Length validation
        if (field.max_length) {
            const maxLength = parseInt(field.max_length);
            if (value.length > maxLength) {
                result.isValid = false;
                result.message = chalk.red(`Value too long. Maximum ${maxLength} characters allowed (current: ${value.length})`);
                return result;
            }
        }

        // Additional validation for string subtypes
        if (field.element && field.element.includes('email')) {
            return this.validateEmail(value, field);
        }

        return result;
    }

    /**
     * Validate integer fields
     */
    validateInteger(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        // Convert to number if string
        if (typeof value === 'string') {
            // Remove common formatting (commas, spaces)
            let cleaned = value.trim()
                .replace(/,/g, '')      // Remove commas: 1,234 -> 1234
                .replace(/\s+/g, '');   // Remove spaces

            // Check if the cleaned string contains a decimal point
            if (cleaned.includes('.')) {
                result.isValid = false;
                result.message = chalk.red('Please enter a valid integer (no decimals)');
                return result;
            }

            const parsed = parseInt(cleaned, 10);
            if (isNaN(parsed)) {
                result.isValid = false;
                result.message = chalk.red('Please enter a valid integer');
                return result;
            }
            result.sanitizedValue = parsed;
        } else if (typeof value === 'number') {
            if (!Number.isInteger(value)) {
                result.isValid = false;
                result.message = chalk.red('Please enter a valid integer (no decimals)');
                return result;
            }
        } else {
            result.isValid = false;
            result.message = chalk.red('Please enter a valid integer');
            return result;
        }

        return result;
    }

    /**
     * Validate decimal/float/currency fields
     */
    validateDecimal(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        // Convert to number if string
        if (typeof value === 'string') {
            // Remove common formatting (commas, currency symbols, spaces)
            let cleaned = value.trim()
                .replace(/,/g, '')      // Remove commas: 1,234.56 -> 1234.56
                .replace(/\$/g, '')     // Remove dollar signs: $123.45 -> 123.45
                .replace(/£/g, '')      // Remove pound signs
                .replace(/€/g, '')      // Remove euro signs
                .replace(/\s+/g, '');   // Remove spaces

            const parsed = parseFloat(cleaned);
            if (isNaN(parsed)) {
                result.isValid = false;
                result.message = chalk.red('Please enter a valid number');
                return result;
            }
            result.sanitizedValue = parsed;
        } else if (typeof value !== 'number') {
            result.isValid = false;
            result.message = chalk.red('Please enter a valid number');
            return result;
        }

        return result;
    }

    /**
     * Validate boolean fields
     */
    validateBoolean(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (['true', 'false', 'yes', 'no', '1', '0'].includes(lower)) {
                result.sanitizedValue = ['true', 'yes', '1'].includes(lower);
            } else {
                result.isValid = false;
                result.message = chalk.red('Please enter true/false, yes/no, or 1/0');
                return result;
            }
        } else if (typeof value !== 'boolean') {
            result.isValid = false;
            result.message = chalk.red('Please enter a boolean value');
            return result;
        }

        return result;
    }

    /**
     * Validate email fields
     */
    validateEmail(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        if (typeof value !== 'string') {
            result.isValid = false;
            result.message = chalk.red('Email must be a string');
            return result;
        }

        // Trim and lowercase the email
        const cleaned = value.trim().toLowerCase();
        result.sanitizedValue = cleaned;

        if (!this.emailPattern.test(cleaned)) {
            result.isValid = false;
            result.message = chalk.red('Please enter a valid email address (e.g., user@example.com)');
            return result;
        }

        return result;
    }

    /**
     * Validate phone number fields
     */
    validatePhoneNumber(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        if (typeof value !== 'string') {
            value = String(value);
        }

        // Clean the phone number - preserve + but remove common formatting
        let cleaned = value.trim();

        // Store original for validation
        const original = cleaned;

        // Try E.164 format first
        if (this.phonePatterns.e164.test(cleaned)) {
            result.sanitizedValue = cleaned;
            return result;
        }

        // Try US format and convert to E.164 if possible
        const usMatch = cleaned.match(this.phonePatterns.us);
        if (usMatch) {
            // Convert to E.164: +1XXXXXXXXXX
            const digits = cleaned.replace(/\D/g, '');
            if (digits.length === 10) {
                result.sanitizedValue = `+1${digits}`;
                return result;
            } else if (digits.length === 11 && digits.startsWith('1')) {
                result.sanitizedValue = `+${digits}`;
                return result;
            }
        }

        // Try general format - just clean it
        if (this.phonePatterns.general.test(cleaned)) {
            result.sanitizedValue = cleaned;
            return result;
        }

        result.isValid = false;
        result.message = chalk.red('Please enter a valid phone number (e.g., +1234567890 or (123) 456-7890)');
        return result;
    }

    /**
     * Validate URL fields
     */
    validateUrl(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        if (typeof value !== 'string') {
            result.isValid = false;
            result.message = chalk.red('URL must be a string');
            return result;
        }

        if (!this.urlPattern.test(value)) {
            result.isValid = false;
            result.message = chalk.red('Please enter a valid URL (e.g., https://example.com)');
            return result;
        }

        return result;
    }

    /**
     * Validate reference fields (sys_id)
     */
    validateReference(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        if (typeof value !== 'string') {
            value = String(value);
            result.sanitizedValue = value;
        }

        if (!this.sysIdPattern.test(value)) {
            result.isValid = false;
            const refTable = field.reference ? ` (references ${field.reference})` : '';
            result.message = chalk.red(`Please enter a valid 32-character sys_id${refTable}`);
            return result;
        }

        return result;
    }

    /**
     * Validate date fields
     */
    validateDate(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        if (typeof value !== 'string') {
            value = String(value);
        }

        const cleaned = value.trim();

        // Try to parse common date formats and convert to YYYY-MM-DD
        let formatted = cleaned;

        // If already in ISO format, use it
        if (this.datePatterns.iso.test(cleaned)) {
            formatted = cleaned;
        }
        // Try MM/DD/YYYY format
        else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleaned)) {
            const [month, day, year] = cleaned.split('/');
            formatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        // Try DD-MM-YYYY format
        else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleaned)) {
            const [day, month, year] = cleaned.split('-');
            formatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        // Try relative dates like "today", "tomorrow", "yesterday"
        else if (cleaned.toLowerCase() === 'today') {
            formatted = new Date().toISOString().split('T')[0];
        }
        else if (cleaned.toLowerCase() === 'tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            formatted = tomorrow.toISOString().split('T')[0];
        }
        else if (cleaned.toLowerCase() === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            formatted = yesterday.toISOString().split('T')[0];
        }
        else {
            result.isValid = false;
            result.message = chalk.red('Please enter date in YYYY-MM-DD format (or MM/DD/YYYY, or "today", "tomorrow", "yesterday")');
            return result;
        }

        // Validate that it's a real date
        const date = new Date(formatted);
        if (isNaN(date.getTime())) {
            result.isValid = false;
            result.message = chalk.red('Please enter a valid date');
            return result;
        }

        result.sanitizedValue = formatted;
        return result;
    }

    /**
     * Validate datetime fields
     */
    validateDateTime(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        if (typeof value !== 'string') {
            value = String(value);
        }

        const cleaned = value.trim();
        let formatted = cleaned;

        // Handle "now" keyword
        if (cleaned.toLowerCase() === 'now') {
            const now = new Date();
            formatted = now.toISOString().replace('T', ' ').split('.')[0];
            result.sanitizedValue = formatted;
            return result;
        }

        // If already in correct format, use it
        if (this.datePatterns.datetime.test(cleaned)) {
            formatted = cleaned;
        }
        // Try ISO format with T separator
        else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(cleaned)) {
            formatted = cleaned.replace('T', ' ').split('.')[0];
        }
        else {
            result.isValid = false;
            result.message = chalk.red('Please enter datetime in YYYY-MM-DD HH:MM:SS format (or "now")');
            return result;
        }

        // Validate that it's a real datetime
        const date = new Date(formatted.replace(' ', 'T'));
        if (isNaN(date.getTime())) {
            result.isValid = false;
            result.message = chalk.red('Please enter a valid datetime');
            return result;
        }

        result.sanitizedValue = formatted;
        return result;
    }

    /**
     * Validate time fields
     */
    validateTime(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        if (typeof value !== 'string') {
            value = String(value);
            result.sanitizedValue = value;
        }

        if (!this.datePatterns.time.test(value)) {
            result.isValid = false;
            result.message = chalk.red('Please enter time in HH:MM:SS format');
            return result;
        }

        return result;
    }

    /**
     * Validate choice fields
     */
    validateChoice(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        // For now, accept any string value for choice fields
        // In a more advanced implementation, we could validate against actual choice options
        if (typeof value !== 'string') {
            value = String(value);
            result.sanitizedValue = value;
        }

        return result;
    }

    /**
     * Validate GUID fields
     */
    validateGUID(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        if (typeof value !== 'string') {
            value = String(value);
            result.sanitizedValue = value;
        }

        // GUID pattern: 8-4-4-4-12 hexadecimal
        const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!guidPattern.test(value)) {
            result.isValid = false;
            result.message = chalk.red('Please enter a valid GUID (e.g., 550e8400-e29b-41d4-a716-446655440000)');
            return result;
        }

        return result;
    }

    /**
     * Validate script fields
     */
    validateScript(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        if (typeof value !== 'string') {
            value = String(value);
            result.sanitizedValue = value;
        }

        // Basic JavaScript syntax check (very basic)
        try {
            // Try to create a function to test basic syntax
            new Function(value);
        } catch (e) {
            result.isValid = false;
            result.message = chalk.red(`Script syntax error: ${e.message}`);
            return result;
        }

        return result;
    }

    /**
     * Validate HTML fields
     */
    validateHtml(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        if (typeof value !== 'string') {
            value = String(value);
            result.sanitizedValue = value;
        }

        // Basic HTML validation - check for unclosed tags
        const openTags = value.match(/<[^\/][^>]*>/g) || [];
        const closeTags = value.match(/<\/[^>]*>/g) || [];

        if (openTags.length !== closeTags.length) {
            result.isValid = false;
            result.message = chalk.yellow('Warning: HTML may have unclosed tags');
            // Don't fail validation, just warn
            result.isValid = true;
        }

        return result;
    }

    /**
     * Validate JSON fields
     */
    validateJson(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        if (typeof value !== 'string') {
            value = String(value);
            result.sanitizedValue = value;
        }

        try {
            JSON.parse(value);
        } catch (e) {
            result.isValid = false;
            result.message = chalk.red(`Invalid JSON: ${e.message}`);
            return result;
        }

        return result;
    }

    /**
     * Validate password fields
     */
    validatePassword(value, field) {
        const result = { isValid: true, message: null, sanitizedValue: value };

        if (typeof value !== 'string') {
            value = String(value);
            result.sanitizedValue = value;
        }

        // Basic password validation
        if (value.length < 8) {
            result.isValid = false;
            result.message = chalk.red('Password must be at least 8 characters long');
            return result;
        }

        return result;
    }

    /**
     * Get field validation hints for user input
     * @param {Object} field - Field definition
     * @returns {string} Hint text for the user
     */
    getFieldHints(field) {
        const hints = [];

        switch (field.internal_type) {
            case 'string':
                if (field.max_length) {
                    hints.push(`max ${field.max_length} chars`);
                }
                break;

            case 'integer':
                hints.push('whole numbers only');
                break;

            case 'decimal':
            case 'float':
            case 'currency':
                hints.push('decimal numbers allowed');
                break;

            case 'email':
                hints.push('format: user@example.com');
                break;

            case 'phone_number_e164':
                hints.push('format: +1234567890 or (123) 456-7890');
                break;

            case 'url':
                hints.push('format: https://example.com');
                break;

            case 'reference':
                const refTable = field.reference ? ` to ${field.reference}` : '';
                hints.push(`32-character sys_id${refTable}`);
                break;

            case 'glide_date':
                hints.push('format: YYYY-MM-DD');
                break;

            case 'glide_date_time':
                hints.push('format: YYYY-MM-DD HH:MM:SS');
                break;

            case 'glide_time':
                hints.push('format: HH:MM:SS');
                break;

            case 'boolean':
                hints.push('true/false, yes/no, or 1/0');
                break;

            case 'GUID':
                hints.push('format: 550e8400-e29b-41d4-a716-446655440000');
                break;
        }

        return hints.length > 0 ? chalk.gray(`(${hints.join(', ')})`) : '';
    }
}

module.exports = { FieldValidator };