# Qingdan (now Edgewise) 1.1 Verification Record

Date: 2026-09-30. App: 1.1.0, Electron 44.4.5.

## Core Logic — 29 Checks Passed

Core unit tests ran locally and on GitHub Actions across Windows and Linux, covering:

- Exact deadline thresholds, urgency warning colors, custom ranges, and remaining-time formatting.
- Create/edit/delete operations, completion and restore, filtering/search queries, type conversions, invalid input handling, and settings allowlists.
- Daily recurrence, weekday recurrence skipping weekends, weekly recurrence, early completion, automatic roll-forward across multiple missed periods, reminder times, and once-per-occurrence deduplication.
- Local calendar arithmetic across month boundaries and DST transitions; compatibility with 1.0 data, notes, completion states, and appearance settings.
- Negative-coordinate secondary monitors, edge-tab geometry, and reachable window positioning after monitor removal.
- Multiline UTF-8/CJK JSON persistence, state preservation on atomic write failure, corrupt file recovery, retention of damaged copies, and rolling snapshots.

## Native Electron — 23 Checks Passed per Platform

[Verification run](https://github.com/KennyMcSimpson/qingdan/actions/runs/36710181986): both the Windows runner (`Windows Server 2025`) and Ubuntu + Xvfb launched real Electron windows with real IPC and temporary test data; neither platform reported any renderer JavaScript errors.

Raw reports: [Windows](docs/validation/windows-1.1.0.json) · [Linux](docs/validation/linux-1.1.0.json).

Covered interactions include empty-list rendering, Enter / IME composition event protection, deadlines and notes, persistent reminder archiving, completion / undo, deletion / restore, text search, HTML-like text remaining plain text, theme persistence, native always-on-top, compact strip dimensions, quit and relaunch, export / confirmed import / undo, restoring after hiding, deadline colors, recurring editor / complete occurrence / undo, top persistent reminder shelf, native 46×164 edge-tab window and expansion restore, automatic tucking on blur with open-editor protection (unsaved input preserved), temporary hide with early recall, and the 340×420 minimum layout (where the task list retains usable space and the editor save button stays inside the window).

Backup checks stub native file-dialog selections and then exercise actual file I/O, IPC, and confirmation flows. IME checks synthesize composition events. The temporary-hide test shortens its timer instead of waiting 15 minutes.

## Visual Inspection

Actual Windows screenshots were inspected individually across Paper theme, Night theme, recurring editor, top persistent shelf, edge tab, compact strip, and minimum window size. Screenshots use demonstration data; release builds do not preload tasks on first launch. Long lists scroll while the reminder shelf stays anchored above them; small windows use a compact header and a bounded shelf height so the task list is never squeezed out.

## Windows Packaging

Before building, CI verifies the Windows x64 Electron ZIP against the official `SHASUMS256.txt`. Runtime package SHA-256: `11c395820a5aaa8ebcc0686b476d0ac98a730274ebfbdc8cf5538a7c2815cb5d`.

The build script embeds and re-parses the branded executable icon, product name, and 1.1.0 version resources; user application data is excluded from the distribution. Runtime files, source, documentation, and Electron / Chromium licenses are retained. A full ZIP CRC check validates the archive, per-file hashes are recorded in `SHA256-MANIFEST.json`, and archive checksums are published with the release. End users do not need development tools.

## Scope & Remaining Device Checks

Windows automation runs on a hosted Windows Server desktop and does not establish acceptance across every Windows 10 / 11 machine. System notification policies, login-item startup registration, global shortcut conflicts, real IME input, public-holiday needs, and multi-monitor high-DPI setups still require physical device feedback.

Recurring reminders depend on the running process and the local system clock; they do not wake the app after exit or shutdown. Weekdays cover Monday through Friday only. Builds have no commercial code signing or auto-updater. Linux test mode skips only the single-instance lock unavailable in containers; the Windows production path always enables the single-instance lock.
