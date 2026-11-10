
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { monthEnd, summarize } from '../dist/model.js';
import { CASE_KEY, caseBackup, emptyWorkspace, importCases, legacyChoices, loadWorkspace, migrateLegacy, newId, saveWorkspace, sortCases, validateWorkspace } from '../dist/cases.js';
import { categoryLabels, filterOfferings, groupOfferings, offeringCategory, periodLabel } from '../dist/program-catalog.js';
import { officialCalendar, programmeStructure } from '../dist/lth-calendar.js';
const catalog = JSON.parse(await fs.readFile(new URL('../dist/catalog.json',import.meta.url),'utf8'));
const now = '2026-11-09T14:00:00.000Z';
const record = () => ({ id:newId(), createdAt:now, updatedAt:now, programmeId:'D', admissionYear:2024, studyYear:3,
 planningYear:2026, targetCredits:60, note:'', alternative:false });
const course = (id,code='EDAB05') => ({ id:newId(), caseId:id, title:'Programmering', code, credits:10.5, level:'G1',
 start:'2026-08-31', end:'2026-12-18', status:'planned', note:'', programmeId:'D', catalogYear:'26_27' });

test('standarddatum stannar i vald månad även vid skottår och årsskifte', () => {
 assert.equal(monthEnd('2026-10'),'2026-10-31');
 assert.equal(monthEnd('2028-02'),'2028-02-29');
 assert.equal(monthEnd('2027-02'),'2027-02-28');
 assert.equal(monthEnd('2026-12'),'2026-12-31');
 assert.throws(() => monthEnd('2026-13'));
});

test('lokal lagring och ärendebackup väljer schemafält och behåller kull separat', () => {
 const a = { ...record(), name:'ALDRIG-SKICKA' }, b = record();
 const workspace = { ...emptyWorkspace(), version:3, cases:[a,b], courses:[{...course(a.id), studentName:'ALDRIG-SKICKA'},course(b.id)],
  activeCaseId:a.id, exportSettings:{ template:'lu', recipient:'ALDRIG-SKICKA', documentName:'ALDRIG-SKICKA' } };
 const values = new Map();
 const storage = { getItem:key=>values.get(key) ?? null, setItem:(key,value)=>values.set(key,value) };
 assert.equal(loadWorkspace(storage,catalog).data.cases.length,0);
 assert.equal(saveWorkspace(storage,workspace,catalog),true);
 assert.doesNotMatch(values.get(CASE_KEY),/ALDRIG-SKICKA/);
 const reopened = loadWorkspace(storage,catalog).data;
 assert.equal(reopened.activeCaseId,a.id);
 assert.equal(reopened.cases[0].admissionYear,2024);
 assert.equal(reopened.cases[0].planningYear,2026);
 assert.deepEqual(reopened.courses[0].periods,[1,2]);
 const backup = caseBackup(workspace,a.id,catalog);
 assert.equal(backup.cases.length,1);
 assert.equal(backup.courses.length,1);
 assert.doesNotMatch(JSON.stringify(backup),/ALDRIG-SKICKA/);
 const imported = importCases(reopened,backup,catalog);
 assert.equal(imported.cases.length,3);
 assert.notEqual(imported.cases[2].id,a.id);
 assert.equal(imported.courses[2].caseId,imported.cases[2].id);
 assert.deepEqual(sortCases([a,{...b,updatedAt:'2026-11-10T14:00:00.000Z'}]).map(c=>c.id),[b.id,a.id]);
});

test('korrupt lagring, skrivfel, felaktigt schema och dubbla kurser avvisas', () => {
 assert.equal(loadWorkspace({getItem:()=>'{broken'},catalog).error,true);
 assert.equal(saveWorkspace({setItem:()=>{throw Error('Quota');}},emptyWorkspace(),catalog),false);
 assert.throws(()=>validateWorkspace({version:2,students:[],courses:[]},catalog));
 const a = record();
 const plan = { ...emptyWorkspace(), version:3, cases:[a], courses:[course(a.id),course(a.id)] };
 assert.throws(()=>validateWorkspace(plan,catalog),/Dubblett/);
 assert.throws(()=>validateWorkspace({...plan,courses:[{...course(a.id),caseId:newId()}]},catalog),/utan ärende/);
});

test('migrerar valda v1/v2-planer och alternativ utan gamla namn eller fritext', () => {
 for (const version of [1,2,undefined]) {
  const backup = { version, students:[{id:'test1',name:'RADERA NAMN',programmeId:'D',year:'Årskurs 1',note:'KÄNSLIGT'},
   {id:'test2',originalPlanId:'test1',name:'RADERA NAMN',programmeId:'D',year:'Årskurs 1',note:'KÄNSLIGT'}],
   courses:[{...course(null),studentId:'test1',note:'KÄNSLIGT'},{...course(null,'CUSTOM'),studentId:'test2',title:'RADERA NAMN'},
    {studentId:'test2',code:'TRASIG'}] };
  const before = JSON.stringify(backup);
  const groups = legacyChoices(backup);
  const migrated = migrateLegacy(groups,new Set([0,1]),catalog,now,2026);
  assert.equal(JSON.stringify(backup),before);
  assert.equal(migrated.cases.length,2);
  assert.equal(migrated.cases[1].alternative,true);
  assert.equal(migrated.courses.length,2);
  assert.equal(migrated.courses[1].title,'Egen kurs – granska titel');
  assert.doesNotMatch(JSON.stringify(migrated),/RADERA NAMN|KÄNSLIGT|test1|test2/);
  assert.deepEqual(migrateLegacy(groups,new Set([1]),catalog,now,2026).cases.map(c=>c.alternative),[true]);
  assert.doesNotThrow(()=>validateWorkspace(migrated,catalog));
 }
 assert.throws(()=>legacyChoices({students:[]}));
 assert.deepEqual(legacyChoices({version:2,students:[null],courses:[]}),[]);
});

test('hela katalogen har unika kurser och bevarade programkopplingar', () => {
 const programs = new Set(catalog.programmes.map(p=>p.id));
 assert.equal(programs.size,catalog.counts.programmes);
 assert.equal(new Set(catalog.courses.map(c=>c.code)).size,catalog.counts.courses);
 const offerings = catalog.courses.flatMap(c=>c.offerings);
 assert.equal(offerings.length,catalog.counts.offeringRows);
 assert.equal(new Set(offerings.map(o=>o.sourceId)).size,offerings.length);
 for (const p of catalog.programmes) {
  const url = new URL(p.sourceUrl);
  assert.equal(url.searchParams.get('ay'),catalog.academicYear);
  assert.equal(url.searchParams.get('programme'),p.id);
  const rows = filterOfferings(catalog,{programme:p.id});
  assert.equal(new Set(rows.map(r=>r.course.code)).size,p.courseCount);
  assert.equal(groupOfferings(rows,programmeStructure(p.id,catalog.academicYear)).flatMap(g=>g.rows).length,rows.length);
 }
 for (const c of catalog.courses) {
  assert.equal(new URL(c.syllabusUrl).hostname,'kurser.lth.se');
  assert.equal(new URL(c.sourceUrl).hostname,'kurser.lth.se');
  assert.ok(c.offerings.every(o=>programs.has(o.programmeId) && categoryLabels[offeringCategory(o)] && o.periods.every(n=>n>=1&&n<=4)));
 }
});

test('LoT-exempel: alternativ, specialisering, examensarbete och flerperiodskurser', () => {
 const rows = filterOfferings(catalog,{programme:'D'});
 const find = code => rows.find(row=>row.course.code===code);
 assert.deepEqual(find('EDAB05').offer.periods,[1,2]);
 assert.deepEqual(find('EDAA35').offer.periods,[3,4]);
 assert.ok(find('EDAA40').offer.footnote.includes('EDAA75'));
 assert.equal(offeringCategory(find('EDAA75').offer),'elective_mandatory');
 assert.ok(rows.some(r=>offeringCategory(r.offer)==='thesis'));
 assert.ok(filterOfferings(catalog,{programme:'D',specialization:'is'}).length);
 const span = rows.find(r=>r.offer.periods.join(',')==='2,3');
 assert.ok(span);
 assert.equal(periodLabel(span.offer.periods),'LP2–LP3');
 assert.equal(summarize([span.course]).credits,span.course.credits);
 assert.deepEqual(filterOfferings(catalog,{programme:'D',q:'XZZZXZZZXZZZ'}),[]);
 assert.deepEqual(filterOfferings(catalog,{programme:'A',lp:'1'}),[]);
 assert.ok(filterOfferings(catalog,{programme:'D',status:'active'}).every(({course,offer})=>course.status==='active'&&offer.status==='active'));
});

test('LTH-kalendern skiljer campusstarter, delad LP4, terminsprogram och okänt läsår', () => {
 const d = officialCalendar(2026,'D',1);
 assert.deepEqual(d.autumn,['2026-08-24','2027-01-17']);
 assert.deepEqual(d.spring,['2027-01-18','2027-06-06']);
 assert.equal(officialCalendar(2026,'D',2).autumn[0],'2026-08-31');
 assert.equal(officialCalendar(2026,'IDA',1).autumn[0],'2026-08-26');
 assert.equal(d.teaching[4].length,2);
 assert.deepEqual(d.exams[4],['2027-03-30','2027-04-09']);
 assert.deepEqual(d.exams[6],['2027-08-16','2027-08-28']);
 assert.equal(officialCalendar(2026,'A',1).teaching,null);
 assert.equal(officialCalendar(2026,'KLMT',1).autumn[0],'2026-08-31');
 assert.deepEqual(officialCalendar(2027,'D',1).autumn,['2027-08-23','2028-01-16']);
 assert.equal(officialCalendar(2028,'D',1),null);
 assert.equal(programmeStructure('OKÄNT','26_27').type,'unknown');
});
