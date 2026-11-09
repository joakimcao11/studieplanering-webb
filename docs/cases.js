import { validateCourse } from './model.js';

export const CASE_KEY = 'studieplan-v3';
export const LEGACY_KEY = 'studieplan-v1';
export const emptyWorkspace = () => ({ version: 3, cases: [], courses: [], activeCaseId: null, exportSettings: {} });
export const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');

const bounded = (value, max) => typeof value === 'string' && value.length <= max;
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const timestamp = value => bounded(value, 24) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const identifier = value => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);

export function exportPreferences(settings) {
 const fields = ['includeStudent', 'includeContact', 'includeSummary', 'includeNotes', 'includeSources', 'includeRate', 'includeAcademic', 'includeMonths', 'includePeriods', 'includeDates', 'includeStatus'];
 const prefs = Object.fromEntries(fields.filter(key => typeof settings?.[key] === 'boolean').map(key => [key, settings[key]]));
 if (['lth', 'lu', 'custom'].includes(settings?.template)) prefs.template = settings.template;
 if (['all', 'period'].includes(settings?.scope)) prefs.scope = settings.scope;
 if (['portrait', 'landscape'].includes(settings?.orientation)) prefs.orientation = settings.orientation;
 return prefs;
}

export function cleanCase(record) {
 const { id, createdAt, updatedAt, programmeId, admissionYear, studyYear, planningYear, targetCredits, note, alternative } = record;
 if (!identifier(id) || !timestamp(createdAt) || !timestamp(updatedAt) || updatedAt < createdAt ||
     !bounded(programmeId, 20) || !/^[A-Za-z0-9_]*$/.test(programmeId) ||
     !(admissionYear === null || integer(admissionYear, 1950, 2100)) ||
     !(studyYear === null || integer(studyYear, 1, 20)) || !integer(planningYear, 1950, 2100) ||
     !integer(targetCredits, 1, 1000) || !bounded(note, 1000) || typeof alternative !== 'boolean') {
  throw new Error('Ogiltiga uppgifter i ärendet.');
 }
 return { id, createdAt, updatedAt, programmeId, admissionYear, studyYear, planningYear, targetCredits, note, alternative };
}

function cleanPlannedCourse(course, catalog) {
 const { id, caseId, title, code, start, end, credits, level, status, note, studyRate, completedCredits, catalogYear, programmeId } = course;
 if (!identifier(id) || !identifier(caseId) || !bounded(title, 150) || !bounded(code, 40) ||
     !bounded(note, 1000) || !bounded(level, 12) ||
     !['planned', 'progress', 'done', 'summer'].includes(status) || validateCourse(course)) {
  throw new Error('Ogiltiga kursuppgifter.');
 }
 // Rebuild provenance from the public snapshot. Never trust arbitrary backup URLs or metadata.
 const official = catalog?.academicYear === catalogYear && catalog?.courses.find(c => c.code === code);
 const offers = official ? official.offerings.filter(o => o.programmeId === programmeId) : [];
 return { id, caseId, title, code, start, end, credits, level, status, note, studyRate, completedCredits,
  datesArePlanning: true, catalogYear: official ? catalogYear : '',
  programmeId: offers.length ? programmeId : '', sourceUrl: official?.syllabusUrl || '',
  periods: [...new Set(offers.flatMap(o => o.periods))].sort(),
  timePlans: offers.flatMap(o => o.timePlans)
 };
}

export function validateWorkspace(value, catalog) {
 if (value?.version !== 3 || !Array.isArray(value.cases) || !Array.isArray(value.courses)) throw new Error('Ogiltigt ärendeformat.');
 const cases = value.cases.map(cleanCase);
 const ids = new Set(cases.map(c => c.id));
 if (ids.size !== cases.length) throw new Error('Dubblett av ärende.');
 const courses = value.courses.map(c => cleanPlannedCourse(c, catalog));
 const courseIds = new Set();
 const courseCodes = new Set();
 for (const course of courses) {
  const key = course.caseId + ':' + course.code.toUpperCase();
  if (!ids.has(course.caseId) || courseIds.has(course.id) || (course.code && courseCodes.has(key))) throw new Error('Dubblett eller kurs utan ärende.');
  courseIds.add(course.id);
  courseCodes.add(key);
 }
 return { version: 3, cases, courses, activeCaseId: ids.has(value.activeCaseId) ? value.activeCaseId : null,
  exportSettings: exportPreferences(value.exportSettings) };
}

export function loadWorkspace(storage, catalog) {
 try {
  const json = storage.getItem(CASE_KEY);
  return { data: json === null ? emptyWorkspace() : validateWorkspace(JSON.parse(json), catalog), error: false };
 } catch {
  return { data: emptyWorkspace(), error: true };
 }
}

export function saveWorkspace(storage, workspace, catalog) {
 try {
  storage.setItem(CASE_KEY, JSON.stringify(validateWorkspace(workspace, catalog)));
  return true;
 } catch {
  return false;
 }
}

export function caseBackup(workspace, id, catalog) {
 const checked = validateWorkspace(workspace, catalog);
 return { version: 3, cases: checked.cases.filter(c => !id || c.id === id),
  courses: checked.courses.filter(c => !id || c.caseId === id) };
}

export function importCases(workspace, backup, catalog) {
 const incoming = validateWorkspace(backup, catalog);
 const ids = new Map(incoming.cases.map(c => [c.id, newId()]));
 return { ...workspace, cases: [...workspace.cases, ...incoming.cases.map(c => ({ ...c, id: ids.get(c.id) }))],
  courses: [...workspace.courses, ...incoming.courses.map(c => ({ ...c, id: newId(), caseId: ids.get(c.caseId) }))] };
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
 const result = emptyWorkspace();
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
    const course = cleanPlannedCourse({
     id: newId(), caseId: id, code: official?.code || '',
     title: official?.title || 'Egen kurs – granska titel',
     start: old.start, end: old.end, credits: Number(old.credits), status: old.status,
     level: official?.level || '', note: '', studyRate: old.studyRate,
     completedCredits: old.completedCredits, catalogYear: official ? catalog.academicYear : '', programmeId
    }, catalog);
    result.courses.push(course);
    if (course.code) courseCodes.add(course.code);
   } catch {
    // Invalid legacy courses stay in the untouched original backup.
   }
  }
 });
 return result;
}
