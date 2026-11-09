import { months, period, intersects, visibleCourses, validateCourse, switchedYear, moveCourse } from './model.js';
import { CASE_KEY, LEGACY_KEY, emptyWorkspace, newId, cleanCase, loadWorkspace, saveWorkspace, caseBackup, importCases, cleanPlannedCourse, legacyChoices, migrateLegacy, exportPreferences } from './cases.js';
import { savedCases, startCaseForm, caseForm, caseProgram, casePrivacy, caseDescription, caseTitle } from './case-view.js';
import { coursePanel, catalogResults, catalogCourseDetails, htmlEscape, officialLink } from './catalog-view.js';
import { downloadFile } from './exports.js';
import { openExportPanel } from './export-ui.js';
import { initialScenario, scenarioFor, scenarioCourses, validateTask, copyScenario, planSlots, slots, hasKey, yearOf, yearText, isPlanYear, plannedLabel, placementLabel, planningDates, datesForSlots } from './planning.js';
import { planningWorkspace, notesPanel, comparisonDialog, planDetailsDialog, taskForm, planDialog, formEnd } from './planning-view.js';
import { courseDraft, placementForm, sourcePlacementButtons } from './course-placement-ui.js';
import { createPlanningSnapshot } from './planning-export.js';

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
let selected = year + '-08', dragged = null;
let comparison = '', mobilePicker = false, preferredSlot = '';
let workspaceView = 'planning';
let completionFilters = {status:'open',period:'',course:''};
const activeScenario = () => scenarioFor(activeCase());
let planYear = activeScenario()?.years.includes(year) ? year : activeScenario()?.years[0] ?? year;
let legacy = null, migrationGroups = null;
try { legacy = storage.getItem(LEGACY_KEY); } catch { /* Storage failure is surfaced above. */ }

function defaultFilter() {
 const record = activeCase();
 const studyYear = record?.studyYear && catalog.courses.some(c=>c.offerings.some(o=>o.programmeId===record.programmeId && o.year===record.studyYear)) ? record.studyYear : '';
 return {q:'',year:String(studyYear),category:'',specialization:'',lp:'',status:'',level:'',expanded:false,limit:40};
}
let filter = defaultFilter();
const range = () => period(mode, year);
const activeCourses = () => activeCase() ? scenarioCourses(data.courses,activeCase(),activeScenario()) : [];
const shownCourses = () => visibleCourses(activeCourses().filter(c=>c.useOwnDates || c.plannedPeriods.every(p=>datesForSlots(activeCase(),c.plannedYear,[p]).length)),data.activeCaseId,range());
const saveLabel = () => storageError ? 'Sparning misslyckades · osparade ändringar' : data.cases.length ? 'Sparat lokalt' : 'Lokal arbetsyta';

function save(touch = false) {
 if (touch && activeCase()) activeCase().updatedAt = new Date().toISOString();
 try {
  storageError = readError || storage.getItem(CASE_KEY) !== lastSaved || !saveWorkspace(storage, data, catalog);
  if (!storageError) lastSaved = storage.getItem(CASE_KEY);
 } catch { storageError = true; }
 const status = document.querySelector('#save-status');
 if (status) { status.textContent = saveLabel(); status.dataset.saveError = String(storageError); }
 return !storageError;
}

function setActive(id) {
 data.activeCaseId = id;
 mode = 'academic';
 year = activeCase()?.planningYear ?? defaultYear;
 selected = year + '-08';
 planYear = activeScenario()?.years.includes(year) ? year : activeScenario()?.years[0] ?? year;
 comparison = '';
 completionFilters = {status:'open',period:'',course:''};
 filter = defaultFilter();
 preferredSlot = '';
 if (!id) workspaceView = 'planning';
}

function toast(message,undo){const t=document.querySelector('#toast');t.replaceChildren(document.createTextNode(message));if(undo){const b=document.createElement('button');b.textContent='Ångra';b.onclick=()=>{undo();const ok=save();render();toast(ok?'Ändringen har ångrats.':'Ändringen ångrades i arbetsytan. Sparning misslyckades.');};t.append(b);}t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),undo?12000:5000);}
function title(){return mode==='academic'?`${year} / ${year+1}`:mode==='autumn'?`HT ${year}`:mode==='spring'?`VT ${year}`:String(year);}
function season(m){return m.month>=7?'autumn':m.month>=5?'summer':'spring';}
function courseBar(c,r){const indices=r.map((m,i)=>intersects(c,m)?i:-1).filter(i=>i>=0);return `<div class="course-row timeline-grid"><button class="course-details" data-edit="${esc(c.id)}" aria-label="Redigera ${esc(c.title)}"><b>${esc(c.title)}</b><small>${esc(c.code||'Egen kurs')} · ${fmt(c.credits)} hp ${c.level?'· '+esc(c.level):''}</small></button>${r.map((m,i)=>`<div class="cell ${season(m)==='summer'?'summer-cell':''} ${m.key===selected?'selected-cell':''}" style="grid-column:${i+2}" data-drop-month="${m.key}"></div>`).join('')}<button draggable="false" data-drag-course="${esc(c.id)}" class="bar ${esc(c.status)}" style="grid-column:${indices[0]+2} / ${indices.at(-1)+3}" data-edit="${esc(c.id)}" title="Dra för att flytta. Klicka för att redigera ${esc(c.title)}." aria-label="Flytta eller redigera ${esc(c.title)}">⠿ ${statuses[c.status]} · ${fmt(c.credits)} hp</button></div>`;}
function timeline(courses,r){const groups=[];for(const m of r){const key=season(m);if(groups.at(-1)?.key===key)groups.at(-1).count++;else groups.push({key,count:1,year:m.year});}return `<div class="timeline-scroll"><div class="timeline" style="--columns:${r.length}"><div class="season-row timeline-grid"><div class="season-label">${labels[mode].toUpperCase()} ${title()}</div>${groups.map(g=>`<div class="season ${g.key}" style="grid-column:span ${g.count}">${g.key==='autumn'?'HÖST':g.key==='spring'?'VÅR':'SOMMAR'} ${g.year}</div>`).join('')}</div><div class="month-row timeline-grid"><div class="course-label">Kurs / högskolepoäng</div>${r.map(m=>`<button class="month ${m.key===selected?'active':''}" data-month="${m.key}" data-drop-month="${m.key}" aria-pressed="${m.key===selected}" aria-label="${months[m.month]} ${m.year}">${months[m.month].slice(0,3)}</button>`).join('')}</div>${courses.map(c=>courseBar(c,r)).join('')||`<p class="workspace-empty">Inga kurser i perioden.</p>`}</div></div>`;}
function calendarPanelView() {
 const courses = shownCourses();
 return `<section class="planning"><div class="planning-head"><div><h2>Kalender med planeringsdatum</h2><p>Kurser med egna eller föreslagna kalenderdatum. Dra för att flytta till en annan månad.</p></div>
 <div class="segmented" aria-label="Kalendervy">${Object.entries(labels).map(([key,label])=>`<button data-mode="${key}" aria-pressed="${mode===key}">${label}</button>`).join('')}</div></div>
 <div class="controls year-selector"><button data-year="-1" aria-label="Föregående år">←</button><b>${title()}</b><button data-year="1" aria-label="Nästa år">→</button></div>
 <div class="calendar-wide">${timeline(courses,range())}</div><div class="calendar-narrow">
 ${courses.map(c=>`<p><button data-edit="${c.id}">${esc(c.title)}</button> ${date(c.start)} – ${date(c.end)}</p>`).join('')||'<p>Inga kurser i perioden.</p>'}</div></section>`;
}

function planView() {
 const record = activeCase();
 return planningWorkspace(record,activeScenario(),data.courses.filter(c=>c.caseId===record.id),planYear,comparison,completionFilters,catalog,
  coursePanel(catalog,record,filter,activeCourses()));
}

function openPicker(slot) {
 if (slot) {
  preferredSlot = slot;
  filter.lp = planSlots(activeCase(),planYear).includes(slot) ? slot : '';
  filter.limit = 40;
 }
 if (mobilePicker || matchMedia('(max-width: 760px)').matches) {
  mobilePicker = true;
  openDialog(planDialog('Välj kurser',`<div class="details-body" data-mobile-picker>${coursePanel(catalog,activeCase(),filter,activeCourses(),true)}</div>`));
 } else {
  refreshCoursePanels();
  document.querySelector('.workspace-catalog [data-catalog-query]')?.focus();
 }
}

function courseEditor(id,code,offeringId) {
 if (!activeCase()) return;
 const previous = id ? activeCourses().find(c=>c.id===id) : code && activeCourses().find(c=>c.code===code);
 const source = sourceCourse(previous?.code || code);
 const draft = courseDraft(previous,source,activeCase(),activeScenario(),planYear,preferredSlot,activeCase().programmeId,offeringId);
 openDialog(placementForm(draft,activeCase(),activeScenario(),mobilePicker,source));
}

function replaceCourse(next) {
 const index = data.courses.findIndex(c=>c.id===next.id);
 if (index<0) data.courses.push(next);
 else data.courses[index] = next;
}

function rememberYear(scenario,nextYear) {
 if (!scenario.years.includes(nextYear)) scenario.years = [...scenario.years,nextYear].sort((a,b)=>a-b);
}

function moveFeedback(before,next) {
 replaceCourse(next);
 rememberYear(activeScenario(),next.plannedYear);
 const ok = save(true);
 render();
 refreshCalendar();
 document.querySelector('[data-edit="'+next.id+'"]')?.focus({preventScroll:true});
 toast(ok?'Kursen flyttades till '+plannedLabel(next.plannedPeriods)+'.':'Kursen flyttades i arbetsytan. Sparning misslyckades.',()=>{
  const current = data.courses.find(c=>c.id===before.id);
  if (current===next) replaceCourse(before);
 });
}

function commitMove(id,month) {
 const old = activeCourses().find(c=>c.id===id);
 if (!old) return;
 try {
  const moved = moveCourse(old,month);
  selected = month;
  moveFeedback(old,{...moved,plannedYear:yearOf(moved.start),plannedPeriods:['OWN'],allocation:[],periodRates:[],useOwnDates:true});
 } catch { toast('Kursen kunde inte flyttas.'); }
}

function dropOnPeriod(id,target) {
 const old = activeCourses().find(c=>c.id===id);
 if (!old || !hasKey(slots,target)) return;
 const numeric = old.plannedPeriods.every(p=>/^\d$/.test(p)) && /^\d$/.test(target);
 const offset = Number(target)-Number(old.plannedPeriods[0]);
 const periods = numeric ? old.plannedPeriods.map(p=>String(Number(p)+offset)) : [target];
 if (periods.some(p=>!hasKey(slots,p))) {
  toast('Hela kursen ryms inte från den perioden. Ändra placering i kursdialogen.');
  return;
 }
 if (!numeric && old.plannedPeriods.length>1) {
  toast('Ändra flerperiodskursens placering i kursdialogen.');
  return;
 }
 if (old.plannedYear===planYear && old.plannedPeriods.join(',')===periods.join(',')) return;
 const [start,end] = target==='OWN' ? [old.start,old.end] : planningDates(activeCase(),planYear,periods);
 const allocation = numeric ? old.allocation.map(a=>({...a,slot:String(Number(a.slot)+offset)})) : [];
 const periodRates = numeric ? (old.periodRates || []).map(rate=>({...rate,slot:String(Number(rate.slot)+offset)})) : [];
 moveFeedback(old,{...old,plannedYear:planYear,plannedPeriods:periods,allocation,periodRates,start,end,useOwnDates:target==='OWN'});
}

let pointerDrag=null,suppressClicksUntil=0;
function pointerMonth(event){const timeline=document.querySelector('.timeline');if(!timeline)return null;const bounds=timeline.getBoundingClientRect();if(event.clientY<bounds.top||event.clientY>bounds.bottom)return null;return [...timeline.querySelectorAll('.month[data-drop-month]')].find(el=>{const r=el.getBoundingClientRect();return event.clientX>=r.left&&event.clientX<=r.right;})?.dataset.dropMonth;}
function clearPointerDrag(){document.querySelector('.drag-ghost')?.remove();document.body.classList.remove('dragging-course');document.querySelectorAll('.drop-active').forEach(el=>el.classList.remove('drop-active'));pointerDrag=null;}
document.addEventListener('pointerdown',e=>{const el=e.target.closest('[data-drag-course]');if(!el||e.button!==0)return;pointerDrag={id:el.dataset.dragCourse,x:e.clientX,y:e.clientY,active:false,element:el};el.setPointerCapture(e.pointerId);});
document.addEventListener('pointermove',e=>{if(!pointerDrag)return;if(!pointerDrag.active&&Math.hypot(e.clientX-pointerDrag.x,e.clientY-pointerDrag.y)<6)return;e.preventDefault();if(!pointerDrag.active){pointerDrag.active=true;const ghost=document.createElement('div');ghost.className='drag-ghost';ghost.textContent=data.courses.find(c=>c.id===pointerDrag.id)?.title||'Flytta kurs';document.body.append(ghost);document.body.classList.add('dragging-course');}const ghost=document.querySelector('.drag-ghost');ghost.style.left=e.clientX+12+'px';ghost.style.top=e.clientY+12+'px';document.querySelectorAll('.drop-active').forEach(el=>el.classList.remove('drop-active'));const target=pointerMonth(e);if(target)document.querySelectorAll(`[data-drop-month="${target}"]`).forEach(el=>el.classList.add('drop-active'));});
document.addEventListener('pointerup',e=>{if(!pointerDrag)return;const active=pointerDrag.active,id=pointerDrag.id,month=pointerMonth(e);clearPointerDrag();if(active){suppressClicksUntil=performance.now()+350;e.preventDefault();if(month)commitMove(id,month);}});
document.addEventListener('pointercancel',clearPointerDrag);
document.addEventListener('click',e=>{if(performance.now()<suppressClicksUntil){e.preventDefault();e.stopImmediatePropagation();}},true);


const dialog = document.querySelector('#editor');
let dialogReturnFocus = null;

function helpDialog() {
 return planDialog('Så fungerar det',`<div class="details-body help">
 <h2>Arbeta med ett ärende</h2><ol><li>Skapa en studieplanering och ange program, årskurs och planeringsläsår.</li>
 <li>Sök i Välj kurser. Öppna kursnamnet för källuppgifter eller lägg till kursen direkt.</li>
 <li>Dra kursen till en period eller öppna kursen och ändra placeringen.</li>
 <li>Exportera Word eller PDF. Använd JSON om du vill spara en namnfri säkerhetskopia.</li></ol>
 <h2>Kursutbud och antagningskull</h2><p>Antagningskullen anger när utbildningen påbörjades. Kursutbudet har ett eget källäsår. Kontrollera kraven i utbildningsplanen för antagningskullen.</p>
 <p>LP anger placering i LoT. Kursens HP räknas en gång i vald vy och fördelas inte mellan perioderna. Avklarad är en manuell markering.</p>
 <h2>Lokal lagring och dokument</h2><p>${casePrivacy} Namnfria uppgifter kan identifiera någon i kombination. Planerna synkas inte och kan försvinna när webbläsardata rensas.</p>
 <p>Studentens namn kan anges i exportdialogen och rensas efter export eller när dialogen stängs. Välj översikt eller detaljerat underlag och vilka scenarier som ska ingå.</p>
 <p>Kontrollera resultat i Ladok, examenskrav i utbildningsplanen, studiemedel hos CSN och schema i TimeEdit.</p>
 ${officialLink(catalog.sourceUrl,'Officiellt kursutbud på LTH')}</div><div class="dialog-actions"><button data-close>Stäng</button></div>`);
}

function updateCourseResults() {
 for (const host of document.querySelectorAll('[data-course-results]')) host.innerHTML = catalogResults(catalog,activeCase(),filter,activeCourses());
}

function refreshCoursePanels(control) {
 for (const host of document.querySelectorAll('.workspace-catalog,[data-mobile-picker]')) {
  host.innerHTML = coursePanel(catalog,activeCase(),filter,activeCourses(),host.hasAttribute('data-mobile-picker'));
 }
 if (control) (dialog.open?dialog:document).querySelector('[data-catalog-filter="'+control+'"]')?.focus();
}

const navigation = [
 ['meeting','Mötesanteckning','<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>'],
 ['planning','Studieplanering','<path d="m2 10 10-5 10 5-10 5zM6 12v5c3 2 9 2 12 0v-5m4-2v6"/>'],
 ['calendar','Kalender','<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-11 5h2m3 0h2"/>'],
];

function meetingView(record) {
 const scenario = activeScenario();
 return `<div class="meeting-view"><section class="workspace-card meeting-card">
 <h1>Mötesanteckning</h1><p class="muted">Spara och återuppta en studieplan med ett ärende-ID.</p>
 <div class="actions"><button data-action="new-case">＋ Nytt ärende</button><button data-action="saved-cases">Öppna sparat</button></div>
 <p>${record?`${esc(caseTitle(record))} · ${esc(scenario.name)}`:'Inget aktivt ärende.'}</p></section>
 ${record?`<section class="workspace-card meeting-card"><h2>Grundinformation</h2><p>${esc(caseDescription(record,catalog))}</p>
 <div class="actions"><button data-action="edit-case">Ändra grundinformation</button></div></section>
 <section class="workspace-card meeting-card"><h2>Anteckningar och uppföljning</h2>${notesPanel(scenario,true)}</section>
 <section class="workspace-card meeting-card meeting-export"><div><h2>Exportera mötesanteckning</h2><p class="muted">Granska dokumentet och välj PDF eller Word.</p></div>
 <button class="primary" data-action="export">Granska och exportera</button></section>`:''}</div>`;
}

function render(focusHeading = false) {
 const app = document.querySelector('#app');
 const open = app.dataset.view===workspaceView ? [...app.querySelectorAll('details[id]')].map(el=>[el.id,el.open]) : [];
 app.dataset.view = workspaceView;
 const record = activeCase();
 app.innerHTML = `<div class="workspace-shell"><header class="workspace-masthead"><div class="workspace-frame workspace-header">
 <div class="workspace-brand"><strong>Studieplaneringsverktyg</strong><small>Studie- och karriärvägledning</small></div>
 <div class="workspace-header-actions"><span id="save-status" role="status" data-save-error="${storageError}">${saveLabel()}</span>
 <button data-action="new-case">＋ Nytt ärende</button><button data-action="saved-cases">Öppna sparat</button>
 <details class="workspace-menu" id="workspace-menu"><summary>Mer</summary><div class="workspace-menu-content">
 <button data-action="import">Importera JSON</button><button data-action="backup-all" ${data.cases.length?'':'disabled'}>Exportera alla ärenden som JSON</button>
 ${activeCase()?'<button data-case-backup="'+activeCase().id+'">Exportera aktuellt ärende som JSON</button><button data-action="close-case">Stäng ärendet</button>':''}
 ${legacy?'<button data-action="review-legacy">Granska äldre planer</button><button class="danger-text" data-action="remove-legacy">Ta bort äldre lagring</button>':''}
 <button data-action="help">Så fungerar det</button><button class="danger-text" data-action="clear-cases">Rensa alla lokala ärenden</button></div></details></div></div></header>
 <div class="workspace-nav"><nav class="workspace-frame" aria-label="Huvudnavigering">${navigation.map(([view,label,icon])=>
 `<button data-workspace-view="${view}" ${view===workspaceView?'aria-current="page"':''}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>${label}</button>`).join('')}</nav></div>
 <main id="main" class="workspace-frame workspace-main" tabindex="-1">
 ${readError?'<p class="notice" role="alert">Sparade ärenden kunde inte läsas. Lagringen skrivs inte över. Rensning finns under Mer.</p>':
 storageError?'<p class="notice" role="alert">Sparning misslyckades. Säkerhetskopiera arbetsytan som JSON innan du laddar om.</p>':''}
 ${workspaceView==='meeting'?meetingView(record):workspaceView==='calendar'?`<div id="workspace-calendar">
 <section class="workspace-intro"><h1>Kalender</h1><p>Visa planeringen som kalenderår, läsår eller termin.</p></section>
 ${record?`<div id="calendar-content">${calendarPanelView()}</div>`:'<section class="workspace-card meeting-card"><h2>Inget aktivt ärende</h2><p>Skapa eller öppna ett ärende för att se kurser i kalendern.</p><div class="actions"><button data-action="new-case">＋ Nytt ärende</button><button data-action="saved-cases">Öppna sparat</button></div></section>'}</div>`:record?planView():startCaseForm(catalog,defaultYear)}</main>
 <footer class="workspace-footer"><div class="workspace-frame"><span>Studie- och karriärvägledning · Studieplanering</span><span>Lokal arbetsyta</span></div></footer></div>`;
 for (const [id,isOpen] of open) {
  const details = document.getElementById(id);
  if (details && app.contains(details)) details.open = isOpen;
 }
 if (focusHeading) {
  const heading = app.querySelector('h1');
  heading.tabIndex = -1;
  heading.focus({preventScroll:true});
 }
}

function openCalendar() {
 openDialog(planDialog('Kalenderdatum',`<div id="calendar-content" class="details-body">${calendarPanelView()}</div><div class="dialog-actions"><button data-close>Stäng</button></div>`));
}

function refreshCalendar(control) {
 const host = dialog.querySelector('#calendar-content') || document.querySelector('#workspace-calendar #calendar-content');
 if (!host) return;
 host.innerHTML = calendarPanelView();
 if (control) host.querySelector(control)?.focus({preventScroll:true});
}

function openDialog(html) {
 if (!dialog.open) dialogReturnFocus = document.activeElement;
 dialog.innerHTML = html;
 if (!dialog.open) dialog.showModal();
 else (dialog.querySelector('[autofocus]') || dialog.querySelector('button'))?.focus();
}
dialog.addEventListener('keydown',event=>{
 if (event.key==='Escape' && event.target.matches('input[type="search"]')) {
  event.preventDefault();
  dialog.close();
 }
});
dialog.addEventListener('close', () => {
 if (!dialog.open) dialog.replaceChildren();
 migrationGroups = null;
 mobilePicker = false;
 const target = dialogReturnFocus;
 dialogReturnFocus = null;
 if (target?.isConnected && document.activeElement!==target && !dialog.open) target.focus({preventScroll:true});
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
 const scenario = activeScenario();
 if (!record) return;
 const visibleYear = planYear;
 const others = record.scenarios.filter(s=>s.id!==scenario.id);
 openExportPanel({scenario,others,programme:caseProgram(record,catalog)?.code,saved:data.exportSettings,
  yearLabel:'Läsår '+yearText(visibleYear),termOptions:[['HT','Hösttermin '+visibleYear],['VT','Vårtermin '+(visibleYear+1)]],
  snapshot:(options,name,extra)=>{
   const chosen = others.find(s=>s.id===extra);
   return createPlanningSnapshot({record,scenarios:chosen?[scenario,chosen]:[scenario],courses:data.courses,catalog,
    year:options.scope==='all'?null:visibleYear,term:['HT','VT'].includes(options.scope)?options.scope:'',name,options});
  },
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
   render();
   openDialog(savedCases(data,catalog,legacy));
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
  const literal = [...name].map(ch => '^$.*+?()[]{}|\\'.includes(ch) ? '\\' + ch : ch).join('');
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
   return true;
 }, true);
}

function scenarioEditor(record, editing = false) {
 const current = scenarioFor(record);
 const letter = String.fromCharCode(64+Math.min(record.scenarios.length,26));
 openDialog(planDialog(editing?'Byt namn på scenariot':'Skapa alternativ',`<form id="scenario-form" data-case="${record.id}" data-editing="${editing}">
 <label>Scenarionamn<input name="name" maxlength="80" required autofocus value="${esc(editing?current.name:'Alternativ '+letter)}"></label>
 <p class="note-footer">Använd en kort, avidentifierad beskrivning.</p>
 ${editing?'':'<label class="inline-check"><input type="checkbox" name="includeTasks"> Kopiera även moment, anteckningar och nästa steg</label>'}
 ${formEnd(editing?'Spara namn':'Skapa alternativ')}</form>`));
}

function updateScenario(form,values) {
 const record = data.cases.find(c=>c.id===form.dataset.case);
 const original = scenarioFor(record);
 const name = values.name.trim();
 if (!name) throw Error('Ange ett scenarionamn.');
 if (form.dataset.editing==='true') original.name = name;
 else {
  const copy = copyScenario(original,scenarioCourses(data.courses,record,original),newId(),name,Boolean(values.includeTasks),newId);
  record.scenarios.push(copy.scenario);
  data.courses.push(...copy.courses);
  record.activeScenarioId = copy.scenario.id;
 }
 setActive(record.id);
 finishEdit('Scenariot har sparats.');
}

function finishEdit(message) {
 const ok = save(true);
 dialog.close();
 render(true);
 toast(ok?message:'Ändringen finns i arbetsytan. Sparning misslyckades.');
}

function updateCourse(form, fields, values) {
 const record = activeCase();
 const scenario = activeScenario();
 const previous = activeCourses().find(c=>c.id===form.dataset.id);
 const code = values.code.trim().toUpperCase();
 const credits = Number(values.credits);
 if (code && activeCourses().some(c=>c.code.toUpperCase()===code && c.id!==previous?.id)) throw Error('Kurskoden finns redan i scenariot.');
 const plannedYear = Number(values.plannedYear);
 if (!scenario.years.includes(plannedYear)) throw Error('Läsåret finns inte i scenariot.');
 const plannedPeriods = fields.getAll('slot');
 if (!plannedPeriods.length) throw Error('Välj minst en planeringsperiod.');
 const useOwnDates = Boolean(values.useOwnDates) || plannedPeriods.includes('OWN');
 const [start,end] = useOwnDates ? [values.start,values.end] : planningDates(record,plannedYear,plannedPeriods);
 const allocation = plannedPeriods.filter(p=>values['hp-'+p]).map(p=>({slot:p,hp:Number(values['hp-'+p])}));
 const periodRates = plannedPeriods.filter(p=>values['rate-'+p]).map(p=>({slot:p,rate:Number(values['rate-'+p])}));
 const course = {id:previous?.id || newId(),caseId:record.id,scenarioId:scenario.id,code,title:values.title.trim(),credits,
  level:values.level,status:values.status,note:values.note,studyRate:values.studyRate?Number(values.studyRate):null,
  completedCredits:values.status==='done'?credits:Number(values.completedCredits || 0),
  weeks:values.weeks?Number(values.weeks):null,plannedYear,plannedPeriods,allocation,periodRates,useOwnDates,start,end,
  programmeId:values.programmeId,catalogYear:values.catalogYear,offeringId:Number(values.offeringId) || undefined};
 const error = validateCourse(course);
 if (error) throw Error('Ogiltig uppgift. '+error);
 replaceCourse(cleanPlannedCourse(course,catalog));
 planYear = plannedYear;
 finishEdit('Kursen har sparats.');
}

function updateTask(form,values) {
 const kind = form.dataset.kind;
 const scenario = activeScenario();
 const linked = activeCourses().find(c=>c.id===values.courseId);
 const task = validateTask({...values,id:form.dataset.id || newId(),courseId:linked?.id || null,code:linked?.code || values.code,year:Number(values.year)},kind);
 if (kind!=='steps' && !scenario.years.includes(task.year)) throw Error('Läsåret finns inte i scenariot.');
 const position = scenario[kind].findIndex(t=>t.id===task.id);
 if (position<0) scenario[kind].push(task);
 else scenario[kind][position] = task;
 if (kind==='completions') completionFilters = {status:'all',period:'',course:''};
 if (kind!=='steps') planYear = task.year;
 finishEdit('Momentet har sparats.');
}

function updateCase(form,values) {
 const editing = form.dataset.editing==='true';
 const old = editing ? activeCase() : null;
 const now = new Date().toISOString();
 const record = cleanCase({ id:old?.id || newId(), createdAt:old?.createdAt || now, updatedAt:now,
  programmeId:values.programmeId, admissionYear:Number(values.admissionYear) || null,
  studyYear:Number(values.studyYear) || null, planningYear:Number(values.planningYear), targetCredits:Number(values.targetCredits || 60),
  note:old?.note || '', alternative:old?.alternative || false });
 if (old && (old.programmeId !== record.programmeId || old.planningYear !== record.planningYear) &&
  !window.confirm('Behålla befintliga kurser och markera kurskopplingar som behöver kontrolleras?')) return;
 if (old) {
  record.scenarios = old.scenarios;
  record.activeScenarioId = old.activeScenarioId;
  rememberYear(scenarioFor(record),record.planningYear);
  data.cases[data.cases.indexOf(old)] = record;
 } else {
  const scenario = initialScenario(newId(),record.planningYear);
  record.scenarios = [scenario];
  record.activeScenarioId = scenario.id;
  data.cases.push(record);
 }
 setActive(record.id);
 if (!editing) workspaceView = 'planning';
 save();
 if (dialog.open) dialog.close();
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
  c.scenarios[0].agreements = note;
 });
 data.cases.push(...migrated.cases);
 data.courses.push(...migrated.courses);
 const ok = save();
 dialog.close();
 render(true);
 toast(ok ? `${migrated.cases.length} ärenden och ${migrated.courses.length} kurser har konverterats.` : 'Planerna konverterades i arbetsytan. Sparning misslyckades.');
}

document.addEventListener('submit', event => {
 const form = event.target;
 if (!['case-form','course-form','migration-form','task-form','scenario-form','year-form'].includes(form.id)) return;
 event.preventDefault();
 const fields = new FormData(form);
 const values = Object.fromEntries(fields);
 try {
  if (form.id === 'course-form') updateCourse(form,fields,values);
  if (form.id === 'task-form') updateTask(form,values);
  if (form.id === 'scenario-form') updateScenario(form,values);
  if (form.id === 'year-form') addPlanningYear(Number(values.year));
  if (form.id === 'case-form') updateCase(form,values);
  if (form.id === 'migration-form') submitMigration(fields,values);
 } catch (error) { form.querySelector('#form-error').textContent = error.message; }
});

function addPlanningYear(nextYear) {
 if (!isPlanYear(nextYear)) throw Error('Ange ett giltigt läsår.');
 rememberYear(activeScenario(),nextYear);
 planYear = nextYear;
 finishEdit('Läsåret har lagts till.');
}

function removeCourse(id) {
 const course = activeCourses().find(c=>c.id===id);
 if (!course) return;
 const scenario = activeScenario();
 const hasTasks = [...scenario.retakes,...scenario.completions].some(t=>t.courseId===id);
 openDialog(planDialog('Ta bort kurs',`<form id="remove-course-form"><p>Ta bort ${esc(course.code || course.title)} från det aktiva scenariot?</p>
 ${hasTasks?'<label>Kopplade moment<select name="tasks"><option value="detach">Behåll momenten och koppla loss kursen</option><option value="remove">Ta bort även kopplade moment</option></select></label>':''}
 ${formEnd('Ta bort kurs')}</form>`));
 dialog.querySelector('form').onsubmit = event => {
  event.preventDefault();
  const action = new FormData(event.target).get('tasks');
  const before = {courses:data.courses,retakes:scenario.retakes,completions:scenario.completions};
  for (const kind of ['retakes','completions']) scenario[kind] = action==='remove' ? scenario[kind].filter(t=>t.courseId!==id) :
   scenario[kind].map(t=>t.courseId===id ? {...t,courseId:null,code:course.code || t.code} : t);
  data.courses = data.courses.filter(c=>c.id!==id);
  if (!save(true)) {
   data.courses = before.courses;
   scenario.retakes = before.retakes;
   scenario.completions = before.completions;
   toast('Kursen kunde inte tas bort från lokal lagring.');
   return;
  }
  dialog.close();
  render(true);
  toast('Kursen har tagits bort.');
 };
}

function editTask(kind,id,preferred) {
 const scenario = activeScenario();
 if (!['retakes','completions','steps'].includes(kind)) return;
 const task = scenario[kind].find(t=>t.id===id);
 openDialog(taskForm(kind,task,planYear,scenario,activeCourses(),activeCase(),preferred));
}

function removeTask(kind,id) {
 const scenario = activeScenario();
 if (!['retakes','completions','steps'].includes(kind)) return;
 confirmAction('Ta bort uppgiften?', 'Uppgiften tas bort från det aktiva scenariot.',()=>{
  const before = scenario[kind];
  scenario[kind] = before.filter(t=>t.id!==id);
  if (save(true)) return true;
  scenario[kind] = before;
  toast('Uppgiften kunde inte tas bort från lokal lagring.');
  return false;
 });
}

function removeScenario() {
 const record = activeCase(), scenario = activeScenario();
 if (record.scenarios.length<2) return;
 confirmAction('Ta bort scenariot?', 'Kurser och moment i det aktiva scenariot tas bort.',()=>{
  const before = {scenarios:record.scenarios,courses:data.courses};
  record.scenarios = record.scenarios.filter(s=>s.id!==scenario.id);
  record.activeScenarioId = record.scenarios[0].id;
  data.courses = data.courses.filter(c=>c.caseId!==record.id || c.scenarioId!==scenario.id);
  if (!save(true)) {
   record.scenarios = before.scenarios;
   record.activeScenarioId = scenario.id;
   data.courses = before.courses;
   toast('Scenariot kunde inte tas bort från lokal lagring.');
   return false;
  }
  setActive(record.id);
  return true;
 });
}

document.addEventListener('click', event => {
 const button = event.target.closest('button');
 if (!button) return;
 const b = button.dataset;
 if (b.workspaceView) {
  if (workspaceView!==b.workspaceView) { workspaceView = b.workspaceView; render(true); }
  return;
 }
 if ('close' in b) { dialog.close(); return; }
 if (b.caseOpen) { setActive(b.caseOpen); workspaceView = 'planning'; save(); dialog.close(); render(true); return; }
 if (b.caseDelete) { deleteCase(b.caseDelete); return; }
 if (b.caseBackup) { exportJSON(b.caseBackup); return; }
 if (b.mode) { year = switchedYear(mode,b.mode,year,selected); mode = b.mode; refreshCalendar('[data-mode="'+mode+'"]'); return; }
 if (b.year) { year = Math.min(2101,Math.max(1950,year+Number(b.year))); refreshCalendar('[data-year="'+b.year+'"]'); return; }
 if (b.month) { selected = b.month; refreshCalendar('[data-month="'+selected+'"]'); return; }
 if (b.addSlot) { openPicker(b.addSlot); return; }
 if (b.taskNew) { editTask(b.taskNew,null,b.taskSlot); return; }
 if (b.taskEdit) { editTask(...b.taskEdit.split(':')); return; }
 if (b.taskRemove) { removeTask(...b.taskRemove.split(':')); return; }
 if (b.sourcePlacement) {
  const selectedSlots = b.sourcePlacement.split(',');
  dialog.querySelectorAll('[name=slot]').forEach(input=>{input.checked=selectedSlots.includes(input.value);});
  syncPlacementFields();
  return;
 }
 if (b.edit) { courseEditor(b.edit); return; }
 if (b.details) {
  const course = sourceCourse(b.details);
  if (!course) return;
  openDialog(catalogCourseDetails(catalog,course,activeCase().programmeId,activeCase(),activeCourses().some(c=>c.code===course.code),b.offering,mobilePicker));
  return;
 }
 if (b.addCode) { courseEditor(null,b.addCode,b.offering); return; }
 if (b.delete) { removeCourse(b.delete); return; }
 const menu = button.closest('.workspace-menu');
 if (menu) { menu.removeAttribute('open'); menu.querySelector('summary')?.focus(); }
 switch (b.action) {
  case 'custom-course': courseEditor(); break;
  case 'pick-course': openPicker(); break;
  case 'new-scenario': scenarioEditor(activeCase()); break;
  case 'rename-scenario': scenarioEditor(activeCase(),true); break;
  case 'delete-scenario': removeScenario(); break;
  case 'add-year': openDialog(planDialog('Lägg till läsår',`<form id="year-form"><label>Läsårets startår<input type="number" name="year" min="1950" max="2100" value="${Math.min(2100,activeScenario().years.at(-1)+1)}" required autofocus></label>${formEnd('Lägg till läsår')}</form>`)); break;
  case 'new-case': openDialog(caseForm(catalog,null,defaultYear)); break;
  case 'saved-cases': openDialog(savedCases(data,catalog,legacy)); break;
  case 'edit-case': openDialog(caseForm(catalog,activeCase(),defaultYear)); break;
  case 'close-case': setActive(null); save(); render(true); break;
  case 'calendar': openCalendar(); break;
  case 'help': openDialog(helpDialog()); break;
  case 'compare': openDialog(comparisonDialog(activeCase(),activeScenario(),data.courses,comparison)); break;
  case 'plan-details': openDialog(planDetailsDialog(activeCase(),activeScenario(),data.courses)); break;
  case 'export': exportDialog(); break;
  case 'backup-all': exportJSON(); break;
  case 'import': importBackup(); break;
  case 'clear-cases': clearCases(); break;
  case 'review-legacy': reviewLegacy(); break;
  case 'remove-legacy':
   confirmAction('Ta bort äldre lokal lagring?', 'Äldre planer och namn i den tidigare versionens lokala lagring raderas från den här webbläsaren.', () => {
    try { storage.removeItem(LEGACY_KEY); }
    catch { toast('Äldre planer kunde inte raderas.'); return false; }
    legacy = null;
    toast('Den äldre lagringen har tagits bort.');
    return true;
   }); break;
  case 'reset-filters': filter = {...defaultFilter(),expanded:true}; preferredSlot = ''; refreshCoursePanels('year'); break;
  case 'clear-period': filter.lp = ''; preferredSlot = ''; refreshCoursePanels(); (dialog.open?dialog:document).querySelector('[data-catalog-query]')?.focus(); break;
  case 'more-courses': {
   const host = button.closest('[data-course-results]');
   const visible = host.querySelectorAll('.workspace-course-row').length;
   filter.limit+=40;
   updateCourseResults();
   host.querySelectorAll('.workspace-course-row')[visible]?.querySelector('button')?.focus();
   break;
  }

 }
});

document.addEventListener('input', event => {
 const field = event.target;
 if (field.dataset.planNote && activeScenario()) {
  const key = field.dataset.planNote;
  if (key.includes(':')) activeScenario().periodNotes[key] = field.value;
  else activeScenario()[key] = field.value;
  save(true);
 }
 if (field.hasAttribute('data-catalog-query')) { filter.q = field.value; filter.limit = 40;
  for (const input of document.querySelectorAll('[data-catalog-query]')) if (input!==field) input.value = filter.q;
  updateCourseResults(); }
});

document.addEventListener('change', event => {
 const field = event.target;
 if (field.id==='active-scenario') {
  activeCase().activeScenarioId = field.value;
  setActive(activeCase().id);
  save();
  render();
  document.querySelector('#active-scenario')?.focus();
 }
 if (field.id==='plan-year') {
  planYear = Number(field.value);
  year = planYear + (mode==='spring'?1:0);
  selected = year+'-08';
  completionFilters = {status:'open',period:'',course:''};
  render();
  document.querySelector('#plan-year')?.focus();
 }
 if (field.id==='compare-scenario') {
  comparison = field.value;
  openDialog(comparisonDialog(activeCase(),activeScenario(),data.courses,comparison));
  dialog.querySelector('#compare-scenario')?.focus();
 }
 if (field.dataset.taskFilter) {
  completionFilters[field.dataset.taskFilter] = field.value;
  render();
  document.querySelector('[data-task-filter="'+field.dataset.taskFilter+'"]')?.focus();
 }
 if (field.closest('#course-form') && ['slot','plannedYear','useOwnDates','offeringId'].includes(field.name)) syncPlacementFields(field);
 if (field.dataset.catalogFilter) {
  const key = field.dataset.catalogFilter;
  filter[key] = field.value;
  filter.limit = 40;
  filter.expanded = Boolean(field.closest('.course-panel-content')?.querySelector('[data-filter-details]')?.open);
  if (key==='lp') preferredSlot = '';
  if (key==='year') refreshCoursePanels('year');
  else updateCourseResults();
 }
});

document.addEventListener('toggle',event=>{
 if (event.target.matches?.('[data-filter-details]') && event.target.isConnected) filter.expanded = event.target.open;
},true);

function syncPlacementFields(changed) {
 const form = dialog.querySelector('#course-form');
 const choices = [...form.querySelectorAll('[name=slot]')];
 if (changed?.name==='slot' && changed.checked) {
  if (changed.value==='OWN') choices.filter(i=>i!==changed).forEach(i=>i.checked=false);
  else choices.find(i=>i.value==='OWN').checked=false;
 }
 const periods = choices.filter(input=>input.checked).map(input=>input.value);
 for (const input of choices) {
  form.elements['hp-'+input.value].disabled = !input.checked;
  form.elements['rate-'+input.value].disabled = !input.checked;
 }
 if (periods.includes('OWN')) form.elements.useOwnDates.checked = true;
 const own = form.elements.useOwnDates.checked;
 form.querySelector('#placement-dates').hidden = !own;
 const values = Object.fromEntries(new FormData(form));
 const course = sourceCourse(values.code);
 const draft = courseDraft(null,course,activeCase(),activeScenario(),Number(values.plannedYear),null,values.programmeId,values.offeringId);
 const summary = form.querySelector('[data-offering-summary]');
 if (changed?.name==='offeringId' && summary) {
  const isTerm = planSlots({programmeId:draft.programmeId},draft.plannedYear)[0]==='HT';
  const periods = draft.periods.map(p=>isTerm?(p<=2?'HT':'VT'):String(p));
  summary.textContent = [draft.programmeId,draft.catalogYear.replace('_','/'),periods.length?plannedLabel([...new Set(periods)]):'Placering saknas'].join(' · ');
 }
 if (changed && ['offeringId','plannedYear'].includes(changed.name)) form.querySelector('[data-source-suggestions]').innerHTML = sourcePlacementButtons(draft,activeCase());
 form.querySelector('#placement-hint').textContent = placementLabel({...draft,plannedPeriods:periods,useOwnDates:own},activeCase());
}

let draggedPlacement = null;
document.addEventListener('dragstart',event=>{
 const control = event.target.closest('[data-placement-drag]');
 if (!control) return;
 draggedPlacement = control.dataset.placementDrag;
 event.dataTransfer.setData('text/plain',draggedPlacement);
 event.dataTransfer.effectAllowed = 'move';
});
document.addEventListener('dragover',event=>{
 const target = event.target.closest('[data-slot-drop]');
 if (!target || !draggedPlacement) return;
 event.preventDefault();
 event.dataTransfer.dropEffect = 'move';
 document.querySelectorAll('.slot-heading.drop-active').forEach(el=>el.classList.remove('drop-active'));
 target.classList.add('drop-active');
});
document.addEventListener('drop',event=>{
 const target = event.target.closest('[data-slot-drop]');
 if (!target || !draggedPlacement) return;
 event.preventDefault();
 dropOnPeriod(draggedPlacement,target.dataset.slotDrop);
 draggedPlacement = null;
});
document.addEventListener('dragend',()=>{
 draggedPlacement = null;
 document.querySelectorAll('.slot-heading.drop-active').forEach(el=>el.classList.remove('drop-active'));
});

render();
