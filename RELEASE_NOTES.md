# ChatVault v0.1.3 — Icon & Diagnostic Update

- New monochrome archive-box icon in browser extension (16, 48 and 128 px) and scalable SVG source.
- New **Проверить подключение к ChatGPT** command: checks for an open ChatGPT tab, tests the content-script channel and attempts safe local reinjection without sending any ChatGPT API requests.
- Diagnostic results are persisted separately from historical errors, and events are written to the journal with timestamps and codes.
- The UI explicitly notes that old journal errors persist after an extension update.
- Adds mock-runtime smoke tests for content-script messaging and a packaging check for the extension's icons.
- Release builds are gated by npm build and tests.

**Known limits:** live ChatGPT API collection remains experimental. Passing smoke tests is not a live account integration test. Previous snapshots stay local; attachments, memory and project instructions are not downloaded.
