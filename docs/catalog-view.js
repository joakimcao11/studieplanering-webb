import { programmeStructure, programmeInfo } from './lth-calendar.js';
import { categoryLabels, choiceLabels, filterOfferings, distinctOfferings, sortOfferings, offeringCategory, periodLabel, sourceStatusLabels } from './program-catalog.js';

export const htmlEscape = value => String(value ?? '').replace(/[&<>"']/g, character =>
 ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function officialLink(url, label) {
 try {
  const target = new URL(url);
  const domain = target.hostname;
  if (target.protocol !== 'https:' || !(/(^|\.)lth\.(se|lu\.se)$/.test(domain) || domain === 'cloud.timeedit.net')) return '';
  return `<a href="${htmlEscape(target.href)}" target="_blank" rel="noopener noreferrer">${htmlEscape(label)} ↗</a>`;
 } catch {
  return '';
 }
}

const option = (value, label, selected) =>
 `<option value="${htmlEscape(value)}" ${String(value) === selected ? 'selected' : ''}>${htmlEscape(label)}</option>`;

export function programmeOptions(catalog, selected, query = '') {
 const term = query.trim().toLocaleLowerCase('sv');
 return catalog.programmes.filter(p => p.id === selected || `${p.code} ${p.name}`.toLocaleLowerCase('sv').includes(term))
  .map(p => option(p.id, `${p.name} (${p.code})`, selected)).join('');
}

function catalogSelect(name, label, options, value, empty) {
 return `<label>${label}<select data-catalog-filter="${name}">${option('', empty, value)}${options.map(([id, text]) => option(id, text, value)).join('')}</select></label>`;
}

const labelsByStart = {1:'Läsperiod 1 · höst',2:'Läsperiod 2',3:'Läsperiod 3 · vår',4:'Läsperiod 4',HT:'Hösttermin',VT:'Vårtermin',unknown:'Läsperiod saknas'};
const displayOffering = (o,terms) => [o.year && 'Åk '+o.year,!o.general && o.specializationName,categoryLabels[offeringCategory(o)],periodLabel(o.periods,terms)].filter(Boolean).join(' · ');

export function coursePanel(catalog, record, filter, courses, modal = false) {
 const program = catalog.programmes.find(p=>p.id===record.programmeId);
 const termOnly = programmeStructure(record.programmeId,catalog.academicYear).periods==='terms';
 const offerings = filterOfferings(catalog,{programme:record.programmeId});
 const years = [...new Set(offerings.map(({offer})=>offer.year).filter(Boolean))].sort((a,b)=>a-b);
 const specializations = (program?.specializations || []).map(s=>[s.id,s.name]);
 const advancedYear = Number(filter.year)>=4;
 const spec = specializations.length ? catalogSelect('specialization','Specialisering',specializations,filter.specialization,'Alla specialiseringar') : '';
 const levels = [...new Set(offerings.map(({course})=>course.level).filter(Boolean))].sort();
 const scopeOptions = termOnly ? [['HT','Hösttermin'],['VT','Vårtermin']] : [1,2,3,4].map(p=>[p,'LP'+p]);
 return `<div class="course-panel-content">
 <div class="workspace-panel-heading">${modal?'': '<h2 id="course-heading">Lägg till kurs</h2>'}<small>${htmlEscape(program?.name || 'Eget kursval')}${filter.year?' · Åk '+htmlEscape(filter.year):''}</small></div>
 <label class="catalog-query"><span class="sr-only">Sök kursnamn eller kurskod</span><input type="search" data-catalog-query aria-label="Sök kursnamn eller kurskod" placeholder="Sök kursnamn eller kurskod" value="${htmlEscape(filter.q)}" ${modal?'autofocus':''}></label>
 <div class="catalog-basic">${catalogSelect('year','Årskurs',years.map(y=>[y,'Årskurs '+y]),filter.year,'Alla årskurser')}
 ${catalogSelect('category','Kurskategori',Object.entries(categoryLabels),filter.category,'Alla kurser')}</div>
 ${advancedYear?spec:''}
 <details class="catalog-more" data-filter-details ${filter.expanded?'open':''}><summary>Fler filter</summary>
 <p>Kursutbud ${catalog.academicYearLabel} · hämtat ${catalog.fetchedAt.slice(0,10)}. Kontrollera utbildningsplanen för aktuell antagningskull.</p>
 <div class="catalog-basic">
 ${catalogSelect('lp',termOnly?'Termin':'Läsperiod',scopeOptions,filter.lp,'Alla')}
 ${catalogSelect('status','Kursstatus',[...Object.entries(sourceStatusLabels),['preliminary','Preliminär']],filter.status,'Alla statusar')}
 ${catalogSelect('level','Nivå',levels.map(level=>[level,level]),filter.level,'Alla nivåer')}
 ${advancedYear?'':spec}</div>
 <div class="actions"><button data-action="reset-filters">Återställ filter</button>${officialLink(programmeInfo,'Utbildningsplaner')}</div></details>
 <div data-course-results role="region" aria-label="Kursresultat" tabindex="0">${catalogResults(catalog,record,filter,courses)}</div>
 <div class="course-panel-footer">${officialLink(program?.sourceUrl || catalog.sourceUrl,'Visa officiell LoT')}<button data-action="custom-course">＋ Egen kurs</button></div>
 </div>`;
}

export function catalogResults(catalog, record, filter, courses) {
 const termOnly = programmeStructure(record.programmeId,catalog.academicYear).periods==='terms';
 const rows = distinctOfferings(filterOfferings(catalog,{...filter,programme:record.programmeId,lp:termOnly?'':filter.lp}))
  .filter(({offer})=>!termOnly || !filter.lp || offer.periods.some(p=>(p<=2?'HT':'VT')===filter.lp));
 const included = new Set(courses.map(c=>c.code));
 const variants = new Map();
 for (const row of rows) variants.set(row.course.code,(variants.get(row.course.code) || 0)+1);
 const grouped = new Map();
 for (const row of rows.slice(0,filter.limit)) {
  const first = row.offer.periods.length?Math.min(...row.offer.periods):null;
  const key = first===null?'unknown':termOnly?(first<=2?'HT':'VT'):String(first);
  if (!grouped.has(key)) grouped.set(key,[]);
  grouped.get(key).push(row);
 }
 const periodName = p=>p==='unknown' && termOnly?'Termin saknas':labelsByStart[p];
 return `${filter.lp?`<p class="course-scope">${htmlEscape(periodName(filter.lp))} <button class="text-button" data-action="clear-period">Visa alla perioder</button></p>`:''}
 <p class="sr-only" role="status">${rows.length} erbjudanden</p>
 ${rows.length?[...grouped].map(([key,group])=>`<section class="course-source-group" data-period-group="${key}"><h3>${periodName(key)}</h3>
 ${group.map(({course:c,offer:o})=>{
  const added = included.has(c.code);
  const label = o.periods.length?periodLabel(o.periods,termOnly):periodName('unknown');
  const scope = displayOffering(o,termOnly);
  return `<article class="workspace-course-row" data-source-code="${htmlEscape(c.code)}">
   <div><button class="course-name" data-details="${htmlEscape(c.code)}" data-offering="${htmlEscape(o.sourceId)}">${htmlEscape(c.title)}</button>
   <div class="course-meta">${htmlEscape(c.code)} · ${c.credits.toLocaleString('sv-SE')} hp <span class="source-period">${htmlEscape(label)}</span></div>
   ${variants.get(c.code)>1 || (o.specializationName && !o.general)?`<small>${htmlEscape(scope)}</small>`:''}</div>
   <button class="course-add ${added?'is-added':''}" data-add-code="${htmlEscape(c.code)}" data-offering="${htmlEscape(o.sourceId)}" aria-label="${htmlEscape((added?'Redigera tillagd ':'Lägg till ')+c.code+(variants.get(c.code)>1?' · '+scope:''))}">${added?'✓ Tillagd':'+ Lägg till'}</button></article>`;
 }).join('')}</section>`).join(''):'<p class="workspace-empty">'+(record.programmeId?'Inga kurser matchar urvalet.':'Välj program under Ändra eller lägg till en egen kurs.')+'</p>'}
 ${rows.length>filter.limit?'<button data-action="more-courses">Visa fler kurser</button>':''}`;
}

export function catalogCourseDetails(catalog, c, programme, activeCase, exists, offeringId, back = false) {
 const offers = sortOfferings(c.offerings.filter(o=>!programme || o.programmeId===programme).map(offer=>({course:c,offer}))).map(row=>row.offer);
 return `<div class="dialog-head"><h2 id="editor-title">${htmlEscape(c.code + ' · ' + c.title)}</h2><button data-close aria-label="Stäng">✕</button></div>
 <div class="details-body"><p>${htmlEscape([c.titleEn, c.department, c.language, c.level, c.credits + ' hp'].filter(Boolean).join(' · '))}</p>
 <p>Källstatus: ${htmlEscape(sourceStatusLabels[c.status] || c.status || 'Okänd')}${c.preliminary ? ' · Preliminär' : ''}</p>
 ${[['Syfte',c.purpose],['Innehåll',c.contents],['Antagningsuppgifter och förkunskaper',c.prerequisites || c.admission]].map(([label,value]) => `<h3>${label}</h3><p class="preserve-lines">${htmlEscape(value || 'Se den officiella kursplanen.')}</p>`).join('')}
 <h3>Programkopplingar i LoT</h3>
 ${offers.map(o => {
  const termOnly = programmeStructure(o.programmeId, catalog.academicYear).periods === 'terms';
  const items = [o.programmeId, categoryLabels[offeringCategory(o)], o.year && 'Årskurs ' + o.year, o.fromYear && 'Från årskurs ' + o.fromYear,
   offeringCategory(o) !== o.choice && choiceLabels[o.choice], !o.general && o.specializationName, sourceStatusLabels[o.status] || o.status, o.suitableForeignStudents && 'Markerad för utbytesstudenter'];
  return `<div class="offering-detail" ${String(o.sourceId)===String(offeringId)?'data-selected-offering':''}><b>${htmlEscape(items.filter(Boolean).join(' · '))}</b>
   <p>${o.timePlans.length ? o.timePlans.map((plan,i) => (o.timePlans.length > 1 ? 'Placering ' + (i+1) + ': ' : '') + htmlEscape(periodLabel(plan.periods, termOnly))).join('<br>') : htmlEscape(periodLabel(o.periods, termOnly))}</p>
   ${o.footnote ? '<p>' + htmlEscape(o.footnote) + '</p>' : ''}</div>`;
 }).join('') || '<p>Ingen koppling till valt program.</p>'}
 <p class="note-footer">Läsår ${catalog.academicYearLabel} · hämtat ${catalog.fetchedAt.slice(0,10)}. Placeringen visar källans kursutbud. Kontrollera exakta tider i TimeEdit.</p>
 <div class="actions">${officialLink(c.sourceUrl,'Kurs i LoT')}${officialLink(c.syllabusUrl,'Kursplan')}${officialLink(c.syllabusPdfUrl,'Kursplan PDF')}${officialLink(c.timeeditUrl,'TimeEdit')}</div></div>
 <div class="dialog-actions">${back?'<button data-action="pick-course">Till kursvalet</button>':'<button data-close>Stäng</button>'}${activeCase
  ? `<button class="primary" data-add-code="${htmlEscape(c.code)}" data-offering="${htmlEscape(offeringId)}">${exists ? 'Finns i planen · redigera' : 'Lägg till i studieplaneringen'}</button>`
  : `<button class="primary" data-action="new-case" data-course="${htmlEscape(c.code)}">Skapa nytt ärende</button>`}</div>`;
}
