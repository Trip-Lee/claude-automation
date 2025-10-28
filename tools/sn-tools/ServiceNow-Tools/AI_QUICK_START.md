# 🚀 AI Integration Quick Start Guide

Get started with ServiceNow Tools' enhanced AI integration in 5 minutes!

## 📋 Prerequisites

- ✅ ServiceNow Tools installed (`npm install` completed)
- ✅ ServiceNow instance configured
- ⚠️ One AI tool installed (see options below)

---

## 🎯 Option 1: Claude Code (Recommended)

### **Step 1: Install Claude Code**
1. Visit: https://claude.ai/code
2. Download and install for your operating system
3. Verify installation: Open terminal and type `claude --version`

### **Step 2: Test AI Integration**
```bash
cd ServiceNow-Tools
npm run test-ai-improvements
```

Expected output:
```
🧪 Testing Enhanced AI Integration
✓ Configuration Manager working
✓ Process Manager working
✓ AI Detection Cache working
✓ Enhanced AI Integration working
    Providers: 1, Best: Claude Code
🎉 ALL TESTS PASSED!
```

### **Step 3: Create Your First AI Record**
```bash
node sn-operations.js create --table sys_script_include --ai-prompt "Create a utility to validate email addresses with comprehensive error handling"
```

**What happens:**
1. 🔍 AI detects Claude Code is available
2. 🤖 Sends your prompt to Claude Code
3. ⚡ Claude generates complete ServiceNow record
4. ✅ Creates record in your ServiceNow instance

---

## 🎯 Option 2: ChatGPT CLI (Alternative)

### **Step 1: Install ChatGPT CLI**
```bash
npm install -g chatgpt-cli
# or
pip install chatgpt-cli
```

### **Step 2: Configure API Key**
Follow ChatGPT CLI setup instructions to add your OpenAI API key.

### **Step 3: Test & Create**
```bash
npm run test-ai-improvements
node sn-operations.js create --table sys_script_include --ai-prompt "Create phone number formatter"
```

---

## 🎯 Option 3: Claude API (Fallback)

### **Step 1: Get API Key**
1. Visit: https://console.anthropic.com/
2. Create account and get API key

### **Step 2: Configure**
```bash
npm run claude-setup
# Enter API key when prompted
```

### **Step 3: Test & Create**
```bash
npm run claude-test
node sn-operations.js create --table sys_script_include --ai-prompt "Create date utility functions"
```

---

## 🎨 AI Record Creation Examples

### **Script Includes**
```bash
node sn-operations.js create --table sys_script_include --ai-prompt "Create utility to format currency values with locale support"
```

### **REST API Operations**
```bash
node sn-operations.js create --table sys_ws_operation --ai-prompt "Create API endpoint for user profile updates with validation"
```

### **Business Rules**
```bash
node sn-operations.js create --table sys_script --ai-prompt "Auto-assign incidents to correct group based on category"
```

### **UI Actions**
```bash
node sn-operations.js create --table sys_ui_action --ai-prompt "Add button to export incident list to CSV"
```

### **Client Scripts**
```bash
node sn-operations.js create --table sys_script_client --ai-prompt "Show/hide fields based on priority selection"
```

---

## 🎛️ AI Modes

### **Auto Mode** (Default)
```bash
node sn-operations.js create --table sys_script_include --ai-prompt "Your request" --ai-mode auto
```
- ✅ Generates record automatically
- ✅ Creates in ServiceNow immediately
- ⚡ Fastest option

### **Interactive Mode**
```bash
node sn-operations.js create --table sys_script_include --ai-prompt "Your request" --ai-mode interactive
```
- 👁️ Shows generated record
- ❓ Asks for confirmation: "Do you want to proceed with this AI-generated data? (y/n)"
- 🛡️ Review before creation

---

## 🔍 Troubleshooting

### **Issue: "No AI providers available"**
**Solution:**
```bash
npm run test-ai-improvements
# Check which AI tools are detected
```

### **Issue: AI detection takes too long**
**Solution:**
```bash
# Clear cache and re-detect
rm .ai-detection-cache.json
npm run test-ai-improvements
```

### **Issue: Generated record is incomplete**
**Solution:**
- Make your prompt more specific
- Include table/field requirements
- Example: "Create sys_script_include for email validation with name field set to 'EmailValidator'"

### **Issue: Connection errors**
**Solutions:**
- Check ServiceNow instance credentials
- Verify network connectivity: `npm run test-connections`
- Review configuration: Check `sn-config.json`

---

## 📊 Performance Monitoring

### **Check System Status**
```bash
npm run test-ai-improvements
```

### **Monitor Performance**
Expected performance metrics:
- **Configuration loading**: 0.1ms (cached)
- **AI detection**: 50ms (cached)
- **Record generation**: 2-10 seconds
- **Total operation**: 5-15 seconds

### **Cache Management**
```bash
# Check cache status
ls -la .ai-detection-cache.json

# Clear cache if needed
rm .ai-detection-cache.json
```

---

## 🎯 Best Practices

### **Prompt Writing**
✅ **Good prompts:**
- "Create script include for email validation with RFC 5322 compliance"
- "Generate REST API for user management with CRUD operations"
- "Build business rule to auto-escalate P1 incidents after 30 minutes"

❌ **Avoid:**
- "Create something"
- "Make a script"
- "Help with ServiceNow"

### **Security**
- ✅ AI validates all generated content
- ✅ Malicious prompt detection enabled
- ✅ Process isolation for security
- ✅ Automatic cleanup prevents resource leaks

### **Performance**
- ✅ Use cached detection (90% faster)
- ✅ Specify AI mode for consistency
- ✅ Monitor resource usage
- ✅ Clear cache if detection becomes stale

---

## 🎉 Next Steps

1. **Explore Advanced Features**
   - Custom AI prompts for complex records
   - Multi-table record creation
   - Integration with file watcher

2. **Integrate with Workflow**
   - Add AI creation to batch scripts
   - Set up automated record generation
   - Configure CI/CD integration

3. **Monitor and Optimize**
   - Track AI usage patterns
   - Optimize prompts for better results
   - Monitor performance metrics

---

## 📞 Support

### **Get Help**
```bash
# Check system status
npm run test-ai-improvements

# View all available commands
node sn-operations.js --help

# Test connections
npm run test-connections
```

### **Common Commands Reference**
```bash
# AI Record Creation
node sn-operations.js create --table [TABLE] --ai-prompt "[DESCRIPTION]"

# System Testing
npm run test-ai-improvements

# Legacy Claude API
npm run claude-setup
npm run claude-test
npm run claude-stats

# ServiceNow Operations
npm run fetch-data
npm run test-connections
```

**🎊 You're ready to create ServiceNow records with AI! Start with a simple script include and explore from there.**