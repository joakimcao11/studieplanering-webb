import { htmlEscape, officialLink } from './catalog-view.js';
import { calendarSource, calendarDecision, calendarDecision2027, officialCalendar } from './lth-calendar.js';
import { casePrivacy, caseProgram } from './case-view.js';
import { hp, yearText, slots, examStates, completionStates, completionTypes, retakeWindows, stepStates, roles, priorities, horizons, courseStates, planSlots, termSlots, termForSlot, viewScope, scopeTitle, datesForSlots, plannedLabel, placementLabel, rateDescription, taskCourse, summarizePlan, sortPlannedCourses } from './planning.js';

const h = htmlEscape;
const yearOption = (y,selected) => `<option value="${y}" ${y===selected?'selected':''}>${yearText(y)}</option>`;
export const planSelect = (entries,value) => entries.map(([key,label])=>`<option value="${h(key)}" ${String(key)===String(value)?'selected':''}>${h(label)}</option>`).join('');
export const localDay = value => value ? new Intl.DateTimeFormat('sv-SE',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Stockholm'}).format(new Date(value+'T12:00:00Z')) : 'Ej angivet';
const intervalsLabel = intervals => intervals.map(([a,b])=>localDay(a)+' – '+localDay(b)).join(' · ');
const statusesFor = kind => kind==='retakes'?examStates:kind==='completions'?completionStates:stepStates;
export const planDialog = (title,body) => `<div class="dialog-head"><h2 id="editor-title">${h(title)}</h2><button data-close aria-label="Stäng">✕</button></div>${body}`;
export const formEnd = label => `<p class="error" role="alert" id="form-error"></p><div class="dialog-actions"><button type="button" data-close>Avbryt</button><button class="primary" type="submit">${h(label)}</button></div>`;

function gridTable(labels, rows, className = '') {
 return `<div class="table-scroll"><table class="plan-table ${className}" role="table"><thead role="rowgroup"><tr role="row">${labels.map(label=>`<th role="columnheader" scope="col">${h(label)}</th>`).join('')}</tr></thead>
 <tbody role="rowgroup">${rows.map(row=>`<tr role="row">${row.map((cell,i)=>`<td role="cell" data-label="${h(labels[i])}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function loadLabel(load) {
 const base = hp(load.hp)+' hp'+(load.manual?' (uppskattning)':'');
 return load.unknown ? (load.hp ? base+' + ' : '')+load.unknown+' utan fördelning' : base;
}

function courseStatus(course) {
 return courseStates[course.status]+' · '+rateDescription(course);
}
function courseRow(course,scenario,record) {
 const n = scenario.completions.filter(t=>t.courseId===course.id && t.status!=='passed').length;
 const retakes = scenario.retakes.filter(t=>t.courseId===course.id && !['passed','cancelled'].includes(t.status)).length;
 return [h(course.code || 'Egen kurs'), `<b>${h(course.title)}</b><small>${h(placementLabel(course,record))}</small>`,
  hp(course.credits),yearText(course.plannedYear),`${h(plannedLabel(course.plannedPeriods))}${course.useOwnDates?`<small>${localDay(course.start)} – ${localDay(course.end)}</small>`:''}`,
  h(courseStatus(course)),`${retakes} omtent. · ${n} kompl.`,
  `<div class="actions"><button data-edit="${course.id}" aria-label="Ändra placering för ${h(course.title)}">Ändra placering</button><button class="danger-text" data-delete="${course.id}">Ta bort</button></div>`];
}

function periodBox(record,year,slot,summary,courses,spanning = [],single = false) {
 const intervals = datesForSlots(record,year,[slot]);
 const planned = courses.filter(c=>c.plannedPeriods.includes(slot));
 const count = planned.length + (planned.length===1?' kurs':' kurser');
 const load = summary.slots[slot];
 return `<section class="period-box slot-heading" data-slot-drop="${slot}" aria-label="${slots[slot]}">
 <div class="period-box-head"><h4>${slots[slot]}</h4><small>${count}</small></div>
 <div class="period-courses">${planned.filter(c=>!spanning.includes(c)).map(c=>placementTile(c,slot,single)).join('')}</div>
 <button class="period-add" data-add-slot="${slot}" aria-label="Lägg till kurs i ${slots[slot]}">＋ Lägg till kurs</button>
 ${(intervals.length || load?.unknown || load?.manual)?`<small class="period-context">${intervals.length?h(intervalsLabel(intervals)):''}${load?.unknown || load?.manual?'<br>'+h(loadLabel(load)):''}</small>`:''}</section>`;
}

function placementTile(course,slot,showDetail = false) {
 const first = course.plannedPeriods[0];
 const continues = first!==slot;
 return `<div class="course-tile ${continues?'is-continuation':''}">
 <button class="placement-card" draggable="true" data-placement-drag="${course.id}" data-edit="${course.id}" aria-label="${h('Ändra '+course.title+(continues?' · fortsättning i '+slots[slot]:''))}">
 ${continues?'<small>Fortsätter från '+h(slots[first])+'</small>':''}<strong>${h(course.title)}</strong>
 ${!continues||showDetail?`<small>${h(course.code || 'Egen kurs')} · ${hp(course.credits)} hp totalt · ${h(plannedLabel(course.plannedPeriods))}${course.status!=='planned'?' · '+h(courseStates[course.status]):''}</small>`:''}</button>
 ${continues?'':`<button class="tile-remove" data-delete="${course.id}" aria-label="Ta bort ${h(course.title)}">×</button>`}</div>`;
}

function noteInput(field,value,caption,limit=1000) {
 return `<label>${h(caption)}<textarea data-plan-note="${h(field)}" maxlength="${limit}" rows="3" aria-describedby="plan-privacy">${h(value)}</textarea></label>`;
}

function planBoard(record,scenario,courses,year,summary,term,slot) {
 const officialSlots = planSlots(record,year);
 const calendar = officialCalendar(year,record.programmeId,record.planningYear===year?record.studyYear:null);
 const termCard = key => {
  const label = key==='HT'?'Hösttermin '+year:'Vårtermin '+(year+1);
  const groups = slot ? [slot] : termSlots(officialSlots,key);
  const dates = calendar?.[key==='HT'?'autumn':'spring'];
  const spanning = groups.length===2?courses.filter(c=>groups.every(p=>c.plannedPeriods.includes(p))):[];
  return `<section class="term-card workspace-card"><div class="term-title"><h3>${label}</h3>
  <small>${groups.length>1?h(plannedLabel(groups)):!slot&&dates?h(intervalsLabel([dates])):''}</small></div>
  ${spanning.length?`<div class="spanning-courses" aria-label="Kurser över båda läsperioderna">${spanning.map(c=>placementTile(c,groups[0],true)).join('')}</div>`:''}
  <div class="period-columns" style="--slots:${groups.length}">${groups.map(p=>periodBox(record,year,p,summary,courses,spanning,Boolean(slot))).join('')}</div>
  <details id="term-notes-${key}" class="term-notes"><summary>Periodanteckningar</summary>
  <div class="period-notes">${groups.map(p=>noteInput(year+':'+p,scenario.periodNotes[year+':'+p] || '',slots[p]+' · anteckning',500)).join('')}</div></details></section>`;
 };
 const other = courses.filter(c=>!term&&!slot?c.plannedPeriods.some(p=>!officialSlots.includes(p)):c.plannedPeriods.every(p=>!officialSlots.includes(p)));
 return `${(slot?[termForSlot(slot)]:term?[term]:['HT','VT']).map(termCard).join('')}
 ${(!term&&!slot)||other.length?`
 <details class="workspace-card other-periods" id="other-periods" ${other.length?'open':''}><summary>Sommar och egen placering${other.length?' · '+other.length+' kurser':''}</summary>
 <div class="period-columns" style="--slots:2">${['SUMMER','OWN'].map(p=>periodBox(record,year,p,summary,courses)).join('')}</div>
 ${other.some(c=>c.plannedPeriods.every(p=>!['SUMMER','OWN',...officialSlots].includes(p)))?
 gridTable(['Kod','Kurs','HP','Läsår','Placering','Status och studietakt','Moment','Åtgärd'],
 other.filter(c=>c.plannedPeriods.every(p=>!['SUMMER','OWN',...officialSlots].includes(p))).map(c=>courseRow(c,scenario,record))):''}
 </details>`:''}
 <details class="workspace-calendar-note" id="workspace-calendar-note"><summary>Läsårsdatum och källor</summary>
 ${calendar?`<p>Hösttermin ${h(intervalsLabel([calendar.autumn]))}<br>Vårtermin ${h(intervalsLabel([calendar.spring]))}</p>`:'<p>Verifierade läsårsdatum saknas i kalenderunderlaget för det här året.</p>'}
 ${calendar?.note?`<p>${h(calendar.note)}</p>`:''}
 ${calendar?.exams?`<p>${[1,2,3,5].map(n=>'<b>Tp'+n+'</b> '+h(intervalsLabel([calendar.exams[n]]))).join('<br>')}</p>`:''}
 ${officialLink(calendarSource,'LTH:s läsårsindelning')} ${year===2026?officialLink(calendarDecision,'Beslut 2026/27'):year===2027?officialLink(calendarDecision2027,'Beslut 2027/28'):''}</details>`;
}

function examPanel(courses,record,year,catalog,active) {
 const calendar = officialCalendar(year,record.programmeId,record.planningYear===year?record.studyYear:null);
 return `<section class="panel plan-section"><div class="panel-head"><h3>Omtentamensperioder</h3><button data-task-new="retakes">＋ Lägg till omtentamen</button></div>
 <p class="note-footer">Tidsfönster för planering. Kontrollera tillfälle, datum och anmälan i TimeEdit eller Ladok.</p>
 <div class="retake-grid">${['TP4','TP6','OWN'].map(p=>{
  const dates = calendar?.exams?.[Number(p.slice(2))];
  const rows = active.retakes.filter(t=>t.period===p).sort((a,b)=>a.date.localeCompare(b.date));
  return `<article><h3>${retakeWindows[p]}</h3><p>${dates?h(intervalsLabel([dates])):p==='OWN'?'Tillfälle enligt egen planering.':'Inget verifierat tidsfönster för detta program och läsår.'}</p>
  ${rows.map(t=>`<div class="task-line"><div><b>${h(taskCourse(t,courses))}</b><small>${h(examStates[t.status])} · ${localDay(t.date)}${t.reminder?' · anmälan '+localDay(t.reminder):''}</small>${t.note?`<small>${h(t.note)}</small>`:''}${officialLink(catalog.courses.find(c=>c.code===(courses.find(c=>c.id===t.courseId)?.code || t.code))?.timeeditUrl,'TimeEdit')}</div><button data-task-edit="retakes:${t.id}">Redigera</button></div>`).join('') || '<p class="note-footer">Inga registrerade tillfällen.</p>'}
  </article>`;
 }).join('')}</div></section>`;
}

function completionsPanel(scenario,courses,record,year,filters,active) {
 const validSlots = planSlots(record,year);
 const periodOptions = [...new Set([...validSlots,'SUMMER','OWN','TP4','TP6',...scenario.completions.filter(t=>t.year===year).map(t=>t.period)])];
 const all = active.completions;
 const rows = all.filter(t=>(filters.status==='all'||(filters.status==='passed')===(t.status==='passed')) &&
  (!filters.period || filters.period===t.period) && (!filters.course || filters.course===taskCourse(t,courses)));
 const courseOptions = [...new Set(all.map(t=>taskCourse(t,courses)))];
 return `<section class="panel plan-section"><div class="panel-head"><h3>Kompletteringar</h3><button data-task-new="completions">＋ Lägg till komplettering</button></div>
 <p>${all.filter(t=>t.status!=='passed').length} kvarvarande moment i vyn</p>
 <div class="completion-filters">
 <label>Status<select data-task-filter="status">${planSelect([['open','Kvar'],['all','Alla'],['passed','Godkända']],filters.status)}</select></label>
 <label>Placering<select data-task-filter="period">${planSelect([['','Alla perioder'],...periodOptions.map(p=>[p,slots[p]||retakeWindows[p]])],filters.period)}</select></label>
 <label>Kurs<select data-task-filter="course">${planSelect([['','Alla kurser'],...courseOptions.map(c=>[c,c])],filters.course)}</select></label></div>
 ${rows.length?gridTable(['Typ','Kurskod','Vad saknas?','Läsår','Placering','Datum','Status','Åtgärd'],rows.map(t=>[
 h(completionTypes[t.type]),h(taskCourse(t,courses))+(t.courseId?'':'<small>Äldre eller extern kurs</small>'),
 h(t.description)+(t.note?`<small>${h(t.note)}</small>`:''),yearText(t.year),h(slots[t.period]||retakeWindows[t.period]),localDay(t.date),h(completionStates[t.status]),
 `<button data-task-edit="completions:${t.id}">Redigera</button>`])):'<p class="period-empty">Inga kompletteringar för valt filter.</p>'}</section>`;
}

function notesPanel(scenario,courses,status) {
 const steps = scenario.steps.filter(t=>status==='all'||(status==='closed')===(t.status==='done'));
 return `<section class="panel plan-section"><p class="note-footer" id="plan-privacy">${casePrivacy}</p>
 <button data-task-new="steps">＋ Lägg till nästa steg</button>
 ${steps.length?gridTable(['Uppgift','Ansvar och status','När','Åtgärd'],steps.map(t=>[
  h(t.task)+(t.courseId||t.code?`<small>${h(taskCourse(t,courses))}</small>`:''),
  roles[t.role]+`<small>${stepStates[t.status]}${t.priority&&t.priority!=='normal'?' · '+priorities[t.priority]+' prioritet':''}</small>`,
  localDay(t.date)+(t.period?`<small>${yearText(t.year)} · ${slots[t.period]}</small>`:''),`<button data-task-edit="steps:${t.id}">Redigera</button>`])):
  '<p class="period-empty">Inga steg i valt filter.</p>'}
 <details class="plan-note" id="agenda-panel"><summary>Ärendets syfte och agenda</summary>${noteInput('agenda',scenario.agenda,'Agenda')}</details>
 <details class="plan-note" id="agreements-panel"><summary>Planeringsöverenskommelser</summary>${noteInput('agreements',scenario.agreements,'Överenskommelser')}</details></section>`;
}

function summaryCard(active,caption,slot) {
 return `<aside class="workspace-card plan-summary" aria-label="Sammanställning för vald tidsram">
 <h3>Sammanställning</h3>
 ${active.courses.length?`<div class="summary-total"><strong>${hp(active.total)} hp</strong><span>${active.unknown?'Känd omfattning':'Planerat'} · ${h(caption)}</span></div>
 <label for="scope-progress">Riktmärke vid heltid: ${slot?'cirka ':''}${active.benchmark} hp</label>
 <progress id="scope-progress" value="${Math.min(active.total,active.benchmark)}" max="${active.benchmark}">${hp(active.total)} hp</progress>
 <dl><div><dt>Avklarat</dt><dd>${hp(active.done)} hp</dd></div><div><dt>Kvar</dt><dd>${hp(active.remaining)} hp</dd></div></dl>
 ${active.unknown?`<p class="muted">${active.unknown} ${active.unknown===1?'kurs saknar':'kurser saknar'} säker poängfördelning i tidsramen.</p>`:''}
 ${active.unassignedDone?'<p class="muted">Avklarade delpoäng utan fördelning visas i läsårsöversikten.</p>':''}`:
 `<p class="muted">Inga kurser inlagda i vald tidsram.</p><p class="muted">Riktmärke vid heltid: ${slot?'cirka ':''}${active.benchmark} hp.</p>`}</aside>`;
}

function yearTable(stats) {
 const termOnly = stats.byYear.every(row=>row.slots.HT);
 const labels = termOnly?['Hösttermin','Vårtermin']:['LP1','LP2','LP3','LP4'];
 return gridTable(['Läsår',...labels,'Unika HP','Studietakt','Omtentamina','Kompletteringar'],stats.byYear.map(r=>[
  yearText(r.year),...(termOnly?[r.slots.HT,r.slots.VT]:[r.slots[1],r.slots[2],r.slots[3],r.slots[4]]).map(v=>v?h(loadLabel(v)):'–'),
  hp(r.total),r.rateCount ? r.rateCount+' av '+r.courseCount+' med kursuppgift' : r.courseCount?'Underlag saknas':'–',
  stats.retakes.filter(t=>t.year===r.year).length,stats.completions.filter(t=>t.year===r.year).length]),'year-table');
}

function comparisonPanel(record,scenario,courses,other) {
 const variants = record.scenarios.filter(s=>s.id!==scenario.id);
 if (!variants.length) return '';
 const stats = summarizePlan(courses.filter(c=>c.scenarioId===scenario.id),scenario,record);
 const comparison = variants.find(s=>s.id===other) || variants[0];
 const compared = summarizePlan(courses.filter(c=>c.scenarioId===comparison.id),comparison,record);
 const duration = plan => {
  if (!plan.courses.length) return '–';
  if (!plan.courses.every(c=>c.weeks)) return 'Veckounderlag saknas';
  return hp(plan.courses.reduce((n,c)=>n+c.weeks,0))+' kursveckor (överlapp kan förekomma)';
 };
 const years = [...new Set([...scenario.years,...comparison.years])].sort((a,b)=>a-b);
 const load = (summary,y,p) => summary.byYear.find(row=>row.year===y)?.slots[p];
 const compareRows = [
  ['Unika HP',hp(stats.total),hp(compared.total)],['Antal kurser',stats.courses.length,compared.courses.length],
  ['Omtentamina att följa upp',stats.remainingRetakes,compared.remainingRetakes],['Kompletteringar kvar',stats.remainingCompletions,compared.remainingCompletions],
  ['Uppskattat tidsunderlag',duration(stats),duration(compared)],
  ...years.flatMap(y=>[...planSlots(record,y),'SUMMER','OWN'].map(p=>[yearText(y)+' · '+slots[p],
   load(stats,y,p)?loadLabel(load(stats,y,p)):'–',load(compared,y,p)?loadLabel(load(compared,y,p)):'–']))
 ];
 return `<details class="panel plan-section" id="comparison-panel" ${other?'open':''}><summary>Jämför två scenarier</summary>
 <label>Jämför med<select id="compare-scenario">${planSelect(variants.map(s=>[s.id,s.name]),comparison.id)}</select></label>
 ${gridTable(['Mått',scenario.name,comparison.name],compareRows.map(row=>row.map(h)))}</details>`;
}

function actionWorkspace(scenario,courses,status) {
 const isClosed = (kind,task) => kind==='retakes' ? ['passed','cancelled'].includes(task.status) : task.status==='passed';
 const visible = (kind,task) => status==='all' || (status==='closed')===isClosed(kind,task);
 const rows = [
  ...scenario.retakes.map(task=>['retakes',task]),
  ...scenario.completions.map(task=>['completions',task])
 ].filter(([kind,task])=>visible(kind,task)).sort((a,b)=>
  (a[1].date||'9999').localeCompare(b[1].date||'9999') || a[1].year-b[1].year);
 const goal = scenario.goal || {text:'',date:'',horizon:''};
 return `<div class="action-workspace">
 <section class="workspace-card action-card"><h2>Mål</h2><p class="muted" id="goal-privacy">${casePrivacy}</p>
 <label>Vad ska uppnås?<textarea data-goal="text" rows="2" maxlength="500" aria-describedby="goal-privacy" placeholder="Exempel: Slutföra två laborationer före LP3">${h(goal.text)}</textarea></label>
 <div class="form-grid"><label>Måldatum (valfritt)<input data-goal="date" type="date" value="${h(goal.date)}"></label>
 <label>Planeringshorisont (valfritt)<input data-goal="horizon" maxlength="120" value="${h(goal.horizon)}" placeholder="Exempel: De kommande två veckorna"></label></div></section>
 <section class="workspace-card action-card"><h2>Vad återstår?</h2><div class="action-tools">
 <div class="actions" role="group" aria-label="Filtrera moment">${[['open','Kvar'],['all','Alla'],['closed','Klara']].map(([key,label])=>`<button data-remaining="${key}" aria-pressed="${status===key}">${label}</button>`).join('')}</div>
 <div class="actions"><button data-task-new="completions">＋ Komplettering</button><button data-task-new="retakes">＋ Omtentamen</button></div></div>
 ${rows.length?gridTable(['Moment','När','Status och ansvar','Åtgärd'],rows.map(([kind,task])=>[
  `<b>${h(kind==='retakes'?'Omtentamen':completionTypes[task.type])}</b><small>${h(taskCourse(task,courses))}</small>${kind==='retakes'?'':`<span>${h(task.description)}</span>`}`,
  `${yearText(task.year)} · ${h(retakeWindows[task.period]||slots[task.period])}<small>${h(localDay(task.date))}</small>`,
  `${h(statusesFor(kind)[task.status])}${task.role?`<small>${h(roles[task.role])}</small>`:''}${task.priority&&task.priority!=='normal'?`<small>${h(priorities[task.priority])} prioritet</small>`:''}`,
  `<button data-task-edit="${kind}:${task.id}">Redigera</button>`])):'<p class="period-empty">Inga moment i valt filter.</p>'}
 </section>
 <section class="workspace-card action-card"><h2>Nästa steg och uppföljning</h2>${notesPanel(scenario,courses,status)}</section></div>`;
}

export function planningWorkspace(record,scenario,courses,view,filters,catalog,coursePicker,current) {
 const {year,term,slot} = viewScope(view);
 const allowed = planSlots(record,year);
 const actions = view.focus==='actions';
 const active = actions ? null : summarizePlan(courses,scenario,record,year,term,slot);
 const caption = scopeTitle(year,term,slot);
 const program = caseProgram(record,catalog);
 const groupOptions = view.horizon==='term'?['HT','VT']:allowed;
 const periodOptions = groupOptions.map(p=>[p,p==='HT'||p==='VT'?scopeTitle(year,p):slots[p]]);
 const currentMessage = {exam:'Tentamensperiod',retake:'Omtentamensperiod',break:'Undervisningsuppehåll',unknown:'Verifierade datum saknas för dagens period'};
 const showCurrent = current.status!=='teaching' && current.year===year;
 return `<div class="workspace-overview"><section class="workspace-intro"><h1>${actions?'Mål och handlingsplan':'Studieplanering'}</h1>
 <p>${h(program?program.name+' ('+program.code+')':'Eget kursval')}${record.studyYear?' · Årskurs '+record.studyYear:''} · <button class="text-action" data-action="edit-case">Ändra grundinformation</button></p></section>
 <div class="workspace-context-actions">
 <label>Plan <select id="active-scenario">${planSelect(record.scenarios.map(s=>[s.id,s.name]),scenario.id)}</select></label>
 <details class="workspace-menu" id="plan-menu"><summary>Visa detaljer</summary><div class="workspace-menu-content">
 <button data-action="plan-details">Kurslista och belastning</button><button data-action="calendar">Kalenderdatum</button>
 <button data-action="new-scenario">Nytt alternativ</button><button data-action="rename-scenario">Byt namn på planen</button>
 <button data-action="add-year">Lägg till annat läsår</button>
 ${record.scenarios.length>1?'<button data-action="compare">Jämför scenarier</button><button class="danger-text" data-action="delete-scenario">Ta bort scenario</button>':''}</div></details>
 <button class="primary" data-action="export">Granska och exportera</button></div></div>
 ${actions?actionWorkspace(scenario,courses,filters.remaining):`<section class="workspace-card horizon-bar" aria-label="Planeringens tidsram">
 <div class="scope-switch" role="group" aria-label="Välj tidsram">${Object.entries(horizons).filter(([key])=>key!=='period'||allowed.length>2).map(([key,label])=>
  `<button data-horizon="${key}" aria-pressed="${view.horizon===key}">${label}</button>`).join('')}</div>
 <div class="horizon-options"><label>Läsår <select id="plan-year">${scenario.years.map(y=>yearOption(y,year)).join('')}</select></label>
 ${view.horizon==='year'?'':`<label>${horizons[view.horizon]} <select id="plan-slot">${planSelect(periodOptions,term||view.slot)}</select></label>`}</div>
 <button data-action="next-year" ${year>=2100?'disabled':''}>Fortsätt till nästa läsår →</button>
 ${showCurrent?`<p class="period-state">${currentMessage[current.status]}${current.exam?' · Tp'+current.exam:''}.${current.slot?' Föreslagen undervisningsperiod: '+h(slots[current.slot])+'.':''} ${officialLink(calendarSource,'Läsårsindelning')}</p>`:''}
 </section>
 <div class="workspace-columns"><aside class="workspace-card workspace-catalog" aria-labelledby="course-heading">${coursePicker}</aside>
 <section class="workspace-plan" aria-labelledby="plan-heading"><div class="workspace-plan-head workspace-card">
 <div><h2 id="plan-heading">${h(caption)}</h2><p class="muted">Klicka på en kurs för att ändra. Du kan också dra den till en annan period.</p></div>
 <button class="mobile-course-open" data-action="pick-course">＋ Lägg till kurs</button></div>
 <div class="plan-with-summary"><div class="term-stack">${planBoard(record,scenario,sortPlannedCourses(active.courses,catalog),year,active.byYear[0],term,slot)}</div>${summaryCard(active,caption,slot)}</div>
 <div class="workspace-extras">
 <details class="workspace-card workspace-disclosure" id="retakes-panel" ${slot&&active.retakes.length?'open':''}><summary>Omtentamina <span>${active.retakes.length}</span></summary>
 ${examPanel(courses,record,year,catalog,active)}</details>
 <details class="workspace-card workspace-disclosure" id="completions-panel" ${slot&&active.completions.length?'open':''}><summary>Kompletteringar <span>${active.completions.length}</span></summary>
 ${completionsPanel(scenario,courses,record,year,filters,active)}</details></div>
 ${active.warnings.length?`<details class="workspace-warnings" id="workspace-warnings"><summary>Att granska (${active.warnings.length})</summary>
 <ul>${active.warnings.map(w=>`<li><b>${h(w.kind)}</b> · ${h(w.text)}</li>`).join('')}</ul></details>`:''}</section></div>`}`;
}

export function planDetailsDialog(record,scenario,allCourses,catalog) {
 const courses = sortPlannedCourses(allCourses.filter(c=>c.scenarioId===scenario.id),catalog);
 const stats = summarizePlan(courses,scenario,record);
 return planDialog('Kurslista och belastning',`<div class="details-body">${courses.length?gridTable(
 ['Kod','Kurs','HP','Läsår','Placering','Status och studietakt','Moment','Åtgärd'],courses.map(c=>courseRow(c,scenario,record))):'<p>Inga kurser i planen.</p>'}
 <h3>Sammanställning över alla läsår</h3>${yearTable(stats)}</div><div class="dialog-actions"><button data-close>Stäng</button></div>`);
}

export function comparisonDialog(record,scenario,allCourses,other) {
 return planDialog('Jämför scenarier',`<div class="details-body">${comparisonPanel(record,scenario,allCourses,other || record.scenarios.find(s=>s.id!==scenario.id)?.id)}</div><div class="dialog-actions"><button data-close>Stäng</button></div>`);
}

export function taskForm(kind,task,year,scenario,courses,record,preferred,catalog) {
 const isStep = kind==='steps';
 const isRetake = kind==='retakes';
 const title = (task?'Redigera ':'Lägg till ')+(isStep?'nästa steg':isRetake?'omtentamen':'komplettering');
 const periods = [...new Set([...planSlots(record,task?.year||year),'SUMMER',...(!isStep?['TP4','TP6']:[]),'OWN',...(task?.period?[task.period]:[])])];
 const picker = isRetake?Object.entries(retakeWindows):[...(isStep?[['','Ej angiven']]:[]),...periods.map(p=>[p,slots[p]||retakeWindows[p]])];
 const model = task || {year,date:'',code:'',note:'',status:isRetake?'planned':'todo',period:preferred || (isRetake?'TP4':'OWN')};
 return planDialog(title,`<form id="task-form" data-kind="${kind}" data-id="${task?.id || ''}">
 <p class="form-intro">${casePrivacy}</p>
 ${isStep?`<label>Uppgift<input name="task" value="${h(model.task)}" maxlength="240" required autofocus></label>`:''}
 <label>Koppla till kurs i scenariot<select name="courseId">${planSelect([['','Ingen kurskoppling'],...sortPlannedCourses(courses,catalog).map(c=>[c.id,[c.code,c.title].filter(Boolean).join(' · ')])],model.courseId||'')}</select></label>
 <label>Äldre eller extern kurskod (valfritt)<input name="code" value="${h(model.code)}" maxlength="40"></label>
 ${isRetake||isStep?'':`<label>Typ<select name="type">${planSelect(Object.entries(completionTypes),model.type||'assignment')}</select></label>
 <label>Vad saknas?<input name="description" value="${h(model.description)}" maxlength="240" required></label>`}
 <div class="form-grid"><label>Läsår<select name="year">${scenario.years.map(y=>yearOption(y,model.year||year)).join('')}</select></label>
 <label>Placering<select name="period">${planSelect(picker,model.period||'')}</select></label></div>
 <div class="form-grid"><label>Ansvar<select name="role">${planSelect([...(isStep?[]:[['','Ej angivet']]),...Object.entries(roles)],model.role||(isStep?'student':''))}</select></label>
 <label>Prioritet<select name="priority">${planSelect(Object.entries(priorities),model.priority||'normal')}</select></label></div>
 <div class="form-grid"><label>Planerat datum (valfritt)<input name="date" type="date" value="${h(model.date)}"></label>
 <label>Status<select name="status">${planSelect(Object.entries(statusesFor(kind)),model.status)}</select></label></div>
 ${isRetake?`<label>Följ upp anmälan (datum i planen)<input name="reminder" type="date" value="${h(model.reminder)}"></label>`:''}
 ${isStep?'':`<label>Kort avidentifierad anmärkning<textarea name="note" maxlength="500">${h(model.note)}</textarea></label>`}
 ${task?`<button class="danger-text" type="button" data-task-remove="${kind}:${task.id}">Ta bort</button>`:''}${formEnd('Spara')}</form>`);
}
