'use strict';
// Real Electron UI + IPC integration. Run with ELECTRON_BINARY and a display.
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname,'..');
const data = fs.mkdtempSync(path.join(os.tmpdir(),'qingdan-ui-'));
const images = path.resolve(process.env.QINGDAN_SCREENSHOTS || path.join(root,'qa'));
fs.mkdirSync(images,{recursive:true});
const errors=[], checks=[];
let desktop, page;
async function check(name, fn) { await fn(); checks.push(name); console.log('PASS',name); }
async function start() {
  const env={...process.env, QINGDAN_TEST_DATA:data}; delete env.ELECTRON_RUN_AS_NODE;
  const binary=process.env.ELECTRON_BINARY || require('electron');
  const launchArgs=process.platform === 'linux' && process.getuid && process.getuid() === 0 ? ['--no-sandbox',root] : [root];
  desktop=await electron.launch({executablePath:binary,args:launchArgs,env,timeout:60000});
  page=await desktop.firstWindow();
  page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>window.qingdan && document.querySelector('#todayDate').textContent.length>0);
  await page.evaluate(()=>document.fonts.ready);
}
async function state() { return (await page.evaluate(()=>window.qingdan.read())).state; }
async function action(a) { const r=await page.evaluate(a=>window.qingdan.action(a),a); if(r.error)throw new Error(r.error); return r; }
async function count(n) { await page.waitForFunction(n=>document.querySelector('#countAll').textContent===String(n),n); }
async function shot(name) { await page.screenshot({path:path.join(images,name+'.png')}); }
async function main() {
  await start();
  await check('empty window opens without renderer errors',async()=>{assert.equal((await state()).tasks.length,0);assert.equal(await page.locator('#emptyState').isVisible(),true);await shot('empty');});
  await check('quick add accepts Chinese and Enter',async()=>{await page.locator('#quickInput').fill('整理实验记录');await page.locator('#quickInput').press('Enter');await count(1);assert.equal((await state()).tasks[0].title,'整理实验记录');});
  await check('IME composition does not accidentally submit a half-finished title',async()=>{
    await page.locator('#quickInput').fill('中文输入中');
    await page.locator('#quickInput').dispatchEvent('compositionstart');
    await page.locator('#quickForm').dispatchEvent('submit');
    assert.equal((await state()).tasks.length,1);
    await page.locator('#quickInput').dispatchEvent('compositionend');await page.locator('#quickInput').fill('');
  });
  await check('detail editor saves DDL, notes, and importance',async()=>{
    await page.locator('#detailAdd').click();await page.locator('#taskTitle').fill('提交论文终稿');await page.locator('#taskNote').fill('检查匿名、页数和图表清晰度');
    await page.locator('#hasDue').check();
    const date=new Date(Date.now()+8*3600000);const formatted=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
    await page.locator('#dueDate').fill(formatted);await page.locator('#dueTime').fill(String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0'));
    await page.locator('#taskImportant').check();await shot('editor');await page.locator('#saveTask').click();await count(2);
    const t=(await state()).tasks.find(t=>t.title==='提交论文终稿');assert.ok(t.dueAt);assert.equal(t.important,true);assert.equal(t.note,'检查匿名、页数和图表清晰度');
    assert.equal(await page.locator('.task-row[data-level=urgent]').count(),1);
  });
  await check('permanent reminders have no deadline and can be archived and restored',async()=>{
    await page.locator('[data-tab=sticky]').click();await page.locator('#quickInput').fill('重要修改后，记得备份');await page.locator('#detailAdd').click();
    assert.equal(await page.locator('#ddlControls').isVisible(),false);await page.locator('#taskNote').fill('文稿和实验结果，都留一份。');await page.locator('#saveTask').click();await count(3);
    let t=(await state()).tasks.find(t=>t.kind==='sticky');assert.equal(t.dueAt,null);
    await page.getByRole('button',{name:'编辑：重要修改后，记得备份',exact:true}).click();await page.locator('#completeTask').click();
    await page.waitForFunction(()=>document.querySelector('#countSticky').textContent==='0');
    await page.locator('#undoButton').click();await page.waitForFunction(()=>document.querySelector('#countSticky').textContent==='1');
  });
  await check('completion and undo persist immediately',async()=>{
    await page.locator('[data-tab=all]').click();await page.getByRole('button',{name:'标记完成：整理实验记录',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#countDone').textContent==='1');assert.ok((await state()).tasks.find(t=>t.title==='整理实验记录').completedAt);
    await page.locator('#undoButton').click();await page.waitForFunction(()=>document.querySelector('#countDone').textContent==='0');
  });
  await check('edit, delete and undo retain full note content',async()=>{
    await page.getByRole('button',{name:'编辑：整理实验记录',exact:true}).click();await page.locator('#taskTitle').fill('整理本周的阅读笔记');await page.locator('#taskNote').fill('方法、结果\n问题与下一步');await page.locator('#saveTask').click();
    await page.getByRole('button',{name:'编辑：整理本周的阅读笔记',exact:true}).click();await page.locator('#deleteTask').click();await count(2);await page.locator('#undoButton').click();await count(3);
    assert.equal((await state()).tasks.find(t=>t.title==='整理本周的阅读笔记').note,'方法、结果\n问题与下一步');
  });
  await check('search matches note text',async()=>{await page.locator('#searchButton').click();await page.locator('#searchInput').fill('下一步');assert.equal(await page.locator('.task-row').count(),1);await page.locator('#searchClose').click();});
  await check('HTML-like task text remains inert',async()=>{const before=(await state()).tasks.length;await action({type:'add',task:{title:'<img src=x onerror="alert(1)">',note:'<script>bad</script>'}});assert.equal(await page.locator('.task-row img,.task-row script').count(),0);const t=(await state()).tasks.find(t=>t.title.startsWith('<img'));await action({type:'delete',id:t.id});assert.equal((await state()).tasks.length,before);});
  await check('appearance and threshold changes are persisted',async()=>{
    await page.locator('#settingsButton').click();await page.locator('button[data-theme=dark]').click();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await page.locator('#warnDays').selectOption('7');await page.waitForFunction(()=>document.querySelector('#warnDays').value==='7');
    assert.equal((await state()).settings.warnDays,7);await shot('settings-dark');await page.locator('#closeSettings').click();await shot('dark');
    await page.locator('#settingsButton').click();await page.locator('button[data-theme=paper]').click();await page.locator('#warnDays').selectOption('3');await page.locator('#closeSettings').click();
  });
  await check('always-on-top uses the native window property',async()=>{
    await page.locator('#pinButton').click();assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),false);
    await page.locator('#pinButton').click();assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),true);
  });
  await check('collapse preserves expanded geometry and highlights nearest DDL',async()=>{
    const height=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds().height);
    await page.locator('#collapseButton').click();await page.waitForFunction(()=>!document.querySelector('#compactView').hidden);
    assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds().height),132);
    assert.equal(await page.locator('#compactTitle').textContent(),'提交论文终稿');await shot('compact');await page.locator('#compactView').click();
    assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds().height),height);
  });
  await check('restart restores tasks, local DDL time, and settings',async()=>{
    const before=await state();await desktop.close();await start();const after=await state();assert.deepEqual(after.tasks,before.tasks);assert.deepEqual(after.settings,before.settings);
  });
  await check('backup export and confirmed import go through native IPC with undo',async()=>{
    const backup=path.join(data,'export-test.json');
    await desktop.evaluate(({dialog},backup)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:backup});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[backup]});dialog.showMessageBox=async()=>({response:1});},backup);
    await page.locator('#settingsButton').click();await page.locator('#exportButton').click();await page.waitForFunction(()=>!document.querySelector('#settingsDialog').open);assert.ok(fs.existsSync(backup));
    await action({type:'add',task:{title:'仅用于恢复测试'}});await count(4);await page.locator('#settingsButton').click();await page.locator('#importButton').click();await count(3);
    await page.locator('#undoButton').click();await count(4);const t=(await state()).tasks.find(t=>t.title==='仅用于恢复测试');await action({type:'delete',id:t.id});
  });
  await check('hide and close retain a reachable live application',async()=>{
    await page.locator('#hideButton').click();assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
    await desktop.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.show();w.focus();});
    await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),1);
    await desktop.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.show();w.focus();});
  });
  await check('deadline groups visibly show overdue, urgent, and upcoming colors',async()=>{
    const old=(await state()).tasks.find(t=>t.title==='整理本周的阅读笔记');await action({type:'delete',id:old.id});
    await action({type:'add',task:{title:'补齐参考文献',dueAt:new Date(Date.now()-2*3600000).toISOString()}});
    await action({type:'add',task:{title:'准备下周组会',dueAt:new Date(Date.now()+2*86400000).toISOString()}});
    assert.equal(await page.locator('.task-row[data-level=overdue]').count(),1);assert.equal(await page.locator('.task-row[data-level=urgent]').count(),1);assert.equal(await page.locator('.task-row[data-level=soon]').count(),1);
    await page.locator('#toastClose').click().catch(()=>{});
    await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setBounds({width:404,height:800}));
    await shot('paper-preview');
    await action({type:'settings',settings:{theme:'dark'}});await shot('dark-preview');await action({type:'settings',settings:{theme:'paper'}});
  });
  await check('minimum-size window and long Chinese content do not overflow horizontally',async()=>{
    await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setBounds({width:340,height:420}));
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false);await shot('minimum');
    await page.locator('#detailAdd').click();await page.locator('#taskTitle').fill('这是一个较长的待办标题，用来检查输入和按钮布局');
    await page.locator('#hasDue').check();await shot('minimum-editor');assert.equal(await page.locator('#saveTask').isVisible(),true);await page.locator('.close-editor').click();
  });
  assert.deepEqual(errors,[]);
  const result={date:new Date().toISOString(),environment:'Real Electron on Linux / Xvfb; Windows package separately checked',passed:checks.length,checks,rendererErrors:errors};
  fs.writeFileSync(path.join(images,'integration-results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}
main().catch(async error=>{console.error(error);if(page)await shot('failure').catch(()=>{});process.exitCode=1;}).finally(async()=>{if(desktop)await desktop.close().catch(()=>{});console.log('Test data:',data);});
