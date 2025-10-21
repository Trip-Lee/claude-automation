# Documentation Update Checklist

**Purpose**: Ensure all documentation is updated after EVERY code change

**When to Use**: After ANY modification to:
- Source code (lib/*.js, cli.js)
- Features added/removed
- Behavior changes
- Performance improvements
- Bug fixes

---

## ✅ MANDATORY UPDATES (Every Change)

### 1. Version Documentation

**File**: `docs/CHANGELOG.md`

**What to Update**:
- [ ] Add entry to `[Unreleased]` or create new version section
- [ ] Include date of change
- [ ] Categorize change: Added, Changed, Deprecated, Removed, Fixed, Security
- [ ] Describe what changed and why
- [ ] Include performance/cost impacts if relevant

**Example**:
```markdown
## [0.9.2] - 2025-10-21

### Added
- Automatic cleanup system for Docker containers
- New `claude cleanup` command with `--all` flag
- Process exit handlers (SIGINT, SIGTERM, uncaughtException)

### Changed
- executeTask() now uses finally block for guaranteed cleanup
- Orchestrator tracks active containers in Set

### Performance
- No impact on happy path
- +50-100ms on error path (cleanup now happens)
```

---

### 2. Project Status

**File**: `STATUS.md`

**What to Update**:
- [ ] Update version number
- [ ] Update "What's Been Done" section
- [ ] Update "Current State" / "What Works" section
- [ ] Update line counts
- [ ] Update file structure if files added/removed
- [ ] Update "Next Steps" section
- [ ] Update last updated date

**Key Sections**:
```markdown
**Last Updated:** 2025-10-21
**Version:** 0.9.2
**Phase:** Phase X - Status

## What Works ✅
- ✅ New feature added
- ✅ Bug fixed
...

### Files Ready to Use
lib/
  ├── new-file.js      # ✅ COMPLETE (XXX lines)
```

---

### 3. Session Resume

**File**: `RESUME.md`

**What to Update**:
- [ ] Add new session entry at TOP (reverse chronological)
- [ ] Include date and duration
- [ ] List what was accomplished
- [ ] Show key metrics (performance, cost, lines added)
- [ ] Update "Current State" section
- [ ] Update "Line Counts" section
- [ ] Update last updated date

**Template**:
```markdown
## Session 2025-10-21: [Brief Description]

### Duration: ~X hours
### Goal: [What we set out to do]
### Status: ✅ Complete

### What Was Accomplished
1. Feature X added
2. Bug Y fixed
3. Performance improved by Z%

### Files Modified
- lib/file.js (+XX lines)
- docs/guide.md (updated)

### Metrics
- Lines added: XXX
- Performance: ±X%
- Cost: ±$X.XX
```

---

## 📚 FEATURE-SPECIFIC UPDATES

### For New Features

**Files to Update**:
- [ ] `docs/CHANGELOG.md` - Add to Added section
- [ ] `STATUS.md` - Add to "What Works" list
- [ ] `RESUME.md` - Add session entry
- [ ] **Create** `docs/FEATURE_NAME.md` - Comprehensive guide
- [ ] Update README.md if it exists
- [ ] Update main TODO.md to mark item complete

**Feature Documentation Template**:
```markdown
# Feature Name - Date

## Overview
Brief description of what the feature does

## Problem Solved
What problem this solves

## Features
- Feature 1
- Feature 2

## Implementation Details
How it works, code structure

## Usage Examples
Code examples and commands

## Testing
How to test it

## Performance Impact
Metrics and benchmarks
```

---

### For Bug Fixes

**Files to Update**:
- [ ] `docs/CHANGELOG.md` - Add to Fixed section
- [ ] `RESUME.md` - Note in session entry
- [ ] `STATUS.md` - Update "Known Issues" if listed there
- [ ] Update relevant feature documentation

---

### For Performance Improvements

**Files to Update**:
- [ ] `docs/CHANGELOG.md` - Add to Performance section
- [ ] `docs/PERFORMANCE_ANALYSIS.md` - Update metrics
- [ ] `RESUME.md` - Include before/after metrics
- [ ] `STATUS.md` - Update performance numbers

---

### For Breaking Changes

**Files to Update**:
- [ ] `docs/CHANGELOG.md` - Add to Breaking Changes section (CRITICAL!)
- [ ] `STATUS.md` - Highlight breaking changes
- [ ] Migration guide in CHANGELOG
- [ ] Update all affected documentation

---

## 🔄 REGULAR MAINTENANCE UPDATES

### Weekly

**File**: `STATUS.md`
- [ ] Review "Next Steps" - are they still relevant?
- [ ] Update phase progress
- [ ] Verify line counts are accurate

### After Each Session

**File**: `RESUME.md`
- [ ] Add session summary at top
- [ ] Update "Current State" section
- [ ] Update "Line Counts" section

### Before Releasing Version

**Files**: ALL
- [ ] `docs/CHANGELOG.md` - Move unreleased to version section
- [ ] `STATUS.md` - Update version everywhere
- [ ] `RESUME.md` - Update version
- [ ] `package.json` - Update version number
- [ ] All feature docs - Verify accuracy
- [ ] Create `docs/RELEASE_NOTES_vX.X.X.md`

---

## 📊 METRICS TO TRACK

### Always Update These Metrics

**In RESUME.md**:
- [ ] Total production code lines
- [ ] Total test code lines
- [ ] Total documentation pages
- [ ] Performance (task duration)
- [ ] Cost per task
- [ ] Success/approval rate

**In STATUS.md**:
- [ ] Phase completion percentage
- [ ] Features working/pending
- [ ] Line counts per file

**In docs/PERFORMANCE_ANALYSIS.md**:
- [ ] Latest benchmark results
- [ ] Before/after comparisons
- [ ] Bottleneck analysis updates

---

## 🗂️ DOCUMENTATION FILE MAP

### Core Documentation (Always Keep Updated)
```
/home/coltrip/claude-automation/
├── RESUME.md                    # Session history (update EVERY session)
├── STATUS.md                    # Current state (update EVERY change)
├── TODO.md                      # Task list (update when completing items)
├── RECOMMENDATIONS.md           # System recommendations
├── SESSION_SUMMARY.md           # Latest session details
├── HIGH_PRIORITY_TODOS_COMPLETED.md  # Completed priorities
└── docs/
    ├── CHANGELOG.md             # Version history (update EVERY change)
    ├── PERFORMANCE_ANALYSIS.md  # Performance metrics
    ├── ERROR_HANDLING.md        # Error handling guide
    ├── AUTOMATIC_CLEANUP.md     # Cleanup feature guide
    └── [FEATURE_NAME].md        # Per-feature documentation
```

### External Documentation
```
/home/coltrip/claude/
├── TODO-Missing-Components.txt  # Master TODO (mark phases complete)
└── TODO-COMPLETED-*.txt         # Completed items log
```

---

## 🚨 CRITICAL RULES

### Never Skip These

1. **ALWAYS update CHANGELOG.md** - No exceptions!
2. **ALWAYS update RESUME.md** - Every session!
3. **ALWAYS update STATUS.md** - Every feature!
4. **ALWAYS create feature docs** - For new features!
5. **ALWAYS update metrics** - Keep them accurate!

### Red Flags (STOP and Update Docs)

- ❌ Added 50+ lines without updating docs
- ❌ Completed session without RESUME.md entry
- ❌ Changed behavior without CHANGELOG.md entry
- ❌ Added feature without dedicated docs
- ❌ Version mismatch between files

---

## ✅ VERIFICATION CHECKLIST

**Before Ending Session**:
- [ ] CHANGELOG.md has entry for all changes
- [ ] RESUME.md has session summary
- [ ] STATUS.md reflects current state
- [ ] All version numbers match
- [ ] New features have dedicated docs
- [ ] Metrics are updated
- [ ] Line counts are accurate
- [ ] "Last Updated" dates are current

**Quick Verification Commands**:
```bash
# Check version consistency
grep -r "Version:" /home/coltrip/claude-automation/*.md

# Check last updated dates
grep -r "Last Updated:" /home/coltrip/claude-automation/*.md

# Check line counts match reality
wc -l /home/coltrip/claude-automation/lib/*.js
```

---

## 📝 TEMPLATES

### Session Entry Template (for RESUME.md)

```markdown
## Session YYYY-MM-DD: [Brief Description]

### Duration: ~X hours
### Goal: [What we set out to do]
### Status: ✅ Complete / ⚠️ In Progress / ❌ Blocked

### What Was Accomplished

1. **Feature/Change 1**
   - Details
   - Impact

2. **Feature/Change 2**
   - Details
   - Impact

### Files Modified
- `lib/file.js` (+XXX lines) - What changed
- `docs/guide.md` (updated) - What changed

### Metrics
- **Lines Added**: XXX production, XXX test
- **Performance**: Before: XXs, After: XXs (±X%)
- **Cost**: $X.XX per task (±X%)
- **Success Rate**: XX%

### Next Steps
1. Next item
2. Next item
```

### CHANGELOG Entry Template

```markdown
## [X.X.X] - YYYY-MM-DD

### Added
- New feature with description
- `command` - Brief description

### Changed
- Behavior change with before/after
- Modified component with impact

### Fixed
- Bug fix with description (#issue if relevant)

### Performance
- Improvement description (X% faster)
- Cost optimization ($X.XX → $X.XX)

### Documentation
- New guide: docs/GUIDE.md
- Updated: STATUS.md, RESUME.md
```

---

## 🎯 AUTOMATION REMINDERS

### Git Commit Messages

**Always include**:
```
feat: Brief description

- What changed
- Why it changed
- Impact on users/performance

Docs: Updated CHANGELOG.md, STATUS.md, RESUME.md

Files modified:
- lib/file.js (+XXX lines)
- docs/guide.md (new)
```

### Version Bump Process

**Steps**:
1. Update `package.json` version
2. Move `[Unreleased]` to `[X.X.X]` in CHANGELOG.md
3. Update all version references in docs
4. Create git tag: `git tag vX.X.X`
5. Update STATUS.md "Version:" field

---

## 📞 EMERGENCY DOC UPDATES

**If You Forgot to Update Docs**:

1. **STOP** - Don't make more changes
2. Review what changed (git diff)
3. Update CHANGELOG.md first (critical)
4. Update RESUME.md second
5. Update STATUS.md third
6. Create missing feature docs
7. Verify all metrics
8. Run verification checklist

**Recovery Checklist**:
- [ ] List all changes made
- [ ] Update CHANGELOG.md for each change
- [ ] Add session entry to RESUME.md
- [ ] Sync STATUS.md with current state
- [ ] Create any missing feature docs
- [ ] Update all version numbers
- [ ] Update all metrics
- [ ] Update all dates

---

## 💡 BEST PRACTICES

### Documentation Timing

**WHEN to Update**:
- ✅ **Immediately after change** - Best practice
- ✅ **End of session** - Acceptable
- ❌ **Next session** - Too late, you'll forget details

### Documentation Quality

**Good Documentation**:
- Clear what changed and why
- Includes examples
- Shows before/after
- Lists all affected files
- Accurate metrics

**Bad Documentation**:
- Vague: "Fixed some stuff"
- No examples
- No metrics
- Outdated references
- Missing impacts

### Common Mistakes to Avoid

- ❌ Forgetting to update CHANGELOG.md
- ❌ Version number mismatches
- ❌ Outdated line counts
- ❌ Missing "Last Updated" dates
- ❌ No feature documentation for new features
- ❌ Metrics not updated after performance changes

---

## 🔗 QUICK LINKS

### Documentation Files
- [CHANGELOG.md](../docs/CHANGELOG.md) - Version history
- [RESUME.md](../RESUME.md) - Session history
- [STATUS.md](../STATUS.md) - Current state
- [TODO.md](../TODO.md) - Task list

### External References
- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)
- [Good Commit Messages](https://chris.beams.io/posts/git-commit/)

---

## 📋 SESSION END CHECKLIST

**Copy this for every session**:

```markdown
## End of Session Checklist

Date: ___________
Changes Made: ___________________

Documentation Updates:
- [ ] CHANGELOG.md updated with all changes
- [ ] RESUME.md has session entry
- [ ] STATUS.md reflects current state
- [ ] New feature docs created (if applicable)
- [ ] Metrics updated (line counts, performance, cost)
- [ ] All version numbers consistent
- [ ] All "Last Updated" dates current
- [ ] Verification commands run
- [ ] Git commit includes doc changes
- [ ] No red flags present

All checked? ✅ Session complete!
Missing items? ❌ Update them now!
```

---

**Last Updated**: 2025-10-21
**Maintained By**: Claude (AI Assistant)
**Purpose**: Ensure documentation never falls out of sync with code
**Status**: ✅ Active - Use for EVERY change!
