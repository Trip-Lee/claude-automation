# Documentation Index

**Claude Multi-Agent Coding System**
**Version**: v0.11.1-alpha
**Last Updated**: 2025-10-24

---

## 📚 Quick Navigation

### Getting Started
- **[README.md](README.md)** - Main documentation, installation, quick start
- **[WORKFLOW_MODE_GUIDE.md](WORKFLOW_MODE_GUIDE.md)** - How to use the workflow mode
- **[ADD_PROJECT_GUIDE.md](ADD_PROJECT_GUIDE.md)** - How to add new projects

### System Status & Planning
- **[STATUS.md](STATUS.md)** - Current version, metrics, capabilities, next steps
- **[PRIORITIZED_TODOS.md](PRIORITIZED_TODOS.md)** - Planned work with priorities
- **[docs/CHANGELOG.md](docs/CHANGELOG.md)** - Version history, all changes

### Technical Documentation
- **[docs/TESTING.md](docs/TESTING.md)** - Complete testing guide
- **[AGENT_SYSTEM_OVERVIEW.md](AGENT_SYSTEM_OVERVIEW.md)** - Agent architecture
- **[DYNAMIC_ROUTING_COMPLETE.md](DYNAMIC_ROUTING_COMPLETE.md)** - Dynamic routing details
- **[RESUME.md](RESUME.md)** - Session resumption guide

### Archives
- **[/home/coltrip/claude/README_ARCHIVE.md](/home/coltrip/claude/README_ARCHIVE.md)** - Original design docs

---

## 📖 Documentation by Topic

### 🚀 Using the System

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [README.md](README.md) | Installation & basics | First time setup |
| [WORKFLOW_MODE_GUIDE.md](WORKFLOW_MODE_GUIDE.md) | Interactive workflow | Daily use |
| [ADD_PROJECT_GUIDE.md](ADD_PROJECT_GUIDE.md) | Add new project | Setting up projects |

**Quick Commands:**
```bash
claude                   # Interactive workflow
claude validate          # Run smoke tests
claude test              # Run unit tests
claude task <proj> <desc>  # Direct task execution
```

---

### 🧪 Testing & Validation

| Document | Purpose | Tests | Duration |
|----------|---------|-------|----------|
| [docs/TESTING.md](docs/TESTING.md) | Complete testing guide | All | - |

**Test Levels:**
- **Unit Tests**: 25 tests (~0.2s) - Module functions
- **Smoke Tests**: 7 tests (~3-5s) - Quick health check
- **Validation Suite**: 25 tests (~3-5s) - Comprehensive validation

**Commands:**
```bash
claude validate          # Smoke tests
claude validate --full   # Full validation
claude test              # Unit tests
npm run test:all         # All tests (57 total)
```

**Current Status**: 57/57 tests passing (100%)

---

### 🏗️ Architecture & Design

| Document | Purpose | Audience |
|----------|---------|----------|
| [AGENT_SYSTEM_OVERVIEW.md](AGENT_SYSTEM_OVERVIEW.md) | Agent architecture | Developers |
| [DYNAMIC_ROUTING_COMPLETE.md](DYNAMIC_ROUTING_COMPLETE.md) | Dynamic routing design | Technical |
| [DYNAMIC_ROUTING_DESIGN.md](DYNAMIC_ROUTING_DESIGN.md) | Original routing spec | Technical |

**Key Concepts:**
- 7 specialized agents (architect, coder, reviewer, security, documenter, tester, performance)
- Dynamic routing with NEXT:/REASON: directives
- Sequential execution with intelligent handoff
- Docker isolation for safety

---

### 📊 Status & Planning

| Document | Purpose | Update Frequency |
|----------|---------|------------------|
| [STATUS.md](STATUS.md) | Current state, metrics, next steps | After each version |
| [PRIORITIZED_TODOS.md](PRIORITIZED_TODOS.md) | Planned work | Weekly |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Version history | Each release |

**Current Version**: v0.11.1-alpha
**Phase**: Testing Infrastructure Complete
**Next**: Performance Optimization

---

### 🔧 Development & Troubleshooting

| Document | Purpose | Use Case |
|----------|---------|----------|
| [RESUME.md](RESUME.md) | Session resumption | Continuing work |
| [docs/TESTING.md](docs/TESTING.md) | Debugging tests | Test failures |

**Common Issues:**
- Docker not running → `systemctl start docker`
- Test project missing → Check setup
- Tests failing → See docs/TESTING.md

---

## 📏 Documentation Statistics

| Category | Documents | Total Lines |
|----------|-----------|-------------|
| **User Guides** | 3 | ~1,650 |
| **Technical Docs** | 4 | ~2,400 |
| **Status/Planning** | 3 | ~1,600 |
| **Testing** | 1 | ~550 |
| **Total** | 11 | ~6,200 |

**Code**:
- Production: ~4,840 lines
- Tests: ~956 lines (57 tests)
- **Total Project**: ~12,000 lines

---

## 🎯 Documentation by Role

### For Users

**First Time:**
1. [README.md](README.md) - Installation
2. [WORKFLOW_MODE_GUIDE.md](WORKFLOW_MODE_GUIDE.md) - Basic usage
3. [ADD_PROJECT_GUIDE.md](ADD_PROJECT_GUIDE.md) - Add your project

**Daily Use:**
- [WORKFLOW_MODE_GUIDE.md](WORKFLOW_MODE_GUIDE.md) - Interactive mode
- [docs/TESTING.md](docs/TESTING.md) - Run tests

### For Developers

**Understanding System:**
1. [README.md](README.md) - Overview
2. [AGENT_SYSTEM_OVERVIEW.md](AGENT_SYSTEM_OVERVIEW.md) - Architecture
3. [DYNAMIC_ROUTING_COMPLETE.md](DYNAMIC_ROUTING_COMPLETE.md) - Routing logic
4. [docs/TESTING.md](docs/TESTING.md) - Testing infrastructure

**Contributing:**
1. [STATUS.md](STATUS.md) - Current state
2. [PRIORITIZED_TODOS.md](PRIORITIZED_TODOS.md) - What to work on
3. [docs/CHANGELOG.md](docs/CHANGELOG.md) - History
4. [docs/TESTING.md](docs/TESTING.md) - Writing tests

### For Maintainers

**Monitoring:**
- [STATUS.md](STATUS.md) - System health
- [PRIORITIZED_TODOS.md](PRIORITIZED_TODOS.md) - Roadmap
- [docs/CHANGELOG.md](docs/CHANGELOG.md) - Changes

**Planning:**
- [PRIORITIZED_TODOS.md](PRIORITIZED_TODOS.md) - Next steps
- [DYNAMIC_ROUTING_COMPLETE.md](DYNAMIC_ROUTING_COMPLETE.md) - Technical debt

---

## 🔍 Finding Specific Information

### "How do I...?"

| Question | Document | Section |
|----------|----------|---------|
| Install the system? | README.md | Installation |
| Run a task? | WORKFLOW_MODE_GUIDE.md | Usage |
| Add a project? | ADD_PROJECT_GUIDE.md | Full guide |
| Run tests? | docs/TESTING.md | Quick Start |
| Debug tests? | docs/TESTING.md | Debugging |
| Understand agents? | AGENT_SYSTEM_OVERVIEW.md | Agent Types |
| See what's next? | PRIORITIZED_TODOS.md | High Priority |

### "What is...?"

| Question | Document | Section |
|----------|----------|---------|
| Current version? | STATUS.md | Version History |
| Test coverage? | STATUS.md or docs/TESTING.md | Testing Status |
| Performance? | STATUS.md | Performance Metrics |
| Dynamic routing? | DYNAMIC_ROUTING_COMPLETE.md | How It Works |
| Workflow mode? | WORKFLOW_MODE_GUIDE.md | Overview |

### "When was...?"

| Question | Document | Section |
|----------|----------|---------|
| Feature added? | docs/CHANGELOG.md | Version entries |
| Last updated? | STATUS.md | Top of file |
| Task completed? | PRIORITIZED_TODOS.md | Completed section |

---

## 📝 Documentation Maintenance

### Update Schedule

| Document | Frequency | Trigger |
|----------|-----------|---------|
| STATUS.md | After each version | New release |
| CHANGELOG.md | With each release | Version bump |
| PRIORITIZED_TODOS.md | Weekly | Planning sessions |
| TESTING.md | When tests change | New test types |
| README.md | Major changes only | Significant features |

### Quality Standards

✅ All docs must be:
- Up to date with code
- Clear and concise
- Well organized
- Include examples
- Cover common issues

---

## 🚦 Documentation Health

### Current Status

| Aspect | Status | Notes |
|--------|--------|-------|
| **Completeness** | ✅ Excellent | All major topics covered |
| **Accuracy** | ✅ Excellent | Updated for v0.11.1 |
| **Organization** | ✅ Excellent | Clear structure |
| **Examples** | ✅ Good | Commands, code samples |
| **Coverage** | ✅ Excellent | ~6,200 lines |

### Recent Updates (2025-10-24)

- ✅ STATUS.md updated to v0.11.1
- ✅ CHANGELOG.md updated with testing infrastructure
- ✅ Created docs/TESTING.md (550 lines)
- ✅ Created DOCS_INDEX.md (this file)
- ✅ Created archive notice for /home/coltrip/claude

---

## 📦 Archived Documentation

**Location**: `/home/coltrip/claude/`

**Contains**:
- Original design specifications
- Historical TODO lists
- Session notes from integration work

**Status**: Reference only (not current)

**See**: [README_ARCHIVE.md](/home/coltrip/claude/README_ARCHIVE.md) for details

---

## 🔗 External Resources

### Claude Code Documentation
- Official docs: https://docs.claude.com/claude-code
- GitHub: https://github.com/anthropics/claude-code

### Dependencies
- Anthropic SDK: https://github.com/anthropics/anthropic-sdk-typescript
- Dockerode: https://github.com/apocas/dockerode
- Commander: https://github.com/tj/commander.js
- Inquirer: https://github.com/SBoudrias/Inquirer.js

---

## 💡 Tips for Using Documentation

### Quick Lookup

Use your editor's search feature:
```bash
# Find all mentions of "testing"
grep -r "testing" *.md docs/*.md

# Find specific commands
grep -r "claude validate" *.md docs/*.md
```

### Sequential Reading Path

**For New Users:**
1. README.md (15 min)
2. WORKFLOW_MODE_GUIDE.md (10 min)
3. ADD_PROJECT_GUIDE.md (10 min)
4. Try it yourself!

**For Developers:**
1. README.md (15 min)
2. AGENT_SYSTEM_OVERVIEW.md (20 min)
3. DYNAMIC_ROUTING_COMPLETE.md (25 min)
4. docs/TESTING.md (15 min)
5. STATUS.md (10 min)

**Total**: ~35 min for users, ~85 min for developers

---

## 📧 Feedback

Found an issue with documentation?
- Missing information?
- Unclear explanation?
- Outdated content?

Report at: https://github.com/anthropics/claude-code/issues

---

**Version**: v0.11.1-alpha
**Documentation Complete**: 95%
**Last Updated**: 2025-10-24

---

**[↑ Back to Top](#documentation-index)**
