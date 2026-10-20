# User Experience & Interface Specification (UX/UI Spec)
## Advanced File Explorer for Windows

**Document Version:** 1.0.0  
**Status:** Approved for Implementation  
**Target Platform:** Windows 10 / Windows 11 (Fluent-Inspired Desktop Experience)  
**Reference Document:** `ADVANCED_FILE_EXPLORER_MASTER_BLUEPRINT.md`  
**Prerequisite Documents:** `docs/PRD.md`, `docs/ARCHITECTURE.md`

---

## 1. UX Design Philosophy & Core Principles

The user interface of **Advanced File Explorer** combines the modern, aesthetic clarity of Windows 11 Fluent Design (subtle acrylic glassmorphism, refined dark surfaces, rounded geometry, and crisp typography) with the density and responsiveness demanded by power users.

### Core UX Principles:
1. **Immediate Information Visibility:** Critical metadata—especially recursive folder size and nested item counts—is directly visible in a dedicated inspector panel without requiring users to navigate modal property windows.
2. **Honest, Unambiguous System State:** Incomplete scans, partial counts, cancelled operations, and permission restrictions are explicitly styled and badge-labeled; the interface never masquerades partial numbers as complete totals.
3. **Frictionless Keyboard Ergonomics:** Every primary workflow (navigation, selection, renaming, deletion, scanning, searching) is fully operable via standard Windows keyboard shortcuts.
4. **Non-Blocking Fluidity:** Scanning large folder hierarchies must never cause frame drops, stutter, or modal blocking of the main file list.

---

## 2. Design System Tokens & Aesthetic Foundations

The design system is implemented in pure, modern Vanilla CSS variables, supporting both Windows Dark Mode (default) and Light Mode.

### 2.1 Color Palette & Surface Tokens

| Token Name | Dark Theme Value | Light Theme Value | Usage |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#0f131a` | `#f4f6f9` | Window root background |
| `--bg-surface-elevated` | `rgba(26, 32, 44, 0.75)` | `rgba(255, 255, 255, 0.85)` | Acrylic glass cards, panels |
| `--bg-surface-active` | `#232d3f` | `#ffffff` | Selected list items, active tab |
| `--bg-surface-hover` | `rgba(255, 255, 255, 0.06)` | `rgba(0, 0, 0, 0.04)` | Hover states on rows and buttons |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | `rgba(0, 0, 0, 0.10)` | Card and panel borders |
| `--border-focus` | `#4f46e5` | `#4338ca` | Focused controls and active inputs |
| `--text-primary` | `#f1f5f9` | `#0f172a` | Primary labels, headers, filenames |
| `--text-secondary` | `#94a3b8` | `#64748b` | File sizes, dates, metadata |
| `--text-muted` | `#64748b` | `#94a3b8` | Disabled text, subtle hints |
| `--accent-primary` | `#6366f1` (Indigo) | `#4f46e5` | Primary buttons, active tabs, progress |
| `--accent-cyan` | `#06b6d4` (Cyan) | `#0891b2` | Code & archive file distribution bar |
| `--accent-emerald` | `#10b981` (Emerald) | `#059669` | Success badges, complete scan check |
| `--accent-amber` | `#f59e0b` (Amber) | `#d97706` | Inaccessible warnings, partial scan |
| `--accent-rose` | `#f43f5e` (Rose) | `#e11d48` | Delete warnings, error badges |

### 2.2 Typography Hierarchy
- **Font Family:** `Segoe UI Variable`, `Segoe UI`, `Inter`, -apple-system, sans-serif.
- **Sizes & Weights:**
  - Display Title: `20px` / Semi-bold (`600`)
  - Panel Header: `14px` / Semi-bold (`600`) / Uppercase tracking `0.05em`
  - Body Text: `13px` / Regular (`400`) / Line-height `1.5`
  - Compact / Metadata: `11px` / Medium (`500`) / Monospace tabular numbers for sizes and dates

### 2.3 Elevation & Glassmorphism
- **Backdrop Blur:** `backdrop-filter: blur(20px) saturate(160%)` applied to the navigation sidebar and Folder Inspector panel.
- **Shadows:**
  - Small: `0 1px 3px rgba(0, 0, 0, 0.2)`
  - Medium (Flyout / Dialog): `0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)`

---

## 3. Overall Application Layout & Wireframe

The application window uses a flexible, three-pane split layout:

```
+-------------------------------------------------------------------------------------------------------+
|  [<] [>] [^]  [ C:\Users\User\Projects\Web ] [v]  | [ Search current folder... (Ctrl+F) ] | [_] [^] [X] |
+-------------------------------------------------------------------------------------------------------+
|  [Tab 1: Web] [+]                                                                       [ View: = # ] |
+------------------+-------------------------------------------------------------+----------------------+
| DRIVES           |  Name             Size       Date Modified       Type       | FOLDER INSPECTOR     |
| [C:] OS (240GB)  |  [D] .git                    18-10-2026 20:50    Folder     | [Icon] Web           |
| [D:] Data (1TB)  |  [D] node_modules            18-10-2026 20:52    Folder     | C:\Users\..\Web      |
|                  |  [D] src                     18-10-2026 21:00    Folder     |                      |
| QUICK ACCESS     |  [F] package.json  1.2 KB    18-10-2026 20:45    JSON File  | RECURSIVE METRICS    |
| [Home]           |  [F] README.md    4.8 KB    18-10-2026 20:46    Markdown   | Files: 12,450        |
| [Desktop]        |  [F] tsconfig.json 420 B     18-10-2026 20:40    JSON File  | Folders: 1,820       |
| [Documents]      |                                                             | Size: 452.8 MB       |
| [Downloads]      |                                                             |                      |
|                  |                                                             | [ SCANNING... 45% ]  |
| BOOKMARKS        |                                                             | [ Cancel Scan ]      |
| [My Code]        |                                                             |                      |
|                  |                                                             | TYPE BREAKDOWN       |
|                  |                                                             | [==== Code 62% ====] |
|                  |                                                             |                      |
|                  |                                                             | LARGEST SUBFOLDERS   |
|                  |                                                             | node_modules: 380MB  |
|                  |                                                             | src:           68MB  |
+------------------+-------------------------------------------------------------+----------------------+
| Ready | 5 items | 1 item selected (Folder: node_modules)                       | Scan time: 00:01.8   |
+-------------------------------------------------------------------------------------------------------+
```

### 3.1 Primary Interface Regions
1. **Window Title & Header Bar:**
   - History navigation buttons: Back (`Alt+Left`), Forward (`Alt+Right`), Up (`Alt+Up`), Refresh (`F5`).
   - Breadcrumb Address Bar: Segmented interactive path tokens with instant switch to editable text box on click.
   - Global / Directory Search input: Quick-filter and recursive search triggers.
   - Window control buttons (Minimize, Maximize/Restore, Close).
2. **Navigation Sidebar (Left, 220px fixed or collapsible):**
   - Drives section: Enumerates logical drives with interactive storage bars (used / total).
   - Quick Access section: Desktop, Downloads, Documents, Pictures, Music.
   - User Bookmarks / Pinned folders: Drag-and-drop target to pin favorite folders.
3. **Main Content Explorer Area (Center):**
   - Tab Bar: Multi-tab support (`Ctrl+T` to open, `Ctrl+W` to close).
   - View Mode Switcher: Toggle between Details, Grid, and Compact views.
   - Virtualized List Viewport: High-performance table with column sorting and multi-select.
4. **Folder Inspector Panel (Right, 320px dockable / collapsible):**
   - Instant direct metadata + deep recursive storage analytics.
   - Collapsible via toggle icon or shortcut (`Alt+Enter` or `Ctrl+I`).
5. **Status Bar (Bottom, 28px):**
   - Left: Item count in active directory, selected item summary (count + combined size).
   - Right: Active background task indicator, elapsed scan timer, and quick notifications.

---

## 4. Deep Specification: The Folder Inspector Panel

The **Folder Inspector** is the application's signature differentiator. It provides an immediate, deep understanding of any selected folder's storage footprint.

### 4.1 Visual Hierarchy & Components

```
+-------------------------------------------------------+
| FOLDER INSPECTOR                          [x] [Close] |
+-------------------------------------------------------+
|  [FOLDER ICON]  node_modules                          |
|  C:\Projects\frontend\node_modules                    |
|  [Copy Path]  [Open in New Tab]                       |
+-------------------------------------------------------+
| DIRECT CONTENTS                                       |
|  Direct Files:       42        Direct Folders:  180   |
|  Direct File Size:   1.4 MB                           |
+-------------------------------------------------------+
| RECURSIVE METRICS (DEEP SCAN)                         |
|  Total Descendant Files:     18,420                   |
|  Total Descendant Folders:    2,105                   |
|  Combined Storage Size:      384.6 MB                 |
|  Exact Bytes:                403,281,920 bytes        |
|  Physical Size on Disk:      412.0 MB (NTFS clusters) |
|  Empty Subfolders:           14                       |
|  Hidden / System Items:      28                       |
+-------------------------------------------------------+
| SCAN STATUS & CONTROL                                 |
|  Status: [ COMPLETED ] (Duration: 00:01.4)            |
|  [ Re-scan Folder ]                                   |
+-------------------------------------------------------+
| STORAGE DISTRIBUTION BY FILE TYPE                     |
|  [==== Code 54% ===][== JSON 28% =][= Other 18% =]    |
|  * Code (.js, .ts):        207.6 MB  (11,200 files)   |
|  * Config (.json):         107.7 MB   (4,100 files)   |
|  * Documentation (.md):     42.3 MB   (1,820 files)   |
|  * Other:                   27.0 MB   (1,300 files)   |
+-------------------------------------------------------+
| TOP 5 LARGEST FILES                                   |
|  1. bundle.js.map          14.2 MB [========]         |
|  2. typescript.js          11.8 MB [======  ]         |
|  3. esbuild.exe             9.4 MB [=====   ]         |
|  4. parser.wasm             6.1 MB [===     ]         |
|  5. core.d.ts               3.8 MB [==      ]         |
+-------------------------------------------------------+
| TOP 5 LARGEST SUBFOLDERS                              |
|  1. @babel/                48.2 MB [==========]       |
|  2. typescript/            42.1 MB [========  ]       |
|  3. esbuild/               24.5 MB [=====     ]       |
|  4. webpack/               18.9 MB [====      ]       |
|  5. prettier/              12.4 MB [===       ]       |
+-------------------------------------------------------+
| PERMISSIONS & ACCESS WARNINGS                         |
|  (i) 0 inaccessible items encountered                 |
+-------------------------------------------------------+
*(Note: Numbers above are illustrative mock values demonstrating component layout only)*
```

### 4.2 Folder Inspector State Machine & UI Representations

| State | Visual Indicator | Primary Action Displayed | Accompanying Text / Details |
| :--- | :--- | :--- | :--- |
| **`IDLE` (Unscanned)** | Neutral folder icon, grey outline | `[ Start Deep Scan ]` | Shows direct child counts immediately; prompts for deep recursive scan. |
| **`SCANNING`** | Pulsing indigo progress bar, spinning radar icon | `[ Cancel Scan ]` (Red outline) | Live streaming counter: *"Traversing: 8,420 files... (Elapsed: 00:01.2)"* |
| **`COMPLETED`** | Solid emerald badge `[ COMPLETED ]` | `[ Refresh ]` icon | Full recursive totals, duration e.g. *"Completed in 1.4s"*. |
| **`CANCELLED`** | Amber striped badge `[ PARTIAL - CANCELLED ]` | `[ Restart Scan ]` | *"Scan cancelled by user at 12,000 files. Metrics shown are incomplete."* |
| **`RESTRICTED`** | Amber warning banner with lock icon | `[ View Blocked Paths ]` | *"Completed with 3 inaccessible directories (Access Denied)"*. Expandable error table. |
| **`STALE`** | Dotted border, clock icon badge `[ STALE ]` | `[ Refresh Metrics ]` | *"Filesystem modified since last scan. Click to refresh."* |

### 4.3 Safe Symlink & Reparse Point Handling in UI
- If the inspected folder contains symbolic links or NTFS directory junctions:
  - An informational chip is displayed: `[ 3 Symbolic Links Detected (Not Traversed) ]`.
  - Hovering provides a tooltip: *"To prevent infinite recursion and duplicate disk usage calculations, symbolic links are counted as pointers and not traversed."*

---

## 5. View Modes & File List Interaction

### 5.1 View Modes
1. **Details View (Default):**
   - Tabular layout with columns: `Name`, `Size`, `Date Modified`, `Date Created`, `Type`, `Attributes`.
   - Columns are resizable via draggable header dividers.
   - Clicking column headers toggles sort ascending / descending with a direction arrow (`▲` / `▼`).
2. **Grid / Icons View:**
   - Card layout with high-resolution system file icons / thumbnails (48x48 or 64x64).
   - File name truncated to 2 lines with full name on hover tooltip.
3. **Compact View:**
   - Multi-column flow layout with small 16x16 icons, maximizing item count per square inch.

### 5.2 Selection Behavior
- **Single Click / Arrow navigation:** Selects item, updates status bar, and immediately populates direct metadata in Folder Inspector.
- **Double Click / Enter:** Opens folder (navigates active view) or launches file using default Windows application via `shell.openPath`.
- **`Shift + Click` / `Shift + Arrow`:** Selects contiguous range of items.
- **`Ctrl + Click` / `Ctrl + Space`:** Toggles individual item selection in multi-select set.
- **`Ctrl + A`:** Selects all items in current directory.

---

## 6. Context Menus & Keyboard Shortcut Matrix

### 6.1 Context Menus
- **Item Context Menu (Right-click on file/folder):**
  - Open (`Enter`)
  - Open in New Tab (`Ctrl+T` on folder)
  - Cut (`Ctrl+X`)
  - Copy (`Ctrl+C`)
  - Copy Full Path (`Ctrl+Shift+C`)
  - Rename (`F2`)
  - Delete to Recycle Bin (`Delete`)
  - Permanently Delete (`Shift+Delete`)
  - Inspect Storage Footprint (`Alt+Enter`)
  - Open in Windows Terminal / PowerShell
- **Canvas Context Menu (Right-click on empty area):**
  - New Folder (`Ctrl+Shift+N`)
  - New Text File
  - Paste (`Ctrl+V`)
  - Refresh (`F5`)
  - Sort By -> Name, Size, Date, Type
  - View -> Details, Grid, Compact

### 6.2 Global Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Alt + Left` | History Back | Navigates to previous visited directory |
| `Alt + Right` | History Forward | Navigates forward in history stack |
| `Alt + Up` | Enclosing Folder | Navigates to parent directory |
| `Ctrl + L` / `Alt + D` | Focus Address Bar | Converts breadcrumbs to editable text input |
| `Ctrl + F` | Quick Filter | Opens quick-filter search bar |
| `F5` / `Ctrl + R` | Refresh | Re-reads active directory contents |
| `Ctrl + T` | New Tab | Opens a new tab in the active pane |
| `Ctrl + W` | Close Tab | Closes current tab |
| `Ctrl + Shift + E`| Dual-Pane Toggle | Toggles side-by-side dual-pane browsing |
| `Ctrl + I` / `Alt + Enter` | Toggle Inspector | Shows/hides the right-hand Folder Inspector panel |
| `F2` | Rename | Initiates inline renaming of selected item |
| `Delete` | Delete to Recycle Bin | Moves selection to Windows Recycle Bin |
| `Shift + Delete` | Permanent Delete | Prompts confirmation dialog for permanent erase |
| `Ctrl + C` / `X` / `V` | Copy / Cut / Paste | Standard clipboard file operations |
| `Ctrl + H` | Toggle Hidden Files | Shows/hides hidden and system files |

---

## 7. Confirmation Dialogs & Safe Modals

### 7.1 Permanent Deletion Confirmation Modal
```
+-------------------------------------------------------------+
| [!] Permanently Delete Items?                               |
+-------------------------------------------------------------+
| Are you sure you want to permanently delete these 3 items?  |
|                                                             |
| * archive_2025.zip (1.4 GB)                                 |
| * temp_build/ (820 MB, 1,420 files)                         |
| * old_logs.log (45 MB)                                      |
|                                                             |
| Total Size: 2.26 GB                                         |
|                                                             |
| (CAUTION: These items will NOT be moved to the Recycle Bin. |
|  This action cannot be undone.)                             |
|                                                             |
|                  [ Cancel (Esc) ]  [ Permanently Delete ]   |
+-------------------------------------------------------------+
```

### 7.2 File Collision Resolution Modal
```
+-------------------------------------------------------------+
| File Collision Detected                                     |
+-------------------------------------------------------------+
| An item named 'report.pdf' already exists in the            |
| destination folder.                                         |
|                                                             |
| Source:      1.4 MB  Modified: Today, 14:20                 |
| Destination: 1.1 MB  Modified: Yesterday, 18:00             |
|                                                             |
| Action:                                                     |
| ( ) Replace the file in destination                         |
| ( ) Skip this file                                          |
| (*) Keep both (Save source as 'report_copy_1.pdf')          |
|                                                             |
| [X] Apply action to all remaining 14 collisions             |
|                                                             |
|                    [ Cancel Operation ]  [ Apply Action ]   |
+-------------------------------------------------------------+
```

---

## 8. Responsive Design & Accessibility

1. **Display Scaling Support:** The interface adapts cleanly across 100%, 125%, 150%, 175%, and 200% Windows display scaling without blurred icons, border clipping, or overlapping text.
2. **Window Resizing Behavior:**
   - At window widths < 900px, the Folder Inspector automatically docks into a slide-over drawer or collapses to preserve file list readability.
   - At window widths < 600px, the navigation sidebar collapses into a hamburger flyout.
3. **Accessibility (WCAG 2.1 AA):**
   - High-contrast visual focus rings (`2px solid var(--accent-primary)`) on all active controls.
   - Screen-reader aria attributes on all interactive elements (`aria-label="Breadcrumb path"`, `aria-expanded="false"`, `role="grid"`).
