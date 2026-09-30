# 轻单 1.1 验证记录 / Verification

日期 / Date：2026-09-30。应用 / App：1.1.0，Electron 44.4.5。

## 核心逻辑 / Core logic — 29 项通过

本地及 GitHub Actions 的 Windows、Linux 中运行核心测试。覆盖：

- DDL 的准确阈值、预警颜色、自定义范围与剩余时间。
- 增删改、完成 / 恢复、查询、类型转换、非法输入和设置白名单。
- 日循环、工作日跳过周末、周循环、提前完成、错过多期的更新、提醒时刻与每期去重。
- 跨月及夏令时的本机日历运算；1.0 数据、备注、完成状态与外观设置的兼容。
- 负坐标副屏、贴边尺寸、显示器移除后的可达窗口位置。
- 中文多行 JSON、原子写入失败保留、损坏文件恢复、异常数据保留和快照。

The 29 checks cover deadlines, state transitions, recurring calendars, once-per-occurrence reminders, legacy data, edge geometry, atomic saves and recovery.

## 原生 Electron 窗口 / Native Electron — 每个平台 23 项通过

[验证运行](https://github.com/KennyMcSimpson/qingdan/actions/runs/36710181986)：Windows runner（Windows Server 2025）和 Ubuntu + Xvfb 分别启动实际 Electron，使用真实 IPC 和临时测试数据；两边均无 renderer JavaScript 错误。

原始结果：[Windows](docs/validation/windows-1.1.0.json) · [Linux](docs/validation/linux-1.1.0.json)。

覆盖空清单、中文回车 / 输入法组合事件保护、DDL 与备注、常驻归档、完成 / 撤销、删除 / 恢复、文本搜索、HTML 形状文本保持纯文本、主题保存、原生置顶、折叠尺寸、退出重启、导出 / 确认导入 / 撤销、隐藏后可唤回、DDL 颜色、循环编辑 / 完成本次 / 撤销、顶部常驻区、原生 46×164 贴边窗口与展开恢复、失焦自动收起与编辑保护、短时隐藏与提前唤回，以及 340×420 最小布局。

The same 23 interactions pass on both runners with real windows and IPC. Reports list each check. Native focus changes exercise automatic tucking; an open editor retains unsaved input. The minimum-size list keeps usable space and the editor's save button stays inside the window.

备份检查预设原生文件对话框的选择结果，随后执行真实文件读写、IPC 与确认流程。输入法检查合成 composition 事件。隐藏计时检查将测试时钟缩短，不等待 15 分钟。

Backup checks stub file selections, then exercise actual file I/O and IPC. IME checks synthesize composition events. The temporary-hide test shortens its timer.

## 外观 / Visual inspection

逐张检查 Windows 实际截图：暖纸、夜色、循环编辑器、顶部常驻区、贴边标签、小条与最小窗口。截图使用演示记录；正式包首次运行不预置任务。清单较长时滚动，常驻区保留在顶部；小窗口中压缩标题区、限制常驻区高度，避免挤没任务列表。

Actual Windows screenshots were inspected. Long lists scroll while the shelf stays above them. Small windows use a compact header and a bounded shelf.

## Windows 打包 / Packaging

CI 构建前对照官方发布的 SHASUMS256.txt 校验 Windows x64 Electron ZIP。运行包 SHA-256：`11c395820a5aaa8ebcc0686b476d0ac98a730274ebfbdc8cf5538a7c2815cb5d`。

品牌 EXE 的图标、产品名称及 1.1.0 版本资源由构建脚本写入并重新解析；应用数据不在分发包内。运行环境、源码、说明和 Electron / Chromium 许可证保留。ZIP 执行完整 CRC 检查，逐文件哈希在包内 SHA256-MANIFEST.json，下载文件哈希随 Release 提供。

The portable build verifies the official runtime checksum, brands the executable, retains licenses, runs a full ZIP CRC check, and emits file and archive checksums. End users do not need development tools.

## 实际范围 / Remaining device checks

Windows 自动化使用托管 Windows Server，不等同于所有 Windows 10 / 11 电脑上的验收。系统通知是否显示、开机启动注册、全局快捷键冲突、真实中文输入法、节假日需求、多显示器高 DPI 仍需具体设备反馈。

Windows automation uses a hosted Server desktop. It does not establish acceptance on every Windows 10 / 11 device. Notification policies, startup, shortcuts, actual IMEs and multi-monitor DPI need device feedback.

循环提醒依赖进程运行和本机时间；退出 / 关机后不唤醒。工作日仅为周一至周五。没有商业代码签名或自动更新器。Linux 测试模式仅跳过容器无法使用的单实例锁；Windows 生产路径始终启用单实例锁。
