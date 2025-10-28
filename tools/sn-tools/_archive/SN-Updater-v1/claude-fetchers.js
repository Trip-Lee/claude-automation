/**
 * Claude Fetcher Runner
 * Allows Claude to run the ServiceNow fetchers directly
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const fetcherType = args[0]; // 'story' or 'data'

if (!fetcherType || !['story', 'data'].includes(fetcherType)) {
    console.error('Usage: node claude-fetchers.js [story|data]');
    console.log('  story - Run the SN-StoryFetcher');
    console.log('  data  - Run the SN-DataFetcher');
    process.exit(1);
}

const rootDir = path.join(__dirname, '..');

function runStoryFetcher() {
    const storyFetcherDir = path.join(rootDir, 'SN-StoryFetcher');
    
    console.log('=========================================');
    console.log('     ServiceNow Story Fetcher');
    console.log('=========================================');
    console.log(`Directory: ${storyFetcherDir}`);
    console.log('');

    // Check if directory exists
    if (!fs.existsSync(storyFetcherDir)) {
        console.error('Error: SN-StoryFetcher directory not found!');
        process.exit(1);
    }

    // Check if sn-fetcher.js exists
    const fetcherScript = path.join(storyFetcherDir, 'sn-fetcher.js');
    if (!fs.existsSync(fetcherScript)) {
        console.error('Error: sn-fetcher.js not found!');
        process.exit(1);
    }

    console.log('Running Story Fetcher...');
    const fetcher = spawn('node', ['sn-fetcher.js'], {
        cwd: storyFetcherDir,
        stdio: 'inherit'
    });

    fetcher.on('close', (code) => {
        if (code === 0) {
            console.log('\n✓ Story fetcher completed successfully!');
        } else {
            console.error(`\nStory fetcher failed with exit code ${code}`);
        }
        process.exit(code);
    });

    fetcher.on('error', (error) => {
        console.error('Error running story fetcher:', error.message);
        process.exit(1);
    });
}

function runDataFetcher() {
    const dataFetcherDir = path.join(rootDir, 'SN - DataFetcher');
    
    console.log('=========================================');
    console.log('     ServiceNow Data Fetcher');
    console.log('=========================================');
    console.log(`Directory: ${dataFetcherDir}`);
    console.log('');

    // Check if directory exists
    if (!fs.existsSync(dataFetcherDir)) {
        console.error('Error: SN - DataFetcher directory not found!');
        process.exit(1);
    }

    // Check if index.js exists
    const fetcherScript = path.join(dataFetcherDir, 'index.js');
    if (!fs.existsSync(fetcherScript)) {
        console.error('Error: index.js not found!');
        process.exit(1);
    }

    // Check if node_modules exists, install if needed
    const nodeModulesDir = path.join(dataFetcherDir, 'node_modules');
    if (!fs.existsSync(nodeModulesDir)) {
        console.log('Installing npm dependencies...');
        const npmInstall = spawn('npm', ['install'], {
            cwd: dataFetcherDir,
            stdio: 'inherit'
        });

        npmInstall.on('close', (code) => {
            if (code === 0) {
                console.log('Dependencies installed successfully.');
                startDataFetcher();
            } else {
                console.error(`npm install failed with exit code ${code}`);
                process.exit(1);
            }
        });

        npmInstall.on('error', (error) => {
            console.error('Error installing dependencies:', error.message);
            process.exit(1);
        });
    } else {
        startDataFetcher();
    }

    function startDataFetcher() {
        console.log('Running Data Fetcher...');
        const fetcher = spawn('node', ['index.js'], {
            cwd: dataFetcherDir,
            stdio: 'inherit'
        });

        fetcher.on('close', (code) => {
            if (code === 0) {
                console.log('\n✓ Data fetcher completed successfully!');
            } else {
                console.error(`\nData fetcher failed with exit code ${code}`);
            }
            process.exit(code);
        });

        fetcher.on('error', (error) => {
            console.error('Error running data fetcher:', error.message);
            process.exit(1);
        });
    }
}

// Run the appropriate fetcher
if (fetcherType === 'story') {
    runStoryFetcher();
} else if (fetcherType === 'data') {
    runDataFetcher();
}