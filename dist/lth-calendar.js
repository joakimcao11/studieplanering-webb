export const calendarSource = 'https://www.student.lth.se/mina-studier/schema-och-lasarsindelning';
export const calendarDecision = 'https://www.lth.se/fileadmin/lth/anstallda/utbildningsadministration/lasarsindelning/LTH_laesaarsindelning_2026-27_beslut.pdf';
export const calendarDecision2027 = 'https://www.lth.se/fileadmin/lth/anstallda/utbildningsadministration/lasarsindelning/LTH_laesaarsindelning_2027-28_beslut.pdf';
export const programmeInfo = 'https://www.student.lth.se/kurs-och-programinformation/programinnehall';
export const calendarArchive = 'https://www.lth.se/lthin/schemalaeggninglokalbokning-paa-lth/laesaarsindelning/';

const civil = new Set(['B','BME','BR','C','D','E','F','I','K','L','M','MD','N','Pi','V','W']);
const helsingborg = new Set(['IBYA','IBYI','IBYT','IBYV','IDA','IEA']);
const termOnly = new Set(['TB','TNB','A','KID','MID','MSUD','MARK','MAEF','KLMT']);

export function programmeStructure(code, academicYear) {
 if (!['26_27','27_28'].includes(academicYear)) return { type: 'unknown', periods: 'unknown' };
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
  },
  earlyStarts: { Lund:'2026-08-24', Helsingborg:'2026-08-26' },
  unscheduled: ['2027-04-30','2027-05-07']
 },
 2027: {
  autumn: ['2027-08-30','2028-01-16'], spring: ['2028-01-17','2028-06-04'],
  teaching: {
   1:[['2027-08-30','2027-10-20']], 2:[['2027-11-01','2027-12-17']],
   3:[['2028-01-17','2028-03-08']], 4:[['2028-03-20','2028-04-13'],['2028-05-02','2028-05-24']]
  },
  exams: {
   1:['2027-10-22','2027-10-29'], 2:['2028-01-05','2028-01-15'], 3:['2028-03-10','2028-03-17'],
   4:['2028-04-18','2028-04-28'], 5:['2028-05-29','2028-06-03'], 6:['2028-08-14','2028-08-26']
  },
  earlyStarts: { Lund:'2027-08-23', Helsingborg:'2027-08-25' },
  unscheduled: ['2028-01-06']
 }
};

export function officialCalendar(year, programmeId, studyYear) {
 const source = calendars[year];
 if (!source) return null;
 const structure = programmeStructure(programmeId, String(year).slice(-2)+'_'+String(year+1).slice(-2));
 const calendar = structuredClone(source);
 if (studyYear === 1 && programmeId !== 'KLMT' && structure.campus) {
  calendar.autumn[0] = calendar.earlyStarts[structure.campus];
  if (year===2026 && structure.campus === 'Helsingborg') {
   calendar.autumn[1] = '2027-01-18';
   calendar.note = 'Studentwebben anger 18 januari som höstterminens slut för årskurs 1 i Helsingborg, samma dag som vårterminen börjar. Kontrollera med programmet.';
  }
  calendar.teaching[1][0][0] = calendar.autumn[0];
 }
 return { ...calendar, teaching: structure.periods === 'terms' ? null : calendar.teaching,
  exams: structure.periods === 'terms' ? null : calendar.exams, structure };
}

export const stockholmDate = (instant = new Date()) => new Intl.DateTimeFormat('sv-SE',{
 timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'
}).format(instant);

export function currentPlanningPeriod(day, programmeId, studyYear) {
 const calendarYear = Number(day.slice(0,4));
 const fallbackYear = calendarYear - (Number(day.slice(5,7))<8 ? 1 : 0);
 const windows = [], examWindows = [];
 for (const year of [calendarYear-1,calendarYear,calendarYear+1]) {
  const cal = officialCalendar(year,programmeId,studyYear);
  if (!cal) continue;
  const teaching = cal.teaching || {HT:[cal.autumn],VT:[cal.spring]};
  for (const [slot,intervals] of Object.entries(teaching)) for (const [start,end] of intervals) {
   windows.push({year,slot,start,end,excluded:cal.teaching?cal.unscheduled:[]});
  }
  for (const [exam,[start,end]] of Object.entries(cal.exams || {})) {
   examWindows.push({year,exam:Number(exam),start,end,excluded:cal.unscheduled});
  }
 }
 const includesDay = range => range.start<=day && range.end>=day && !range.excluded.includes(day);
 const active = windows.find(includesDay);
 if (active) return {year:active.year,slot:active.slot,status:'teaching'};
 const exam = examWindows.find(includesDay);
 const next = windows.find(range=>range.start>day || (range.end>day && range.excluded.includes(day)));
 const verifiedSpan = windows.length && day>=windows[0].start && (next || examWindows.some(range=>range.end>=day));
 if (exam || verifiedSpan) return {year:next?.year ?? fallbackYear,slot:next?.slot ?? '',
  status:exam?(exam.exam===4 || exam.exam===6?'retake':'exam'):'break',exam:exam?.exam};
 return {year:fallbackYear,slot:'',status:'unknown'};
}
