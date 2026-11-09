export const calendarSource = 'https://www.student.lth.se/mina-studier/schema-och-lasarsindelning';
export const calendarDecision = 'https://www.lth.se/fileadmin/lth/anstallda/utbildningsadministration/lasarsindelning/LTH_laesaarsindelning_2026-27_beslut.pdf';
export const programmeInfo = 'https://www.student.lth.se/kurs-och-programinformation/programinnehall';
export const calendarArchive = 'https://www.lth.se/lthin/schemalaeggninglokalbokning-paa-lth/laesaarsindelning/';

const civil = new Set(['B','BME','BR','C','D','E','F','I','K','L','M','MD','N','Pi','V','W']);
const helsingborg = new Set(['IBYA','IBYI','IBYT','IBYV','IDA','IEA']);
const termOnly = new Set(['TB','TNB','A','KID','MID','MSUD','MARK','MAEF','KLMT']);

export function programmeStructure(code, academicYear) {
 if (academicYear !== '26_27') return { type: 'unknown', periods: 'unknown' };
 if (termOnly.has(code)) return { type: 'other', periods: 'terms', campus: ['TB','TNB'].includes(code) ? 'Helsingborg' : 'Lund' };
 if (civil.has(code)) return { type: 'civil', periods: 'lp', campus: 'Lund' };
 if (helsingborg.has(code)) return { type: 'engineering', periods: 'lp', campus: 'Helsingborg' };
 if (code === 'RH') return { type: 'other', periods: 'lp', campus: 'Lund' };
 return { type: 'unknown', periods: 'unknown' };
}

const calendars = {
 2026: {
  autumn: ['2026-08-31','2027-01-17'],
  spring: ['2027-01-18','2027-06-06'],
  teaching: {
   1: [['2026-08-31','2026-10-20']],
   2: [['2026-11-02','2026-12-18']],
   3: [['2027-01-18','2027-03-09']],
   4: [['2027-03-22','2027-03-25'],['2027-04-12','2027-05-27']]
  },
  exams: {
   1: ['2026-10-23','2026-10-30'], 2: ['2027-01-07','2027-01-16'],
   3: ['2027-03-12','2027-03-19'], 4: ['2027-03-30','2027-04-09'],
   5: ['2027-05-31','2027-06-05'], 6: ['2027-08-16','2027-08-28']
  }
 }
};

export function officialCalendar(year, programmeId, studyYear) {
 const source = calendars[year];
 if (!source) return null;
 const structure = programmeStructure(programmeId, '26_27');
 const calendar = structuredClone(source);
 if (studyYear === 1 && programmeId !== 'KLMT' && structure.campus) {
  calendar.autumn[0] = structure.campus === 'Helsingborg' ? '2026-08-26' : '2026-08-24';
  if (structure.campus === 'Helsingborg') {
   calendar.autumn[1] = '2027-01-18';
   calendar.note = 'Studentwebben anger 18 januari som höstterminens slut för årskurs 1 i Helsingborg, samma dag som vårterminen börjar. Kontrollera med programmet.';
  }
  calendar.teaching[1][0][0] = calendar.autumn[0];
 }
 return { ...calendar, teaching: structure.periods === 'terms' ? null : calendar.teaching,
  exams: structure.periods === 'terms' ? null : calendar.exams, structure };
}
