import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { CASE_KEY, caseBackup, emptyWorkspace, importCases, newId, loadWorkspace, saveWorkspace, validateWorkspace } from '../dist/cases.js';
import { copyScenario, estimatedRate, initialScenario, placementLabel, planSlots, planningDates, sourcePlacements, summarizePlan, validatePlacement } from '../dist/planning.js';
import { createPlanningSnapshot } from '../dist/planning-export.js';

const catalog = JSON.parse(await fs.readFile(new URL('../dist/catalog.json',import.meta.url),'utf8'));
const fixture = () => {
 const scenario = initialScenario(newId(),2026);
 const record = {id:newId(),programmeId:'D',planningYear:2026,admissionYear:2025,studyYear:2,targetCredits:60,note:'',
  createdAt:'2026-11-09T12:00:00.000Z',updatedAt:'2026-11-09T12:00:00.000Z',alternative:false,activeScenarioId:scenario.id,scenarios:[scenario]};
 return {record,scenario};
};
const planned = (record,scenario,code,credits,periods,extra={}) => ({id:newId(),caseId:record.id,scenarioId:scenario.id,
 code,title:code+' planerad kurs',credits,level:'G1',status:'planned',note:'',completedCredits:0,plannedYear:2026,
 plannedPeriods:periods,allocation:[],weeks:null,useOwnDates:false,start:'2026-08-31',end:'2027-05-27',
 programmeId:'',catalogYear:'',periods:[],timePlans:[],...extra});
const exam = (courseId,period) => ({id:newId(),courseId,code:'',year:2026,period,date:'',reminder:'',note:'',status:'sat'});
const completion = (courseId,status) => ({id:newId(),courseId,code:'',year:2026,period:'2',date:'',note:'',status,
 type:'lab',description:'Laboration med Å, Ä och Ö'});

test('7,5 hp i LP1 och 10,5 hp i LP1–LP2 räknas bara en gång',()=>{
 const {record,scenario} = fixture();
 const a = planned(record,scenario,'SINGLE',7.5,['1']);
 const b = planned(record,scenario,'SPAN',10.5,['1','2'],{completedCredits:3});
 const summary = summarizePlan([a,b,a],scenario,record,2026);
 assert.equal(summary.total,18);
 assert.equal(summary.done,3);
 assert.equal(summary.byYear[0].slots['1'].hp,7.5);
 assert.equal(summary.byYear[0].slots['1'].unknown,1);
 assert.equal(summary.byYear[0].slots['2'].hp,0);
 assert.equal(summary.byYear[0].HT.hp,18);
 assert.equal(summary.byYear[0].VT.hp,0);
 assert.equal(estimatedRate(b).value,null);
 assert.equal(estimatedRate({...b,weeks:14}).value,50);
 assert.equal(estimatedRate({...b,weeks:14,studyRate:25}).value,25);
 assert.deepEqual(validatePlacement({...b,periodRates:[{slot:'1',rate:40}]},b.credits).periodRates,[{slot:'1',rate:40}]);
 assert.throws(()=>validatePlacement({...b,periodRates:[{slot:'4',rate:40}]},b.credits),/period/);
});

test('LP2–LP3 och LP1–LP4: full HP i läsåret och bara fördelade HP per termin',()=>{
 const {record,scenario} = fixture();
 const cross = planned(record,scenario,'CROSS',15,['2','3'],{status:'done'});
 const all = planned(record,scenario,'ALL',20,['1','2','3','4'],{allocation:['1','2','3','4'].map(slot=>({slot,hp:5})),status:'done'});
 const whole = summarizePlan([cross,all],scenario,record,2026);
 const ht = summarizePlan([cross,all],scenario,record,2026,'HT');
 const vt = summarizePlan([cross,all],scenario,record,2026,'VT');
 assert.equal(whole.total,35);
 assert.equal(whole.done,35);
 assert.equal(ht.total,10);
 assert.equal(vt.total,10);
 assert.equal(ht.done,10);
 assert.equal(vt.done,10);
 assert.equal(ht.unknown,1);
 assert.equal(vt.unknown,1);
 assert.equal(ht.courses.length,2);
 assert.throws(()=>validatePlacement({...all,allocation:[{slot:'1',hp:20}]},20),/poäng/);
 assert.throws(()=>validatePlacement({...cross,plannedPeriods:['OWN','2']},15),/perioder/);
});

test('moment ger 0 HP och genomförd eller inlämnad är fortfarande kvarstående',()=>{
 const {record,scenario} = fixture();
 const c = planned(record,scenario,'EDAB05',10.5,['1','2']);
 scenario.retakes.push(exam(c.id,'TP4'),exam(c.id,'TP6'));
 scenario.completions.push(completion(c.id,'submitted'),completion(c.id,'todo'),completion(c.id,'passed'));
 const stats = summarizePlan([c],scenario,record,2026);
 assert.equal(stats.total,10.5);
 assert.equal(stats.done,0);
 assert.equal(stats.remainingRetakes,2);
 assert.equal(stats.remainingCompletions,2);
 assert.deepEqual(summarizePlan([c],scenario,record,2026,'VT').retakes.map(t=>t.period),['TP4']);
});

test('källa och planeringsplacering är separata, också för program utan LP',()=>{
 const {record} = fixture();
 const sourced = {catalogYear:'26_27',programmeId:'D',plannedYear:2026,plannedPeriods:['1','2'],periods:[1,2,3],
  timePlans:[{periods:[1,2]},{periods:[3]}],useOwnDates:false};
 assert.deepEqual(sourcePlacements(sourced,record,2026),[['1','2'],['3']]);
 assert.equal(placementLabel(sourced,record),'Följer LoT:s perioduppgift');
 assert.match(placementLabel({...sourced,plannedPeriods:['2','3']},record),/Eget planeringsval/);
 assert.match(placementLabel({...sourced,plannedYear:2027},record),/Eget planeringsval/);
 assert.deepEqual(planSlots({...record,programmeId:'A'},2026),['HT','VT']);
 assert.deepEqual(planSlots({...record,programmeId:'A'},2028),['HT','VT']);
 assert.deepEqual(planningDates({...record,studyYear:1},2026,['1','2']),['2026-08-24','2026-12-18']);
 assert.deepEqual(planningDates({...record,programmeId:'IDA',studyYear:1},2026,['1']),['2026-08-26','2026-10-20']);
 assert.deepEqual(planningDates(record,2026,['4']),['2027-03-22','2027-05-27']);
});

test('kopiering, flytt och återimport håller scenarier och kursreferenser isär',()=>{
 const {record,scenario} = fixture();
 const a = planned(record,scenario,'EDAB05',10.5,['1','2']);
 scenario.retakes.push(exam(a.id,'TP4'));
 scenario.completions.push(completion(a.id,'todo'));
 const alternative = copyScenario(scenario,[a],newId(),'Lägre belastning',true,newId);
 const noNotes = copyScenario(scenario,[a],newId(),'Utan moment',false,newId);
 assert.equal(noNotes.scenario.retakes.length,0);
 alternative.courses[0].plannedPeriods=['3','4'];
 assert.deepEqual(a.plannedPeriods,['1','2']);
 assert.equal(alternative.scenario.retakes[0].courseId,alternative.courses[0].id);
 record.scenarios.push(alternative.scenario);
 const workspace = {...emptyWorkspace(),cases:[record],courses:[a,...alternative.courses]};
 const backup = caseBackup(workspace,record.id,catalog);
 const imported = importCases(emptyWorkspace(),backup,catalog);
 assert.equal(imported.cases[0].scenarios.length,2);
 assert.equal(imported.cases[0].scenarios[1].retakes[0].courseId,imported.courses[1].id);
 assert.notEqual(imported.courses[1].id,alternative.courses[0].id);
 const invalid = structuredClone(workspace);
 invalid.cases[0].scenarios[1].completions[0].courseId=a.id;
 assert.throws(()=>validateWorkspace(invalid,catalog),/annat scenario/);
 assert.throws(()=>validateWorkspace({...workspace,courses:[...workspace.courses,{...a,id:newId()}]},catalog),/Dubblett/);
});

test('v3 behåller eget datum och anteckning och skrivfel rör inte tidigare sparat innehåll',()=>{
 const {record,scenario} = fixture();
 const c = planned(record,scenario,'OLD',8,['1'],{start:'2027-10-01',end:'2027-10-31'});
 const old = {...emptyWorkspace(),version:3,cases:[{...record,note:'Avtal om uppföljning'}],courses:[c]};
 const before = JSON.stringify(old);
 const storage = {getItem:key=>key===CASE_KEY?before:null,setItem:()=>{throw Error('QuotaExceededError');}};
 const result=loadWorkspace(storage,catalog);
 assert.equal(result.error,false);
 assert.equal(result.data.version,4);
 assert.equal(result.data.cases[0].scenarios[0].agreements,'Avtal om uppföljning');
 assert.deepEqual(result.data.courses[0].plannedPeriods,['OWN']);
 assert.equal(result.data.courses[0].plannedYear,2027);
 assert.equal(result.data.courses[0].start,'2027-10-01');
 assert.equal(saveWorkspace(storage,result.data,catalog),false);
 assert.equal(storage.getItem(CASE_KEY),before);
});

test('dokumentets två scenarier bygger på exakt samma domänsammanställning',()=>{
 const {record,scenario} = fixture();
 const c = planned(record,scenario,'EDAB05',10.5,['1','2']);
 scenario.completions.push(completion(c.id,'submitted'));
 scenario.agenda='<script>alert(1)</script>';
 const other = copyScenario(scenario,[c],newId(),'Jämförelse',false,newId);
 const input = {record,scenarios:[scenario,other.scenario],courses:[c,...other.courses],catalog,year:2026,
  name:'Temporär QA',options:{documentMode:'detail'}};
 const snapshot = createPlanningSnapshot(input);
 const summary = summarizePlan([c],scenario,record,2026);
 assert.equal(snapshot.summaries[0].total,summary.total);
 assert.equal(snapshot.summaries[0].completions,1);
 assert.equal(snapshot.summaries[1].completions,0);
 assert.equal(snapshot.blocks.filter(b=>b.kind==='scenario').length,2);
 assert.match(snapshot.documentInfo.join(' '),/Temporär QA/);
 assert.doesNotMatch(JSON.stringify(caseBackup({...emptyWorkspace(),cases:[record],courses:[c]},null,catalog)),/Temporär QA/);
});
