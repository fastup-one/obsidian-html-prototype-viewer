# Changelog

## 1.0.1-strict.1

First release of the strict fork, based on upstream 1.0.1 (`f9922b8`).

- New identity: `html-prototype-viewer-strict` / "HTML Prototype Viewer (Strict)", so an update of
  the original plugin never replaces it. Requires Obsidian 1.13.
- Every HTML file opens isolated: `srcdoc`, sandbox `allow-scripts allow-forms`, and a no-network
  Content-Security-Policy injected before any of the file's content. Fixes the blank frame of the
  upstream strict mode on desktop.
- Per-file trust bound to the SHA-256 of the approved content, with a confirmation dialog, a
  permanent label, revocation from the shield button, a command or the settings, and automatic
  isolation when the file changes. Trust follows renames and moves and is dropped on delete.
- Removed the global `Strict isolation` setting; there is no way to disable isolation globally.
- Notices outside the frame: what isolated mode blocks, neighbouring files and internet resources
  that will not load, features that do not work, navigation code, and frames stopped after leaving
  their document.
- Spanish interface.
- In-repo SHA-256; unit tests with `node:test`; self-checking fixtures, a test-vault builder and a
  harness that drives a real Obsidian.
- No release workflow: this fork is not published.
