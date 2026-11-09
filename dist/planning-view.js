import { htmlEscape, officialLink } from './catalog-view.js';
import { calendarSource, calendarDecision, officialCalendar } from './lth-calendar.js';
import { casePrivacy, caseProgram } from './case-view.js';
import { hp, yearText, slots, examStates, completionStates, completionTypes, retakeWindows, stepStates, roles, courseStates, planSlots, termSlots, datesForSlots, plannedLabel, placementLabel, rateDescription, taskCourse, summarizePlan } from './planning.js';

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

function periodBox(record,year,slot,summary,courses) {
 const intervals = datesForSlots(record,year,[slot]);
 const planned = courses.filter(c=>c.plannedPeriods.includes(slot));
 const count = planned.length + (planned.length===1?' kurs':' kurser');
 const load = summary.slots[slot];
 return `<section class="period-box slot-heading" data-slot-drop="${slot}" aria-label="${slots[slot]}">
 <div class="period-box-head"><h4>${slots[slot]}</h4><small>${count}</small></div>
 <div class="period-courses">${planned.map(c=>placementTile(c,slot)).join('')}</div>
 <button class="period-add" data-add-slot="${slot}" aria-label="Lägg till kurs i ${slots[slot]}">＋ Lägg till kurs</button>
 ${(intervals.length || load?.unknown || load?.manual)?`<small class="period-context">${intervals.length?h(intervalsLabel(intervals)):''}${load?.unknown || load?.manual?'<br>'+h(loadLabel(load)):''}</small>`:''}</section>`;
}

function placementTile(course,slot) {
 const first = course.plannedPeriods[0];
 const continues = first!==slot;
 return `<div class="course-tile ${continues?'is-continuation':''}">
 <button class="placement-card" draggable="true" data-placement-drag="${course.id}" data-edit="${course.id}" aria-label="${h('Ändra '+course.title+(continues?' · fortsättning i '+slots[slot]:''))}">
 ${continues?'<small>Fortsätter från '+h(slots[first])+'</small>':''}<strong>${h(course.title)}</strong>
 ${continues?'':`<small>${h(course.code || 'Egen kurs')} · ${hp(course.credits)} hp · ${h(plannedLabel(course.plannedPeriods))}${course.status!=='planned'?' · '+h(courseStates[course.status]):''}</small>`}</button>
 ${continues?'':`<button class="tile-remove" data-delete="${course.id}" aria-label="Ta bort ${h(course.title)}">×</button>`}</div>`;
}

function noteInput(field,value,caption,limit=1000) {
 return `<label>${h(caption)}<textarea data-plan-note="${h(field)}" maxlength="${limit}" rows="3" aria-describedby="plan-privacy">${h(value)}</textarea></label>`;
}

function planBoard(record,scenario,courses,year,summary) {
 const officialSlots = planSlots(record,year);
 const calendar = officialCalendar(year,record.programmeId,record.planningYear===year?record.studyYear:null);
 const termCard = key => {
  const label = key==='HT'?'Hösttermin '+year:'Vårtermin '+(year+1);
  const groups = termSlots(officialSlots,key);
  const dates = calendar?.[key==='HT'?'autumn':'spring'];
  return `<section class="term-card workspace-card"><div class="term-title"><h3>${label}</h3>
  <small>${groups.length>1?h(plannedLabel(groups)):dates?h(intervalsLabel([dates])):''}</small></div>
  <div class="period-columns" style="--slots:${groups.length}">${groups.map(p=>periodBox(record,year,p,summary,courses)).join('')}</div>
  <div class="term-total"><span>Planerad omfattning</span><strong>${h(loadLabel(summary[key]))}</strong></div>
  <details id="term-notes-${key}" class="term-notes"><summary>Periodanteckningar</summary>
  <div class="period-notes">${groups.map(p=>noteInput(year+':'+p,scenario.periodNotes[year+':'+p] || '',slots[p]+' · anteckning',500)).join('')}</div></details></section>`;
 };
 const other = courses.filter(c=>c.plannedPeriods.some(p=>!officialSlots.includes(p)));
 return `${termCard('HT')}${termCard('VT')}
 <details class="workspace-card other-periods" id="other-periods" ${other.length?'open':''}><summary>Sommar och egen placering${other.length?' · '+other.length+' kurser':''}</summary>
 <div class="period-columns" style="--slots:2">${['SUMMER','OWN'].map(p=>periodBox(record,year,p,summary,courses)).join('')}</div>
 ${other.some(c=>c.plannedPeriods.every(p=>!['SUMMER','OWN',...officialSlots].includes(p)))?
 gridTable(['Kod','Kurs','HP','Läsår','Placering','Status och studietakt','Moment','Åtgärd'],
 other.filter(c=>c.plannedPeriods.every(p=>!['SUMMER','OWN',...officialSlots].includes(p))).map(c=>courseRow(c,scenario,record))):''}
 </details>
 <details class="workspace-calendar-note" id="workspace-calendar-note"><summary>Läsårsdatum och källor</summary>
 ${calendar?`<p>Hösttermin ${h(intervalsLabel([calendar.autumn]))}<br>Vårtermin ${h(intervalsLabel([calendar.spring]))}</p>`:'<p>Verifierade läsårsdatum saknas i kalenderunderlaget för det här året.</p>'}
 ${calendar?.note?`<p>${h(calendar.note)}</p>`:''}
 ${calendar?.exams?`<p>${[1,2,3,5].map(n=>'<b>Tp'+n+'</b> '+h(intervalsLabel([calendar.exams[n]]))).join('<br>')}</p>`:''}
 ${officialLink(calendarSource,'LTH:s läsårsindelning')}</details>`;
}

function examPanel(scenario,courses,record,year,catalog) {
 const calendar = officialCalendar(year,record.programmeId,record.planningYear===year?record.studyYear:null);
 return `<section class="panel plan-section"><div class="panel-head"><h3>Omtentamensperioder</h3><button data-task-new="retakes">＋ Lägg till omtentamen</button></div>
 <p class="note-footer">Tidsfönster för planering. Kontrollera tillfälle, datum och anmälan i TimeEdit eller Ladok.</p>
 <div class="retake-grid">${['TP4','TP6','OWN'].map(p=>{
  const dates = calendar?.exams?.[Number(p.slice(2))];
  const rows = summarizePlan(courses,scenario,record,year).retakes.filter(t=>t.period===p).sort((a,b)=>a.date.localeCompare(b.date));
  return `<article><h3>${retakeWindows[p]}</h3><p>${dates?h(intervalsLabel([dates])):p==='OWN'?'Tillfälle enligt egen planering.':'Inget verifierat tidsfönster för detta program och läsår.'}</p>
  ${rows.map(t=>`<div class="task-line"><div><b>${h(taskCourse(t,courses))}</b><small>${h(examStates[t.status])} · ${localDay(t.date)}${t.reminder?' · anmälan '+localDay(t.reminder):''}</small>${t.note?`<small>${h(t.note)}</small>`:''}${officialLink(catalog.courses.find(c=>c.code===(courses.find(c=>c.id===t.courseId)?.code || t.code))?.timeeditUrl,'TimeEdit')}</div><button data-task-edit="retakes:${t.id}">Redigera</button></div>`).join('') || '<p class="note-footer">Inga registrerade tillfällen.</p>'}
  </article>`;
 }).join('')}</div></section>`;
}

function completionsPanel(scenario,courses,record,year,filters) {
 const validSlots = planSlots(record,year);
 const periodOptions = [...new Set([...validSlots,'SUMMER','OWN','TP4','TP6',...scenario.completions.filter(t=>t.year===year).map(t=>t.period)])];
 const all = summarizePlan(courses,scenario,record,year).completions;
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

function notesPanel(scenario) {
 return `<section class="panel plan-section"><p class="note-footer" id="plan-privacy">${casePrivacy}</p>
 <details class="plan-note" id="agenda-panel"><summary>Ärendets syfte och agenda</summary>${noteInput('agenda',scenario.agenda,'Agenda')}</details>
 <details class="plan-note" id="agreements-panel"><summary>Planeringsöverenskommelser</summary>${noteInput('agreements',scenario.agreements,'Överenskommelser')}</details>
 <details class="plan-note" id="next-steps-panel"><summary>Nästa steg och uppföljning (${scenario.steps.length})</summary>
 <button data-task-new="steps">＋ Lägg till nästa steg</button>
 ${scenario.steps.length?gridTable(['Uppgift','Ansvar','Datum','Status','Åtgärd'],scenario.steps.map(t=>[h(t.task),roles[t.role],localDay(t.date),stepStates[t.status],`<button data-task-edit="steps:${t.id}">Redigera</button>`])):'<p class="period-empty">Inga uppföljningar tillagda.</p>'}</details></section>`;
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

export function planningWorkspace(record,scenario,allCourses,year,comparison,filters,catalog,coursePicker) {
 const courses = allCourses.filter(c=>c.scenarioId===scenario.id);
 const active = summarizePlan(courses,scenario,record,year);
 const program = caseProgram(record,catalog);
 const context = [program ? program.name+' ('+program.code+')':'Eget kursval',record.studyYear?'Årskurs '+record.studyYear:'',yearText(year)].filter(Boolean).join(' · ');
 return `<section class="workspace-intro"><p class="eyebrow">AKTIVT PLANERINGSÄRENDE</p><h1>Studieplanering</h1>
 <p>Välj kurser och se när de ska läsas i planen.</p></section>
 <section class="workspace-context workspace-card" aria-label="Aktivt ärende">
 <div><small>Program och aktuellt läsår</small><strong>${h(context)}</strong></div>
 <div class="workspace-context-actions"><button data-action="edit-case">Ändra</button>
 <label>Plan <select id="active-scenario">${planSelect(record.scenarios.map(s=>[s.id,s.name]),scenario.id)}</select></label>
 <button data-action="new-scenario">＋ Nytt alternativ</button>
 <details class="workspace-menu" id="plan-menu"><summary>Mer för planen</summary><div class="workspace-menu-content">
 <button data-action="add-year">Lägg till läsår</button><button data-action="rename-scenario">Byt namn på planen</button>
 <button data-action="calendar">Kalenderdatum</button><button data-action="plan-details">Kurslista och belastning</button>
 ${record.scenarios.length>1?'<button data-action="compare">Jämför scenarier</button><button class="danger-text" data-action="delete-scenario">Ta bort scenario</button>':''}</div></details></div></section>
 <div class="workspace-columns"><aside class="workspace-card workspace-catalog" aria-labelledby="course-heading">${coursePicker}</aside>
 <section class="workspace-plan" aria-labelledby="plan-heading"><div class="workspace-plan-head">
 <div><h2 id="plan-heading">2. Min planering</h2><label>Läsår <select id="plan-year">${scenario.years.map(y=>yearOption(y,year)).join('')}</select></label></div>
 <span class="plan-total-badge">${hp(active.total)} hp planerat</span>
 <button class="mobile-course-open" data-action="pick-course">＋ Lägg till kurs</button></div>
 ${planBoard(record,scenario,active.courses,year,active.byYear[0])}</section></div>
 <div class="workspace-extras">
 <details class="workspace-card workspace-disclosure" id="retakes-panel"><summary>Omtentamina <span>${active.retakes.length}</span></summary>
 ${examPanel(scenario,courses,record,year,catalog)}</details>
 <details class="workspace-card workspace-disclosure" id="completions-panel"><summary>Kompletteringar <span>${active.completions.length}</span></summary>
 ${completionsPanel(scenario,courses,record,year,filters)}</details>
 <details class="workspace-card workspace-disclosure" id="notes-panel"><summary>Anteckningar och uppföljning</summary>${notesPanel(scenario)}</details></div>
 <section class="workspace-totals" aria-label="Sammanställning"><div><p><strong>${hp(active.total)} hp</strong> <span>Totalt planerat</span></p>
 <p>Avklarat <b>${hp(active.done)} hp</b> <span class="total-separator">·</span> Kvar <b>${hp(active.remaining)} hp</b></p></div>
 <button class="primary" data-action="export">Granska och exportera</button></section>
 ${active.warnings.length?`<details class="workspace-warnings" id="workspace-warnings"><summary>Att granska (${active.warnings.length})</summary>
 <ul>${active.warnings.map(w=>`<li><b>${h(w.kind)}</b> · ${h(w.text)}</li>`).join('')}</ul></details>`:''}
 <p class="workspace-footnote">En kurs över flera perioder räknas en gång. Avklarade poäng är manuellt angivna.</p>`;
}

export function planDetailsDialog(record,scenario,allCourses) {
 const courses = allCourses.filter(c=>c.scenarioId===scenario.id);
 const stats = summarizePlan(courses,scenario,record);
 return planDialog('Kurslista och belastning',`<div class="details-body">${courses.length?gridTable(
 ['Kod','Kurs','HP','Läsår','Placering','Status och studietakt','Moment','Åtgärd'],courses.map(c=>courseRow(c,scenario,record))):'<p>Inga kurser i planen.</p>'}
 <h3>Sammanställning över alla läsår</h3>${yearTable(stats)}</div><div class="dialog-actions"><button data-close>Stäng</button></div>`);
}

export function comparisonDialog(record,scenario,allCourses,other) {
 return planDialog('Jämför scenarier',`<div class="details-body">${comparisonPanel(record,scenario,allCourses,other || record.scenarios.find(s=>s.id!==scenario.id)?.id)}</div><div class="dialog-actions"><button data-close>Stäng</button></div>`);
}

export function taskForm(kind,task,year,scenario,courses,record,preferred) {
 const isStep = kind==='steps';
 const isRetake = kind==='retakes';
 const title = (task?'Redigera ':'Lägg till ')+(isStep?'nästa steg':isRetake?'omtentamen':'komplettering');
 const periods = [...new Set([...planSlots(record,task?.year||year),'SUMMER','TP4','TP6','OWN',...(task?[task.period]:[])])];
 const picker = isRetake?Object.entries(retakeWindows):periods.map(p=>[p,slots[p]||retakeWindows[p]]);
 const model = task || {year,date:'',code:'',note:'',status:isRetake?'planned':'todo',period:preferred || (isRetake?'TP4':'OWN')};
 return planDialog(title,`<form id="task-form" data-kind="${kind}" data-id="${task?.id || ''}">
 <p class="form-intro">${casePrivacy}</p>
 ${isStep?`<label>Uppgift<input name="task" value="${h(model.task)}" maxlength="240" required autofocus></label>
 <label>Ansvar<select name="role">${planSelect(Object.entries(roles),model.role||'student')}</select></label>`:
 `<label>Koppla till kurs i scenariot<select name="courseId">${planSelect([['','Ingen kurskoppling'],...courses.map(c=>[c.id,[c.code,c.title].filter(Boolean).join(' · ')])],model.courseId||'')}</select></label>
 <label>Äldre eller extern kurskod (valfritt)<input name="code" value="${h(model.code)}" maxlength="40"></label>
 ${isRetake?'':`<label>Typ<select name="type">${planSelect(Object.entries(completionTypes),model.type||'assignment')}</select></label>
 <label>Vad saknas?<input name="description" value="${h(model.description)}" maxlength="240" required></label>`}
 <div class="form-grid"><label>Läsår<select name="year">${scenario.years.map(y=>yearOption(y,model.year)).join('')}</select></label>
 <label>Placering<select name="period">${planSelect(picker,model.period)}</select></label></div>`}
 <div class="form-grid"><label>Planerat datum (valfritt)<input name="date" type="date" value="${h(model.date)}"></label>
 <label>Status<select name="status">${planSelect(Object.entries(statusesFor(kind)),model.status)}</select></label></div>
 ${isRetake?`<label>Följ upp anmälan (datum i planen)<input name="reminder" type="date" value="${h(model.reminder)}"></label>`:''}
 ${isStep?'':`<label>Kort avidentifierad anmärkning<textarea name="note" maxlength="500">${h(model.note)}</textarea></label>`}
 ${task?`<button class="danger-text" type="button" data-task-remove="${kind}:${task.id}">Ta bort</button>`:''}${formEnd('Spara')}</form>`);
}
