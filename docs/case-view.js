import { htmlEscape, officialLink } from './catalog-view.js';
import { calendarSource, calendarDecision, calendarDecision2027, officialCalendar, stockholmDate } from './lth-calendar.js';
import { sortCases } from './cases.js';

export const casePrivacy = 'Skriv kort och avidentifierat. Undvik namn, kontaktuppgifter, personnummer, hälsouppgifter och annat som kan identifiera någon.';
export const caseProgram = (record, catalog) => catalog.programmes.find(p => p.id === record.programmeId);
const dateFormat = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' });
const timeFormat = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });

export function caseTitle(record) {
 return (record.alternative ? 'Alternativ' : 'Studieplanering') + ' · ' + dateFormat.format(new Date(record.createdAt));
}

export function caseDescription(record, catalog) {
 const program = caseProgram(record, catalog);
 return [program ? program.name + ' (' + program.code + ')' : 'Program ej valt',
  record.studyYear ? 'Årskurs ' + record.studyYear : 'Årskurs ej angiven',
  record.admissionYear ? 'Antagningskull ' + record.admissionYear : '',
  'Planeringsläsår ' + record.planningYear + '/' + (record.planningYear + 1)].filter(Boolean).join(' · ');
}

const programLabel = program => program.code+' – '+program.name;
export function selectedProgramme(catalog, value, previous = '') {
 const query = value.trim().toLocaleLowerCase('sv');
 if (!query || query==='eget kursval') return '';
 const match = catalog.programmes.find(p=>[p.id,p.code,p.name,programLabel(p)].some(label=>label.toLocaleLowerCase('sv')===query));
 if (match) return match.id;
 if (query===previous.toLocaleLowerCase('sv')) return previous;
 throw Error('Välj ett LTH-program i förslagen eller skriv Eget kursval.');
}

export function startCaseForm(catalog) {
 return `<div class="start-view"><section class="workspace-intro"><h1>Studieplanering</h1><p>Planera kurser eller strukturera mål och nästa steg i samma ärende.</p></section>
 <section class="workspace-card start-card"><h2>Nytt ärende</h2>${caseFields(catalog,null,false,'')}</section></div>`;
}

export function savedCases(data,catalog,legacy) {
 return `<div class="dialog-head"><h2 id="editor-title">Öppna sparat ärende</h2><button data-close aria-label="Stäng">✕</button></div>
 <div class="details-body saved-case-list">
 ${sortCases(data.cases).map(c=>`<article class="saved-case">
 <div><strong>${caseTitle(c)}</strong>${c.id===data.activeCaseId?' <span class="source-period">Aktivt</span>':''}
 <p>${htmlEscape(caseDescription(c,catalog))}</p><small>Ändrad ${dateFormat.format(new Date(c.updatedAt))} kl. ${timeFormat.format(new Date(c.updatedAt))}</small></div>
 <div class="actions"><button data-case-open="${c.id}">Öppna</button><details class="saved-case-actions"><summary>Mer</summary>
 <div class="actions"><button data-case-backup="${c.id}">Exportera JSON</button><button class="danger-text" data-case-delete="${c.id}">Ta bort</button></div></details></div></article>`).join('') || '<p>Inga sparade ärenden i den här webbläsaren.</p>'}
 ${legacy?'<p>Äldre planer finns på den här enheten.</p><button data-action="review-legacy">Granska äldre planer</button>':''}</div>
 <div class="dialog-actions"><button data-close>Stäng</button><button data-action="import">Importera JSON</button></div>`;
}

function caseFields(catalog,record,modal,name) {
 const program = record && caseProgram(record,catalog);
 const day = stockholmDate(record ? new Date(record.createdAt) : new Date());
 return `<form id="case-form" data-editing="${Boolean(record)}" autocomplete="off">
 <p class="form-intro">Ärendedatum <time datetime="${day}">${day}</time></p>
 <div class="start-fields">
 <label>Program <input name="programmeQuery" list="case-programmes${modal?'-dialog':''}" value="${htmlEscape(program?programLabel(program):record?.programmeId || '')}" placeholder="Sök program eller välj Eget kursval" maxlength="160" ${modal?'autofocus':''}></label>
 <datalist id="case-programmes${modal?'-dialog':''}"><option value="Eget kursval">${catalog.programmes.map(p=>'<option value="'+htmlEscape(programLabel(p))+'">').join('')}</datalist>
 <label>Namn på student (valfritt)<input data-case-student maxlength="120" autocomplete="off" spellcheck="false" value="${htmlEscape(name)}"></label>
 </div>
 <details class="start-optional" ${record?.studyYear||record?.admissionYear?'open':''}><summary>Fler uppgifter</summary>
 <div class="start-fields"><label>Årskurs<input type="number" name="studyYear" min="1" max="20" value="${record?.studyYear??''}"></label>
 <label>Antagningsår<input type="number" name="admissionYear" min="1950" max="2100" value="${record?.admissionYear??''}"></label></div></details>
 <p id="form-error" class="error" role="alert"></p>
 <div class="actions case-start-actions">${modal?'<button type="button" data-close>Avbryt</button>':''}
 <button type="submit" class="primary">${record?'Spara ändringar':'Kurser och studietakt'}</button>
 ${record?'':'<button type="submit" data-start-focus="actions">Mål och handlingsplan</button>'}</div>
 <p class="workspace-footnote">Ärendet sparas i den här webbläsaren. Namnet kan följa med i dokumentet och rensas vid omladdning eller ärendebyte.</p></form>`;
}

export function caseForm(catalog,record,name = '') {
 return `<div class="dialog-head"><h2 id="editor-title">${record?'Ändra grundinformation':'Nytt ärende'}</h2><button data-close aria-label="Stäng">✕</button></div>
 ${caseFields(catalog,record,true,name)}`;
}

export function calendarPanel(record, shownYear) {
 const cal = officialCalendar(shownYear, record.programmeId, record.planningYear === shownYear ? record.studyYear : null);
 const dates = interval => interval.map(value => dateFormat.format(new Date(value + 'T12:00:00Z'))).join(' – ');
 return `<details class="panel case-calendar"><summary>LTH:s läsårsindelning ${shownYear}/${shownYear+1}</summary>
 ${cal ? `<p>HT ${shownYear}: ${dates(cal.autumn)}<br>VT ${shownYear+1}: ${dates(cal.spring)}</p>
 ${cal.structure.periods === 'terms' ? '<p>Programmet följer terminstider utan LP-indelning.</p>' :
  cal.structure.periods === 'unknown' ? '<p>Ordinarie terminstider. Kontrollera eventuell särskild kalender för programmet.</p>' :
  `<div class="calendar-periods">${Object.entries(cal.teaching).map(([number, intervals]) => `<div><b>LP${number}</b><br>${intervals.map(dates).join('<br>')}</div>`).join('')}</div>`}
 ${cal.note ? `<p>${htmlEscape(cal.note)}</p>` : ''}` : '<p>Det här läsårets datum finns inte i appens verifierade underlag.</p>'}
 <p>Kursens exakta datum kontrolleras i TimeEdit. Tidslinjen visar egna planeringsdatum.</p>
 <div class="actions">${officialLink(calendarSource,'Studentwebbens läsårsindelning')}${shownYear === 2026 ? officialLink(calendarDecision,'LTH:s beslut 2026/27') : shownYear===2027?officialLink(calendarDecision2027,'LTH:s beslut 2027/28'):''}</div></details>`;
}
