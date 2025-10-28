/**
 * Example: How to parse and update ServiceNow scripts from extracted JSON
 * 
 * Scripts in the extracted JSON files are stored as escaped strings
 * This shows how to properly parse, update, and prepare them for upload
 */

const fs = require('fs');

// Example function to parse and update a Script Include
function updateScriptInclude(jsonFilePath, updateFunction) {
    // 1. Read the JSON file
    const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // 2. Get the script (it's an escaped string)
    const escapedScript = data.script.value;
    
    // 3. The script is already a proper JavaScript string, just escaped for JSON
    // When parsed from JSON, it becomes a normal string with actual newlines
    console.log('Original script (first 200 chars):');
    console.log(escapedScript.substring(0, 200));
    console.log('...\n');
    
    // 4. Apply updates (example: add a new method)
    const updatedScript = updateFunction(escapedScript);
    
    // 5. Save to file for updating ServiceNow
    const outputPath = `temp_updates/${data._metadata.display_value}_updated.js`;
    fs.writeFileSync(outputPath, updatedScript);
    
    console.log('Update file created:', outputPath);
    console.log('Sys_id:', data._metadata.sys_id);
    
    return {
        sys_id: data._metadata.sys_id,
        name: data._metadata.display_value,
        outputPath: outputPath
    };
}

// Example function to parse and update a REST API operation script
function updateRestApiScript(jsonFilePath, updateFunction) {
    // 1. Read the JSON file
    const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // 2. Get the operation script (it's an escaped string)
    const escapedScript = data.operation_script.value;
    
    // 3. Apply updates
    const updatedScript = updateFunction(escapedScript);
    
    // 4. Save to file
    const outputPath = `temp_updates/${data._metadata.display_value.replace(/\s/g, '_')}_updated.js`;
    fs.writeFileSync(outputPath, updatedScript);
    
    return {
        sys_id: data._metadata.sys_id,
        name: data._metadata.display_value,
        outputPath: outputPath
    };
}

// Example update function - adds error handling
function addErrorHandling(script) {
    // Example: Add try-catch if not present
    if (!script.includes('try {')) {
        // Find the function body and wrap it
        const functionMatch = script.match(/function\s+\w+\s*\([^)]*\)\s*{/);
        if (functionMatch) {
            const startIndex = functionMatch.index + functionMatch[0].length;
            const modifiedScript = 
                script.slice(0, startIndex) + 
                '\n\ttry {\n\t\t// Original code\n' +
                script.slice(startIndex, -2).replace(/\n/g, '\n\t') +
                '\n\t} catch (error) {\n\t\tgs.error("Error in script: " + error.message);\n\t\tthrow error;\n\t}\n}';
            return modifiedScript;
        }
    }
    return script;
}

// Example usage:
/*
const result = updateScriptInclude(
    '../ServiceNow Data/Tenon/Script_Includes/Tenon_Marketing_Work_Management/ComplexFilterApiMS.json',
    addErrorHandling
);

console.log(`
To update ServiceNow:
1. Run: update-servicenow.bat
2. Choose: Script Include
3. Enter sys_id: ${result.sys_id}
4. Choose: From file
5. Enter path: ${result.outputPath}
`);
*/

module.exports = {
    updateScriptInclude,
    updateRestApiScript,
    addErrorHandling
};