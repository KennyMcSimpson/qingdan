<p align="center"><img src="docs/images/banner.svg" width="100%" alt="Edgewise — Ambient deadline bar for Windows" /></p>
<p align="center">
  <a href="https://github.com/KennyMcSimpson/edgewise/releases/latest"><img alt="Windows x64" src="https://img.shields.io/badge/Windows_10%20%2F%2011-x64-648264?style=flat-square" /></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-648264?style=flat-square" /></a>
  <img alt="Offline" src="https://img.shields.io/badge/100%25-offline-638392?style=flat-square" />
  <img alt="Zero Runtime Dependencies" src="https://img.shields.io/badge/runtime_deps-zero-638392?style=flat-square" />
  <a href="https://github.com/KennyMcSimpson/edgewise/actions/workflows/desktop.yml"><img alt="Desktop checks" src="https://github.com/KennyMcSimpson/edgewise/actions/workflows/desktop.yml/badge.svg" /></a>
</p>
<p align="center"><strong>Ambient deadline bar for Windows.</strong><br />An offline, zero-account floating task rail that tucks into your screen edge, understands natural-language deadlines, stays invisible on screen shares, and turns urgency into calm color.</p>
<p align="center"><a href="https://github.com/KennyMcSimpson/edgewise/releases/latest"><strong>Download for Windows</strong></a> &nbsp; · &nbsp; <a href="#quick-capture-syntax">Quick capture</a> &nbsp; · &nbsp; <a href="#getting-started">Getting started</a> &nbsp; · &nbsp; <a href="https://github.com/KennyMcSimpson/edgewise/issues">Report an issue</a></p>

> Formerly known as **Qingdan**. Existing local tasks and settings in `%APPDATA%\Qingdan` are imported automatically into `%APPDATA%\Edgewise` on first launch without touching your previous folder.

---

## Why Edgewise?

Mainstream task managers bury deadlines inside heavy dashboards behind account walls. Sticky-note apps forget dates, clutter your screen, and leak private notes during screen shares. Edgewise stays on the periphery of your monitor and gets out of the way:

| Feature | What it does |
| --- | --- |
| **Offline natural-language quick capture** | Type `Submit paper fri 18:00 !`, `Check run +3h`, `Standup weekdays 09:00`, or `pin: Keep backups` right in the bar — live preview chips with a 1-click `Raw` literal escape hatch. |
| **Hide from screen share** | Native Windows capture exclusion (`WDA_EXCLUDEFROMCAPTURE`): your task list stays visible to your eyes while disappearing from Zoom, Teams, Discord, and OBS screen shares. |
| **Ghost click-through mode (`Ctrl+Alt+G`)** | Float translucently over your IDE or browser without blocking clicks. Press `Ctrl+Alt+G`, `Esc`, `Ctrl+Alt+Q`, or click the tray icon to exit safely. |
| **Auto-tucking 46px edge tab** | Switch away and Edgewise shrinks against the nearest screen edge, displaying an urgency color and count. Drop text or a URL directly onto the edge tab to capture a task. |
| **Color-coded deadlines + runway bar** | Soft green → amber → orange → red as time runs out, with a hairline 2px elapsed runway bar and hover `+1h` / `Tmr` 1-click snooze. |
| **Single-task focus strip** | Lock the compact strip onto a single task with a drift-free 25-minute timer (pauses auto-tuck until you finish or exit) and 1-click completion. |
| **Non-accumulating routines & pinned shelf** | Daily, weekday, and weekly reminders roll forward cleanly without piling up missed days. Persistent notes stay pinned above scrolling tasks. |
| **100% local, zero runtime dependencies** | Atomic `fsync` writes, automatic `.bak` recovery, 20 daily snapshots, 30-step undo, JSON backup/restore, and Markdown (`.md`) checklist export. |

---

## Quick Capture Syntax

All parsing happens 100% locally with zero dependencies. Live chips appear above the input before you press Enter (click **Raw** anytime to save literal text):

| You type | What Edgewise creates |
| --- | --- |
| `Submit camera-ready PDF fri 18:00 !` | Deadline this Friday at `18:00`, marked **Important** |
| `Check GPU eval +3h` | Deadline 3 hours from now (`+30m`, `+2h`, `+3d`, `+1w`) |
| `Email advisor tomorrow 9:30am` | Deadline tomorrow at `09:30` (`today`, `tonight`, `tomorrow`, `tmr`, `next mon`) |
| `Conference rebuttal 2026-12-05` | Deadline on `2026-12-05 23:59` (`YYYY-MM-DD`, `MM/DD`, `Dec 5`) |
| `Standup weekdays 09:00` | Recurring Mon–Fri routine at `09:00` (`daily`, `every day`, `weekdays`, `every mon`) |
| `pin: Never push to upstream main` | Pinned reminder on the top shelf (`pin:` or `sticky:`) |

---

## Getting Started

1. Open **[Releases](https://github.com/KennyMcSimpson/edgewise/releases/latest)** and download `Edgewise-1.3.0-windows-x64.zip`.
2. Extract the **entire** archive to a permanent folder.
3. Double-click **`Edgewise.exe`**, type a task in the bottom bar, and press Enter.

The runtime is bundled — no Node.js or Python installation is required on your machine. Target platform: **Windows 10 / 11 x64**. Builds are unsigned; every release includes `SHA256SUMS.txt`.

### Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + Alt + Q` | Show / hide Edgewise globally (focuses quick capture) |
| `Ctrl + Alt + G` | Toggle Ghost click-through overlay globally |
| `Ctrl + N` | Open the detailed task editor |
| `Ctrl + F` | Search titles and notes |
| `Ctrl + Z` | Undo last action (inside text fields, undoes typing) |
| `Esc` | Exit Ghost mode, close search, dialogs, or notifications |

---

## Your Data, On Your Computer

- Stored in `%APPDATA%\Edgewise\edgewise.json` (open directly from Settings).
- Automatically imports existing `%APPDATA%\Qingdan` data on first launch without deleting or altering the legacy folder.
- Atomic temp-file + `fsync` writes, `.bak` auto-recovery, and up to 20 rolling daily snapshots.
- Export/restore portable JSON backups (compatible with legacy Qingdan backups) or export a clean grouped Markdown checklist (`.md`).
- Network requests are blocked at the Electron session layer (`connect-src 'none'` + `onBeforeRequest` cancel).

---

## Development & Verification

Requires Node.js 24+:

```sh
npm ci
npm test         # Zero-dependency core logic & persistence suite
npm start        # Launch desktop app
npm run test:ui  # Real Electron UI & IPC integration tests
```

MIT License — see [LICENSE](LICENSE).
