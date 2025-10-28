# ServiceNow Tools - Cross-Platform Installation Guide

## 🚀 Quick Installation

### Windows
```batch
cd ServiceNow-Tools
npm install
sn-tools.bat
```

### Unix/Linux/macOS
```bash
cd ServiceNow-Tools
npm install
./sn-tools.sh
```

### Cross-Platform (Any OS)
```bash
cd ServiceNow-Tools
npm install
npm run execute
```

## 📋 System Requirements

### Minimum Requirements
- **Node.js**: v12.0.0 or higher
- **npm**: Included with Node.js
- **Memory**: 512MB RAM available
- **Disk Space**: 100MB free space

### Recommended Requirements
- **Node.js**: v22.11.0 (tested and optimized)
- **Memory**: 1GB RAM available
- **Disk Space**: 500MB free space (for data caching)

### Platform Support
- ✅ **Windows 10/11** (with batch file launchers)
- ✅ **macOS** (with shell script launchers)
- ✅ **Linux** (Ubuntu, CentOS, RHEL, etc.)
- ✅ **Any platform** with Node.js support

## 🔧 Detailed Installation Steps

### Step 1: Prerequisites

#### Node.js Installation

**Windows:**
1. Download from [nodejs.org](https://nodejs.org/)
2. Run installer with default options
3. Verify: `node --version` and `npm --version`

**macOS:**
```bash
# Using Homebrew (recommended)
brew install node

# Or download from nodejs.org
```

**Linux (Ubuntu/Debian):**
```bash
# Using NodeSource repository (recommended)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

**Linux (CentOS/RHEL/Fedora):**
```bash
# Using NodeSource repository
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs

# Or for newer versions
sudo dnf install -y nodejs npm
```

### Step 2: Project Setup

1. **Extract/Clone the project:**
   ```bash
   # If you have a zip file
   unzip sn-tools.zip
   cd sn-tools

   # If cloning from repository
   git clone <repository-url>
   cd sn-tools
   ```

2. **Navigate to core directory:**
   ```bash
   cd ServiceNow-Tools
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

### Step 3: Platform-Specific Setup

#### Windows Setup
```batch
# The installer will automatically:
# 1. Create required directories
# 2. Set up batch file launchers
# 3. Configure NVM detection (if available)

# Test installation
node test-cross-platform.js

# Launch
cd ..
sn-tools.bat
```

#### Unix/Linux/macOS Setup
```bash
# The installer will automatically:
# 1. Create required directories
# 2. Set up shell script launchers
# 3. Set executable permissions (chmod +x)
# 4. Configure Node.js detection

# Test installation
node test-cross-platform.js

# Launch
cd ..
./sn-tools.sh
```

### Step 4: Initial Configuration

1. **Run setup wizard:**
   ```bash
   # Platform-specific
   sn-tools.bat         # Windows
   ./sn-tools.sh        # Unix/Linux/macOS

   # Or cross-platform
   npm run setup
   ```

2. **Configure ServiceNow instances:**
   - Edit `ServiceNow-Tools/sn-config.json`
   - Add your instance URLs, usernames, and passwords
   - Configure table routing preferences

3. **Test connections:**
   ```bash
   npm run test-connections
   ```

## 🧪 Verification

### Cross-Platform Test Suite
```bash
cd ServiceNow-Tools
node test-cross-platform.js
```

**Expected output:**
```
✅ Test passed: Core Files Exist
✅ Test passed: Platform Scripts Exist
✅ Test passed: Shell Scripts Executable
✅ Test passed: Node.js Launcher
✅ Test passed: Command Line Interface
✅ Test passed: Configuration Management
📊 Test Summary: 6/6 tests passed on [your-platform]
```

### Functionality Tests
```bash
# Test all core functionality
npm run test-all-functionality

# Test ServiceNow connections
npm run test-connections

# Test AI integration (if configured)
npm run test-consolidated-ai
```

## 🔧 Advanced Installation Options

### Using Node Version Manager (NVM)

**Windows (nvm-windows):**
```batch
# Install NVM for Windows from: https://github.com/coreybutler/nvm-windows
nvm install 22.11.0
nvm use 22.11.0
```

**Unix/Linux/macOS:**
```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell or restart terminal
source ~/.bashrc

# Install and use Node.js
nvm install 22.11.0
nvm use 22.11.0
```

### Custom Installation Path

If installing in a non-standard location:

1. **Update paths in configuration:**
   ```json
   {
     "paths": {
       "outputBase": "/custom/path/ServiceNow-Data",
       "componentRepoName": "CustomComponents"
     }
   }
   ```

2. **Verify path resolution:**
   ```bash
   npm run test-connections
   ```

### Docker Installation (Advanced)

```dockerfile
FROM node:22.11.0-alpine

WORKDIR /app
COPY ServiceNow-Tools/ ./
RUN npm install

# Set executable permissions
RUN chmod +x *.sh

CMD ["npm", "run", "execute"]
```

## 🐛 Troubleshooting Installation

### Common Issues

#### 1. Permission Denied (Unix/Linux/macOS)
```bash
# Fix: Set executable permissions
chmod +x *.sh Scripts/*.sh

# Or run the installer to fix permissions
cd ServiceNow-Tools
node install.js
```

#### 2. Node.js Not Found
```bash
# Check Node.js installation
which node
node --version

# If not installed, install Node.js first
# Then verify PATH includes Node.js binary directory
echo $PATH
```

#### 3. npm Dependencies Failed
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 4. Module Not Found Errors
```bash
# Ensure you're in the correct directory
cd ServiceNow-Tools
pwd

# Reinstall dependencies
npm install

# Check for global vs local installation issues
npm list
```

#### 5. Platform Detection Issues
```bash
# Check platform detection
node -e "console.log(process.platform)"

# Run platform-specific tests
node test-cross-platform.js
```

### Installation Verification Script

Create a verification script to test your installation:

```bash
#!/bin/bash
# verify-installation.sh

echo "ServiceNow Tools Installation Verification"
echo "=========================================="

echo -n "Node.js version: "
node --version

echo -n "npm version: "
npm --version

echo -n "Platform: "
node -e "console.log(process.platform)"

echo -n "Working directory: "
pwd

echo "Testing core modules..."
cd ServiceNow-Tools
node test-cross-platform.js

echo "Installation verification complete!"
```

## 📞 Getting Help

### Documentation
- `README.md` - Main project documentation
- `CLAUDE.md` - Claude Code integration guide
- This file - Installation guide

### Diagnostic Commands
```bash
# Check installation health
npm run test-all-functionality

# View error logs
npm run error-stats

# Test AI integration
npm run test-consolidated-ai

# Platform compatibility
node test-cross-platform.js
```

### Support Resources
- Check error logs in `ServiceNow-Tools/`
- Review test results in `test-results-*.json` files
- Enable debug logging in configuration
- Use built-in diagnostic tools

---

## 🎉 Post-Installation

Once installed successfully:

1. **Configure your ServiceNow instances** in `sn-config.json`
2. **Run your first data fetch**: `npm run fetch-data`
3. **Explore the interactive menu**: Launch via platform-specific script
4. **Set up AI integration** (optional): Configure in settings menu
5. **Start developing**: Use file watcher and dependency tools

**Welcome to ServiceNow Tools v2.1.0!** 🚀