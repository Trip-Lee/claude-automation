const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_NAME = 'sn-tools-package';
const VERSION = '2.0.0';
const SOURCE_DIR = path.join(__dirname, 'ServiceNow-Tools');
const OUTPUT_DIR = path.join(__dirname, `${PACKAGE_NAME}-${VERSION}`);
const ARCHIVE_NAME = `${PACKAGE_NAME}-${VERSION}.zip`;

const CORE_FILES = [
    'servicenow-tools.js',
    'sn-auto-execute.js',
    'sn-operations.js',
    'sn-file-watcher.js',
    'sn-dependency-tracker.js',
    'sn-claude-helper.js',
    'sn-flow-tracer.js',
    'sn-agents.js',
    'sn-autonomous-integration.js',
    'package.json',
    'README.md'
];

const BATCH_FILES = [
    'sn-autonomous.bat',
    'toggle-autonomy.bat'
];

const DOCS = [
    'CREATE_ANY_RECORD_GUIDE.md',
    'EXAMPLE_OPERATIONS.md',
    'FLOW_TABLE_RELATIONSHIPS.md',
    'SN_TOOLS_OPERATIONS_GUIDE.md'
];

const SCRIPTS_DIR = path.join(__dirname, 'Scripts');
const BATCH_SCRIPTS = [
    'sn-tools.bat',
    'sn-dev-tools.bat',
    'sn-watch.bat',
    'sn-fetch-all.bat',
    'sn-process-updates.bat',
    'sn-test-connections.bat'
];

function createDirectory(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✓ Created directory: ${dir}`);
    }
}

function copyFile(src, dest) {
    try {
        fs.copyFileSync(src, dest);
        console.log(`  ✓ Copied: ${path.basename(src)}`);
    } catch (err) {
        console.warn(`  ⚠ Could not copy ${path.basename(src)}: ${err.message}`);
    }
}

function copyDirectory(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn(`  ⚠ Directory not found: ${src}`);
        return;
    }
    
    createDirectory(dest);
    const files = fs.readdirSync(src);
    
    files.forEach(file => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        
        if (fs.statSync(srcPath).isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            copyFile(srcPath, destPath);
        }
    });
}

console.log(`\n========================================`);
console.log(`ServiceNow Tools Packager v${VERSION}`);
console.log(`========================================\n`);

// Clean up previous package
if (fs.existsSync(OUTPUT_DIR)) {
    console.log(`Removing old package directory...`);
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}

// Create package structure
console.log(`Creating package structure...\n`);
createDirectory(OUTPUT_DIR);
createDirectory(path.join(OUTPUT_DIR, 'ServiceNow-Tools'));
createDirectory(path.join(OUTPUT_DIR, 'Scripts'));

// Copy core files
console.log(`\n📦 Packaging core files...`);
CORE_FILES.forEach(file => {
    const src = path.join(SOURCE_DIR, file);
    const dest = path.join(OUTPUT_DIR, 'ServiceNow-Tools', file);
    copyFile(src, dest);
});

// Copy batch files
console.log(`\n🔧 Packaging batch files...`);
BATCH_FILES.forEach(file => {
    const src = path.join(SOURCE_DIR, file);
    const dest = path.join(OUTPUT_DIR, 'ServiceNow-Tools', file);
    copyFile(src, dest);
});

// Copy documentation
console.log(`\n📚 Packaging documentation...`);
DOCS.forEach(file => {
    const src = path.join(SOURCE_DIR, file);
    const dest = path.join(OUTPUT_DIR, 'ServiceNow-Tools', file);
    copyFile(src, dest);
});

// Copy Scripts directory batch files
console.log(`\n📂 Packaging script launchers...`);
BATCH_SCRIPTS.forEach(file => {
    const src = path.join(SCRIPTS_DIR, file);
    const dest = path.join(OUTPUT_DIR, 'Scripts', file);
    copyFile(src, dest);
});

// Copy essential directories (empty structure)
console.log(`\n📁 Creating required directories...`);
const requiredDirs = [
    'temp_updates',
    'backups',
    'local_development',
    'agents',
    'agent-configs',
    'agent-rules'
];

requiredDirs.forEach(dir => {
    createDirectory(path.join(OUTPUT_DIR, 'ServiceNow-Tools', dir));
    console.log(`  ✓ Created: ${dir}/`);
});

// Create example config file (without credentials)
console.log(`\n⚙️ Creating example configuration...`);
const exampleConfig = {
    instances: {
        dev: {
            instance: "your-dev-instance.service-now.com",
            username: "your-username",
            password: "your-password"
        },
        prod: {
            instance: "your-prod-instance.service-now.com",
            username: "your-username", 
            password: "your-password"
        }
    },
    routing: {
        stories: "prod",
        default: "dev",
        tables: {
            sys_script_include: "dev",
            sys_ws_operation: "dev",
            rm_story: "prod",
            rm_epic: "prod"
        }
    },
    autonomy: {
        enabled: false,
        approval_required: true,
        max_iterations: 5,
        safety_checks: true
    }
};

fs.writeFileSync(
    path.join(OUTPUT_DIR, 'ServiceNow-Tools', 'sn-config.example.json'),
    JSON.stringify(exampleConfig, null, 2)
);
console.log(`  ✓ Created sn-config.example.json`);

// Create root-level quick access scripts
console.log(`\n🚀 Creating quick access scripts...`);
const quickAccessScripts = [
    {
        name: 'sn-setup.bat',
        content: `@echo off
echo ServiceNow Tools Setup
echo ======================
echo.
cd ServiceNow-Tools
if exist sn-config.json (
    echo Configuration already exists. Edit sn-config.json to update settings.
) else (
    echo Creating configuration from example...
    copy sn-config.example.json sn-config.json
    echo.
    echo Please edit ServiceNow-Tools\\sn-config.json with your instance details.
)
pause`
    },
    {
        name: 'sn-tools.bat',
        content: `@echo off
cd ServiceNow-Tools
node sn-auto-execute.js
pause`
    },
    {
        name: 'sn-dev.bat',
        content: `@echo off
cd Scripts
call sn-dev-tools.bat`
    }
];

quickAccessScripts.forEach(script => {
    fs.writeFileSync(path.join(OUTPUT_DIR, script.name), script.content);
    console.log(`  ✓ Created: ${script.name}`);
});

// Create package.json for npm install (if needed)
console.log(`\n📋 Finalizing package.json...`);
const packageJson = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'package.json'), 'utf8'));
packageJson.version = VERSION;
packageJson.description = "ServiceNow Tools - Packaged for distribution";
delete packageJson.private; // Remove private flag for distribution

fs.writeFileSync(
    path.join(OUTPUT_DIR, 'ServiceNow-Tools', 'package.json'),
    JSON.stringify(packageJson, null, 2)
);

// Create archive if 7-Zip is available
console.log(`\n📦 Creating ZIP archive...`);
try {
    // Try using PowerShell's Compress-Archive (works on all Windows)
    const command = `powershell -Command "Compress-Archive -Path '${OUTPUT_DIR}' -DestinationPath '${path.join(__dirname, ARCHIVE_NAME)}' -Force"`;
    execSync(command, { stdio: 'pipe' });
    console.log(`  ✓ Created ${ARCHIVE_NAME}`);
} catch (err) {
    console.log(`  ⚠ Could not create ZIP automatically. Please manually compress the ${PACKAGE_NAME}-${VERSION} folder.`);
}

// Summary
console.log(`\n========================================`);
console.log(`✅ Package created successfully!`);
console.log(`========================================`);
console.log(`\nPackage location: ${OUTPUT_DIR}`);
if (fs.existsSync(path.join(__dirname, ARCHIVE_NAME))) {
    console.log(`Archive location: ${path.join(__dirname, ARCHIVE_NAME)}`);
}
console.log(`\nNext steps for recipients:`);
console.log(`1. Extract the package to desired location`);
console.log(`2. Run 'sn-setup.bat' to configure`);
console.log(`3. Edit ServiceNow-Tools\\sn-config.json with instance details`);
console.log(`4. Run 'sn-tools.bat' to start using the tools`);
console.log(`\n`);