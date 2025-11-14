# Removing config.js from Git History

If you've already committed `config.js` with API keys, follow these steps to remove it:

## Option 1: Remove from Git Tracking (Recommended)

1. Remove the file from git tracking (but keep it locally):
   ```bash
   git rm --cached config.js
   ```

2. Commit the removal:
   ```bash
   git commit -m "Remove config.js from tracking"
   ```

3. Push to your repository:
   ```bash
   git push
   ```

## Option 2: If You Need to Remove from History

If the file was already pushed to GitHub, you'll need to:

1. **Rotate your API keys immediately** - The keys in the commit history are compromised
2. Use `git filter-branch` or `git filter-repo` to remove the file from history
3. Force push (⚠️ This rewrites history - coordinate with team members)

**Important:** After removing secrets from git, you should:
- Rotate/regenerate all exposed API keys
- Check if the keys were exposed in any other way
- Review your repository's access logs

## Going Forward

- `config.js` is now in `.gitignore` and won't be committed
- Use `config.example.js` as a template (this file is safe to commit)
- Never commit files with real API keys

