# 🔴 CRITICAL SECURITY ADVISORY

**Date**: 2025-10-29
**Severity**: CRITICAL
**Status**: ⚠️ IMMEDIATE ACTION REQUIRED

---

## What Happened

The file `tools/sn-tools/ServiceNow-Tools/.sn-key` containing a real ServiceNow API key was accidentally committed to git and pushed to GitHub.

**Exposed Key**:
```
509800c0345fa680875fb88f7f44c108b94d37395badab53d5dcfca613e74500
```

**Timeline**:
- Unknown date: `.sn-key` was committed to git
- Multiple commits: File remained tracked in repository
- 2025-10-29: Issue discovered and file removed from tracking
- **Current**: Key still exists in git history (publicly accessible)

---

## Immediate Actions Required

### 🔴 Step 1: Rotate the ServiceNow API Key (DO THIS NOW)

The exposed key can be used to access your ServiceNow instance. You must rotate it immediately:

1. **Log into ServiceNow Admin Panel**
2. **Navigate to**: System Security → API Keys (or equivalent)
3. **Revoke the exposed key**: `509800c0345fa680875fb88f7f44c108b94d37395badab53d5dcfca613e74500`
4. **Generate a new API key**
5. **Update local `.sn-key` file** with new key (it won't be tracked anymore)

### 🟡 Step 2: Clean Git History (After Key Rotation)

Once the key is rotated, remove it from git history to prevent confusion:

#### Option A: BFG Repo-Cleaner (Recommended - Easier)

```bash
# 1. Install BFG (if not installed)
# On macOS: brew install bfg
# On Linux: Download from https://rtyley.github.io/bfg-repo-cleaner/

# 2. Clone a fresh copy of the repo
cd /tmp
git clone --mirror https://github.com/Trip-Lee/claude-automation.git

# 3. Run BFG to remove the file from history
java -jar bfg.jar --delete-files .sn-key claude-automation.git/

# 4. Clean up
cd claude-automation.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Force push (rewrites history)
git push --force
```

#### Option B: git filter-branch (Native Git)

```bash
# Navigate to your repo
cd /home/coltrip/claude-automation

# Remove file from all commits
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch tools/sn-tools/ServiceNow-Tools/.sn-key" \
  --prune-empty --tag-name-filter cat -- --all

# Clean up refs
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (rewrites history - DANGEROUS)
git push origin --force --all
git push origin --force --tags
```

⚠️ **Warning**: Both methods rewrite git history and require force push. If others are working on this repo, coordinate with them first.

---

## What Was Fixed

✅ **Immediate fixes applied**:
1. Enhanced `.gitignore` to prevent future secret commits:
   - `*.env`, `**/.env`, `**/.env.*`
   - `*.key`, `*.secret`, `**/*-key`, `**/*.key`
   - `.sn-key`, `**/.sn-key`
   - `**/credentials.json`, `**/secrets.json`

2. Removed `.sn-key` from git tracking:
   - File removed with `git rm --cached`
   - Won't appear in future commits
   - Still exists on disk (as it should)

✅ **Prevention measures**:
- Comprehensive `.gitignore` patterns
- Documentation of authentication architecture
- Clear guidance on secret management

---

## Impact Assessment

### What the Exposed Key Could Allow

If someone found this key before rotation, they could:
- ❌ Access your ServiceNow instance via API
- ❌ Read data from your ServiceNow tables
- ❌ Potentially modify data (depending on key permissions)
- ❌ Use your ServiceNow resources/quota

### Current Risk Level

**Before Key Rotation**: 🔴 CRITICAL
- Key is valid and publicly accessible
- Anyone with the key can access your ServiceNow instance

**After Key Rotation**: 🟢 LOW
- Old key is invalidated
- New key is not tracked in git
- `.gitignore` prevents future exposure

---

## Verification Steps

After completing the remediation:

1. **Verify old key is revoked**:
   ```bash
   # Try using old key (should fail)
   curl -X GET "https://your-instance.service-now.com/api/now/table/incident" \
     -H "Authorization: Bearer 509800c0345fa680875fb88f7f44c108b94d37395badab53d5dcfca613e74500"
   # Expected: 401 Unauthorized
   ```

2. **Verify new key works**:
   ```bash
   # Try using new key (should succeed)
   curl -X GET "https://your-instance.service-now.com/api/now/table/incident" \
     -H "Authorization: Bearer YOUR_NEW_KEY_HERE"
   # Expected: 200 OK with data
   ```

3. **Verify key not in git history** (after cleanup):
   ```bash
   # Search all git history for the old key
   git log -S "509800c0345fa680875fb88f7f44c108b94d37395badab53d5dcfca613e74500" --all
   # Expected: No results
   ```

4. **Verify .gitignore working**:
   ```bash
   # Try to add .sn-key (should be ignored)
   git add tools/sn-tools/ServiceNow-Tools/.sn-key
   # Expected: "The following paths are ignored by one of your .gitignore files"
   ```

---

## Best Practices Going Forward

### For API Keys and Secrets

1. **Never commit secrets to git**
   - Always use `.gitignore` patterns
   - Use environment variables (`.env` files)
   - Use secret management tools (Vault, AWS Secrets Manager)

2. **Use `.env` files for sensitive data**:
   ```bash
   # ~/.env
   SERVICENOW_API_KEY=your_key_here
   GITHUB_TOKEN=ghp_your_token_here
   ANTHROPIC_API_KEY=sk-ant-your_key_here
   ```

3. **Check before committing**:
   ```bash
   # Review what you're committing
   git diff --staged

   # Check for accidentally added secrets
   git diff --staged | grep -i "key\|token\|password\|secret"
   ```

4. **Rotate keys regularly**:
   - Set calendar reminders
   - Rotate every 90 days minimum
   - Rotate immediately if exposed

### For This Project

✅ **Current setup (after fixes)**:
- `.gitignore` prevents secret files
- `.env` files are excluded
- `.sn-key` is excluded
- Documentation explains token management

✅ **Your ServiceNow tools**:
- Keep `.sn-key` file on disk (needed for tools)
- File is now in `.gitignore` (won't be tracked)
- Rotate key periodically

---

## Timeline for Remediation

| Task | Priority | Time Required | Status |
|------|----------|---------------|--------|
| Rotate ServiceNow API key | 🔴 CRITICAL | 5-10 minutes | ⏳ TO DO |
| Update local `.sn-key` file | 🔴 CRITICAL | 1 minute | ⏳ TO DO |
| Test ServiceNow tools work | 🟡 HIGH | 5 minutes | ⏳ TO DO |
| Clean git history (BFG) | 🟢 MEDIUM | 15-20 minutes | ⏳ TO DO |
| Verify key not in history | 🟢 LOW | 2 minutes | ⏳ TO DO |

**Total time needed**: ~30-40 minutes

---

## Questions & Answers

**Q: Can I skip cleaning git history?**
A: Technically yes, but not recommended. The old key will be in history forever. If you rotate the key, the old one is useless anyway, but cleaning history is good practice.

**Q: Will force pushing break things?**
A: Only if others are working on the same repository. If this is your personal project, force push is safe after you've rotated the key.

**Q: How did this happen?**
A: The `.sn-key` file was created before `.gitignore` patterns were comprehensive. This is a common mistake in development.

**Q: Is this a big deal if it's a personal project?**
A: YES. If the key has access to production data or sensitive information, it's critical. Even test/dev instances can be problematic.

**Q: What if I don't rotate the key?**
A: Your ServiceNow instance remains vulnerable to unauthorized access. Anyone who finds the key in git history can use it.

---

## Additional Resources

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [ServiceNow Security Best Practices](https://docs.servicenow.com/security)
- [12 Factor App: Config](https://12factor.net/config)

---

## Contact & Support

If you need help with any of these steps:
1. ServiceNow key rotation: Check ServiceNow admin documentation
2. Git history cleanup: See links above or ask for assistance
3. Security questions: Consider consulting a security professional

---

**Status**: ⚠️ WAITING FOR KEY ROTATION

Once key is rotated, update this document:
- [ ] Old key rotated
- [ ] New key in local `.sn-key` file
- [ ] ServiceNow tools tested with new key
- [ ] Git history cleaned (optional)
- [ ] Verification complete

---

**Report Generated**: 2025-10-29
**Last Updated**: 2025-10-29
**Next Review**: After remediation complete
