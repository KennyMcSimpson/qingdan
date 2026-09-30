<p align="center"><img src="docs/images/banner.svg" width="100%" alt="Qingdan — Keep the important things within sight" /></p>
<p align="center"><a href="README.md">中文</a> · <strong>English</strong></p>
<p align="center">
  <a href="https://github.com/KennyMcSimpson/qingdan/releases/latest"><img alt="Windows x64" src="https://img.shields.io/badge/Windows_10%20%2F%2011-x64-648264?style=flat-square" /></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-648264?style=flat-square" /></a>
  <img alt="Offline" src="https://img.shields.io/badge/works-offline-638392?style=flat-square" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-44.4.5-638392?style=flat-square" />
</p>
<p align="center">A floating Windows task list that moves out of your way.<br />Daily routines remind you on time, persistent notes stay at the top, and deadlines change color.</p>
<p align="center"><a href="https://github.com/KennyMcSimpson/qingdan/releases/latest"><strong>Download for Windows</strong></a> &nbsp; · &nbsp; <a href="#getting-started">Getting started</a> &nbsp; · &nbsp; <a href="https://github.com/KennyMcSimpson/qingdan/issues">Report an issue</a></p>

<p align="center"><img src="docs/images/preview.png" width="388" alt="Paper theme with a top reminder shelf, deadlines and recurring tasks" /> &nbsp; <img src="docs/images/dark.png" width="388" alt="The same task list in the Night theme" /></p>
<p align="center"><sub>Actual application screenshots · Example tasks only · The app interface is currently in Chinese</sub></p>

## Keep the important things within sight

| Feature | What it does |
| --- | --- |
| **A window that makes room** | Switch away and it tucks into a narrow edge tab. Click to expand; automatic tucking is optional. |
| **Daily / weekly routines** | Daily, Monday–Friday, or weekly reminders at a chosen time. Completing one occurrence schedules the next. |
| **Deadlines that change color** | Amber when approaching, orange when urgent, red when overdue. |
| **A top reminder shelf** | Persistent notes stay above the scrolling tasks. Collapse the shelf or open the full collection. |
| **Room for the details** | Add notes, flag important tasks, search titles and notes, restore completed tasks. |
| **Easy to put away** | Compact strip, 15-minute hide, system tray, and `Ctrl + Alt + Q` to bring it back. |
| **Saved on your computer** | Automatic saves, 30-step undo, JSON backup / restore, daily snapshots. |
| **A comfortable look** | Paper and Night themes, three accent colors and adjustable opacity. |

No account or cloud service. Your list stays on your own computer.

## Getting started

1. Open **[Releases](https://github.com/KennyMcSimpson/qingdan/releases/latest)** and download `Qingdan-1.1.0-windows-x64.zip`.
2. Extract the **entire** archive to a permanent folder.
3. Double-click **`Qingdan.exe`**. Type a task into the bottom input and press Enter.

The runtime is included: **you do not need Node.js or Python** to use the portable app. Keep the files beside the EXE and the `resources` directory together. Copying the EXE alone will not work.

Target platform: **Windows 10 / 11 x64**. The download is about **139 MiB**, including Electron. Your first launch starts with an empty list.

The five tabs are **全部** (All), **DDL** (One-time deadlines), **循环** (Recurring), **常驻** (Persistent reminders), and **完成** (Completed). Click a title to edit; the sliders button beside the bottom input opens the detailed editor. Repository documentation is bilingual; the current app UI is Chinese.

**Upgrading from 1.0:** export a backup in Settings, quit the old app completely, and extract the full new package to a permanent folder. The same `%APPDATA%\Qingdan` folder retains your tasks, notes, completion status and appearance. If start with Windows is enabled, toggle it off and on from the new app to register its path.

### Set a routine once

Open **循环**, enter a task and press Enter. Choose **每天** (Daily), **工作日** (Monday–Friday), or **每周** (Weekly), then set the first date and local time. For weekly reminders, the selected date determines the weekday.

Each occurrence reminds you once at the chosen time. Completing it records that occurrence and schedules the next. New periods roll forward even without completion, so missed days do not accumulate. Weekdays do not include a public-holiday calendar. Use persistent reminders for notes that should remain visible; use recurring tasks for timed routines.

### A little color before time runs out

| State | Default threshold | Appearance |
| --- | --- | --- |
| 🟢 Plenty of time | More than 3 days left | Soft green, remaining time, exact date |
| 🟡 Approaching | More than 24 hours, up to 3 days | Amber |
| 🟠 Urgent | Up to 24 hours left | Orange |
| 🔴 Overdue | Deadline reached or passed | Red, with elapsed time |
| 🌿 Persistent reminder | No deadline | A soft accent color |

Choose an approaching threshold of **1 / 3 / 7 / 14 days** and an urgent threshold of **6 / 12 / 24 hours** in Settings. Urgency wins when thresholds overlap. Colors refresh every 15 seconds while visible and when the window is shown again.

Dates use your computer's local time zone. The default time is 23:59 on the selected date. Deadlines are saved as exact instants and displayed in the local time zone when you travel.

### When you need a little more space

After switching to another window, Qingdan defaults to tucking against the nearest screen edge in about a second, becoming a **46-pixel-wide tab**. The tab displays a count and warning color; click to expand. Editing and native backup dialogs prevent automatic tucking. You can disable it in Settings.

The header dock button tucks immediately. The moon button hides the app for **15 minutes**, then returns only the edge tab. You can recall it sooner from the tray or shortcut.

<p align="center"><img src="docs/images/compact.png" width="404" alt="The compact strip keeps the nearest deadline visible" /></p>

The compact strip keeps the nearest deadline and its warning color visible. Click it to expand. Persistent reminders stay until you archive them manually.

| Shortcut | Action |
| --- | --- |
| `Ctrl + Alt + Q` | Show / hide the window |
| `Ctrl + N` | Open the detailed editor |
| `Ctrl + F` | Search titles and notes |
| `Ctrl + Z` | Undo the last action; inside inputs, undo typing |
| `Esc` | Close the editor, settings, or search |

## Your data, on your computer

- Data folder: `%APPDATA%\Qingdan`. Open it directly from Settings.
- Every change is saved automatically. The previous write and up to 20 snapshots are retained.
- Export a JSON backup and restore it on another computer. Restore asks for confirmation, backs up the current list first, and can be undone.
- Share the portable app with a friend: **your personal list is not copied with the application folder**.
- Start with Windows is off by default. Closing the window hides it in the tray; use the tray menu or Settings to quit completely.
- Undo covers the most recent 30 changes in this session. Up to 5,000 records, 160 characters per title and 5,000 characters per note are supported.

Notifications work only while the app is running, including while hidden in the tray. They do not wake it after it has been quit or the computer shut down. Windows may suppress system notifications; in-window deadline colors remain available.

## Run from source

Install Node.js 24 and npm, then clone this repository:

```sh
npm ci
npm start
```

Use `npm test` for core tests, or `npm run test:ui` for the full Electron suite in an available desktop session.

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for development and packaging. There are no third-party JavaScript runtime dependencies; Electron and the other dependencies support the desktop environment, development, testing and packaging.

## Verification and releases

Core tests cover recurring dates, notification deduplication, legacy data, window geometry and recovery. GitHub Actions runs real Electron interactions on Windows and Linux and builds the portable Windows package. See [VALIDATION.md](VALIDATION.md) for exact results and scope.

Automation does not replace feedback from every Windows device. Notification policies, startup registration, Chinese input methods and multi-monitor DPI still need local confirmation. This release is unsigned and has no automatic updater.

[Changelog](CHANGELOG.md) · [Feedback](https://github.com/KennyMcSimpson/qingdan/issues)

## License and acknowledgments

The source, application mark and vector illustrations use the [MIT License](LICENSE). Electron and Chromium notices are included in the portable distribution.

Open-source desktop task tools informed the interaction design. Qingdan's interface, logic and art were independently implemented; see [REFERENCES.md](REFERENCES.md).

<p align="center"><sub>轻一点，把重要的事留在桌边。<br />Keep the important things within sight.</sub></p>
