import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { filterOfferings, distinctOfferings, sortOfferings } from '../dist/program-catalog.js';
import { CASE_KEY, loadWorkspace, validateWorkspace, caseBackup } from '../dist/cases.js';
import { initialScenario, summarizePlan } from '../dist/planning.js';

const catalog = JSON.parse(await fs.readFile(new URL('../dist/catalog.json',import.meta.url),'utf8'));
const id = n=>n.toString(16).padStart(32,'0');

test('Datateknik år 1 ordnas efter officiell start och fortsättning',()=>{
 const rows = distinctOfferings(filterOfferings(catalog,{programme:'D',year:'1'}));
 const codes = rows.map(r=>r.course.code);
 assert.ok(codes.indexOf('FMAB65')<codes.indexOf('EDAB05'));
 assert.ok(codes.indexOf('EDAB05')<codes.indexOf('FMAB70'));
 assert.ok(codes.indexOf('FMAB70')<codes.indexOf('EDAA35'));
 assert.equal(codes.filter(c=>c==='EDAB05').length,1);
 const filtered = distinctOfferings(filterOfferings(catalog,{programme:'D',year:'1',lp:'2'}));
 assert.deepEqual(filtered.find(r=>r.course.code==='EDAB05').offer.periods,[1,2]);
});

test('ojämna perioder, källordning och saknad period sorteras stabilt',()=>{
 const row = (code,periods,sortOrder) => ({course:{code},offer:{periods,sortOrder}});
 const input = [row('NO',[],'00'),row('B',[1,3],'00'),row('D',[1,2,4],'01'),row('C',[1,2],'02'),row('A',[1],'05'),row('L',[4],'01')];
 assert.deepEqual(sortOfferings(input).map(r=>r.course.code),['A','C','D','B','L','NO']);
 assert.equal(input[0].course.code,'NO');
});

test('olika specialiseringar bevaras som separata erbjudanden',()=>{
 const rows = distinctOfferings(filterOfferings(catalog,{programme:'D',year:'4',q:'EDAG01'})).filter(r=>r.course.code==='EDAG01');
 assert.ok(rows.length>1);
 assert.ok(rows.some(r=>r.offer.specialization==='is'));
 assert.ok(rows.some(r=>r.offer.specialization==='hs'));
});

test('tidigare aktiva ärenden återöppnas med samma kurser, och valt erbjudande kan sparas utan migrering',()=>{
 const stamp = '2026-11-09T12:00:00.000Z', scenario = initialScenario(id(2),2026);
 const record = {id:id(1),programmeId:'D',planningYear:2026,admissionYear:null,studyYear:1,targetCredits:60,note:'',alternative:false,
  createdAt:stamp,updatedAt:stamp,activeScenarioId:scenario.id,scenarios:[scenario]};
 const base = {id:id(3),caseId:record.id,scenarioId:scenario.id,code:'EDAB05',title:'Programmering, grundkurs',credits:10.5,level:'G1',
  status:'planned',note:'',start:'2026-08-24',end:'2026-12-18',plannedYear:2026,plannedPeriods:['1','2'],
  allocation:[],useOwnDates:false,catalogYear:'26_27',programmeId:'D'};
 const original = {version:4,cases:[record],courses:[base],activeCaseId:record.id};
 const storage = {getItem:key=>key===CASE_KEY?JSON.stringify(original):null};
 const {data,error} = loadWorkspace(storage,catalog);
 assert.equal(error,false);
 assert.equal(data.activeCaseId,record.id);
 assert.deepEqual(data.courses[0].periods,[1,2]);
 assert.equal(summarizePlan(data.courses,data.cases[0].scenarios[0],data.cases[0],2026).total,10.5);
 const offer = catalog.courses.find(c=>c.code==='EDAG01').offerings.find(o=>o.programmeId==='D'&&o.specialization==='is');
 const withChoice = validateWorkspace({...original,courses:[{...base,code:'EDAG01',offeringId:offer.sourceId}]},catalog);
 assert.equal(caseBackup(withChoice,record.id,catalog).courses[0].offeringId,offer.sourceId);
 assert.deepEqual(withChoice.courses[0].timePlans,offer.timePlans);
});
