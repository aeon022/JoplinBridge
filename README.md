# 🌉 JoplinBridge

[![Joplin Plugin](https://img.shields.io/badge/Joplin-Plugin-blue.svg)](https://joplinapp.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Support on Polar](https://img.shields.io/badge/Support_JoplinBridge-Polar-0066FF.svg?style=flat-square&logo=polar)](https://buy.polar.sh/polar_cl_BN6xwyJH2Drn6WuzvV49E2KCGauvtoTHixD3w1hCpSH)
[![Created by abteilung83](https://img.shields.io/badge/Crafted%20by-abteilung83-black.svg)](https://github.com/aeon022)

**JoplinBridge** is a lightweight, high-performance Joplin plugin developed by **abteilung83** for developers and power users who want seamless, real-time, **bidirectional synchronization** between local Markdown files (edited in Vim, Neovim, VS Code, Helix, Obsidian, etc.) and Joplin Notebooks.

---

## ✨ Features

- 🔄 **Real-Time Bidirectional Sync**: Instant synchronization between local `.md` files and Joplin notes.
- 📁 **Sub-Notebook Hierarchy Preservation**: Subdirectories in your local project folder automatically map to nested Joplin sub-notebooks.
- 🆔 **Frontmatter ID Mapping**: Injects deterministic YAML frontmatter (`joplin_id`) to track files across renames or moves.
- ✏️ **Auto-Renaming**: Renaming a note title in Joplin automatically renames the local `.md` file on disk.
- 🔒 **Zero Data Loss & Lock Guards**: In-memory write locks and ID guards prevent loop conditions and race-condition overwrites.
- ⚡ **Non-Blocking Architecture**: Fully asynchronous event handlers ensure Joplin UI remains fast and responsive.

---

## 🛠️ Installation

### Manual Installation (.jpl)
1. Download the latest `com.aeon022.joplinbridge.jpl` file from the [Releases](https://github.com) page (or from `publish/com.aeon022.joplinbridge.jpl`).
2. Open **Joplin**.
3. Go to **Preferences / Options** $\rightarrow$ **Plugins**.
4. Click the **Gear icon** ($\small\text{⚙️}$) $\rightarrow$ **Install from file**.
5. Select `com.aeon022.joplinbridge.jpl` and restart Joplin.

---

## 🚀 Quickstart & Tutorial

### 1. Adding a Local Sync Folder
1. Open Joplin.
2. Go to **Tools** $\rightarrow$ **JoplinBridge: Add Local Sync Folder...**.
3. Paste the absolute path to your local project folder (e.g. `/Users/username/Projects/my-app/docs`).
4. Optionally type a **Notebook** — start typing and existing notebooks (including nested ones, e.g. `MISSIONCTL/Marketing`) show up as suggestions. Pick one, or type a new name/path to create it. Leave empty to use the default from Settings, or the top level if that's empty too.
5. Click **OK**. JoplinBridge will automatically index local Markdown files and create corresponding Joplin notebooks and notes.

> **macOS Finder Tip**: Right-click any folder in Finder, hold the **Option key (`⌥`)**, and click **"Copy as Pathname"**.

### 2. Editing Files
- **In Vim / VS Code**: Edit any `.md` file inside your synced folder and save. The corresponding note in Joplin updates instantly.
- **In Joplin**: Create or edit a note inside the synced notebook. The local `.md` file updates or is automatically created on your disk.

---

## 📍 Choosing Where a Synced Folder Lands

Each local folder you sync gets its own root notebook in Joplin (named after the folder itself, e.g. a folder called `documents` becomes a notebook called `documents`). By default that notebook is created at the **top level**. If you have several projects — say a work suite and a personal notes folder — you'll usually want each one filed under a different parent notebook instead of all landing at the top level side by side.

There are two ways to control this, and they combine:

### Per-folder, via the Add dialog
The **Notebook** field in **Tools → JoplinBridge: Add Local Sync Folder...** accepts:
- A single name, e.g. `missionctl` — creates/uses a top-level notebook with that name.
- A nested path, e.g. `MISSIONCTL/Marketing` — creates/uses `Marketing` as a *child* of `MISSIONCTL`, walking (or creating) each level. This is what you want if the target notebook is itself nested somewhere.
- Empty — falls back to the default below.

The field autocompletes against every notebook that already exists (fetched fresh each time you open the dialog), so with many notebooks you can search instead of retyping an exact name/path from memory. Typing something that doesn't match an existing suggestion just creates a new notebook with that name/path.

### Per-folder, via Settings
Same thing, without the dialog: in **Tools → Options → JoplinBridge → Local Sync Directories**, each line is a path, optionally followed by `|NotebookName`:

```
/Users/you/Developing/missionctl/postctl/documents|MISSIONCTL/Marketing
/Users/you/Privat/docs|Uni
/Users/you/Scratch/notes
```

The third line has no `|`, so it falls back to the default root notebook (next section) — or the top level, if that's unset too. This is the fastest way to review or bulk-edit many mappings at once.

### Global default
**Tools → Options → JoplinBridge → Root Notebook (default)** — the fallback for any sync directory that doesn't specify its own `|NotebookName`. Leave empty to create those at the top level.

### Notes on existing folders
- These settings only decide where a folder's notebook is **created or matched** — they don't retroactively move a folder you already synced without one. If a synced notebook is already sitting somewhere and you now want to lock that in (or move it), set the matching `|NotebookName`/nested path so it resolves to the *same* existing notebook — otherwise a mismatched setting can create a **new, duplicate** notebook and migrate your already-tracked notes into it on the next sync.
- To move an already-misplaced notebook, either drag it in the Joplin sidebar, or set the `|NotebookName` override to exactly where you want it — pointing it at an *existing* notebook resolves to that one instead of creating a new one.

---

## 💜 Support & Sponsoring

Is **JoplinBridge** helping your daily developer workflow? Support further development and maintenance!

👉 **[Support JoplinBridge on Polar](https://buy.polar.sh/polar_cl_BN6xwyJH2Drn6WuzvV49E2KCGauvtoTHixD3w1hCpSH)**

---

## 🏢 About abteilung83

**JoplinBridge** is engineered and maintained by **abteilung83** — specializing in developer tooling, workflow automation, and open-source integrations.

- **GitHub**: [@aeon022](https://github.com/aeon022)

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
