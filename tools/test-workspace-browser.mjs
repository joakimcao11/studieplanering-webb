import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PLAYWRIGHT_MODULE;
const {chromium} = await import(modulePath ? pathToFileURL(path.resolve(modulePath)).href : 'playwright');
const output = process.env.STUDIEPLAN_QA_DIR;
if (output) await fs.mkdir(output,{recursive:true});
const root = path.resolve(import.meta.dirname,'../docs');
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2'};
const server = http.createServer(async(req,res)=>{
 try {
  const name = new URL(req.url,'http://localhost').pathname.replace(/^\//,'') || 'index.html';
  const file = path.resolve(root,name);
  if (!file.startsWith(root+path.sep)) throw Error('Utanför testserverns rot');
  res.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream');
  res.end(await fs.readFile(file));
 } catch { res.writeHead(404).end(); }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url = 'http://127.0.0.1:'+server.address().port;
const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
const errors = [];
const name = 'Fiktiv Åsa Ögren QA19';
const autumn = new Date('2026-11-09T23:20:00Z'), spring = new Date('2027-02-10T12:00:00Z');
const button = (p,label) => p.getByRole('button',{name:label,exact:true});
const stored = page => page.evaluate(()=>JSON.parse(localStorage.getItem('studieplan-v3')));
const width = async page => {
 const result = await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
 assert.ok(result[0]<=result[1]+1,'Sidbredd '+result.join(' > '));
};
const picture = async (page,label) => { if(output) await page.screenshot({path:path.join(output,label+'.png'),fullPage:true}); };
const start = async (page,focus,programme='D',student='') => {
 const form = page.locator('#case-form:visible');
 await form.locator('[name=programmeQuery]').fill(programme);
 await form.locator('[data-case-student]').fill(student);
 await button(form,focus).click();
};
const newPage = async (viewport,fixed=autumn) => {
 const page = await browser.newPage({viewport,acceptDownloads:true});
 page.setDefaultTimeout(9000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(fixed);
 await page.goto(url);
 return page;
};
const clickDownload = async (page,control,format,label) => {
 const [file] = await Promise.all([page.waitForEvent('download'),control.click()]);
 const data = await fs.readFile(await file.path());
 assert.ok(file.suggestedFilename().endsWith('.'+format));
 assert.ok(!file.suggestedFilename().includes('QA19'));
 assert.equal(data.toString('ascii',0,format==='pdf'?4:2),format==='pdf'?'%PDF':'PK');
 if(output) await fs.writeFile(path.join(output,label+'.'+format),data);
 if (format==='pdf') return page.evaluate(async bytes=>(await PDFLib.PDFDocument.load(Uint8Array.from(bytes))).getPageCount(),[...data]);
};
const change = (p,selector,value) => p.locator(selector).selectOption(value);
const fill = (p,selector,value) => p.locator(selector).fill(value);
const openTask = async (page,kind,fields) => {
 await page.locator('[data-task-new="'+kind+'"]:visible').first().click();
 const editor = page.locator('#editor');
 for (const [key,value] of Object.entries(fields)) {
  const field = editor.locator('[name="'+key+'"]');
  if(await field.evaluate(el=>el.tagName==='SELECT')) await field.selectOption(value);
  else await field.fill(value);
 }
 await button(editor,'Spara').click();
 await editor.waitFor({state:'hidden'});
};

try {
 const page = await newPage({width:1440,height:960});
 const nav = page.getByRole('navigation',{name:'Arbetssätt'});
 const dialog = page.locator('#editor');
 assert.equal(await page.locator('#case-form time').innerText(),'2026-11-10');
 assert.equal(await page.locator('[name=planningYear],[name=targetCredits]').count(),0);
 await picture(page,'start');
 await start(page,'Kurser och studietakt','D',name);
 await page.getByRole('heading',{name:'LP2 · HT 2026'}).waitFor();
 assert.deepEqual(await page.locator('[data-slot-drop]:visible').evaluateAll(items=>items.map(x=>x.dataset.slotDrop)),['2']);
 await fill(page,'.workspace-catalog [data-catalog-query]','EDAB05');
 await page.locator('[data-add-code=EDAB05]:visible').click();
 assert.deepEqual(await dialog.locator('[name=slot]:checked').evaluateAll(items=>items.map(x=>x.value)),['1','2']);
 await button(dialog,'Lägg till i planen').click();
 assert.match(await page.locator('.plan-summary').innerText(),/cirka 15 hp/);
 assert.match(await page.locator('.plan-summary').innerText(),/saknar säker poängfördelning/);
 await fill(page,'.workspace-catalog [data-catalog-query]','FMAB70');
 await page.locator('[data-add-code=FMAB70]:visible').click();
 await button(dialog,'Lägg till i planen').click();
 assert.match(await page.locator('.plan-summary').innerText(),/7,5 hp/);
 const afterAdd = await stored(page);
 assert.equal(afterAdd.courses.length,2);
 const course = afterAdd.courses.find(c=>c.code==='EDAB05');
 await picture(page,'lasperiod');

 await button(page,'Termin').click();
 assert.match(await page.locator('.plan-summary').innerText(),/18 hp[\s\S]*30 hp/);
 assert.equal(await page.locator('.spanning-courses [data-edit="'+course.id+'"]').count(),1);
 await picture(page,'termin');
 await button(page,'Läsår').click();
 assert.match(await page.locator('.plan-summary').innerText(),/18 hp[\s\S]*60 hp/);
 assert.equal(await page.locator('[data-slot-drop]:visible').count(),4);
 await page.locator('.spanning-courses [data-edit="'+course.id+'"]').dragTo(page.locator('[data-slot-drop="2"]'));
 assert.deepEqual((await stored(page)).courses.find(c=>c.id===course.id).plannedPeriods,['2','3']);
 await button(page,'Ångra').click();
 assert.deepEqual((await stored(page)).courses.find(c=>c.id===course.id).plannedPeriods,['1','2']);
 await picture(page,'lasar');
 await button(page,'Läsperiod').click();

 await button(nav,'Mål och handlingsplan').click();
 await fill(page,'[data-goal=text]','Färdigställ två laborationer före LP3');
 await fill(page,'[data-goal=date]','2027-02-01');
 await openTask(page,'completions',{type:'lab',description:'Laboration A – ångström',period:'2',status:'submitted',role:'student',courseId:course.id});
 await openTask(page,'completions',{type:'lab',description:'Laboration B',period:'2',status:'todo'});
 await openTask(page,'retakes',{period:'TP4',status:'registered',date:'2027-04-01'});
 await openTask(page,'steps',{task:'Skicka in resultatet',courseId:course.id,period:'2',status:'todo'});
 assert.equal(await page.locator('.action-workspace [data-task-edit]').count(),4);
 await button(page,'Klara').click();
 assert.equal(await page.locator('.action-workspace [data-task-edit]').count(),0);
 await button(page,'Alla').click();
 assert.match(await page.locator('.action-workspace').innerText(),/Inlämnad[\s\S]*Anmäld|Anmäld[\s\S]*Inlämnad/);
 await picture(page,'handlingsplan');
 await page.locator('[data-action=fullscreen]').focus();
 await page.keyboard.press('Enter');
 await button(page,'Avsluta helskärm').waitFor();
 await page.keyboard.press('Escape');
 // Chromium may reserve Escape outside Playwright's page in its native fullscreen mode.
 if(await page.evaluate(()=>Boolean(document.fullscreenElement))) await button(page,'Avsluta helskärm').click();
 await button(page,'Helskärm').waitFor();
 assert.equal(await page.locator('[data-goal=text]').inputValue(),'Färdigställ två laborationer före LP3');

 await button(page,'Granska och exportera').click();
 assert.equal(await dialog.locator('[name=scope]').inputValue(),'actions');
 assert.equal(await dialog.locator('#temporary-name').inputValue(),name);
 for(const [scope,combined,label] of [['actions',false,'endast-handlingsplan'],['lp-2',false,'lasperiod'],['HT',false,'termin'],['year',false,'lasar'],['lp-2',true,'kombinerad']]) {
  await change(dialog,'[name=scope]',scope);
  if(scope!=='actions') await dialog.locator('[name=includeActionPlan]').setChecked(combined);
  await clickDownload(page,dialog.locator('[data-export-download=pdf]'),'pdf',label);
  await clickDownload(page,dialog.locator('[data-export-download=word]'),'docx',label);
 }
 const [jsonFile] = await Promise.all([page.waitForEvent('download'),dialog.locator('[data-export-backup]').click()]);
 const json = await fs.readFile(await jsonFile.path(),'utf8');
 assert.doesNotMatch(json,/QA19/);
 assert.ok(await page.evaluate(()=>!JSON.stringify({...localStorage,...sessionStorage}).includes('QA19')));
 await button(dialog,'Stäng').click();

 await button(nav,'Kurser och studietakt').click();
 await page.clock.setFixedTime(spring);
 await page.reload();
 await page.getByRole('heading',{name:'LP2 · HT 2026'}).waitFor();
 await button(page,'Granska och exportera').click();
 assert.equal(await dialog.locator('#temporary-name').inputValue(),'');
 await button(dialog,'Stäng').click();
 await button(page,'＋ Nytt ärende').click();
 await start(page,'Mål och handlingsplan','Eget kursval');
 assert.equal(await page.locator('.plan-summary').count(),0);
 const handlingsarende = await stored(page);
 assert.equal(handlingsarende.courses.filter(c=>c.caseId===handlingsarende.activeCaseId).length,0);
 await fill(page,'[data-goal=text]','Öva på de återstående momenten och följ upp före nästa möte.');
 await openTask(page,'completions',{type:'lab',description:'Förbered första laborationen',period:'3'});
 await openTask(page,'completions',{type:'lab',description:'Färdigställ andra laborationen',period:'3'});
 await openTask(page,'retakes',{period:'TP4',status:'registered',date:'2027-04-01'});
 await page.evaluate(()=>{
  const data=JSON.parse(localStorage.getItem('studieplan-v3'));
  const record=data.cases.find(r=>r.id===data.activeCaseId);
  const plan=record.scenarios.find(s=>s.id===record.activeScenarioId);
  plan.agenda='Gå igenom förutsättningarna och dokumentera vem som ansvarar för uppföljningen. '.repeat(10);
  for(let i=0;i<28;i++) plan.steps.push({id:crypto.randomUUID().replaceAll('-',''),task:(i+1)+'. Återkoppla om laborationen och skriv en kort sammanfattning av vad som behöver följas upp.',date:'',role:'advisor',status:'todo'});
  localStorage.setItem('studieplan-v3',JSON.stringify(data));
 });
 await page.reload();
 await button(page,'Granska och exportera').click();
 assert.ok(await clickDownload(page,dialog.locator('[data-export-download=pdf]'),'pdf','lang-handlingsplan')>1);
 await clickDownload(page,dialog.locator('[data-export-download=word]'),'docx','lang-handlingsplan');
 await button(dialog,'Stäng').click();
 await button(nav,'Kurser och studietakt').click();
 await page.getByRole('heading',{name:'LP3 · VT 2027'}).waitFor();
 await button(page,'Fortsätt till nästa läsår →').click();
 await page.getByRole('heading',{name:'LP1 · HT 2027'}).waitFor();

 const architecture = await newPage({width:1280,height:900});
 await start(architecture,'Kurser och studietakt','A');
 await architecture.getByRole('heading',{name:'Hösttermin 2026',exact:true}).first().waitFor();
 assert.equal(await architecture.locator('[data-horizon=period]').count(),0);
 assert.equal(await architecture.locator('[data-slot-drop=HT]').count(),1);
 await architecture.close();

 for(const vw of [1024,360]) {
  const small = await newPage({width:vw,height:900});
  await start(small,'Kurser och studietakt','D');
  await width(small);
  if(vw===360) {
   await small.locator('.mobile-course-open').click();
   await small.locator('#editor [data-catalog-query]').fill('FMAB70');
   assert.equal(await small.locator('#editor [data-source-code=FMAB70]').count(),1);
   await small.keyboard.press('Escape');
  }
  await picture(small,'bredd-'+vw);
  await small.getByRole('navigation',{name:'Arbetssätt'}).getByRole('button',{name:'Mål och handlingsplan'}).click();
  await width(small);
  await small.evaluate(()=>{document.documentElement.requestFullscreen=undefined;});
  await button(small,'Helskärm').click();
  await button(small,'Avsluta helskärm').waitFor();
  assert.equal(await small.evaluate(()=>document.body.classList.contains('focus-workspace')),true);
  await small.keyboard.press('Escape');
  await button(small,'Helskärm').waitFor();
  await small.close();
 }
 assert.deepEqual(errors,[]);
 console.log('Chrome: LP2 och LP3, sparad tidsram, helskärm, fem PDF/Word-lägen, JSON utan namn och mobilvy verifierade.');
} finally {
 await browser.close();
 server.close();
}
