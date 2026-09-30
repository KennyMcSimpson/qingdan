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
  // Keep the baseline interaction checks stable; automatic tucking has its own native-focus check.
  await action({type:'settings',settings:{autoTuck:false}});
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
  await check('recurring editor saves a chosen time and completes only the current occurrence',async()=>{
    await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setBounds({width:388,height:660}));
    await page.locator('[data-tab=repeat]').click();await page.locator('#quickInput').fill('每天整理桌面');await page.locator('#quickInput').press('Enter');
    assert.equal(await page.locator('#repeatSelect').inputValue(),'daily');assert.equal(await page.locator('#hasDue').isDisabled(),true);
    await page.locator('#dueTime').fill('21:30');await page.locator('#editorHeading').click();await shot('recurring-editor');await page.locator('#saveTask').click();
    let t=(await state()).tasks.find(t=>t.title==='每天整理桌面'&&t.repeat);assert.equal(t.repeat,'daily');assert.equal(new Date(t.dueAt).getHours(),21);assert.equal(new Date(t.dueAt).getMinutes(),30);
    const old=t.dueAt;await page.getByRole('button',{name:'标记完成：每天整理桌面',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#countDone').textContent==='1');
    const next=(await state()).tasks.find(x=>x.id===t.id);assert.equal(next.completedAt,null);assert.ok(Date.parse(next.dueAt)>Date.parse(old));
    const history=(await state()).tasks.find(x=>x.occurrenceOf===t.id);assert.equal(history.dueAt,old);
    await page.locator('#undoButton').click();assert.equal((await state()).tasks.find(x=>x.id===t.id).dueAt,old);
    await page.getByRole('button',{name:'编辑：每天整理桌面',exact:true}).click();await page.locator('#repeatSelect').selectOption('weekdays');await page.locator('#saveTask').click();
    assert.equal((await state()).tasks.find(x=>x.id===t.id).repeat,'weekdays');
  });
  await check('permanent reminders are above the scrollable tasks and the shelf is bounded',async()=>{
    await page.locator('[data-tab=all]').click();assert.equal(await page.locator('#stickyShelf').isVisible(),true);
    const shelf=await page.locator('#stickyShelf').boundingBox(), list=await page.locator('#listArea').boundingBox();assert.ok(shelf.y+shelf.height<=list.y+1);
    await action({type:'add',task:{title:'每天保持一点运动',kind:'sticky'}});await action({type:'add',task:{title:'大改之前留一份备份',kind:'sticky',important:true}});
    assert.equal(await page.locator('#stickyItems .shelf-row').count(),2);assert.equal(await page.locator('#viewSticky').isVisible(),true);
    await page.locator('#stickyToggle').click();assert.equal(await page.locator('#shelfBody').isVisible(),false);assert.equal((await state()).settings.stickyCollapsed,true);
    await page.locator('#stickyToggle').click();await page.locator('#viewSticky').click();assert.equal(await page.locator('#taskList .task-row').count(),3);await page.locator('[data-tab=all]').click();
  });
  await check('edge mode uses a narrow native window and restores full geometry',async()=>{
    const before=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
    await page.locator('#dockButton').click();await page.waitForFunction(()=>!document.querySelector('#edgeView').hidden);
    const b=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());assert.equal(b.width,46);assert.equal(b.height,164);
    assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),true);await shot('edge');
    await page.locator('#edgeOpen').click();await page.waitForFunction(()=>document.querySelector('#edgeView').hidden);
    const after=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());assert.equal(after.width,before.width);assert.equal(after.height,before.height);
    assert.equal(await page.locator('#fullView').isVisible(),true);
  });
  await check('blur tucks the native window but an open editor protects unsaved input',async()=>{
    await action({type:'settings',settings:{autoTuck:true}});
    await desktop.evaluate(({BrowserWindow})=>{globalThis.testFocusWindow=new BrowserWindow({width:150,height:150,show:true});globalThis.testFocusWindow.focus();});
    await page.waitForFunction(()=>!document.querySelector('#edgeView').hidden,{},{timeout:8000});
    await desktop.evaluate(({BrowserWindow})=>{globalThis.testFocusWindow.destroy();BrowserWindow.getAllWindows()[0].focus();});await page.locator('#edgeOpen').click();
    await page.locator('#detailAdd').click();await page.locator('#taskTitle').fill('这段输入不能丢');
    await desktop.evaluate(({BrowserWindow})=>{globalThis.testFocusWindow=new BrowserWindow({width:150,height:150,show:true});globalThis.testFocusWindow.focus();});
    await desktop.evaluate(()=>new Promise(resolve=>setTimeout(resolve,1200)));
    assert.equal((await page.evaluate(()=>window.qingdan.read())).tucked,false);assert.equal(await page.locator('#taskTitle').inputValue(),'这段输入不能丢');
    await desktop.evaluate(({BrowserWindow})=>{globalThis.testFocusWindow.destroy();BrowserWindow.getAllWindows()[0].focus();});await page.locator('.close-editor').click();
    await action({type:'settings',settings:{autoTuck:false}});
  });
  await check('temporary hide returns as a tab and manual recall cancels the timer',async()=>{
    await desktop.evaluate(()=>{globalThis.qingdanOriginalTimeout=setTimeout;globalThis.setTimeout=(fn,delay,...args)=>globalThis.qingdanOriginalTimeout(fn,delay===15*60000?400:delay,...args);});
    try {
      await page.locator('#quietButton').click();assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
      await page.waitForFunction(()=>!document.querySelector('#edgeView').hidden,{},{timeout:6000});
      assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),true);await page.locator('#edgeOpen').click();
      await page.locator('#quietButton').click();await desktop.evaluate(({app})=>app.emit('activate'));
      await desktop.evaluate(()=>new Promise(resolve=>setTimeout(resolve,600)));
      assert.equal((await page.evaluate(()=>window.qingdan.read())).tucked,false);
      assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),true);
    } finally {await desktop.evaluate(()=>{globalThis.setTimeout=globalThis.qingdanOriginalTimeout;delete globalThis.qingdanOriginalTimeout;});}
  });
  await check('final layout remains usable at minimum size with a full shelf',async()=>{
    await page.evaluate(()=>document.querySelector('#toast').hidden=true);
    await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setBounds({width:340,height:420}));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    const list=await page.locator('#listArea').boundingBox();assert.ok(list.height>=65);await shot('minimum-with-shelf');
    await page.locator('[data-tab=repeat]').click();await page.getByRole('button',{name:'编辑：每天整理桌面',exact:true}).click();
    const save=await page.locator('#saveTask').boundingBox();assert.ok(save.y>=0&&save.y+save.height<=420);await shot('minimum-recurring-editor');await page.locator('.close-editor').click();
    await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setBounds({width:388,height:840}));await page.locator('[data-tab=all]').click();await shot('v1.1-paper');
    await action({type:'settings',settings:{theme:'dark'}});await shot('v1.1-dark');await action({type:'settings',settings:{theme:'paper'}});
  });
  assert.deepEqual(errors,[]);
  const result={date:new Date().toISOString(),environment:'Real Electron on '+process.platform,passed:checks.length,checks,rendererErrors:errors};
  fs.writeFileSync(path.join(images,'integration-results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}
main().catch(async error=>{console.error(error);if(page)await shot('failure').catch(()=>{});process.exitCode=1;}).finally(async()=>{if(desktop)await desktop.close().catch(()=>{});console.log('Test data:',data);});
