import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Public endpoints used by https://kurser.lth.se/lot/ itself. No Ladok or student data.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ay=process.argv.find(a=>/^--year=/.test(a))?.split('=')[1]||'26_27';
if(!/^\d{2}_\d{2}$/.test(ay))throw new Error('Use --year=26_27');
const offline=process.argv.includes('--offline');
const skipSyllabi=process.argv.includes('--skip-syllabi');
const refresh=process.argv.includes('--refresh');
const dataDir=path.join(root,'data'),cacheDir=path.join(dataDir,'syllabi',ay);
await fs.mkdir(cacheDir,{recursive:true});
await fs.mkdir(path.join(root,'dist'),{recursive:true});
const api='https://api.lth.lu.se/lot';
const sourceUrl=`https://kurser.lth.se/lot/programme?ay=${ay}`;
const generatedAt=new Date().toISOString();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function loadJson(url,file,{cached=true}={}){
 if(offline||cached&&!refresh){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(offline)throw e;}}
 for(let retry=0;retry<3;retry++){
  try{const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{Accept:'application/json','User-Agent':'Studieplanering public course catalogue snapshot'}});if(!response.ok)throw new Error(`${response.status} ${url}`);const value=await response.json();await fs.writeFile(file,JSON.stringify(value));return value;}
  catch(e){if(retry===2)throw e;await wait(1000*(retry+1));}
 }
}
const programmesRaw=await loadJson(`${api}/courses/programmes`,path.join(dataDir,`lth-programmes-${ay}.json`),{cached:false});
const rows=await loadJson(`${api}/courses?academicYearId=${ay}`,path.join(dataDir,`lth-courses-${ay}.json`),{cached:false});
const fetchedAt=new Date(Math.min((await fs.stat(path.join(dataDir,`lth-programmes-${ay}.json`))).mtimeMs,(await fs.stat(path.join(dataDir,`lth-courses-${ay}.json`))).mtimeMs)).toISOString();
if(!Array.isArray(rows)||!rows.length||rows.some(r=>r.academicYearId!==ay))throw new Error('Unexpected academic year in LTH response. Previous catalogue preserved.');
const texts=new Map(),specializations=new Map();
const allProgrammes=new Map(programmesRaw.map(p=>[p.programmeCode,p]));
for(const row of rows){
 if(!allProgrammes.has(row.programmeCode))allProgrammes.set(row.programmeCode,{programmeCode:row.programmeCode,programme_sv:row.programme_sv,programme_en:row.programme_en});
 let course=texts.get(row.courseCode);
 if(!course){course={code:row.courseCode,sourceCourseId:row.courseId,oldCourseCode:row.oldCourseCode,newCourseCode:row.newCourseCode,title:row.name_sv,titleEn:row.name_en,credits:Number(row.credits),level:row.cycle,type:row.type,status:row.status,department:row.department_sv,language:row.language_sv,sourceUrl:`https://kurser.lth.se/lot/course/${encodeURIComponent(row.courseCode)}`,syllabusUrl:`https://kurser.lth.se/kursplaner/${ay}/${encodeURIComponent(row.courseCode)}.html`,timeeditUrl:row.timeeditUrl_sv||null,prerequisiteInfoAvailable:Boolean(row.entryRequirements),priorKnowledgeInfoAvailable:Boolean(row.assumedPriorKnowledge),academicYear:ay,preliminary:Boolean(row.preliminary),offerings:[]};texts.set(row.courseCode,course);}
 const timePlans=(row.timePlans||[]).map(tp=>({startPeriod:tp.startSpNr??null,endPeriod:tp.endSpNr??null,periods:(tp.studyPeriods||[]).flatMap((p,i)=>p?[i+1]:[])}));
 const periods=[...new Set(timePlans.flatMap(tp=>tp.periods))].sort();
 course.offerings.push({sourceId:row.id,courseProgrammeId:row.courseProgrammeId,sortOrder:row.sortOrder,choiceShort:row.choiceShort,suitableForeignStudents:row.suitableForeignStudents,hasChanges:row.hasChanges,programmeId:row.programmeCode,year:row.year??null,fromYear:row.fromYear??null,periods,specialization:row.specialisationCode||null,specializationName:row.specialisation_sv||null,general:Boolean(row.specialisationGeneral),choice:row.choice,status:row.programmeStatus,groupId:row.groupId,footnote:row.footnote_sv||null,timePlans});
 if(row.specialisationCode&&!row.specialisationGeneral){if(!specializations.has(row.programmeCode))specializations.set(row.programmeCode,new Map());specializations.get(row.programmeCode).set(row.specialisationCode,row.specialisation_sv);}
}
const entityMap={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',auml:'ä',aring:'å',ouml:'ö',Auml:'Ä',Aring:'Å',Ouml:'Ö',eacute:'é',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“'};
function plain(html=''){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<\/(?:p|li|h[1-6]|ul|ol)>|<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi,(full,key)=>{if(key.startsWith('#')){const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):' ';}return entityMap[key]??full;}).replace(/[ \t\r]+/g,' ').split('\n').map(t=>t.trim()).filter(Boolean).join('\n').trim();}
function section(html,title){const match=html.match(new RegExp(`<h2[^>]*>\\s*${title}\\s*<\\/h2>([\\s\\S]*?)(?=<h2\\b|$)`,'i'));return plain(match?.[1]||'');}
const errors=[];
const courses=[...texts.values()].sort((a,b)=>a.code.localeCompare(b.code,'sv'));
if(!skipSyllabi){
 let cursor=0,completed=0;
 await Promise.all(Array.from({length:3},async()=>{
  while(cursor<courses.length){const course=courses[cursor++];try{
   const syllabus=await loadJson(`${api}/courses/${encodeURIComponent(course.code)}/syllabus/${ay}`,path.join(cacheDir,`${course.code}.json`));
   const html=syllabus.sv||'';
   course.purpose=section(html,'Syfte');course.contents=section(html,'Kursinnehåll');course.admission=section(html,'Antagningsuppgifter');
   course.prerequisites=course.admission;
   course.syllabusUrl=syllabus.originalUrl_sv||course.syllabusUrl;
   course.syllabusPdfUrl=syllabus.originalUrlPdf_sv||null;
   course.syllabusFetchedAt=(await fs.stat(path.join(cacheDir,`${course.code}.json`))).mtime.toISOString();
  }catch(error){errors.push({code:course.code,error:String(error.message)});}
  completed++;if(completed%100===0)console.log(`Syllabi ${completed}/${courses.length}`);if(!offline)await wait(100);
  }
 }));
}
const programmes=[...allProgrammes.values()].map(p=>{
 const matches=courses.filter(c=>c.offerings.some(o=>o.programmeId===p.programmeCode));
 return {id:p.programmeCode,code:p.programmeCode,name:p.programme_sv,nameEn:p.programme_en,type:null,courseCount:matches.length,activeCourseCount:matches.filter(c=>c.status==='active'&&c.offerings.some(o=>o.programmeId===p.programmeCode&&o.status==='active')).length,sourceUrl:`https://kurser.lth.se/lot/programme?ay=${ay}&programme=${encodeURIComponent(p.programmeCode)}`,specializations:[...(specializations.get(p.programmeCode)||new Map())].map(([id,name])=>({id,name}))};
});
const counts={programmes:programmes.length,programmesWithCourses:programmes.filter(p=>p.courseCount>0).length,courses:courses.length,activeCourses:courses.filter(c=>c.status==='active').length,offeringRows:rows.length,syllabi:courses.filter(c=>c.syllabusFetchedAt).length,syllabusErrors:errors.length};
const catalog={schemaVersion:1,academicYear:ay,academicYearLabel:`20${ay.slice(0,2)}/20${ay.slice(3)}`,fetchedAt,generatedAt,sourceUrl,apiUrls:[`${api}/courses/programmes`,`${api}/courses?academicYearId=${ay}`,`${api}/courses/{courseCode}/syllabus/${ay}`],counts,notes:['En daterad ögonblicksbild av offentlig LTH-information, inte en livekoppling.','Programmens utbildningstyp anges inte av programlistans API; type är därför null.','Program utan kursutbud under valt läsår behålls i programlistan.','LTH:s läsperioder sparas som källmetadata. Planeringens månader och datum väljs av användaren och är inte officiella schemadatum.','Antagningsuppgifter och kursinnehåll är officiell kursplanetext, inte en bedömning av studentens behörighet.','Inactive/offered-on-hold/exam-only courses are retained with their original source status.'],programmes,courses};
if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error('Dubbletter av källans kurskopplingar.');
if(courses.some(c=>!c.code||!c.title||!Number.isFinite(c.credits)||!c.offerings.length))throw new Error('Catalogue validation failed; output not replaced.');
await fs.writeFile(path.join(root,'dist','catalog.json'),JSON.stringify(catalog));
await fs.writeFile(path.join(root,'dist','catalog-data.js'),'// Official LTH course catalogue snapshot. Refresh with tools/sync-lth-catalog.mjs.\nwindow.STUDIE_CATALOG = '+JSON.stringify(catalog).replaceAll('<','\\u003c')+';\n');
await fs.writeFile(path.join(dataDir,`sync-report-${ay}.json`),JSON.stringify({fetchedAt,counts,errors},null,2));
console.log(JSON.stringify({counts,bytes:(await fs.stat(path.join(root,'dist','catalog.json'))).size,errors},null,2));
