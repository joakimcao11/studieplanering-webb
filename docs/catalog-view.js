import { programmeStructure, programmeInfo } from './lth-calendar.js';
import { categoryLabels, choiceLabels, filterOfferings, groupOfferings, offeringCategory, periodLabel, sourceStatusLabels } from './program-catalog.js';

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

export function catalogPage(catalog, filter, activeCase, selectedMonth) {
 const p = catalog.programmes.find(programme => programme.id === filter.programme);
 const structure = programmeStructure(p?.id, catalog.academicYear);
 const yearLabel = catalog.academicYearLabel;
 const yearChoices = [...new Set(catalog.courses.flatMap(c => c.offerings.filter(o => o.programmeId === p?.id && o.year != null).map(o => o.year)))].sort((a,b) => a-b);
 return `<header class="heading"><div><h1>LTH:s kurskatalog</h1><p>Kursutbud ${yearLabel} · hämtat ${catalog.fetchedAt.slice(0,10)}</p></div><div class="actions">${activeCase ? '<button data-action="custom-course">＋ Skapa egen kurs</button>' : '<button class="primary" data-action="new-case">＋ Ny studieplanering</button>'}</div></header>
 <div class="catalog-workspace">
  <details class="panel catalog-filters" ${filter.expanded ? 'open' : ''}><summary>Program och filter</summary>
   <label>Sök program<input id="programme-search" type="search" placeholder="Namn eller programkod" value="${htmlEscape(filter.programmeQuery)}"></label>
   <label>Program<select id="programme-filter">${option('', 'Välj program', filter.programme)}${programmeOptions(catalog, filter.programme, filter.programmeQuery)}</select></label>
   <label>Kursutbudets läsår<select><option>${yearLabel}</option></select></label>
   <label>Sök kurs<input id="course-search" type="search" value="${htmlEscape(filter.q)}" placeholder="Kod, namn, institution …"></label>
   ${catalogSelect('year', 'Årskurs i katalogen', yearChoices.map(y => [y, 'Årskurs ' + y]), filter.year, 'Alla årskurser')}
   ${catalogSelect('category', 'Kurskategori', Object.entries(categoryLabels), filter.category, 'Alla kategorier')}
   ${catalogSelect('specialization', 'Specialisering', (p?.specializations || []).map(s => [s.id,s.name]), filter.specialization, 'Alla specialiseringar')}
   ${structure.periods === 'terms' ? '<p class="note-footer">Programmet följer terminstider utan läsperioder.</p>' : catalogSelect('lp', 'Läsperiod i källan', [1,2,3,4].map(n => [n,'LP'+n]), filter.lp, 'Alla läsperioder')}
   ${catalogSelect('status', 'Kursstatus', [...Object.entries(sourceStatusLabels), ['preliminary','Preliminär']], filter.status, 'Alla statusar')}
   <button data-action="reset-filters">Återställ filter</button>
   ${activeCase ? `<label>Månad vid egen placering<input id="catalog-month" type="month" value="${htmlEscape(selectedMonth)}"></label>` : ''}
  </details>
  <section class="catalog-content" aria-label="Programkurser">
   <div class="panel catalog-source"><h2>${p ? htmlEscape(p.name + ' (' + p.code + ')') : 'Välj ett program'}</h2>
   <p>Kursutbud ${yearLabel} · kontrollera utbildningsplan för antagningskullen.</p>
   ${activeCase?.admissionYear ? '<p>Ej verifierat för vald antagningskull (' + activeCase.admissionYear + ').</p>' : ''}
   ${structure.type === 'unknown' && p ? '<p>Programstruktur ej verifierad. Sektionerna följer källans årskurs och kategori.</p>' : ''}
   <div class="actions">${officialLink(p?.sourceUrl || catalog.sourceUrl, 'Läro- och timplan i LoT')}${officialLink(programmeInfo, 'Utbildningsplaner och programinformation')}</div></div>
   <div id="catalog-results"></div>
  </section>
 </div>`;
}

function periodMarks(periods, termOnly) {
 const label = periodLabel(periods, termOnly);
 if (termOnly || !periods.length) return htmlEscape(label);
 return `<span class="lp-marks" aria-hidden="true">${[1,2,3,4].map(n => `<span class="${periods.includes(n) ? 'filled' : ''}">${periods.includes(n) ? n : '·'}</span>`).join('')}</span><small class="lp-text">${htmlEscape(label)}</small>`;
}

function catalogTable(rows, termOnly) {
 return `<div class="table-scroll"><table class="lot-table" role="table" aria-label="Kurser"><thead role="rowgroup"><tr role="row">${['Kurskod','HP','Nivå','År','Kategori','Kursnamn',termOnly ? 'Termin' : 'Läsperioder'].map(label => `<th scope="col" role="columnheader">${label}</th>`).join('')}</tr></thead>
 <tbody role="rowgroup">${rows.map(({ course: c, offer: o }) => {
  const category = categoryLabels[offeringCategory(o)] || categoryLabels.unknown;
  const status = [...new Set([o.status,c.status])].filter(s => s && s !== 'active').map(s => sourceStatusLabels[s] || s);
  if (c.preliminary) status.push('Preliminär');
  return `<tr role="row">
    <td role="cell" data-label="Kurskod"><button class="text-button" data-details="${htmlEscape(c.code)}" aria-label="${htmlEscape(c.code + ' – ' + c.title)}">${htmlEscape(c.code)}</button></td>
    <td role="cell" data-label="HP">${c.credits.toLocaleString('sv-SE')}</td>
    <td role="cell" data-label="Nivå">${htmlEscape(c.level || '—')}</td>
    <td role="cell" data-label="År">${o.year ?? '—'}${o.fromYear ? '<small>Från ' + o.fromYear + '</small>' : ''}</td>
    <td role="cell" data-label="Kategori">${htmlEscape(category)}${status.length ? `<small>${htmlEscape(status.join(' · '))}</small>` : ''}</td>
    <td role="cell" data-label="Kursnamn"><button class="text-button" data-details="${htmlEscape(c.code)}">${htmlEscape(c.title)}</button>${o.footnote ? `<small>${htmlEscape(o.footnote)}</small>` : ''}</td>
    <td role="cell" data-label="${termOnly ? 'Termin' : 'LP'}">${periodMarks(o.periods, termOnly)}</td></tr>`;
 }).join('')}</tbody></table></div>`;
}

export function catalogResults(catalog, filter) {
 if (!filter.programme) return '<p class="panel">Välj ett program för att se kurser, årskurser och specialiseringar.</p>';
 const structure = programmeStructure(filter.programme, catalog.academicYear);
 const rows = filterOfferings(catalog, filter);
 if (!rows.length) return '<p class="panel" role="status">Inga kurser visas. Prova att återställa filtren eller välj ett annat program.</p>';
 const groups = groupOfferings(rows, structure);
 const parts = [...new Set(groups.map(group => group.part))];
 return `<div class="catalog-jump panel"><p role="status">${new Set(rows.map(row => row.course.code)).size} kurser · ${rows.length} kurskopplingar</p>
 <label>Gå till…<select id="catalog-jump"><option value="">Välj programdel eller sektion</option>
 ${parts.map((part,i) => `<option value="lot-part-${i}">${htmlEscape(part)}</option>`).join('')}
 ${groups.map((group,i) => `<option value="lot-section-${i}">${htmlEscape(group.title)}</option>`).join('')}</select></label></div>
 ${parts.map((part,i) => `<details class="lot-part" id="lot-part-${i}" open><summary>${htmlEscape(part)}</summary>
 ${groups.map((group,j) => group.part === part ? `<details class="lot-group" id="lot-section-${j}" ${j === 0 || Boolean(filter.q || filter.year || filter.category || filter.specialization || filter.lp || filter.status) ? 'open' : ''}>
 <summary>${htmlEscape(group.title)} <span>${group.rows.length}</span></summary>${catalogTable(group.rows, structure.periods === 'terms')}</details>` : '').join('')}</details>`).join('')}`;
}

export function catalogCourseDetails(catalog, c, programme, activeCase, exists) {
 const offers = c.offerings.filter(o => !programme || o.programmeId === programme);
 return `<div class="dialog-head"><h2 id="editor-title">${htmlEscape(c.code + ' · ' + c.title)}</h2><button data-close aria-label="Stäng">✕</button></div>
 <div class="details-body"><p>${htmlEscape([c.titleEn, c.department, c.language, c.level, c.credits + ' hp'].filter(Boolean).join(' · '))}</p>
 <p>Källstatus: ${htmlEscape(sourceStatusLabels[c.status] || c.status || 'Okänd')}${c.preliminary ? ' · Preliminär' : ''}</p>
 ${[['Syfte',c.purpose],['Innehåll',c.contents],['Antagningsuppgifter och förkunskaper',c.prerequisites || c.admission]].map(([label,value]) => `<h3>${label}</h3><p class="preserve-lines">${htmlEscape(value || 'Se den officiella kursplanen.')}</p>`).join('')}
 <h3>Programkopplingar i LoT</h3>
 ${offers.map(o => {
  const termOnly = programmeStructure(o.programmeId, catalog.academicYear).periods === 'terms';
  const items = [o.programmeId, categoryLabels[offeringCategory(o)], o.year && 'Årskurs ' + o.year, o.fromYear && 'Från årskurs ' + o.fromYear,
   offeringCategory(o) !== o.choice && choiceLabels[o.choice], !o.general && o.specializationName, sourceStatusLabels[o.status] || o.status, o.suitableForeignStudents && 'Markerad för utbytesstudenter'];
  return `<div class="offering-detail"><b>${htmlEscape(items.filter(Boolean).join(' · '))}</b>
   <p>${o.timePlans.length ? o.timePlans.map((plan,i) => (o.timePlans.length > 1 ? 'Placering ' + (i+1) + ': ' : '') + htmlEscape(periodLabel(plan.periods, termOnly))).join('<br>') : htmlEscape(periodLabel(o.periods, termOnly))}</p>
   ${o.footnote ? '<p>' + htmlEscape(o.footnote) + '</p>' : ''}</div>`;
 }).join('') || '<p>Ingen koppling till valt program.</p>'}
 <p class="note-footer">Läsår ${catalog.academicYearLabel} · hämtat ${catalog.fetchedAt.slice(0,10)}. Placeringen visar källans kursutbud. Kontrollera exakta tider i TimeEdit.</p>
 <div class="actions">${officialLink(c.sourceUrl,'Kurs i LoT')}${officialLink(c.syllabusUrl,'Kursplan')}${officialLink(c.syllabusPdfUrl,'Kursplan PDF')}${officialLink(c.timeeditUrl,'TimeEdit')}</div></div>
 <div class="dialog-actions"><button data-close>Stäng</button>${activeCase
  ? `<button class="primary" data-add-code="${htmlEscape(c.code)}">${exists ? 'Finns i planen · redigera' : 'Lägg till i studieplaneringen'}</button>`
  : `<button class="primary" data-action="new-case" data-course="${htmlEscape(c.code)}">Skapa nytt ärende</button>`}</div>`;
}
