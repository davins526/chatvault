# ChatVault v0.1.1 — experimental hotfix

- Windows installer now always installs per-user to `%LOCALAPPDATA%\\ChatVault` and no longer offers a Program Files destination.
- Popup calendar chooses the **first backup date**, at 20:00 local time; all later backups repeat every 7 calendar days.
- Leaving the date empty preserves the default schedule: Sunday at 20:00.
- Added tests for user-selected dates and weekly recurrence across dates.
- Previous experimental backup functionality remains unchanged.

**Known limitations:** outside-store browser activation still requires manual confirmation, ChatGPT collection is not integration-tested; attachments and project instructions are not downloaded, local ZIP is unencrypted, and browser shutdown may delay scheduled backups.
