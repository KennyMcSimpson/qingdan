# Contributing / 参与改进

## 中文

欢迎 Windows 实际使用反馈和小而明确的改进。较大的功能建议先开 Issue，说明它解决什么问题。

使用 Node.js 24 和 npm：`npm ci` 安装依赖，`npm start` 启动，`npm test` 检查核心逻辑。`npm run test:ui` 启动真实 Electron 窗口，用临时清单测试，不读取正常用户数据；需要桌面会话，Linux 可以使用 Xvfb。可通过 `ELECTRON_BINARY` 指定运行文件，截图写入不提交的 `qa/`。

| 路径 | 职责 / Responsibility |
| --- | --- |
| `src/main.js` | 原生窗口、托盘、提醒、IPC / Native window, tray, reminders, IPC |
| `src/model.js` | 截止分级、校验、状态变更 / Deadline and state logic |
| `src/store.js` | 保存、备份、恢复 / Persistence and recovery |
| `src/renderer.js` | 清单与编辑器交互 / Renderer interactions |
| `src/styles.css` | 主题和样式 / Themes and styles |
| `assets/` | 原创图标与插画 / Original artwork |
| `tests/` | 核心与窗口测试 / Core and UI tests |
| `scripts/` | Windows 打包 / Windows packaging |

构建便携包需要 Python 3 与 Pillow。下载 `package.json` 中固定版本的官方 Electron Windows x64 ZIP，以及同一发布页的 `SHASUMS256.txt`，然后运行：

```sh
python scripts/package_windows.py --runtime /path/to/electron-win32-x64.zip --checksums /path/to/SHASUMS256.txt --out release
```

脚本先校验官方 SHA-256，再写入 EXE 图标和版本、收集资源及许可证，最后生成 ZIP 并检查 CRC。运行环境、个人清单、日志和压缩包不提交到源码仓库。

提交时说明问题、改动后的行为及验证方式；中英文文档保持一致，截图使用演示数据。时间、保存、迁移方面的改动需要能防止真实回归的测试。

## English

Windows device feedback and focused improvements are welcome. Open an issue to discuss the problem before starting a large feature.

Use Node.js 24 and npm: `npm ci` installs dependencies, `npm start` launches the app and `npm test` checks core logic. `npm run test:ui` uses a real Electron window and temporary data, never the normal user list. A desktop session is required; Linux can use Xvfb. Override `ELECTRON_BINARY` for a custom runtime path. Screenshots go to the ignored `qa/` directory.

The table above describes the project layout. For packaging, install Python 3 and Pillow, then download the official Windows x64 Electron ZIP matching the pinned version and its `SHASUMS256.txt`. Run the command above with those file paths. It verifies the runtime checksum before branding the executable, collecting assets and licenses, and checking the completed archive. Keep runtimes, personal lists, logs and release ZIPs out of Git.

Pull requests should explain the problem, resulting behavior and verification. Keep Chinese and English docs aligned; use sample data in screenshots. Date handling, persistence and migration changes should include tests for real regressions.
