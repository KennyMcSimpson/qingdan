'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validateState, defaultState } = require('./model');

class Store {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'qingdan.json');
    this.backup = this.file + '.bak';
    this.notice = '';
    fs.mkdirSync(directory, { recursive: true });
  }
  load() {
    const existed = fs.existsSync(this.file), backupExists = fs.existsSync(this.backup);
    if (!existed && !backupExists) return defaultState();
    let source;
    try { source = fs.readFileSync(this.file, 'utf8'); return validateState(JSON.parse(source)); }
    catch (error) {
      if (existed) {
        const retained = this.file + '.damaged-' + Date.now();
        fs.copyFileSync(this.file, retained);
      }
      try {
        const recovered = validateState(JSON.parse(fs.readFileSync(this.backup, 'utf8')));
        // Retain the valid backup: never back up a corrupt primary over it.
        this.write(recovered, false);
        this.notice = '上次的数据文件异常，已从本地备份恢复。原文件也保留了。';
        return recovered;
      } catch (backupError) {
        throw new Error('无法读取待办数据，已保留原文件。请检查数据文件夹或从导出的备份恢复。\n' + this.directory);
      }
    }
  }
  write(state, preserve = true) {
    const clean = validateState(state);
    const temporary = path.join(this.directory, '.qingdan-' + process.pid + '.tmp');
    let fd;
    try {
      fd = fs.openSync(temporary, 'w', 0o600);
      fs.writeFileSync(fd, JSON.stringify(clean, null, 2), 'utf8');
      fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      if (preserve && fs.existsSync(this.file)) fs.copyFileSync(this.file, this.backup);
      fs.renameSync(temporary, this.file);
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    return clean;
  }
  snapshot(state, label = 'daily') {
    const dir = path.join(this.directory, 'backups'); fs.mkdirSync(dir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const name = label === 'daily' ? date + '-daily.json' : new Date().toISOString().replace(/[:.]/g,'-') + '-' + label + '.json';
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(validateState(state), null, 2), { encoding: 'utf8', mode: 0o600 });
    const all = fs.readdirSync(dir).filter(n => n.endsWith('.json')).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 20))) fs.unlinkSync(path.join(dir, old));
  }
}
module.exports = { Store };
