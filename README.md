# HTML Prototype Viewer (Strict)

A hardened fork of [HTML Prototype Viewer](https://github.com/gloumi/obsidian-html-prototype-viewer)
(1.0.1, MIT) by Renan Gautier. It previews HTML files stored in your vault in an iframe — and
treats every one of them as untrusted until you decide otherwise.

## Strict fork: what changes and why

HTML in a vault can come from anyone: exports, downloads, synced folders. The original plugin
runs it with the iframe's `allow-same-origin` by default, and its optional strict mode shows a
blank frame on desktop (Obsidian does not serve `app://` URLs to an opaque-origin frame).

This fork:

- **Isolates every HTML file by default.** The file is read and loaded through `srcdoc` into a
  sandbox with only `allow-scripts` and `allow-forms`: an opaque origin with no access to
  Obsidian or your vault.
- **Cuts the network for isolated files.** A Content-Security-Policy is injected before any of
  the file's content: no `fetch`/XHR/WebSocket, no remote scripts, styles, fonts, images or
  frames, no form submissions. New windows, `alert`/`confirm`/`prompt` and downloads are not
  granted either.
- **Lets you trust individual files.** The shield button (or a command) asks for confirmation,
  then shows that file exactly like the original plugin's non-strict mode. Trust is bound to the
  SHA-256 of the content you approved: if the file changes, it is isolated again until you trust
  it again. Trust follows renames and moves.
- **Gates trust on phones behind the desktop.** On the mobile app a trusted file shares Obsidian's origin and reaches
  the whole vault (verified on an iPhone). So a phone can only trust a file that the desktop app already trusted with
  the same content: the desktop writes `approvals.json` (SHA-256 of each trusted content) next to the plugin, the
  vault's sync carries it, and the phone checks it on every render and every 30 seconds. The phone still asks for its
  own confirmation, with a required checkbox, and labels the file «Full vault access · trusted file».
- **Reviews before trusting.** The trust dialog lists what the file does — reaching for the surrounding window or
  Obsidian's API, network hosts, storage, dynamic or obfuscated code. A static check, not a guarantee.
- **Has no global switch** to turn isolation off. The upstream `Strict isolation` setting is
  gone; old settings load without granting anything.
- **Always shows what is going on.** An «Isolated» line above every page explains what is blocked;
  notices list neighbouring files and internet resources that will not load; trusted files carry a
  permanent «Not isolated · trusted file» label. Nothing fails silently.

What isolated mode supports: single-file HTML, inline CSS and JavaScript, `data:`/`blob:` images,
fonts and media, anchors, forms handled by scripts. What it does not: `localStorage`, files next to
the page (CSS, images, other pages), anything from the internet, new windows, dialogs, downloads.
Trusting the file brings all of that back.

### Residual risks

- **Self-navigation.** No CSP can stop a page from navigating its own frame to a website, so that
  one request always leaves. When the page navigates after loading, the plugin notices and removes
  the frame; a script that navigates *while* the page is loading cannot be told apart from the
  page's own load. The static analysis warns when it finds navigation code.
- **Check-then-load window.** A trusted file is hashed, then loaded from disk. A change in between
  triggers Obsidian's `modify` event, which re-evaluates the file before repainting.
- **Trusted means trusted.** A trusted file has the original plugin's privileges: network, storage,
  windows, downloads and, on the mobile app, full access to your vault. The confirmation dialogs say so.
- **Approvals file.** Anyone who can write to `.obsidian/` can forge `approvals.json` — like replacing the plugin
  itself, that is out of scope. With two desktops, the last one to write it wins.
- **Sync.** Sync only the plugin's own files to phones (`main.js`, `manifest.json`, `styles.css`, `approvals.json`);
  keep `data.json` per device. See docs/INSTALL.md for Self-hosted LiveSync patterns.
- Anyone who can write to `.obsidian/` can replace any plugin; that is out of scope.

## Installation

This fork is not published in the community directory. It ships as a zip package
(`html-prototype-viewer-strict-<version>.zip`) with the plugin folder, an installation guide in
English and Spanish (`INSTALL.md`, `INSTALL.es.md`, `INSTALL.html`), a self-checking
`isolation-check.html` and `SHA256SUMS`. In short: copy the `html-prototype-viewer-strict` folder
into `<vault>/.obsidian/plugins/` (Settings → Community plugins → folder icon), reload the list,
enable **HTML Prototype Viewer (Strict)** and disable the original **HTML Prototype Viewer** — only
one view can own the `.html` extension. Requires Obsidian 1.13 or newer. The full guide is in
[docs/INSTALL.md](docs/INSTALL.md).

## Features

- **Opens `.html` and `.htm` files natively.** Click a file in the file explorer and it
  opens in a tab.
- **Device widths.** Switch the render width between full width, desktop (1280 px),
  tablet (834 px) and mobile (390 px) from the tab toolbar.
- **Live reload.** The preview refreshes whenever the file changes on disk. A trusted file is
  always re-evaluated when it changes, even with live reload off.
- **Embed previews in notes** with an `html-preview` code block, with the same isolation, notices
  and labels.
- **Open in the system browser** from the tab toolbar or the file context menu.
- English, French and Spanish interface, following Obsidian's language setting.

## Embedding in a note

````markdown
```html-preview
[[My prototype.html]]
height: 700
```
````

The block accepts a wiki link, a vault-relative path, or explicit keys:

| Key | Meaning |
|---|---|
| `path:` (or `file:`) | The HTML file to render |
| `height:` | Preview height in pixels — defaults to the plugin setting |
| `width:` | Fixed render width in pixels — defaults to full width |

The command **Insert a prototype preview in the note** generates the skeleton.

## Settings

| Setting | Description |
|---|---|
| Default render width | Width applied when opening an HTML file |
| Reload automatically | Refresh the preview when the file changes on disk |
| Preview height in notes | Default height for `html-preview` blocks |
| Trusted files | Every trusted file, with its date, fingerprint and status (unchanged, changed, not found); revoke one or all |

## Compatibility note

Only one view can own the `.html` extension. If another HTML-rendering plugin (such as
HTML Reader or the original HTML Prototype Viewer) is enabled at the same time, which one wins
depends on plugin load order. Disable the other one for predictable behaviour.

## Development

```bash
npm ci --ignore-scripts   # dependency install scripts never run
npm run dev               # watch build
npm run build             # type-check, then production bundle
npm test                  # type-check, then unit tests (node:test)
npm run check             # tests, build and forbidden-API sweep of main.js (scripts/check-bundle.mjs)
npm run package           # deterministic zip package in dist/ (scripts/package.mjs; --out <dir> to change)
```

`packaging.json` lists the extra files of the package and any approved exception to the bundle
sweep. The package is byte-for-byte reproducible: the same commit gives the same zip hash on any
machine.

## Releases

Pushing a tag equal to `manifest.json`'s version (no `v` prefix, e.g. `1.0.1-strict.1`) runs
`.github/workflows/release.yml`: tests, build, sweep, package, a signed build-provenance attestation
and a **draft** GitHub release with the zip and the plugin files. Nothing becomes public until the
draft is published by hand; collaborators can download it from the Releases page. Before installing,
compare the release zip's SHA-256 with the one of a local `npm run package` from the same commit.
`.github/workflows/ci.yml` runs the same checks on every push. Actions are pinned to commit SHAs and
install scripts never run.

Desktop checks in a real Obsidian, on a throwaway vault and an isolated profile (Linux, needs
`Xvfb` and the `obsidian` binary; DevTools on 127.0.0.1 only):

```bash
npm run build
node scripts/make-test-vault.mjs /tmp/hpv-vault
node test/obsidian/launch.mjs start /tmp/hpv-profile /tmp/hpv-vault 9333
node test/obsidian/checks.mjs 9333 /tmp/hpv-report
node test/obsidian/launch.mjs stop /tmp/hpv-profile
```

`scripts/make-test-vault.mjs` builds a vault with the plugin enabled and the self-checking pages
from `test/fixtures/vault` (each one reports green, amber or red), which is also what a person
can open by hand to check a build.

`npm run install-local` copies the build into the vault named by `OBSIDIAN_VAULT` or a git-ignored
`.vault-path` file, under `<vault>/.obsidian/plugins/html-prototype-viewer-strict/`.

## License

MIT — see [LICENSE](LICENSE). Original work © Renan Gautier; strict fork © fastup-one.
