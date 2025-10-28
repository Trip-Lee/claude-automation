# Cross-Platform Support Guide

## 🌍 Platform Support Overview

ServiceNow Tools v2.1.0 provides comprehensive cross-platform support with identical functionality across Windows, macOS, and Linux systems.

## 🚀 Platform-Specific Launchers

### Windows (.bat files)
```batch
# Root level launchers
sn-tools.bat              # Main interactive launcher
sn-dev.bat                 # Development tools menu
sn-setup.bat               # Configuration wizard

# Scripts directory
Scripts\sn-tools.bat       # Main launcher
Scripts\sn-dev.bat         # Development tools
Scripts\sn-watch.bat       # File watcher
Scripts\sn-fetch-all.bat   # Data fetching
Scripts\sn-setup.bat       # Setup wizard
```

### Unix/Linux/macOS (.sh files)
```bash
# Root level launchers (executable)
./sn-tools.sh             # Main interactive launcher
./sn-dev.sh               # Development tools menu
./sn-setup.sh             # Configuration wizard

# Scripts directory
./Scripts/sn-tools.sh     # Main launcher
./Scripts/sn-dev.sh       # Development tools
./Scripts/sn-watch.sh     # File watcher
./Scripts/sn-fetch-all.sh # Data fetching
./Scripts/sn-setup.sh     # Setup wizard
```

### Cross-Platform (npm)
```bash
# Works on any platform with Node.js
npm run execute           # Main launcher
npm run watch             # File watcher
npm run fetch-all         # Data fetching
npm run setup             # Configuration
npm run test-connections  # Connection testing
```

## 🔧 Technical Implementation

### Platform Detection
```javascript
// Automatic platform detection in sn-launcher.js
this.platform = process.platform;
this.isWindows = this.platform === 'win32';
this.isMac = this.platform === 'darwin';
this.isLinux = this.platform === 'linux';
```

### Node.js Executable Detection
```javascript
// Windows: Check for NVM Node.js first, fall back to system
if (this.isWindows) {
    const nvmNode = path.join(this.rootDir, 'nvm', 'v22.11.0', 'node.exe');
    if (fs.existsSync(nvmNode)) {
        return nvmNode;
    }
}
return 'node';
```

### Shell Script Structure
```bash
#!/usr/bin/env bash
# Get script directory (works across Unix variants)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../ServiceNow-Tools"

# Use NVM Node if available, otherwise system Node
if [ -x "$SCRIPT_DIR/../nvm/v22.11.0/bin/node" ]; then
    "$SCRIPT_DIR/../nvm/v22.11.0/bin/node" sn-launcher.js "$@"
else
    node sn-launcher.js "$@"
fi
```

### Batch File Structure
```batch
@echo off
cd /d "%~dp0..\ServiceNow-Tools"

:: Use NVM Node if available, otherwise system Node
if exist "%~dp0..\nvm\v22.11.0\node.exe" (
    "%~dp0..\nvm\v22.11.0\node.exe" sn-launcher.js %*
) else (
    node sn-launcher.js %*
)
```

## 🛠️ Installation Differences

### Executable Permissions (Unix/Linux/macOS)
The installer automatically sets executable permissions:

```javascript
// install.js - setExecutablePermissions()
if (process.platform !== 'win32') {
    fs.chmodSync(scriptPath, '755');
    console.log(`✅ Made executable: ${script}`);
}
```

### Directory Separators
All paths use `path.join()` for cross-platform compatibility:

```javascript
// Works on all platforms
const configPath = path.join(this.toolsDir, 'sn-config.json');
const scriptPath = path.join(this.rootDir, 'Scripts', 'sn-tools.bat');
```

## 🧪 Cross-Platform Testing

### Test Suite (`test-cross-platform.js`)
Comprehensive testing across all platforms:

```javascript
// Platform-specific tests
testPlatformScriptsExist() {
    if (this.isWindows) {
        // Test Windows batch files
        const batchFiles = [/* .bat files */];
    } else {
        // Test Unix shell scripts
        const shellFiles = [/* .sh files */];
    }
}

testShellScriptsExecutable() {
    if (!this.isWindows) {
        // Test executable permissions on Unix
        for (const file of shellFiles) {
            this.checkExecutable(path.join(this.toolsDir, file));
        }
    }
}
```

### Running Tests
```bash
cd ServiceNow-Tools
node test-cross-platform.js
```

**Expected Results:**
- ✅ Core Files Exist
- ✅ Platform Scripts Exist
- ✅ Shell Scripts Executable (Unix only)
- ✅ Node.js Launcher
- ✅ Command Line Interface
- ✅ Configuration Management

## 🔄 Platform-Specific Features

### Windows Features
- **NVM Detection**: Automatic detection of Node Version Manager for Windows
- **Batch File Launchers**: Native Windows .bat files with proper PATH handling
- **Directory Navigation**: Uses `cd /d` for proper drive switching
- **Error Handling**: Windows-specific error codes and handling

### Unix/Linux/macOS Features
- **Shebang Support**: `#!/usr/bin/env bash` for maximum compatibility
- **Executable Permissions**: Automatic `chmod +x` during installation
- **BASH_SOURCE**: Reliable script directory detection across shells
- **Signal Handling**: Proper SIGTERM and SIGINT handling

### Cross-Platform Features
- **Path Resolution**: Consistent path handling via Node.js `path` module
- **Configuration**: Single JSON configuration works everywhere
- **Error Handling**: Unified error handling and logging
- **Process Management**: Consistent child process spawning

## 🚨 Platform-Specific Troubleshooting

### Windows Issues
```batch
# Permission issues
# Run as Administrator if needed

# Path issues
# Ensure Node.js is in PATH
where node

# Batch file execution issues
# Check file associations
assoc .bat
```

### Unix/Linux/macOS Issues
```bash
# Permission denied
chmod +x *.sh Scripts/*.sh

# Command not found
# Check PATH includes current directory or use ./
echo $PATH

# Shell compatibility
# Ensure bash is available
which bash
```

### Node.js Issues (All Platforms)
```bash
# Version check
node --version
npm --version

# Path issues
which node     # Unix/Linux/macOS
where node     # Windows

# NVM issues
nvm list       # Check installed versions
nvm use 22.11.0 # Switch version
```

## 📊 Platform Testing Matrix

| Feature | Windows | macOS | Linux | Status |
|---------|---------|-------|-------|--------|
| Core Launchers | ✅ | ✅ | ✅ | Complete |
| File Watchers | ✅ | ✅ | ✅ | Complete |
| Data Fetching | ✅ | ✅ | ✅ | Complete |
| Setup Wizard | ✅ | ✅ | ✅ | Complete |
| NVM Support | ✅ | ✅ | ✅ | Complete |
| Auto Permissions | N/A | ✅ | ✅ | Complete |
| Cross-Platform Tests | ✅ | ✅ | ✅ | Complete |

## 🔮 Future Platform Enhancements

### Planned Features
- **Docker Support**: Containerized deployment option
- **PowerShell Scripts**: Native PowerShell launchers for Windows
- **Fish Shell Support**: Additional shell compatibility
- **ARM64 Support**: Native ARM64 Node.js detection
- **Alpine Linux**: Lightweight Linux distribution support

### Platform-Specific Optimizations
- **Windows**: WSL (Windows Subsystem for Linux) detection and support
- **macOS**: Apple Silicon (M1/M2) optimization
- **Linux**: Flatpak and Snap package options

## 💡 Best Practices

### Development
- Always test on multiple platforms before release
- Use `path.join()` for all file paths
- Handle platform differences in separate functions
- Test both NVM and system Node.js installations

### Deployment
- Include both .bat and .sh files in distributions
- Set executable permissions in post-install scripts
- Document platform-specific requirements clearly
- Provide platform-specific troubleshooting guides

### Maintenance
- Run cross-platform tests in CI/CD pipelines
- Monitor platform-specific error reports
- Keep platform detection logic up-to-date
- Test with different Node.js versions

---

**ServiceNow Tools v2.1.0** provides seamless cross-platform functionality with no compromises. Choose your platform, we'll handle the rest! 🚀