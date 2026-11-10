import { normalizedExportSettings } from './export-settings.js';
import { calendarSource, calendarDecision, calendarDecision2027, programmeStructure } from './lth-calendar.js';
import { periodLabel, choiceLabels } from './program-catalog.js';
import { hp, yearText, slots, examStates, completionStates, completionTypes, courseStates, stepStates, roles, priorities, retakeWindows, rateDescription, plannedLabel, placementLabel, scenarioCourses, summarizePlan, planSlots, scopeTitle, sortPlannedCourses } from './planning.js';

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

export function createPlanningSnapshot({record,scenarios,courses,catalog,year=null,term='',slot='',actionsOnly=false,includeActionPlan=false,name='',options={}}) {
 const settings = normalizedExportSettings(options);
 const detail = settings.documentMode === 'detail';
 const title = settings.documentTitle;
 const programme = catalog.programmes.find(p=>p.id===record.programmeId);
 const scope = actionsOnly?'Mål och handlingsplan':scopeTitle(year,term,slot);
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
  const summary = summarizePlan(actionsOnly?[]:all,scenario,record,actionsOnly?null:year,actionsOnly?'':term,actionsOnly?'':slot);
  const actions = actionsOnly || includeActionPlan;
  const exams = actions ? scenario.retakes : summary.retakes;
  const completions = actions ? scenario.completions : summary.completions;
  const retakesOpen = exams.filter(t=>!['passed','cancelled'].includes(t.status)).length;
  const completionsOpen = completions.filter(t=>t.status!=='passed').length;
  summaries.push({name:scenario.name,total:summary.total,done:summary.done,remaining:summary.remaining,
   retakes:retakesOpen,completions:completionsOpen});
  blocks.push({kind:'scenario',text:scenario.name});
  const ordered = sortPlannedCourses(summary.courses,catalog);
  if (ordered.length) {
  blocks.push(headingBlock('Studieplan'));
  const courseRows = ordered.map(c=>[c.code || 'Egen kurs',c.title,hp(c.credits),yearText(c.plannedYear),
   plannedLabel(c.plannedPeriods)+'\n'+placementLabel(c,record),courseStates[c.status]]);
  blocks.push(tableBlock(['Kod','Kursnamn','Kursens hp','Läsår','Placering','Status'],[54,143,46,52,112,58],courseRows));
  blocks.push(headingBlock('Sammanställning'),
   paragraphBlock(hp(summary.total)+(term||slot?' hp med känd fördelning i tidsramen · ':' hp i planen · ')+hp(summary.done)+' hp avklarat · '+hp(summary.remaining)+' hp återstår.'),
   ...(summary.benchmark?[paragraphBlock('Riktmärke vid heltidsstudier: '+(slot?'cirka ':'')+summary.benchmark+' hp.')]:[]),
   ...(summary.unknown?[paragraphBlock(summary.unknown+' '+(summary.unknown===1?'kurs':'kurser')+' saknar verifierad poängfördelning i tidsramen. Kursraden visar kursens totala poäng.')]:[]),
   ...(summary.unassignedDone?[paragraphBlock('Avklarade delpoäng utan fördelning visas i läsårsöversikten.')]:[]),
   paragraphBlock('Avklarat enligt planeringen. Uppgifterna behöver kontrolleras i Ladok.'),
   paragraphBlock(retakesOpen+' '+(retakesOpen===1?'omtentamen':'omtentamina')+' att följa upp · '+completionsOpen+' kvarstående '+(completionsOpen===1?'komplettering':'kompletteringar')+'.'));
  if (detail) {
   blocks.push(headingBlock('Belastning per termin och period'));
   const rows = summary.byYear.flatMap(row=>{
    const visible = slot?[slot]:term ? (term==='HT'?planSlots(record,row.year).slice(0,planSlots(record,row.year).length/2):planSlots(record,row.year).slice(planSlots(record,row.year).length/2)) : Object.keys(row.slots);
    return [[yearText(row.year),term||slot?'Fördelade poäng i tidsramen':'Unika kurspoäng hela läsåret',hp(term||slot?summary.total:row.total)+' hp'],
     ...(!term&&!slot?[['', 'Hösttermin · känd belastning',loadText(row.HT)],['','Vårtermin · känd belastning',loadText(row.VT)]]:[]),
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
  }
  if (exams.length || completions.length) blocks.push(headingBlock('Kvarstående examinationer och uppföljning'));
  if (exams.length) blocks.push(headingBlock('Omtentamina'),tableBlock(
   ['Kurs','Placering','Datum','Status','Följ upp anmälan'],[64,140,65,92,80],
   exams.map(t=>[taskCourseCode(t,all),yearText(t.year)+' · '+taskPlacement(t),t.date || 'Ej angivet',taskStatus(t,examStates),t.reminder || '–'])));
  if (completions.length) blocks.push(headingBlock('Kompletteringar'),tableBlock(
   ['Kurs','Typ och moment','Placering','Datum','Status'],[52,149,105,58,94],
   completions.map(t=>[taskCourseCode(t,all),completionTypes[t.type]+'\n'+t.description,yearText(t.year)+' · '+taskPlacement(t),t.date || 'Ej angivet',taskStatus(t,completionStates)])));
  if (detail && settings.includeNotes) {
   for (const t of [...exams,...completions].filter(t=>t.note)) blocks.push(paragraphBlock(taskCourseCode(t,all)+' · '+t.note));
  }
  if (actions && scenario.goal && Object.values(scenario.goal).some(Boolean)) {
   const {text,date,horizon} = scenario.goal;
   blocks.push(headingBlock('Mål och handlingsplan'));
   if (text) blocks.push(paragraphBlock(text));
   if (date || horizon) blocks.push(paragraphBlock([date?'Måldatum: '+date:'',horizon?'Planeringshorisont: '+horizon:''].filter(Boolean).join(' · ')));
  }
  if (actions && scenario.steps.length) blocks.push(headingBlock('Nästa steg och uppföljning'),tableBlock(['Uppgift','Ansvar','Tid','Status'],[170,64,100,78],
   scenario.steps.map(t=>[[t.task,t.courseId||t.code?taskCourseCode(t,all):''].filter(Boolean).join('\n'),roles[t.role],
    [t.date,t.period?yearText(t.year)+' · '+slots[t.period]:''].filter(Boolean).join('\n') || '–',
    [stepStates[t.status],t.priority&&t.priority!=='normal'?priorities[t.priority]+' prioritet':''].filter(Boolean).join('\n')])));
  const checks = summary.warnings.map(w=>w.kind+' · '+w.text);
  if (ordered.length || exams.length) checks.push('Kontrollera kurstillfällen, datum och schema i TimeEdit. Omtentamensfönster är planeringsunderlag.');
  if (checks.length) blocks.push(headingBlock('Det här behöver kontrolleras'),...checks.map(paragraphBlock));
  if (settings.includeNotes) {
   if ((detail || actions) && scenario.agenda) blocks.push(headingBlock('Syfte och agenda'),paragraphBlock(scenario.agenda));
   if (scenario.agreements) blocks.push(headingBlock('Planeringsöverenskommelser'),paragraphBlock(scenario.agreements));
   if (detail && !actionsOnly) {
    const notes = Object.entries(scenario.periodNotes).filter(([key])=>{
     const [y,p] = key.split(':');
     const plan = summary.byYear.find(row=>row.year===Number(y));
     return plan && (!slot || slot===p) && (!term || (term==='HT'?['HT','1','2']:['VT','3','4']).includes(p));
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
  ...(detail && settings.includeSources?[...(year!==2027?[paragraphBlock(calendarDecision)]:[]),...(year===null||year===2027?[paragraphBlock(calendarDecision2027)]:[])]:[]),
  paragraphBlock('Detta är ett planeringsunderlag. Behörighet, Ladokuppgifter och studiemedel kontrolleras hos respektive ansvarig.'));
 return {title,settings,documentInfo,blocks,summaries};
}

function taskStatus(task,states) {
 return [states[task.status],roles[task.role],task.priority!=='normal'?priorities[task.priority]:null].filter(Boolean).join(' · ');
}

function taskCourseCode(task,courses) {
 const c = courses.find(c=>c.id===task.courseId);
 return c?.code || c?.title || task.code || '–';
}
