# Privacy / Конфиденциальность

ChatVault v0.1 works locally in the user's browser profile.

- The extension accesses ChatGPT conversations when the user has an active session and a ChatGPT tab open.
- ChatGPT session access tokens are read in memory to authorize calls to ChatGPT; they are **not** persisted by the extension, included in archives or transmitted to the developer.
- Conversation content and local snapshots are stored in the browser's IndexedDB (extension origin). Exports are downloaded to the user's device using the browser downloads API.
- No analytics, ads, cloud storage, telemetry or developer-controlled server is used.
- The extension interacts with ChatGPT's existing site APIs for the user's own data. ChatVault is not affiliated with OpenAI.
- Archives and local stored conversations are **not encrypted** in v0.1; protect your computer and stored backups.
- Removing the extension or deleting its site data may delete local snapshots. Download and verify ZIP files first.
- Sources and permissions: `storage` (preferences), `alarms` (weekly scheduling), `tabs` (find user's existing ChatGPT tab), `offscreen` (generate a Blob URL locally), `downloads` (save ZIP), and narrowly scoped host permissions for ChatGPT.
