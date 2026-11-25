# Changelog

## 1.1.1 — 2026-10-24

- Fix native Windows always-on-top behavior and tolerate display scaling variance in real window tests.
- Update Electron to 44.9.1 and `undici` to 7.30.1 with security patches.

## 1.1.0 — 2026-09-30

- Add daily, weekday, and weekly recurring reminders at a chosen local time; completing an occurrence records it and schedules the next, while missed periods do not pile up.
- Move persistent reminders to a collapsible top shelf, prioritizing important reminders (showing two by default with one-click access to the rest).
- Add an automatic or manual edge tab and a 15-minute temporary hide; expansion restores previous dimensions, and open editors or native backup dialogs prevent automatic tucking.
- Introduce a denser layout, a dedicated recurring category, and compatibility with 1.0 data and preferences.
- Add native Electron interaction checks on Windows and Linux plus automated Windows packaging; executable version metadata tracks the app version.

## 1.0.0 — 2026-09-27

First public release of Qingdan (now Edgewise): an always-on-top floating window, compact strip, system tray, tasks and persistent reminders, color-coded deadlines, notes and search, Paper / Night themes, local autosave, 30-step undo, and JSON backup and restore. Shipped with a portable Windows x64 distribution and bilingual repository documentation.

Verification: 17 core tests and 17 real Electron interaction checks passed. Initial UI testing used Linux; real Windows device verification was outstanding at launch.
