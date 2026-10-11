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
- Trusting a file on the computer also approves it for your phone (see below); the phone still asks before trusting it.

## 3. On your phone

The plugin reaches the phone through your vault's sync; the phone's file browser cannot see the hidden `.obsidian`
folder, so there is nothing to copy by hand. With **Self-hosted LiveSync**, use its *Hidden File Sync* limited to this
plugin's folder:

1. In LiveSync's settings: **General Settings → Extra menus** → turn on **Enable advanced features** (only that one).
2. **Selector → Hidden Files**: add to **Target patterns**
   ```
   ^\.obsidian(?:$|/plugins(?:$|/html-prototype-viewer-strict(?:/|$)))
   ```
   and to **Ignore patterns**
   ```
   ^\.obsidian/plugins/html-prototype-viewer-strict/data\.json$
   ```
3. **Sync Settings → Hidden Files → Enable Hidden File Sync**: choose **Overwrite** on the computer, **Fetch** on the
   phone. Restart Obsidian when asked.
4. On the phone: **Settings → Community plugins** → enable **HTML Prototype Viewer (Strict)** and disable the original.

Only this plugin's files travel; its settings and the phone's own trust list (`data.json`) stay on each device.

### Trust on the phone needs your computer

On a phone, a trusted file gets **full access to your vault**: it can read, change and delete your notes and send them
over the internet. So the phone only lets you trust a file that **your computer already trusted with exactly the same
content**. The computer's approvals travel in `approvals.json`, inside the plugin folder. On the phone you then confirm
again, ticking a checkbox, and the file is labelled **Full vault access · trusted file**. If the file changes, or you
revoke it on the computer, the phone shows it isolated again (within 30 seconds). Revoking on the computer also cancels
the phone's own confirmation: to trust the file there again, trust it on the computer and confirm again on the phone.

**Check it** (2 minutes), with `isolation-check.html` in your vault:

1. On the phone: it shows **🟢 GREEN**. Click the shield: a message says to trust it on your computer first.
2. On the computer: shield → **Trust**. Wait for the sync.
3. On the phone: shield → tick the checkbox → **Trust**. It shows **🔴 RED** and the red label: expected, that is what
   full access means.
4. On the computer: shield again (revoke). Within 30 seconds the phone shows it **🟢 GREEN** again, with a message that
   your computer withdrew its approval. Trusting it again on the phone needs both steps again.

### Updating

Replace the three files in the computer's plugin folder with the new version's. The sync carries them to the phone.
Then restart Obsidian on both devices.

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
  **Not isolated · trusted file** in orange on the computer; **Full vault access · trusted file** in red on the phone,
  where it also needs your computer's approval.
- **Remaining risk:** a page can still try to send itself to a website; that one request leaves. The plugin stops the
  page and shows a notice — except when it happens while the page is still loading.
- What must never happen: a blank page with no explanation. If you see one, report it.
