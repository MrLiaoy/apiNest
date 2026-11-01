<div align="center">

# apiNest

**Lightweight local API debugger · REST + SOAP**

Instant startup · All-local data · Folder-based storage · No accounts, no cloud

[简体中文](README.md) | [English](#english)

</div>

---

<a id="english"></a>

## Why

**apinest** is a lightweight, instant-start local API debugger: a few MB to install, all data on your own disk, with first-class REST and SOAP support. No accounts, no cloud, no telemetry — just send requests, inspect responses, manage APIs.

> Status: v1.0.0, author's daily driver in the making. Windows 10/11 fully supported (Windows 7 best-effort).

## Features

### Request debugging
- **REST**: all common methods, two-way sync between query params and URL, headers (auto-generated rows marked), body (JSON / form-data with multi-file / urlencoded / raw), auth (Bearer / Basic / API Key — header or query injection)
- **SOAP**: point at a WSDL, hit Parse, get an operation template — then edit the full XML envelope freely (lists, nesting, whatever). SOAPAction is derived automatically. Or skip parsing entirely and paste a raw message.
- **Concurrent requests**: slow requests keep running in the background while you switch tabs; tabs show a spinner while running and a completion badge (green check / red exclamation)

### Storage (the differentiator)
```
my-collection/                   ← one collection = one folder
  apix.collection.json           ← skeleton: tree structure (names + ids only, a few KB)
  requests/<requestId>.json      ← one file per request
  history/<requestId>.json       ← per-request history, rolling window
```
- Instant open: the skeleton is tiny; request bodies load in parallel
- Instant save: editing a request writes only that file
- Collections can be zipped, committed to Git, or shared as a folder

### History
- History is kept **per request** (with request snapshots and response previews) — expand any entry to inspect the full request/response
- Configurable rolling limit per request (10–1000 entries)
- Changing the URL never loses history — history belongs to the request, not the URL

### Also
- **Multi-tab** with session restore
- **Import / Export**: mainstream collection formats (Collection v2.1 and compatible, zip supported), folder structure preserved; cURL import and copy-as-cURL (Linux / Windows cmd)
- **i18n**: built-in 中文 / English, community language packs supported
- **Theme**: light / dark / follow system
- **Shortcuts**: `Ctrl+Enter` send · `Ctrl+S` save · `Ctrl+W` close tab · `Ctrl+T` new tab
- No environment-variable system by design — URLs are written in full, kept simple

## UI

<!-- Add docs/screenshot.png before release and uncomment -->
<!-- ![screenshot](docs/screenshot.png) -->

## Development

```bash
# Requirements: Node 18+, Rust (MSVC toolchain), Windows 10/11
npm install
npm run tauri dev      # develop
npm run tauri build    # build NSIS installer
```

Stack: Tauri 2 · React 19 + TypeScript · Tailwind CSS · Rust (reqwest / quick-xml / zip)

## Language packs

Built-in 中文 and English. To add a language:

1. Settings → Language → "Open locale directory", see the `template.json` sample
2. Copy, translate, rename to the language code (e.g. `fr.json`), set `__name` to the display name
3. Settings → "Upload language file…", pick the file — applied instantly

Or drop the file into `%APPDATA%/<app>/locales/` and restart.

## Data safety

Auth credentials are stored in plain text in local files — never commit collections containing sensitive credentials to public repositories.

## License

[MIT](LICENSE)
