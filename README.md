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
4. Click **OK**. JoplinBridge will automatically index local Markdown files and create corresponding Joplin notebooks and notes.

> **macOS Finder Tip**: Right-click any folder in Finder, hold the **Option key (`⌥`)**, and click **"Copy as Pathname"**.

### 2. Editing Files
- **In Vim / VS Code**: Edit any `.md` file inside your synced folder and save. The corresponding note in Joplin updates instantly.
- **In Joplin**: Create or edit a note inside the synced notebook. The local `.md` file updates or is automatically created on your disk.

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
