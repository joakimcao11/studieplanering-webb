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

export function casesPage(data, catalog, legacy, expanded) {
 return `<header class="heading"><div><p class="eyebrow">ARBETSVERKTYG FÖR LTH-PERSONAL</p><h1>Mina studieplaneringar</h1>
 <p>Skapa en studieplanering, välj program och lägg till kurser från LTH:s kursutbud. Dina ärenden sparas lokalt utan studentnamn.</p></div>
 <div class="actions"><button class="primary" data-action="new-case">＋ Ny studieplanering</button></div></header>
 ${legacy ? `<section class="panel legacy-panel"><h2>Äldre lokala planer hittades</h2><p>Uppgifterna ligger kvar i den här webbläsaren tills du väljer att ta bort dem. Du kan fortsätta arbeta med nya ärenden.</p>
 <div class="actions"><button data-action="review-legacy">Granska och välj planer</button><button class="danger-text" data-action="remove-legacy">Ta bort äldre lagring</button>
 ${expanded ? '<button data-action="leave-legacy">Behåll och fortsätt</button>' : ''}</div></section>` : ''}
 <div class="case-workspace"><section aria-label="Sparade ärenden"><h2>Lokala ärenden</h2>
 ${sortCases(data.cases).map(c => `<article class="panel case-row"><h3>${caseTitle(c)}${c.id === data.activeCaseId ? ' <span class="pill">Aktivt</span>' : ''}</h3>
 <p>${htmlEscape(caseDescription(c, catalog))}</p><small>Senast ändrad ${dateFormat.format(new Date(c.updatedAt))} kl. ${timeFormat.format(new Date(c.updatedAt))}</small>
 <div class="actions"><button class="primary" data-case-open="${c.id}">Öppna</button><button data-case-copy="${c.id}">Skapa alternativ</button>
 <button data-case-backup="${c.id}">Exportera ärendet som JSON</button><button class="danger-text" data-case-delete="${c.id}">Ta bort</button></div></article>`).join('')
 || '<div class="panel"><h3>Inga sparade ärenden</h3><p>Skapa en studieplanering eller öppna ett tidigare ärende från en JSON-säkerhetskopia.</p></div>'}</section>
 <aside class="panel case-tools"><h2>Öppna tidigare ärende</h2><p>Importera en namnfri JSON-säkerhetskopia från en annan webbläsare eller enhet.</p>
 <button data-action="import">Importera JSON</button><button data-action="backup-all" ${data.cases.length ? '' : 'disabled'}>Exportera alla ärenden som JSON</button>
 <button data-page="catalog">Utforska LTH:s kurskatalog</button>
 <details><summary>Så fungerar lokalt sparande</summary><p>Planerna finns i den här webbläsarprofilen. De synkas inte och kan försvinna om webbläsardata rensas. Även namnfria uppgifter kan identifiera någon i kombination med annan information.</p></details>
 <button class="danger-text" data-action="clear-cases">Rensa alla lokala ärenden</button></aside></div>`;
}

export function caseForm(catalog, record, defaultYear) {
 const r = record || { programmeId: '', planningYear: defaultYear, targetCredits: 60 };
 const programmes = programmeOptions(catalog, r.programmeId);
 return `<div class="dialog-head"><h2 id="editor-title">${record ? 'Ändra grundinformation' : 'Ny studieplanering'}</h2><button data-close aria-label="Stäng">✕</button></div>
 <form id="case-form"><p class="form-intro">Grundinformationen sparas lokalt. Studentens namn kan anges tillfälligt i dokumentexporten.</p>
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
