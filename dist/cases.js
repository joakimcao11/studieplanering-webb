import { validateCourse } from './model.js';
import { copyScenario, initialScenario, isPlanId, validatePlacement, validateScenario, yearOf } from './planning.js';

// Keep the same storage slot so upgrading or clearing a workspace cannot resurrect an older copy.
export const CASE_KEY = 'studieplan-v3';
export const LEGACY_KEY = 'studieplan-v1';
export const emptyWorkspace = () => ({ version: 4, cases: [], courses: [], activeCaseId: null, exportSettings: {} });
export const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');

const bounded = (value, max) => typeof value === 'string' && value.length <= max;
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const timestamp = value => bounded(value, 24) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function exportPreferences(settings) {
 const fields = ['includeStudent','includeContact','includeNotes','includeSources','includeRate','includeMonths','includePeriods','includeDates'];
 const prefs = Object.fromEntries(fields.filter(key => typeof settings?.[key] === 'boolean').map(key => [key, settings[key]]));
 if (['neutral','lth','lu','custom'].includes(settings?.template)) prefs.template = settings.template;
 if (['overview','detail'].includes(settings?.documentMode)) prefs.documentMode = settings.documentMode;
 if (['portrait','landscape'].includes(settings?.orientation)) prefs.orientation = settings.orientation;
 return prefs;
}

export function cleanCase(record) {
 const { id, createdAt, updatedAt, programmeId, admissionYear, studyYear, planningYear, targetCredits, note, alternative } = record;
 if (!isPlanId(id) || !timestamp(createdAt) || !timestamp(updatedAt) || updatedAt < createdAt ||
     !bounded(programmeId, 20) || !/^[A-Za-z0-9_]*$/.test(programmeId) ||
     !(admissionYear === null || integer(admissionYear, 1950, 2100)) ||
     !(studyYear === null || integer(studyYear, 1, 20)) || !integer(planningYear, 1950, 2100) ||
     !integer(targetCredits, 1, 1000) || !bounded(note, 1000) || typeof alternative !== 'boolean') {
  throw new Error('Ogiltiga uppgifter i ärendet.');
 }
 return { id, createdAt, updatedAt, programmeId, admissionYear, studyYear, planningYear, targetCredits, note, alternative };
}

export function cleanPlannedCourse(course, catalog) {
 const { id, caseId, scenarioId, title, code, start, end, credits, level, status, note, studyRate, completedCredits, catalogYear, programmeId } = course;
 if (!isPlanId(id) || !isPlanId(caseId) || !isPlanId(scenarioId) || !bounded(title,150) || !bounded(code,40) ||
     !bounded(note,1000) || !bounded(level,12) ||
     !['planned','progress','done','summer'].includes(status) || validateCourse(course)) throw Error('Ogiltiga kursuppgifter.');
 const placement = validatePlacement(course,credits);
 // Rebuild source metadata from the public snapshot, independently of placement.
 const official = catalog?.academicYear === catalogYear && catalog?.courses.find(c=>c.code===code);
 const matches = official ? official.offerings.filter(o=>o.programmeId===programmeId) : [];
 const chosen = matches.find(o=>o.sourceId===course.offeringId);
 const offers = chosen ? [chosen] : matches;
 return { id,caseId,scenarioId,title,code,start,end,credits,level,status,note,studyRate,completedCredits,...placement,
  datesArePlanning:true,catalogYear:official ? catalogYear : '',
  programmeId:offers.length ? programmeId : '',offeringId:chosen?.sourceId,sourceUrl:official?.syllabusUrl || '',
  offeringActive:Boolean(official && official.status==='active' && offers.some(o=>o.status==='active')),
  periods:[...new Set(offers.flatMap(o=>o.periods))].sort(),timePlans:offers.flatMap(o=>o.timePlans) };
}

export function upgradeWorkspace(value) {
 if (value?.version !== 3 || !Array.isArray(value.cases) || !Array.isArray(value.courses)) return value;
 // Etapp 1 alternatives had no reliable parent relation. Preserve each as its own case.
 const cases = value.cases.map(old=>{
  const scenario = initialScenario(old.id,old.planningYear,old.note,old.alternative ? 'Importerat alternativ' : 'Nuvarande plan');
  return {...old,note:'',scenarios:[scenario],activeScenarioId:scenario.id};
 });
 const byId = new Map(cases.map(c=>[c.id,c.scenarios[0]]));
 const courses = value.courses.map(c=>{
  const plannedYear = typeof c.start==='string' ? yearOf(c.start) : null;
  const scenario = byId.get(c.caseId);
  if (!scenario) throw Error('Kurs utan ärende i äldre säkerhetskopia.');
  if (!scenario.years.includes(plannedYear)) scenario.years.push(plannedYear);
  return {...c,scenarioId:scenario?.id,plannedYear,plannedPeriods:['OWN'],allocation:[],weeks:null,useOwnDates:true};
 });
 return {...value,version:4,cases,courses};
}

export function validateWorkspace(input, catalog) {
 const value = upgradeWorkspace(input);
 if (value?.version !== 4 || !Array.isArray(value.cases) || !Array.isArray(value.courses)) throw Error('Ogiltigt ärendeformat.');
 const cases = value.cases.map(raw=>{
  const record = cleanCase(raw);
  if (!Array.isArray(raw.scenarios) || !raw.scenarios.length) throw Error('Ärendet saknar planeringsscenarier.');
  const scenarios = raw.scenarios.map(validateScenario);
  if (new Set(scenarios.map(s=>s.id)).size!==scenarios.length || !scenarios.some(s=>s.id===raw.activeScenarioId)) throw Error('Ogiltigt aktivt scenario.');
  return {...record,scenarios,activeScenarioId:raw.activeScenarioId};
 });
 const ids = new Map(cases.map(c=>[c.id,c]));
 if (ids.size!==cases.length) throw Error('Dubblett av ärende.');
 const courses = value.courses.map(c=>cleanPlannedCourse(c,catalog));
 const courseIds = new Map();
 const courseCodes = new Set();
 for (const course of courses) {
  const scenario = ids.get(course.caseId)?.scenarios.find(s=>s.id===course.scenarioId);
  const key = course.caseId+':'+course.scenarioId+':'+course.code.toUpperCase();
  if (!scenario?.years.includes(course.plannedYear) || courseIds.has(course.id) || (course.code && courseCodes.has(key))) throw Error('Dubblett eller kurs utan ärende, scenario eller läsår.');
  courseIds.set(course.id,course);
  courseCodes.add(key);
 }
 for (const record of cases) {
  for (const scenario of record.scenarios) {
   for (const task of [...scenario.retakes,...scenario.completions,...scenario.steps]) {
    if (!task.courseId) continue;
    const c = courseIds.get(task.courseId);
    if (!c || c.caseId!==record.id || c.scenarioId!==scenario.id) throw Error('Momentet är kopplat till en kurs i ett annat scenario eller till en borttagen kurs.');
   }
  }
 }
 return {version:4,cases,courses,activeCaseId:ids.has(value.activeCaseId)?value.activeCaseId:null,exportSettings:exportPreferences(value.exportSettings)};
}

export function loadWorkspace(storage, catalog) {
 try {
  const json = storage.getItem(CASE_KEY);
  return {data:json===null?emptyWorkspace():validateWorkspace(JSON.parse(json),catalog),error:false};
 } catch { return {data:emptyWorkspace(),error:true}; }
}

export function saveWorkspace(storage, workspace, catalog) {
 try {
  storage.setItem(CASE_KEY,JSON.stringify(validateWorkspace(workspace,catalog)));
  return true;
 } catch { return false; }
}

export function caseBackup(workspace,id,catalog) {
 const checked = validateWorkspace(workspace,catalog);
 return {version:4,cases:checked.cases.filter(c=>!id || c.id===id),courses:checked.courses.filter(c=>!id || c.caseId===id)};
}

export function importCases(workspace,backup,catalog) {
 const incoming = validateWorkspace(backup,catalog);
 const result = {...workspace,cases:[...workspace.cases],courses:[...workspace.courses]};
 for (const record of incoming.cases) {
  const caseId = newId();
  const imported = {...record,id:caseId,scenarios:[]};
  for (const source of record.scenarios) {
   const id = newId();
   const courses = incoming.courses.filter(c=>c.caseId===record.id && c.scenarioId===source.id);
   const copy = copyScenario(source,courses,id,source.name,true,newId);
   if (source.id===record.activeScenarioId) imported.activeScenarioId = id;
   imported.scenarios.push(copy.scenario);
   result.courses.push(...copy.courses.map(c=>({...c,caseId})));
  }
  result.cases.push(imported);
 }
 return result;
}

export const sortCases = cases => [...cases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt));

export function legacyChoices(value) {
 if (![1, 2].includes(value?.version ?? 1) || !Array.isArray(value?.students) || !Array.isArray(value?.courses)) {
  throw new Error('Äldre planer kunde inte läsas.');
 }
 const groups = value.students.map(profile => ({ profile, courses: value.courses.filter(c => c?.studentId === profile?.id) }));
 if (Array.isArray(value.deletedStudents)) {
  for (const archived of value.deletedStudents) groups.push({ profile: archived?.student, courses: archived?.courses, archived: true });
 }
 const ids = new Set();
 return groups.filter(group => {
  const id = group.profile?.id;
  if (!bounded(id, 200) || !id || !Array.isArray(group.courses) || ids.has(id)) return false;
  ids.add(id);
  return true;
 });
}

export function migrateLegacy(groups, selected, catalog, now, planningYear) {
 const result = {...emptyWorkspace(),version:3};
 groups.forEach(({ profile, courses }, index) => {
  if (!selected.has(index)) return;
  const id = newId();
  const programmeId = catalog.programmes.some(p => p.id === profile.programmeId) ? profile.programmeId : '';
  const studyYear = Number(String(profile.year ?? '').match(/^(?:Årskurs\s+)?(\d{1,2})$/i)?.[1]);
  const admissionYear = Number(profile.admissionYear);
  const courseCodes = new Set();
  result.cases.push({ id, createdAt: now, updatedAt: now, programmeId,
   admissionYear: integer(admissionYear, 1950, 2100) ? admissionYear : null,
   studyYear: integer(studyYear, 1, 20) ? studyYear : null, planningYear,
   targetCredits: integer(Number(profile.targetCredits), 1, 1000) ? Number(profile.targetCredits) : 60,
   note: '', alternative: Boolean(profile.originalPlanId) });
  for (const old of courses) {
   const official = catalog.courses.find(c => c.code === old?.code);
   if (!old || (official && courseCodes.has(official.code))) continue;
   try {
    const course = {
     id: newId(), caseId: id, code: official?.code || '',
     title: official?.title || 'Egen kurs – granska titel',
     start: old.start, end: old.end, credits: Number(old.credits), status: old.status,
     level: official?.level || '', note: '', studyRate: old.studyRate,
     completedCredits: old.completedCredits, catalogYear: official ? catalog.academicYear : '', programmeId
    };
    if (!['planned','progress','done','summer'].includes(course.status) || validateCourse(course)) continue;
    result.courses.push(course);
    if (course.code) courseCodes.add(course.code);
   } catch {
    // Invalid legacy courses stay in the untouched original backup.
   }
  }
 });
 return validateWorkspace(result,catalog);
}
