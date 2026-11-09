import { htmlEscape, officialLink } from './catalog-view.js';
import { casePrivacy } from './case-view.js';
import { categoryLabels, filterOfferings, offeringCategory, periodLabel } from './program-catalog.js';
import { hp, courseStates, slots, planSlots, plannedLabel, placementLabel, planningDates, sourcePlacements, yearText } from './planning.js';
import { planDialog, planSelect, formEnd } from './planning-view.js';

const e = htmlEscape;
export function pickerResults(catalog,programme,filter) {
 if (!programme) return '<p class="period-empty">Välj ett program i ärendets grundinformation eller skapa en egen kurs.</p>';
 const rows = filterOfferings(catalog,{...filter,programme});
 const visible = [...new Map(rows.map(row=>[row.course.code,row])).values()].slice(0,35);
 return `<p role="status">${new Set(rows.map(r=>r.course.code)).size} träffar${visible.length===35?' · visar högst 35, avgränsa med sökfältet':''}</p>
 ${visible.map(({course:c,offer:o})=>`<article class="picker-row"><div><b>${e(c.code)} · ${hp(c.credits)} hp</b><p>${e(c.title)}</p>
 <small>${e(categoryLabels[offeringCategory(o)] || 'Kategori saknas')} · ${e(periodLabel(o.periods,planSlots({programmeId:programme},2026)[0]==='HT'))}</small>
 ${o.footnote?`<small>${e(o.footnote)}</small>`:''}</div><div class="actions"><button data-picker-details="${e(c.code)}">Detaljer</button>
 <button class="primary" data-picker-code="${e(c.code)}">Välj <span class="sr-only">${e(c.code)}</span></button></div></article>`).join('') || '<p class="period-empty">Inga kurser matchar filtren.</p>'}`;
}

export function pickerForm(catalog,record,filter) {
 const programme = catalog.programmes.find(p=>p.id===record.programmeId);
 const yearOptions = [...new Set(catalog.courses.flatMap(c=>c.offerings.filter(o=>o.programmeId===record.programmeId && o.year).map(o=>o.year)))].sort((a,b)=>a-b);
 return planDialog('Lägg till kurs',`<div class="details-body picker-body"><p>1. Välj kurs. 2. Välj läsår och placering.</p>
 <p>${e(programme?.name || 'Program ej valt')} · kursutbud ${catalog.academicYearLabel}</p>
 <div class="picker-filters"><label>Sök kurs<input id="picker-query" type="search" value="${e(filter.q)}" autofocus placeholder="Kod, namn eller institution"></label>
 <label>Årskurs<select data-picker-filter="year">${planSelect([['','Alla'],...yearOptions.map(y=>[y,'Årskurs '+y])],filter.year)}</select></label>
 <label>Kategori<select data-picker-filter="category">${planSelect([['','Alla'],...Object.entries(categoryLabels)],filter.category)}</select></label>
 ${planSlots(record,2026)[0]==='HT'?'':`<label>Läsperiod<select data-picker-filter="lp">${planSelect([['','Alla'],...['1','2','3','4'].map(p=>[p,slots[p]])],filter.lp)}</select></label>`}</div>
 <div id="picker-results">${pickerResults(catalog,record.programmeId,filter)}</div></div>
 <div class="dialog-actions"><button data-close>Stäng</button><button class="primary" data-picker-code="custom">＋ Skapa egen kurs</button></div>`);
}

export function courseDraft(course, source, record, scenario, year, preferred, programme) {
 if (course) return course;
 const offers = source?.offerings.filter(o=>o.programmeId===programme) || [];
 const draft = {id:'',code:source?.code || '',title:source?.title || '',credits:source?.credits ?? 7.5,level:source?.level || '',
  status:'planned',note:'',studyRate:null,completedCredits:0,weeks:null,allocation:[],periodRates:[],plannedYear:year,programmeId:programme,
  catalogYear:source?.academicYear || '',sourceUrl:source?.syllabusUrl || '',periods:[...new Set(offers.flatMap(o=>o.periods))].sort(),
  offeringActive:Boolean(source && source.status==='active' && offers.some(o=>o.status==='active')),timePlans:offers.flatMap(o=>o.timePlans)};
 const recommended = sourcePlacements(draft,record,year)[0];
 const plannedPeriods = preferred ? (recommended?.includes(preferred)?recommended:[preferred]) : recommended || ['OWN'];
 const [start,end] = planningDates(record,year,plannedPeriods);
 return {...draft,plannedPeriods,start,end,useOwnDates:plannedPeriods.includes('OWN')};
}

export function placementForm(course,record,scenario,back,source) {
 const year = course.plannedYear;
 const allSlots = [...new Set([...planSlots(record,year),'SUMMER','OWN',...course.plannedPeriods])];
 const suggestions = sourcePlacements(course,record,year);
 const isSource = Boolean(course.catalogYear);
 const sourcePeriods = course.periods.length
  ? periodLabel(course.periods,planSlots({programmeId:course.programmeId},Number('20'+course.catalogYear.slice(0,2)))[0]==='HT')
  : 'Placering saknas i kursutbudet';
 return planDialog(course.id?'Ändra kurs och placering':'Lägg till kurs i studieplaneringen',`<form id="course-form" data-id="${course.id}">
 <input type="hidden" name="catalogYear" value="${e(course.catalogYear)}"><input type="hidden" name="programmeId" value="${e(course.programmeId)}">
 ${isSource?`<div class="notice"><b>Officiell uppgift</b><p>${e(course.code)} · ${e(source?.title || course.title)} · ${hp(source?.credits ?? course.credits)} hp</p>
 <p>${e(course.programmeId || 'Ingen verifierad programkoppling')} · ${e(course.catalogYear.replace('_','/'))} · ${e(sourcePeriods)}</p>${officialLink(course.sourceUrl,'Kursplan')}</div>`:
 '<p class="form-intro">Manuellt tillagd kurs. Ange endast kursuppgifter.</p>'}
 <div class="form-grid"><label>Kursnamn<input name="title" value="${e(course.title)}" maxlength="150" required ${isSource?'readonly':'autofocus'}></label>
 <label>Kurskod<input name="code" value="${e(course.code)}" maxlength="40" ${isSource?'readonly':''}></label>
 <label>Högskolepoäng<input name="credits" type="number" min="0.1" max="120" step="any" value="${course.credits}" required ${isSource?'readonly':''}></label>
 <label>Läsår<select name="plannedYear">${planSelect([...new Set([...scenario.years,year])].sort((a,b)=>a-b).map(y=>[y,yearText(y)]),year)}</select></label></div>
 <fieldset class="placement-options"><legend>Planerad placering</legend>
 <p id="placement-hint">${e(placementLabel(course,record))}</p>
 ${suggestions.length>1?`<p>Källan anger flera placeringar.</p><div class="actions">${suggestions.map(p=>`<button type="button" data-source-placement="${p.join(',')}">Välj ${e(plannedLabel(p))}</button>`).join('')}</div>`:''}
 <div class="placement-checks">${allSlots.map(p=>`<label><input type="checkbox" name="slot" value="${p}" ${course.plannedPeriods.includes(p)?'checked':''}>${slots[p]}</label>`).join('')}</div></fieldset>
 <label class="inline-check"><input type="checkbox" name="useOwnDates" ${course.useOwnDates?'checked':''}> Ange egna planeringsdatum</label>
 <div class="form-grid" id="placement-dates" ${course.useOwnDates?'':'hidden'}><label>Start<input name="start" type="date" value="${e(course.start)}"></label><label>Slut<input name="end" type="date" value="${e(course.end)}"></label></div>
 <div class="form-grid"><label>Status<select name="status">${planSelect(Object.entries(courseStates),course.status)}</select></label>
 <label>Avklarade delpoäng<input name="completedCredits" type="number" min="0" step="any" value="${course.completedCredits || 0}"></label></div>
 <details class="placement-detail" ${course.allocation.length||course.periodRates?.length||course.weeks||course.studyRate?'open':''}><summary>Studietakt, poängfördelning och anteckning</summary>
 <div class="form-grid"><label>Angiven studietakt (%)<input name="studyRate" type="number" min="1" max="400" step="any" value="${course.studyRate??''}"></label>
 <label>Faktiskt planerade veckor<input name="weeks" type="number" min="0.1" max="260" step="any" value="${course.weeks??''}"></label></div>
 <p class="note-footer">Studietakt uppskattas från angivna veckor och 1,5 hp per vecka om ingen takt angetts. En manuell poängfördelning måste täcka alla valda perioder. Periodvis studietakt är valfri.</p>
 <div class="allocation-inputs">${allSlots.map(p=>`<label>${slots[p]} · hp<input type="number" name="hp-${p}" min="0" step="0.0001" value="${course.allocation.find(x=>x.slot===p)?.hp ?? ''}" ${course.plannedPeriods.includes(p)?'':'disabled'}></label>`).join('')}</div>
 <div class="allocation-inputs">${allSlots.map(p=>`<label>${slots[p]} · angiven takt (%)<input type="number" name="rate-${p}" min="1" max="400" step="any" value="${course.periodRates?.find(x=>x.slot===p)?.rate ?? ''}" ${course.plannedPeriods.includes(p)?'':'disabled'}></label>`).join('')}</div>
 <label>Avidentifierad kursanteckning<small>${casePrivacy}</small><textarea name="note" maxlength="1000">${e(course.note)}</textarea></label></details>
 <input type="hidden" name="level" value="${e(course.level)}">
 ${course.id?`<button class="danger-text" type="button" data-delete="${course.id}">Ta bort kurs</button>`:''}
 ${back?'<button type="button" data-action="pick-course">← Till kursvalet</button>':''}${formEnd(course.id?'Spara kurs':'Lägg till i planen')}</form>`);
}
