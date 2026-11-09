import { htmlEscape, officialLink } from './catalog-view.js';
import { casePrivacy } from './case-view.js';
import { categoryLabels, distinctOfferings, offeringCategory, periodLabel } from './program-catalog.js';
import { hp, courseStates, slots, planSlots, plannedLabel, placementLabel, planningDates, sourcePlacements, yearText } from './planning.js';
import { planDialog, planSelect, formEnd } from './planning-view.js';

const e = htmlEscape;
export function courseDraft(course, source, record, scenario, year, preferred, programme, offeringId) {
 if (course) return course;
 const matches = source?.offerings.filter(o=>o.programmeId===programme) || [];
 const chosen = matches.find(o=>String(o.sourceId)===String(offeringId));
 const offers = chosen ? [chosen] : matches;
 const draft = {id:'',code:source?.code || '',title:source?.title || '',credits:source?.credits ?? 7.5,level:source?.level || '',
  status:'planned',note:'',studyRate:null,completedCredits:0,weeks:null,allocation:[],periodRates:[],plannedYear:year,programmeId:programme,
  catalogYear:source?.academicYear || '',offeringId:chosen?.sourceId,sourceUrl:source?.syllabusUrl || '',periods:[...new Set(offers.flatMap(o=>o.periods))].sort(),
  offeringActive:Boolean(source && source.status==='active' && offers.some(o=>o.status==='active')),timePlans:offers.flatMap(o=>o.timePlans)};
 const possible = sourcePlacements(draft,record,year);
 const recommended = possible.find(p=>p.includes(preferred)) || possible[0];
 const plannedPeriods = preferred ? (recommended?.includes(preferred)?recommended:[preferred]) : recommended || ['OWN'];
 const [start,end] = planningDates(record,year,plannedPeriods);
 return {...draft,plannedPeriods,start,end,useOwnDates:plannedPeriods.includes('OWN')};
}

export function sourcePlacementButtons(course,record) {
 const suggestions = sourcePlacements(course,record,course.plannedYear);
 return suggestions.length ? '<div class="actions">'+suggestions.map(p=>
  `<button type="button" data-source-placement="${p.join(',')}">Använd ${e(plannedLabel(p))}</button>`).join('')+'</div>' : '';
}

export function placementForm(course,record,scenario,back,source) {
 const year = course.plannedYear;
 const allSlots = [...new Set([...planSlots(record,year),'SUMMER','OWN',...course.plannedPeriods])];
 const offers = distinctOfferings((source?.offerings || []).filter(o=>o.programmeId===course.programmeId).map(offer=>({course:source,offer}))).map(x=>x.offer);
 const isSource = Boolean(course.catalogYear);
 const sourcePeriods = course.periods.length
  ? periodLabel(course.periods,planSlots({programmeId:course.programmeId},Number('20'+course.catalogYear.slice(0,2)))[0]==='HT')
  : 'Placering saknas i kursutbudet';
 return planDialog(course.id?'Ändra kurs och placering':'Lägg till kurs i studieplaneringen',`<form id="course-form" data-id="${course.id}">
 <input type="hidden" name="catalogYear" value="${e(course.catalogYear)}"><input type="hidden" name="programmeId" value="${e(course.programmeId)}">
 ${isSource?`<div class="notice"><b>Officiell uppgift</b><p>${e(course.code)} · ${e(source?.title || course.title)} · ${hp(source?.credits ?? course.credits)} hp</p>
 <p data-offering-summary>${e(course.programmeId || 'Ingen verifierad programkoppling')} · ${e(course.catalogYear.replace('_','/'))} · ${e(sourcePeriods)}</p>${officialLink(course.sourceUrl,'Kursplan')}</div>`:
 '<p class="form-intro">Manuellt tillagd kurs. Ange endast kursuppgifter.</p>'}
 ${isSource && offers.length>1?`<label>Officiellt erbjudande<select name="offeringId">${planSelect([['','Samlad källuppgift'],...offers.map(o=>[o.sourceId,
 ['Åk '+(o.year||'–'),o.specializationName,categoryLabels[offeringCategory(o)],periodLabel(o.periods,planSlots(record,year)[0]==='HT')].filter(Boolean).join(' · ')])],course.offeringId || '')}</select></label>`:
 `<input type="hidden" name="offeringId" value="${e(course.offeringId || '')}">`}
 <div class="form-grid"><label>Kursnamn<input name="title" value="${e(course.title)}" maxlength="150" required ${isSource?'readonly':'autofocus'}></label>
 <label>Kurskod<input name="code" value="${e(course.code)}" maxlength="40" ${isSource?'readonly':''}></label>
 <label>Högskolepoäng<input name="credits" type="number" min="0.1" max="120" step="any" value="${course.credits}" required ${isSource?'readonly':''}></label>
 <label>Läsår<select name="plannedYear">${planSelect([...new Set([...scenario.years,year])].sort((a,b)=>a-b).map(y=>[y,yearText(y)]),year)}</select></label></div>
 <fieldset class="placement-options"><legend>Planerad placering</legend>
 <p id="placement-hint">${e(placementLabel(course,record))}</p>
 <div data-source-suggestions>${sourcePlacementButtons(course,record)}</div>
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
