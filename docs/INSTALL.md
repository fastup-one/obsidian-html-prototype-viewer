# HTML Prototype Viewer (Strict) · Installation guide

*Versión en español: `INSTALL.es.md`.*

Requires **Obsidian 1.13 or newer** (Settings → About).

## What is in the package

| File | Purpose |
|---|---|
| `html-prototype-viewer-strict/` | The plugin: `main.js`, `manifest.json` and `styles.css`. This is what you install. |
| `isolation-check.html` | A page that tells you by itself whether isolation works (green, amber or red). |
| `SHA256SUMS` | Fingerprints of every file in the package, to check it if you want. |
| `INSTALL.md` / `INSTALL.es.md` / `INSTALL.html` | This guide. |

## 1. Install on your computer

1. Get the package onto the computer where your Obsidian lives — download it from the GitHub release, or copy it however
   you like (USB, cloud, email to yourself) — and unzip it.
2. In Obsidian, open your vault and go to **Settings → Community plugins**.
3. Next to «Installed plugins», click the **folder icon**: your vault's `plugins` folder opens.
4. Copy the **`html-prototype-viewer-strict`** folder from the package into it (the whole folder).
5. Back in Obsidian, click the **reload icon** (circular arrow) next to «Installed plugins».
6. Enable **HTML Prototype Viewer (Strict)**.
7. **Disable HTML Prototype Viewer** (the original). Do not delete it: that way you can go back whenever you want.
8. Open any HTML file in your vault: above the page there must be a shield and the word **Isolated**.

## 2. Your trusted HTML files

- Every HTML file opens **isolated**: no access to your vault and no internet. For most pages that is enough.
- If one of your HTML files needs to remember things (progress, settings), use the internet or load files from its
  folder: open it, click the **shield** at the top, then **Trust**.
- If that file changes (for example, you regenerate it), it goes back to isolated and tells you. Trust it again if
  you still want it that way.
- The list of trusted files, and the buttons to revoke them, are in **Settings → HTML Prototype Viewer (Strict)**.
- Trust travels with the vault: a file you trust on the computer is also trusted on the phone.

## 3. On your phone

The plugin reaches the phone through your vault's sync:

- **Obsidian Sync:** in the Sync settings, turn on syncing of installed community plugins and of the active plugin list.
- **Other sync** (iCloud, Syncthing, Git…): the hidden `.obsidian` folder travels with the vault; nothing else to do.

Then, on the phone: **Settings → Community plugins** → enable **HTML Prototype Viewer (Strict)** and disable the
original.

**The one remaining check** (2 minutes):

1. Copy `isolation-check.html` into your vault and open it on the **phone**. It must show **🟢 GREEN**.
2. Click the shield → **Trust**. Tell me whether it shows **🟠 AMBER** or **🔴 RED**. Red means that on the phone a
   trusted file can see your vault: not a bug, but worth knowing when you decide what to trust.
3. Click the shield again to revoke the trust. You can delete the file afterwards.

## 4. Going back

Disable **HTML Prototype Viewer (Strict)** and enable the original. That is all.

## 5. Checking the package (optional)

`SHA256SUMS` lists the SHA-256 of every file in the package. On macOS, in Terminal, inside the unzipped folder:
`shasum -a 256 -c SHA256SUMS` must answer `OK` for every line.

Packages built by GitHub also carry a signed build-provenance attestation, which proves the zip was built from the
repository by its release workflow: `gh attestation verify <zip> --repo <owner>/<repo>`.

## In short: what it does

- **Isolated** (always, unless you trust the file): the page cannot touch Obsidian or your vault, has no internet,
  cannot store data, open windows, show dialogs or download files. A line above the page explains what was blocked.
- **Trusted** (only files you choose, and only while they stay unchanged): shown as in the original plugin. Above it,
  **Not isolated · trusted file** in orange.
- **Remaining risk:** a page can still try to send itself to a website; that one request leaves. The plugin stops the
  page and shows a notice — except when it happens while the page is still loading.
- What must never happen: a blank page with no explanation. If you see one, report it.
