import { htmlEscape, officialLink } from './catalog-view.js';
import { calendarSource, calendarDecision, officialCalendar } from './lth-calendar.js';
import { caseDescription, casePrivacy, caseTitle } from './case-view.js';
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

function planSummary(stats,year,term,compact) {
 return `<details id="plan-summary" class="panel plan-summary" ${compact?'':'open'}><summary>Sammanställning</summary>
 <p class="eyebrow">LÄSÅR ${yearText(year)}</p><div class="summary-figure"><strong>${hp(stats.total)}</strong> ${term?'hp fördelade i terminen':'hp i planen'}</div>
 ${stats.unknown?'<p>'+stats.unknown+' kurser över flera perioder saknar verifierad terminsfördelning.</p>':''}
 ${stats.unassignedDone?'<p>Avklarade delpoäng utan terminsfördelning visas i läsårsöversikten.</p>':''}
 <dl class="summary-counts"><div><dt>Kurser</dt><dd>${stats.courses.length}</dd></div><div><dt>Avklarat</dt><dd>${hp(stats.done)} hp</dd></div><div><dt>Återstår</dt><dd>${hp(stats.remaining)} hp</dd></div>
 <div><dt>Omtentamina att följa upp</dt><dd>${stats.remainingRetakes}</dd></div><div><dt>Kompletteringar kvar</dt><dd>${stats.remainingCompletions}</dd></div></dl>
 <p class="note-footer">Avklarat enligt planeringen. Kontrollera uppgifterna i Ladok. Moment ger inga extra högskolepoäng.</p>
 ${stats.warnings.length ? `<details class="summary-warnings"><summary>Att granska (${stats.warnings.length})</summary><ul>${stats.warnings.map(w=>`<li><b>${h(w.kind)}</b><br>${h(w.text)}</li>`).join('')}</ul></details>` : ''}
 <button class="primary" data-action="export">Granska och exportera</button></details>`;
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

function slotHead(record,year,slot,summary) {
 const interval = datesForSlots(record,year,[slot]);
 const value = summary.slots[slot];
 const reference = /^\d$/.test(slot)?15:30;
 return `<div class="slot-heading" data-slot-drop="${slot}"><b>${slots[slot]}</b>${interval.length?`<small>${h(intervalsLabel(interval))}</small>`:''}
 ${value?`<span>${h(loadLabel(value))}</span><progress max="${reference}" value="${Math.min(value.hp,reference)}" aria-label="${h(slots[slot])}: ${h(loadLabel(value))}. Riktmärke ${reference} hp"></progress>`:''}
 <button data-add-slot="${slot}">＋ Lägg till</button></div>`;
}

function periodBoard(courses,record,year,activeSlots) {
 return `<div class="period-board" style="--slots:${activeSlots.length}">${courses.map(course=>{
  const indices = course.plannedPeriods.map(p=>activeSlots.indexOf(p)).filter(i=>i>=0);
  if (!indices.length) return '';
  const consecutive = indices.every((n,i)=>i===0 || n===indices[i-1]+1);
  const col = consecutive ? (indices[0]+1)+' / '+(indices.at(-1)+2) : '1 / -1';
  return `<div class="placement-row"><button class="placement-card" draggable="true" data-placement-drag="${course.id}" data-edit="${course.id}" style="grid-column:${col}">
   <span><b>${h(course.code || 'Egen kurs')}</b> · ${hp(course.credits)} hp · ${h(courseStates[course.status])}</span><strong>${h(course.title)}</strong>
   <small>${h(plannedLabel(course.plannedPeriods))} · ${h(placementLabel(course,record))}</small></button></div>`;
 }).join('') || '<p class="period-empty">Inga kurser placerade här.</p>'}</div>`;
}

function noteInput(field,value,caption,limit=1000) {
 return `<label>${h(caption)}<textarea data-plan-note="${h(field)}" maxlength="${limit}" rows="3" aria-describedby="plan-privacy">${h(value)}</textarea></label>`;
}

function planBoard(record,scenario,courses,year,view,term,summary,scopedCourses) {
 const officialSlots = planSlots(record,year);
 const termMode = view==='term';
 const activeSlots = termMode ? termSlots(officialSlots,term) : officialSlots;
 const calendar = officialCalendar(year,record.programmeId,record.planningYear===year?record.studyYear:null);
 const termCard = key => {
  const label = key==='HT'?'Hösttermin '+year:'Vårtermin '+(year+1);
  const groups = termSlots(officialSlots,key);
  const dates = calendar?.[key==='HT'?'autumn':'spring'];
  return `<div class="term-frame"><div class="term-label"><div><b>${label}</b>
  <small>${dates?h(intervalsLabel([dates])):'Terminsdatum saknas i kalenderunderlaget.'}</small>
  <small>${h(loadLabel(summary[key]))}</small></div>${termMode?'':`<button data-term-view="${key}">Öppna termin</button>`}</div>
  <div class="period-headings" style="--slots:${groups.length}">${groups.map(p=>slotHead(record,year,p,summary)).join('')}</div></div>`;
 };
 const own = (termMode?scopedCourses:courses).filter(c=>c.plannedPeriods.every(p=>!activeSlots.includes(p)));
 return `<section class="panel period-section" aria-label="Läsårsplanering">
 <div class="term-frames ${termMode?'term-single':''}">${(termMode?[term]:['HT','VT']).map(termCard).join('')}</div>
 ${periodBoard(courses,record,year,activeSlots)}
 ${termMode ? `<div class="period-notes">${activeSlots.map(p=>noteInput(year+':'+p,scenario.periodNotes[year+':'+p] || '',slots[p]+' · anteckning',500)).join('')}</div>` :
 `<div class="other-placements">${['SUMMER','OWN'].map(p=>slotHead(record,year,p,summary)).join('')}</div>`}
 ${own.length?gridTable(['Kod','Kurs','HP','Läsår','Placering','Status och studietakt','Moment','Åtgärd'],own.map(c=>courseRow(c,scenario,record))):''}
 <p class="note-footer">Placering visar planens perioder. Kontrollera kurstillfälle och schema. Staplar jämför kända poäng med 15 hp per LP eller 30 hp per termin.</p>
 ${calendar?.note?`<p class="note-footer">${h(calendar.note)}</p>`:''}
 ${calendar?.exams?`<details class="official-exams"><summary>Ordinarie tentamensperioder</summary>
  <p>${(termMode?(term==='HT'?[1,2]:[3,5]):[1,2,3,5]).map(n=>'<b>Tp'+n+'</b> '+h(intervalsLabel([calendar.exams[n]]))).join('<br>')}</p></details>`:''}
 ${officialLink(calendarSource,'LTH:s läsårsindelning')}</section>`;
}

function examPanel(scenario,courses,record,year,term,catalog) {
 const calendar = officialCalendar(year,record.programmeId,record.planningYear===year?record.studyYear:null);
 return `<section class="panel plan-section"><div class="panel-head"><div><p class="eyebrow">EXAMINATION</p><h2>Omtentamensperioder</h2></div><button data-task-new="retakes">＋ Lägg till omtentamen</button></div>
 <p class="note-footer">Tidsfönster för planering. Kontrollera tillfälle, datum och anmälan i TimeEdit eller Ladok.</p>
 <div class="retake-grid">${(term==='HT'?['OWN']:term==='VT'?['TP4','OWN']:['TP4','TP6','OWN']).map(p=>{
  const dates = calendar?.exams?.[Number(p.slice(2))];
  const rows = summarizePlan(courses,scenario,record,year,term).retakes.filter(t=>t.period===p).sort((a,b)=>a.date.localeCompare(b.date));
  return `<article><h3>${retakeWindows[p]}</h3><p>${dates?h(intervalsLabel([dates])):p==='OWN'?'Tillfälle enligt egen planering.':'Inget verifierat tidsfönster för detta program och läsår.'}</p>
  ${rows.map(t=>`<div class="task-line"><div><b>${h(taskCourse(t,courses))}</b><small>${h(examStates[t.status])} · ${localDay(t.date)}${t.reminder?' · anmälan '+localDay(t.reminder):''}</small>${t.note?`<small>${h(t.note)}</small>`:''}${officialLink(catalog.courses.find(c=>c.code===(courses.find(c=>c.id===t.courseId)?.code || t.code))?.timeeditUrl,'TimeEdit')}</div><button data-task-edit="retakes:${t.id}">Redigera</button></div>`).join('') || '<p class="note-footer">Inga registrerade tillfällen.</p>'}
  <button data-task-new="retakes" data-task-slot="${p}">＋ Lägg till</button></article>`;
 }).join('')}</div></section>`;
}

function completionsPanel(scenario,courses,record,year,filters,term) {
 const validSlots = planSlots(record,year);
 const periodOptions = [...new Set([...validSlots,'SUMMER','OWN','TP4','TP6',...scenario.completions.filter(t=>t.year===year).map(t=>t.period)])];
 const all = summarizePlan(courses,scenario,record,year,term).completions;
 const rows = all.filter(t=>(filters.status==='all'||(filters.status==='passed')===(t.status==='passed')) &&
  (!filters.period || filters.period===t.period) && (!filters.course || filters.course===taskCourse(t,courses)));
 const courseOptions = [...new Set(all.map(t=>taskCourse(t,courses)))];
 return `<section class="panel plan-section"><div class="panel-head"><div><p class="eyebrow">KVARSTÅENDE MOMENT</p><h2>Kompletteringar</h2></div><button data-task-new="completions">＋ Lägg till komplettering</button></div>
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
 return `<section class="panel plan-section"><h2>Samtal och uppföljning</h2><p class="note-footer" id="plan-privacy">${casePrivacy}</p>
 <details class="plan-note"><summary>Ärendets syfte och agenda</summary>${noteInput('agenda',scenario.agenda,'Agenda')}</details>
 <details class="plan-note"><summary>Planeringsöverenskommelser</summary>${noteInput('agreements',scenario.agreements,'Överenskommelser')}</details>
 <details class="plan-note"><summary>Nästa steg och uppföljning (${scenario.steps.length})</summary>
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
 return `<details class="panel plan-section" ${other?'open':''}><summary>Jämför två scenarier</summary>
 <label>Jämför med<select id="compare-scenario">${planSelect(variants.map(s=>[s.id,s.name]),comparison.id)}</select></label>
 ${gridTable(['Mått',scenario.name,comparison.name],compareRows.map(row=>row.map(h)))}</details>`;
}

export function planningWorkspace(record,scenario,allCourses,year,view,term,comparison,filters,catalog,calendarView,compact) {
 const courses = allCourses.filter(c=>c.scenarioId===scenario.id);
 const active = summarizePlan(courses,scenario,record,year);
 const full = summarizePlan(courses,scenario,record);
 const visible = view==='term'?summarizePlan(courses,scenario,record,year,term):active;
 return `<header class="heading"><div><p class="eyebrow">AKTIVT ÄRENDE</p><h1>Studieplanering</h1><p>${h(caseDescription(record,catalog))}</p></div>
 <div class="actions"><button data-action="edit-case">Ändra grundinformation</button><button data-action="close-case">Stäng ärende</button></div></header>
 <section class="panel plan-toolbar" aria-label="Planeringsval"><div><h2>${h(caseTitle(record))}</h2><p>Välj scenario och läsår för arbetsytan.</p></div>
 <div class="plan-controls"><label>Aktivt scenario<select id="active-scenario">${planSelect(record.scenarios.map(s=>[s.id,s.name]),scenario.id)}</select></label>
 <button data-action="rename-scenario">Byt namn</button><button data-action="new-scenario">Skapa alternativ</button>
 ${record.scenarios.length>1?'<button class="danger-text" data-action="delete-scenario">Ta bort scenario</button>':''}
 <label>Läsår<select id="plan-year">${scenario.years.map(y=>yearOption(y,year)).join('')}</select></label><button data-action="add-year">＋ Lägg till läsår</button></div>
 <div class="plan-controls"><div class="segmented" aria-label="Visningsläge">${[['year','Läsårsöversikt'],['term','Terminsvy'],['list','Kurslista'],['calendar','Kalender']].map(([v,label])=>`<button data-plan-view="${v}" aria-pressed="${view===v}" class="${view===v?'active':''}">${label}</button>`).join('')}</div>
 <button class="primary" data-action="pick-course">＋ Lägg till kurs</button><button data-action="export">Granska och exportera</button></div></section>
 <div class="plan-shell"><div class="plan-body">
 ${view==='term'?'<div class="segmented term-tabs" aria-label="Termin">'+['HT','VT'].map(key=>`<button data-term-view="${key}" aria-pressed="${term===key}">${key} ${key==='HT'?year:year+1}</button>`).join('')+'</div>':''}
 ${view==='list'?`<section class="panel"><h2>Kurslista · ${yearText(year)}</h2>${active.courses.length?gridTable(['Kod','Kurs','HP','Läsår','Placering','Status och studietakt','Moment','Åtgärd'],active.courses.map(c=>courseRow(c,scenario,record))):'<p>Inga kurser i läsåret.</p>'}</section>`:
 view==='calendar'?calendarView():planBoard(record,scenario,active.courses,year,view,term,active.byYear[0],visible.courses)}
 ${examPanel(scenario,courses,record,year,view==='term'?term:'',catalog)}${completionsPanel(scenario,courses,record,year,filters,view==='term'?term:'')}
 ${notesPanel(scenario)}<details class="panel plan-section"><summary>Sammanställning över alla läsår</summary>
 <p>Varje kurs räknas en gång i läsårets total. Kända periodpoäng visas separat. Ofördelade kurser visas vid berörda perioder utan dubblerade poäng.</p>${yearTable(full)}</details>
 ${comparisonPanel(record,scenario,courses,comparison)}</div><aside>${planSummary(visible,year,view==='term'?term:'',compact)}</aside></div>`;
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
