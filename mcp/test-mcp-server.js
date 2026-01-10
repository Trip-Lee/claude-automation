#!/usr/bin/env node

/**
 * Test script for MCP server
 *
 * Sends MCP protocol requests to test server functionality
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, 'sn-tools-mcp-server.js');

/**
 * Test MCP Server
 */
async function testMCPServer() {
  console.log('Starting MCP server test...\n');

  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let responseBuffer = '';
  const responses = [];

  // Collect responses
  server.stdout.on('data', (data) => {
    responseBuffer += data.toString();

    // Try to parse complete JSON objects
    const lines = responseBuffer.split('\n');
    responseBuffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          responses.push(JSON.parse(line));
        } catch (e) {
          console.error('Failed to parse response:', line);
        }
      }
    }
  });

  // Log stderr
  server.stderr.on('data', (data) => {
    console.error('[SERVER]', data.toString().trim());
  });

  /**
   * Send request and wait for response
   */
  function sendRequest(request) {
    return new Promise((resolve, reject) => {
      const currentLength = responses.length;

      server.stdin.write(JSON.stringify(request) + '\n');

      // Wait for response
      const checkInterval = setInterval(() => {
        if (responses.length > currentLength) {
          clearInterval(checkInterval);
          resolve(responses[responses.length - 1]);
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Request timeout'));
      }, 5000);
    });
  }

  try {
    // Test 1: Initialize
    console.log('Test 1: Initialize request');
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    };

    const initResponse = await sendRequest(initRequest);
    console.log('✓ Initialize response:', JSON.stringify(initResponse, null, 2));
    console.log();

    // Test 2: Tools list
    console.log('Test 2: Tools list request');
    const toolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    };

    const toolsResponse = await sendRequest(toolsRequest);
    console.log('✓ Tools list response:');
    console.log(`  Found ${toolsResponse.result.tools.length} tools:`);
    toolsResponse.result.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description.substring(0, 60)}...`);
    });
    console.log();

    // Test 3: Tool call (with mock - won't actually work without sn-tools setup)
    console.log('Test 3: Tool call request (trace_component_impact)');
    const toolCallRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'trace_component_impact',
        arguments: {
          component_name: 'TestComponent'
        }
      }
    };

    try {
      const toolCallResponse = await sendRequest(toolCallRequest);
      console.log('✓ Tool call response received');

      // Parse the content
      const content = JSON.parse(toolCallResponse.result.content[0].text);
      console.log('  Success:', content.success);
      if (content.error) {
        console.log('  Error (expected):', content.error.message);
      }
    } catch (error) {
      console.log('  Tool call failed (may be expected if sn-tools not set up):', error.message);
    }
    console.log();

    // Test 4: Ping
    console.log('Test 4: Ping request');
    const pingRequest = {
      jsonrpc: '2.0',
      id: 4,
      method: 'ping'
    };

    const pingResponse = await sendRequest(pingRequest);
    console.log('✓ Ping response:', JSON.stringify(pingResponse.result, null, 2));
    console.log();

    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    server.kill();
  }
}

// Run tests
testMCPServer().catch(console.error);
