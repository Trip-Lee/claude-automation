# ServiceNow Tools - Cross-Platform Development Toolkit

## Quick Commands (Cross-Platform)

### Testing & Validation
- **Lint**: `npm run test-connections` (from ServiceNow-Tools directory)
- **Type Check**: Node.js project - no TypeScript
- **Test**: `npm run test-connections`
- **Cross-Platform Test**: `node test-cross-platform.js` (from ServiceNow-Tools directory)

### Build Commands
- **Build**: `npm install` (from ServiceNow-Tools directory)
- **Start**: `npm start` or `node sn-auto-execute.js`

### Platform-Specific Operations

#### Windows
- **Launch Tools**: `sn-tools.bat` or `Scripts\sn-tools.bat`
- **Fetch Data**: `Scripts\sn-fetch-all.bat`
- **Watch Files**: `Scripts\sn-watch.bat`
- **Development Mode**: `Scripts\sn-dev.bat`
- **Setup Wizard**: `Scripts\sn-setup.bat`

#### Unix/Linux/macOS
- **Launch Tools**: `./sn-tools.sh` or `./Scripts/sn-tools.sh`
- **Fetch Data**: `./Scripts/sn-fetch-all.sh`
- **Watch Files**: `./Scripts/sn-watch.sh`
- **Development Mode**: `./Scripts/sn-dev.sh`
- **Setup Wizard**: `./Scripts/sn-setup.sh`

#### Cross-Platform (npm)
- **Launch Tools**: `npm run execute`
- **Fetch Data**: `npm run fetch-all`
- **Watch Files**: `npm run watch`
- **Development Mode**: Available via main launcher

## Directory Structure
```
W:\sn-tools\
├── sn-tools.bat/.sh           # Root level launchers (Windows/Unix)
├── sn-dev.bat/.sh             # Root level dev tools launchers
├── sn-setup.bat/.sh           # Root level setup launchers
├── Scripts\                   # Platform-specific launchers
│   ├── sn-tools.bat/.sh       # Main launcher (both platforms)
│   ├── sn-fetch-all.bat/.sh   # Data fetching (both platforms)
│   ├── sn-watch.bat/.sh       # File watching (both platforms)
│   ├── sn-dev.bat/.sh         # Development mode (both platforms)
│   └── sn-setup.bat/.sh       # Setup wizard (both platforms)
└── ServiceNow-Tools\          # Core Node.js application
    ├── sn-launcher.js         # Cross-platform launcher
    ├── sn-auto-execute.js     # Main entry point
    ├── test-cross-platform.js # Cross-platform compatibility tests
    ├── install.js             # Cross-platform installer
    ├── package.json           # Dependencies
    └── sn-config.json         # Configuration
```

## Development Workflow (Cross-Platform)

### Getting Started
1. **Install Dependencies**: `cd ServiceNow-Tools && npm install`
2. **Run Cross-Platform Tests**: `node test-cross-platform.js`
3. **Choose Your Platform**:
   - **Windows**: Use `.bat` files (e.g., `sn-tools.bat`)
   - **Unix/Linux/macOS**: Use `.sh` files (e.g., `./sn-tools.sh`)
   - **Any Platform**: Use npm commands (e.g., `npm run execute`)

### Platform Detection
- The installer automatically detects your platform
- Unix shell scripts get executable permissions set automatically
- NVM Node.js detection works across platforms
- Fallback to system Node.js if NVM not available

## Key Files to Know

### Core Application
- `ServiceNow-Tools/sn-launcher.js` - Main launcher logic with platform detection
- `ServiceNow-Tools/sn-config.json` - Configuration settings
- `ServiceNow-Tools/package.json` - Project dependencies
- `ServiceNow-Tools/install.js` - Cross-platform installer
- `ServiceNow-Tools/test-cross-platform.js` - Platform compatibility tests

### Platform Launchers
- **Windows**: `Scripts/sn-tools.bat`, `sn-tools.bat` (root)
- **Unix/Linux/macOS**: `Scripts/sn-tools.sh`, `sn-tools.sh` (root)

## Cross-Platform Support Features

### Automatic Platform Detection
- Detects Windows (`win32`), macOS (`darwin`), Linux (`linux`)
- Adapts Node.js executable paths automatically
- Handles directory separators correctly
- Sets appropriate file permissions

### Installation
- Cross-platform installer handles all platforms
- Automatic executable permissions on Unix systems
- NVM and system Node.js detection
- Directory structure creation works everywhere

### Testing
- Comprehensive cross-platform test suite
- Tests all launchers and core functionality
- Validates file permissions and executability
- Platform-specific script validation

## Integration Notes
- **Node.js**: v22.11.0 configured and tested
- **Dependencies**: Install via `npm install` in ServiceNow-Tools directory
- **Launchers**: Choose platform-appropriate scripts or use npm commands
- **Permissions**: Unix scripts automatically made executable during install
- **Compatibility**: Tested on Windows, with full Unix/Linux/macOS support built-in