/**
 * ServiceNow Dependency Visualizer
 * Generates interactive visual dependency graphs using D3.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ServiceNowDependencyTracker = require('./sn-dependency-tracker');

class ServiceNowDependencyVisualizer {
    constructor() {
        this.tracker = new ServiceNowDependencyTracker();
        this.outputDir = path.join(__dirname, 'dependency-graphs');
        
        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Generate complete dependency graph data
     */
    async generateGraphData(options = {}) {
        const {
            includeComponents = true,
            includeApis = true,
            includeScriptIncludes = true,
            focusOn = null,
            depth = 3,
            expensiveAllTrace = false
        } = options;

        console.log('📊 Generating dependency graph data...');
        
        // Ensure we have fresh data
        if (!this.tracker.dependencies.components.size) {
            console.log('No cached data found, scanning codebase...');
            await this.tracker.scanAll();
        }

        const nodes = [];
        const links = [];
        const nodeMap = new Map();
        let nodeId = 0;

        // Helper to add node
        const addNode = (id, label, type, metadata = {}) => {
            if (!nodeMap.has(id)) {
                const node = {
                    id,
                    label,
                    type,
                    nodeId: nodeId++,
                    ...metadata
                };
                nodes.push(node);
                nodeMap.set(id, node);
            }
            return nodeMap.get(id);
        };

        // Helper to add link
        const addLink = (sourceId, targetId, type = 'uses') => {
            const source = nodeMap.get(sourceId);
            const target = nodeMap.get(targetId);
            if (source && target) {
                links.push({
                    source: source.nodeId,
                    target: target.nodeId,
                    type,
                    sourceId,
                    targetId
                });
            }
        };

        // Process components
        if (includeComponents) {
            this.tracker.dependencies.components.forEach((comp, name) => {
                const compId = `component:${name}`;
                addNode(compId, name, 'component', {
                    path: comp.path,
                    componentType: comp.type,
                    apiCount: comp.apis.size,
                    actionCount: comp.actions.size
                });

                // Add API connections
                if (includeApis) {
                    comp.apis.forEach(api => {
                        const apiId = `api:${api}`;
                        addNode(apiId, api, 'api', { endpoint: api });
                        addLink(compId, apiId, 'calls');
                    });
                }
            });
        }

        // Process REST APIs
        if (includeApis) {
            this.tracker.dependencies.apis.forEach((api, key) => {
                const apiId = `api:${api.path || key}`;
                
                // Ensure API node exists
                if (!nodeMap.has(apiId)) {
                    addNode(apiId, api.name || key, 'api', {
                        resource: api.resource,
                        method: api.method,
                        path: api.path,
                        sysId: api.sysId
                    });
                }

                // Add Script Include connections
                if (includeScriptIncludes) {
                    api.scriptIncludes.forEach(script => {
                        const scriptId = `script:${script}`;
                        addNode(scriptId, script, 'scriptInclude', {
                            className: script
                        });
                        addLink(apiId, scriptId, 'invokes');
                    });
                }

                // Add table connections
                api.tables.forEach(table => {
                    const tableId = `table:${table}`;
                    addNode(tableId, table, 'table', {
                        tableName: table
                    });
                    addLink(apiId, tableId, 'queries');
                });
            });
        }

        // Process Script Includes
        if (includeScriptIncludes) {
            this.tracker.dependencies.scriptIncludes.forEach((script, name) => {
                const scriptId = `script:${name}`;
                
                // Ensure Script Include node exists
                if (!nodeMap.has(scriptId)) {
                    addNode(scriptId, name, 'scriptInclude', {
                        sysId: script.sysId,
                        className: name
                    });
                }

                // Add dependencies to other Script Includes
                script.scriptIncludes.forEach(depScript => {
                    const depScriptId = `script:${depScript}`;
                    addNode(depScriptId, depScript, 'scriptInclude', {
                        className: depScript
                    });
                    addLink(scriptId, depScriptId, 'depends');
                });

                // Add table connections
                script.tables.forEach(table => {
                    const tableId = `table:${table}`;
                    addNode(tableId, table, 'table', {
                        tableName: table
                    });
                    addLink(scriptId, tableId, 'queries');
                });
            });
        }

        // Expensive All Component Trace - Deep recursive dependency analysis
        if (expensiveAllTrace) {
            console.log('🔥 Running expensive all-component trace (this may take a while)...');
            await this.performExpensiveAllTrace(addNode, addLink, nodeMap);
        }

        // Filter by focus if specified
        if (focusOn) {
            const filtered = this.filterByFocus(nodes, links, focusOn, depth);
            return {
                nodes: filtered.nodes,
                links: filtered.links,
                stats: {
                    totalNodes: filtered.nodes.length,
                    totalLinks: filtered.links.length,
                    components: filtered.nodes.filter(n => n.type === 'component').length,
                    apis: filtered.nodes.filter(n => n.type === 'api').length,
                    scriptIncludes: filtered.nodes.filter(n => n.type === 'scriptInclude').length,
                    tables: filtered.nodes.filter(n => n.type === 'table').length
                }
            };
        }

        return {
            nodes,
            links,
            stats: {
                totalNodes: nodes.length,
                totalLinks: links.length,
                components: nodes.filter(n => n.type === 'component').length,
                apis: nodes.filter(n => n.type === 'api').length,
                scriptIncludes: nodes.filter(n => n.type === 'scriptInclude').length,
                tables: nodes.filter(n => n.type === 'table').length
            }
        };
    }

    /**
     * Expensive All Component Trace - Deep recursive analysis
     * Traces every component through its complete dependency chain
     */
    async performExpensiveAllTrace(addNode, addLink, nodeMap) {
        const processedPaths = new Set();
        const maxDepth = 10; // Prevent infinite recursion
        
        // For each component, trace its complete dependency path
        for (const [componentName, component] of this.tracker.dependencies.components) {
            console.log(`  🔍 Deep tracing: ${componentName}`);
            
            for (const apiPath of component.apis) {
                await this.traceCompletePath(
                    `component:${componentName}`, 
                    apiPath, 
                    0, 
                    maxDepth, 
                    processedPaths,
                    addNode,
                    addLink,
                    nodeMap,
                    `comp→api→script trace for ${componentName}`
                );
            }
        }
        
        console.log(`✅ Expensive trace complete! Processed ${processedPaths.size} unique paths`);
    }

    /**
     * Recursively trace a complete dependency path
     */
    async traceCompletePath(sourceId, targetPath, currentDepth, maxDepth, processedPaths, addNode, addLink, nodeMap, traceContext) {
        if (currentDepth >= maxDepth) {
            console.log(`    ⚠️  Max depth reached for ${traceContext}`);
            return;
        }
        
        const pathKey = `${sourceId}→${targetPath}→${currentDepth}`;
        if (processedPaths.has(pathKey)) return;
        processedPaths.add(pathKey);
        
        // Find matching API
        let matchingApi = null;
        let apiKey = null;
        
        this.tracker.dependencies.apis.forEach((api, key) => {
            if (key.includes(targetPath) || api.path === targetPath || api.resource === targetPath) {
                matchingApi = api;
                apiKey = key;
            }
        });
        
        if (!matchingApi) {
            // Create placeholder API node for missing APIs
            const apiId = `api:${targetPath}`;
            addNode(apiId, targetPath, 'api', { 
                path: targetPath, 
                status: 'missing',
                traceDepth: currentDepth 
            });
            addLink(sourceId, apiId, 'calls');
            return;
        }
        
        // Add the API node
        const apiId = `api:${apiKey}`;
        addNode(apiId, matchingApi.name || apiKey, 'api', {
            resource: matchingApi.resource,
            method: matchingApi.method,
            path: matchingApi.path,
            sysId: matchingApi.sysId,
            traceDepth: currentDepth
        });
        addLink(sourceId, apiId, 'calls');
        
        // Trace all Script Includes called by this API
        for (const scriptName of matchingApi.scriptIncludes) {
            const scriptId = `script:${scriptName}`;
            addNode(scriptId, scriptName, 'scriptInclude', {
                className: scriptName,
                traceDepth: currentDepth + 1
            });
            addLink(apiId, scriptId, 'invokes');
            
            // Recursively trace Script Include dependencies
            await this.traceScriptIncludeDependencies(
                scriptId, 
                scriptName, 
                currentDepth + 1, 
                maxDepth, 
                processedPaths,
                addNode,
                addLink,
                nodeMap,
                `${traceContext}→${scriptName}`
            );
        }
        
        // Add table connections
        for (const tableName of matchingApi.tables) {
            const tableId = `table:${tableName}`;
            addNode(tableId, tableName, 'table', {
                tableName: tableName,
                traceDepth: currentDepth + 1
            });
            addLink(apiId, tableId, 'queries');
        }
    }

    /**
     * Recursively trace Script Include dependencies
     */
    async traceScriptIncludeDependencies(sourceScriptId, scriptName, currentDepth, maxDepth, processedPaths, addNode, addLink, nodeMap, traceContext) {
        if (currentDepth >= maxDepth) return;
        
        const script = this.tracker.dependencies.scriptIncludes.get(scriptName);
        if (!script) return;
        
        // Trace nested Script Includes
        for (const nestedScript of script.scriptIncludes) {
            const nestedScriptId = `script:${nestedScript}`;
            const pathKey = `${sourceScriptId}→${nestedScriptId}→${currentDepth}`;
            
            if (processedPaths.has(pathKey)) continue;
            processedPaths.add(pathKey);
            
            addNode(nestedScriptId, nestedScript, 'scriptInclude', {
                className: nestedScript,
                traceDepth: currentDepth + 1
            });
            addLink(sourceScriptId, nestedScriptId, 'depends');
            
            // Recursively trace further
            await this.traceScriptIncludeDependencies(
                nestedScriptId,
                nestedScript,
                currentDepth + 1,
                maxDepth,
                processedPaths,
                addNode,
                addLink,
                nodeMap,
                `${traceContext}→${nestedScript}`
            );
        }
        
        // Add table connections for this Script Include
        for (const tableName of script.tables) {
            const tableId = `table:${tableName}`;
            addNode(tableId, tableName, 'table', {
                tableName: tableName,
                traceDepth: currentDepth + 1
            });
            addLink(sourceScriptId, tableId, 'queries');
        }
        
        // Trace any APIs called by this Script Include
        for (const apiPath of script.apis) {
            await this.traceCompletePath(
                sourceScriptId,
                apiPath,
                currentDepth + 1,
                maxDepth,
                processedPaths,
                addNode,
                addLink,
                nodeMap,
                `${traceContext}→API:${apiPath}`
            );
        }
    }

    /**
     * Filter graph by focus node and depth
     */
    filterByFocus(nodes, links, focusOn, maxDepth) {
        const focusNode = nodes.find(n => 
            n.label.toLowerCase().includes(focusOn.toLowerCase()) ||
            n.id.toLowerCase().includes(focusOn.toLowerCase())
        );

        if (!focusNode) {
            console.warn(`Focus node "${focusOn}" not found`);
            return { nodes, links };
        }

        const includedNodes = new Set([focusNode.nodeId]);
        const includedLinks = [];

        // BFS to find connected nodes within depth
        const queue = [{ nodeId: focusNode.nodeId, depth: 0 }];
        const visited = new Set([focusNode.nodeId]);

        while (queue.length > 0) {
            const { nodeId, depth } = queue.shift();
            
            if (depth >= maxDepth) continue;

            // Find all connected nodes
            links.forEach(link => {
                let connectedNodeId = null;
                
                if (link.source === nodeId) {
                    connectedNodeId = link.target;
                } else if (link.target === nodeId) {
                    connectedNodeId = link.source;
                }

                if (connectedNodeId !== null && !visited.has(connectedNodeId)) {
                    visited.add(connectedNodeId);
                    includedNodes.add(connectedNodeId);
                    includedLinks.push(link);
                    queue.push({ nodeId: connectedNodeId, depth: depth + 1 });
                }
            });
        }

        return {
            nodes: nodes.filter(n => includedNodes.has(n.nodeId)),
            links: links.filter(l => 
                includedNodes.has(l.source) && includedNodes.has(l.target)
            )
        };
    }

    /**
     * Generate interactive HTML visualization
     */
    async generateHTMLVisualization(options = {}) {
        const graphData = await this.generateGraphData(options);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = options.focusOn 
            ? `dependency-graph-${options.focusOn}-${timestamp}.html`
            : `dependency-graph-${timestamp}.html`;
        const outputPath = path.join(this.outputDir, filename);

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ServiceNow Dependency Graph - ${options.focusOn || 'Complete'}</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            overflow: hidden;
        }

        #container {
            display: flex;
            height: 100vh;
        }

        #sidebar {
            width: 320px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            box-shadow: 2px 0 20px rgba(0, 0, 0, 0.1);
            overflow-y: auto;
            z-index: 10;
            transition: transform 0.3s ease;
        }

        #sidebar.collapsed {
            transform: translateX(-320px);
        }

        #toggle-sidebar {
            position: absolute;
            left: 320px;
            top: 20px;
            z-index: 11;
            background: white;
            border: none;
            padding: 8px 12px;
            border-radius: 0 4px 4px 0;
            cursor: pointer;
            box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.1);
            transition: left 0.3s ease;
        }

        #toggle-sidebar.collapsed {
            left: 0;
        }

        .sidebar-header {
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        .sidebar-header h1 {
            font-size: 1.5rem;
            margin-bottom: 10px;
        }

        .stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 15px;
        }

        .stat {
            background: rgba(255, 255, 255, 0.2);
            padding: 8px;
            border-radius: 4px;
            text-align: center;
        }

        .stat-value {
            font-size: 1.5rem;
            font-weight: bold;
        }

        .stat-label {
            font-size: 0.75rem;
            opacity: 0.9;
            text-transform: uppercase;
        }

        .controls {
            padding: 20px;
        }

        .control-group {
            margin-bottom: 20px;
        }

        .control-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #333;
        }

        .control-group input[type="range"] {
            width: 100%;
            margin-bottom: 5px;
        }

        .control-group input[type="text"] {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }

        .checkbox-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .checkbox-group label {
            display: flex;
            align-items: center;
            font-weight: normal;
            cursor: pointer;
        }

        .checkbox-group input[type="checkbox"] {
            margin-right: 8px;
        }

        .legend {
            padding: 20px;
            border-top: 1px solid #eee;
        }

        .legend-item {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }

        .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            margin-right: 10px;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        #graph {
            flex: 1;
            position: relative;
            background: white;
        }

        #svg-container {
            width: 100%;
            height: 100%;
        }

        .node {
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .node:hover {
            filter: brightness(1.2);
        }

        .node.highlight {
            stroke: #ff6b6b;
            stroke-width: 3px;
            filter: drop-shadow(0 0 10px rgba(255, 107, 107, 0.5));
        }

        .node.dimmed {
            opacity: 0.2;
        }

        .link {
            fill: none;
            stroke-opacity: 0.4;
            transition: all 0.3s ease;
        }

        .link.highlight {
            stroke-opacity: 1;
            stroke-width: 3px;
        }

        .link.dimmed {
            stroke-opacity: 0.05;
        }

        .node-label {
            font-size: 10px;
            pointer-events: none;
            user-select: none;
            fill: #333;
            text-shadow: 0 0 3px white, 0 0 3px white, 0 0 3px white;
        }

        .tooltip {
            position: absolute;
            padding: 12px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
            max-width: 300px;
            z-index: 100;
        }

        .tooltip.show {
            opacity: 1;
        }

        .context-menu {
            position: absolute;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            padding: 8px 0;
            display: none;
            z-index: 100;
        }

        .context-menu.show {
            display: block;
        }

        .context-menu-item {
            padding: 8px 16px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .context-menu-item:hover {
            background: #f0f0f0;
        }

        .export-buttons {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }

        .export-btn {
            flex: 1;
            padding: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: transform 0.2s;
        }

        .export-btn:hover {
            transform: translateY(-2px);
        }

        #search-results {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-top: 5px;
            display: none;
        }

        #search-results.show {
            display: block;
        }

        .search-result {
            padding: 8px;
            cursor: pointer;
            border-bottom: 1px solid #f0f0f0;
        }

        .search-result:hover {
            background: #f8f8f8;
        }

        .search-result-type {
            font-size: 0.75rem;
            color: #666;
            margin-left: 5px;
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="sidebar">
            <div class="sidebar-header">
                <h1>Dependency Graph</h1>
                <div class="stats">
                    <div class="stat">
                        <div class="stat-value">${graphData.stats.totalNodes}</div>
                        <div class="stat-label">Nodes</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${graphData.stats.totalLinks}</div>
                        <div class="stat-label">Links</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${graphData.stats.components}</div>
                        <div class="stat-label">Components</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${graphData.stats.apis}</div>
                        <div class="stat-label">APIs</div>
                    </div>
                </div>
            </div>

            <div class="controls">
                <div class="control-group">
                    <label for="search">Search Nodes:</label>
                    <input type="text" id="search" placeholder="Type to search...">
                    <div id="search-results"></div>
                </div>

                <div class="control-group">
                    <label for="force-strength">Force Strength: <span id="force-value">-300</span></label>
                    <input type="range" id="force-strength" min="-1000" max="-50" value="-300">
                </div>

                <div class="control-group">
                    <label for="link-distance">Link Distance: <span id="distance-value">100</span></label>
                    <input type="range" id="link-distance" min="20" max="300" value="100">
                </div>

                <div class="control-group">
                    <label>Show Node Types:</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" checked class="node-filter" data-type="component"> Components</label>
                        <label><input type="checkbox" checked class="node-filter" data-type="api"> REST APIs</label>
                        <label><input type="checkbox" checked class="node-filter" data-type="scriptInclude"> Script Includes</label>
                        <label><input type="checkbox" checked class="node-filter" data-type="table"> Tables</label>
                    </div>
                </div>

                <div class="control-group">
                    <label>Show Labels:</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" checked id="show-labels"> Node Labels</label>
                    </div>
                </div>

                <div class="control-group">
                    <label>Layout Control:</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" id="freeze-nodes" checked> Freeze nodes in place</label>
                    </div>
                </div>

                <div class="export-buttons">
                    <button class="export-btn" onclick="exportSVG()">Export SVG</button>
                    <button class="export-btn" onclick="exportPNG()">Export PNG</button>
                    <button class="export-btn" onclick="exportJSON()">Export JSON</button>
                </div>
            </div>

            <div class="legend">
                <h3 style="margin-bottom: 15px;">Legend</h3>
                <div class="legend-item">
                    <div class="legend-color" style="background: #4CAF50;"></div>
                    <span>Component</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #2196F3;"></div>
                    <span>REST API</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #FF9800;"></div>
                    <span>Script Include</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #9C27B0;"></div>
                    <span>Table</span>
                </div>
            </div>
        </div>

        <button id="toggle-sidebar" onclick="toggleSidebar()">☰</button>

        <div id="graph">
            <svg id="svg-container"></svg>
            <div class="tooltip"></div>
            <div class="context-menu">
                <div class="context-menu-item" onclick="focusNode()">Focus on this node</div>
                <div class="context-menu-item" onclick="showConnections()">Show connections</div>
                <div class="context-menu-item" onclick="hideNode()">Hide this node</div>
                <div class="context-menu-item" onclick="copyNodeInfo()">Copy node info</div>
            </div>
        </div>
    </div>

    <script>
        // Graph data
        const graphData = ${JSON.stringify(graphData)};
        
        // Color scheme
        const colorScheme = {
            component: '#4CAF50',
            api: '#2196F3',
            scriptInclude: '#FF9800',
            table: '#9C27B0'
        };

        // Initialize D3
        const svg = d3.select('#svg-container');
        const width = window.innerWidth - 320;
        const height = window.innerHeight;
        
        svg.attr('viewBox', [0, 0, width, height]);

        // Create zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Create main group
        const g = svg.append('g');

        // Create arrow markers for directed edges
        svg.append('defs').selectAll('marker')
            .data(['calls', 'invokes', 'depends', 'queries'])
            .enter().append('marker')
            .attr('id', d => 'arrow-' + d)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 20)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#999');

        // Create force simulation
        const simulation = d3.forceSimulation(graphData.nodes)
            .force('link', d3.forceLink(graphData.links)
                .id(d => d.nodeId)
                .distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(30))
            .alphaDecay(0.05)  // Slow down the simulation decay
            .on('end', () => {
                // Fix all nodes in place once simulation settles
                graphData.nodes.forEach(d => {
                    d.fx = d.x;
                    d.fy = d.y;
                });
            });

        // Create links
        const link = g.append('g')
            .selectAll('line')
            .data(graphData.links)
            .enter().append('line')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-width', d => d.type === 'depends' ? 2 : 1)
            .attr('marker-end', d => 'url(#arrow-' + d.type + ')');

        // Create nodes
        const node = g.append('g')
            .selectAll('circle')
            .data(graphData.nodes)
            .enter().append('circle')
            .attr('class', 'node')
            .attr('r', d => {
                switch(d.type) {
                    case 'component': return 12;
                    case 'api': return 10;
                    case 'scriptInclude': return 10;
                    case 'table': return 8;
                    default: return 8;
                }
            })
            .attr('fill', d => colorScheme[d.type] || '#666')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        // Create labels
        const label = g.append('g')
            .selectAll('text')
            .data(graphData.nodes)
            .enter().append('text')
            .attr('class', 'node-label')
            .attr('text-anchor', 'middle')
            .attr('dy', -15)
            .text(d => d.label.length > 20 ? d.label.substring(0, 20) + '...' : d.label);

        // Update positions on simulation tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            label
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        // Drag functions
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            // Keep the node fixed at its new position
            d.fx = d.x;
            d.fy = d.y;
        }

        // Tooltip
        const tooltip = d3.select('.tooltip');
        
        node.on('mouseover', (event, d) => {
            let content = '<strong>' + d.label + '</strong><br>';
            content += 'Type: ' + d.type + '<br>';
            
            if (d.path) content += 'Path: ' + d.path + '<br>';
            if (d.componentType) content += 'Component Type: ' + d.componentType + '<br>';
            if (d.apiCount) content += 'API Count: ' + d.apiCount + '<br>';
            if (d.method) content += 'Method: ' + d.method + '<br>';
            if (d.resource) content += 'Resource: ' + d.resource + '<br>';
            
            tooltip.html(content)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px')
                .classed('show', true);
        })
        .on('mouseout', () => {
            tooltip.classed('show', false);
        });

        // Context menu
        let selectedNode = null;
        const contextMenu = d3.select('.context-menu');

        node.on('contextmenu', (event, d) => {
            event.preventDefault();
            selectedNode = d;
            contextMenu
                .style('left', event.pageX + 'px')
                .style('top', event.pageY + 'px')
                .classed('show', true);
        });

        document.addEventListener('click', () => {
            contextMenu.classed('show', false);
        });

        // Highlight on click
        node.on('click', (event, d) => {
            event.stopPropagation();
            highlightConnections(d);
        });

        svg.on('click', () => {
            resetHighlight();
        });

        function highlightConnections(d) {
            // Reset all
            node.classed('highlight', false).classed('dimmed', true);
            link.classed('highlight', false).classed('dimmed', true);
            
            // Highlight selected node
            node.filter(n => n.nodeId === d.nodeId)
                .classed('highlight', true)
                .classed('dimmed', false);
            
            // Highlight connected nodes and links
            link.filter(l => l.source.nodeId === d.nodeId || l.target.nodeId === d.nodeId)
                .classed('highlight', true)
                .classed('dimmed', false)
                .each(function(l) {
                    node.filter(n => n.nodeId === l.source.nodeId || n.nodeId === l.target.nodeId)
                        .classed('dimmed', false);
                });
        }

        function resetHighlight() {
            node.classed('highlight', false).classed('dimmed', false);
            link.classed('highlight', false).classed('dimmed', false);
        }

        // Search functionality
        const searchInput = document.getElementById('search');
        const searchResults = document.getElementById('search-results');

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            
            if (query.length < 2) {
                searchResults.classList.remove('show');
                return;
            }

            const matches = graphData.nodes.filter(n => 
                n.label.toLowerCase().includes(query)
            ).slice(0, 10);

            if (matches.length > 0) {
                searchResults.innerHTML = matches.map(n => 
                    '<div class="search-result" data-node-id="' + n.nodeId + '">' +
                    n.label + '<span class="search-result-type">(' + n.type + ')</span></div>'
                ).join('');
                searchResults.classList.add('show');

                // Add click handlers
                searchResults.querySelectorAll('.search-result').forEach(el => {
                    el.addEventListener('click', () => {
                        const nodeId = parseInt(el.dataset.nodeId);
                        const node = graphData.nodes.find(n => n.nodeId === nodeId);
                        if (node) {
                            highlightConnections(node);
                            
                            // Zoom to node
                            const transform = d3.zoomIdentity
                                .translate(width / 2, height / 2)
                                .scale(2)
                                .translate(-node.x, -node.y);
                            
                            svg.transition()
                                .duration(750)
                                .call(zoom.transform, transform);
                        }
                        searchResults.classList.remove('show');
                        searchInput.value = '';
                    });
                });
            } else {
                searchResults.classList.remove('show');
            }
        });

        // Control panel
        document.getElementById('force-strength').addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('force-value').textContent = value;
            simulation.force('charge').strength(+value);
            // Temporarily allow movement during force adjustments
            graphData.nodes.forEach(d => {
                d.fx = null;
                d.fy = null;
            });
            simulation.alpha(0.3).restart();
        });

        document.getElementById('link-distance').addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('distance-value').textContent = value;
            simulation.force('link').distance(+value);
            // Temporarily allow movement during force adjustments
            graphData.nodes.forEach(d => {
                d.fx = null;
                d.fy = null;
            });
            simulation.alpha(0.3).restart();
        });

        document.getElementById('show-labels').addEventListener('change', (e) => {
            label.style('display', e.target.checked ? 'block' : 'none');
        });

        // Freeze nodes control
        document.getElementById('freeze-nodes').addEventListener('change', (e) => {
            if (e.target.checked) {
                // Fix all nodes at current positions
                graphData.nodes.forEach(d => {
                    d.fx = d.x;
                    d.fy = d.y;
                });
                simulation.alphaTarget(0);
            } else {
                // Unfix all nodes and restart simulation
                graphData.nodes.forEach(d => {
                    d.fx = null;
                    d.fy = null;
                });
                simulation.alpha(0.3).restart();
            }
        });

        // Node type filters
        document.querySelectorAll('.node-filter').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const visibleTypes = Array.from(document.querySelectorAll('.node-filter:checked'))
                    .map(cb => cb.dataset.type);
                
                node.style('display', d => visibleTypes.includes(d.type) ? 'block' : 'none');
                label.style('display', d => {
                    const showLabels = document.getElementById('show-labels').checked;
                    return showLabels && visibleTypes.includes(d.type) ? 'block' : 'none';
                });
                
                // Hide links connected to hidden nodes
                link.style('display', l => {
                    const sourceVisible = visibleTypes.includes(l.source.type);
                    const targetVisible = visibleTypes.includes(l.target.type);
                    return sourceVisible && targetVisible ? 'block' : 'none';
                });
            });
        });

        // Sidebar toggle
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const toggle = document.getElementById('toggle-sidebar');
            sidebar.classList.toggle('collapsed');
            toggle.classList.toggle('collapsed');
            
            // Resize SVG without moving nodes
            const newWidth = sidebar.classList.contains('collapsed') 
                ? window.innerWidth 
                : window.innerWidth - 320;
            
            svg.attr('viewBox', [0, 0, newWidth, height]);
            // Update center force but don't restart simulation
            simulation.force('center', d3.forceCenter(newWidth / 2, height / 2));
        }

        // Export functions
        function exportSVG() {
            const svgData = document.getElementById('svg-container').outerHTML;
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dependency-graph.svg';
            a.click();
            URL.revokeObjectURL(url);
        }

        function exportPNG() {
            const svgElement = document.getElementById('svg-container');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const img = new Image();
            
            canvas.width = width;
            canvas.height = height;
            
            img.onload = () => {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob(blob => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'dependency-graph.png';
                    a.click();
                    URL.revokeObjectURL(url);
                });
            };
            
            img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
        }

        function exportJSON() {
            const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dependency-graph.json';
            a.click();
            URL.revokeObjectURL(url);
        }

        // Context menu functions
        function focusNode() {
            if (selectedNode) {
                highlightConnections(selectedNode);
                const transform = d3.zoomIdentity
                    .translate(width / 2, height / 2)
                    .scale(2)
                    .translate(-selectedNode.x, -selectedNode.y);
                
                svg.transition()
                    .duration(750)
                    .call(zoom.transform, transform);
            }
        }

        function showConnections() {
            if (selectedNode) {
                highlightConnections(selectedNode);
            }
        }

        function hideNode() {
            if (selectedNode) {
                node.filter(n => n.nodeId === selectedNode.nodeId)
                    .style('display', 'none');
                label.filter(n => n.nodeId === selectedNode.nodeId)
                    .style('display', 'none');
                link.filter(l => l.source.nodeId === selectedNode.nodeId || l.target.nodeId === selectedNode.nodeId)
                    .style('display', 'none');
            }
        }

        function copyNodeInfo() {
            if (selectedNode) {
                const info = JSON.stringify(selectedNode, null, 2);
                navigator.clipboard.writeText(info);
            }
        }

        // Window resize
        window.addEventListener('resize', () => {
            const sidebar = document.getElementById('sidebar');
            const newWidth = sidebar.classList.contains('collapsed') 
                ? window.innerWidth 
                : window.innerWidth - 320;
            const newHeight = window.innerHeight;
            
            svg.attr('viewBox', [0, 0, newWidth, newHeight]);
            // Update center force but don't restart simulation to avoid moving nodes
            simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
        });
    </script>
</body>
</html>`;

        fs.writeFileSync(outputPath, html);
        console.log(`✅ HTML visualization saved to: ${outputPath}`);

        return outputPath;
    }

    /**
     * Generate GraphViz DOT format
     */
    generateDotGraph(options = {}) {
        const graphData = this.generateGraphDataSync(options);
        let dot = 'digraph ServiceNowDependencies {\n';
        dot += '  rankdir=LR;\n';
        dot += '  node [shape=box, style=filled];\n\n';

        // Define node styles
        dot += '  // Node styles\n';
        graphData.nodes.forEach(node => {
            let color = '#cccccc';
            switch(node.type) {
                case 'component': color = '#4CAF50'; break;
                case 'api': color = '#2196F3'; break;
                case 'scriptInclude': color = '#FF9800'; break;
                case 'table': color = '#9C27B0'; break;
            }
            dot += `  "${node.id}" [label="${node.label}", fillcolor="${color}"];\n`;
        });

        dot += '\n  // Edges\n';
        graphData.links.forEach(link => {
            const source = graphData.nodes.find(n => n.nodeId === link.source);
            const target = graphData.nodes.find(n => n.nodeId === link.target);
            if (source && target) {
                dot += `  "${source.id}" -> "${target.id}" [label="${link.type}"];\n`;
            }
        });

        dot += '}\n';

        const filename = `dependency-graph-${Date.now()}.dot`;
        const outputPath = path.join(this.outputDir, filename);
        fs.writeFileSync(outputPath, dot);
        
        console.log(`✅ DOT graph saved to: ${outputPath}`);
        console.log('💡 To convert to image: dot -Tpng ${outputPath} -o graph.png');
        
        return outputPath;
    }

    /**
     * Synchronous version for DOT generation
     */
    generateGraphDataSync(options) {
        // Simple sync version for DOT generation
        const nodes = [];
        const links = [];
        let nodeId = 0;

        this.tracker.dependencies.components.forEach((comp, name) => {
            nodes.push({
                id: `component:${name}`,
                label: name,
                type: 'component',
                nodeId: nodeId++
            });

            comp.apis.forEach(api => {
                const apiNodeId = nodes.find(n => n.id === `api:${api}`)?.nodeId;
                if (!apiNodeId) {
                    nodes.push({
                        id: `api:${api}`,
                        label: api,
                        type: 'api',
                        nodeId: nodeId++
                    });
                }
                links.push({
                    source: nodes.find(n => n.id === `component:${name}`).nodeId,
                    target: nodes.find(n => n.id === `api:${api}`).nodeId,
                    type: 'calls'
                });
            });
        });

        return { nodes, links };
    }

    /**
     * Open visualization in browser
     */
    async openInBrowser(filePath) {
        const platform = process.platform;
        let command;
        
        if (platform === 'win32') {
            command = `start ${filePath}`;
        } else if (platform === 'darwin') {
            command = `open ${filePath}`;
        } else {
            command = `xdg-open ${filePath}`;
        }

        exec(command, (error) => {
            if (error) {
                console.error('Could not open browser:', error.message);
                console.log(`Please open manually: ${filePath}`);
            }
        });
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';

    const visualizer = new ServiceNowDependencyVisualizer();

    async function main() {
        switch (command) {
            case 'generate':
            case 'graph': {
                const options = {
                    focusOn: args[1] || null,
                    depth: parseInt(args[2]) || 3,
                    includeComponents: !args.includes('--no-components'),
                    includeApis: !args.includes('--no-apis'),
                    includeScriptIncludes: !args.includes('--no-scripts'),
                    expensiveAllTrace: args.includes('--expensive-all-trace')
                };

                console.log('🎨 Generating interactive dependency graph...');
                const htmlPath = await visualizer.generateHTMLVisualization(options);
                console.log(`📊 Opening graph in browser...`);
                await visualizer.openInBrowser(htmlPath);
                break;
            }

            case 'expensive':
            case 'all-trace': {
                const options = {
                    includeComponents: true,
                    includeApis: true,
                    includeScriptIncludes: true,
                    expensiveAllTrace: true,
                    focusOn: args[1] || null,
                    depth: parseInt(args[2]) || 10
                };

                console.log('🔥 Generating EXPENSIVE all-component trace...');
                console.log('⚠️  This will trace EVERY component through its complete dependency chain');
                console.log('⏳ This may take several minutes depending on codebase size');
                console.log('');
                
                const htmlPath = await visualizer.generateHTMLVisualization(options);
                console.log(`📊 Opening complete trace graph in browser...`);
                await visualizer.openInBrowser(htmlPath);
                break;
            }

            case 'dot': {
                console.log('📝 Generating DOT graph...');
                visualizer.generateDotGraph({});
                break;
            }

            case 'json': {
                const options = {
                    focusOn: args[1] || null,
                    depth: parseInt(args[2]) || 3
                };
                
                const graphData = await visualizer.generateGraphData(options);
                const filename = `dependency-data-${Date.now()}.json`;
                const outputPath = path.join(visualizer.outputDir, filename);
                
                fs.writeFileSync(outputPath, JSON.stringify(graphData, null, 2));
                console.log(`✅ JSON data saved to: ${outputPath}`);
                break;
            }

            case 'focus': {
                if (!args[1]) {
                    console.error('Usage: node sn-dependency-visualizer.js focus [component/api/script]');
                    process.exit(1);
                }

                const options = {
                    focusOn: args[1],
                    depth: parseInt(args[2]) || 2
                };

                console.log(`🎯 Generating focused graph for: ${args[1]}`);
                const htmlPath = await visualizer.generateHTMLVisualization(options);
                console.log(`📊 Opening focused graph in browser...`);
                await visualizer.openInBrowser(htmlPath);
                break;
            }

            case 'scan': {
                console.log('🔍 Scanning codebase for dependencies...');
                await visualizer.tracker.scanAll();
                console.log('✅ Scan complete!');
                break;
            }

            default:
                console.log('╔════════════════════════════════════════════════╗');
                console.log('║     ServiceNow Dependency Visualizer          ║');
                console.log('╚════════════════════════════════════════════════╝');
                console.log('');
                console.log('Generate interactive visual dependency graphs');
                console.log('');
                console.log('Commands:');
                console.log('  generate [focus] [depth]  - Generate interactive HTML graph');
                console.log('  expensive [focus] [depth] - 🔥 EXPENSIVE all-component trace (front-to-back)');
                console.log('  focus [item] [depth]      - Generate graph focused on specific item');
                console.log('  dot                       - Generate GraphViz DOT file');
                console.log('  json [focus] [depth]      - Export graph data as JSON');
                console.log('  scan                      - Scan codebase for dependencies');
                console.log('');
                console.log('Options:');
                console.log('  --expensive-all-trace     - Add to generate command for expensive trace');
                console.log('  --no-components           - Exclude components from graph');
                console.log('  --no-apis                 - Exclude APIs from graph');
                console.log('  --no-scripts              - Exclude Script Includes from graph');
                console.log('');
                console.log('Examples:');
                console.log('  node sn-dependency-visualizer.js generate');
                console.log('  node sn-dependency-visualizer.js expensive');
                console.log('  node sn-dependency-visualizer.js expensive AudienceBuilder 5');
                console.log('  node sn-dependency-visualizer.js generate --expensive-all-trace');
                console.log('  node sn-dependency-visualizer.js focus UserUtils 2');
                console.log('  node sn-dependency-visualizer.js dot');
                console.log('');
                console.log('⚠️  WARNING: expensive command traces EVERY component through');
                console.log('    its complete dependency chain - may take several minutes!');
        }
    }

    main().catch(error => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    });
}

module.exports = ServiceNowDependencyVisualizer;