'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validateState, defaultState } = require('./model');

class Store {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'edgewise.json');
    this.backup = this.file + '.bak';
    this.notice = '';
    fs.mkdirSync(directory, { recursive: true });
  }
  static migrateLegacy(legacyDirectory, targetDirectory) {
    const targetPrimary = path.join(targetDirectory, 'edgewise.json');
    const targetBackup = targetPrimary + '.bak';
    if (fs.existsSync(targetPrimary) || fs.existsSync(targetBackup)) return { migrated: false };
    if (!legacyDirectory || !fs.existsSync(legacyDirectory)) return { migrated: false };
    const legacyPrimary = path.join(legacyDirectory, 'qingdan.json');
    const legacyBackup = legacyPrimary + '.bak';
    if (!fs.existsSync(legacyPrimary) && !fs.existsSync(legacyBackup)) return { migrated: false };
    fs.mkdirSync(targetDirectory, { recursive: true });
    const atomicCopy = (src, dst) => {
      const tmp = dst + '.migrate-' + process.pid + '.tmp';
      try { fs.copyFileSync(src, tmp); fs.renameSync(tmp, dst); }
      finally { if (fs.existsSync(tmp)) { try { fs.unlinkSync(tmp); } catch (_) {} } }
    };
    if (fs.existsSync(legacyBackup)) atomicCopy(legacyBackup, targetBackup);
    if (fs.existsSync(legacyPrimary)) atomicCopy(legacyPrimary, targetPrimary);
    const legacyBackupsDir = path.join(legacyDirectory, 'backups');
    if (fs.existsSync(legacyBackupsDir)) {
      const targetBackupsDir = path.join(targetDirectory, 'backups');
      fs.mkdirSync(targetBackupsDir, { recursive: true });
      for (const name of fs.readdirSync(legacyBackupsDir)) {
        if (!name.endsWith('.json')) continue;
        const src = path.join(legacyBackupsDir, name);
        const dst = path.join(targetBackupsDir, name);
        if (!fs.existsSync(dst)) {
          try { atomicCopy(src, dst); } catch (_) {}
        }
      }
    }
    return { migrated: true };
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
        this.notice = 'Data file was damaged and has been recovered from local backup. The damaged file was retained.';
        return recovered;
      } catch (backupError) {
        throw new Error('Could not read task data; original files were preserved. Check your data folder or restore from an exported backup.\n' + this.directory);
      }
    }
  }
  write(state, preserve = true) {
    const clean = validateState(state);
    const temporary = path.join(this.directory, '.edgewise-' + process.pid + '.tmp');
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
    const name = label === 'daily' ? date + '-daily.json' : new Date().toISOString().replace(/[:.]/g, '-') + '-' + label + '.json';
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(validateState(state), null, 2), { encoding: 'utf8', mode: 0o600 });
    const all = fs.readdirSync(dir).filter(n => n.endsWith('.json')).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 20))) fs.unlinkSync(path.join(dir, old));
  }
}
module.exports = { Store };
