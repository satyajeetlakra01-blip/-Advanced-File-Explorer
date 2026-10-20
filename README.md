<div align="center">

<img src="https://img.shields.io/badge/Advanced%20File%20Explorer-v1.0.0-blue?style=for-the-badge&logo=files&logoColor=white" alt="Advanced File Explorer"/>

# 🗂️ Advanced File Explorer

**A powerful, modern desktop file manager built with Electron + TypeScript**  
Dual-pane browsing · Storage analysis · Live search · File preview · Dark UI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%20x64-0078D4?style=flat-square&logo=windows)](https://github.com/satyajeetlakra01-blip/-Advanced-File-Explorer/releases)
[![Electron](https://img.shields.io/badge/Electron-v44-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🗂️ **Dual-Pane View** | Work with two directories side-by-side |
| 🔍 **Global Search** | Blazing-fast file search across your drives |
| 📊 **Storage Inspector** | Visual breakdown of folder sizes |
| 👁️ **File Preview** | Preview images, text, and media instantly |
| 📋 **Task Drawer** | Background file operation queue |
| 🌑 **Dark Theme** | Premium dark UI with glassmorphism effects |
| ⚡ **Portable Mode** | Run without installation |

---

## 🚀 Quick Install (Recommended for Windows)

### Option 1 — One-Command Installer (Run from PowerShell as Admin)

```powershell
irm https://raw.githubusercontent.com/satyajeetlakra01-blip/-Advanced-File-Explorer/main/install.ps1 | iex
```

> This downloads the latest installer, runs it silently, and adds **Advanced File Explorer** to your **Start Menu** so you can search it by name.

---

### Option 2 — Download Installer from GitHub Releases

1. Go to [**Releases**](https://github.com/satyajeetlakra01-blip/-Advanced-File-Explorer/releases)
2. Download **`Advanced-File-Explorer-Setup-x64.exe`**
3. Double-click to install
4. Search **"Advanced File Explorer"** in the **Start Menu** and launch

---

### Option 3 — Portable (No Install Needed)

1. Download **`Advanced-File-Explorer-Portable-x64.exe`** from [Releases](https://github.com/satyajeetlakra01-blip/-Advanced-File-Explorer/releases)
2. Double-click to run — no installation required

---

## 🛠️ Build from Source (Developer Setup)

### Prerequisites

| Tool | Version | Download |
|---|---|---|
| **Node.js** | v18+ (LTS) | [nodejs.org](https://nodejs.org) |
| **Git** | Latest | [git-scm.com](https://git-scm.com) |
| **npm** | v9+ (comes with Node) | — |

### Step-by-Step

```bash
# 1. Clone the repository
git clone https://github.com/satyajeetlakra01-blip/-Advanced-File-Explorer.git

# 2. Navigate into the project
cd -Advanced-File-Explorer

# 3. Install dependencies
npm install

# 4. Run in development mode (live reload)
npm run dev

# 5. OR build and run the production app
npm run build
npm start
```

### Build a Windows Installer

```bash
# Build everything and package as a Windows installer (.exe)
npm run dist
```

> Output will be in the `release/` folder as:
> - `Advanced-File-Explorer-Setup-x64.exe` — NSIS installer (adds to Start Menu)
> - `Advanced-File-Explorer-Portable-x64.exe` — Portable exe

---

## 🖥️ System Requirements

| Requirement | Minimum |
|---|---|
| **OS** | Windows 10 / 11 (64-bit) |
| **RAM** | 256 MB |
| **Disk** | 200 MB free space |
| **Display** | 1280x720 or higher |

---

## 🗺️ Project Structure

```
Advanced-File-Explorer/
├── src/
│   ├── main/           # Electron main process (Node.js backend)
│   │   ├── index.ts    # App entry, window creation
│   │   └── services/   # Drive, File ops, Search, Preview services
│   ├── renderer/       # Renderer process (UI)
│   │   ├── main.ts     # UI bootstrap
│   │   ├── components/ # UI components (HeaderBar, DualPane, etc.)
│   │   ├── store/      # App state management
│   │   └── styles/     # CSS / theme files
│   ├── preload/        # Electron preload bridge (IPC)
│   ├── shared/         # Shared types and IPC contracts
│   └── workers/        # Background worker threads (scanner, search)
├── scripts/            # Build and dev scripts
├── docs/               # Architecture, PRD, UX specs
├── install.ps1         # One-command Windows installer script
├── electron-builder.json5  # Packager config
├── package.json
└── README.md
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl + F | Open search |
| Ctrl + T | New tab / pane |
| F2 | Rename selected file |
| Delete | Move to recycle bin |
| Ctrl + C / V | Copy / Paste |
| Ctrl + H | Toggle hidden files |
| Alt + Left | Navigate back |
| Alt + Right | Navigate forward |

---

## 🤝 Contributing

1. Fork this repository
2. Create your branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

Made with love by [satyajeetlakra01-blip](https://github.com/satyajeetlakra01-blip)
