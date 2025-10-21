# Dev-Tools - Interactive CLI Guide

Beautiful, user-friendly interface for the Claude Multi-Agent System.

---

## 🚀 Quick Start

```bash
# Run the interactive CLI
dev-tools
```

That's it! The CLI will guide you through everything.

---

## 📖 Usage Flow

### 1. **Launch dev-tools**

```bash
$ dev-tools
```

You'll see a beautiful ASCII art banner:

```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ██████╗ ███████╗██╗   ██╗      ████████╗ ██████╗  ██████╗ ██╗  ║
║   ██╔══██╗██╔════╝██║   ██║      ╚══██╔══╝██╔═══██╗██╔═══██╗██║  ║
║   ██║  ██║█████╗  ██║   ██║█████╗   ██║   ██║   ██║██║   ██║██║  ║
║   ██║  ██║██╔══╝  ╚██╗ ██╔╝╚════╝   ██║   ██║   ██║██║   ██║██║  ║
║   ██████╔╝███████╗ ╚████╔╝          ██║   ╚██████╔╝╚██████╔╝███████╗║
║   ╚═════╝ ╚══════╝  ╚═══╝           ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝║
║                                                                   ║
║            Claude Multi-Agent Development Assistant              ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

### 2. **Select Project**

Interactive dropdown with all your configured projects:

```
? Select a project to work on: (Use arrow keys)
❯ 📁 my-app
  📁 work-project
  📁 client-site
  ─────────────────
  ➕ Create New Project
  🚪 Exit
```

**Options:**
- Select an existing project (arrow keys + Enter)
- Create a new project
- Exit

---

### 3. **First Time? Create a Project**

If no projects exist, you'll see:

```
⚠️  No projects configured yet

? Would you like to create your first project? (Y/n)
```

Select **Yes** and the project wizard will start:

```
✨ New Project Wizard

? Project name: my-awesome-app
? GitHub repository (e.g., github.com/user/repo): github.com/username/my-awesome-app
? Base branch: (main)
? Docker image for development: (Use arrow keys)
  🐍 Python (claude-python:latest)
❯ 📦 Node.js (claude-node:latest)
  🔧 Custom
? Test command (leave empty if no tests): npm test
? Require pull request for changes? (Y/n)
```

The wizard will:
1. Validate your inputs
2. Create the configuration file
3. Check if the project directory exists
4. Give you instructions if it doesn't

---

### 4. **Enter Task Description**

Opens your default editor (vim, nano, etc.) for multi-line input:

```
📝 Task Description

  Examples:
    • "Add a login page with authentication"
    • "Fix the bug in the user registration flow"
    • "Refactor the API layer for better performance"
    • "Add unit tests for the shopping cart module"

? Describe the task (opens your default editor):
```

**Tips:**
- Write detailed descriptions for best results
- Include context, requirements, and constraints
- Mention specific files or functions if relevant

---

### 5. **Advanced Options (Optional)**

```
? Configure advanced options? (y/N)
```

If **Yes**:

```
? Enable interactive mode (provide feedback while agents work)? (Y/n)
? Maximum cost per task (USD): (5.0)
```

**Interactive Mode:**
- Enables real-time feedback while agents work
- You can queue changes, additions, or corrections mid-execution
- Highly recommended!

**Max Cost:**
- Safety limit for API usage
- Default: $5.00
- Maximum: $50.00

---

### 6. **Confirmation**

Review your task before execution:

```
📋 Task Summary

  Project:     my-awesome-app
  Task:        Add a login page with authentication
  Interactive: Yes
  Max Cost:    $5.00

? Start execution? (Y/n)
```

---

### 7. **Execution**

The multi-agent system starts working:

```
✨ Starting task execution...

🚀 Task 1729123456-a3f2 Starting

📋 Pre-flight checks...
  ✅ Checks passed

🔧 Setting up environment...
  ✅ Branch: claude/1729123456-a3f2
  ✅ Container ready

🧠 Planning execution strategy...

📋 Execution Plan:
  Phases: 4
  Estimated: 120s
  Complexity: medium

🎮 Interactive Mode Enabled
  Type commands while agents work:
    change <message>  - Request a change
    add <task>        - Add a new task
    stop              - Stop execution
    ...

claude>

🔄 Phase 1: Architecture Analysis
...
```

**While Running (Interactive Mode):**

You can type commands:

```
claude> change use Material UI for the login form
📬 User Feedback Queued: fb-1729123500-x7k2
   Type: change-request
   Message: use Material UI for the login form
   Queue size: 1

claude> status
📊 Current Status:
    Phase: Implementation
    Active agents: 2
    Queued feedback: 1

claude> add also add password reset functionality
📬 User Feedback Queued: fb-1729123520-p3m9
   Type: additional-task
   Message: also add password reset functionality
   Queue size: 2
```

---

### 8. **Completion**

```
🎉 Task completed successfully!

═══════════════════════════════════════════════════════════════════
TASK COMPLETE: Add a login page with authentication
═══════════════════════════════════════════════════════════════════

📊 OVERVIEW
─────────────────────────────────────────────────────────────────
Task ID:         1729123456-a3f2
Branch:          claude/1729123456-a3f2
Cost:            $2.34

📝 CHANGES
─────────────────────────────────────────────────────────────────
Created login page with Material UI components
Added authentication API endpoints
Updated routing configuration

🧪 TEST RESULTS
─────────────────────────────────────────────────────────────────
✅ All tests passed

📋 NEXT STEPS
─────────────────────────────────────────────────────────────────
✅ To approve and create PR:
   claude approve 1729123456-a3f2

❌ To reject and cleanup:
   claude reject 1729123456-a3f2

═══════════════════════════════════════════════════════════════════
```

---

## 🎯 Key Features

### ✨ **Beautiful Interface**
- ASCII art banner
- Color-coded output
- Clear visual hierarchy
- Emoji indicators

### 🎨 **Interactive Prompts**
- Dropdown selection for projects
- Editor for task descriptions
- Confirmation before execution
- Real-time status updates

### 🔧 **Project Wizard**
- Step-by-step configuration
- Input validation
- Sensible defaults
- YAML config generation

### 💬 **Live Feedback**
- Queue changes while agents work
- Add new tasks on the fly
- Stop execution if needed
- See real-time progress

### 🛡️ **Safety**
- Cost limits
- Configuration validation
- Confirmation prompts
- Easy rollback

---

## 📝 Examples

### Example 1: Simple Feature

```bash
$ dev-tools

# Select: my-app
# Task: "Add a dark mode toggle to settings"
# Interactive: Yes
# Max Cost: $5.00
# Confirm: Yes

# Result: ~60 seconds, 1 PR created
```

### Example 2: Complex Refactor

```bash
$ dev-tools

# Select: work-project
# Task: "Refactor the entire API layer for better performance
#        - Use caching where appropriate
#        - Optimize database queries
#        - Add connection pooling
#        - Document all changes"
# Interactive: Yes (highly recommended for complex tasks)
# Max Cost: $10.00
# Confirm: Yes

# During execution:
claude> change use Redis for caching instead of in-memory
claude> add also add rate limiting to public endpoints

# Result: ~180 seconds, multiple files changed, 1 PR created
```

### Example 3: Bug Fix

```bash
$ dev-tools

# Select: client-site
# Task: "Fix the bug where users can't upload profile pictures"
# Interactive: No (simple fix, no feedback needed)
# Max Cost: $3.00
# Confirm: Yes

# Result: ~45 seconds, bug fixed, tests added
```

---

## 🔄 Workflow Comparison

### Old Way (CLI Arguments)
```bash
$ claude task my-app "Add a login page"
# No project selection
# No description editor
# No advanced options
# No confirmation
```

### New Way (dev-tools)
```bash
$ dev-tools
# Interactive project selection ✅
# Multi-line editor for description ✅
# Advanced options wizard ✅
# Confirmation summary ✅
# Live feedback during execution ✅
```

---

## 💡 Pro Tips

### 1. **Be Descriptive**
```
Bad:  "Add login"
Good: "Add a login page with email/password authentication,
       form validation, and 'Remember Me' checkbox"
```

### 2. **Use Interactive Mode**
- Essential for complex tasks
- Allows course correction
- See what agents are thinking
- Add tasks as you discover needs

### 3. **Set Appropriate Cost Limits**
- Simple tasks: $2-5
- Medium tasks: $5-10
- Complex tasks: $10-20
- Exploratory/experimental: $20-50

### 4. **Review Before Approving**
Always review the changes before creating a PR:
```bash
$ claude status 1729123456-a3f2  # See summary
$ cd ~/projects/my-app
$ git diff claude/1729123456-a3f2  # See exact changes
$ claude approve 1729123456-a3f2  # If looks good
```

---

## 🐛 Troubleshooting

### **"No projects configured yet"**
- Run the project wizard
- Or manually create a config in `~/.claude-projects/`

### **"Failed to load project"**
- Check config file exists: `ls ~/.claude-projects/`
- Validate YAML syntax
- Ensure required fields present

### **"Project directory not found"**
- Clone your repository to `~/projects/<project-name>`
- Or update config to point to correct path

### **Editor doesn't open**
- Set your editor: `export EDITOR=nano`
- Or use vim (default)

---

## 📚 Next Steps

After using dev-tools:

1. **Review Changes:** `git diff claude/<branch-name>`
2. **Run Tests:** `npm test` or `pytest`
3. **Approve:** `claude approve <task-id>`
4. **Review PR:** Use GitHub Mobile or web interface
5. **Merge:** When approved by reviewers

---

## 🎓 Learn More

- [Architecture Overview](../Rasberry%20Pi%20Achitecture.txt)
- [TODO List](../TODO-Missing-Components.txt)
- [Session Notes](../Session-2025-10-16-Claude-Code-Integration.md)
- [CLI Reference](./CLI-REFERENCE.md)

---

**Happy Coding!** 🚀
