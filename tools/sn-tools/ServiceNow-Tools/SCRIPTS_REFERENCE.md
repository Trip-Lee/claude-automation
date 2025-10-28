# 📜 ServiceNow Tools - Scripts Reference

Complete reference for all available npm scripts and command-line operations.

---

## 📦 NPM Scripts

### **🚀 Core Operations**
```bash
npm start                    # Launch main application
npm run execute              # Same as npm start
npm install                  # Install dependencies with setup
```

### **📊 Data Operations**
```bash
npm run fetch-data          # Fetch ServiceNow table data
npm run fetch-stories       # Fetch user stories from ServiceNow
npm run fetch-all           # Fetch both data and stories
npm run process-updates     # Process pending updates
```

### **🔍 Testing & Diagnostics**
```bash
npm run test-connections    # Test all ServiceNow instance connections
npm run test-ai-improvements # Test enhanced AI integration system
```

### **👀 File Monitoring**
```bash
npm run watch               # Start file watcher
npm run watch-auto          # File watcher with auto-update
```

### **📈 Dependencies & Analysis**
```bash
npm run dependency-scan     # Scan all dependencies
npm run impact-analysis     # Analyze change impacts
npm run generate-context    # Generate Claude context
```

### **🤖 Enhanced AI Integration**
```bash
npm run test-ai-improvements          # Test AI tool detection and performance
```

**Usage Examples:**
```bash
# Create records with AI (auto-detects best provider)
node sn-operations.js create --table sys_script_include --ai-prompt "Create email validator utility"

# Interactive AI mode
node sn-operations.js create --table sys_script_include --ai-prompt "Create utility" --ai-mode interactive

# Auto AI mode
node sn-operations.js create --table sys_script_include --ai-prompt "Create utility" --ai-mode auto
```

### **📱 Legacy Claude API**
```bash
npm run claude-setup        # Setup Claude API integration
npm run claude-test         # Test Claude API connection
npm run claude-stats        # Show Claude usage statistics
npm run claude-approvals    # Manage Claude approvals
```

---

## 🖥️ Direct Commands

### **🛠️ sn-operations.js Commands**

#### **Test Operations**
```bash
node sn-operations.js test                    # Test all connections
node sn-operations.js interactive             # Interactive mode
```

#### **Data Operations**
```bash
node sn-operations.js fetch-data              # Fetch ServiceNow data
node sn-operations.js fetch-stories           # Fetch user stories
node sn-operations.js process-updates         # Process updates
```

#### **Record Creation (Enhanced)**
```bash
# AI-Powered Creation
node sn-operations.js create --table [TABLE] --ai-prompt "[DESCRIPTION]"
node sn-operations.js create --table [TABLE] --ai-prompt "[DESCRIPTION]" --ai-mode [auto|interactive|manual]

# Manual Creation
node sn-operations.js create --table [TABLE] --data [JSON_FILE]
node sn-operations.js create --table [TABLE] --field [NAME] --value [VALUE]

# Examples
node sn-operations.js create --table sys_script_include --ai-prompt "Create email validator"
node sn-operations.js create --table sys_ws_operation --ai-prompt "REST API for user management"
node sn-operations.js create --table sys_script --ai-prompt "Auto-escalate high priority incidents"
```

#### **Record Updates**
```bash
node sn-operations.js update --type [TYPE] --sys_id [SYS_ID] --field [FIELD] --value [VALUE]
node sn-operations.js update --type [TYPE] --sys_id [SYS_ID] --field [FIELD] --file [FILE_PATH]
node sn-operations.js update --ai-prompt "[DESCRIPTION]" --record-name "[NAME]"
```

### **📋 sn-claude-manager.js Commands**
```bash
node sn-claude-manager.js setup              # Interactive Claude setup
node sn-claude-manager.js stats              # Show usage statistics
node sn-claude-manager.js approvals          # Manage pending approvals
node sn-claude-manager.js test               # Test Claude integration
node sn-claude-manager.js test-analysis      # Test analysis capabilities
node sn-claude-manager.js emergency-disable  # Emergency disable
```

### **🔍 sn-claude-helper.js Commands**
```bash
node sn-claude-helper.js trace [COMPONENT]   # Trace component flow
node sn-claude-helper.js summary             # Generate project summary
```

### **📊 sn-dependency-tracker.js Commands**
```bash
node sn-dependency-tracker.js scan           # Scan all dependencies
node sn-dependency-tracker.js impact [NAME]  # Impact analysis for component
node sn-dependency-tracker.js graph          # Generate dependency graph
node sn-dependency-tracker.js graph --format dot  # Export as DOT format
```

### **👁️ sn-file-watcher.js Commands**
```bash
node sn-file-watcher.js watch                # Start file watcher
node sn-file-watcher.js watch --auto-update  # Auto-update on changes
```

### **🎯 sn-flow-tracer.js Commands**
```bash
node sn-flow-tracer.js trace [FLOW_NAME]     # Trace specific flow
node sn-flow-tracer.js api [API_NAME]        # Trace API flow
node sn-flow-tracer.js comprehensive [NAME]  # Comprehensive trace
```

---

## 📝 Enhanced AI Script Examples

### **Script Includes**
```bash
# Email validation utility
node sn-operations.js create --table sys_script_include --ai-prompt "Create comprehensive email validator with RFC compliance and domain verification"

# Phone number formatter
node sn-operations.js create --table sys_script_include --ai-prompt "Create utility to format phone numbers for different countries"

# Currency converter
node sn-operations.js create --table sys_script_include --ai-prompt "Create currency formatting utility with locale support"
```

### **REST API Operations**
```bash
# User management API
node sn-operations.js create --table sys_ws_operation --ai-prompt "Create REST API for user profile CRUD operations with validation"

# File upload API
node sn-operations.js create --table sys_ws_operation --ai-prompt "Create secure file upload endpoint with type validation"

# Reporting API
node sn-operations.js create --table sys_ws_operation --ai-prompt "Create API to generate incident reports with filters"
```

### **Business Rules**
```bash
# Auto-assignment rule
node sn-operations.js create --table sys_script --ai-prompt "Auto-assign incidents to correct group based on category and urgency"

# Escalation rule
node sn-operations.js create --table sys_script --ai-prompt "Escalate high priority incidents after 30 minutes without assignment"

# Notification rule
node sn-operations.js create --table sys_script --ai-prompt "Send email notification when incident status changes to resolved"
```

### **UI Actions**
```bash
# Export action
node sn-operations.js create --table sys_ui_action --ai-prompt "Add export to Excel button for incident list"

# Bulk update action
node sn-operations.js create --table sys_ui_action --ai-prompt "Create bulk update action for selected records"

# Print action
node sn-operations.js create --table sys_ui_action --ai-prompt "Add print-friendly view button for incident details"
```

### **Client Scripts**
```bash
# Form validation
node sn-operations.js create --table sys_script_client --ai-prompt "Validate email format and phone number on form submission"

# Dynamic fields
node sn-operations.js create --table sys_script_client --ai-prompt "Show/hide fields based on category selection"

# Auto-population
node sn-operations.js create --table sys_script_client --ai-prompt "Auto-populate user details when selecting assigned user"
```

---

## 🔧 Configuration Scripts

### **Setup & Installation**
```bash
node install.js                              # Run installation wizard
node sn-auto-execute.js setup                # Configure ServiceNow connections
```

### **Testing Scripts**
```bash
node test-cross-platform.js                  # Cross-platform compatibility test
node test-ai-improvements.js                 # Test enhanced AI system
```

---

## 📊 Performance Monitoring Scripts

### **AI System Performance**
```bash
# Test AI integration performance
npm run test-ai-improvements

# Expected output:
# Configuration Manager: ✓ PASS
# Process Manager: ✓ PASS
# AI Detection Cache: ✓ PASS
# Enhanced AI Integration: ✓ PASS
# Config Loading Improvement: 99%
# Average Config Load: 0.10ms
# AI Initialization: 50ms
```

### **Connection Performance**
```bash
# Test ServiceNow connection speed
npm run test-connections

# Monitor fetch performance
time npm run fetch-data
```

---

## 🛡️ Security & Maintenance Scripts

### **Security Checks**
```bash
# Audit dependencies
npm audit

# Fix vulnerabilities
npm audit fix

# Check for updates
npm outdated
```

### **Cache Management**
```bash
# Clear AI detection cache
rm .ai-detection-cache.json

# Clear dependency cache
rm dependency-cache.json

# Clear all temp files
rm -rf temp_updates/
```

---

## 📋 Script Categories Summary

| Category | Scripts | Description |
|----------|---------|-------------|
| **Core** | `npm start`, `npm run execute` | Main application launcher |
| **Data** | `npm run fetch-*`, `npm run process-updates` | ServiceNow data operations |
| **AI** | `npm run test-ai-improvements`, `node sn-operations.js create --ai-prompt` | Enhanced AI integration |
| **Testing** | `npm run test-*` | System diagnostics |
| **Files** | `npm run watch*` | File monitoring |
| **Analysis** | `npm run dependency-scan`, `npm run impact-analysis` | Code analysis |
| **Legacy** | `npm run claude-*` | Legacy Claude API features |

---

## 🎯 Quick Reference Commands

```bash
# Most commonly used commands
npm run test-ai-improvements                  # Test AI system
node sn-operations.js create --table sys_script_include --ai-prompt "Create utility"
npm run test-connections                      # Test ServiceNow
npm run fetch-all                            # Get latest data
npm run watch                                # Monitor files

# Troubleshooting
npm run test-ai-improvements                 # Check AI status
npm run test-connections                     # Check ServiceNow
node sn-operations.js interactive            # Interactive mode
npm run claude-stats                         # Check Claude usage
```

**💡 Pro Tip**: Use `npm run test-ai-improvements` to check system health and see which AI providers are available before creating records.