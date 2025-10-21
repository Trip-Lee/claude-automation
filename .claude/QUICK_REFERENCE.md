# Quick Documentation Reference

**📌 Pin This**: Check EVERY time you make changes!

---

## 🚨 CRITICAL - Always Update (No Exceptions!)

| File | When | What |
|------|------|------|
| **docs/CHANGELOG.md** | Every change | Add to [Unreleased] section |
| **RESUME.md** | Every session | Add session entry at TOP |
| **STATUS.md** | Every feature | Update "What Works" + version |

---

## ⚡ Quick Update Commands

```bash
# Check what needs updating
cd /home/coltrip/claude-automation
cat .claude/DOCUMENTATION_CHECKLIST.md

# Check version consistency
grep -r "Version:" *.md docs/*.md | grep -v node_modules

# Check last updated dates
grep -r "Last Updated:" *.md docs/*.md | grep -v node_modules

# Count lines (verify matches docs)
wc -l lib/*.js
```

---

## 📝 Common Update Patterns

### After Adding Feature
1. Update `docs/CHANGELOG.md` → [Unreleased] → ### Added
2. Update `STATUS.md` → Add to "What Works ✅"
3. Create `docs/FEATURE_NAME.md` → Full guide
4. Update `RESUME.md` → Add session entry

### After Bug Fix
1. Update `docs/CHANGELOG.md` → [Unreleased] → ### Fixed
2. Update `RESUME.md` → Note in session

### After Performance Change
1. Update `docs/CHANGELOG.md` → [Unreleased] → ### Performance
2. Update `docs/PERFORMANCE_ANALYSIS.md` → New metrics
3. Update `RESUME.md` → Include before/after

### End of Session
1. Add entry to `RESUME.md` (at TOP!)
2. Update `STATUS.md` → Last Updated date
3. Verify all changes in `docs/CHANGELOG.md`

---

## 🎯 Session End Checklist

Before ending session, verify:
- [ ] CHANGELOG.md has entry
- [ ] RESUME.md has session summary
- [ ] STATUS.md is current
- [ ] New features have docs
- [ ] Metrics updated
- [ ] Versions match

---

## 📁 Documentation Map

```
claude-automation/
├── RESUME.md              ← Update EVERY session
├── STATUS.md              ← Update EVERY feature
├── TODO.md                ← Mark items complete
├── .claude/
│   ├── DOCUMENTATION_CHECKLIST.md  ← Full checklist
│   └── QUICK_REFERENCE.md          ← This file
└── docs/
    ├── CHANGELOG.md       ← Update EVERY change
    ├── PERFORMANCE_ANALYSIS.md
    ├── ERROR_HANDLING.md
    ├── AUTOMATIC_CLEANUP.md
    └── [FEATURE].md       ← Create for new features
```

---

## 🔄 Standard Session Flow

1. **Start Session**
   - Read RESUME.md (last session)
   - Read STATUS.md (current state)
   - Read TODO.md (what to do)

2. **During Work**
   - Track changes mentally
   - Note metrics (lines, performance, cost)

3. **After Each Change**
   - Update CHANGELOG.md immediately

4. **End Session** (CRITICAL!)
   - Add to RESUME.md (top)
   - Update STATUS.md
   - Verify CHANGELOG.md complete
   - Run verification commands
   - Commit with docs

---

## ⚠️ Red Flags

STOP if you see:
- ❌ Added 50+ lines without docs
- ❌ No CHANGELOG.md entry
- ❌ No RESUME.md session entry
- ❌ Version numbers don't match
- ❌ Metrics look outdated

---

## 🧪 Testing Quick Reference

### Before ANY commit
```bash
node cli.js validate --smoke  # <3 seconds
```

### Before pushing to GitHub
```bash
node cli.js validate --full   # 30-60 seconds
```

### After major changes
```bash
node cli.js validate --full
```

---

## 🐳 Docker Quick Reference

### Check containers
```bash
docker ps -a | grep claude
```

### Cleanup
```bash
node cli.js cleanup --all
```

### API Usage
```javascript
// exec() returns string directly (NOT object!)
const output = await dockerManager.exec(container, 'ls');
if (output.includes('file.txt')) { ... }

// Always cleanup
finally {
  if (container) {
    await dockerManager.stop(container);
    await dockerManager.remove(container);
  }
}
```

---

## 🔧 Git Quick Reference

### Check .gitignore before first commit
```bash
cat .gitignore  # Must have node_modules, .env, package-lock.json
```

### Remove from tracking
```bash
git rm -r --cached node_modules/
git rm --cached package-lock.json
```

### Commit with tests
```bash
node cli.js validate --smoke
git add .
git commit -m "type: description"
node cli.js validate --full
git push
```

---

## 📚 Documentation Files

### In .claude/ (Development Guides)
- `DOCUMENTATION_CHECKLIST.md` - Complete checklist
- `QUICK_REFERENCE.md` - This file (quick patterns)
- `LESSONS_LEARNED.md` - Key insights and what worked/didn't
- `DEVELOPMENT_WORKFLOW.md` - Best practices for sessions
- `API_PATTERNS.md` - How to use APIs correctly
- `TESTING_GUIDE.md` - Testing strategy and how-to

### When to read which file
- **Starting work?** → Read DEVELOPMENT_WORKFLOW.md
- **Need API usage?** → Read API_PATTERNS.md
- **Adding tests?** → Read TESTING_GUIDE.md
- **Want to avoid past mistakes?** → Read LESSONS_LEARNED.md
- **Quick lookup?** → Read this file (QUICK_REFERENCE.md)

---

## 🚨 Common Pitfalls (Today's Learnings)

### ❌ DON'T
```javascript
// Wrong: exec() doesn't return object
const exec = await dockerManager.exec(container, 'ls');
const { stdout } = await exec.getOutput(); // ❌ NO!

// Wrong: not cleaning up
const container = await dockerManager.create(...);
// ... work ...
// Forgot cleanup! ❌
```

### ✅ DO
```javascript
// Correct: exec() returns string
const output = await dockerManager.exec(container, 'ls');
if (output.includes('file')) { ... } // ✅

// Correct: always cleanup
let container = null;
try {
  container = await dockerManager.create(...);
} finally {
  if (container) {
    await dockerManager.stop(container);
    await dockerManager.remove(container);
  }
} // ✅
```

---

**Last Updated**: 2025-10-21
**Use**: EVERY session, EVERY change!
