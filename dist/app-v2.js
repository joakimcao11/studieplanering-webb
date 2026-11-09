import { months, period, intersects, visibleCourses, validateCourse, switchedYear, moveCourse, summarize, coursePace, monthEnd } from './model.js';
import { CASE_KEY, LEGACY_KEY, emptyWorkspace, newId, cleanCase, loadWorkspace, saveWorkspace, caseBackup, importCases, legacyChoices, migrateLegacy, exportPreferences } from './cases.js';
import { casesPage, caseTitle, caseDescription, caseForm, caseProgram, casePrivacy, calendarPanel } from './case-view.js';
import { catalogPage, catalogResults, catalogCourseDetails, htmlEscape, officialLink, programmeOptions } from './catalog-view.js';
import { programmeStructure } from './lth-calendar.js';
import { periodLabel } from './program-catalog.js';
import { downloadFile } from './exports.js';
import { openExportPanel } from './export-ui.js';

const catalog = globalThis.STUDIE_CATALOG;
const esc = htmlEscape;
const fmt = n => Number(n).toLocaleString('sv-SE');
const labels = { calendar:'Kalenderår', academic:'Läsår', autumn:'Hösttermin', spring:'Vårtermin' };
const statuses = { planned:'Planerad', progress:'Pågår', done:'Avklarad', summer:'Sommarstudier' };
const date = s => new Date(s + 'T12:00:00').toLocaleDateString('sv-SE', { day:'numeric', month:'short', year:'numeric' });
const courseIndex = new Map(catalog.courses.map(c => [c.code,c]));
const sourceCourse = code => courseIndex.get(code);
const storage = {
 getItem: key => localStorage.getItem(key),
 setItem: (key, value) => localStorage.setItem(key, value),
 removeItem: key => localStorage.removeItem(key)
};
let lastSaved = null;
try { lastSaved = storage.getItem(CASE_KEY); } catch { /* Handled by loadWorkspace. */ }
let { data, error: storageError } = loadWorkspace(storage, catalog);
let readError = storageError;
const localDate = new Date().toLocaleDateString('sv-SE', { timeZone:'Europe/Stockholm' });
const defaultYear = Number(localDate.slice(0,4)) - (Number(localDate.slice(5,7)) < 8 ? 1 : 0);
const activeCase = () => data.cases.find(c => c.id === data.activeCaseId);
let mode = 'academic', year = activeCase()?.planningYear ?? defaultYear;
let selected = year + '-08', page = 'cases', dragged = null;
let view = matchMedia('(max-width: 700px)').matches ? 'list' : 'timeline';
let legacy = null, legacyExpanded = true, migrationGroups = null, pendingCourse = null;
try { legacy = storage.getItem(LEGACY_KEY); } catch { /* Storage failure is surfaced above. */ }

function defaultFilter(programme = activeCase()?.programmeId || '') {
 return { programme, programmeQuery:'', q:'', year:'', category:'', specialization:'', lp:'', status:'', expanded:!matchMedia('(max-width: 700px)').matches };
}
let filter = defaultFilter();
const range = () => period(mode, year);
const activeCourses = () => data.courses.filter(c => c.caseId === data.activeCaseId);
const shownCourses = () => visibleCourses(data.courses, data.activeCaseId, range());
const saveLabel = () => storageError ? 'Sparning misslyckades · osparade ändringar' : data.cases.length ? 'Sparat på den här enheten' : 'Lokal arbetsyta';

function save(touch = false) {
 if (touch && activeCase()) activeCase().updatedAt = new Date().toISOString();
 try {
  storageError = readError || storage.getItem(CASE_KEY) !== lastSaved || !saveWorkspace(storage, data, catalog);
  if (!storageError) lastSaved = storage.getItem(CASE_KEY);
 } catch { storageError = true; }
 const status = document.querySelector('#save-status');
 if (status) status.textContent = saveLabel();
 return !storageError;
}

function setActive(id) {
 data.activeCaseId = id;
 mode = 'academic';
 year = activeCase()?.planningYear ?? defaultYear;
 selected = year + '-08';
 filter = defaultFilter();
}

function caseCard() {
 const record = activeCase();
 const unverified = activeCourses().filter(c => (c.catalogYear || sourceCourse(c.code)) &&
  (!c.catalogYear || record.planningYear !== Number('20' + c.catalogYear.slice(0,2)) ||
   !sourceCourse(c.code)?.offerings.some(o => o.programmeId === record.programmeId)));
 return `<section class="panel active-case" aria-label="Aktivt ärende"><div><h2>${caseTitle(record)}</h2><p>${esc(caseDescription(record,catalog))}</p>${record.admissionYear ? '<p>Utbildningsplanens krav är ej verifierade för vald antagningskull.</p>' : ''}</div>
 <div class="actions"><button data-action="edit-case">Ändra grundinformation</button><button data-case-copy="${record.id}">Skapa alternativ</button><button data-action="close-case">Stäng ärende</button></div>
 ${unverified.length ? '<p class="notice">Behöver kontrolleras för valt program och läsår: ' + esc(unverified.map(c => c.code).join(', ')) + '.</p>' : ''}</section>`;
}

function toast(message,undo){const t=document.querySelector('#toast');t.replaceChildren(document.createTextNode(message));if(undo){const b=document.createElement('button');b.textContent='Ångra';b.onclick=()=>{undo();const ok=save();render();toast(ok?'Ändringen har ångrats.':'Ändringen ångrades i arbetsytan. Sparning misslyckades.');};t.append(b);}t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),undo?12000:5000);}
function title(){return mode==='academic'?`${year} / ${year+1}`:mode==='autumn'?`HT ${year}`:mode==='spring'?`VT ${year}`:String(year);}
function season(m){return m.month>=7?'autumn':m.month>=5?'summer':'spring';}
function courseBar(c,r){const indices=r.map((m,i)=>intersects(c,m)?i:-1).filter(i=>i>=0);return `<div class="course-row timeline-grid"><button class="course-details" data-edit="${esc(c.id)}" aria-label="Redigera ${esc(c.title)}"><b>${esc(c.title)}</b><small>${esc(c.code||'Egen kurs')} · ${fmt(c.credits)} hp ${c.level?'· '+esc(c.level):''}</small></button>${r.map((m,i)=>`<div class="cell ${season(m)==='summer'?'summer-cell':''} ${m.key===selected?'selected-cell':''}" style="grid-column:${i+2}" data-drop-month="${m.key}"></div>`).join('')}<button draggable="false" data-drag-course="${esc(c.id)}" class="bar ${esc(c.status)}" style="grid-column:${indices[0]+2} / ${indices.at(-1)+3}" data-edit="${esc(c.id)}" title="Dra för att flytta. Klicka för att redigera ${esc(c.title)}." aria-label="Flytta eller redigera ${esc(c.title)}">⠿ ${statuses[c.status]} · ${fmt(c.credits)} hp</button></div>`;}
function timeline(courses,r){const groups=[];for(const m of r){const key=season(m);if(groups.at(-1)?.key===key)groups.at(-1).count++;else groups.push({key,count:1,year:m.year});}return `<div class="timeline-scroll"><div class="timeline" style="--columns:${r.length}"><div class="season-row timeline-grid"><div class="season-label">${labels[mode].toUpperCase()} ${title()}</div>${groups.map(g=>`<div class="season ${g.key}" style="grid-column:span ${g.count}">${g.key==='autumn'?'HÖST':g.key==='spring'?'VÅR':'SOMMAR'} ${g.year}</div>`).join('')}</div><div class="month-row timeline-grid"><div class="course-label">Kurs / högskolepoäng</div>${r.map(m=>`<button class="month ${m.key===selected?'active':''}" data-month="${m.key}" data-drop-month="${m.key}" aria-pressed="${m.key===selected}" aria-label="${months[m.month]} ${m.year}">${months[m.month].slice(0,3)}</button>`).join('')}</div>${courses.map(c=>courseBar(c,r)).join('')||`<div class="empty-start"><h3>Din studieplan är redo att fyllas</h3><p>1. Utforska kursutbudet &nbsp; 2. Lägg till en kurs &nbsp; 3. Placera den i en månad</p><button class="primary" data-page="catalog">Utforska kurser</button></div>`}</div></div>`;}
function sourcePlacement(course) {
 if (!course.periods?.length) return '';
 const termOnly = programmeStructure(course.programmeId,course.catalogYear).periods === 'terms';
 return '<small>Källplacering: ' + esc(periodLabel(course.periods,termOnly)) + '</small>';
}
function courseList(courses){return `<div class="table-scroll"><table class="course-table"><thead><tr><th>Kurs</th><th>Hp</th><th>Planeringsdatum</th><th>Status</th><th>Ändra</th></tr></thead><tbody>${courses.map(c=>`<tr><td><b>${esc(c.title)}</b><small>${esc(c.code||'Egen kurs')} ${c.level?'· '+esc(c.level):''}</small>${sourcePlacement(c)}</td><td>${fmt(c.credits)}</td><td>${date(c.start)}<br>${date(c.end)}</td><td><span class="status-tag ${esc(c.status)}">${statuses[c.status]}</span></td><td><button data-edit="${esc(c.id)}">Redigera / flytta</button></td></tr>`).join('')||'<tr><td colspan="5">Inga kurser i perioden. Välj Lägg till kurs för att börja.</td></tr>'}</tbody></table></div>`;}
function planningOverview(){const courses=shownCourses();if(!courses.length)return '';const total=courses.reduce((n,c)=>n+c.credits,0),completed=courses.reduce((n,c)=>n+(c.status==='done'?c.credits:Math.min(c.credits,Math.max(0,Number(c.completedCredits)||0))),0);return `<details class="planning-facts panel"><summary>Studietakt och återstående poäng · ${fmt(total-completed)} hp kvar i vald period</summary><p>Heltid motsvarar 1,5 hp per vecka. Kursens HP är oförändrade även om du planerar att läsa den på deltid. Angiven studietakt visas utan asterisk; annars uppskattas den från kursens HP och hela datumintervallet.</p><div class="table-scroll"><table class="course-table"><thead><tr><th>Kurs</th><th>HP</th><th>Avklarat</th><th>Kvar</th><th>Studietakt</th><th>Veckor kvar vid denna takt</th></tr></thead><tbody>${courses.map(c=>{const done=c.status==='done'?c.credits:Math.min(c.credits,Math.max(0,Number(c.completedCredits)||0)),pace=coursePace(c),weeks=pace.value>0?(c.credits-done)/(1.5*pace.value/100):0;return `<tr><td><button class="text-button" data-edit="${esc(c.id)}">${esc(c.title)}</button></td><td>${fmt(c.credits)}</td><td>${fmt(done)}</td><td>${fmt(c.credits-done)}</td><td>${pace.value}%${pace.manual?'':'*'}</td><td>${fmt(Math.round(weeks*10)/10)}</td></tr>`;}).join('')}</tbody></table></div><p class="note-footer">En planeringsuppskattning, inte schema eller beslut om studiemedel. <a href="https://www.lu.se/node/35041" target="_blank" rel="noopener">LU:s information om högskolepoäng och heltid ↗</a></p></details>`;}
function planView(){const s=activeCase(),r=range();if(!r.some(m=>m.key===selected))selected=r[0].key;const courses=shownCourses(),summary=summarize(courses),whole=summarize(activeCourses()),chosen=r.find(m=>m.key===selected),inMonth=courses.filter(c=>intersects(c,chosen));return `<header class="heading"><div><p class="eyebrow">AKTIVT ÄRENDE</p><h1>Studieplanering</h1><p>Utforska kurser, prova alternativ och planera nästa steg.</p></div><div class="actions"><button data-action="export">↓ Exportera</button><button class="primary" data-page="catalog">＋ Lägg till kurs</button></div></header>${caseCard()}${calendarPanel(s, mode==='spring' ? year-1 : year)}<section class="stats" aria-label="Poängöversikt"><div class="stat"><label>Kurser i vald period</label><strong>${fmt(summary.credits)} <span>hp</span></strong><p>${courses.length} kurser · ${labels[mode].toLowerCase()} ${title()}</p></div><div class="stat"><label>Avklarat i hela planen</label><strong>${fmt(whole.done)} <span>av ${fmt(s.targetCredits)} hp i eget mål</span></strong><progress value="${whole.done}" max="${s.targetCredits}" aria-label="Avklarade poäng mot eget mål"></progress><p>Målet ändras under Ändra grundinformation.</p></div><div class="stat"><label>Avancerad nivå i vald period</label><strong>${fmt(summary.advanced)} <span>hp med känd A-nivå</span></strong><p><button class="text-button compact" data-page="help">Hur räknas poäng och mål? ↗</button></p></div></section>${storageError?'<p class="notice">Lokal sparning är otillgänglig. Exportera en säkerhetskopia.</p>':''}${planningOverview()}<section class="planning" aria-label="Studieplanens tidslinje"><div class="planning-head"><div><h2>Studieplanen</h2><p>Dra en kurs till en månad eller klicka för att redigera och flytta.</p></div><div class="segmented" aria-label="Välj tidsperiod">${Object.entries(labels).map(([key,label])=>`<button data-mode="${key}" aria-pressed="${mode===key}" class="${mode===key?'active':''}">${label}</button>`).join('')}</div></div><div class="controls"><div class="year-selector"><button data-year="-1" aria-label="Föregående år">←</button><strong>${title()}</strong><button data-year="1" aria-label="Nästa år">→</button></div><div class="segmented view-switch" aria-label="Visningssätt"><button data-view="timeline" class="${view==='timeline'?'active':''}" aria-pressed="${view==='timeline'}">▦ Tidslinje</button><button data-view="list" class="${view==='list'?'active':''}" aria-pressed="${view==='list'}">☷ Kurslista</button></div></div><div class="plan-timeline">${view==='timeline'?timeline(courses,r):courseList(courses)}</div><div class="plan-mobile-list">${courseList(courses)}</div><div class="planning-foot"><span>Egna planeringsdatum · juni och juli markeras som sommar.</span><button class="text-button compact" data-action="custom-course">＋ Skapa egen kurs</button></div></section><div class="lower"><section class="panel"><div class="panel-head"><h2>${months[chosen.month]} ${chosen.year}</h2><button data-page="catalog">＋ Lägg till kurs</button></div><p class="month-summary">${inMonth.length} kurser överlappar den här månaden.</p>${inMonth.map(c=>`<div class="course-item"><span class="mini-dot"></span><div><b>${esc(c.title)}</b><small>${date(c.start)} – ${date(c.end)} · ${statuses[c.status]}</small></div><button data-complete="${esc(c.id)}">${c.status==='done'?'Markera som planerad':'Markera som avklarad'}</button><button data-edit="${esc(c.id)}" aria-label="Öppna ${esc(c.title)}">↗</button></div>`).join('')||'<p class="empty">Välj en kurs i kursutbudet och placera den här. Du kan ändra senare.</p>'}<p class="note-footer">Kursens hela poäng räknas en gång. Överlapp betyder inte automatiskt schemakrock.</p></section><section class="panel"><div class="panel-head"><h2>Anteckningar och nästa steg</h2></div><label class="sr-only" for="case-note">Vägledningsanteckningar</label><textarea class="note-area" id="case-note" maxlength="1000" aria-describedby="note-privacy" placeholder="Kort nästa steg för planeringen">${esc(s.note)}</textarea><p class="note-footer" id="note-privacy">${casePrivacy} Anteckningen sparas lokalt och kan följa med i export.</p></section></div>`;}
function courseEditor(id,code){if(!activeCase()){ openDialog(caseForm(catalog,null,defaultYear)); return; }const from=sourceCourse(code),existing=code&&activeCourses().find(c=>c.code===code);if(existing){courseEditor(existing.id);return;}let c=activeCourses().find(c=>c.id===id);if(!c){const last=monthEnd(selected);c={id:'',title:from?.title||'',code:from?.code||'',credits:from?.credits||7.5,level:from?.level||'',start:selected+'-01',end:last,status:'planned',note:'',sourceUrl:from?.syllabusUrl||'',catalogYear:from?.academicYear||''};}openDialog(`<div class="dialog-head"><h2 id="editor-title">${c.id?'Redigera eller flytta kurs':'Lägg till kurs i planen'}</h2><button data-close aria-label="Stäng">✕</button></div><form id="course-form"><input type="hidden" name="courseId" value="${esc(c.id)}"><input type="hidden" name="programmeId" value="${esc(id ? c.programmeId : filter.programme)}"><input type="hidden" name="catalogYear" value="${esc(c.catalogYear||'')}"><p class="form-intro">Datum är egna planeringsdatum. Kontrollera kursens faktiska erbjudande och schema på LTH.</p>${from ? `<p>Källplacering: ${esc(periodLabel([...new Set(from.offerings.filter(o=>o.programmeId===filter.programme).flatMap(o=>o.periods))].sort(), programmeStructure(filter.programme,catalog.academicYear).periods==='terms'))}</p>` : ''}<label>Kursnamn<input name="title" value="${esc(c.title)}" required maxlength="150" autofocus></label><div class="form-grid"><label>Kurskod<input name="code" value="${esc(c.code)}" maxlength="40"></label><label>Högskolepoäng<input name="credits" type="number" min="0.1" max="120" step="0.1" value="${c.credits}" required></label><label>Planerad start<input name="start" type="date" value="${c.start}" required></label><label>Planerat slut<input name="end" type="date" value="${c.end}" required></label><label>Status<select name="status">${Object.entries(statuses).map(([key,label])=>`<option value="${key}" ${c.status===key?'selected':''}>${label}</option>`).join('')}</select></label><label>Nivå<select name="level">${[...new Set(['','G1','G2','A',c.level].filter(v=>v!=null))].map(v=>`<option value="${v}" ${v===c.level?'selected':''}>${v||'Inte angiven'}</option>`).join('')}</select></label></div>${c.id?`<div class="move-control"><label>Flytta till månad<input name="moveMonth" type="month" value="${c.start.slice(0,7)}"></label><button type="button" data-action="apply-move">Flytta datumen</button><p>Flyttar både start och slut lika många månader.</p></div>`:''}<div class="form-grid"><label>Studietakt (%)<input name="studyRate" type="number" min="1" max="400" step="0.1" value="${c.studyRate??''}" placeholder="Tomt = beräknas från datum"></label><label>Avklarade poäng i kursen<input name="completedCredits" type="number" min="0" max="${c.credits}" step="0.1" value="${c.status==='done'?c.credits:(c.completedCredits||0)}"></label></div><p class="note-footer">Studietakten ändrar inte kursens HP. Ange avklarade delpoäng för att se vad som återstår.</p><label>Avidentifierad kursanteckning <small>${casePrivacy}</small><textarea name="note" maxlength="1000">${esc(c.note)}</textarea></label>${c.sourceUrl?`<p class="note-footer">${officialLink(c.sourceUrl,"Officiell kursplan")}</p>`:''}<p id="form-error" class="error" role="alert"></p><div class="dialog-actions">${c.id?`<button type="button" class="text-button" data-delete="${esc(c.id)}">Ta bort ur planen</button>`:''}<button type="button" data-close>Avbryt</button><button type="submit" class="primary">Spara kurs</button></div></form>`);}
function commitMove(id,month){const index=data.courses.findIndex(c=>c.id===id&&c.caseId===data.activeCaseId);if(index<0)return;const old={...data.courses[index]};try{data.courses[index]=moveCourse(old,month);selected=month;save(true);render();toast(`Kursen flyttades till ${months[Number(month.slice(5))-1]} ${month.slice(0,4)}.`,()=>{const at=data.courses.findIndex(c=>c.id===old.id);if(at>=0){data.courses[at]=old;const record=data.cases.find(c=>c.id===old.caseId);if(record)record.updatedAt=new Date().toISOString();};});}catch{toast('Kursen kunde inte flyttas.');}}
document.addEventListener('dragstart',e=>{const el=e.target.closest('[data-drag-course]');if(!el)return;dragged={id:el.dataset.dragCourse};e.dataTransfer.setData('text/plain',JSON.stringify(dragged));e.dataTransfer.effectAllowed='move';document.body.classList.add('dragging-course');});
document.addEventListener('dragover',e=>{const target=e.target.closest('[data-drop-month]');if(target&&dragged){e.preventDefault();document.querySelectorAll('.drop-active').forEach(el=>el.classList.remove('drop-active'));target.classList.add('drop-active');e.dataTransfer.dropEffect='move';}});
document.addEventListener('drop',e=>{const target=e.target.closest('[data-drop-month]');if(!target||!dragged)return;e.preventDefault();const moved=dragged;dragged=null;document.body.classList.remove('dragging-course');commitMove(moved.id,target.dataset.dropMonth);});
document.addEventListener('dragend',()=>{dragged=null;document.body.classList.remove('dragging-course');document.querySelectorAll('.drop-active').forEach(el=>el.classList.remove('drop-active'));});
let pointerDrag=null,suppressClicksUntil=0;
function pointerMonth(event){const timeline=document.querySelector('.timeline');if(!timeline)return null;const bounds=timeline.getBoundingClientRect();if(event.clientY<bounds.top||event.clientY>bounds.bottom)return null;return [...timeline.querySelectorAll('.month[data-drop-month]')].find(el=>{const r=el.getBoundingClientRect();return event.clientX>=r.left&&event.clientX<=r.right;})?.dataset.dropMonth;}
function clearPointerDrag(){document.querySelector('.drag-ghost')?.remove();document.body.classList.remove('dragging-course');document.querySelectorAll('.drop-active').forEach(el=>el.classList.remove('drop-active'));pointerDrag=null;}
document.addEventListener('pointerdown',e=>{const el=e.target.closest('[data-drag-course]');if(!el||e.button!==0)return;pointerDrag={id:el.dataset.dragCourse,x:e.clientX,y:e.clientY,active:false,element:el};el.setPointerCapture(e.pointerId);});
document.addEventListener('pointermove',e=>{if(!pointerDrag)return;if(!pointerDrag.active&&Math.hypot(e.clientX-pointerDrag.x,e.clientY-pointerDrag.y)<6)return;e.preventDefault();if(!pointerDrag.active){pointerDrag.active=true;const ghost=document.createElement('div');ghost.className='drag-ghost';ghost.textContent=data.courses.find(c=>c.id===pointerDrag.id)?.title||'Flytta kurs';document.body.append(ghost);document.body.classList.add('dragging-course');}const ghost=document.querySelector('.drag-ghost');ghost.style.left=e.clientX+12+'px';ghost.style.top=e.clientY+12+'px';document.querySelectorAll('.drop-active').forEach(el=>el.classList.remove('drop-active'));const target=pointerMonth(e);if(target)document.querySelectorAll(`[data-drop-month="${target}"]`).forEach(el=>el.classList.add('drop-active'));});
document.addEventListener('pointerup',e=>{if(!pointerDrag)return;const active=pointerDrag.active,id=pointerDrag.id,month=pointerMonth(e);clearPointerDrag();if(active){suppressClicksUntil=performance.now()+350;e.preventDefault();if(month)commitMove(id,month);}});
document.addEventListener('pointercancel',clearPointerDrag);
document.addEventListener('click',e=>{if(performance.now()<suppressClicksUntil){e.preventDefault();e.stopImmediatePropagation();}},true);


const nav = [['cases','▤','Mina studieplaneringar'],['plan','▦','Studieplanering'],['catalog','⌕','LTH:s kurskatalog'],['help','?','Så fungerar det']];
const dialog = document.querySelector('#editor');

function helpPage() {
 return `<header class="heading"><h1>Så fungerar det</h1></header><section class="panel help">
 <h2>Arbeta med ett ärende</h2><ol><li>Skapa en studieplanering och ange program, årskurs och planeringsläsår.</li>
 <li>Öppna en kurs i LTH:s kurskatalog för att läsa källuppgifterna och lägga till den.</li>
 <li>Dra kursen till en månad eller öppna kursen och ändra datumen.</li>
 <li>Exportera Word eller PDF. Använd JSON om du vill spara en namnfri säkerhetskopia.</li></ol>
 <h2>Kursutbud och antagningskull</h2><p>Antagningskullen anger när utbildningen påbörjades. Kursutbudet har ett eget källäsår. Kontrollera kraven i utbildningsplanen för antagningskullen.</p>
 <p>LP anger placering i LoT. Kursens HP räknas en gång i vald vy och fördelas inte mellan perioderna. Avklarad är en manuell markering.</p>
 <h2>Lokal lagring och dokument</h2><p>${casePrivacy} Namnfria uppgifter kan identifiera någon i kombination. Planerna synkas inte och kan försvinna när webbläsardata rensas.</p>
 <p>Studentens namn kan anges i exportdialogen och rensas efter export eller när dialogen stängs. Dokumenten använder den befintliga mallen.</p>
 <p>Kontrollera resultat i Ladok, examenskrav i utbildningsplanen, studiemedel hos CSN och schema i TimeEdit.</p>
 ${officialLink(catalog.sourceUrl,'Officiellt kursutbud på LTH')}</section>`;
}

function renderCatalog() {
 const host = document.querySelector('#catalog-results');
 if (host) host.innerHTML = catalogResults(catalog,filter);
}

function render(focusHeading = false) {
 const navLabel = nav.find(([key]) => key === page)[2];
 const emptyPlan = '<section class="panel empty-start"><h1>Ingen öppen studieplanering</h1><p>Öppna ett tidigare ärende eller skapa ett nytt.</p><button class="primary" data-action="new-case">＋ Ny studieplanering</button><button data-page="cases">Mina studieplaneringar</button></section>';
 document.querySelector('#app').innerHTML = `<aside class="sidebar"><div class="brand"><div class="mark" aria-hidden="true">▥</div><div><strong>Studieplanering LTH</strong><small>ARBETSVERKTYG FÖR PERSONAL</small></div></div>
 <nav class="nav" aria-label="Huvudmeny">${nav.map(([key,icon,label]) => `<button data-page="${key}" class="${page === key ? 'active' : ''}" ${page === key ? 'aria-current="page"' : ''}><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</nav></aside>
 <main class="main" id="main" tabindex="-1"><div class="topbar"><span>${navLabel}${activeCase() && page !== 'plan' ? ' · ' + esc(caseTitle(activeCase())) : ''}</span><span id="save-status" role="status">${saveLabel()}</span></div>
 ${readError ? '<p class="notice" role="alert">Sparade ärenden kunde inte läsas. Lagringen skrivs inte över. Välj Rensa alla lokala ärenden om du vill börja om.</p>' : storageError ? '<p class="notice" role="alert">Sparning misslyckades. Om appen är öppen i flera flikar kan lagringen ha ändrats. Säkerhetskopiera arbetsytan som JSON innan du laddar om.</p>' : ''}
 ${page === 'cases' ? casesPage(data,catalog,legacy,legacyExpanded) : page === 'catalog' ? catalogPage(catalog,filter,activeCase(),selected) : page === 'plan' ? (activeCase() ? planView() : emptyPlan) : helpPage()}
 <footer class="footer">Planeringsunderlag för LTH-personal · kursutbud ${catalog.academicYearLabel}</footer></main>`;
 renderCatalog();
 if (focusHeading) {
  const heading = document.querySelector('main h1');
  heading.tabIndex = -1;
  heading.focus();
 }
}

function openDialog(html) {
 dialog.innerHTML = html;
 if (!dialog.open) dialog.showModal();
 else (dialog.querySelector('[autofocus]') || dialog.querySelector('button'))?.focus();
}
dialog.addEventListener('close', () => {
 if (!dialog.open) dialog.replaceChildren();
 migrationGroups = null;
 pendingCourse = null;
});

function exportJSON(id) {
 try {
  const backup = caseBackup(data,id,catalog);
  downloadFile(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),
   id ? 'Studieplanering-arende.json' : 'Studieplanering-alla-arenden.json');
 } catch (error) { toast(error.message); }
}

function exportDialog() {
 const record = activeCase();
 if (!record) return;
 const neutral = { name:'', program:caseProgram(record,catalog)?.name || 'Program ej valt',
  programmeId:record.programmeId, year:record.studyYear ? 'Årskurs '+record.studyYear : '', note:record.note };
 openExportPanel({ student:neutral, courses:activeCourses(), periodCourses:shownCourses(),
  scope:labels[mode]+' '+title(), catalog, saved:data.exportSettings,
  onSave: settings => { data.exportSettings = exportPreferences(settings); return save(); },
  onBackup: () => exportJSON(record.id) });
}

function importBackup() {
 const input = document.createElement('input');
 input.type = 'file';
 input.accept = '.json,application/json';
 input.onchange = async () => {
  const file = input.files[0];
  if (!file) return;
  try {
   if (file.size > 10000000) throw new Error();
   const backup = JSON.parse(await file.text());
   if (Array.isArray(backup?.students)) { reviewLegacy(backup,false); return; }
   data = importCases(data,backup,catalog);
   const ok = save();
   render(true);
   toast(ok ? 'Ärendena har importerats.' : 'Ärendena öppnades i arbetsytan. Sparning misslyckades.');
  } catch { toast('Importen misslyckades. Välj en giltig JSON-säkerhetskopia.'); }
 };
 input.click();
}

function maskLegacyNames(value, groups) {
 let result = String(value).slice(0,20000);
 for (const { profile } of groups) {
  const name = typeof profile.name === 'string' ? profile.name.trim() : '';
  if (!name) continue;
  const literal = name.replace(/[.*+?^${}()|[\]\\]/g,'\\function reviewLegacy(backup, local = true) {');
  result = result.replace(new RegExp(literal,'gi'),'[namn borttaget]');
 }
 return result;
}

function reviewLegacy(backup, local = true) {
 try {
  migrationGroups = legacyChoices(local ? JSON.parse(legacy) : backup);
  if (!migrationGroups.length) throw new Error();
 } catch { toast('Inga äldre planer kunde läsas. Ursprungliga uppgifter finns kvar.'); return; }
 openDialog(`<div class="dialog-head"><h2 id="editor-title">Granska äldre planer</h2><button data-close aria-label="Stäng">✕</button></div>
 <form id="migration-form"><p>Välj vilka planer som ska kopieras. Namn och äldre anteckningar förs inte över automatiskt. Egna kurstitlar ersätts med en neutral titel. Granska äldre fritext och skriv en ny anteckning vid behov.</p>
 ${migrationGroups.map(({profile,courses,archived},i) => `<fieldset class="migration-choice">
 <legend>Plan ${i+1}${archived ? ' · tidigare borttagen' : ''}${profile.originalPlanId ? ' · alternativ' : ''}</legend>
 <label><input type="checkbox" name="plan" value="${i}"> Konvertera ${esc(caseProgram(profile,catalog)?.name || 'program ej valt')} · ${courses.length} kurser</label>
 ${profile.note ? '<details><summary>Granska tidigare anteckning</summary><p class="preserve-lines">' + esc(maskLegacyNames(profile.note,migrationGroups)) + '</p></details>' : ''}
 <label>Ny avidentifierad anteckning (valfritt)<textarea name="review-${i}" maxlength="1000" placeholder="${casePrivacy}"></textarea></label></fieldset>`).join('')}
 <p class="note-footer">Originalet ligger kvar. Kontrollera kurserna efter konvertering. Ogiltiga poster och dubbletter förs inte över.</p>
 <p id="form-error" role="alert" class="error"></p><div class="dialog-actions"><button type="button" data-close>Avbryt</button><button class="primary" type="submit">Konvertera valda planer</button></div></form>`);
}

function confirmAction(titleText, description, callback, typed = false) {
 openDialog(`<div class="dialog-head"><h2 id="editor-title">${titleText}</h2><button data-close aria-label="Stäng">✕</button></div>
 <form id="confirm-action"><p>${description}</p>${typed ? '<label>Skriv RENSA för att fortsätta<input name="confirmation" pattern="RENSA" required autocomplete="off"></label>' : ''}
 <div class="dialog-actions"><button type="button" data-close autofocus>Avbryt</button><button class="danger" type="submit">Bekräfta borttagning</button></div></form>`);
 dialog.querySelector('#confirm-action').onsubmit = event => {
  event.preventDefault();
  if (callback()) { dialog.close(); render(true); }
 };
}

function deleteCase(id) {
 confirmAction('Ta bort ärendet?', 'Kurser och anteckningar för ärendet tas bort från den här webbläsaren.', () => {
  const before = data;
  data = { ...data, cases:data.cases.filter(c => c.id !== id), courses:data.courses.filter(c => c.caseId !== id),
   activeCaseId:data.activeCaseId === id ? null : data.activeCaseId };
  if (!save()) { data = before; toast('Ärendet kunde inte tas bort från lokal lagring.'); return false; }
  page = 'cases';
  toast('Ärendet har tagits bort.');
  return true;
 });
}

function clearCases() {
 confirmAction('Rensa alla lokala ärenden?', 'Alla ärenden i den nya arbetsytan raderas. Äldre planer hanteras i migrationsrutan.', () => {
  try { storage.removeItem(CASE_KEY); }
  catch { toast('Den lokala lagringen kunde inte rensas.'); return false; }
  data = emptyWorkspace();
  lastSaved = null;
  readError = false;
  storageError = false;
  setActive(null);
  page = 'cases';
  return true;
 }, true);
}

function copyCase(id) {
 const original = data.cases.find(c => c.id === id);
 if (!original) return;
 const now = new Date().toISOString();
 const copy = { ...original, id:newId(), createdAt:now, updatedAt:now, alternative:true };
 data.cases.push(copy);
 data.courses.push(...data.courses.filter(c => c.caseId === id).map(c => ({ ...c,id:newId(),caseId:copy.id })));
 setActive(copy.id);
 page = 'plan';
 save();
 render(true);
}

function updateCourse(form, values) {
 const { courseId, moveMonth, ...fields } = values;
 const previous = activeCourses().find(c => c.id === courseId);
 const code = values.code.trim().toUpperCase();
 const official = sourceCourse(code);
 const fromCatalog = official && values.catalogYear === catalog.academicYear && (!previous || previous.code === code);
 const course = { ...fields, id:previous?.id || newId(), caseId:data.activeCaseId, title:values.title.trim(),
  code, credits:Number(values.credits), datesArePlanning:true,
  catalogYear:fromCatalog ? values.catalogYear : '', programmeId:fromCatalog ? values.programmeId : '',
  studyRate:values.studyRate === '' ? undefined : Number(values.studyRate), completedCredits:Number(values.completedCredits) || 0 };
 const duplicate = code && activeCourses().some(c => c.code.toUpperCase() === code && c.id !== course.id);
 const error = validateCourse(course) || (duplicate ? 'Kurskoden finns redan i ärendet. Redigera den befintliga kursen.' : '');
 if (error) { form.querySelector('#form-error').textContent = error; return; }
 const offers = fromCatalog ? official.offerings.filter(o => o.programmeId === course.programmeId) : [];
 course.sourceUrl = fromCatalog ? official.syllabusUrl : '';
 course.periods = [...new Set(offers.flatMap(o => o.periods))].sort();
 course.timePlans = offers.flatMap(o => o.timePlans);
 if (previous) data.courses[data.courses.indexOf(previous)] = course;
 else data.courses.push(course);
 selected = course.start.slice(0,7);
 if (!range().some(m => m.key === selected)) { mode = 'academic'; year = Number(selected.slice(0,4)) - (Number(selected.slice(5)) < 8 ? 1 : 0); }
 page = 'plan';
 const ok = save(true);
 dialog.close();
 render(true);
 if (ok) toast('Kursen har sparats.');
}

function updateCase(values) {
 const editing = dialog.querySelector('#editor-title').textContent === 'Ändra grundinformation';
 const old = editing ? activeCase() : null;
 const now = new Date().toISOString();
 const record = cleanCase({ id:old?.id || newId(), createdAt:old?.createdAt || now, updatedAt:now,
  programmeId:values.programmeId, admissionYear:Number(values.admissionYear) || null,
  studyYear:Number(values.studyYear) || null, planningYear:Number(values.planningYear), targetCredits:Number(values.targetCredits),
  note:old?.note || '', alternative:old?.alternative || false });
 if (old && (old.programmeId !== record.programmeId || old.planningYear !== record.planningYear) &&
  !window.confirm('Behålla befintliga kurser och markera kurskopplingar som behöver kontrolleras?')) return;
 if (old) data.cases[data.cases.indexOf(old)] = record;
 else data.cases.push(record);
 const course = pendingCourse;
 pendingCourse = null;
 setActive(record.id);
 page = course ? 'catalog' : 'plan';
 save();
 if (course) { filter.programme = record.programmeId || course.programme; courseEditor(null,course.code); }
 else dialog.close();
 render(true);
}

function submitMigration(fields, values) {
 const indices = fields.getAll('plan').map(Number).sort((a,b)=>a-b);
 if (!indices.length) throw new Error('Välj minst en plan.');
 const migrated = migrateLegacy(migrationGroups,new Set(indices),catalog,new Date().toISOString(),defaultYear);
 const names = migrationGroups.map(group => group.profile.name).filter(name => typeof name === 'string' && name.trim());
 migrated.cases.forEach((c,i) => {
  const note = values['review-'+indices[i]].trim();
  if (names.some(name => note.toLocaleLowerCase('sv').includes(name.trim().toLocaleLowerCase('sv')))) throw new Error('Ta bort namnet ur anteckningen innan du fortsätter.');
  c.note = note;
 });
 data.cases.push(...migrated.cases);
 data.courses.push(...migrated.courses);
 const ok = save();
 dialog.close();
 page = 'cases';
 render(true);
 toast(ok ? `${migrated.cases.length} ärenden och ${migrated.courses.length} kurser har konverterats.` : 'Planerna konverterades i arbetsytan. Sparning misslyckades.');
}

document.addEventListener('submit', event => {
 const form = event.target;
 if (!['case-form','course-form','migration-form'].includes(form.id)) return;
 event.preventDefault();
 const fields = new FormData(form);
 const values = Object.fromEntries(fields);
 try {
  if (form.id === 'course-form') updateCourse(form,values);
  if (form.id === 'case-form') updateCase(values);
  if (form.id === 'migration-form') submitMigration(fields,values);
 } catch (error) { form.querySelector('#form-error').textContent = error.message; }
});

function changeCourse(id, remove) {
 const course = activeCourses().find(c => c.id === id);
 if (!course) return;
 const old = { ...course };
 if (remove) { data.courses = data.courses.filter(c => c.id !== course.id); dialog.close(); }
 else {
  course.status = course.status === 'done' ? 'planned' : 'done';
  course.completedCredits = course.status === 'done' ? course.credits : 0;
 }
 save(true);
 render(true);
 toast(remove ? 'Kursen togs bort ur planen.' : 'Kursstatus har ändrats.', () => {
  const record = data.cases.find(c => c.id === old.caseId);
  if (!record) return;
  const index = data.courses.findIndex(c => c.id === old.id);
  if (index >= 0) data.courses[index] = old;
  else if (!old.code || !data.courses.some(c => c.caseId === old.caseId && c.code === old.code)) data.courses.push(old);
  record.updatedAt = new Date().toISOString();
 });
}

document.addEventListener('click', event => {
 const button = event.target.closest('button');
 if (!button) return;
 const b = button.dataset;
 if ('close' in b) { dialog.close(); return; }
 if (b.page) { page = b.page; render(true); return; }
 if (b.caseOpen) { setActive(b.caseOpen); page = 'plan'; save(); render(true); return; }
 if (b.caseCopy) { copyCase(b.caseCopy); return; }
 if (b.caseDelete) { deleteCase(b.caseDelete); return; }
 if (b.caseBackup) { exportJSON(b.caseBackup); return; }
 if (b.mode) { year = switchedYear(mode,b.mode,year,selected); mode = b.mode; render(); document.querySelector('[data-mode="'+mode+'"]')?.focus(); return; }
 if (b.year) { year = Math.min(2101,Math.max(1950,year+Number(b.year))); render(); document.querySelector('[data-year="'+b.year+'"]')?.focus(); return; }
 if (b.month) { selected = b.month; render(); document.querySelector('[data-month="'+selected+'"]')?.focus(); return; }
 if (b.view) { view = b.view; render(); document.querySelector('[data-view="'+view+'"]')?.focus(); return; }
 if (b.edit) { courseEditor(b.edit); return; }
 if (b.details) {
  const course = sourceCourse(b.details);
  openDialog(catalogCourseDetails(catalog,course,filter.programme,activeCase(),activeCourses().some(c => c.code === course.code)));
  return;
 }
 if (b.addCode) { courseEditor(null,b.addCode); return; }
 if (b.delete || b.complete) { changeCourse(b.delete || b.complete,Boolean(b.delete)); return; }
 switch (b.action) {
  case 'custom-course': courseEditor(); break;
  case 'new-case':
   pendingCourse = b.course ? { code:b.course, programme:filter.programme } : null;
   openDialog(caseForm(catalog,null,defaultYear)); break;
  case 'edit-case': pendingCourse = null; openDialog(caseForm(catalog,activeCase(),defaultYear)); break;
  case 'close-case': setActive(null); page = 'cases'; save(); render(true); break;
  case 'export': exportDialog(); break;
  case 'backup-all': exportJSON(); break;
  case 'import': importBackup(); break;
  case 'clear-cases': clearCases(); break;
  case 'review-legacy': reviewLegacy(); break;
  case 'leave-legacy': legacyExpanded = false; render(true); break;
  case 'remove-legacy':
   confirmAction('Ta bort äldre lokal lagring?', 'Äldre planer och namn i den tidigare versionens lokala lagring raderas från den här webbläsaren.', () => {
    try { storage.removeItem(LEGACY_KEY); }
    catch { toast('Äldre planer kunde inte raderas.'); return false; }
    legacy = null;
    toast('Den äldre lagringen har tagits bort.');
    return true;
   }); break;
  case 'reset-filters': filter = { ...defaultFilter(filter.programme), expanded:true }; render(); document.querySelector('#course-search')?.focus(); break;
  case 'apply-move': {
   const form = document.querySelector('#course-form');
   try {
    const moved = moveCourse(Object.fromEntries(new FormData(form)),form.elements.moveMonth.value);
    form.elements.start.value = moved.start;
    form.elements.end.value = moved.end;
    form.querySelector('#form-error').textContent = 'Välj Spara kurs för att behålla ändringen.';
   } catch { form.querySelector('#form-error').textContent = 'Välj en giltig månad.'; }
   break;
  }
 }
});

document.addEventListener('input', event => {
 const field = event.target;
 if (field.id === 'case-note' && activeCase()) { activeCase().note = field.value; save(true); }
 if (field.id === 'course-search') { filter.q = field.value; renderCatalog(); }
 if (field.id === 'programme-search') {
  filter.programmeQuery = field.value;
  const control = document.querySelector('#programme-filter');
  control.innerHTML = '<option value="">Välj program</option>' + programmeOptions(catalog,filter.programme,field.value);
  control.value = filter.programme;
 }
});

document.addEventListener('change', event => {
 const field = event.target;
 if (field.id === 'programme-filter') {
  filter = { ...defaultFilter(field.value), programmeQuery:filter.programmeQuery, expanded:true };
  render();
  document.querySelector('#programme-filter')?.focus();
 }
 if (field.dataset.catalogFilter) { filter[field.dataset.catalogFilter] = field.value; renderCatalog(); }
 if (field.id === 'catalog-month' && /^\d{4}-\d{2}$/.test(field.value)) selected = field.value;
 if (field.id === 'catalog-jump') {
  const section = document.getElementById(field.value);
  if (!section) return;
  document.querySelector('.lot-target')?.classList.remove('lot-target');
  section.classList.add('lot-target');
  section.open = true;
  if (section.parentElement.matches('details')) section.parentElement.open = true;
  section.querySelector('summary').focus();
  section.scrollIntoView({block:'start'});
 }
});

render();
