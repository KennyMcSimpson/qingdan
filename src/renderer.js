'use strict';
const $ = id => document.getElementById(id);
const M = window.EdgewiseModel;
const icons = {
  pin: '<path d="m9 3 6 0-1 6 3 4H7l3-4-1-6ZM12 13v7"/>',
  collapse: '<path d="M5 8h14M8 16l4-4 4 4"/>', expand: '<path d="M5 6h14M8 12l4 4 4-4"/>',
  minus: '<path d="M6 12h12"/>', x: '<path d="m6 6 12 12M18 6 6 18"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  dock: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M16 4v16m-8-8h5m-2-2 2 2-2 2"/>',
  quiet: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',
  repeat: '<path d="M4 8h13l-3-3m3 3-3 3M20 16H7l3 3m-3-3 3-3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  star: '<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9Z"/>',
  leaf: '<path d="M20 4C5 1 1 11 7 17s17 0 13-13Z"/><path d="M4 21 16 9"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6M14 10v6"/>',
  undo: '<path d="M8 5 3 10l5 5M3 10h11a5 5 0 0 1 0 10h-3"/>',
  sliders: '<path d="M4 7h5m4 0h7M4 17h10m4 0h2M9 4v6M14 14v6"/>',
  settings: '<path d="m9 3-1 3-3 1-2 4 2 3 1 4 4 2 4-1 3-2 2-4-1-4-3-2-2-4Z"/><circle cx="11.8" cy="11.7" r="3.2"/>',
  export: '<path d="M12 15V3m-4 4 4-4 4 4M5 13v7h14v-7"/>',
  import: '<path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"/>',
  'eye-off': '<path d="M10.7 5.1A10 10 0 0 1 21 12a10 10 0 0 1-3.3 4.1M6.6 6.6A10 10 0 0 0 3 12a10 10 0 0 0 14.4 5.4M2 2l20 20"/>',
  ghost: '<path d="M9 10h.01M15 10h.01M12 3a7 7 0 0 0-7 7v10l2.5-2 2.25 2L12 18l2.25 2 2.25-2L19 20V10a7 7 0 0 0-7-7Z"/>',
  focus: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  play: '<polygon points="7 5 19 12 7 19 7 5"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  link: '<path d="M14 5h5v5M10 14 19 5M19 14v5H5V5h5"/>'
};
function icon(name) { const holder = document.createElement('span'); holder.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (icons[name] || icons.plus) + '</svg>'; return holder.firstElementChild; }
function fillIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(node => node.replaceChildren(icon(node.dataset.icon))); }
function el(tag, className, text) { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; }

const FOCUS_PRESETS = [15, 25, 45, 60];
const TAB_ORDER = ['all', 'ddl', 'repeat', 'sticky', 'done'];
const TAB_LABELS = { all: 'All', ddl: 'DDL', repeat: 'Repeat', sticky: 'Pinned', done: 'Done' };
function getFocusPresetMins() {
  try {
    const saved = Number(localStorage.getItem('edgewise-focus-mins'));
    if (FOCUS_PRESETS.includes(saved)) return saved;
  } catch (_) {}
  return 25;
}
function setFocusPresetMins(mins) {
  try { localStorage.setItem('edgewise-focus-mins', String(mins)); } catch (_) {}
}

let state, current = {}, tab = 'all', query = '', editId = null, editKind = 'task', toastTimer, lastFocus, busy = false;
let suppressClickUntil = 0;
let quickRawMode = false;
let kbSelectedId = null;
let focusTaskId = null, focusTotalSeconds = getFocusPresetMins() * 60, focusSeconds = focusTotalSeconds, focusEndAt = 0, focusRunning = false, focusTick = null, enteringFocus = false;

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = n => String(n).padStart(2, '0');
const localDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
function fullDate(iso) {
  const d = new Date(iso);
  return (d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + '-' : '') + months[d.getMonth()] + ' ' + d.getDate() + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
function formatTimer(secs) {
  const s = Math.max(0, secs);
  return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
}
function setIcon(id, name) { $(id).replaceChildren(icon(name)); }
function accept(data) {
  if (data.error) throw new Error(data.error);
  if (data.state) { current = data; state = data.state; render(); }
  return data;
}
function errorMessage(error) {
  $('saveStatus').className = 'save-error'; $('saveStatus').replaceChildren(document.createTextNode('Not saved · Try again'));
  if ($('editorDialog').open) { $('editorError').textContent = error.message; $('editorError').hidden = false; }
  else if ($('settingsDialog').open) { $('settingsError').textContent = error.message; $('settingsError').hidden = false; renderSettings(); }
  else toast(error.message || 'Action failed. Please try again.', false, true);
}
async function act(action, message) {
  if (busy) return null;
  busy = true; $('saveStatus').className = 'saving'; $('saveStatus').textContent = 'Saving…';
  try { const data = accept(await window.edgewise.action(action)); if (message) toast(message, action.type !== 'settings'); return data; }
  catch (error) { errorMessage(error); return null; }
  finally { busy = false; }
}
async function command(name, value) {
  try { return accept(await window.edgewise.command(name, value)); } catch (error) { errorMessage(error); return null; }
}
function toast(text, undo = false, error = false) {
  clearTimeout(toastTimer); $('toastText').textContent = text; $('toastUndo').hidden = !undo; $('toast').classList.toggle('error', error); $('toast').hidden = false;
  toastTimer = setTimeout(() => $('toast').hidden = true, error ? 12000 : 6000);
}

function updateFocusProgress() {
  const total = Math.max(1, focusTotalSeconds);
  const elapsed = Math.min(total, Math.max(0, total - focusSeconds));
  const pct = Math.round((elapsed / total) * 1000) / 10;
  $('focusProgressFill').style.width = pct + '%';
}
function updateFocusTimerMeta() {
  $('focusTimer').title = focusRunning ? 'Pause timer to switch duration (15 / 25 / 45 / 60m)' : 'Click to cycle duration (15 / 25 / 45 / 60m)';
  $('focusTimer').setAttribute('aria-label', focusRunning ? 'Focus timer ' + formatTimer(focusSeconds) : 'Focus duration ' + formatTimer(focusSeconds) + ', click to cycle preset');
}
function stopFocusTimer() {
  if (focusTick) { clearInterval(focusTick); focusTick = null; }
  if (focusRunning && focusEndAt) {
    focusSeconds = Math.max(0, Math.ceil((focusEndAt - Date.now()) / 1000));
  }
  focusEndAt = 0;
  focusRunning = false;
  updateFocusProgress();
  updateFocusTimerMeta();
}
function startFocusTimer() {
  stopFocusTimer();
  if (focusSeconds <= 0) {
    focusTotalSeconds = getFocusPresetMins() * 60;
    focusSeconds = focusTotalSeconds;
  }
  focusEndAt = Date.now() + focusSeconds * 1000;
  focusRunning = true;
  $('focusTimer').textContent = formatTimer(focusSeconds);
  updateFocusProgress();
  updateFocusTimerMeta();
  focusTick = setInterval(() => {
    if (!focusTaskId) { stopFocusTimer(); return; }
    focusSeconds = Math.max(0, Math.ceil((focusEndAt - Date.now()) / 1000));
    $('focusTimer').textContent = formatTimer(focusSeconds);
    updateFocusProgress();
    if (focusSeconds <= 0) {
      stopFocusTimer();
      setIcon('focusToggle', 'play');
      const mins = Math.max(1, Math.round(focusTotalSeconds / 60));
      const taskObj = state?.tasks.find(t => t.id === focusTaskId);
      void command('focus-done', taskObj ? 'Completed ' + mins + 'm focus: ' + taskObj.title : mins + '-minute focus session finished.');
      toast('Focus session finished.', false);
    }
  }, 500);
}
async function enterFocus(taskId) {
  if (enteringFocus) return;
  enteringFocus = true;
  try {
    const res = await command('collapse', true);
    if (!res || !res.collapsed) return;
    const fRes = await command('focus-mode', true);
    if (!fRes || !fRes.focusActive || !fRes.collapsed || fRes.tucked) return;
    focusTaskId = taskId;
    focusTotalSeconds = getFocusPresetMins() * 60;
    focusSeconds = focusTotalSeconds;
    startFocusTimer();
    render();
  } finally {
    enteringFocus = false;
  }
}
async function exitFocus(expandWindow = true) {
  stopFocusTimer();
  focusTaskId = null;
  await command('focus-mode', false);
  if (expandWindow && current.collapsed) await command('collapse', false);
  else render();
}

function quickParseOpts() {
  return tab === 'repeat' ? { defaultRepeat: 'daily' } : {};
}
function renderQuickPreview() {
  const val = $('quickInput').value;
  if (!val.trim() || tab === 'sticky') {
    $('quickPreview').hidden = true;
    return;
  }
  const parsed = M.parseQuickInput(val, Date.now(), quickParseOpts());
  if (!parsed.parsed) {
    $('quickPreview').hidden = true;
    return;
  }
  $('quickPreview').hidden = false;
  $('quickPreview').classList.toggle('raw-active', quickRawMode);
  $('quickRawToggle').textContent = quickRawMode ? 'Parse' : 'Raw';
  $('quickRawToggle').title = quickRawMode ? 'Enable smart date/priority parsing' : 'Keep literal text without parsing';
  const frag = document.createDocumentFragment();
  if (quickRawMode) {
    frag.append(el('span', 'quick-chip muted-chip', 'Literal text mode'));
  } else {
    for (const c of parsed.chips) {
      frag.append(el('span', 'quick-chip chip-' + c.kind, c.label));
    }
  }
  $('quickChips').replaceChildren(frag);
}

function render() {
  if (!state) return;
  const now = Date.now(), today = new Date(now);
  document.documentElement.dataset.theme = state.settings.theme;
  document.documentElement.dataset.accent = state.settings.accent;

  const isGhost = !!current.ghost;
  const isStealth = !!state.settings.hideFromCapture;
  const isCompact = !!current.collapsed && !current.tucked;
  const canExitGhost = current.ghostShortcutAvailable !== false || current.shortcutAvailable !== false || !!current.trayAvailable;
  document.body.classList.toggle('ghost-mode', isGhost);
  document.body.classList.toggle('compact-mode', isCompact);
  $('ghostBanner').hidden = !isGhost || !!current.tucked || !!current.collapsed;
  $('ghostPill').hidden = !isGhost || !isCompact;
  $('ghostPill').textContent = current.ghostShortcutAvailable !== false
    ? 'GHOST · Ctrl+Alt+G'
    : current.shortcutAvailable !== false ? 'GHOST · Ctrl+Alt+Q' : 'GHOST · Tray';
  $('ghostBannerText').textContent = current.ghostShortcutAvailable !== false
    ? 'Ghost click-through · Press Ctrl+Alt+G or click tray to exit'
    : current.shortcutAvailable !== false
      ? 'Ghost click-through · Press Ctrl+Alt+Q or click tray to exit'
      : 'Ghost click-through · Click system tray to exit';
  $('stealthPill').hidden = !isStealth;

  $('stealthButton').classList.toggle('active', isStealth);
  $('stealthButton').setAttribute('aria-pressed', String(isStealth));
  $('stealthButton').title = isStealth ? 'Hidden from screen share · Click to disable' : 'Hide from screen share (Zoom / Teams / OBS)';

  $('ghostButton').classList.toggle('active', isGhost);
  $('ghostButton').disabled = !isGhost && !canExitGhost;
  $('ghostButton').setAttribute('aria-pressed', String(isGhost));
  $('ghostButton').title = isGhost
    ? 'Ghost click-through active · Exit via hotkey or tray'
    : canExitGhost
      ? (current.ghostShortcutAvailable !== false ? 'Ghost click-through · Ctrl+Alt+G' : 'Ghost click-through · Exit via tray or Ctrl+Alt+Q')
      : 'Ghost click-through unavailable (no hotkey or system tray)';

  $('pinButton').classList.toggle('active', state.settings.alwaysOnTop);
  $('pinButton').title = state.settings.alwaysOnTop ? 'Pinned on top · Click to unpin' : 'Click to keep on top';
  $('pinButton').setAttribute('aria-label', state.settings.alwaysOnTop ? 'Unpin from top' : 'Always on top');
  $('pinButton').setAttribute('aria-pressed', String(state.settings.alwaysOnTop));

  $('titlebar').hidden = !!current.tucked;
  $('edgeView').hidden = !current.tucked;
  document.body.classList.toggle('edge-mode', !!current.tucked);
  if (!enteringFocus && focusTaskId && (current.tucked || !current.collapsed || current.focusActive === false)) {
    stopFocusTimer();
    focusTaskId = null;
  }
  $('fullView').hidden = !!current.collapsed || !!current.tucked;
  $('compactView').hidden = !current.collapsed || !!current.tucked;
  setIcon('collapseButton', current.collapsed ? 'expand' : 'collapse');
  $('collapseButton').title = current.collapsed ? 'Expand list' : 'Compact strip';
  $('collapseButton').setAttribute('aria-label', $('collapseButton').title);

  const active = state.tasks.filter(t => !t.completedAt);
  const tasks = active.filter(t => t.kind === 'task');
  const sticky = active.filter(t => t.kind === 'sticky');
  const done = state.tasks.filter(t => t.completedAt);
  const dueTasks = tasks.filter(t => t.dueAt).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));

  // Focused task or nearest DDL in compact view
  const focused = focusTaskId ? active.find(t => t.id === focusTaskId) : null;
  if (focusTaskId && !focused) {
    stopFocusTimer();
    focusTaskId = null;
    if (current.focusActive) void command('focus-mode', false);
  }
  const next = focused || dueTasks[0] || tasks.find(t => t.important) || tasks[0] || sticky[0];
  const d = next ? M.deadline(next, state.settings, now) : { level: 'none', text: '' };
  $('compactTitle').textContent = next ? next.title : 'Clear sky today.';
  $('compactMeta').textContent = focused
    ? 'Focusing · ' + (d.text || 'No deadline')
    : next ? (d.text || 'Ready anytime') + ' · ' + active.length + ' open' : 'Nothing urgent. Click to expand.';
  $('compactView').dataset.level = d.level;
  $('compactView').classList.toggle('is-focusing', !!focused);
  $('focusControls').hidden = !focused;
  $('focusProgress').hidden = !focused;
  const canCompactFocus = !focused && !!next && next.kind === 'task';
  $('compactFocus').hidden = !canCompactFocus;
  $('compactFocus').dataset.taskId = canCompactFocus ? next.id : '';
  if (canCompactFocus) $('compactFocus').title = 'Focus on: ' + next.title;
  $('compactArrow').hidden = !!focused;
  if (focused) {
    $('focusTimer').textContent = formatTimer(focusSeconds);
    setIcon('focusToggle', focusRunning ? 'pause' : 'play');
    updateFocusProgress();
    updateFocusTimerMeta();
  }

  $('todayDate').textContent = weekdays[today.getDay()] + ', ' + months[today.getMonth()] + ' ' + today.getDate();
  $('activeCount').textContent = tasks.length;
  const overdue = tasks.filter(t => M.deadline(t, state.settings, now).level === 'overdue').length;
  const urgent = tasks.filter(t => M.deadline(t, state.settings, now).level === 'urgent').length;
  const soon = tasks.filter(t => M.deadline(t, state.settings, now).level === 'soon').length;
  const near = urgent + soon;
  const todayDone = done.filter(t => localDate(new Date(t.completedAt)) === localDate(today)).length;
  $('edgeCount').textContent = overdue ? overdue : tasks.length;
  $('edgeView').dataset.level = overdue ? 'overdue' : urgent ? 'urgent' : soon ? 'soon' : 'none';
  let edgeBadge = 'CALM';
  if (focused) {
    edgeBadge = Math.max(1, Math.ceil(focusSeconds / 60)) + 'm';
  } else if (overdue) {
    edgeBadge = 'OVER';
  } else if (dueTasks.length) {
    const ms = Date.parse(dueTasks[0].dueAt) - now;
    if (ms <= 0) edgeBadge = 'OVER';
    else if (ms >= M.DAY) edgeBadge = Math.ceil(ms / M.DAY) + 'd';
    else if (ms >= M.HOUR) edgeBadge = Math.ceil(ms / M.HOUR) + 'h';
    else edgeBadge = Math.max(1, Math.ceil(ms / M.MINUTE)) + 'm';
  }
  $('edgeCountdown').textContent = edgeBadge;
  const edgeNextHint = next ? ' · Next: ' + next.title.slice(0, 32) + (d.text ? ' (' + d.text + ')' : '') : '';
  $('edgeOpen').title = (overdue ? overdue + ' overdue' : tasks.length + ' open') + edgeNextHint + ' · Click to expand';

  $('nearSummary').textContent = overdue
    ? overdue + ' overdue' + (near ? ' · ' + near + ' due soon' : '')
    : near ? near + ' due soon'
      : todayDone ? todayDone + ' done today'
        : 'Quietly keeping track of what matters';
  $('nearSummary').classList.toggle('attention', !!(overdue || near));

  const qm = state.settings.quietMinutes || 15;
  $('quietButton').title = 'Hide for ' + qm + ' minutes & pause alerts · Recall from tray anytime';
  $('quietButton').setAttribute('aria-label', 'Hide for ' + qm + ' minutes');

  for (const [id, number] of [['countAll', active.length], ['countDdl', dueTasks.filter(t => !t.repeat).length], ['countRepeat', tasks.filter(t => t.repeat).length], ['countSticky', sticky.length], ['countDone', done.length]]) $(id).textContent = number;
  document.querySelectorAll('[data-tab]').forEach(button => { button.classList.toggle('active', button.dataset.tab === tab); button.setAttribute('aria-pressed', String(button.dataset.tab === tab)); });
  renderList(now);
  $('deadlineLegend').hidden = !dueTasks.length || tab === 'sticky' || tab === 'done';
  $('quickInput').placeholder = tab === 'sticky'
    ? 'Add a pinned reminder, press Enter…'
    : tab === 'repeat'
      ? 'e.g., "Standup 09:00" or "weekdays 09:00"…'
      : 'Try "Submit draft fri 18:00 !" or "Task // note"';
  renderQuickPreview();
  $('undoButton').disabled = !current.canUndo;
  $('saveStatus').className = ''; const dot = el('i'); $('saveStatus').replaceChildren(dot, document.createTextNode('Saved locally'));
  $('recoveryNotice').hidden = !current.notice; $('recoveryNotice').textContent = current.notice || '';
  if ($('settingsDialog').open) renderSettings();
}

function renderShelf(sticky) {
  const showShelf = tab === 'all' && sticky.length > 0;
  $('stickyShelf').hidden = !showShelf;
  if (!showShelf) {
    $('stickyItems').replaceChildren();
    $('viewSticky').hidden = true;
    return;
  }
  $('shelfCount').textContent = sticky.length;
  $('shelfBody').hidden = state.settings.stickyCollapsed;
  $('stickyToggle').setAttribute('aria-expanded', String(!state.settings.stickyCollapsed));
  setIcon('shelfChevron', state.settings.stickyCollapsed ? 'expand' : 'collapse');
  const fragment = document.createDocumentFragment();
  for (const t of sticky.slice(0, 2)) {
    const row = el('article', 'task-row shelf-row'); row.dataset.id = t.id; row.dataset.level = 'sticky';
    const mark = el('button', 'task-check sticky'); mark.type = 'button'; mark.append(icon('pin'));
    mark.setAttribute('aria-label', 'Edit pinned note: ' + t.title); mark.addEventListener('click', () => openEditor(t.id));
    const content = el('button', 'task-content'); content.type = 'button'; content.setAttribute('aria-label', 'Edit: ' + t.title);
    const title = el('span', 'task-title', t.title); if (t.important) { const star = el('span', 'important-star'); star.append(icon('star')); title.append(star); }
    content.append(title); if (t.note) content.append(el('span', 'task-note', t.note));
    content.addEventListener('click', () => openEditor(t.id));
    row.append(mark, content);
    const shelfUrl = M.extractFirstUrl((t.note || '') + ' ' + (t.title || ''));
    if (shelfUrl) {
      const actions = el('div', 'row-actions');
      const linkBtn = el('button', 'row-menu link-trigger');
      linkBtn.type = 'button'; linkBtn.title = shelfUrl; linkBtn.setAttribute('aria-label', 'Open link: ' + t.title);
      linkBtn.append(icon('link'));
      linkBtn.addEventListener('click', e => { e.stopPropagation(); void command('open-url', shelfUrl); });
      actions.append(linkBtn);
      row.append(actions);
    }
    fragment.append(row);
  }
  $('stickyItems').replaceChildren(fragment);
  $('viewSticky').hidden = sticky.length <= 2;
  $('viewSticky').replaceChildren(document.createTextNode(Math.max(0, sticky.length - 2) + ' more · View all '), icon('arrow'));
}

function visibleRows() {
  return Array.from($('fullView').querySelectorAll('.task-row')).filter(r => r.offsetParent !== null);
}
function applyKbSelection(scroll = false) {
  const rows = visibleRows();
  let matched = null;
  for (const r of rows) {
    const isSel = !!kbSelectedId && r.dataset.id === kbSelectedId;
    r.classList.toggle('kb-selected', isSel);
    if (isSel) matched = r;
  }
  if (!matched) kbSelectedId = null;
  else if (scroll) matched.scrollIntoView({ block: 'nearest' });
  return matched;
}
function renderSearchHints(now = Date.now()) {
  const box = $('searchOtherTabs');
  const q = (query || '').trim();
  if (!q || !state) { box.hidden = true; box.replaceChildren(); return; }
  const others = [];
  for (const key of TAB_ORDER) {
    if (key === tab) continue;
    const n = M.groups(state.tasks, key, q, state.settings, now).reduce((sum, g) => sum + g.tasks.length, 0);
    if (n > 0) others.push({ key, label: TAB_LABELS[key], count: n });
  }
  if (!others.length) { box.hidden = true; box.replaceChildren(); return; }
  box.hidden = false;
  const frag = document.createDocumentFragment();
  frag.append(el('span', 'search-hint-label', 'Also found:'));
  for (const item of others) {
    const btn = el('button', 'search-hint-pill', item.label + ' (' + item.count + ')');
    btn.type = 'button';
    btn.dataset.targetTab = item.key;
    btn.addEventListener('click', () => { tab = item.key; kbSelectedId = null; $('listArea').scrollTop = 0; render(); });
    frag.append(btn);
  }
  box.replaceChildren(frag);
}

function renderList(now = Date.now()) {
  const scroll = $('listArea').scrollTop, fragment = document.createDocumentFragment();
  const groups = M.groups(state.tasks, tab, query, state.settings, now);
  const count = groups.reduce((sum, g) => sum + g.tasks.length, 0);
  renderSearchHints(now);
  renderShelf(groups.find(g => g.key === 'sticky')?.tasks || []);
  for (const group of groups) {
    if (!group.tasks.length) continue;
    if (tab === 'all' && group.key === 'sticky') continue;
    const section = el('section', 'task-group group-' + group.key), heading = el('h2', 'group-label', group.label);
    heading.append(el('span', 'group-count', group.tasks.length)); section.append(heading);
    for (const t of group.tasks) {
      const d = M.deadline(t, state.settings, now), row = el('article', 'task-row' + (t.completedAt ? ' done' : ''));
      row.dataset.id = t.id; row.dataset.level = d.level;
      const check = el('button', 'task-check' + (t.kind === 'sticky' && !t.completedAt ? ' sticky' : ''));
      check.type = 'button'; check.title = t.completedAt ? 'Restore to list' : t.kind === 'sticky' ? 'Edit pinned note' : 'Mark complete';
      check.setAttribute('aria-label', check.title + ': ' + t.title);
      if (t.completedAt || t.kind === 'sticky') check.append(icon(t.completedAt ? 'check' : 'pin'));
      if (t.occurrenceOf) { check.disabled = true; check.title = 'Completed routine occurrence · Use Undo to revert'; }
      check.addEventListener('click', () => {
        if (Date.now() < suppressClickUntil) return;
        suppressClickUntil = Date.now() + 220;
        if (t.kind === 'sticky' && !t.completedAt) openEditor(t.id);
        else act({ type: 'toggle', id: t.id }, t.completedAt ? 'Restored to list.' : t.repeat ? 'Done — next occurrence scheduled.' : 'Marked complete.');
      });
      const content = el('button', 'task-content'); content.type = 'button'; content.setAttribute('aria-label', 'Edit: ' + t.title);
      const title = el('span', 'task-title', t.title);
      if (t.important) { const star = el('span', 'important-star'); star.title = 'Important'; star.append(icon('star')); title.append(star); }
      content.append(title);
      if (t.note) content.append(el('span', 'task-note', t.note));
      if (t.dueAt && !t.completedAt) {
        const meta = el('span', 'task-meta'), pill = el('span', 'due-pill level-' + d.level);
        pill.append(icon('clock'), document.createTextNode(d.text));
        meta.append(pill, el('span', 'due-date', fullDate(t.dueAt))); content.append(meta);
        if (t.repeat) {
          const repeat = el('span', 'repeat-meta');
          repeat.append(icon('repeat'), document.createTextNode(M.repeats[t.repeat] + (t.repeat === 'weekly' ? ' ' + weekdays[new Date(t.dueAt).getDay()] : '') + ' · ' + pad(new Date(t.dueAt).getHours()) + ':' + pad(new Date(t.dueAt).getMinutes())));
          content.append(repeat);
        }
        const rw = M.runway(t, state.settings, now);
        if (rw) {
          const bar = el('span', 'runway-bar');
          const fill = el('i', 'level-' + rw.level);
          fill.style.width = Math.round(rw.ratio * 100) + '%';
          bar.append(fill);
          content.append(bar);
        }
      } else if (t.kind === 'sticky' && !t.completedAt) {
        const meta = el('span', 'task-meta'), st = el('span', 'sticky-meta'); st.append(icon('leaf'), document.createTextNode('Always visible')); meta.append(st); content.append(meta);
      } else if (t.completedAt) {
        content.append(el('span', 'task-meta', (t.kind === 'sticky' ? 'Archived ' : 'Done ') + fullDate(t.completedAt)));
        if (t.occurrenceOf) content.append(el('span', 'repeat-meta', M.repeats[t.occurrenceRepeat] + ' · Completed occurrence'));
      }
      content.addEventListener('click', () => { kbSelectedId = null; openEditor(t.id); });

      const actions = el('div', 'row-actions');
      if (!t.completedAt && t.kind === 'task') {
        if (t.dueAt && !t.repeat) {
          const s1h = el('button', 'micro-chip', '+1h');
          s1h.type = 'button'; s1h.title = 'Snooze +1 hour'; s1h.setAttribute('aria-label', 'Snooze +1h: ' + t.title);
          s1h.addEventListener('click', e => { e.stopPropagation(); act({ type: 'snooze', id: t.id, preset: '+1h' }, 'Snoozed +1 hour.'); });
          const stmr = el('button', 'micro-chip', 'Tmr');
          stmr.type = 'button'; stmr.title = 'Snooze to tomorrow'; stmr.setAttribute('aria-label', 'Snooze tomorrow: ' + t.title);
          stmr.addEventListener('click', e => { e.stopPropagation(); act({ type: 'snooze', id: t.id, preset: 'tomorrow' }, 'Moved to tomorrow.'); });
          const s1w = el('button', 'micro-chip', '+1w');
          s1w.type = 'button'; s1w.title = 'Snooze +1 week'; s1w.setAttribute('aria-label', 'Snooze +1w: ' + t.title);
          s1w.addEventListener('click', e => { e.stopPropagation(); act({ type: 'snooze', id: t.id, preset: '+1w' }, 'Snoozed +1 week.'); });
          actions.append(s1h, stmr, s1w);
        } else if (t.repeat) {
          const skipBtn = el('button', 'micro-chip', 'Skip');
          skipBtn.type = 'button'; skipBtn.title = 'Skip this occurrence'; skipBtn.setAttribute('aria-label', 'Skip occurrence: ' + t.title);
          skipBtn.addEventListener('click', e => { e.stopPropagation(); act({ type: 'skip', id: t.id }, 'Skipped to next occurrence.'); });
          actions.append(skipBtn);
        }
        const focusBtn = el('button', 'row-menu focus-trigger');
        focusBtn.type = 'button'; focusBtn.title = 'Focus on this task'; focusBtn.setAttribute('aria-label', 'Focus: ' + t.title);
        focusBtn.append(icon('focus'));
        focusBtn.addEventListener('click', e => { e.stopPropagation(); void enterFocus(t.id); });
        actions.append(focusBtn);
      }
      const rowUrl = !t.completedAt ? M.extractFirstUrl((t.note || '') + ' ' + (t.title || '')) : null;
      if (rowUrl) {
        const linkBtn = el('button', 'row-menu link-trigger');
        linkBtn.type = 'button'; linkBtn.title = rowUrl; linkBtn.setAttribute('aria-label', 'Open link: ' + t.title);
        linkBtn.append(icon('link'));
        linkBtn.addEventListener('click', e => { e.stopPropagation(); void command('open-url', rowUrl); });
        actions.append(linkBtn);
      }
      const menu = el('button', 'row-menu'); menu.type = 'button'; menu.title = 'Edit / Delete'; menu.setAttribute('aria-label', 'More actions: ' + t.title); menu.append(icon('more')); menu.addEventListener('click', () => openEditor(t.id));
      actions.append(menu);
      row.append(check, content, actions); section.append(row);
    }
    fragment.append(section);
  }
  $('taskList').replaceChildren(fragment); $('listArea').scrollTop = scroll;
  applyKbSelection(false);
  $('emptyState').hidden = count > 0;
  if (!count) {
    let title = 'Room for what matters.', description = 'Try typing "Submit draft fri 18:00 !"\nor pin a note to the top shelf.';
    if (query) { title = 'No matching tasks.'; description = 'Try another word — both titles and notes are searched.'; }
    else if (tab === 'done') { title = 'Completed tasks land here.'; description = 'Check off any item to keep a quiet record of progress.'; }
    else if (tab === 'ddl') { title = 'No active deadlines.'; description = 'Add a deadline and Edgewise will shift colors as it approaches.'; }
    else if (tab === 'repeat') { title = 'No routines yet.'; description = 'Try "Standup weekdays 09:00" or "Weekly review every fri 17:00".'; }
    else if (tab === 'sticky') { title = 'No pinned notes yet.'; description = 'Keep principles, checklists, or reminders visible without deadlines.'; }
    $('emptyTitle').textContent = title;
    $('emptyDescription').replaceChildren(...description.split('\n').flatMap((s, i) => i ? [el('br'), document.createTextNode(s)] : [document.createTextNode(s)]));
    $('emptyAdd').hidden = !!query || tab === 'done';
    $('emptyAdd').replaceChildren(document.createTextNode(tab === 'sticky' ? 'Add pinned note ' : 'Add a task '), icon('arrow'));
  }
}

function setKind(kind) {
  editKind = kind; $('kindTask').classList.toggle('selected', kind === 'task'); $('kindSticky').classList.toggle('selected', kind === 'sticky');
  $('kindTask').setAttribute('aria-pressed', String(kind === 'task')); $('kindSticky').setAttribute('aria-pressed', String(kind === 'sticky'));
  $('ddlControls').hidden = kind === 'sticky'; $('stickyHint').hidden = kind !== 'sticky';
}
function dateFields() {
  const repeat = editKind === 'task' && $('repeatSelect').value;
  if (repeat) $('hasDue').checked = true;
  $('hasDue').disabled = !!repeat; $('repeatHint').hidden = !repeat;
  $('dueLabel').textContent = repeat ? 'First date & reminder time' : 'Deadline';
  $('dateFields').hidden = !$('hasDue').checked; $('dueDate').required = $('hasDue').checked && editKind === 'task'; previewDate();
}
function editorDue() {
  if (editKind === 'sticky' || !$('hasDue').checked) return null;
  if (!$('dueDate').value) throw new Error('Please select a deadline date.');
  const time = $('dueTime').value || '23:59';
  const d = new Date($('dueDate').value + 'T' + time + ':00');
  if (!Number.isFinite(d.getTime())) throw new Error('Invalid deadline time. Please select again.');
  return d.toISOString();
}
function previewDate() {
  try {
    let dueAt = editorDue(); if (!dueAt) return; const repeat = $('repeatSelect').value;
    if (repeat) dueAt = M.nextRepeat(dueAt, repeat, Date.now(), true);
    const d = M.deadline({ dueAt }, state.settings);
    $('duePreview').textContent = repeat
      ? M.repeats[repeat] + (repeat === 'weekly' ? ' ' + weekdays[new Date(dueAt).getDay()] : '') + ' · Next: ' + fullDate(dueAt)
      : d.text + ' · ' + (d.level === 'overdue' ? 'This date has already passed' : 'Color shifts automatically');
    $('duePreview').className = 'due-preview'; $('duePreview').dataset.level = repeat ? 'future' : d.level;
  } catch (_) { $('duePreview').textContent = ''; }
}
function updateNoteLinkPill() {
  const url = M.extractFirstUrl($('taskNote').value);
  $('noteLinkPill').hidden = !url;
  $('noteLinkPill').dataset.url = url || '';
  if (url) {
    $('noteLinkText').textContent = M.titleFromUrl(url) || url;
    $('noteLinkPill').title = 'Open ' + url;
    $('noteLinkPill').setAttribute('aria-label', 'Open link: ' + url);
  }
}
async function openEditor(id = null, initial = '', initialNote = '', skipParse = false) {
  if (!state) return;
  command('modal-open', true);
  if (current.tucked) await command('tuck', false);
  if (current.collapsed) await command('collapse', false);
  if ($('settingsDialog').open) $('settingsDialog').close();
  const t = id ? state.tasks.find(t => t.id === id) : null;
  if (id && !t) { command('modal-open', $('settingsDialog').open); return; }
  if ($('editorDialog').open) return;
  editId = id; lastFocus = document.activeElement;
  const parsed = !t && initial && !skipParse && !quickRawMode && tab !== 'sticky' ? M.parseQuickInput(initial, Date.now(), quickParseOpts()) : null;
  $('editorHeading').textContent = id ? 'Edit Task' : 'New Task';
  $('taskTitle').value = t ? t.title : (parsed?.parsed ? parsed.title : initial);
  $('taskNote').value = t ? t.note : (initialNote || (parsed?.note || ''));
  updateNoteLinkPill();
  $('taskImportant').checked = t ? t.important : !!(parsed?.important);
  $('repeatSelect').value = t ? t.repeat || '' : (parsed?.repeat || (tab === 'repeat' ? 'daily' : ''));
  $('repeatSelect').disabled = !!t?.occurrenceOf;
  const effectiveDue = t ? t.dueAt : (parsed?.dueAt || null);
  $('hasDue').checked = !!effectiveDue || (!t && tab === 'ddl');
  const date = effectiveDue ? new Date(effectiveDue) : new Date();
  $('dueDate').value = localDate(date);
  $('dueTime').value = effectiveDue ? pad(date.getHours()) + ':' + pad(date.getMinutes()) : ($('repeatSelect').value ? '09:00' : '23:59');
  setKind(t ? t.kind : (parsed?.kind === 'sticky' || tab === 'sticky' ? 'sticky' : 'task')); dateFields();
  $('editActions').hidden = !t; $('completeTask').hidden = !!t?.occurrenceOf;
  $('completeTask').textContent = t && t.completedAt ? 'Restore to list' : t && t.kind === 'sticky' ? 'Archive note' : t && t.repeat ? 'Complete occurrence' : 'Mark complete';
  $('saveTask').replaceChildren(document.createTextNode(id ? 'Save Changes ' : 'Save Task '), icon('arrow'));
  $('saveTask').disabled = false; $('editorError').hidden = true;
  $('editorDialog').showModal(); $('editorDialog').querySelector('.sheet-body').scrollTop = 0;
  setTimeout(() => { $('taskTitle').focus(); if (!id) $('taskTitle').setSelectionRange($('taskTitle').value.length, $('taskTitle').value.length); }, 60);
}
function closeEditor() { $('editorDialog').close(); editId = null; command('modal-open', $('settingsDialog').open); if (lastFocus && lastFocus.isConnected) lastFocus.focus(); }
function renderSettings() {
  const s = state.settings;
  document.querySelectorAll('[data-theme]').forEach(n => { if (n.tagName === 'BUTTON') n.classList.toggle('selected', n.dataset.theme === s.theme); });
  document.querySelectorAll('[data-accent]').forEach(n => { if (n.tagName === 'BUTTON') n.classList.toggle('selected', n.dataset.accent === s.accent); });
  for (const id of ['reminders', 'alwaysOnTop', 'launchOnStartup', 'autoTuck', 'hideFromCapture']) $(id).checked = s[id];
  $('warnDays').value = s.warnDays; $('urgentHours').value = s.urgentHours; $('quietMinutes').value = s.quietMinutes || 15;
  if (document.activeElement !== $('opacityRange')) $('opacityRange').value = Math.round(s.opacity * 100);
  $('opacityValue').textContent = Math.round(s.opacity * 100) + '%';
  $('clearButton').disabled = !state.tasks.some(t => t.completedAt);
  const qHint = current.shortcutAvailable ? 'Ctrl+Alt+Q toggle' : 'Ctrl+Alt+Q unavailable (use tray)';
  const gHint = current.ghostShortcutAvailable !== false ? 'Ctrl+Alt+G ghost' : 'Ghost via tray';
  $('shortcutHint').textContent = qHint + ' · ' + gHint + ' · Ctrl+1–5 tabs · Ctrl+N new';
}
function showSearch() { $('searchRow').hidden = false; $('searchInput').focus(); }
function closeSearch() { query = ''; $('searchInput').value = ''; $('searchRow').hidden = true; renderList(); }

fillIcons();
$('stealthButton').addEventListener('click', () => act({ type: 'settings', settings: { hideFromCapture: !state.settings.hideFromCapture } }, !state.settings.hideFromCapture ? 'Hidden from screen share.' : 'Visible to screen share again.'));
$('ghostButton').addEventListener('click', () => command('ghost', !current.ghost));
$('pinButton').addEventListener('click', () => act({ type: 'settings', settings: { alwaysOnTop: !state.settings.alwaysOnTop } }));
$('dockButton').addEventListener('click', () => command('tuck', true));
$('edgeOpen').addEventListener('click', () => command('tuck', false));
$('quietButton').addEventListener('click', () => command('away', state?.settings?.quietMinutes || 15));
$('stickyToggle').addEventListener('click', () => act({ type: 'settings', settings: { stickyCollapsed: !state.settings.stickyCollapsed } }));
$('viewSticky').addEventListener('click', () => { tab = 'sticky'; kbSelectedId = null; render(); });
$('addSticky').addEventListener('click', async () => { await openEditor(); setKind('sticky'); dateFields(); });
$('collapseButton').addEventListener('click', () => { if (focusTaskId) void exitFocus(true); else command('collapse', !current.collapsed); });
$('compactView').addEventListener('click', () => { if (!focusTaskId) command('collapse', false); });
$('compactView').addEventListener('keydown', e => { if (!focusTaskId && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); command('collapse', false); } });
$('compactFocus').addEventListener('click', e => { e.stopPropagation(); const id = $('compactFocus').dataset.taskId; if (id) void enterFocus(id); });
$('focusTimer').addEventListener('click', e => {
  e.stopPropagation();
  if (!focusTaskId || focusRunning) return;
  const cur = getFocusPresetMins();
  const nextMins = FOCUS_PRESETS[(FOCUS_PRESETS.indexOf(cur) + 1) % FOCUS_PRESETS.length];
  setFocusPresetMins(nextMins);
  focusTotalSeconds = nextMins * 60;
  focusSeconds = focusTotalSeconds;
  $('focusTimer').textContent = formatTimer(focusSeconds);
  updateFocusProgress();
  updateFocusTimerMeta();
});
$('focusPlusFive').addEventListener('click', e => {
  e.stopPropagation();
  if (!focusTaskId) return;
  if (focusRunning && focusEndAt) {
    focusEndAt += 5 * 60000;
    focusSeconds = Math.max(0, Math.ceil((focusEndAt - Date.now()) / 1000));
    focusTotalSeconds += 5 * 60;
  } else if (focusSeconds <= 0) {
    focusSeconds = 5 * 60;
    focusTotalSeconds += 5 * 60;
    startFocusTimer();
    setIcon('focusToggle', 'pause');
  } else {
    focusSeconds += 5 * 60;
    focusTotalSeconds += 5 * 60;
  }
  $('focusTimer').textContent = formatTimer(focusSeconds);
  updateFocusProgress();
  updateFocusTimerMeta();
});
$('focusToggle').addEventListener('click', e => { e.stopPropagation(); if (focusRunning) stopFocusTimer(); else startFocusTimer(); setIcon('focusToggle', focusRunning ? 'pause' : 'play'); });
$('focusDone').addEventListener('click', async e => {
  e.stopPropagation();
  const id = focusTaskId;
  if (!id) return;
  await exitFocus(true);
  await act({ type: 'toggle', id }, 'Focused task completed.');
});
$('focusExit').addEventListener('click', e => { e.stopPropagation(); void exitFocus(true); });
$('hideButton').addEventListener('click', () => command('hide'));
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { tab = button.dataset.tab; kbSelectedId = null; $('listArea').scrollTop = 0; render(); }));
$('searchButton').addEventListener('click', showSearch); $('searchClose').addEventListener('click', closeSearch);
$('searchInput').addEventListener('input', event => { query = event.target.value; renderList(); });
$('detailAdd').addEventListener('click', () => openEditor(null, $('quickInput').value.trim()));
$('emptyAdd').addEventListener('click', () => openEditor());
$('quickRawToggle').addEventListener('click', () => { quickRawMode = !quickRawMode; renderQuickPreview(); $('quickInput').focus(); });
$('quickInput').addEventListener('input', () => { if (!$('quickInput').value.trim()) quickRawMode = false; renderQuickPreview(); });

let composing = false;
$('quickInput').addEventListener('compositionstart', () => composing = true);
$('quickInput').addEventListener('compositionend', () => { setTimeout(() => composing = false, 0); });
$('quickInput').addEventListener('keydown', event => { if (event.key === 'Enter' && (event.isComposing || event.keyCode === 229 || composing)) event.preventDefault(); });
$('quickForm').addEventListener('submit', async event => {
  event.preventDefault(); if (composing || busy) return;
  const raw = $('quickInput').value.trim(); if (!raw) { openEditor(); return; }
  const parsed = !quickRawMode && tab !== 'sticky' ? M.parseQuickInput(raw, Date.now(), quickParseOpts()) : { title: raw, note: '', kind: tab === 'sticky' ? 'sticky' : 'task', dueAt: null, repeat: null, important: false, parsed: false };
  if (!parsed.parsed && (tab === 'ddl' || tab === 'repeat')) { openEditor(null, raw); return; }
  const nextTask = {
    title: parsed.title,
    note: parsed.note || '',
    kind: parsed.parsed ? parsed.kind : (tab === 'sticky' ? 'sticky' : 'task'),
    dueAt: parsed.dueAt || null,
    repeat: parsed.repeat || null,
    important: !!parsed.important
  };
  const label = parsed.parsed ? (nextTask.kind === 'sticky' ? 'Pinned.' : nextTask.repeat ? 'Routine scheduled.' : 'Task saved.') : undefined;
  const result = await act({ type: 'add', task: nextTask }, label);
  if (result) {
    $('quickInput').value = ''; quickRawMode = false; renderQuickPreview();
    if (
      tab === 'done' ||
      (tab === 'ddl' && (nextTask.kind === 'sticky' || !nextTask.dueAt || nextTask.repeat)) ||
      (tab === 'sticky' && nextTask.kind !== 'sticky') ||
      (tab === 'repeat' && !nextTask.repeat)
    ) {
      tab = nextTask.kind === 'sticky' ? 'sticky' : nextTask.repeat ? 'repeat' : 'all';
      render();
    }
    $('quickInput').focus();
  }
});

// Drag-and-drop URL or text onto window or 46px edge tab to capture instantly.
// Native drag-and-drop inside open dialogs or text inputs is never intercepted.
let dragDepth = 0;
const hasDropText = dt => dt && (dt.types.includes('text/plain') || dt.types.includes('text/uri-list'));
const isDropBlocked = e => $('editorDialog').open || $('settingsDialog').open || (e.target instanceof Element && !!e.target.closest('input, textarea, [contenteditable]'));
document.addEventListener('dragenter', e => {
  if (isDropBlocked(e) || !hasDropText(e.dataTransfer)) return;
  e.preventDefault(); dragDepth += 1; $('dropHint').hidden = false;
});
document.addEventListener('dragover', e => {
  if (isDropBlocked(e) || !hasDropText(e.dataTransfer)) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('dragleave', e => {
  if (isDropBlocked(e) || !hasDropText(e.dataTransfer)) return;
  dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('dropHint').hidden = true;
});
document.addEventListener('drop', async e => {
  if (isDropBlocked(e) || !hasDropText(e.dataTransfer)) return;
  e.preventDefault(); dragDepth = 0; $('dropHint').hidden = true;
  const uri = (e.dataTransfer.getData('text/uri-list') || '').split(/\r?\n/).find(l => l && !l.startsWith('#')) || '';
  const text = (e.dataTransfer.getData('text/plain') || '').trim();
  const payloadText = text || uri;
  if (!payloadText) return;
  if (current.tucked) await command('tuck', false);
  if (current.collapsed) await command('collapse', false);
  const validUri = uri ? M.extractFirstUrl(uri) : (!text.includes('\n') && /^https?:\/\/\S+$/i.test(text) ? M.extractFirstUrl(text) : null);
  let firstLine, rawNote;
  if (validUri && (!text || text === uri || text === validUri)) {
    firstLine = M.titleFromUrl(validUri) || validUri.slice(0, 140);
    rawNote = validUri;
  } else {
    firstLine = payloadText.split(/\r?\n/)[0].trim().slice(0, 140);
    rawNote = uri && uri !== firstLine ? uri : (payloadText.length > firstLine.length ? payloadText : '');
  }
  const extraNote = rawNote.slice(0, 5000);
  openEditor(null, firstLine, extraNote, !!validUri);
});

$('taskNote').addEventListener('input', updateNoteLinkPill);
$('noteLinkPill').addEventListener('click', () => { const url = $('noteLinkPill').dataset.url; if (url) void command('open-url', url); });
$('editorDialog').addEventListener('keydown', event => {
  if (event.isComposing) return;
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    $('editorForm').requestSubmit();
  }
});

document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => { setKind(button.dataset.kind); dateFields(); }));
$('hasDue').addEventListener('change', dateFields);
$('repeatSelect').addEventListener('change', () => { if ($('repeatSelect').value && $('dueTime').value === '23:59') $('dueTime').value = '09:00'; dateFields(); });
for (const id of ['dueDate', 'dueTime']) $(id).addEventListener('input', previewDate);
document.querySelectorAll('[data-days]').forEach(button => button.addEventListener('click', () => { const d = new Date(); d.setDate(d.getDate() + Number(button.dataset.days)); $('dueDate').value = localDate(d); previewDate(); }));
document.querySelectorAll('.close-editor').forEach(button => button.addEventListener('click', closeEditor));
$('editorDialog').addEventListener('cancel', () => { editId = null; });
for (const id of ['editorDialog', 'settingsDialog']) $(id).addEventListener('close', () => command('modal-open', $('editorDialog').open || $('settingsDialog').open));
$('editorForm').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  try {
    $('editorError').hidden = true;
    const repeat = editKind === 'task' ? $('repeatSelect').value || null : null;
    let dueAt = editorDue(); if (repeat) dueAt = M.nextRepeat(dueAt, repeat, Date.now(), true);
    const task = { title: $('taskTitle').value.trim(), note: $('taskNote').value, kind: editKind, dueAt, repeat, important: $('taskImportant').checked };
    if (!task.title) throw new Error('Please enter a task title.');
    $('saveTask').disabled = true;
    const wasEdit = !!editId;
    const result = await act(wasEdit ? { type: 'update', id: editId, task } : { type: 'add', task });
    if (result) {
      closeEditor(); $('quickInput').value = ''; quickRawMode = false; renderQuickPreview();
      if (tab === 'done' && !wasEdit || tab === 'ddl' && (task.kind === 'sticky' || task.repeat) || tab === 'sticky' && task.kind !== 'sticky' || tab === 'repeat' && !task.repeat) {
        tab = task.kind === 'sticky' ? 'sticky' : task.repeat ? 'repeat' : 'all'; render();
      }
      toast(wasEdit ? 'Changes saved.' : task.repeat ? 'Routine scheduled.' : 'Saved to your bar.', true);
    }
  } catch (error) { errorMessage(error); }
  finally { $('saveTask').disabled = false; }
});
$('deleteTask').addEventListener('click', async () => { if (editId && await act({ type: 'delete', id: editId })) { closeEditor(); toast('Task deleted.', true); } });
$('completeTask').addEventListener('click', async () => { if (editId && await act({ type: 'toggle', id: editId })) { closeEditor(); toast('Task updated.', true); } });
async function undo() { if (await act({ type: 'undo' })) toast('Undid last action.'); }
$('undoButton').addEventListener('click', undo); $('toastUndo').addEventListener('click', undo); $('toastClose').addEventListener('click', () => $('toast').hidden = true);
$('settingsButton').addEventListener('click', () => { command('modal-open', true); $('settingsError').hidden = true; $('settingsDialog').showModal(); renderSettings(); });
$('closeSettings').addEventListener('click', () => { $('settingsDialog').close(); command('modal-open', $('editorDialog').open); });
document.querySelectorAll('button[data-theme]').forEach(button => button.addEventListener('click', () => act({ type: 'settings', settings: { theme: button.dataset.theme } })));
document.querySelectorAll('button[data-accent]').forEach(button => button.addEventListener('click', () => act({ type: 'settings', settings: { accent: button.dataset.accent } })));
for (const id of ['alwaysOnTop', 'reminders', 'launchOnStartup', 'autoTuck', 'hideFromCapture']) $(id).addEventListener('change', () => act({ type: 'settings', settings: { [id]: $(id).checked } }));
for (const id of ['warnDays', 'urgentHours', 'quietMinutes']) $(id).addEventListener('change', () => act({ type: 'settings', settings: { [id]: Number($(id).value) } }));
$('opacityRange').addEventListener('input', () => $('opacityValue').textContent = $('opacityRange').value + '%');
$('opacityRange').addEventListener('change', () => act({ type: 'settings', settings: { opacity: Number($('opacityRange').value) / 100 } }));
$('exportButton').addEventListener('click', async () => { const r = await command('export'); if (r && r.ok) { $('settingsDialog').close(); toast('JSON backup exported.'); } });
$('importButton').addEventListener('click', async () => { const r = await command('import'); if (r && r.ok) { $('settingsDialog').close(); toast('Backup restored.', true); } });
$('exportMdButton').addEventListener('click', async () => { const r = await command('export-md'); if (r && r.ok) { $('settingsDialog').close(); toast('Exported Markdown checklist.'); } });
$('folderButton').addEventListener('click', () => command('folder'));
$('clearButton').addEventListener('click', async () => { const r = await command('clear-completed'); if (r && !r.canceled) { $('settingsDialog').close(); toast('Cleared completed records.', true); } });
$('quitButton').addEventListener('click', () => command('quit'));
document.addEventListener('keydown', event => {
  if (event.isComposing) return;
  const tag = document.activeElement?.tagName;
  const editable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
  const dialogOpen = $('editorDialog').open || $('settingsDialog').open;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); if (!$('editorDialog').open) void openEditor(); return; }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !dialogOpen) {
    event.preventDefault();
    (async () => {
      if (current.tucked) await command('tuck', false);
      if (current.collapsed) await command('collapse', false);
      showSearch();
    })();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !editable && !dialogOpen) { event.preventDefault(); undo(); return; }
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && ['1', '2', '3', '4', '5'].includes(event.key) && !dialogOpen && !current.tucked) {
    event.preventDefault();
    if (current.collapsed && !focusTaskId) void command('collapse', false);
    tab = TAB_ORDER[Number(event.key) - 1];
    kbSelectedId = null;
    $('listArea').scrollTop = 0;
    render();
    return;
  }
  if (event.key === 'Escape' && !dialogOpen) {
    if (current.ghost) { event.preventDefault(); void command('ghost', false); return; }
    if (!$('searchRow').hidden) { closeSearch(); return; }
    if (!$('toast').hidden) { $('toast').hidden = true; return; }
    if (kbSelectedId) { kbSelectedId = null; applyKbSelection(false); return; }
    if (!current.tucked && !focusTaskId && state?.settings?.autoTuck && !$('quickInput').value.trim()) {
      event.preventDefault();
      void command('dismiss');
    }
    return;
  }
  if (!editable && !dialogOpen && !current.collapsed && !current.tucked && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const rows = visibleRows();
      if (!rows.length) return;
      event.preventDefault();
      const idx = rows.findIndex(r => r.dataset.id === kbSelectedId);
      const nextIdx = event.key === 'ArrowDown'
        ? (idx < 0 ? 0 : (idx + 1) % rows.length)
        : (idx <= 0 ? rows.length - 1 : idx - 1);
      kbSelectedId = rows[nextIdx].dataset.id;
      $('listArea').focus({ preventScroll: true });
      applyKbSelection(true);
      return;
    }
    if (kbSelectedId && tag !== 'BUTTON') {
      const selectedTask = state?.tasks.find(t => t.id === kbSelectedId);
      if (!selectedTask) { kbSelectedId = null; applyKbSelection(false); return; }
      if (event.key === 'Enter') {
        event.preventDefault();
        openEditor(selectedTask.id);
      } else if (event.key === ' ') {
        event.preventDefault();
        if (selectedTask.kind === 'sticky' && !selectedTask.completedAt) openEditor(selectedTask.id);
        else if (!selectedTask.occurrenceOf) void act({ type: 'toggle', id: selectedTask.id }, selectedTask.completedAt ? 'Restored to list.' : selectedTask.repeat ? 'Done — next occurrence scheduled.' : 'Marked complete.');
      } else if (event.key.toLowerCase() === 'f' && !selectedTask.completedAt && selectedTask.kind === 'task') {
        event.preventDefault();
        void enterFocus(selectedTask.id);
      }
    }
  }
});
if (!window.edgewise) {
  $('emptyState').hidden = false; $('emptyTitle').textContent = 'Launch from Edgewise Desktop'; $('emptyDescription').textContent = 'This UI runs inside the desktop app. Launch Edgewise.exe to use it.'; $('emptyAdd').hidden = true;
} else {
  window.edgewise.read().then(accept).catch(errorMessage);
  window.edgewise.onState(data => { try { accept(data); } catch (error) { errorMessage(error); } });
  window.edgewise.onError(message => errorMessage(new Error(message)));
  window.edgewise.onFocusAdd(() => { if (!$('editorDialog').open && !$('settingsDialog').open) $('quickInput').focus(); });
  // A deadline can change category while the window stays open or after sleep.
  setInterval(() => { if (state && !document.hidden) { render(); if ($('editorDialog').open) previewDate(); } }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state) render(); });
}
