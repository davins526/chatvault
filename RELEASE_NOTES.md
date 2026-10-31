# ChatVault v0.1.0 — experimental MVP

- Weekly local backup: Sunday 20:00, enabled by default
- Best-effort catch-up when browser/ChatGPT tab next becomes available
- Content collector on an existing logged-in ChatGPT tab
- Full accessible raw conversation graphs as immutable SHA-256 revisions in IndexedDB
- Snapshot manifests with error coverage, basic popup controls and local activity log
- ZIP download on success (plus manual download of previous/partial snapshot)
- No API rate-limit circumvention, no off-device telemetry

**Known limits:** attachments only as metadata; project instructions and account memory excluded; no account clone/import; not guaranteed under browser shutdown or changed ChatGPT APIs; local archives are unencrypted. Test in a non-sensitive browser profile before relying on it.
