'use strict';
const $ = id => document.getElementById(id);
const M = window.QingdanModel;
const icons = {
  pin:'<path d="m9 3 6 0-1 6 3 4H7l3-4-1-6ZM12 13v7"/>',
  collapse:'<path d="M5 8h14M8 16l4-4 4 4"/>', expand:'<path d="M5 6h14M8 12l4 4 4-4"/>',
  minus:'<path d="M6 12h12"/>', x:'<path d="m6 6 12 12M18 6 6 18"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  star:'<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9Z"/>',
  leaf:'<path d="M20 4C5 1 1 11 7 17s17 0 13-13Z"/><path d="M4 21 16 9"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6M14 10v6"/>',
  undo:'<path d="M8 5 3 10l5 5M3 10h11a5 5 0 0 1 0 10h-3"/>',
  sliders:'<path d="M4 7h5m4 0h7M4 17h10m4 0h2M9 4v6M14 14v6"/>',
  settings:'<path d="m9 3-1 3-3 1-2 4 2 3 1 4 4 2 4-1 3-2 2-4-1-4-3-2-2-4Z"/><circle cx="11.8" cy="11.7" r="3.2"/>',
  export:'<path d="M12 15V3m-4 4 4-4 4 4M5 13v7h14v-7"/>',
  import:'<path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"/>'
};
function icon(name) { const holder = document.createElement('span'); holder.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (icons[name] || icons.plus) + '</svg>'; return holder.firstElementChild; }
function fillIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(node => node.replaceChildren(icon(node.dataset.icon))); }
function el(tag, className, text) { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; }
let state, current = {}, tab = 'all', query = '', editId = null, editKind = 'task', toastTimer, lastFocus, busy = false;
let suppressClickUntil = 0;
const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
const pad = n => String(n).padStart(2,'0');
const localDate = d => d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
function fullDate(iso) { const d = new Date(iso); return (d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + '/' : '') + pad(d.getMonth()+1) + '/' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function setIcon(id,name) { $(id).replaceChildren(icon(name)); }
function accept(data) {
  if (data.error) throw new Error(data.error);
  if (data.state) { current = data; state = data.state; render(); }
  return data;
}
function errorMessage(error) {
  $('saveStatus').className = 'save-error'; $('saveStatus').replaceChildren(document.createTextNode('操作未保存 · 请重试'));
  if ($('editorDialog').open) { $('editorError').textContent = error.message; $('editorError').hidden = false; }
  else if ($('settingsDialog').open) { $('settingsError').textContent = error.message; $('settingsError').hidden = false; renderSettings(); }
  else toast(error.message || '操作失败，请重试。', false, true);
}
async function act(action, message) {
  if (busy) return null;
  busy = true; $('saveStatus').className = 'saving'; $('saveStatus').textContent = '正在保存…';
  try { const data = accept(await window.qingdan.action(action)); if (message) toast(message, action.type !== 'settings'); return data; }
  catch(error) { errorMessage(error); return null; }
  finally { busy = false; }
}
async function command(name,value) {
  try { return accept(await window.qingdan.command(name,value)); } catch(error) { errorMessage(error); return null; }
}
function toast(text, undo = false, error = false) {
  clearTimeout(toastTimer); $('toastText').textContent = text; $('toastUndo').hidden = !undo; $('toast').classList.toggle('error',error); $('toast').hidden = false;
  toastTimer = setTimeout(() => $('toast').hidden = true, error ? 12000 : 6000);
}
function render() {
  if (!state) return;
  const now = Date.now(), today = new Date(now);
  document.documentElement.dataset.theme = state.settings.theme; document.documentElement.dataset.accent = state.settings.accent;
  $('pinButton').classList.toggle('active',state.settings.alwaysOnTop);
  $('pinButton').title = state.settings.alwaysOnTop ? '已置顶 · 点击取消' : '点击始终置顶';
  $('pinButton').setAttribute('aria-label',state.settings.alwaysOnTop ? '取消置顶' : '始终置顶');
  $('pinButton').setAttribute('aria-pressed',String(state.settings.alwaysOnTop));
  $('fullView').hidden = !!current.collapsed; $('compactView').hidden = !current.collapsed;
  setIcon('collapseButton',current.collapsed ? 'expand' : 'collapse');
  $('collapseButton').title = current.collapsed ? '展开清单' : '收成小条'; $('collapseButton').setAttribute('aria-label',$('collapseButton').title);
  const active = state.tasks.filter(t => !t.completedAt), tasks = active.filter(t => t.kind === 'task'), sticky = active.filter(t => t.kind === 'sticky'), done = state.tasks.filter(t => t.completedAt);
  const dueTasks = tasks.filter(t => t.dueAt).sort((a,b) => Date.parse(a.dueAt)-Date.parse(b.dueAt));
  const next = dueTasks[0] || tasks.find(t => t.important) || tasks[0] || sticky[0];
  const d = next ? M.deadline(next,state.settings,now) : { level:'none', text:'' };
  $('compactTitle').textContent = next ? next.title : '今天，给自己留点余地。';
  $('compactMeta').textContent = next ? (d.text || '随时开始') + ' · ' + active.length + ' 件在清单里' : '清单空空，心里轻轻。点击展开';
  $('compactView').dataset.level = d.level;
  $('todayDate').textContent = (today.getMonth()+1) + ' 月 ' + today.getDate() + ' 日 · ' + weekdays[today.getDay()];
  $('activeCount').textContent = tasks.length;
  const overdue = tasks.filter(t => M.deadline(t,state.settings,now).level === 'overdue').length;
  const near = tasks.filter(t => ['soon','urgent'].includes(M.deadline(t,state.settings,now).level)).length;
  const todayDone = done.filter(t => localDate(new Date(t.completedAt)) === localDate(today)).length;
  $('nearSummary').textContent = overdue ? overdue + ' 件已逾期' + (near ? ' · ' + near + ' 件临近' : '') : near ? near + ' 件快到时间了' : todayDone ? '今天已完成 ' + todayDone + ' 件，很棒。' : '把重要的事，留在桌边';
  $('nearSummary').classList.toggle('attention', !!(overdue || near));
  for (const [id,number] of [['countAll',active.length],['countDdl',dueTasks.length],['countSticky',sticky.length],['countDone',done.length]]) $(id).textContent = number;
  document.querySelectorAll('[data-tab]').forEach(button => { button.classList.toggle('active',button.dataset.tab === tab); button.setAttribute('aria-pressed',String(button.dataset.tab === tab)); });
  renderList(now);
  $('deadlineLegend').hidden = !dueTasks.length || tab === 'sticky' || tab === 'done';
  $('quickInput').placeholder = tab === 'sticky' ? '写下一条长期提醒，回车记下…' : '写下一件事，回车记下…';
  $('undoButton').disabled = !current.canUndo;
  $('saveStatus').className = ''; const dot = el('i'); $('saveStatus').replaceChildren(dot,document.createTextNode('已保存在本机'));
  $('recoveryNotice').hidden = !current.notice; $('recoveryNotice').textContent = current.notice || '';
  if ($('settingsDialog').open) renderSettings();
}
function renderList(now = Date.now()) {
  const scroll = $('listArea').scrollTop, fragment = document.createDocumentFragment();
  const groups = M.groups(state.tasks,tab,query,state.settings,now);
  const count = groups.reduce((sum,g) => sum + g.tasks.length,0);
  for (const group of groups) {
    if (!group.tasks.length) continue;
    const section = el('section','task-group group-' + group.key), heading = el('h2','group-label',group.label);
    heading.append(el('span','group-count',group.tasks.length)); section.append(heading);
    for (const t of group.tasks) {
      const d = M.deadline(t,state.settings,now), row = el('article','task-row' + (t.completedAt ? ' done' : ''));
      row.dataset.id = t.id; row.dataset.level = d.level;
      const check = el('button','task-check' + (t.kind === 'sticky' && !t.completedAt ? ' sticky' : ''));
      check.type = 'button'; check.title = t.completedAt ? '恢复到清单' : t.kind === 'sticky' ? '编辑长期提醒' : '标记完成';
      check.setAttribute('aria-label',check.title + '：' + t.title);
      if (t.completedAt || t.kind === 'sticky') check.append(icon(t.completedAt ? 'check' : 'pin'));
      check.addEventListener('click',() => {
        if (Date.now() < suppressClickUntil) return;
        suppressClickUntil = Date.now()+220;
        if (t.kind === 'sticky' && !t.completedAt) openEditor(t.id);
        else act({ type:'toggle', id:t.id },t.completedAt ? '已放回清单' : '完成一件，轻一点。');
      });
      const content = el('button','task-content'); content.type = 'button'; content.setAttribute('aria-label','编辑：' + t.title);
      const title = el('span','task-title',t.title);
      if (t.important) { const star = el('span','important-star'); star.title = '重要'; star.append(icon('star')); title.append(star); }
      content.append(title);
      if (t.note) content.append(el('span','task-note',t.note));
      if (t.dueAt && !t.completedAt) {
        const meta = el('span','task-meta'), pill = el('span','due-pill level-' + d.level);
        pill.append(icon('clock'),document.createTextNode(d.text));
        meta.append(pill,el('span','due-date',fullDate(t.dueAt))); content.append(meta);
      } else if (t.kind === 'sticky' && !t.completedAt) {
        const meta = el('span','task-meta'), sticky = el('span','sticky-meta'); sticky.append(icon('leaf'),document.createTextNode('一直在这里')); meta.append(sticky); content.append(meta);
      } else if (t.completedAt) { content.append(el('span','task-meta',(t.kind === 'sticky' ? '归档于 ' : '完成于 ') + fullDate(t.completedAt))); }
      content.addEventListener('click',() => openEditor(t.id));
      const menu = el('button','row-menu'); menu.title = '编辑 / 删除'; menu.setAttribute('aria-label','更多操作：' + t.title); menu.append(icon('more')); menu.addEventListener('click',() => openEditor(t.id));
      row.append(check,content,menu); section.append(row);
    }
    fragment.append(section);
  }
  $('taskList').replaceChildren(fragment); $('listArea').scrollTop = scroll;
  $('emptyState').hidden = count > 0;
  if (!count) {
    let title = '给重要的事，留个位置。', description = '一个 DDL，一点小提醒。\n写下来，就不用一直记在脑子里。';
    if (query) { title = '暂时没找到这件事。'; description = '换个词试试，标题和备注都能搜。'; }
    else if (tab === 'done') { title = '完成的小事，也值得记录。'; description = '点一下待办前的小方框，\n完成的事情就会来到这里。'; }
    else if (tab === 'ddl') { title = '暂时没有倒计时。'; description = '给待办加个截止时间，\n临近时，轻单会自动变色提醒。'; }
    else if (tab === 'sticky') { title = '有些事，值得一直记着。'; description = '长期目标、日常叮嘱、注意事项。\n没有期限，也有自己的位置。'; }
    $('emptyTitle').textContent = title; $('emptyDescription').replaceChildren(...description.split('\n').flatMap((s,i) => i ? [el('br'),document.createTextNode(s)] : [document.createTextNode(s)]));
    $('emptyAdd').hidden = !!query || tab === 'done';
    $('emptyAdd').replaceChildren(document.createTextNode(tab === 'sticky' ? '记一条长期提醒 ' : '记下一件事 '),icon('arrow'));
  }
}
function setKind(kind) {
  editKind = kind; $('kindTask').classList.toggle('selected',kind === 'task'); $('kindSticky').classList.toggle('selected',kind === 'sticky');
  $('kindTask').setAttribute('aria-pressed',String(kind === 'task')); $('kindSticky').setAttribute('aria-pressed',String(kind === 'sticky'));
  $('ddlControls').hidden = kind === 'sticky'; $('stickyHint').hidden = kind !== 'sticky';
}
function dateFields() { $('dateFields').hidden = !$('hasDue').checked; $('dueDate').required = $('hasDue').checked && editKind === 'task'; previewDate(); }
function editorDue() {
  if (editKind === 'sticky' || !$('hasDue').checked) return null;
  if (!$('dueDate').value) throw new Error('请选择截止日期。');
  const time = $('dueTime').value || '23:59';
  const d = new Date($('dueDate').value + 'T' + time + ':00');
  if (!Number.isFinite(d.getTime())) throw new Error('截止时间不正确，请重新选择。');
  return d.toISOString();
}
function previewDate() {
  try { const dueAt = editorDue(); if (!dueAt) return; const d = M.deadline({ dueAt },state.settings); $('duePreview').textContent = d.text + ' · ' + (d.level === 'overdue' ? '这个日期已经过去了' : '到时间前会自动变色'); $('duePreview').className = 'due-preview'; $('duePreview').dataset.level = d.level; }
  catch(_) { $('duePreview').textContent = ''; }
}
function openEditor(id = null, initial = '') {
  if (!state) return;
  if (current.collapsed) command('collapse',false);
  if ($('settingsDialog').open) $('settingsDialog').close();
  const t = id ? state.tasks.find(t => t.id === id) : null; if (id && !t) return;
  editId = id; lastFocus = document.activeElement;
  $('editorHeading').textContent = id ? '再整理一下' : '记一件事';
  $('taskTitle').value = t ? t.title : initial;
  $('taskNote').value = t ? t.note : '';
  $('taskImportant').checked = t ? t.important : false;
  $('hasDue').checked = !!(t && t.dueAt) || (!t && tab === 'ddl');
  const date = t && t.dueAt ? new Date(t.dueAt) : new Date();
  $('dueDate').value = localDate(date); $('dueTime').value = t && t.dueAt ? pad(date.getHours()) + ':' + pad(date.getMinutes()) : '23:59';
  setKind(t ? t.kind : tab === 'sticky' ? 'sticky' : 'task'); dateFields();
  $('editActions').hidden = !t; $('completeTask').textContent = t && t.completedAt ? '恢复到清单' : t && t.kind === 'sticky' ? '归档这条提醒' : '标记完成';
  $('saveTask').replaceChildren(document.createTextNode(id ? '保存修改 ' : '记下来 '),icon('arrow'));
  $('saveTask').disabled = false; $('editorError').hidden = true;
  $('editorDialog').showModal(); $('editorDialog').querySelector('.sheet-body').scrollTop = 0;
  setTimeout(() => { $('taskTitle').focus(); if (!id) $('taskTitle').setSelectionRange($('taskTitle').value.length,$('taskTitle').value.length); },60);
}
function closeEditor() { $('editorDialog').close(); editId = null; if (lastFocus && lastFocus.isConnected) lastFocus.focus(); }
function renderSettings() {
  const s = state.settings;
  document.querySelectorAll('[data-theme]').forEach(n => { if (n.tagName === 'BUTTON') n.classList.toggle('selected',n.dataset.theme === s.theme); });
  document.querySelectorAll('[data-accent]').forEach(n => { if (n.tagName === 'BUTTON') n.classList.toggle('selected',n.dataset.accent === s.accent); });
  for (const id of ['reminders','alwaysOnTop','launchOnStartup']) $(id).checked = s[id];
  $('warnDays').value = s.warnDays; $('urgentHours').value = s.urgentHours;
  if (document.activeElement !== $('opacityRange')) $('opacityRange').value = Math.round(s.opacity * 100);
  $('opacityValue').textContent = Math.round(s.opacity * 100) + '%';
  $('clearButton').disabled = !state.tasks.some(t => t.completedAt);
  $('shortcutHint').textContent = current.shortcutAvailable ? 'Ctrl + Alt + Q 唤回 / 隐藏 · Ctrl + N 新建' : 'Ctrl + Alt + Q 被其他程序占用，可点托盘图标唤回。';
}
function showSearch() { $('searchRow').hidden = false; $('searchInput').focus(); }
function closeSearch() { query = ''; $('searchInput').value = ''; $('searchRow').hidden = true; renderList(); }
fillIcons();
$('pinButton').addEventListener('click',() => act({ type:'settings', settings:{ alwaysOnTop:!state.settings.alwaysOnTop } }));
$('collapseButton').addEventListener('click',() => command('collapse',!current.collapsed));
$('compactView').addEventListener('click',() => command('collapse',false));
$('hideButton').addEventListener('click',() => command('hide'));
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click',() => { tab = button.dataset.tab; $('listArea').scrollTop = 0; render(); }));
$('searchButton').addEventListener('click',showSearch); $('searchClose').addEventListener('click',closeSearch);
$('searchInput').addEventListener('input',event => { query = event.target.value; renderList(); });
$('detailAdd').addEventListener('click',() => openEditor(null,$('quickInput').value.trim()));
$('emptyAdd').addEventListener('click',() => openEditor());
let composing = false;
$('quickInput').addEventListener('compositionstart',() => composing = true);
$('quickInput').addEventListener('compositionend',() => { setTimeout(() => composing = false,0); });
$('quickInput').addEventListener('keydown',event => { if (event.key === 'Enter' && (event.isComposing || event.keyCode === 229 || composing)) event.preventDefault(); });
$('quickForm').addEventListener('submit',async event => {
  event.preventDefault(); if (composing || busy) return;
  const title = $('quickInput').value.trim(); if (!title) { openEditor(); return; }
  if (tab === 'ddl') { openEditor(null,title); return; }
  const result = await act({ type:'add', task:{ title, kind:tab === 'sticky' ? 'sticky' : 'task' } });
  if (result) { $('quickInput').value = ''; if (tab === 'done') { tab = 'all'; render(); } $('quickInput').focus(); }
});
document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click',() => { setKind(button.dataset.kind); dateFields(); }));
$('hasDue').addEventListener('change',dateFields);
for (const id of ['dueDate','dueTime']) $(id).addEventListener('input',previewDate);
document.querySelectorAll('[data-days]').forEach(button => button.addEventListener('click',() => { const d = new Date(); d.setDate(d.getDate()+Number(button.dataset.days)); $('dueDate').value = localDate(d); previewDate(); }));
document.querySelectorAll('.close-editor').forEach(button => button.addEventListener('click',closeEditor));
$('editorDialog').addEventListener('cancel',() => { editId = null; });
$('editorForm').addEventListener('submit',async event => {
  event.preventDefault(); if (busy) return;
  try {
    $('editorError').hidden = true;
    const task = { title:$('taskTitle').value.trim(), note:$('taskNote').value, kind:editKind, dueAt:editorDue(), important:$('taskImportant').checked };
    if (!task.title) throw new Error('先写下这件事的名字吧。');
    $('saveTask').disabled = true;
    const wasEdit = !!editId;
    const result = await act(wasEdit ? { type:'update', id:editId, task } : { type:'add', task });
    if (result) { closeEditor(); $('quickInput').value = ''; if (tab === 'done' && !wasEdit || tab === 'ddl' && task.kind === 'sticky' || tab === 'sticky' && task.kind !== 'sticky') { tab = task.kind === 'sticky' ? 'sticky' : 'all'; render(); } toast(wasEdit ? '修改已保存' : '记下了，留在桌边。',true); }
  } catch(error) { errorMessage(error); }
  finally { $('saveTask').disabled = false; }
});
$('deleteTask').addEventListener('click',async () => { if (editId && await act({ type:'delete', id:editId })) { closeEditor(); toast('已删除这条记录',true); } });
$('completeTask').addEventListener('click',async () => { if (editId && await act({ type:'toggle', id:editId })) { closeEditor(); toast('清单已更新',true); } });
async function undo() { if (await act({ type:'undo' })) toast('已撤销上一步'); }
$('undoButton').addEventListener('click',undo); $('toastUndo').addEventListener('click',undo); $('toastClose').addEventListener('click',() => $('toast').hidden = true);
$('settingsButton').addEventListener('click',() => { $('settingsError').hidden = true; $('settingsDialog').showModal(); renderSettings(); });
$('closeSettings').addEventListener('click',() => $('settingsDialog').close());
document.querySelectorAll('button[data-theme]').forEach(button => button.addEventListener('click',() => act({ type:'settings', settings:{ theme:button.dataset.theme } })));
document.querySelectorAll('button[data-accent]').forEach(button => button.addEventListener('click',() => act({ type:'settings', settings:{ accent:button.dataset.accent } })));
for (const id of ['alwaysOnTop','reminders','launchOnStartup']) $(id).addEventListener('change',() => act({ type:'settings', settings:{ [id]:$(id).checked } }));
for (const id of ['warnDays','urgentHours']) $(id).addEventListener('change',() => act({ type:'settings', settings:{ [id]:Number($(id).value) } }));
$('opacityRange').addEventListener('input',() => $('opacityValue').textContent = $('opacityRange').value + '%');
$('opacityRange').addEventListener('change',() => act({ type:'settings', settings:{ opacity:Number($('opacityRange').value)/100 } }));
$('exportButton').addEventListener('click',async () => { const r = await command('export'); if (r && r.ok) { $('settingsDialog').close(); toast('备份已导出'); } });
$('importButton').addEventListener('click',async () => { const r = await command('import'); if (r && r.ok) { $('settingsDialog').close(); toast('已恢复备份',true); } });
$('folderButton').addEventListener('click',() => command('folder'));
$('clearButton').addEventListener('click',async () => { const r = await command('clear-completed'); if (r && !r.canceled) { $('settingsDialog').close(); toast('已清理完成记录',true); } });
$('quitButton').addEventListener('click',() => command('quit'));
document.addEventListener('keydown',event => {
  if (event.isComposing) return;
  const editable = ['INPUT','TEXTAREA'].includes(document.activeElement.tagName);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); if (!$('editorDialog').open) openEditor(); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !$('editorDialog').open && !$('settingsDialog').open) { event.preventDefault(); if (current.collapsed) command('collapse',false); showSearch(); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !editable && !$('editorDialog').open && !$('settingsDialog').open) { event.preventDefault(); undo(); }
  if (event.key === 'Escape' && !$('editorDialog').open && !$('settingsDialog').open) { if (!$('searchRow').hidden) closeSearch(); $('toast').hidden = true; }
});
if (!window.qingdan) {
  $('emptyState').hidden = false; $('emptyTitle').textContent = '请从轻单程序打开'; $('emptyDescription').textContent = '这是桌面程序的一部分，请双击 Qingdan.exe。'; $('emptyAdd').hidden = true;
} else {
  window.qingdan.read().then(accept).catch(errorMessage);
  window.qingdan.onState(data => { try { accept(data); } catch(error) { errorMessage(error); } });
  window.qingdan.onError(message => errorMessage(new Error(message)));
  window.qingdan.onFocusAdd(() => { if (!$('editorDialog').open && !$('settingsDialog').open) $('quickInput').focus(); });
  // A deadline can change category while the window stays open or after sleep.
  setInterval(() => { if (state && !document.hidden) { render(); if ($('editorDialog').open) previewDate(); } },15000);
  document.addEventListener('visibilitychange',() => { if (!document.hidden && state) render(); });
}
