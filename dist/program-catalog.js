import { programmeStructure } from './lth-calendar.js';

export const choiceLabels = {
 mandatory: 'Obligatorisk', elective_mandatory: 'Alternativobligatorisk',
 elective: 'Valfri', external_elective: 'Externt valfri'
};

export const sourceStatusLabels = {
 active: 'Aktiv', course_on_hold: 'Vilande', exam_only: 'Enbart tentamen'
};

export function offeringCategory(offer) {
 if (offer.groupId === 'exjobb') return 'thesis';
 if (offer.specialization && !offer.general) return 'specialization';
 return offer.choice || 'unknown';
}

export const categoryLabels = {
 ...choiceLabels, thesis: 'Examensarbete', specialization: 'Specialisering', unknown: 'Kategori saknas'
};

export function filterOfferings(catalog, filter) {
 const query = (filter.q || '').toLocaleLowerCase('sv').trim().split(/\s+/).filter(Boolean);
 const termOnly = programmeStructure(filter.programme, catalog.academicYear).periods === 'terms';
 return catalog.courses.flatMap(course => {
  const searchable = [course.code, course.title, course.titleEn, course.department, course.purpose, course.contents].join(' ').toLocaleLowerCase('sv');
  if (!query.every(token => searchable.includes(token))) return [];
  return course.offerings.filter(offer => {
   const statuses = [offer.status, course.status];
   const status = filter.status === 'preliminary' ? course.preliminary :
    filter.status === 'active' ? statuses.every(value => value === 'active') : statuses.includes(filter.status);
   return offer.programmeId === filter.programme &&
    (!filter.year || String(offer.year) === filter.year) &&
    (!filter.category || offeringCategory(offer) === filter.category || offer.choice === filter.category) &&
    (!filter.specialization || offer.specialization === filter.specialization) &&
    (!filter.lp || (!termOnly && offer.periods.includes(Number(filter.lp)))) &&
    (!filter.status || status);
  }).map(offer => ({ course, offer }));
 });
}

export function groupOfferings(rows, structure) {
 const groups = new Map();
 const order = ['mandatory','elective_mandatory','specialization','elective','external_elective','thesis','unknown'];
 for (const row of rows) {
  const { offer } = row;
  const category = offeringCategory(offer);
  const specialization = category === 'specialization';
  const year = specialization || category === 'thesis' ? null : offer.year;
  const part = structure.type === 'civil'
   ? year >= 1 && year <= 3 && !specialization ? 'Grundblock · årskurs 1–3' : 'Fördjupande block · årskurs 4–5'
   : 'Programkurser';
  const title = specialization ? 'Specialisering · ' + (offer.specializationName || offer.specialization) :
   [year ? 'Årskurs ' + year : '', categoryLabels[category] || categoryLabels.unknown].filter(Boolean).join(' · ');
  const key = [part, year, category, specialization ? offer.specialization : ''].join(':');
  if (!groups.has(key)) groups.set(key, { part, title, year, category, rows: [] });
  groups.get(key).rows.push(row);
 }
 for (const group of groups.values()) {
  group.rows.sort((a,b) => String(a.offer.sortOrder ?? '').localeCompare(String(b.offer.sortOrder ?? ''), 'sv', { numeric:true }) ||
   a.course.code.localeCompare(b.course.code,'sv'));
 }
 return [...groups.values()].sort((a, b) => (a.year ?? 99) - (b.year ?? 99) ||
  order.indexOf(a.category) - order.indexOf(b.category) || a.title.localeCompare(b.title, 'sv'));
}

export function periodLabel(periods, termOnly = false) {
 if (!periods.length) return 'Placering ej angiven';
 if (termOnly) return [...new Set(periods.map(p => p <= 2 ? 'Hösttermin' : 'Vårtermin'))].join(' och ');
 if (periods.length > 1 && periods.every((p, i) => i === 0 || p === periods[i - 1] + 1)) {
  return 'LP' + periods[0] + '–LP' + periods.at(-1);
 }
 return periods.map(p => 'LP' + p).join(', ');
}
