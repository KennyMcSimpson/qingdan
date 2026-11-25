# Contributing

Real-world Windows device feedback and small, focused improvements are welcome. Open an issue to discuss the problem before starting a large feature.

## Development & Testing

Use Node.js 24 and npm: `npm ci` installs dependencies, `npm start` launches the app, and `npm test` checks core logic. `npm run test:ui` launches a real Electron window using temporary test data and never reads your normal user list. A desktop session is required (Linux can use Xvfb). Override `ELECTRON_BINARY` to specify a custom runtime path. Test screenshots are written to the ignored `qa/` directory.

| Path | Responsibility |
| --- | --- |
| `src/main.js` | Native window, tray, reminders, IPC |
| `src/model.js` | Deadline thresholds, validation, and state transitions |
| `src/layout.js` | Window and edge-tab geometry |
| `src/store.js` | Persistence, backup, and recovery |
| `src/renderer.js` | Task list and editor interactions |
| `src/styles.css` | Themes and styling |
| `assets/` | Original icons and artwork |
| `tests/` | Core and Electron window tests |
| `scripts/` | Windows packaging |

## Building the Windows Portable Package

Packaging requires Python 3 and Pillow. Download the official Windows x64 Electron ZIP matching the version pinned in `package.json` along with `SHASUMS256.txt` from the same release page, then run:

```sh
python scripts/package_windows.py --runtime /path/to/electron-win32-x64.zip --checksums /path/to/SHASUMS256.txt --out release
```

The script verifies the official SHA-256 checksum first, then embeds the executable icon and version metadata, collects app assets and licenses, generates the ZIP archive, and runs a full CRC check. Keep runtimes, personal task lists, logs, and release archives out of Git.

## Pull Requests & Releases

Pull requests should explain the problem, resulting behavior, and verification performed. Keep repository documentation aligned, and use sample data in screenshots. Changes to date handling, persistence, or data migration should include regression tests.

`desktop.yml` runs native Electron checks on Windows and Linux, uploads screenshots and test reports, and builds a checksum-verified Windows ZIP. Publishing a GitHub Release is restricted to `main` pushes whose commit message starts with `release:` when both desktop checks succeed. The version comes from `package.json` and requires matching release notes in `docs/releases/<version>.md`. Regular pushes only run checks and builds.
