# ServiceNow Tools v2.1.0

**Professional Cross-Platform ServiceNow Development Toolkit with AI Integration**

A comprehensive toolkit for ServiceNow development featuring multi-instance support, advanced automation, dependency tracking, and AI-powered assistance. Works seamlessly across Windows, macOS, and Linux.

## 🚀 Quick Start

### Installation
```bash
# Clone or extract the project
cd sn-tools/ServiceNow-Tools
npm install
```

### First Run
```bash
# Windows
sn-tools.bat

# Unix/Linux/macOS
./sn-tools.sh

# Cross-platform
npm run execute
```

## 🌟 Features

### ✨ Core Functionality
- **Multi-Instance Support** - Separate dev/prod configurations with intelligent routing
- **Real-time File Watching** - Auto-sync changes with ServiceNow instances
- **Dependency Tracking** - Comprehensive analysis of Script Includes and flows
- **Impact Analysis** - Understand how changes affect your entire platform
- **Flow Tracing** - Deep dive into ServiceNow Flow execution paths
- **Data Fetching** - Automated retrieval of ServiceNow records with smart caching

### 🤖 AI Integration
- **Claude Code Integration** - Built-in support for Claude Code CLI
- **Multiple AI Providers** - Support for ChatGPT CLI and Claude API
- **Intelligent Record Creation** - AI-powered ServiceNow record generation
- **Automatic Code Analysis** - AI-driven error analysis and optimization suggestions
- **Context-Aware Assistance** - Smart prompts based on your current development state

### 🔧 Cross-Platform Support
- **Windows** - Native .bat launchers with NVM Node.js support
- **macOS/Linux** - Shell scripts with automatic executable permissions
- **Cross-Platform** - npm commands work everywhere
- **Smart Detection** - Automatic platform detection and adaptation

## 📋 Usage

### Platform-Specific Launchers

#### Windows
```batch
sn-tools.bat              # Main interactive launcher
Scripts\sn-dev.bat         # Development tools menu
Scripts\sn-watch.bat       # File watcher
Scripts\sn-fetch-all.bat   # Fetch all data
Scripts\sn-setup.bat       # Configuration wizard
```

#### Unix/Linux/macOS
```bash
./sn-tools.sh             # Main interactive launcher
./Scripts/sn-dev.sh       # Development tools menu
./Scripts/sn-watch.sh     # File watcher
./Scripts/sn-fetch-all.sh # Fetch all data
./Scripts/sn-setup.sh     # Configuration wizard
```

#### Cross-Platform (npm)
```bash
npm run execute           # Main launcher
npm run watch             # File watcher
npm run fetch-all         # Fetch all data
npm run setup             # Configuration wizard
npm run test-connections  # Test ServiceNow connections
npm run dependency-scan   # Analyze dependencies
npm run impact-analysis   # Impact analysis tools
```

### Development Tools
```bash
npm run watch-auto        # Auto-updating file watcher
npm run dependency-scan   # Full dependency analysis
npm run impact-analysis   # Impact analysis for changes
npm run generate-context  # Create AI context summary
npm run external-ai       # AI integration tools
```

## ⚙️ Configuration

### Initial Setup
1. **Run the setup wizard**:
   ```bash
   # Platform-specific
   sn-tools.bat          # Windows
   ./sn-tools.sh         # Unix/Linux/macOS

   # Or cross-platform
   npm run setup
   ```

2. **Edit configuration**: Modify `ServiceNow-Tools/sn-config.json` with your:
   - ServiceNow instance URLs
   - Authentication credentials
   - Table routing preferences
   - AI provider settings

### Configuration Structure
```json
{
  "instances": {
    "dev": { "instance": "dev.service-now.com", ... },
    "prod": { "instance": "prod.service-now.com", ... }
  },
  "routing": {
    "default": "dev",
    "stories": "prod",
    "tables": { ... }
  },
  "ai": {
    "mode": "interactive",
    "providers": { ... }
  }
}
```

## 🧪 Testing

### Cross-Platform Compatibility
```bash
cd ServiceNow-Tools
node test-cross-platform.js
```

### Connection Testing
```bash
npm run test-connections
```

### Full Functionality Test
```bash
npm run test-all-functionality
```

## 🏗️ Architecture

### Directory Structure
```
sn-tools/
├── sn-tools.bat/.sh           # Root level launchers
├── sn-dev.bat/.sh             # Dev tools launchers
├── sn-setup.bat/.sh           # Setup launchers
├── Scripts/                   # Platform launchers
│   ├── sn-tools.bat/.sh       # Main launcher (both platforms)
│   ├── sn-fetch-all.bat/.sh   # Data fetching
│   ├── sn-watch.bat/.sh       # File watching
│   ├── sn-dev.bat/.sh         # Development mode
│   └── sn-setup.bat/.sh       # Setup wizard
└── ServiceNow-Tools/          # Core Node.js application
    ├── sn-launcher.js         # Cross-platform launcher
    ├── sn-auto-execute.js     # Auto-execution engine
    ├── sn-operations.js       # Core operations
    ├── sn-file-watcher.js     # File watching system
    ├── sn-dependency-tracker.js # Dependency analysis
    ├── sn-ai-integration-v2.js # AI integration
    ├── test-cross-platform.js # Platform tests
    ├── install.js             # Cross-platform installer
    └── sn-config.json         # Configuration
```

### Core Components

#### 1. Cross-Platform Launcher (`sn-launcher.js`)
- Platform detection and adaptation
- NVM and system Node.js support
- Interactive menu system
- AI mode configuration

#### 2. Operations Engine (`sn-operations.js`)
- ServiceNow API interactions
- Multi-instance routing
- Data fetching and processing
- Record creation and updates

#### 3. File Watcher (`sn-file-watcher.js`)
- Real-time file monitoring
- Auto-sync with ServiceNow
- Change detection and processing
- Backup and rollback support

#### 4. Dependency Tracker (`sn-dependency-tracker.js`)
- Script Include dependency mapping
- Flow relationship analysis
- Impact analysis tools
- Dependency graph generation

#### 5. AI Integration (`sn-ai-integration-v2.js`)
- Multiple AI provider support
- Context-aware prompting
- Intelligent record creation
- Error analysis and suggestions

## 🤖 AI Integration

### Supported Providers
- **Claude Code** - Primary integration for interactive development
- **ChatGPT CLI** - Command-line ChatGPT integration
- **Claude API** - Direct Anthropic Claude API access

### AI Modes
- **Auto Mode** - Full AI automation for all operations
- **Interactive Mode** - AI assistance on demand
- **Manual Mode** - No AI assistance

### AI Features
- **Smart Record Creation** - Describe what you want, AI generates the code
- **Error Analysis** - AI-powered debugging and error resolution
- **Code Review** - Automated code analysis and suggestions
- **Documentation Generation** - AI-generated documentation and comments
- **Impact Analysis** - AI-powered change impact assessment

## 🔒 Security

### Credential Management
- Encrypted credential storage (in development)
- Environment variable support
- Secure configuration validation
- API key management

### Safety Features
- AI operation approval requirements
- Rate limiting for AI API calls
- Restricted operations for AI automation
- Emergency disable functionality

## 📊 Monitoring & Analytics

### Error Handling
```bash
npm run error-stats         # View error statistics
node sn-error-handler.js    # Error analysis tools
```

### Performance Tracking
- Operation timing and metrics
- AI usage statistics
- Connection health monitoring
- Dependency analysis reports

## 🛠️ Development

### Contributing
1. Fork the repository
2. Create a feature branch
3. Run cross-platform tests: `node test-cross-platform.js`
4. Submit a pull request

### Debugging
- Enable verbose logging in configuration
- Use `npm run error-stats` for error analysis
- Check `test-results-*.json` files for test details
- Monitor AI integration logs

## 📋 Requirements

- **Node.js**: v12.0.0+ (v22.11.0 recommended)
- **ServiceNow**: Any supported version
- **Platforms**: Windows, macOS, Linux
- **Optional**: Claude Code CLI, ChatGPT CLI

## 🆘 Troubleshooting

### Common Issues
1. **Permission Errors (Unix)**: Run installer to set executable permissions
2. **Node.js Not Found**: Ensure Node.js is in PATH or use NVM
3. **Connection Issues**: Verify credentials and instance URLs
4. **AI Integration**: Check API keys and provider availability

### Getting Help
- Check `CLAUDE.md` for Claude Code specific integration
- Review configuration examples in `install.js`
- Run diagnostic tests: `npm run test-all-functionality`
- Enable debug logging in configuration

## 📄 License

UNLICENSED - Internal use only

## 🔄 Version History

### v2.1.0 (Current)
- ✅ Complete cross-platform support
- ✅ Enhanced AI integration with multiple providers
- ✅ Advanced dependency tracking and impact analysis
- ✅ Comprehensive error handling and monitoring
- ✅ Cross-platform installer and testing

---

**ServiceNow Tools v2.1.0** - Professional development made simple, powerful, and cross-platform. 🚀