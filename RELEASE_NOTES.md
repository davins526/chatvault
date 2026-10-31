# ChatVault v0.1.7 — Legacy Cooldown Hotfix

- Removes stale cooldowns left by earlier connection errors. Previous previews incorrectly blocked manual backups for an hour after transport failures.
- Preserves valid HTTP 429 cooldowns and Retry-After: the extension does not bypass rate limiting.
- Automatically logs the correction after updating, without deleting historical logs or backup data.
- Persists the active ChatGPT tab ID across Manifest V3 service worker restarts.
- Adds regression tests for stale cooldown, valid 429 and expired cooldown.

**Limitations:** Live authenticated backup has not been verified. Scheduled backups still need a running browser and a logged-in ChatGPT tab.
