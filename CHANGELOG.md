# Changelog

## 1.0.1-strict.2

- On the mobile app, trust needs the desktop's approval of the exact same content: the desktop writes
  `approvals.json` (SHA-256 of each trusted content) next to the plugin; the phone checks it on every render and every
  30 seconds, so a revoked or changed file goes back to isolated.
- Mobile trust dialog: full-vault-access warning, the desktop approval date and a required checkbox. Trusted files on
  the phone are labelled «Full vault access · trusted file».
- Trust dialogs show a static review of the file: access to the surrounding window or Obsidian's API, network hosts,
  storage, dynamic or obfuscated code.
- The desktop dialog states that trusting also approves the file for the phone.
- Installation guide: phone section for Self-hosted LiveSync (Hidden File Sync limited to the plugin folder).
- Test vault: `08-reaches-obsidian.html`; the Obsidian harness also simulates the phone rule.

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
- Packaging: a deterministic zip (`npm run package`) with the plugin folder, an English-first
  installation guide (Markdown in English and Spanish, bilingual HTML), a self-checking
  `isolation-check.html` and `SHA256SUMS`.
- CI on every push and a tag-triggered release workflow that creates a **draft** release with the
  package and a build-provenance attestation; actions pinned to commit SHAs, no install scripts.
- Forbidden-API sweep of the bundle (`npm run check`), with exceptions only through `packaging.json`.
- Test fixtures and the test vault are English first, with an EN/ES switch.
