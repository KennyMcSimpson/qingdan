'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const M = require('../src/model');
const { Store } = require('../src/store');
const now = Date.parse('2026-09-26T16:00:00Z');
const make = (ms, extra = {}) => M.task({ id:'test-1',title:'论文终稿',dueAt:ms === null ? null : new Date(now+ms).toISOString(),...extra },now);
function temp(t) { const p = fs.mkdtempSync(path.join(os.tmpdir(),'qingdan-test-')); t.after(() => fs.rmSync(p,{recursive:true,force:true})); return p; }
test('deadline colors cross precise warning, urgent, and overdue boundaries',() => {
  for (const [ms,level] of [[4*M.DAY,'future'],[3*M.DAY+1,'future'],[3*M.DAY,'soon'],[M.DAY+1,'soon'],[M.DAY,'urgent'],[1,'urgent'],[0,'overdue'],[-M.DAY,'overdue']]) assert.equal(M.deadline(make(ms),M.defaults,now).level,level);
});
test('custom warning thresholds are respected',() => {
  assert.equal(M.deadline(make(5*M.DAY),{...M.defaults,warnDays:7},now).level,'soon');
  assert.equal(M.deadline(make(8*M.HOUR),{...M.defaults,urgentHours:6},now).level,'soon');
});
test('sticky, undated, and completed records never become overdue',() => {
  assert.equal(M.deadline(make(-M.DAY,{kind:'sticky'}),M.defaults,now).level,'sticky');
  assert.equal(M.deadline(make(null),M.defaults,now).level,'none');
  assert.equal(M.deadline(make(-M.DAY,{completedAt:now}),M.defaults,now).level,'done');
});
test('minutes are meaningful without showing a zero-minute future deadline',() => {
  assert.equal(M.deadline(make(1),M.defaults,now).text,'剩 1 分钟');
  assert.equal(M.deadline(make(61*60000),M.defaults,now).text,'剩 2 小时');
});
test('create, edit, complete, restore, delete preserve stable identity',() => {
  let s=M.defaultState(); s=M.apply(s,{type:'add',task:{title:'  论文提交  ',note:'注意图表'}},()=>'a',now);
  assert.equal(s.tasks[0].title,'论文提交');
  s=M.apply(s,{type:'update',id:'a',task:{id:'evil',title:'最终提交',dueAt:new Date(now+M.DAY).toISOString()}},()=>'',now+1);
  assert.equal(s.tasks[0].id,'a'); assert.equal(s.tasks[0].createdAt,now);
  s=M.apply(s,{type:'toggle',id:'a'},()=>'',now+2); assert.equal(s.tasks[0].completedAt,now+2);
  s=M.apply(s,{type:'toggle',id:'a'},()=>'',now+3); assert.equal(s.tasks[0].completedAt,null);
  s=M.apply(s,{type:'delete',id:'a'},()=>'',now+4); assert.equal(s.tasks.length,0);
});
test('changing kind clears a deadline and its notification marker',() => {
  let s={...M.defaultState(),tasks:[make(M.HOUR)],notices:{'test-1':'old'}};
  s=M.apply(s,{type:'update',id:'test-1',task:{kind:'sticky'}},()=>'',now);
  assert.equal(s.tasks[0].dueAt,null); assert.equal(s.notices['test-1'],undefined);
});
test('invalid titles, dates, future schemas, and duplicate IDs are rejected',() => {
  assert.throws(()=>M.task({id:'a',title:'  '}));
  assert.throws(()=>M.task({id:'a',title:'a',dueAt:'invalid'}));
  assert.throws(()=>M.validateState({version:2,tasks:[]}));
  assert.throws(()=>M.validateState({...M.defaultState(),tasks:[make(null),make(null)]}));
});
test('unrecognized settings do not enter persisted state',() => {
  const s=M.settings({theme:'arbitrary',opacity:0,urgentHours:999,launchOnStartup:'yes',path:'not-allowed'});
  assert.equal(s.opacity,.8); assert.equal(s.urgentHours,24); assert.equal(s.launchOnStartup,false); assert.equal(s.path,undefined);
});
test('all view groups overdue, near, ordinary, and permanent notes separately',() => {
  const tasks=[make(null,{id:'normal'}),make(-1,{id:'overdue'}),make(M.HOUR,{id:'near'}),make(null,{id:'sticky',kind:'sticky'}),make(null,{id:'done',completedAt:now})];
  assert.deepEqual(M.groups(tasks,'all','',M.defaults,now).map(g=>g.key),['overdue','near','normal','sticky']);
  assert.equal(M.groups(tasks,'ddl','',M.defaults,now).flatMap(g=>g.tasks).length,2);
  assert.equal(M.groups(tasks,'done','',M.defaults,now)[0].tasks[0].id,'done');
});
test('search includes notes and supports literal HTML-looking titles',() => {
  const task=make(null,{title:'<img src=x onerror=alert(1)>',note:'匿名与附录'});
  assert.equal(M.groups([task],'all','附录',M.defaults,now)[0].tasks.length,1);
  assert.equal(task.title,'<img src=x onerror=alert(1)>');
});
test('reminders only fire once per phase and can be disabled',() => {
  const s={...M.defaultState(),tasks:[make(M.HOUR)]};
  let c=M.reminderCandidates(s,now); assert.equal(c.length,1);
  s.notices[c[0].task.id]=c[0].key; assert.equal(M.reminderCandidates(s,now).length,0);
  assert.equal(M.reminderCandidates(s,now+2*M.HOUR).length,1);
  s.settings.reminders=false; assert.equal(M.reminderCandidates(s,now+2*M.HOUR).length,0);
});
test('JSON roundtrip preserves Chinese, emoji, multiline notes, and exact deadline',t => {
  const store=new Store(temp(t));
  const s={...M.defaultState(),tasks:[make(M.HOUR,{title:'提交论文 ✅',note:'第一行\n第二行 < > &'})]};
  store.write(s); assert.deepEqual(store.load().tasks,s.tasks);
});
test('corrupt primary recovers valid prior write and retains corrupt bytes',t => {
  const store=new Store(temp(t)); const original={...M.defaultState(),tasks:[make(null)]};
  store.write(original); store.write({...original,tasks:[]}); fs.writeFileSync(store.file,'{broken');
  assert.equal(store.load().tasks[0].title,'论文终稿');
  assert.match(store.notice,/恢复/);
  assert.ok(fs.readdirSync(store.directory).some(f=>f.includes('.damaged-')));
  assert.equal(JSON.parse(fs.readFileSync(store.backup)).tasks.length,1);
});
test('missing primary still recovers its backup',t => {
  const store=new Store(temp(t)); const s={...M.defaultState(),tasks:[make(null)]};
  store.write(s); store.write(s); fs.unlinkSync(store.file); assert.equal(store.load().tasks.length,1);
});
test('two corrupt copies fail visibly without replacing user data with empty state',t => {
  const store=new Store(temp(t)); fs.writeFileSync(store.file,'bad'); fs.writeFileSync(store.backup,'also bad');
  assert.throws(()=>store.load(),/无法读取/); assert.equal(fs.readFileSync(store.file,'utf8'),'bad');
});
test('failed atomic rename leaves the previous file intact',t => {
  const store=new Store(temp(t)); const original={...M.defaultState(),tasks:[make(null)]}; store.write(original);
  const rename=fs.renameSync; fs.renameSync=()=>{throw new Error('simulated disk failure');};
  try { assert.throws(()=>store.write({...original,tasks:[]}),/disk failure/); }
  finally { fs.renameSync=rename; }
  assert.equal(store.load().tasks.length,1);
  assert.equal(fs.readdirSync(store.directory).filter(n=>n.endsWith('.tmp')).length,0);
});
test('snapshots are bounded and retain valid import backups',t => {
  const store=new Store(temp(t)); store.snapshot(M.defaultState(),'before-import');
  const files=fs.readdirSync(path.join(store.directory,'backups')); assert.equal(files.length,1); assert.match(files[0],/before-import/);
});
