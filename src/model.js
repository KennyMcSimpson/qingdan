(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EdgewiseModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MINUTE = 60000, HOUR = 3600000, DAY = 24 * HOUR;
  const defaults = Object.freeze({
    theme: 'paper', accent: 'sage', alwaysOnTop: true,
    opacity: 1, warnDays: 3, urgentHours: 24, reminders: true, launchOnStartup: false,
    autoTuck: true, stickyCollapsed: false, hideFromCapture: false
  });
  function defaultState() { return { version: 1, tasks: [], settings: { ...defaults }, window: {}, notices: {} }; }
  function settings(input = {}) {
    return {
      theme: input.theme === 'dark' ? 'dark' : 'paper',
      accent: ['sage', 'blue', 'rose'].includes(input.accent) ? input.accent : defaults.accent,
      alwaysOnTop: typeof input.alwaysOnTop === 'boolean' ? input.alwaysOnTop : defaults.alwaysOnTop,
      opacity: Number.isFinite(input.opacity) ? Math.min(1, Math.max(.8, input.opacity)) : 1,
      warnDays: [1, 3, 7, 14].includes(input.warnDays) ? input.warnDays : 3,
      urgentHours: [6, 12, 24].includes(input.urgentHours) ? input.urgentHours : 24,
      reminders: typeof input.reminders === 'boolean' ? input.reminders : true,
      launchOnStartup: input.launchOnStartup === true,
      autoTuck: typeof input.autoTuck === 'boolean' ? input.autoTuck : true,
      stickyCollapsed: input.stickyCollapsed === true,
      hideFromCapture: input.hideFromCapture === true
    };
  }
  const repeats = Object.freeze({ daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly' });
  const DAY_NAMES = Object.freeze({
    sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
    wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5, sat: 6, saturday: 6
  });
  const MONTH_NAMES = Object.freeze({
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
    sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
  });

  // Calendar arithmetic preserves the wall clock across daylight-saving changes.
  function nextRepeat(dueAt, repeat, after = Date.now(), includeToday = false) {
    if (typeof repeat !== 'string' || !Object.hasOwn(repeats, repeat)) throw new Error('Unsupported repeat schedule.');
    const d = new Date(dueAt);
    if (!Number.isFinite(d.getTime())) throw new Error('Recurring tasks require a valid reminder time.');
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
    if (!input || typeof input !== 'object') throw new Error('Invalid task record.');
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title) throw new Error('Please enter a task title.');
    if (title.length > 160) throw new Error('Titles can be at most 160 characters.');
    const note = typeof input.note === 'string' ? input.note.trim() : '';
    if (note.length > 5000) throw new Error('Notes can be at most 5,000 characters.');
    const kind = input.kind === 'sticky' ? 'sticky' : 'task';
    let dueAt = null;
    if (input.dueAt && kind === 'task') {
      const n = Date.parse(input.dueAt);
      if (!Number.isFinite(n) || n < 0 || n > 253402300799999) throw new Error('Invalid deadline date. Please pick again.');
      dueAt = new Date(n).toISOString();
    }
    if (typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.id)) throw new Error('Invalid record ID.');
    const repeat = kind === 'sticky' ? null : input.repeat || null;
    if (repeat && (typeof repeat !== 'string' || !Object.hasOwn(repeats, repeat))) throw new Error('Unsupported repeat schedule.');
    if (repeat && !dueAt) throw new Error('Recurring tasks require a date and reminder time.');
    if (repeat === 'weekdays' && [0, 6].includes(new Date(dueAt).getDay())) dueAt = nextRepeat(dueAt, repeat, Date.parse(dueAt), true);
    const occurrenceOf = typeof input.occurrenceOf === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(input.occurrenceOf) ? input.occurrenceOf : null;
    return {
      id: input.id, title, note, kind, dueAt, repeat,
      occurrenceOf, occurrenceRepeat: occurrenceOf && Object.hasOwn(repeats, input.occurrenceRepeat) ? input.occurrenceRepeat : null,
      important: input.important === true,
      createdAt: Number.isFinite(input.createdAt) ? input.createdAt : now,
      updatedAt: Number.isFinite(input.updatedAt) ? input.updatedAt : now,
      completedAt: Number.isFinite(input.completedAt) && input.completedAt > 0 ? input.completedAt : null
    };
  }

  function validateState(input) {
    if (!input || input.version !== 1 || !Array.isArray(input.tasks)) throw new Error('Not a valid Edgewise backup or unsupported version.');
    if (input.tasks.length > 5000) throw new Error('Up to 5,000 records are supported. Archive old entries first.');
    const tasks = input.tasks.map(t => task(t));
    if (new Set(tasks.map(t => t.id)).size !== tasks.length) throw new Error('Backup contains duplicate record IDs.');
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

  function formatUnit(amount, unit) {
    return amount + unit;
  }

  function deadline(t, opts = defaults, now = Date.now()) {
    if (t.completedAt) return { level: 'done', text: t.kind === 'sticky' ? 'Archived' : 'Done', ms: Infinity };
    if (t.kind === 'sticky') return { level: 'sticky', text: 'Pinned', ms: Infinity };
    if (!t.dueAt) return { level: 'none', text: '', ms: Infinity };
    const ms = Date.parse(t.dueAt) - now, a = Math.abs(ms);
    const duration = a >= DAY ? formatUnit(Math.ceil(a / DAY), 'd') : a >= HOUR ? formatUnit(Math.ceil(a / HOUR), 'h') : formatUnit(Math.max(1, Math.ceil(a / MINUTE)), 'm');
    if (ms <= 0) {
      const elapsed = a >= DAY ? formatUnit(Math.floor(a / DAY), 'd') : a >= HOUR ? formatUnit(Math.floor(a / HOUR), 'h') : formatUnit(Math.floor(a / MINUTE), 'm');
      return { level: 'overdue', text: a < MINUTE ? 'Due now' : elapsed + ' overdue', ms };
    }
    const level = ms <= opts.urgentHours * HOUR ? 'urgent' : ms <= opts.warnDays * DAY ? 'soon' : 'future';
    return { level, text: duration + ' left', ms };
  }

  function runway(t, opts = defaults, now = Date.now()) {
    if (!t || t.completedAt || t.kind === 'sticky' || !t.dueAt || t.repeat) return null;
    const dueMs = Date.parse(t.dueAt);
    if (!Number.isFinite(dueMs)) return null;
    const d = deadline(t, opts, now);
    if (dueMs <= now) return { ratio: 1, level: 'overdue' };
    const startMs = Number.isFinite(t.createdAt) && t.createdAt < dueMs ? t.createdAt : Math.min(now, dueMs - HOUR);
    const span = Math.max(MINUTE, dueMs - startMs);
    const ratio = Math.min(1, Math.max(0.04, (now - startMs) / span));
    return { ratio, level: d.level };
  }

  function parseTimeToken(hourStr, minStr, meridiem) {
    let h = Number(hourStr), m = minStr ? Number(minStr) : 0;
    if (!Number.isInteger(h) || !Number.isInteger(m) || m < 0 || m > 59) return null;
    if (meridiem) {
      const ampm = meridiem.toLowerCase();
      if (h < 1 || h > 12) return null;
      if (ampm === 'am') h = h === 12 ? 0 : h;
      else h = h === 12 ? 12 : h + 12;
    } else if (h < 0 || h > 23) {
      return null;
    }
    return { hour: h, minute: m };
  }

  function extractTime(text) {
    const m12 = text.match(/(?:^|\s)(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s|$)/i);
    if (m12) {
      const t = parseTimeToken(m12[1], m12[2], m12[3]);
      if (t) return { ...t, text: (text.slice(0, m12.index) + ' ' + text.slice(m12.index + m12[0].length)).trim() };
    }
    const m24 = text.match(/(?:^|\s)(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)/i);
    if (m24) {
      const t = parseTimeToken(m24[1], m24[2], null);
      if (t) return { ...t, text: (text.slice(0, m24.index) + ' ' + text.slice(m24.index + m24[0].length)).trim() };
    }
    return null;
  }

  function validCalendarDate(year, monthIndex, day) {
    const d = new Date(year, monthIndex, day, 12, 0, 0, 0);
    return d.getFullYear() === year && d.getMonth() === monthIndex && d.getDate() === day;
  }

  // Zero-dependency offline natural-language quick capture parser.
  // Never mutates input if removing tokens would leave an empty title.
  function parseQuickInput(raw, now = Date.now()) {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    const fallback = { title: trimmed, kind: 'task', dueAt: null, repeat: null, important: false, parsed: false, chips: [] };
    if (!trimmed) return fallback;

    let work = trimmed;
    let kind = 'task';
    let important = false;
    let dueAt = null;
    let repeat = null;
    const chips = [];

    // 1. Pinned / sticky prefix: "pin: ..." or "sticky: ..."
    const pinMatch = work.match(/^(?:pin|sticky)\s*:\s*(.+)$/i);
    if (pinMatch) {
      kind = 'sticky';
      work = pinMatch[1].trim();
      chips.push({ kind: 'sticky', label: 'Pinned' });
    }

    // 2. Importance marker: trailing "!", "!important", or "#important"
    const impToken = work.match(/(?:^|\s)(?:!important|#important)(?=\s|$)/i);
    if (impToken) {
      important = true;
      work = (work.slice(0, impToken.index) + ' ' + work.slice(impToken.index + impToken[0].length)).trim();
      chips.push({ kind: 'important', label: 'Important' });
    } else if (/\s+!$/.test(work)) {
      important = true;
      work = work.replace(/\s+!$/, '').trim();
      chips.push({ kind: 'important', label: 'Important' });
    }

    if (kind === 'task') {
      const base = new Date(now);
      let explicitDate = null;
      let defaultHour = 23, defaultMinute = 59;

      // 3. Recurrence: "every day", "daily", "every weekday(s)", "weekdays", "every mon..sun", "weekly"
      const recEveryDay = work.match(/(?:^|\s)(?:every\s+day|daily)(?=\s|$)/i);
      const recWeekdays = !recEveryDay && work.match(/(?:^|\s)(?:every\s+weekdays?|weekdays?)(?=\s|$)/i);
      const recEveryWeekday = !recEveryDay && !recWeekdays && work.match(/(?:^|\s)every\s+(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)(?=\s|$)/i);
      const recWeekly = !recEveryDay && !recWeekdays && !recEveryWeekday && work.match(/(?:^|\s)weekly(?=\s|$)/i);

      if (recEveryDay) {
        repeat = 'daily';
        defaultHour = 9; defaultMinute = 0;
        explicitDate = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        work = (work.slice(0, recEveryDay.index) + ' ' + work.slice(recEveryDay.index + recEveryDay[0].length)).trim();
      } else if (recWeekdays) {
        repeat = 'weekdays';
        defaultHour = 9; defaultMinute = 0;
        explicitDate = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        work = (work.slice(0, recWeekdays.index) + ' ' + work.slice(recWeekdays.index + recWeekdays[0].length)).trim();
      } else if (recEveryWeekday) {
        repeat = 'weekly';
        defaultHour = 9; defaultMinute = 0;
        const targetDay = DAY_NAMES[recEveryWeekday[1].toLowerCase()];
        const delta = (targetDay - base.getDay() + 7) % 7;
        explicitDate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta);
        work = (work.slice(0, recEveryWeekday.index) + ' ' + work.slice(recEveryWeekday.index + recEveryWeekday[0].length)).trim();
      } else if (recWeekly) {
        repeat = 'weekly';
        defaultHour = 9; defaultMinute = 0;
        explicitDate = new Date(base.getFullYear(), base.getMonth(), base.getDate());
        work = (work.slice(0, recWeekly.index) + ' ' + work.slice(recWeekly.index + recWeekly[0].length)).trim();
      }

      // 4. Relative duration: "+30m", "+2h", "+3d", "+1w" (only if not recurring)
      let relativeMs = null;
      if (!repeat) {
        const relMatch = work.match(/(?:^|\s)\+(\d{1,3})(m|min|mins|h|hr|hrs|d|w)(?=\s|$)/i);
        if (relMatch) {
          const amount = Number(relMatch[1]);
          const unit = relMatch[2].toLowerCase()[0];
          if (amount > 0 && amount <= 365) {
            const mult = unit === 'm' ? MINUTE : unit === 'h' ? HOUR : unit === 'd' ? DAY : 7 * DAY;
            relativeMs = now + amount * mult;
            work = (work.slice(0, relMatch.index) + ' ' + work.slice(relMatch.index + relMatch[0].length)).trim();
          }
        }
      }

      // 5. Explicit calendar date or named day (when no relative offset matched)
      let sameWeekdayDeferred = false;
      if (!relativeMs && !explicitDate) {
        const isoMatch = work.match(/(?:^|\s)(\d{4})-(\d{1,2})-(\d{1,2})(?=\s|$)/);
        const slashMatch = !isoMatch && work.match(/(?:^|\s)(?:(?:on|by|due)\s+)?(\d{1,2})\/(\d{1,2})(?=\s|$)(?!\s+of\b)/i);
        const monthMatch = !isoMatch && !slashMatch && work.match(/(?:^|\s)(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?=\s|$)/i);
        const dayWordMatch = !isoMatch && !slashMatch && !monthMatch && work.match(/(?:^|\s)((?:(?:on|by|this|next)\s+)?(?:today|tonight|tomorrow|tmr|sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?))(?=\s|$)/i);

        if (isoMatch) {
          const y = Number(isoMatch[1]), mo = Number(isoMatch[2]) - 1, dy = Number(isoMatch[3]);
          if (y >= 1970 && y <= 2100 && validCalendarDate(y, mo, dy)) {
            explicitDate = new Date(y, mo, dy);
            work = (work.slice(0, isoMatch.index) + ' ' + work.slice(isoMatch.index + isoMatch[0].length)).trim();
          }
        } else if (slashMatch) {
          const mo = Number(slashMatch[1]) - 1, dy = Number(slashMatch[2]);
          let y = base.getFullYear();
          if (mo >= 0 && mo <= 11 && validCalendarDate(y, mo, dy)) {
            const candidate = new Date(y, mo, dy, 23, 59, 0, 0);
            if (candidate.getTime() < now - DAY) y += 1;
            if (validCalendarDate(y, mo, dy)) {
              explicitDate = new Date(y, mo, dy);
              work = (work.slice(0, slashMatch.index) + ' ' + work.slice(slashMatch.index + slashMatch[0].length)).trim();
            }
          }
        } else if (monthMatch) {
          const mo = MONTH_NAMES[monthMatch[1].toLowerCase()];
          const dy = Number(monthMatch[2]);
          let y = base.getFullYear();
          if (validCalendarDate(y, mo, dy)) {
            const candidate = new Date(y, mo, dy, 23, 59, 0, 0);
            if (candidate.getTime() < now - DAY) y += 1;
            if (validCalendarDate(y, mo, dy)) {
              explicitDate = new Date(y, mo, dy);
              work = (work.slice(0, monthMatch.index) + ' ' + work.slice(monthMatch.index + monthMatch[0].length)).trim();
            }
          }
        } else if (dayWordMatch) {
          const rawToken = dayWordMatch[1].toLowerCase().replace(/\s+/g, ' ');
          const prefixMatch = /^(on|by|this|next)\s+(.+)$/.exec(rawToken);
          const prefix = prefixMatch ? prefixMatch[1] : '';
          const core = prefixMatch ? prefixMatch[2] : rawToken;
          // Avoid false positives for bare "sat" / "sun" mid-sentence (e.g., "Fix sat exam", "Check sun glare")
          // unless preceded by on/by/this/next, at the start/end of input, or paired with a wall-clock time.
          const afterSlice = work.slice(dayWordMatch.index + dayWordMatch[0].length).trim();
          const beforeSlice = work.slice(0, dayWordMatch.index).trim();
          const isAmbiguousBareWord = !prefix && (core === 'sat' || core === 'sun');
          const hasTimeContext = !!extractTime(afterSlice) || !!extractTime(beforeSlice);
          const allowedDayWord = !isAmbiguousBareWord || !beforeSlice || !afterSlice || hasTimeContext;

          if (allowedDayWord) {
            if (core === 'today' && (!prefix || prefix === 'by')) {
              explicitDate = new Date(base.getFullYear(), base.getMonth(), base.getDate());
            } else if (core === 'tonight' && !prefix) {
              explicitDate = new Date(base.getFullYear(), base.getMonth(), base.getDate());
              defaultHour = 21; defaultMinute = 0;
            } else if ((core === 'tomorrow' || core === 'tmr') && (!prefix || prefix === 'by')) {
              explicitDate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
            } else if (DAY_NAMES[core] !== undefined) {
              const targetDay = DAY_NAMES[core];
              let delta = (targetDay - base.getDay() + 7) % 7;
              if (prefix === 'next') {
                delta += 7;
              } else if (delta === 0) {
                sameWeekdayDeferred = true;
              }
              explicitDate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta);
            }
            if (explicitDate) {
              work = (work.slice(0, dayWordMatch.index) + ' ' + work.slice(dayWordMatch.index + dayWordMatch[0].length)).trim();
            }
          }
        }
      }

      // 6. Optional wall-clock time (e.g. "18:00", "6pm", "at 9:30am")
      if (relativeMs) {
        dueAt = new Date(relativeMs).toISOString();
      } else {
        const timeFound = extractTime(work);
        if (timeFound) {
          work = timeFound.text;
          if (!explicitDate) {
            explicitDate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), timeFound.hour, timeFound.minute, 0, 0);
            if (!repeat && explicitDate.getTime() <= now) explicitDate.setDate(explicitDate.getDate() + 1);
          } else {
            explicitDate.setHours(timeFound.hour, timeFound.minute, 0, 0);
            if (sameWeekdayDeferred && explicitDate.getTime() <= now) explicitDate.setDate(explicitDate.getDate() + 7);
          }
        } else if (explicitDate) {
          if (sameWeekdayDeferred) explicitDate.setDate(explicitDate.getDate() + 7);
          explicitDate.setHours(defaultHour, defaultMinute, 0, 0);
        }
        if (explicitDate) {
          dueAt = repeat ? nextRepeat(explicitDate.toISOString(), repeat, now, true) : explicitDate.toISOString();
        }
      }

      if (repeat && dueAt) {
        const d = new Date(dueAt);
        const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
        chips.push({ kind: 'repeat', label: repeats[repeat] + ' · ' + hh + ':' + mm });
      } else if (dueAt) {
        const d = new Date(dueAt);
        const label = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        chips.push({ kind: 'due', label: 'Due ' + label });
      }
    }

    const cleanTitle = work.replace(/\s+/g, ' ').replace(/[-:,;]+$/, '').trim();
    if (!cleanTitle || chips.length === 0) return fallback;
    return { title: cleanTitle.slice(0, 160), kind, dueAt, repeat, important, parsed: true, chips };
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
    if (tab === 'done') return [{ key: 'done', label: 'Completed', tasks: items.sort((a, b) => b.completedAt - a.completedAt) }];
    const definitions = [['sticky', 'Pinned'], ['overdue', 'Overdue'], ['near', 'Due soon'], ['repeat', 'Routines'], ['normal', 'Upcoming']];
    const pick = t => { if (t.repeat) return 'repeat'; const d = deadline(t, opts, now).level; return d === 'overdue' ? 'overdue' : ['soon', 'urgent'].includes(d) ? 'near' : d === 'sticky' ? 'sticky' : 'normal'; };
    return definitions.map(([key, label]) => ({ key, label, tasks: items.filter(t => pick(t) === key).sort(compare) })).filter(g => g.tasks.length);
  }

  function snoozeDue(dueAt, preset, now = Date.now()) {
    const baseMs = dueAt ? Date.parse(dueAt) : now;
    if (!Number.isFinite(baseMs)) throw new Error('Invalid deadline date.');
    if (preset === '+1h') return new Date(Math.max(now, baseMs) + HOUR).toISOString();
    if (preset === 'tomorrow') {
      const orig = new Date(baseMs);
      const tmr = new Date(now);
      tmr.setDate(tmr.getDate() + 1);
      tmr.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
      // Never pull a future deadline earlier than its existing date.
      if (tmr.getTime() <= baseMs) {
        const next = new Date(baseMs);
        next.setDate(next.getDate() + 1);
        return next.toISOString();
      }
      return tmr.toISOString();
    }
    if (preset === '+1w') {
      const next = new Date(Math.max(now, baseMs));
      next.setDate(next.getDate() + 7);
      return next.toISOString();
    }
    throw new Error('Unsupported snooze preset.');
  }

  function apply(state, action, makeId, now = Date.now()) {
    const next = structuredClone(state);
    if (action.type === 'add') {
      if (next.tasks.length >= 5000) throw new Error('Record limit reached (5,000). Export and clear completed items first.');
      next.tasks.push(task({ ...action.task, id: makeId(), createdAt: now, updatedAt: now, completedAt: null }, now));
    } else if (action.type === 'update') {
      const index = next.tasks.findIndex(t => t.id === action.id);
      if (index < 0) throw new Error('This record no longer exists.');
      const old = next.tasks[index];
      next.tasks[index] = task({ ...old, ...action.task, id: old.id, createdAt: old.createdAt, completedAt: old.completedAt, updatedAt: now }, now);
      if (old.dueAt !== next.tasks[index].dueAt || old.kind !== next.tasks[index].kind || old.repeat !== next.tasks[index].repeat) delete next.notices[old.id];
    } else if (action.type === 'snooze') {
      const index = next.tasks.findIndex(t => t.id === action.id);
      if (index < 0) throw new Error('This record no longer exists.');
      const old = next.tasks[index];
      if (old.completedAt || old.kind === 'sticky' || !old.dueAt || old.repeat) throw new Error('Only active one-time deadlines can be snoozed.');
      const newDue = snoozeDue(old.dueAt, action.preset, now);
      next.tasks[index] = task({ ...old, dueAt: newDue, updatedAt: now }, now);
      delete next.notices[old.id];
    } else if (action.type === 'toggle') {
      const t = next.tasks.find(t => t.id === action.id);
      if (!t) throw new Error('This record no longer exists.');
      if (t.occurrenceOf) throw new Error('This is a completed routine occurrence. Use Undo to revert the most recent completion.');
      if (t.repeat && !t.completedAt) {
        if (next.tasks.length >= 5000) throw new Error('Record limit reached (5,000). Clear completed items first.');
        next.tasks.push(task({
          ...t, id: makeId(), repeat: null, occurrenceOf: t.id,
          occurrenceRepeat: t.repeat, completedAt: now, createdAt: now, updatedAt: now
        }, now));
        t.dueAt = nextRepeat(t.dueAt, t.repeat, Math.max(now, Date.parse(t.dueAt)));
      } else t.completedAt = t.completedAt ? null : now;
      t.updatedAt = now;
      delete next.notices[t.id];
    } else if (action.type === 'delete') {
      next.tasks = next.tasks.filter(t => t.id !== action.id); delete next.notices[action.id];
    } else if (action.type === 'settings') {
      next.settings = settings({ ...next.settings, ...action.settings });
    } else throw new Error('Unsupported action.');
    return ['add', 'update'].includes(action.type) ? rollRecurring(next, now) : next;
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
    }).filter(x => (x.task.repeat ? x.deadline.ms <= 0 : ['urgent', 'overdue'].includes(x.deadline.level)) && state.notices[x.task.id] !== x.key);
  }

  function fmtLocalIso(iso) {
    const d = new Date(iso);
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function toMarkdown(state, now = Date.now()) {
    const lines = ['# Edgewise Tasks', '', '_Exported ' + fmtLocalIso(new Date(now).toISOString()) + '_', ''];
    const activeGroups = groups(state.tasks, 'all', '', state.settings, now);
    const doneGroups = groups(state.tasks, 'done', '', state.settings, now);
    const allGroups = [...activeGroups, ...doneGroups];
    if (!allGroups.length) {
      lines.push('_No tasks._', '');
      return lines.join('\n');
    }
    for (const g of allGroups) {
      lines.push('## ' + g.label, '');
      for (const t of g.tasks) {
        const box = t.completedAt ? '[x]' : '[ ]';
        const tags = [];
        if (t.important) tags.push('!');
        if (t.kind === 'sticky') tags.push('@pinned');
        if (t.repeat) tags.push('@repeat(' + t.repeat + ')');
        if (t.dueAt) tags.push('@due(' + fmtLocalIso(t.dueAt) + ')');
        const suffix = tags.length ? ' ' + tags.join(' ') : '';
        lines.push('- ' + box + ' ' + t.title + suffix);
        if (t.note) {
          for (const noteLine of t.note.split(/\r?\n/)) {
            lines.push('  > ' + noteLine);
          }
        }
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  return {
    MINUTE, HOUR, DAY, defaults, repeats, nextRepeat, rollRecurring, defaultState,
    settings, task, validateState, deadline, runway, parseQuickInput, snoozeDue,
    groups, apply, reminderCandidates, toMarkdown
  };
});
