'use strict';
const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, nativeImage, globalShortcut, screen, shell, powerMonitor, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const Model = require('./model');
const { Store } = require('./store');

app.setName('Qingdan');
if (process.env.QINGDAN_TEST_DATA) app.setPath('userData', process.env.QINGDAN_TEST_DATA);
else app.setPath('userData', path.join(app.getPath('appData'), 'Qingdan'));
app.setAppUserModelId('com.qingdan.desktop');
// A modest, static utility: software rendering also avoids driver-specific blank windows.
app.disableHardwareAcceleration();
let win, tray, store, state, quitting = false, collapsed = false, normalHeight = 710;
let boundsTimer, reminderTimer, shortcutAvailable = true, archive = [], fatal = false;
const asset = name => path.join(__dirname, '..', 'assets', name);
const page = path.join(__dirname, 'index.html');

function log(error) {
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'error.log'), new Date().toISOString() + ' ' + String(error.stack || error) + '\n'); } catch (_) {}
}
function report(error) { log(error); if (win && !win.isDestroyed()) win.webContents.send('app:error', error.message || String(error)); }
function payload() { return { state, collapsed, dataPath: store.directory, notice: store.notice, shortcutAvailable, canUndo: archive.length > 0 }; }
function broadcast() { if (win && !win.isDestroyed()) win.webContents.send('state:changed', payload()); }
function commit(next, undoable = false) {
  const previous = state;
  const clean = store.write(next);
  if (undoable) { archive.push(structuredClone(previous.tasks)); if (archive.length > 30) archive.shift(); }
  state = clean;
  try { store.snapshot(state); } catch (error) { log(error); }
  broadcast(); updateTray(); return payload();
}
function captureBounds() {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  const b = win.getBounds();
  if (!collapsed) normalHeight = b.height;
  state.window = { ...b, collapsed, expandedHeight: normalHeight };
}
function saveBounds() {
  if (quitting || fatal) return;
  captureBounds();
  try { state = store.write(state); } catch(error) { report(error); }
}
function visibleBounds(b, isCollapsed = false) {
  const proposed = { x: Number.isFinite(b.x) ? b.x : 0, y: Number.isFinite(b.y) ? b.y : 0, width: b.width || 404, height: b.height || 710 };
  const area = Number.isFinite(b.x) ? screen.getDisplayMatching(proposed).workArea : screen.getPrimaryDisplay().workArea;
  const width = Math.min(area.width, Math.max(340, Math.min(700, proposed.width)));
  const height = Math.min(area.height, isCollapsed ? 132 : Math.max(420, Math.min(1100, proposed.height)));
  return { width, height, x: Math.max(area.x, Math.min(area.x + area.width - width, Number.isFinite(b.x) ? b.x : area.x + area.width - width - 28)),
    y: Math.max(area.y, Math.min(area.y + area.height - height, Number.isFinite(b.y) ? b.y : area.y + 40)) };
}
function show(focusAdd = false) {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.setBounds(visibleBounds(win.getBounds(), collapsed)); win.show(); win.focus();
  if (focusAdd) { if (collapsed) setCollapsed(false); win.webContents.send('focus:add'); }
}
function setCollapsed(value) {
  const next = !!value;
  if (next === collapsed) return payload();
  const b = win.getBounds();
  if (next) normalHeight = b.height;
  collapsed = next;
  win.setMinimumSize(340, next ? 132 : 420);
  win.setMaximumSize(700, next ? 132 : 1100);
  win.setBounds(visibleBounds({ ...b, height: next ? 132 : normalHeight }, next));
  captureBounds(); commit(state); return payload();
}
function applyNativeSettings(previous = state.settings) {
  win.setAlwaysOnTop(state.settings.alwaysOnTop);
  win.setOpacity(state.settings.opacity);
  win.setBackgroundColor(state.settings.theme === 'dark' ? '#242823' : '#f8f7f2');
  if (process.platform === 'win32' && previous.launchOnStartup !== state.settings.launchOnStartup) {
    app.setLoginItemSettings({ openAtLogin: state.settings.launchOnStartup, path: process.execPath, args: ['--startup'] });
  }
}
function updateSettings(patch) {
  const previous = state.settings;
  const next = Model.apply(state, { type: 'settings', settings: patch }, crypto.randomUUID);
  // Apply startup before declaring success, and revert on persistence failure.
  if (process.platform === 'win32' && previous.launchOnStartup !== next.settings.launchOnStartup) {
    app.setLoginItemSettings({ openAtLogin: next.settings.launchOnStartup, path: process.execPath, args: ['--startup'] });
  }
  try { commit(next); } catch (error) {
    if (process.platform === 'win32' && previous.launchOnStartup !== next.settings.launchOnStartup) app.setLoginItemSettings({ openAtLogin: previous.launchOnStartup, path: process.execPath, args: ['--startup'] });
    throw error;
  }
  applyNativeSettings(state.settings); return payload();
}
function updateTray() {
  if (!tray || tray.isDestroyed()) return;
  const count = state.tasks.filter(t => !t.completedAt && t.kind === 'task').length;
  tray.setToolTip('轻单 · ' + count + ' 件待办');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开轻单', click: () => show() }, { label: '新记一件事', click: () => show(true) },
    { type: 'separator' },
    { label: '始终置顶', type: 'checkbox', checked: state.settings.alwaysOnTop, click: item => { try { updateSettings({ alwaysOnTop: item.checked }); } catch(e) { report(e); } } },
    { label: collapsed ? '展开窗口' : '收成小条', click: () => { try { setCollapsed(!collapsed); show(); } catch(e) { report(e); } } },
    { label: '开机启动', type: 'checkbox', checked: state.settings.launchOnStartup, enabled: process.platform === 'win32', click: item => { try { updateSettings({ launchOnStartup: item.checked }); } catch(e) { report(e); } } },
    { type: 'separator' }, { label: '退出轻单', click: () => app.quit() }
  ]));
}
function notifyDue() {
  if (!state || !tray) return;
  const candidates = Model.reminderCandidates(state);
  if (!candidates.length) return;
  const next = structuredClone(state);
  for (const x of candidates) next.notices[x.task.id] = x.key;
  try {
    const content = candidates.slice(0,3).map(x => x.task.title.slice(0,50) + ' · ' + x.deadline.text).join('\n');
    if (process.platform === 'win32') tray.displayBalloon({ title: '轻单 · ' + candidates.length + ' 件事需要留意', content, icon: nativeImage.createFromPath(asset('icon.png')), respectQuietTime: true });
    else if (!process.env.QINGDAN_TEST_DATA) { const { Notification } = require('electron'); if (Notification.isSupported()) { const n = new Notification({ title: '轻单 · 截止提醒', body: content }); n.on('click', () => show()); n.show(); } }
    commit(next);
  } catch(e) { report(e); }
}
async function exportBackup() {
  const result = await dialog.showSaveDialog(win, { title: '导出轻单备份', defaultPath: '轻单备份-' + new Date().toISOString().slice(0,10) + '.json', filters: [{ name:'轻单备份', extensions:['json'] }] });
  if (result.canceled) return { canceled: true };
  fs.writeFileSync(result.filePath, JSON.stringify({ ...state, format: 'QingdanBackup', exportedAt: new Date().toISOString(), window: {}, notices: {} }, null, 2), 'utf8');
  return { ok: true };
}
async function importBackup() {
  const result = await dialog.showOpenDialog(win, { title: '选择轻单备份', properties:['openFile'], filters:[{ name:'轻单备份', extensions:['json'] }] });
  if (result.canceled) return { canceled: true };
  const file = result.filePaths[0];
  if (fs.statSync(file).size > 32 * 1024 * 1024) throw new Error('备份文件过大，请选择不超过 32 MB 的轻单备份。');
  const imported = Model.validateState(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/,'')));
  const answer = await dialog.showMessageBox(win, { type:'question', title:'恢复备份', message:'用备份中的 ' + imported.tasks.length + ' 条记录替换当前清单？', detail:'当前清单会先自动备份。恢复后也可以撤销。窗口和外观设置保持你的选择。', buttons:['取消','恢复备份'], defaultId:0, cancelId:0 });
  if (answer.response !== 1) return { canceled: true };
  store.snapshot(state, 'before-import');
  commit({ ...state, tasks: imported.tasks, notices:{} }, true);
  return { ok: true, ...payload() };
}
function authorize(event) {
  if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('无效的窗口请求。');
}
function bindIPC() {
  const handler = (channel, fn) => ipcMain.handle(channel, async (event,...args) => { try { authorize(event); return await fn(...args); } catch(error) { log(error); return { error: error.message || '操作失败，请重试。' }; } });
  handler('state:read', () => payload());
  handler('state:action', action => {
    if (!action || typeof action !== 'object') throw new Error('操作无效。');
    if (action.type === 'settings') return updateSettings(action.settings);
    if (action.type === 'undo') {
      if (!archive.length) return payload();
      const tasks = archive[archive.length - 1];
      const next = { ...state, tasks, notices:{} };
      state = store.write(next); archive.pop(); broadcast(); updateTray(); return payload();
    }
    return commit(Model.apply(state, action, crypto.randomUUID), true);
  });
  handler('window:command', async (name,value) => {
    if (name === 'hide') { if (tray) win.hide(); else win.minimize(); return { ok:true }; }
    if (name === 'collapse') return setCollapsed(value);
    if (name === 'export') return exportBackup();
    if (name === 'import') return importBackup();
    if (name === 'folder') { const error = await shell.openPath(store.directory); if (error) throw new Error(error); return { ok:true }; }
    if (name === 'quit') { app.quit(); return { ok:true }; }
    if (name === 'clear-completed') {
      const count = state.tasks.filter(t => t.completedAt).length;
      if (!count) return { canceled:true };
      const choice = await dialog.showMessageBox(win, { type:'question', title:'清理已完成', message:'清理 ' + count + ' 条已完成 / 已归档记录？', detail:'操作后可以撤销，也会保留本地备份。', buttons:['保留','清理'], defaultId:0, cancelId:0 });
      if (choice.response !== 1) return { canceled:true };
      store.snapshot(state,'before-clear');
      return commit({ ...state, tasks:state.tasks.filter(t => !t.completedAt) }, true);
    }
    throw new Error('未知的窗口操作。');
  });
}
function createWindow() {
  collapsed = state.window.collapsed === true;
  normalHeight = state.window.expandedHeight || 710;
  const bounds = visibleBounds({ ...state.window, height: collapsed ? 132 : state.window.height || normalHeight }, collapsed);
  win = new BrowserWindow({ ...bounds, minWidth:340, minHeight:collapsed ? 132 : 420, maxWidth:700, maxHeight:collapsed ? 132 : 1100,
    title:'轻单', frame:false, resizable:true, maximizable:false, fullscreenable:false, show:false,
    alwaysOnTop:state.settings.alwaysOnTop, backgroundColor:state.settings.theme === 'dark' ? '#242823' : '#f8f7f2',
    icon:asset('icon.png'), autoHideMenuBar:true,
    webPreferences:{ preload:path.join(__dirname,'preload.js'), contextIsolation:true, nodeIntegration:false, sandbox:true, spellcheck:false } });
  win.setOpacity(state.settings.opacity);
  win.webContents.setWindowOpenHandler(() => ({ action:'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('render-process-gone', (_event,details) => { log(new Error('Renderer stopped: ' + details.reason)); if (!quitting) win.reload(); });
  win.once('ready-to-show', () => { win.show(); });
  win.on('close', event => { if (!quitting) { event.preventDefault(); if (tray) win.hide(); else win.minimize(); } });
  for (const event of ['resize','move']) win.on(event, () => { clearTimeout(boundsTimer); boundsTimer = setTimeout(saveBounds, 650); });
  win.loadFile(page);
}
// The Linux test harness cannot create a Unix-domain singleton socket.
// Windows production always uses the real single-instance lock.
const hasInstanceLock = process.platform !== 'win32' && !!process.env.QINGDAN_TEST_DATA ? true : app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();
else {
  app.on('second-instance', () => show());
  app.whenReady().then(() => {
    try {
      store = new Store(app.getPath('userData')); state = store.load();
      if (process.platform === 'win32') {
        state.settings.launchOnStartup = app.getLoginItemSettings({ path:process.execPath, args:['--startup'] }).openAtLogin;
      }
      session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback) => callback(false));
      session.defaultSession.setPermissionCheckHandler(() => false);
      session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('file:') && !details.url.startsWith('devtools:') && !details.url.startsWith('data:') }));
      Menu.setApplicationMenu(null); bindIPC(); createWindow();
      try {
        tray = new Tray(nativeImage.createFromPath(asset('icon.png')));
        tray.on('click', () => show()); tray.on('double-click', () => show()); tray.on('balloon-click', () => show()); updateTray();
      } catch(error) { log(error); }
      shortcutAvailable = globalShortcut.register('CommandOrControl+Alt+Q', () => { if (win.isVisible() && win.isFocused()) win.hide(); else show(true); });
      reminderTimer = setInterval(notifyDue, 30000);
      setTimeout(notifyDue, 4000);
      powerMonitor.on('resume', notifyDue);
      screen.on('display-removed', () => { win.setBounds(visibleBounds(win.getBounds(), collapsed)); });
    } catch(error) {
      fatal = true; log(error); dialog.showErrorBox('轻单暂时无法启动', error.message); app.quit();
    }
  }).catch(error => { dialog.showErrorBox('轻单启动失败', String(error)); app.quit(); });
  app.on('before-quit', () => {
    if (quitting) return;
    clearTimeout(boundsTimer); clearInterval(reminderTimer);
    if (state && store && !fatal) { captureBounds(); try { store.write(state); } catch(error) { log(error); } }
    quitting = true; globalShortcut.unregisterAll(); if (tray) tray.destroy();
  });
  app.on('window-all-closed', () => { if (quitting) app.quit(); });
  app.on('activate', () => show());
}
