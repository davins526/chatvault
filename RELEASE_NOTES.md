# ChatVault v0.1.8 — Partial Backup Recovery

- Backup now saves each conversation's raw JSON to local IndexedDB immediately after its listing page is fetched, before requesting subsequent listing pages.
- If a later project/general-list request returns HTTP 429, already stored chat revisions remain in a partial snapshot and can be downloaded as a ZIP.
- HTTP 429 still stops further requests immediately and retains the existing cooldown. No retry or rate-limit workaround was introduced.
- Regression tests check that project chats are stored before a 429 in general listing, and that a 429 while fetching a later detail keeps earlier items.
- Historical backups and settings remain unchanged.

**Limitations:** Full real-account retrieval has not been integration-tested; a 429 on the first detail may still result in zero saved chats. Undocumented API endpoints may change; attachments and standalone project instructions are unsupported.
