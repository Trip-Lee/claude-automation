# Workflow Mode Guide

**Version**: v0.11.0
**Date**: 2025-10-23
**Status**: ✅ Fully Implemented

---

## Overview

When you run `claude` with no arguments, it enters **Workflow Mode** - a streamlined, guided experience that walks you through the complete task execution workflow.

---

## The Complete Workflow

```
1. Select Project (dropdown of available projects)
2. Enter Task Description
3. Validate GitHub Repo (create if missing)
4. Execute Task
5. Approve / Reject / Hold
6. Auto Cleanup Containers
```

Simple. Streamlined. Workflow-driven.

---

## Usage

### Start Workflow Mode

```bash
claude
```

---

## Step-by-Step Example

### Step 1: Select Project

```
🤖 Claude Multi-Agent Coding System

Workflow: Project → Task → Execute → Approve

? Select project: (Use arrow keys)
❯ 📁 my-website
  📁 api-backend
  📁 mobile-app
```

**If no projects exist:**
```
⚠️  No projects configured yet.

? Would you like to create your first project? Yes
? Project name: my-first-project

[Launches add-project wizard]
```

---

### Step 2: Enter Task

```
? Select project: 📁 my-website
? What would you like me to do? Add user authentication with JWT tokens

📋 Task submitted!

  Project: my-website
  Task: Add user authentication with JWT tokens
```

---

### Step 3: Validate GitHub Repo

**If repo exists:**
```
🔍 Validating GitHub repository...

✅ Repository validated
```

**If repo doesn't exist:**
```
🔍 Validating GitHub repository...

⚠️  Repository not found: github.com/username/my-website

? Would you like to create this repository on GitHub? Yes

📦 Creating repository 'my-website'...

✅ Repository created: https://github.com/username/my-website

📥 Cloning to /home/user/projects/my-website...

✅ Repository cloned!
```

---

### Step 4: Execute Task

```
🚀 Executing Task...

📋 Step 1/7: Pre-flight checks
  ✅ All checks passed

📋 Step 2-3/7: Setting up Git environment and Docker container
  ✅ Branch created: claude/1729745823-a2b3
  ✅ Container ready

📋 Step 4/7: Running agent system (dynamic routing)

📋 Planning Task

  Task Type: implementation
  Complexity: complex
  Estimated Duration: 3-5min
  Agent Sequence: architect → coder → reviewer

🔄 Dynamic Agent Execution

── Iteration 1/10 ──

🏗️  ARCHITECT Agent

  Analyzing task and creating implementation brief...
  ✅ Architect brief complete (45.2s, $0.0234)

── Iteration 2/10 ──

👨‍💻 CODER Agent

  Implementing the task...
  ✅ Coder implementation complete (98.5s, $0.0512)

── Iteration 3/10 ──

👁️  REVIEWER Agent

  Reviewing implementation...
  ✅ Reviewer approved (32.1s, $0.0156)

✅ Task Complete!

📊 Execution Summary

  Total Agents: 3
  Sequence: architect → coder → reviewer
  Total Duration: 175.8s
  Total Cost: $0.0902

📋 Step 5/7: Running tests
  ✅ All tests passed

📋 Step 6/7: Generating summary
  ✅ Summary generated

📋 Step 7/7: Saving task data
  ✅ Task data saved

🐳 Stopping Docker container...
  ✅ Container stopped

==============================================
           ✅ TASK COMPLETED
==============================================

Branch: claude/1729745823-a2b3
Changes: [implementation details]

Next: Review changes and approve/reject
==============================================
```

---

### Step 5: Decide

```
📊 Task Completed!

? What would you like to do? (Use arrow keys)
❯ ✅ Approve & Create PR
  ❌ Reject & Delete Branch
  ⏸️  Hold for Later Review
```

**Option A: Approve**
```
? What would you like to do? Approve & Create PR

✅ Approving task...

📤 Pushing branch to GitHub...
  ✅ Branch pushed to GitHub

📝 Creating pull request...
  ✅ PR created: #42

✅ PR Created: https://github.com/username/my-website/pull/42
```

**Option B: Reject**
```
? What would you like to do? Reject & Delete Branch

❌ Rejecting task...

🗑️  Deleting branch...
  ✅ Branch deleted

✅ Task rejected and cleaned up
```

**Option C: Hold**
```
? What would you like to do? Hold for Later Review

⏸️  Task held for review

  Branch: claude/1729745823-a2b3
  Review later: claude approve 1729745823-a2b3
```

---

### Step 6: Auto Cleanup

```
🧹 Cleaning up containers...

  ✅ Cleanup complete

✅ Workflow Complete!
```

**Containers are automatically cleaned up** - no manual intervention needed!

---

## Key Features

### 1. **Workflow-Driven**
- Guides you step-by-step
- No need to remember commands
- Clear progression

### 2. **Project Dropdown**
- Shows all available projects
- Easy selection with arrow keys
- Creates project if none exist

### 3. **GitHub Validation**
- Checks if repo exists before execution
- Offers to create repo if missing
- Auto-clones new repos

### 4. **Immediate Decision**
- Approve, reject, or hold right after task
- No separate command needed
- Streamlined workflow

### 5. **Auto Cleanup**
- Containers cleaned automatically
- No manual cleanup needed
- Happens at the end of workflow

---

## Workflow Benefits

### Before (Command Line)
```bash
$ claude task my-project "Add feature"
[waits for completion]

$ git diff
[manually review changes]

$ claude approve 1729745823-a2b3
[separate command]

$ claude cleanup --all
[manual cleanup]
```

**Steps**: 4 separate commands
**Memory**: Need to remember task ID

---

### After (Workflow Mode)
```bash
$ claude

? Select project: my-project
? What would you like me to do? Add feature

[executes automatically]

? What would you like to do? Approve

[auto cleanup]
```

**Steps**: 1 command, 3 prompts
**Memory**: Nothing to remember!

---

## Edge Cases Handled

### No Projects
```
⚠️  No projects configured yet.

? Would you like to create your first project? Yes

[Walks through project setup]
```

### Repo Doesn't Exist
```
⚠️  Repository not found

? Create this repository on GitHub? Yes

[Creates and clones repo]
```

### Task Fails
```
❌ Task failed: [error message]

[Stops workflow, no approval prompt]
```

---

## Command Line Still Works!

You can still use commands directly:

```bash
# Direct command
claude task my-project "Add feature"

# Then later
claude approve <taskId>
```

**Both work!** Use workflow mode for interactive sessions, commands for scripting.

---

## Comparison

| Feature | Workflow Mode | Command Line |
|---------|--------------|--------------|
| Project selection | Dropdown | Type name |
| Task input | Prompted | Argument |
| Repo validation | Automatic | Manual |
| Approval | Immediate | Separate command |
| Cleanup | Automatic | Manual |
| Best for | Interactive use | Scripting/automation |

---

## Technical Details

### Workflow Function

**File**: `cli.js`
**Function**: `runWorkflow()`
**Lines**: ~457-639

### Trigger

```javascript
if (process.argv.length === 2) {
  // No command provided - run workflow
  runWorkflow();
} else {
  // Command provided - parse normally
  program.parse();
}
```

---

## Example Sessions

### Session 1: First Time User

```bash
$ claude

🤖 Claude Multi-Agent Coding System

⚠️  No projects configured yet.

? Would you like to create your first project? Yes
? Project name: my-app
? Use GitHub integration? Yes
? GitHub repository (owner/repo): username/my-app

⚠️  Repository not found

? Would you like to create this repository on GitHub? Yes

✅ Repository created!
✅ Project configured!

? What would you like me to do? Add homepage with hero section

🚀 Executing Task...
[agents work]

? What would you like to do? Approve & Create PR

✅ PR Created!
✅ Workflow Complete!
```

**Result**: New user goes from zero to PR in one session!

---

### Session 2: Regular Use

```bash
$ claude

? Select project: 📁 my-app
? What would you like me to do? Fix mobile responsive design

🚀 Executing Task...
[agents work]

? What would you like to do? Approve & Create PR

✅ PR Created!
✅ Workflow Complete!
```

**Result**: Experienced user completes task in 3 prompts!

---

### Session 3: Hold for Review

```bash
$ claude

? Select project: 📁 my-app
? What would you like me to do? Refactor authentication system

🚀 Executing Task...
[agents work]

? What would you like to do? Hold for Later Review

⏸️  Task held for review

  Branch: claude/1729745823-a2b3
  Review later: claude approve 1729745823-a2b3

✅ Workflow Complete!
```

**Later:**
```bash
$ git checkout claude/1729745823-a2b3
$ git diff main
[review changes manually]

$ claude approve 1729745823-a2b3
```

---

## Summary

**The Perfect Workflow:**

1. ✅ Select project from dropdown (or create if first time)
2. ✅ Enter what you want done
3. ✅ Validate/create GitHub repo automatically
4. ✅ Execute task with dynamic agents
5. ✅ Immediately approve/reject/hold
6. ✅ Auto cleanup containers

**Simple. Streamlined. No commands to remember.**

Just run:
```bash
claude
```

And follow the prompts! 🎉
