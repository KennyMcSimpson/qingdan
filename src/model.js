(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QingdanModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const HOUR = 3600000, DAY = 24 * HOUR;
  const defaults = Object.freeze({ theme: 'paper', accent: 'sage', alwaysOnTop: true,
    opacity: 1, warnDays: 3, urgentHours: 24, reminders: true, launchOnStartup: false,
    autoTuck: true, stickyCollapsed: false });
  function defaultState() { return { version: 1, tasks: [], settings: { ...defaults }, window: {}, notices: {} }; }
  function settings(input = {}) {
    return { theme: input.theme === 'dark' ? 'dark' : 'paper',
      accent: ['sage', 'blue', 'rose'].includes(input.accent) ? input.accent : defaults.accent,
      alwaysOnTop: typeof input.alwaysOnTop === 'boolean' ? input.alwaysOnTop : defaults.alwaysOnTop,
      opacity: Number.isFinite(input.opacity) ? Math.min(1, Math.max(.8, input.opacity)) : 1,
      warnDays: [1, 3, 7, 14].includes(input.warnDays) ? input.warnDays : 3,
      urgentHours: [6, 12, 24].includes(input.urgentHours) ? input.urgentHours : 24,
      reminders: typeof input.reminders === 'boolean' ? input.reminders : true,
      launchOnStartup: input.launchOnStartup === true,
      autoTuck: typeof input.autoTuck === 'boolean' ? input.autoTuck : true,
      stickyCollapsed: input.stickyCollapsed === true };
  }
  const repeats = Object.freeze({ daily: '每天', weekdays: '工作日', weekly: '每周' });
  // Calendar arithmetic preserves the wall clock across daylight-saving changes.
  function nextRepeat(dueAt, repeat, after = Date.now(), includeToday = false) {
    if (typeof repeat !== 'string' || !Object.hasOwn(repeats,repeat)) throw new Error('不支持这个重复周期。');
    const d = new Date(dueAt);
    if (!Number.isFinite(d.getTime())) throw new Error('循环事项需要有效的提醒时间。');
    const limit = new Date(after);
    if (includeToday) limit.setHours(0, 0, 0, 0);
    if (d < limit) {
      if (repeat === 'weekly') {
        const weekday = d.getDay(), hour = d.getHours(), minute = d.getMinutes();
        d.setFullYear(limit.getFullYear(), limit.getMonth(), limit.getDate());
        d.setHours(hour, minute, 0, 0);
        d.setDate(d.getDate() + (weekday - d.getDay() + 7) % 7);
      } else {
        const hour = d.getHours(), minute = d.getMinutes();
        d.setFullYear(limit.getFullYear(), limit.getMonth(), limit.getDate());
        d.setHours(hour, minute, 0, 0);
      }
    }
    if (!includeToday && d.getTime() <= after) d.setDate(d.getDate() + (repeat === 'weekly' ? 7 : 1));
    if (repeat === 'weekdays') while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  function task(input, now = Date.now()) {
    if (!input || typeof input !== 'object') throw new Error('这条记录的格式不正确。');
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title) throw new Error('先写下这件事的名字吧。');
    if (title.length > 160) throw new Error('标题最多 160 个字。');
    const note = typeof input.note === 'string' ? input.note.trim() : '';
    if (note.length > 5000) throw new Error('备注最多 5000 个字。');
    const kind = input.kind === 'sticky' ? 'sticky' : 'task';
    let dueAt = null;
    if (input.dueAt && kind === 'task') {
      const n = Date.parse(input.dueAt);
      if (!Number.isFinite(n) || n < 0 || n > 253402300799999) throw new Error('截止日期无效，请重新选择。');
      dueAt = new Date(n).toISOString();
    }
    if (typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.id)) throw new Error('记录编号无效。');
    const repeat = kind === 'sticky' ? null : input.repeat || null;
    if (repeat && (typeof repeat !== 'string' || !Object.hasOwn(repeats,repeat))) throw new Error('不支持这个重复周期。');
    if (repeat && !dueAt) throw new Error('循环事项需要指定日期和提醒时间。');
    if (repeat === 'weekdays' && [0, 6].includes(new Date(dueAt).getDay())) dueAt = nextRepeat(dueAt, repeat, Date.parse(dueAt), true);
    const occurrenceOf = typeof input.occurrenceOf === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(input.occurrenceOf) ? input.occurrenceOf : null;
    return { id: input.id, title, note, kind, dueAt, repeat,
      occurrenceOf, occurrenceRepeat: occurrenceOf && Object.hasOwn(repeats,input.occurrenceRepeat) ? input.occurrenceRepeat : null,
      important: input.important === true,
      createdAt: Number.isFinite(input.createdAt) ? input.createdAt : now,
      updatedAt: Number.isFinite(input.updatedAt) ? input.updatedAt : now,
      completedAt: Number.isFinite(input.completedAt) && input.completedAt > 0 ? input.completedAt : null };
  }
  function validateState(input) {
    if (!input || input.version !== 1 || !Array.isArray(input.tasks)) throw new Error('不是有效的轻单备份，或版本暂不支持。');
    if (input.tasks.length > 5000) throw new Error('最多支持 5000 条记录，请先归档旧数据。');
    const tasks = input.tasks.map(t => task(t));
    if (new Set(tasks.map(t => t.id)).size !== tasks.length) throw new Error('备份里有重复的记录编号。');
    const w = input.window || {}, window = {};
    for (const key of ['x', 'y', 'width', 'height', 'expandedHeight', 'edgeY']) {
      if (Number.isFinite(w[key])) window[key] = Math.round(w[key]);
    }
    window.collapsed = w.collapsed === true;
    window.tucked = w.tucked === true;
    window.edgeSide = w.edgeSide === 'left' ? 'left' : 'right';
    const notices = {};
    if (input.notices && typeof input.notices === 'object') {
      for (const t of tasks) if (typeof input.notices[t.id] === 'string') notices[t.id] = input.notices[t.id].slice(0, 120);
    }
    return { version: 1, tasks, settings: settings(input.settings), window, notices };
  }
  function deadline(t, opts = defaults, now = Date.now()) {
    if (t.completedAt) return { level: 'done', text: t.kind === 'sticky' ? '已归档' : '已完成', ms: Infinity };
    if (t.kind === 'sticky') return { level: 'sticky', text: '长期挂着', ms: Infinity };
    if (!t.dueAt) return { level: 'none', text: '', ms: Infinity };
    const ms = Date.parse(t.dueAt) - now, a = Math.abs(ms);
    const duration = a >= DAY ? Math.ceil(a / DAY) + ' 天' : a >= HOUR ? Math.ceil(a / HOUR) + ' 小时' : Math.max(1, Math.ceil(a / 60000)) + ' 分钟';
    if (ms <= 0) {
      const elapsed = a >= DAY ? Math.floor(a / DAY) + ' 天' : a >= HOUR ? Math.floor(a / HOUR) + ' 小时' : Math.floor(a / 60000) + ' 分钟';
      return { level: 'overdue', text: a < 60000 ? '刚刚到期' : '已逾期 ' + elapsed, ms };
    }
    const level = ms <= opts.urgentHours * HOUR ? 'urgent' : ms <= opts.warnDays * DAY ? 'soon' : 'future';
    return { level, text: '剩 ' + duration, ms };
  }
  function compare(a, b) {
    return Number(b.important) - Number(a.important) ||
      (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity) || a.createdAt - b.createdAt;
  }
  function groups(tasks, tab, query, opts, now = Date.now()) {
    const q = (query || '').trim().toLocaleLowerCase();
    let items = tasks.filter(t => (!q || (t.title + '\n' + t.note).toLocaleLowerCase().includes(q)) &&
      (tab === 'done' ? !!t.completedAt : !t.completedAt) &&
      (tab !== 'ddl' || t.kind === 'task' && !!t.dueAt && !t.repeat) && (tab !== 'repeat' || !!t.repeat) && (tab !== 'sticky' || t.kind === 'sticky'));
    if (tab === 'done') return [{ key: 'done', label: '完成的，也值得留一会儿', tasks: items.sort((a,b) => b.completedAt - a.completedAt) }];
    const definitions = [ ['sticky', '常驻提醒'], ['overdue', '已经逾期'], ['near', '快到时间了'], ['repeat', '日常循环'], ['normal', '接下来'] ];
    const pick = t => { if (t.repeat) return 'repeat'; const d = deadline(t, opts, now).level; return d === 'overdue' ? 'overdue' : ['soon','urgent'].includes(d) ? 'near' : d === 'sticky' ? 'sticky' : 'normal'; };
    return definitions.map(([key, label]) => ({ key, label, tasks: items.filter(t => pick(t) === key).sort(compare) })).filter(g => g.tasks.length);
  }
  function apply(state, action, makeId, now = Date.now()) {
    const next = structuredClone(state);
    if (action.type === 'add') {
      if (next.tasks.length >= 5000) throw new Error('记录已满，请导出并清理一些已完成的记录。');
      next.tasks.push(task({ ...action.task, id: makeId(), createdAt: now, updatedAt: now, completedAt: null }, now));
    } else if (action.type === 'update') {
      const index = next.tasks.findIndex(t => t.id === action.id);
      if (index < 0) throw new Error('这条记录已经不在了。');
      const old = next.tasks[index];
      next.tasks[index] = task({ ...old, ...action.task, id: old.id, createdAt: old.createdAt, completedAt: old.completedAt, updatedAt: now }, now);
      if (old.dueAt !== next.tasks[index].dueAt || old.kind !== next.tasks[index].kind || old.repeat !== next.tasks[index].repeat) delete next.notices[old.id];
    } else if (action.type === 'toggle') {
      const t = next.tasks.find(t => t.id === action.id);
      if (!t) throw new Error('这条记录已经不在了。');
      if (t.occurrenceOf) throw new Error('这是循环事项的完成记录，请用撤销恢复刚完成的那一次。');
      if (t.repeat && !t.completedAt) {
        if (next.tasks.length >= 5000) throw new Error('记录已满，请先清理一些已完成的记录。');
        next.tasks.push(task({ ...t, id: makeId(), repeat: null, occurrenceOf: t.id,
          occurrenceRepeat: t.repeat, completedAt: now, createdAt: now, updatedAt: now }, now));
        t.dueAt = nextRepeat(t.dueAt, t.repeat, Math.max(now, Date.parse(t.dueAt)));
      } else t.completedAt = t.completedAt ? null : now;
      t.updatedAt = now;
      delete next.notices[t.id];
    } else if (action.type === 'delete') {
      next.tasks = next.tasks.filter(t => t.id !== action.id); delete next.notices[action.id];
    } else if (action.type === 'settings') {
      next.settings = settings({ ...next.settings, ...action.settings });
    } else throw new Error('不支持这个操作。');
    return ['add','update'].includes(action.type) ? rollRecurring(next,now) : next;
  }
  function rollRecurring(state, now = Date.now()) {
    let next = state;
    for (let i = 0; i < state.tasks.length; i++) {
      const t = state.tasks[i];
      if (!t.repeat || t.completedAt) continue;
      const dueAt = nextRepeat(t.dueAt, t.repeat, now, true);
      if (dueAt !== t.dueAt) {
        if (next === state) next = structuredClone(state);
        next.tasks[i].dueAt = dueAt; next.tasks[i].updatedAt = now; delete next.notices[t.id];
      }
    }
    return next;
  }
  function reminderCandidates(state, now = Date.now()) {
    if (!state.settings.reminders) return [];
    return state.tasks.filter(t => !t.completedAt && t.kind === 'task' && t.dueAt).map(t => {
      const d = deadline(t, state.settings, now), key = t.dueAt + '|' + (t.repeat ? 'repeat' : d.level);
      return { task: t, deadline: d, key };
    }).filter(x => (x.task.repeat ? x.deadline.ms <= 0 : ['urgent','overdue'].includes(x.deadline.level)) && state.notices[x.task.id] !== x.key);
  }
  return { HOUR, DAY, defaults, repeats, nextRepeat, rollRecurring, defaultState, settings, task, validateState, deadline, groups, apply, reminderCandidates };
});
