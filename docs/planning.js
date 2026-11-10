import { officialCalendar, programmeStructure } from './lth-calendar.js';
import { compareOfferingMetadata, offeringTimePlans, periodLabel } from './program-catalog.js';
import { academicLabel, monthEnd } from './model.js';

export const slots = { 1:'LP1', 2:'LP2', 3:'LP3', 4:'LP4', HT:'Hösttermin', VT:'Vårtermin', SUMMER:'Sommar', OWN:'Egen placering' };
export const examStates = { planned:'Planerad', registered:'Anmäld', sat:'Genomförd', awaiting:'Resultat inväntas', passed:'Avklarad', cancelled:'Avbokad' };
export const completionStates = { todo:'Ej påbörjad', progress:'Pågår', submitted:'Inlämnad', awaiting:'Inväntar bedömning', passed:'Godkänd', redo:'Behöver göras om' };
export const completionTypes = { assignment:'Inlämningsuppgift', lab:'Laboration', project:'Projekt', presentation:'Redovisning', other:'Annan examination' };
export const roles = { student:'Student', advisor:'Vägledare', other:'Annat' };
export const priorities = { normal:'Normal', high:'Hög', low:'Låg' };
export const horizons = { period:'Läsperiod', term:'Termin', year:'Läsår' };
export const stepStates = { todo:'Planerad', progress:'Pågår', done:'Klar' };
export const taskKinds = ['retakes','completions','steps'];
export const courseStates = { planned:'Planerad', progress:'Pågår', done:'Avklarad', summer:'Sommarstudier' };
export const retakeWindows = { TP4:'Omtentamensperiod I · Tp4', TP6:'Omtentamensperiod II · Tp6', OWN:'Eget tillfälle' };

export const yearOf = start => Number(academicLabel(start).split('/')[0]);
export const yearText = start => start + '/' + (start+1);
export const hp = value => Number(value.toFixed(4)).toLocaleString('sv-SE');
export const isPlanYear = n => Number.isInteger(n) && n >= 1950 && n <= 2100;
export const isPlanId = value => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);
export const hasKey = (record,key) => Object.hasOwn(record,key);
const slotOrder = Object.keys(slots);
const sumHp = values => Math.round(values.reduce((n,x)=>n+x,0)*10000)/10000;
const sameSlots = (a,b) => a.length === b.length && a.every((p,i)=>p === b[i]);
const daysBetween = (from,to) => (Date.parse(to)-Date.parse(from))/86400000+1;

function planText(value,max) {
 if (typeof value !== 'string' || value.length > max) throw Error('Ogiltigt textfält i planeringen.');
 return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim();
}
function optionalDate(value) {
 if (value === '') return value;
 const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value+'T12:00:00Z');
 if (!date || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0,10) !== value) throw Error('Ange ett giltigt datum.');
 return value;
}
function oneOf(record,key) {
 if (!hasKey(record,key)) throw Error('Ogiltigt val i planeringen.');
 return key;
}
function uniqueList(values,check) {
 if (!Array.isArray(values) || values.some(v=>!check(v)) || new Set(values).size !== values.length) throw Error('Ogiltig lista i planeringen.');
 return values;
}
function checkedPlanYear(value) {
 if (!isPlanYear(value)) throw Error('Ange ett läsår mellan 1950 och 2100.');
 return value;
}

export function initialScenario(id, year, agreements = '', name = 'Nuvarande plan') {
 return {id,name,years:[year],agenda:'',agreements,periodNotes:{},retakes:[],completions:[],steps:[]};
}

export function validatePlacement(input, credits) {
 const plannedYear = checkedPlanYear(input.plannedYear);
 const plannedPeriods = [...uniqueList(input.plannedPeriods,p=>typeof p==='string' && hasKey(slots,p))]
  .sort((a,b)=>slotOrder.indexOf(a)-slotOrder.indexOf(b));
 if (!plannedPeriods.length || (plannedPeriods.includes('OWN') && plannedPeriods.length!==1) ||
     (plannedPeriods.some(p=>/^\d$/.test(p)) && plannedPeriods.some(p=>['HT','VT'].includes(p)))) {
  throw Error('Välj en eller flera läsperioder, terminer eller en egen placering.');
 }
 const allocation = input.allocation ?? [];
 if (!Array.isArray(allocation) || allocation.some(p=>!plannedPeriods.includes(p?.slot) || !Number.isFinite(p.hp) || p.hp<0 || p.hp>credits) ||
     new Set(allocation.map(p=>p.slot)).size!==allocation.length ||
     (allocation.length && (allocation.length!==plannedPeriods.length || Math.abs(sumHp(allocation.map(p=>p.hp))-credits)>0.00005))) {
  throw Error('Ange poäng för alla valda perioder. Summan måste motsvara kursens högskolepoäng.');
 }
 const periodRates = input.periodRates ?? [];
 if (!Array.isArray(periodRates) || periodRates.some(p=>!plannedPeriods.includes(p?.slot) || !Number.isFinite(p.rate) || p.rate<1 || p.rate>400) ||
     new Set(periodRates.map(p=>p.slot)).size!==periodRates.length) throw Error('Ange 1–400 procent för vald period.');
 const weeks = input.weeks ?? null;
 if (weeks !== null && (!Number.isFinite(weeks) || weeks<0.1 || weeks>260)) throw Error('Ange 0,1–260 faktiskt planerade veckor.');
 if (typeof input.useOwnDates !== 'boolean' || (plannedPeriods.includes('OWN') && !input.useOwnDates)) throw Error('Ogiltigt val av planeringsdatum.');
 return {plannedYear,plannedPeriods,allocation:allocation.map(p=>({slot:p.slot,hp:p.hp})),weeks,periodRates:periodRates.map(p=>({slot:p.slot,rate:p.rate})),useOwnDates:input.useOwnDates};
}

export function validateTask(input, kind) {
 if (!isPlanId(input.id)) throw Error('Ogiltigt ID för moment.');
 if (kind === 'steps') {
  const task = planText(input.task,240);
  if (!task) throw Error('Ange ett nästa steg.');
  const result = {id:input.id,task,role:oneOf(roles,input.role),date:optionalDate(input.date),status:oneOf(stepStates,input.status)};
  if (input.courseId) {
   if (!isPlanId(input.courseId)) throw Error('Ogiltig kurskoppling.');
   result.courseId = input.courseId;
  }
  if (input.code) result.code = planText(input.code,40).toUpperCase();
  if (input.period) {
   result.year = checkedPlanYear(input.year);
   result.period = oneOf(slots,input.period);
  }
  if (input.priority) result.priority = oneOf(priorities,input.priority);
  return result;
 }
 const isRetake = kind === 'retakes';
 const task = {id:input.id,courseId:input.courseId === null ? null : input.courseId,
  code:planText(input.code,40).toUpperCase(),year:checkedPlanYear(input.year),date:optionalDate(input.date),
  note:planText(input.note,500),status:oneOf(isRetake ? examStates : completionStates,input.status)};
 if (input.role) task.role = oneOf(roles,input.role);
 if (input.priority) task.priority = oneOf(priorities,input.priority);
 if (task.courseId !== null && !isPlanId(task.courseId)) throw Error('Ogiltig kurskoppling.');
 if (isRetake) return {...task,period:oneOf(retakeWindows,input.period),reminder:optionalDate(input.reminder)};
 const description = planText(input.description,240);
 if (!description) throw Error('Beskriv vad som saknas.');
 const period = ['TP4','TP6'].includes(input.period) ? input.period : oneOf(slots,input.period);
 return {...task,period,type:oneOf(completionTypes,input.type),description};
}

export function validateScenario(input) {
 if (!isPlanId(input.id)) throw Error('Ogiltigt scenario.');
 const name = planText(input.name,80);
 if (!name) throw Error('Ange ett namn för scenariot.');
 const years = [...uniqueList(input.years,isPlanYear)].sort((a,b)=>a-b);
 if (!years.length) throw Error('Lägg till minst ett läsår.');
 if (!input.periodNotes || typeof input.periodNotes!=='object' || Array.isArray(input.periodNotes)) throw Error('Ogiltiga periodanteckningar.');
 const periodNotes = {};
 for (const [key,value] of Object.entries(input.periodNotes)) {
  const [year,slot] = key.split(':');
  if (key !== year+':'+slot || !years.includes(Number(year)) || !hasKey(slots,slot)) throw Error('Ogiltig periodanteckning.');
  periodNotes[key] = planText(value,500);
 }
 const result = {id:input.id,name,years,agenda:planText(input.agenda,1000),agreements:planText(input.agreements,1000),periodNotes};
 if (input.goal) result.goal = {text:planText(input.goal.text,500),date:optionalDate(input.goal.date),horizon:planText(input.goal.horizon,120)};
 if (input.view) {
  const {year,slot,horizon,focus} = input.view;
  if (!years.includes(year) || !/^(?:[1-4]|HT|VT)$/.test(slot) || !hasKey(horizons,horizon) || !['courses','actions'].includes(focus)) throw Error('Ogiltig planeringsvy.');
  result.view = {year,slot,horizon,focus};
 }
 const ids = new Set();
 for (const kind of taskKinds) {
  if (!Array.isArray(input[kind])) throw Error('Ogiltiga moment eller nästa steg.');
  result[kind] = input[kind].map(item=>{
   const validated = validateTask(item,kind);
   if (ids.has(validated.id) || (validated.year!==undefined && !years.includes(validated.year))) throw Error('Dubblett eller okänt läsår.');
   ids.add(validated.id);
   return validated;
  });
 }
 return result;
}

export const scenarioFor = record => record?.scenarios.find(s=>s.id===record.activeScenarioId);
export const scenarioCourses = (courses, record, scenario) => courses.filter(c=>c.caseId===record.id && c.scenarioId===scenario.id);

export function sourcePlacements(course, record, year) {
 if (!course?.catalogYear || course.catalogYear !== String(year).slice(-2)+'_'+String(year+1).slice(-2) ||
     course.programmeId !== record.programmeId || !course.programmeId) return [];
 const termOnly = programmeStructure(record.programmeId,course.catalogYear).periods === 'terms';
 const all = offeringTimePlans({timePlans:course.timePlans,periods:course.periods||[]});
 const choices = all.map(list=>[...new Set(list.map(n=>termOnly ? (n<=2?'HT':'VT') : String(n)))]);
 return choices.filter((list,i)=>list.length && choices.findIndex(other=>sameSlots(list,other))===i);
}

export function planSlots(record, year) {
 const ay = String(year).slice(-2)+'_'+String(year+1).slice(-2);
 const configured = programmeStructure(record.programmeId,ay);
 const latest = programmeStructure(record.programmeId,'26_27');
 return (configured.periods === 'terms' || (configured.periods === 'unknown' && latest.periods === 'terms'))
  ? ['HT','VT'] : ['1','2','3','4'];
}

export function datesForSlots(record, year, periods) {
 const calendar = officialCalendar(year,record.programmeId,record.planningYear===year ? record.studyYear : null);
 if (!calendar) return [];
 return periods.flatMap(p=> {
  if (p === 'HT') return [calendar.autumn];
  if (p === 'VT') return [calendar.spring];
  return calendar.teaching?.[p] || [];
 });
}

export function planningDates(record, year, periods) {
 const intervals = datesForSlots(record,year,periods);
 if (intervals.length && periods.every(p=>datesForSlots(record,year,[p]).length)) {
  return [intervals.map(i=>i[0]).sort()[0],intervals.map(i=>i[1]).sort().at(-1)];
 }
 const month = year+'-08';
 return [month+'-01',monthEnd(month)];
}

export function plannedLabel(periods) {
 const ordered = periods.map(Number);
 return ordered.every(Number.isFinite) ? periodLabel(ordered) : periods.map(p=>slots[p]).join(' + ');
}

export function placementLabel(course, record) {
 if (!course.catalogYear) return 'Manuellt tillagd';
 if (course.offeringActive===false) return 'Behöver kontrolleras – aktivt kurstillfälle ej verifierat';
 const matched = sourcePlacements(course,record,course.plannedYear).some(p=>sameSlots(p,course.plannedPeriods));
 if (!matched || course.useOwnDates) return 'Eget planeringsval – kontrollera kurstillfälle';
 return 'Följer LoT:s perioduppgift';
}

export function estimatedRate(course) {
 if (course.studyRate) return {value:course.studyRate,label:'Angiven studietakt'};
 if (course.weeks) return {value:Math.round(course.credits / (course.weeks * 1.5) * 100),label:'Uppskattad från angivna veckor'};
 return {value:null,label:'Går inte att uppskatta säkert'};
}

export function rateDescription(course) {
 const rate = estimatedRate(course);
 const overall = rate.value===null?rate.label:rate.value+' % · '+rate.label;
 return [overall,...(course.periodRates || []).map(p=>slots[p.slot]+' '+p.rate+' % (angiven)')].join(' · ');
}

export function termSlots(slotsInYear, term) {
 return term === 'HT' ? slotsInYear.slice(0,slotsInYear.length/2) : slotsInYear.slice(slotsInYear.length/2);
}

export const termForSlot = slot => ['1','2','HT'].includes(slot) ? 'HT' : 'VT';
export const fullTimeBenchmark = (term = '', slot = '') => slot ? 15 : term ? 30 : 60;
export const scopeTitle = (year, term = '', slot = '') => year===null?'Hela planen':
 slot ? slots[slot]+' · '+(termForSlot(slot)==='HT'?'HT '+year:'VT '+(year+1)) :
 term ? (term==='HT'?'Hösttermin '+year:'Vårtermin '+(year+1)) : 'Läsår '+yearText(year);

export function scenarioView(record,scenario) {
 const saved = scenario.view;
 const year = saved?.year ?? (scenario.years.includes(record.planningYear)?record.planningYear:scenario.years[0]);
 const allowed = planSlots(record,year);
 const slot = allowed.includes(saved?.slot) ? saved.slot : allowed.find(p=>termForSlot(p)===termForSlot(saved?.slot || 'HT'));
 const horizon = saved?.horizon ?? 'year';
 return {year,slot,horizon:horizon==='period' && allowed.length===2?'term':horizon,focus:saved?.focus ?? 'courses'};
}

export function viewScope(view) {
 return {year:view.year,term:view.horizon==='term'?termForSlot(view.slot):'',slot:view.horizon==='period'?view.slot:''};
}

export function sortPlannedCourses(courses,catalog) {
 const periodRank = {1:1,2:2,3:3,4:4,HT:1,VT:3,SUMMER:5,OWN:6};
 const rank = course => (course.catalogYear ? offeringTimePlans({timePlans:course.timePlans,periods:course.periods||[]})[0] : course.plannedPeriods).map(p=>periodRank[p]??7).sort((a,b)=>a-b);
 const offers = new Map(courses.map(c=>[c.id,catalog?.courses.find(source=>source.code===c.code)?.offerings.find(o=>
  o.programmeId===c.programmeId && (!c.offeringId || o.sourceId===c.offeringId)) || {}]));
 return [...courses].sort((a,b)=>{
  const x = rank(a), y = rank(b);
  return a.plannedYear-b.plannedYear || (x[0]??7)-(y[0]??7) || (x[1]??x[0]??7)-(y[1]??y[0]??7) ||
   compareOfferingMetadata(offers.get(a.id),offers.get(b.id)) || a.code.localeCompare(b.code,'sv') || a.title.localeCompare(b.title,'sv');
 });
}

function termDates(record,year,term) {
 const cal = officialCalendar(year,record.programmeId,record.planningYear===year?record.studyYear:null);
 return term==='HT' ? cal?.autumn || [year+'-08-01',year+'-12-31'] : cal?.spring || [(year+1)+'-01-01',(year+1)+'-06-30'];
}
function courseTerms(course,record,year) {
 if (course.plannedPeriods.includes('OWN')) {
  return ['HT','VT'].filter(term=>{
   const [start,end] = termDates(record,year,term);
   return course.start<=end && course.end>=start;
  });
 }
 return ['HT','VT'].filter(term=>{
  const allowed = [...termSlots(planSlots(record,year),term),term];
  return course.plannedPeriods.some(p=>allowed.includes(p));
 });
}
export function scopePlan(courses, scenario, year = null, term = '', record = null, slot = '') {
 const allowed = term && record ? [...termSlots(planSlots(record,year),term),term] : null;
 const intervals = slot && record ? datesForSlots(record,year,[slot]) : [];
 const overlapsSlot = c => intervals.some(([start,end])=>c.start<=end && c.end>=start);
 const selected = courses.filter(c=>(year===null || c.plannedYear===year) &&
  (!allowed || courseTerms(c,record,year).includes(term)) && (!slot || c.plannedPeriods.includes(slot) ||
   (c.plannedPeriods.includes('OWN') && overlapsSlot(c))));
 const selectedIds = new Set(selected.map(c=>c.id));
 const within = task => {
  if (year===null) return true;
  if (task.year!==year) return false;
  if (slot) return task.period===slot || (task.period==='TP4' && slot==='4') ||
   (['OWN',termForSlot(slot)].includes(task.period) && (task.date?intervals.some(([a,b])=>task.date>=a && task.date<=b):
    task.period==='OWN' && selectedIds.has(task.courseId)));
  return !allowed || allowed.includes(task.period) || (term==='VT' && task.period==='TP4') ||
   (task.period==='OWN' && (!task.date || (task.date>=termDates(record,year,term)[0] && task.date<=termDates(record,year,term)[1])));
 };
 return {courses:selected,retakes:scenario.retakes.filter(within),completions:scenario.completions.filter(within)};
}

const courseDone = c => c.status==='done' ? c.credits : Math.min(c.credits,c.completedCredits || 0);
function distribution(c,allowed) {
 if (c.allocation.length) return {value:sumHp(c.allocation.filter(a=>allowed.includes(a.slot)).map(a=>a.hp)),unknown:false,manual:true};
 const count = c.plannedPeriods.filter(p=>allowed.includes(p)).length;
 return {value:count===c.plannedPeriods.length ? c.credits : 0,unknown:count>0 && count<c.plannedPeriods.length,manual:false};
}

export function summarizePlan(courses, scenario, record, year = null, term = '', slot = '') {
 const scoped = scopePlan(courses,scenario,year,term,record,slot);
 const unique = [...new Map(scoped.courses.map(c=>[c.id,c])).values()];
 const portion = (course,selectedTerm,selectedSlot) => {
  if (selectedSlot) {
   if (!course.plannedPeriods.includes('OWN')) return distribution(course,[selectedSlot]);
   const dates = datesForSlots(record,course.plannedYear,[selectedSlot]);
   const contained = dates.some(([a,b])=>course.start>=a && course.end<=b);
   return {value:contained?course.credits:0,unknown:!contained,manual:false};
  }
  if (!selectedTerm) return {value:course.credits,unknown:false,manual:false};
  const terms = courseTerms(course,record,course.plannedYear);
  if (course.plannedPeriods.includes('OWN')) return {value:terms.length===1 && terms.includes(selectedTerm)?course.credits:0,unknown:terms.length>1,manual:false};
  return distribution(course,[...termSlots(planSlots(record,course.plannedYear),selectedTerm),selectedTerm]);
 };
 const total = sumHp(unique.map(c=>portion(c,term,slot).value));
 const done = sumHp(unique.map(c=>{
  const part = portion(c,term,slot);
  if ((!term && !slot) || (!part.unknown && part.value===c.credits)) return courseDone(c);
  return c.status==='done' ? part.value : 0;
 }));
 const unknown = unique.filter(c=>portion(c,term,slot).unknown).length;
 const unassignedDone = Boolean((term || slot) && unique.some(c=>c.status!=='done' && c.completedCredits>0 && portion(c,term,slot).value!==c.credits));
 const remainingRetakes = scoped.retakes.filter(t=>!['passed','cancelled'].includes(t.status)).length;
 const remainingCompletions = scoped.completions.filter(t=>t.status!=='passed').length;
 const byYear = (year===null ? scenario.years : [year]).map(y=>{
  const list = unique.filter(c=>c.plannedYear===y);
  const officialSlots = planSlots(record,y);
  const load = (selected,termKey) => {
   const values = list.map(c=>termKey?portion(c,termKey):distribution(c,selected));
   const interval = datesForSlots(record,y,selected);
   const weeks = interval.reduce((n,[a,b])=>n+daysBetween(a,b)/7,0);
   return {hp:sumHp(values.map(v=>v.value)),unknown:values.filter(v=>v.unknown).length,
    manual:values.some(v=>v.manual),weeks};
  };
  return {year:y,courseCount:list.length,total:sumHp(list.map(c=>c.credits)),done:sumHp(list.map(courseDone)),
   rateCount:list.filter(c=>estimatedRate(c).value!==null || c.periodRates?.length).length,
   slots:Object.fromEntries([...officialSlots,'SUMMER','OWN'].map(p=>[p,load([p])])),
   HT:load([...termSlots(officialSlots,'HT'),'HT'],'HT'), VT:load([...termSlots(officialSlots,'VT'),'VT'],'VT')};
 });
 const warnings = [];
 const courseNames = list => list.map(c=>c.code || c.title).join(', ');
 const moved = unique.filter(c=>c.catalogYear && placementLabel(c,record)!=='Följer LoT:s perioduppgift');
 if (moved.length) warnings.push({kind:'Behöver kontrolleras',text:'Kontrollera kurstillfälle och egen placering för '+courseNames(moved)+'.'});
 const unallocated = unique.filter(c=>c.plannedPeriods.length>1 && !c.allocation.length);
 if (unallocated.length) warnings.push({kind:'Behöver kontrolleras',text:'Poängfördelning mellan perioder ej verifierad för '+courseNames(unallocated)+'.'});
 for (const t of scoped.retakes) {
  const calendar = officialCalendar(t.year,record.programmeId,record.planningYear===t.year?record.studyYear:null);
  const window = calendar?.exams?.[Number(t.period.slice(2))];
  if (t.period!=='OWN' && (!window || (t.date && (t.date<window[0] || t.date>window[1]))))
   warnings.push({kind:'Behöver kontrolleras',text:taskCourse(t,courses)+': kontrollera datum och omtentamensperiod.'});
 }
 for (const row of byYear) {
  if (row.courseCount && !officialCalendar(row.year,record.programmeId,null))
   warnings.push({kind:'Behöver kontrolleras',text:yearText(row.year)+': officiell kalender saknas i underlaget.'});
  const overlaps = planSlots(record,row.year).filter(slot=>unique.filter(c=>c.plannedYear===row.year && c.plannedPeriods.includes(slot)).length>=4);
  if (overlaps.length) warnings.push({kind:'Planeringsfråga',
   text:yearText(row.year)+' · '+plannedLabel(overlaps)+': minst fyra kurser berör samma period. Kontrollera arbetsbelastning och schema.'});
  if (row.HT.hp>30 || row.VT.hp>30)
   warnings.push({kind:'Planeringsfråga',text:yearText(row.year)+': den kända belastningen överstiger 30 hp i minst en termin. Kontrollera omfattning och överlapp.'});
 }
 if (remainingRetakes+remainingCompletions >= 3)
  warnings.push({kind:'Planeringsfråga',text:'Flera examinationer återstår. Kontrollera anmälan, tider och arbetsbelastning.'});
 return {...scoped,courses:unique,total,done,unknown,unassignedDone,remaining:sumHp([total,-done]),remainingRetakes,remainingCompletions,byYear,warnings,
  benchmark:year===null?null:fullTimeBenchmark(term,slot)};
}

export function taskCourse(task,courses) {
 const c = courses.find(c=>c.id===task.courseId);
 return c ? (c.code || c.title) : task.code || 'Ej kurskopplad';
}

export function copyScenario(original, courses, id, name, includeTasks, makeId) {
 const copied = courses.map(c=>({...structuredClone(c),id:makeId(),scenarioId:id}));
 const refs = new Map(courses.map((c,i)=>[c.id,copied[i].id]));
 const scenario = includeTasks ? structuredClone(original) : initialScenario(id,original.years[0], '', name);
 Object.assign(scenario,{id,name,years:[...original.years]});
 if (original.view) scenario.view = {...original.view};
 for (const kind of taskKinds) {
  scenario[kind] = scenario[kind].map(task=>({...task,id:makeId(),...('courseId' in task?{courseId:refs.get(task.courseId) || null}:{})}));
 }
 return {scenario,courses:copied};
}
