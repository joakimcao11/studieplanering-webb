import { normalizedExportSettings } from './export-settings.js';
import { calendarSource, calendarDecision, programmeStructure } from './lth-calendar.js';
import { periodLabel, choiceLabels } from './program-catalog.js';
import { hp, yearText, slots, examStates, completionStates, completionTypes, courseStates, stepStates, roles, retakeWindows, rateDescription, plannedLabel, placementLabel, scenarioCourses, summarizePlan, planSlots } from './planning.js';

const paragraphBlock = text => ({kind:'paragraph',text:String(text)});
const headingBlock = text => ({kind:'heading',text:String(text)});
const tableBlock = (labels,weights,rows) => ({kind:'table',labels,weights,rows:rows.map(row=>row.map(v=>String(v??'')))});
const sourcePlacementText = (c,source) => {
 if (!c.catalogYear) return 'Manuellt tillagd';
 const termOnly = programmeStructure(c.programmeId,c.catalogYear).periods==='terms';
 const offers = source?.offerings.filter(o=>o.programmeId===c.programmeId && (!c.offeringId || o.sourceId===c.offeringId)) || [];
 const context = [...new Set(offers.flatMap(o=>[choiceLabels[o.choice],!o.general&&o.specializationName]).filter(Boolean))];
 return [c.programmeId,periodLabel(c.periods,termOnly),source?.level,...context].filter(Boolean).join(' · ');
};
const taskPlacement = task => slots[task.period] || retakeWindows[task.period] || 'Egen placering';
const loadText = load => {
 const known = hp(load.hp)+' hp'+(load.manual?' uppsk.':'');
 return load.unknown ? (load.hp?known+' · ':'')+'Fördelning ej verifierad ('+load.unknown+' kurser)' : known;
};

export function createPlanningSnapshot({record,scenarios,courses,catalog,year=null,term='',name='',options={}}) {
 const settings = normalizedExportSettings(options);
 const detail = settings.documentMode === 'detail';
 const title = settings.documentTitle === 'Studieplanering' ? (detail?'Detaljerat planeringsunderlag':'Studieplan – översikt') : settings.documentTitle;
 const programme = catalog.programmes.find(p=>p.id===record.programmeId);
 const scope = year===null?'Hela planen':term ? (term==='HT'?'Hösttermin '+year:'Vårtermin '+(year+1)) : 'Läsår '+yearText(year);
 const documentInfo = [
  ...(settings.includeStudent && name.trim()?['Student: '+name.trim().slice(0,120)]:[]),
  ['Program: '+(programme ? programme.name+' ('+programme.code+')' : record.programmeId || 'Ej valt'),
   record.admissionYear?'Antagningsår: '+record.admissionYear:'',
   record.studyYear?'Årskurs: '+record.studyYear:'','Planeringsläsår: '+yearText(record.planningYear)].filter(Boolean).join('  ·  '),
  'Omfattning: '+scope
 ];
 const blocks = [];
 const summaries = [];
 for (const scenario of scenarios) {
  const all = scenarioCourses(courses,record,scenario);
  const summary = summarizePlan(all,scenario,record,year,term);
  summaries.push({name:scenario.name,total:summary.total,done:summary.done,remaining:summary.remaining,
   retakes:summary.remainingRetakes,completions:summary.remainingCompletions});
  blocks.push({kind:'scenario',text:scenario.name},headingBlock('Planerade kurser'));
  const ordered = [...summary.courses].sort((a,b)=>a.plannedYear-b.plannedYear || a.start.localeCompare(b.start) || a.title.localeCompare(b.title,'sv'));
  const courseRows = ordered.map(c=>[c.code || 'Egen kurs',c.title,hp(c.credits),yearText(c.plannedYear),
   plannedLabel(c.plannedPeriods)+'\n'+placementLabel(c,record),courseStates[c.status]]);
  blocks.push(tableBlock(['Kod','Kursnamn','HP','Läsår','Placering','Status'],[54,143,27,52,112,58],
   courseRows.length?courseRows:[['','Inga kurser i vald omfattning.','','','','']]));
  blocks.push(headingBlock('Sammanställning'),
   paragraphBlock(hp(summary.total)+(term?' hp fördelade i terminen · ':' hp i planen · ')+hp(summary.done)+' hp avklarat · '+hp(summary.remaining)+' hp återstår.'),
   ...(summary.unknown?[paragraphBlock(summary.unknown+' kurser saknar verifierad terminsfördelning.')]:[]),
   ...(summary.unassignedDone?[paragraphBlock('Avklarade delpoäng utan terminsfördelning visas i läsårsöversikten.')]:[]),
   paragraphBlock('Avklarat enligt planeringen. Uppgifterna behöver kontrolleras i Ladok.'),
   paragraphBlock(summary.remainingRetakes+' omtentamina att följa upp · '+summary.remainingCompletions+' kvarstående kompletteringar.'));
  if (detail) {
   blocks.push(headingBlock('Belastning per termin och period'));
   const rows = summary.byYear.flatMap(row=>{
    const visible = term ? (term==='HT'?planSlots(record,row.year).slice(0,planSlots(record,row.year).length/2):planSlots(record,row.year).slice(planSlots(record,row.year).length/2)) : Object.keys(row.slots);
    return [[yearText(row.year),term?'Fördelade poäng i terminen':'Unika kurspoäng hela läsåret',hp(term?summary.total:row.total)+' hp'],
     ...(!term?[['', 'Hösttermin · känd belastning',loadText(row.HT)],['','Vårtermin · känd belastning',loadText(row.VT)]]:[]),
     ...visible.map(p=>['',slots[p],loadText(row.slots[p])])];
   });
   blocks.push(tableBlock(['Läsår','Omfattning','Planerad belastning'],[64,210,110],rows),
    paragraphBlock('Periodpoängen visar kända planeringsandelar. Uppsk. anger manuell fördelning. Ofördelad omfattning ligger kvar i kurstotalen.'));
   if (ordered.length && (settings.includeRate || settings.includePeriods || settings.includeDates || settings.includeMonths)) {
    blocks.push(headingBlock('Kursuppgifter och underlag för placering'));
    const labels = ['Kod och kurs'];
    const weights = [100];
    if (settings.includePeriods) { labels.push('Officiell placering'); weights.push(122); }
    if (settings.includeDates || settings.includeMonths) { labels.push(settings.includeDates?'Planeringsdatum':'Planeringsmånader'); weights.push(90); }
    if (settings.includeRate) { labels.push('Studietakt'); weights.push(100); }
    blocks.push(tableBlock(labels,weights,ordered.map(c=>{
     const official = catalog.courses.find(x=>x.code===c.code);
     return [c.code || c.title,...(settings.includePeriods?[sourcePlacementText(c,official)]:[]),
      ...(settings.includeDates||settings.includeMonths?[
       c.useOwnDates ? (settings.includeDates?c.start+' – '+c.end:c.start.slice(0,7)+' – '+c.end.slice(0,7)) : 'Enligt vald period. Kontrollera kursdatum.']:[]),
      ...(settings.includeRate?[rateDescription(c)]:[])];
    })));
   }
  }
  if (summary.retakes.length) blocks.push(headingBlock('Omtentamina'),tableBlock(
   ['Kurs','Placering','Datum','Status','Följ upp anmälan'],[64,140,65,92,80],
   summary.retakes.map(t=>[taskCourseCode(t,all),yearText(t.year)+' · '+taskPlacement(t),t.date || 'Ej angivet',examStates[t.status],t.reminder || '–'])));
  if (summary.completions.length) blocks.push(headingBlock('Kompletteringar'),tableBlock(
   ['Kurs','Typ och moment','Placering','Datum','Status'],[52,149,105,58,94],
   summary.completions.map(t=>[taskCourseCode(t,all),completionTypes[t.type]+'\n'+t.description,yearText(t.year)+' · '+taskPlacement(t),t.date || 'Ej angivet',completionStates[t.status]])));
  if (detail && settings.includeNotes) {
   for (const t of [...summary.retakes,...summary.completions].filter(t=>t.note)) blocks.push(paragraphBlock(taskCourseCode(t,all)+' · '+t.note));
  }
  blocks.push(headingBlock('Det här behöver kontrolleras'));
  const checks = summary.warnings.map(w=>w.kind+' · '+w.text);
  if (summary.courses.length || summary.retakes.length) checks.push('Kontrollera kurstillfällen, datum och schema i TimeEdit. Omtentamensfönster är planeringsunderlag.');
  if (checks.length) blocks.push(...checks.map(paragraphBlock));
  else blocks.push(paragraphBlock('Inga granskningspunkter för vald omfattning.'));
  if (settings.includeNotes) {
   if (detail && scenario.agenda) blocks.push(headingBlock('Syfte och agenda'),paragraphBlock(scenario.agenda));
   if (scenario.agreements || scenario.steps.length) {
    blocks.push(headingBlock('Överenskommelser och nästa steg'));
    if (scenario.agreements) blocks.push(paragraphBlock(scenario.agreements));
    if (scenario.steps.length) blocks.push(tableBlock(['Uppgift','Ansvar','Datum','Status'],[190,63,65,75],
     scenario.steps.map(t=>[t.task,roles[t.role],t.date || '–',stepStates[t.status]])));
   }
   if (detail) {
    const notes = Object.entries(scenario.periodNotes).filter(([key])=>{
     const [y,p] = key.split(':');
     const plan = summary.byYear.find(row=>row.year===Number(y));
     return plan && (!term || (term==='HT'?['HT','1','2']:['VT','3','4']).includes(p));
    });
    if (notes.length) blocks.push(headingBlock('Periodanteckningar'),...notes.map(([key,value])=>{
     const [y,p] = key.split(':');
     return paragraphBlock(yearText(Number(y))+' · '+slots[p]+'\n'+value);
    }));
    for (const c of ordered.filter(c=>c.note)) blocks.push(paragraphBlock((c.code || c.title)+' · '+c.note));
   }
  }
  if (detail && settings.includeSources) {
   const sourced = ordered.filter(c=>c.catalogYear).map(c=>{
    const official = catalog.courses.find(x=>x.code===c.code);
    const offers = official?.offerings.filter(o=>o.programmeId===c.programmeId && (!c.offeringId || o.sourceId===c.offeringId)) || [];
    const annotations = [...new Set(offers.map(o=>o.footnote).filter(Boolean))];
    return [c.code, [official?.syllabusUrl,...annotations].filter(Boolean).join('\n')];
   });
   if (sourced.length) blocks.push(headingBlock('Kursplaner och fotnoter'),tableBlock(['Kurs','Officiellt underlag'],[56,360],sourced));
  }
 }
 blocks.push(headingBlock('Källor och användning'),
  paragraphBlock('LTH:s läro- och timplan '+catalog.academicYearLabel+' · hämtad '+catalog.fetchedAt.slice(0,10)+'.\n'+catalog.sourceUrl),
  paragraphBlock('LTH:s läsårsindelning\n'+calendarSource),
  ...(detail && settings.includeSources?[paragraphBlock(calendarDecision)]:[]),
  paragraphBlock('Planeringsunderlaget är preliminärt. Kontrollera utbildningsplan, behörighet, examen, studiemedel och schema hos respektive ansvarig.'));
 return {title,settings,documentInfo,blocks,summaries};
}

function taskCourseCode(task,courses) {
 const c = courses.find(c=>c.id===task.courseId);
 return c?.code || c?.title || task.code || 'Ej kurskopplad';
}
