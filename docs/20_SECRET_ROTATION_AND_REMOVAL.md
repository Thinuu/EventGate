# Secret Rotation & Git History Cleanup

This document lists recommended steps to remediate accidental secret exposure and to scrub repository history.

Important: perform these steps after coordinating with your security team and creating backups of the repository.

1) Rotate credentials immediately
   - For any secret that may have been exposed (DB user/password, API keys, payment secrets, Twilio, SendGrid, Azure keys, etc.) rotate them in the provider console.
   - Revoke old keys and issue new ones.

2) Update environment configuration
   - Replace any hardcoded or example secrets in local files with placeholder values and store real secrets in a secret manager (Azure Key Vault, ASUZE Secrets Manager, HashiCorp Vault) or CI secrets.
   - Commit only `.env.example` with no real values.

3) Scrub git history (two common methods)
   - Using `git filter-repo` (recommended):
     - Install: `pip install git-filter-repo` or package for your platform.
     - Make a mirror clone: `git clone --mirror <repo-url> repo.git && cd repo.git`
     - Run replacement (example removing a secret):
       `git filter-repo --invert-paths --paths README.md --refs heads` (use specific flags to remove blobs or use `--replace-text` with a file of sensitive tokens)
     - After cleaning, force-push to the remote: `git push --force --all && git push --force --tags`
   - Using BFG Repo-Cleaner (simple common use):
     - Install BFG and run:
       `bfg --delete-files id_rsa --delete-files "*.pem" --replace-text passwords.txt repo.git`
     - Follow BFG instructions and `git reflog expire --expire=now --all && git gc --prune=now --aggressive` then force-push.

4) Scan repository for other secrets
   - Use `gitleaks` or `trufflehog` to scan the repo and CI artifacts.
   - Example: `gitleaks detect --source=. --report-path gitleaks-report.json`

5) Force-push & notify collaborators
   - After history rewrite, you must force-push and notify all contributors to re-clone or reset their local clones.

6) Add preventive controls
   - Add a pre-commit secret scanner (e.g., `pre-commit` hook with `detect-secrets` or `gitleaks`), and enable CI scanning (Gitleaks, TruffleHog) on PRs.
   - Store secrets in CI/CD secret stores and inject at runtime.

7) Verify
   - Re-run secret scanners and verify the old secrets no longer appear in any commit or tag.

If you want, I can prepare an automated script and a PR template with the exact commands tailored to this repository.
