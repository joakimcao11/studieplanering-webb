export const months=['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];
export function period(mode,year){
 const start=mode==='academic'||mode==='autumn'?7:0;
 const count=mode==='academic'||mode==='calendar'?12:mode==='autumn'?5:6;
 return Array.from({length:count},(_,i)=>({year:year+Math.floor((start+i)/12),month:(start+i)%12,key:`${year+Math.floor((start+i)/12)}-${String((start+i)%12+1).padStart(2,'0')}`}));
}
export function intersects(course,month){return course.start.slice(0,7)<=month.key&&course.end.slice(0,7)>=month.key;}
export function visibleCourses(courses,studentId,range){return courses.filter(c=>c.studentId===studentId&&range.some(m=>intersects(c,m)));}
export function switchedYear(from,to,year,selected){
 if(from===to)return year;
 if(from==='academic'&&to==='spring')return year+1;
 if(from==='academic'&&to==='autumn')return year;
 if(from==='spring'&&to==='academic')return year-1;
 if(from==='autumn'&&to==='academic')return year;
 const [selectedYear,selectedMonth]=selected.split('-').map(Number);
 return to==='academic'?selectedYear-(selectedMonth<8?1:0):selectedYear;
}
const validDate=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00Z');
 return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value;
};
export function validateCourse(c){
 if(!c.title.trim())return 'Ange ett kursnamn.';
 if(!validDate(c.start)||!validDate(c.end))return 'Ange giltiga start- och slutdatum.';
 if(c.end<c.start)return 'Slutdatum måste vara samma dag som eller efter startdatum.';
 if(!Number.isFinite(c.credits)||c.credits<=0||c.credits>120)return 'Ange högskolepoäng mellan 0,1 och 120.';
 if(c.studyRate!=null&&(!Number.isFinite(c.studyRate)||c.studyRate<=0||c.studyRate>400))return 'Ange studietakt mellan 1 och 400 procent, eller lämna tomt.';
 if(c.completedCredits!=null&&(!Number.isFinite(c.completedCredits)||c.completedCredits<0||c.completedCredits>c.credits))return 'Avklarade poäng måste ligga mellan 0 och kursens HP.';
 return '';
}
export function moveCourse(course,targetMonth){
 if(!/^\d{4}-\d{2}$/.test(targetMonth)||Number(targetMonth.slice(5))<1||Number(targetMonth.slice(5))>12)throw new Error('Ogiltig månad');
 const [y,m]=targetMonth.split('-').map(Number),[sy,sm,sd]=course.start.split('-').map(Number);
 const delta=(y-sy)*12+m-sm;
 const shift=value=>{const [a,b,d]=value.split('-').map(Number);const dt=new Date(Date.UTC(a,b-1+delta,1,12));const day=Math.min(d,new Date(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,0,12)).getUTCDate());return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;};
 return {...course,start:shift(course.start),end:shift(course.end),datesArePlanning:true};
}
export function validateImport(next){
 if(![1,2].includes(next?.version)||!Array.isArray(next.students)||!Array.isArray(next.courses))throw new Error('Ogiltig exportfil');
 const ids=new Set(),courseIds=new Set();
 for(const s of next.students){if(typeof s.id!=='string'||!s.id||ids.has(s.id)||typeof s.name!=='string'||!s.name.trim()||typeof s.program!=='string'||typeof s.year!=='string'||typeof s.note!=='string')throw new Error('Ogiltig student');ids.add(s.id);}
 for(const c of next.courses){if(typeof c.id!=='string'||!c.id||courseIds.has(c.id)||!ids.has(c.studentId)||typeof c.title!=='string'||typeof c.code!=='string'||typeof c.note!=='string'||typeof c.start!=='string'||typeof c.end!=='string'||validateCourse(c)||!['planned','progress','done','summer'].includes(c.status))throw new Error('Ogiltig kurs');courseIds.add(c.id);}
 return next;
}
export function summarize(courses){return {credits:courses.reduce((n,c)=>n+c.credits,0),done:courses.reduce((n,c)=>n+(c.status==='done'?c.credits:Math.min(c.credits,Math.max(0,Number(c.completedCredits)||0))),0),advanced:courses.filter(c=>/^A/.test(c.level||'')).reduce((n,c)=>n+c.credits,0)};}
export function removeStudentPlan(state,id){
 const s=state.students.find(s=>s.id===id);if(!s)throw Error('Studenten finns inte.');
 return {...state,students:state.students.filter(s=>s.id!==id),courses:state.courses.filter(c=>c.studentId!==id),deletedStudents:[...(state.deletedStudents||[]),{student:structuredClone(s),courses:structuredClone(state.courses.filter(c=>c.studentId===id)),deletedAt:new Date().toISOString()}]};
}
export function restoreStudentPlan(state,id){
 const item=(state.deletedStudents||[]).find(v=>v.student.id===id);if(!item||state.students.some(s=>s.id===id))throw Error('Studenten kan inte återställas.');
 return {...state,students:[...state.students,item.student],courses:[...state.courses,...item.courses],deletedStudents:state.deletedStudents.filter(v=>v.student.id!==id)};
}
export function purgeStudentPlan(state,id){return {...state,deletedStudents:(state.deletedStudents||[]).filter(v=>v.student.id!==id)};}
export function academicLabel(start){const y=Number(start.slice(0,4))-(Number(start.slice(5,7))<8?1:0);return `${y}/${y+1}`;}
export function coursePace(course){
 if(Number.isFinite(course.studyRate)&&course.studyRate>0)return {value:course.studyRate,manual:true};
 const days=(Date.parse(course.end+'T12:00:00Z')-Date.parse(course.start+'T12:00:00Z'))/86400000+1;
 return {value:days>0?Math.round(course.credits*7/(days*1.5)*100):0,manual:false};
}
