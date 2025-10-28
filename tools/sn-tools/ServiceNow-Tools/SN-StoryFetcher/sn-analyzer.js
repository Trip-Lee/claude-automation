#!/usr/bin/env node

/**
 * ServiceNow Data Analyzer
 * Analyzes and works with fetched ServiceNow data
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

class ServiceNowAnalyzer {
    constructor(dataDir = "./Tenon - Stories") {
        this.dataDir = dataDir;
        this.config = this.loadConfig();
    }

    loadConfig() {
        const configPath = path.join(__dirname, "sn-config.json");
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, "utf8"));
        }
        return {};
    }

    /**
     * List all available tables with data
     */
    listTables() {
        if (!fs.existsSync(this.dataDir)) {
            console.log("No data directory found. Run sn-fetcher.js first.");
            return [];
        }

        const tables = fs.readdirSync(this.dataDir)
            .filter(item => fs.statSync(path.join(this.dataDir, item)).isDirectory());
        
        return tables;
    }

    /**
     * List all data files for a table
     */
    listDataFiles(table) {
        const tableDir = path.join(this.dataDir, table);
        const indexPath = path.join(tableDir, "index.json");
        
        if (!fs.existsSync(indexPath)) {
            return [];
        }

        const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
        return Object.entries(index);
    }

    /**
     * Load records from a data file
     */
    loadRecords(table, filename) {
        const filepath = path.join(this.dataDir, table, filename);
        if (!fs.existsSync(filepath)) {
            throw new Error(`File not found: ${filepath}`);
        }
        return JSON.parse(fs.readFileSync(filepath, "utf8"));
    }

    /**
     * Get latest data file for a table
     */
    getLatestDataFile(table) {
        const files = this.listDataFiles(table);
        if (files.length === 0) return null;
        
        // Sort by timestamp (newest first)
        files.sort((a, b) => {
            const timeA = new Date(a[1].timestamp);
            const timeB = new Date(b[1].timestamp);
            return timeB - timeA;
        });
        
        return files[0][0];
    }

    /**
     * Analyze records and provide summary
     */
    analyzeRecords(records, table) {
        const analysis = {
            totalRecords: records.length,
            fields: records.length > 0 ? Object.keys(records[0]) : [],
            fieldAnalysis: {},
            stateBreakdown: {},
            referenceFields: [],
            emptyFields: []
        };

        // Get state mapping if available
        const stateMapping = this.config.defaultTables?.[table]?.stateMapping || {};

        // Analyze each field
        analysis.fields.forEach(field => {
            const fieldData = {
                type: null,
                uniqueValues: new Set(),
                emptyCount: 0,
                sampleValues: []
            };

            records.forEach(record => {
                const value = record[field];
                
                if (value === "" || value === null || value === undefined) {
                    fieldData.emptyCount++;
                } else if (typeof value === "object" && value.link && value.value) {
                    fieldData.type = "reference";
                    fieldData.uniqueValues.add(value.value);
                } else {
                    fieldData.type = typeof value;
                    fieldData.uniqueValues.add(value);
                    if (fieldData.sampleValues.length < 3) {
                        fieldData.sampleValues.push(value);
                    }
                }

                // Track state breakdown
                if (field === "state" && value) {
                    const stateLabel = stateMapping[value] || value;
                    analysis.stateBreakdown[stateLabel] = (analysis.stateBreakdown[stateLabel] || 0) + 1;
                }
            });

            fieldData.uniqueCount = fieldData.uniqueValues.size;
            fieldData.emptyPercentage = Math.round((fieldData.emptyCount / records.length) * 100);
            
            if (fieldData.type === "reference") {
                analysis.referenceFields.push(field);
            }
            
            if (fieldData.emptyPercentage > 90) {
                analysis.emptyFields.push(field);
            }

            analysis.fieldAnalysis[field] = fieldData;
        });

        return analysis;
    }

    /**
     * Display records in a formatted way
     */
    displayRecords(records, options = {}) {
        const { 
            fields = ["short_description", "state", "assigned_to"],
            limit = 10,
            format = "table"
        } = options;

        const stateMapping = this.config.defaultTables?.rm_story?.stateMapping || {};

        console.log(`\nShowing ${Math.min(limit, records.length)} of ${records.length} records:\n`);

        if (format === "table") {
            // Display as table
            records.slice(0, limit).forEach((record, index) => {
                console.log(`[${index + 1}] ${record.short_description || "No description"}`);
                fields.forEach(field => {
                    if (field !== "short_description") {
                        let value = record[field];
                        if (typeof value === "object" && value.value) {
                            value = `[Reference: ${value.value}]`;
                        }
                        if (field === "state" && stateMapping[value]) {
                            value = `${value} (${stateMapping[value]})`;
                        }
                        console.log(`    ${field}: ${value || "N/A"}`);
                    }
                });
                console.log("");
            });
        } else {
            // Display as JSON
            console.log(JSON.stringify(records.slice(0, limit), null, 2));
        }
    }

    /**
     * Generate markdown summary of stories
     */
    generateStorySummary(records) {
        const stateMapping = this.config.defaultTables?.rm_story?.stateMapping || {};
        const summary = [];
        
        summary.push("# Story Summary\n");
        summary.push(`Generated: ${new Date().toISOString()}\n`);
        summary.push(`Total Stories: ${records.length}\n`);
        
        // Group by state
        const byState = {};
        records.forEach(record => {
            const state = stateMapping[record.state] || record.state || "Unknown";
            if (!byState[state]) byState[state] = [];
            byState[state].push(record);
        });
        
        // Display by state
        Object.entries(byState).forEach(([state, stories]) => {
            summary.push(`\n## ${state} (${stories.length})\n`);
            stories.forEach(story => {
                summary.push(`- **${story.short_description || "No description"}**`);
                if (story.description) {
                    const desc = story.description.replace(/<[^>]*>/g, "").substring(0, 100);
                    if (desc.trim()) summary.push(`\n  ${desc}...`);
                }
                if (story.u_figma) {
                    summary.push(`\n  [Figma](${story.u_figma})`);
                }
                summary.push("\n");
            });
        });
        
        return summary.join("");
    }

    /**
     * Export records to CSV
     */
    exportToCSV(records, filename) {
        if (records.length === 0) {
            console.log("No records to export");
            return;
        }

        const fields = Object.keys(records[0]);
        const csv = [];
        
        // Header
        csv.push(fields.join(","));
        
        // Data
        records.forEach(record => {
            const row = fields.map(field => {
                let value = record[field];
                if (typeof value === "object" && value.value) {
                    value = value.value;
                }
                // Escape quotes and wrap in quotes if contains comma
                if (typeof value === "string") {
                    value = value.replace(/"/g, '""');
                    if (value.includes(",") || value.includes("\n")) {
                        value = `"${value}"`;
                    }
                }
                return value || "";
            });
            csv.push(row.join(","));
        });
        
        fs.writeFileSync(filename, csv.join("\n"));
        console.log(`Exported to ${filename}`);
    }
}

/**
 * Interactive menu
 */
async function main() {
    console.log("ServiceNow Data Analyzer");
    console.log("========================\n");

    const analyzer = new ServiceNowAnalyzer();
    
    // List available tables
    const tables = analyzer.listTables();
    if (tables.length === 0) {
        console.log("No data found. Please run sn-fetcher.js first.");
        return;
    }

    console.log("Available tables:");
    tables.forEach((table, index) => {
        console.log(`${index + 1}. ${table}`);
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const tableChoice = await new Promise(resolve => {
        rl.question("\nSelect table (number or name): ", resolve);
    });

    let selectedTable;
    if (!isNaN(tableChoice)) {
        selectedTable = tables[parseInt(tableChoice) - 1];
    } else {
        selectedTable = tableChoice;
    }

    if (!selectedTable || !tables.includes(selectedTable)) {
        console.log("Invalid table selection");
        rl.close();
        return;
    }

    // Get latest data file
    const latestFile = analyzer.getLatestDataFile(selectedTable);
    if (!latestFile) {
        console.log("No data files found for this table");
        rl.close();
        return;
    }

    console.log(`\nLoading data from: ${latestFile}`);
    const records = analyzer.loadRecords(selectedTable, latestFile);
    console.log(`Loaded ${records.length} records\n`);

    // Menu loop
    let running = true;
    while (running) {
        console.log("\nOptions:");
        console.log("1. Show analysis summary");
        console.log("2. Display records");
        console.log("3. Generate story summary (markdown)");
        console.log("4. Export to CSV");
        console.log("5. Show specific fields");
        console.log("6. Filter by state");
        console.log("0. Exit");

        const choice = await new Promise(resolve => {
            rl.question("\nSelect option: ", resolve);
        });

        switch (choice) {
            case "1":
                const analysis = analyzer.analyzeRecords(records, selectedTable);
                console.log("\nAnalysis Summary:");
                console.log(`Total Records: ${analysis.totalRecords}`);
                console.log(`Total Fields: ${analysis.fields.length}`);
                console.log(`Reference Fields: ${analysis.referenceFields.join(", ") || "None"}`);
                console.log(`Empty Fields (>90%): ${analysis.emptyFields.join(", ") || "None"}`);
                
                if (Object.keys(analysis.stateBreakdown).length > 0) {
                    console.log("\nState Breakdown:");
                    Object.entries(analysis.stateBreakdown).forEach(([state, count]) => {
                        console.log(`  ${state}: ${count}`);
                    });
                }
                break;

            case "2":
                const displayLimit = await new Promise(resolve => {
                    rl.question("How many records to display? (default 10): ", answer => {
                        resolve(answer ? parseInt(answer) : 10);
                    });
                });
                analyzer.displayRecords(records, { limit: displayLimit });
                break;

            case "3":
                const summary = analyzer.generateStorySummary(records);
                const summaryFile = `${selectedTable}_summary_${new Date().toISOString().split("T")[0]}.md`;
                fs.writeFileSync(summaryFile, summary);
                console.log(`Summary saved to: ${summaryFile}`);
                break;

            case "4":
                const csvFile = `${selectedTable}_export_${new Date().toISOString().split("T")[0]}.csv`;
                analyzer.exportToCSV(records, csvFile);
                break;

            case "5":
                console.log("Available fields:");
                const fields = Object.keys(records[0] || {});
                console.log(fields.join(", "));
                
                const selectedFields = await new Promise(resolve => {
                    rl.question("Enter fields to display (comma-separated): ", resolve);
                });
                
                const fieldList = selectedFields.split(",").map(f => f.trim());
                analyzer.displayRecords(records, { fields: fieldList, limit: 10 });
                break;

            case "6":
                const stateMapping = analyzer.config.defaultTables?.[selectedTable]?.stateMapping || {};
                console.log("Available states:");
                const states = [...new Set(records.map(r => r.state))];
                states.forEach(state => {
                    const label = stateMapping[state] || state;
                    console.log(`  ${state}: ${label}`);
                });
                
                const selectedState = await new Promise(resolve => {
                    rl.question("Enter state code: ", resolve);
                });
                
                const filtered = records.filter(r => r.state === selectedState);
                console.log(`Found ${filtered.length} records with state ${selectedState}`);
                if (filtered.length > 0) {
                    analyzer.displayRecords(filtered, { limit: 10 });
                }
                break;

            case "0":
                running = false;
                break;

            default:
                console.log("Invalid option");
        }
    }

    rl.close();
    console.log("\nGoodbye!");
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ServiceNowAnalyzer;