# ServiceNow Multi-Agent System

## Overview

The ServiceNow Multi-Agent System is a collaborative architecture that transforms sn-tools into an intelligent, scalable platform where specialized agents work together to manage ServiceNow operations.

## Key Features

✅ **Collaborative Agents** - Specialized agents that work together
✅ **Intelligent Task Routing** - Automatic distribution to the right agent
✅ **Workflow Engine** - Predefined multi-step workflows
✅ **Event-Driven** - Agents communicate via publish/subscribe
✅ **Caching** - Smart caching across agents
✅ **Validation** - Automatic data validation before operations
✅ **AI Integration** - Built-in AI assistance
✅ **Health Monitoring** - Real-time agent health tracking
✅ **Load Balancing** - Distribute tasks to least-busy agents
✅ **Resilience** - Circuit breakers and retry logic

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Orchestrator (Hub)                      │
│  - Task routing                                             │
│  - Agent coordination                                       │
│  - Workflow execution                                       │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼────────┐ ┌──────▼───────┐ ┌────────▼────────┐
│ RecordOpsAgent │ │  SchemaAgent │ │    AIAgent      │
│ - Create       │ │ - Get schema │ │ - Generate      │
│ - Update       │ │ - Field info │ │ - Enhance       │
│ - Delete       │ │ - Cache      │ │ - Analyze       │
└────────────────┘ └──────────────┘ └─────────────────┘
        │
┌───────▼────────┐
│ValidationAgent │
│ - Validate     │
│ - Check types  │
│ - Mandatory    │
└────────────────┘
```

## Agents

### RecordOperationsAgent
**Purpose**: Handles CRUD operations on ServiceNow records

**Capabilities**:
- Create records with validation
- Update records with locking
- Delete records
- File-to-record synchronization
- AI-enhanced operations

**Example**:
```javascript
await system.routeTask({
    action: 'create-record',
    table: 'sys_script_include',
    data: { name: 'MyScript', script: '...' },
    instance: 'dev',
    validateFirst: true
});
```

### SchemaAgent
**Purpose**: Manages table schemas and field information

**Capabilities**:
- Get table schema
- Field discovery with inheritance
- Schema caching (1 hour TTL)
- Table information

**Example**:
```javascript
await system.routeTask({
    action: 'get-schema',
    table: 'incident',
    includeInherited: true
});
```

### AIAgent
**Purpose**: Provides AI assistance

**Capabilities**:
- Generate record data from prompts
- Enhance existing data
- Code analysis
- Intelligent suggestions

**Example**:
```javascript
await system.routeTask({
    action: 'ai-generate',
    table: 'sys_script_include',
    prompt: 'Create an email validator that checks for valid format'
});
```

### ValidationAgent
**Purpose**: Validates data before operations

**Capabilities**:
- Schema validation
- Type checking
- Mandatory field validation
- Field-level validation

**Example**:
```javascript
await system.routeTask({
    action: 'validate-record',
    table: 'incident',
    data: { short_description: 'Test' },
    isUpdate: false
});
```

## Workflows

Predefined multi-step workflows for common operations:

### create-record-with-ai
Create a record using AI to generate field values

**Steps**:
1. Get schema
2. Generate data with AI
3. Validate data
4. Create record

**Usage**:
```javascript
await system.executeWorkflow('create-record-with-ai', {
    table: 'sys_script_include',
    prompt: 'Create a utility to format phone numbers',
    instance: 'dev'
});
```

### create-record
Create a record with manual data and validation

**Steps**:
1. Get schema
2. Validate data
3. Create record

**Usage**:
```javascript
await system.executeWorkflow('create-record', {
    table: 'incident',
    data: { short_description: 'Test incident' },
    instance: 'dev'
});
```

### update-record
Update a record with validation

**Steps**:
1. Get schema
2. Validate data
3. Update record

**Usage**:
```javascript
await system.executeWorkflow('update-record', {
    table: 'incident',
    sys_id: '1234567890abcdef1234567890abcdef',
    data: { state: 6 },
    instance: 'dev'
});
```

### enhanced-create
Enhanced record creation with AI assistance and field discovery

**Steps**:
1. Get schema
2. AI enhance (optional)
3. Validate data
4. Create record

**Usage**:
```javascript
await system.executeWorkflow('enhanced-create', {
    table: 'sys_script_include',
    data: { name: 'MyScript' },
    aiPrompt: 'Add description and documentation',
    instance: 'dev'
});
```

## Getting Started

### 1. Enable Multi-Agent System

Edit `sn-config.json`:

```json
{
  "multiAgent": {
    "enabled": true,
    "mode": "local"
  }
}
```

### 2. Start the System

```bash
cd ServiceNow-Tools
node sn-multi-agent.js
```

### 3. Use in Your Code

```javascript
const { ServiceNowMultiAgentSystem } = require('./sn-multi-agent');

async function main() {
    const system = new ServiceNowMultiAgentSystem();

    // Initialize
    await system.initialize();

    // Execute a workflow
    const result = await system.executeWorkflow('create-record-with-ai', {
        table: 'sys_script_include',
        prompt: 'Create a date utility class',
        instance: 'dev'
    });

    console.log('Record created:', result.results['create-record'].sys_id);

    // Stop the system
    await system.stop();
}

main();
```

## Configuration

### Agent Configuration

Each agent can be configured in `sn-config.json`:

```json
{
  "multiAgent": {
    "agents": {
      "recordOps": {
        "instances": 1,
        "config": {
          "validateBeforeCreate": true,
          "validateBeforeUpdate": true,
          "enableLocking": true
        }
      },
      "schema": {
        "instances": 1,
        "config": {
          "cacheSchemas": true,
          "refreshInterval": 3600000
        }
      },
      "ai": {
        "instances": 1
      },
      "validation": {
        "instances": 1,
        "config": {
          "strictMode": false
        }
      }
    }
  }
}
```

### Communication Backend

Choose between in-memory or Redis:

```json
{
  "multiAgent": {
    "communication": {
      "backend": "memory",  // or "redis"
      "redis": {
        "host": "localhost",
        "port": 6379
      }
    }
  }
}
```

## Advanced Usage

### Custom Workflows

Create your own workflows:

```javascript
system.getOrchestrator().registerWorkflow('my-workflow', {
    name: 'My Custom Workflow',
    description: 'Does something custom',
    steps: [
        {
            name: 'step-1',
            action: 'get-schema',
            payload: {
                table: '$params.table',
                includeInherited: true
            }
        },
        {
            name: 'step-2',
            action: 'ai-generate',
            payload: {
                table: '$params.table',
                prompt: '$params.prompt'
            }
        },
        {
            name: 'step-3',
            action: 'create-record',
            payload: {
                table: '$params.table',
                data: '$results.step-2.data',
                instance: '$params.instance'
            }
        }
    ]
});
```

### Direct Agent Access

Get direct access to agents:

```javascript
const schemaAgent = system.getAgent('schema');
const health = await schemaAgent.healthCheck();
console.log('Agent health:', health);
```

### System Statistics

Get system stats:

```javascript
const stats = system.getStats();
console.log('Orchestrator:', stats.orchestrator);
console.log('Message Bus:', stats.messageBus);
console.log('State Manager:', stats.stateManager);
```

## Event System

Agents publish events that you can subscribe to:

```javascript
// Get message bus
const messageBus = system.getOrchestrator().messageBus;

// Subscribe to events
await messageBus.subscribe('record.created', (event) => {
    console.log('Record created:', event.data);
});

await messageBus.subscribe('record.updated', (event) => {
    console.log('Record updated:', event.data);
});
```

### Available Events

- `record.created` - When a record is created
- `record.updated` - When a record is updated
- `record.deleted` - When a record is deleted
- `cache.invalidated` - When cache is invalidated

## Troubleshooting

### System Not Starting

1. Check if multiAgent.enabled is true
2. Verify all dependencies are installed
3. Check console for error messages

### Agents Not Responding

1. Check agent health: `await agent.healthCheck()`
2. View orchestrator stats: `system.getStats()`
3. Check message bus logs

### Performance Issues

1. Check agent configuration in sn-config.json
2. Review agent health metrics
3. Add more agent instances (future feature)

## Future Enhancements

- [ ] Multiple agent instances per type
- [ ] Redis backend support
- [ ] Web dashboard for monitoring
- [ ] FileWatchAgent implementation
- [ ] DependencyAgent implementation
- [ ] Distributed mode (multi-machine)
- [ ] Agent auto-scaling
- [ ] Performance metrics dashboard

## Architecture Benefits

✅ **Scalability** - Add more agents as needed
✅ **Modularity** - Each agent is independent
✅ **Resilience** - Agent failures don't crash system
✅ **Observability** - Health monitoring for all agents
✅ **Flexibility** - Easy to add new agents
✅ **Intelligence** - Agents collaborate to solve complex tasks

## Contributing

To add a new agent:

1. Extend `BaseAgent` class
2. Implement `processTask()` method
3. Register with orchestrator
4. Add configuration to sn-config.json

See existing agents for examples!

## License

UNLICENSED - Internal use only

## Support

For issues or questions, check the main project repository.
