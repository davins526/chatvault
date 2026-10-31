# ChatVault v0.1.5 — Project Collector

- Separate scanning of accessible project conversations via the same cursor endpoint used by MIT ChatGPT Bulk Exporter.
- General conversations are scanned as well and merged by conversation ID.
- Handles cursor pagination, changed API response formats and 429 without retrying.
- Includes mocked API tests for project lists, pagination, deduplication and failures.
- Local backups stay in IndexedDB on update.

**Important:** Actual ChatGPT authenticated export has not been integration-tested; project discovery relies on links in the current page navigation. Attachments, memory and project instructions are still unsupported.
