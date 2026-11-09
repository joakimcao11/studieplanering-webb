import { htmlEscape, officialLink, programmeOptions } from './catalog-view.js';
import { calendarSource, calendarDecision, officialCalendar } from './lth-calendar.js';
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

export function startCaseForm(catalog,defaultYear) {
 return `<div class="start-view"><section class="workspace-intro"><h1>Studieplanering</h1><p>Välj program och läsår för att börja planera.</p></section>
 <section class="workspace-card start-card"><h2>Grundinformation</h2><form id="case-form">
 <div class="start-fields"><label>Program<select name="programmeId"><option value="">Eget kursval</option>${programmeOptions(catalog,'')}</select></label>
 <label>Planeringsläsår<input name="planningYear" type="number" min="1950" max="2100" value="${defaultYear}" required></label></div>
 <details class="start-optional"><summary>Årskurs och antagningsår (valfritt)</summary><div class="start-fields"><label>Årskurs<input type="number" name="studyYear" min="1" max="20"></label>
 <label>Antagningsår<input type="number" name="admissionYear" min="1950" max="2100"></label></div></details>
 <p id="form-error" class="error" role="alert"></p><button type="submit" class="primary">Börja planera</button>
 <p class="workspace-footnote">Ärendet sparas lokalt i den här webbläsaren utan studentnamn.</p>
 </form></section></div>`;
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

export function caseForm(catalog, record, defaultYear) {
 const r = record || { programmeId: '', planningYear: defaultYear, targetCredits: 60 };
 const programmes = programmeOptions(catalog, r.programmeId);
 return `<div class="dialog-head"><h2 id="editor-title">${record ? 'Ändra grundinformation' : 'Ny studieplanering'}</h2><button data-close aria-label="Stäng">✕</button></div>
 <form id="case-form" data-editing="${Boolean(record)}"><p class="form-intro">Grundinformationen sparas lokalt. Studentens namn kan anges tillfälligt i dokumentexporten.</p>
 <label>Program<select name="programmeId" autofocus><option value="">Ej valt / annan utbildning</option>
 ${r.programmeId && !caseProgram(r,catalog) ? `<option selected value="${htmlEscape(r.programmeId)}">Okänd programkod (${htmlEscape(r.programmeId)})</option>` : ''}${programmes}</select></label>
 <div class="form-grid"><label>Antagningsår<input type="number" name="admissionYear" min="1950" max="2100" value="${r.admissionYear ?? ''}" placeholder="Valfritt"><small>Året då utbildningen påbörjades.</small></label>
 <label>Aktuell årskurs<input type="number" name="studyYear" min="1" max="20" value="${r.studyYear ?? ''}" placeholder="Valfritt"></label>
 <label>Planeringsläsår (startår)<input type="number" name="planningYear" min="1950" max="2100" value="${r.planningYear}" required><small>Läsåret börjar på hösten och fortsätter nästa kalenderår.</small></label>
 <label>Eget mål i hp<input type="number" name="targetCredits" min="1" max="1000" value="${r.targetCredits}" required></label></div>
 <p id="form-error" class="error" role="alert"></p>
 <div class="dialog-actions"><button type="button" data-close>Avbryt</button><button type="submit" class="primary">${record ? 'Spara ändringar' : 'Skapa studieplanering'}</button></div></form>`;
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
 <div class="actions">${officialLink(calendarSource,'Studentwebbens läsårsindelning')}${shownYear === 2026 ? officialLink(calendarDecision,'LTH:s beslut 2026/27') : ''}</div></details>`;
}
