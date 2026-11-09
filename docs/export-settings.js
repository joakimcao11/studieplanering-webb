const genericContact = {institution:'',unit:'',role:'',postal:'',visit:'',phone:'',email:'',web:'',accent:'#173a75'};
export const templateDefaults = {
 neutral:{...genericContact}, lth:{...genericContact,institution:'Lunds Tekniska Högskola',accent:'#003b71'},
 lu:{...genericContact,institution:'Lunds universitet',accent:'#3b3025'}, custom:{...genericContact}
};
export function defaultExportSettings() {
 return {template:'neutral',documentMode:'overview',documentName:'Studieplanering',documentTitle:'Studieplanering',
  date:new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Stockholm'}),advisor:'',recipient:'',scope:'all',
  includeStudent:true,includeContact:false,includeNotes:true,includeSummary:true,includeSources:true,
  includeRate:true,includeAcademic:true,includeMonths:false,includePeriods:true,includeDates:true,includeStatus:true,
  orientation:'portrait',customLogo:'',...templateDefaults.neutral};
}
export function normalizedExportSettings(value={}) {
 const defaults = defaultExportSettings();
 const template = Object.hasOwn(templateDefaults,value.template)?value.template:'neutral';
 const out = {...defaults,...templateDefaults[template],...value,template};
 for (const key of Object.keys(defaults)) {
  if (typeof defaults[key]==='boolean') out[key] = typeof out[key]==='boolean'?out[key]:defaults[key];
  else if (typeof defaults[key]==='string' && key!=='customLogo') out[key] = typeof out[key]==='string'?out[key].trim().slice(0,180):defaults[key];
 }
 if (!/^#[a-f\d]{6}$/i.test(out.accent)) out.accent=defaults.accent;
 if (!['portrait','landscape'].includes(out.orientation)) out.orientation='portrait';
 if (!['overview','detail'].includes(out.documentMode)) out.documentMode='overview';
 const parsed = new Date(out.date+'T12:00:00Z');
 if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0,10)!==out.date) out.date=defaults.date;
 out.documentName=out.documentName || defaults.documentName;
 out.documentTitle=out.documentTitle || out.documentName;
 if (typeof out.customLogo!=='string' || out.customLogo.length>1600000 || !/^data:image\/(png|jpeg);base64,[a-z\d+/=]+$/i.test(out.customLogo)) out.customLogo='';
 return out;
}
export function exportColumns(settings){const columns=[{key:'code',label:'Kurskod',weight:57},{key:'title',label:'Namn',weight:160},{key:'credits',label:'HP',weight:28}];if(settings.includeRate)columns.push({key:'pace',label:'Studietakt',weight:56});if(settings.includeAcademic)columns.push({key:'academic',label:'Läsår',weight:77},{key:'term',label:'Termin',weight:64});if(settings.includeMonths)columns.push({key:'months',label:'Månader',weight:64});if(settings.includePeriods)columns.push({key:'periods',label:'LTH:s LP',weight:48});if(settings.includeDates)columns.push({key:'dates',label:'Planeringsdatum',weight:95});if(settings.includeStatus)columns.push({key:'statusLabel',label:'Status',weight:65});return columns;}
