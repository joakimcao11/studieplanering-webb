import { createPDF, createWord, downloadFile, exportScene, sceneSVG } from './exports.js';
import { normalizedExportSettings, templateDefaults } from './export-settings.js';
import { htmlEscape } from './catalog-view.js';

const exportEsc = htmlEscape;

export function openExportPanel(context) {
 const dialog = document.querySelector('#editor');
 const controller = new AbortController();
 const {signal} = controller;
 let settings = normalizedExportSettings({...context.saved,includeStudent:true});
 let temporaryName = '';
 let timer, revision = 0, busy = false, logoRevision = 0;
 const field = (name,label,type='text') => `<label>${label}<input name="${name}" type="${type}" value="${exportEsc(settings[name])}" maxlength="180"></label>`;
 const checkbox = (name,label) => `<label class="inline-check"><input type="checkbox" name="${name}" ${settings[name]?'checked':''}> ${label}</label>`;
 const select = (name,label,options,current) => `<label>${label}<select name="${name}">${options.map(([id,text])=>`<option value="${exportEsc(id)}" ${id===current?'selected':''}>${exportEsc(text)}</option>`).join('')}</select></label>`;

 dialog.classList.add('export-dialog');
 dialog.innerHTML = `<div class="dialog-head"><h2 id="editor-title">Förhandsgranska och exportera</h2><button data-export-close aria-label="Stäng export">✕</button></div>
 <div class="export-layout"><section class="export-settings" aria-label="Exportinställningar">
 <div class="form-grid">
 ${select('documentMode','Dokument',[['overview','Studieplan – översikt'],['detail','Detaljerat planeringsunderlag']],settings.documentMode)}
 ${field('date','Dokumentdatum','date')}
 ${select('scope','Omfattning',[['all','Hela planen'],['year',context.yearLabel],...(context.termOptions || [])],'all')}
 ${select('additionalScenario','Exportera scenario',[['','Enbart '+context.scenario.name],...context.others.map(s=>[s.id,context.scenario.name+' och '+s.name])],'')}
 </div>
 <label>Studentens namn (valfritt, används bara i detta dokument)<input id="temporary-name" maxlength="120" autocomplete="off" spellcheck="false"></label>
 <p class="note-footer">Namnet rensas efter nedladdning eller när du stänger dialogen.</p>
 <div class="form-grid">${field('advisor','Vägledarens namn')}${field('role','Titel')}${field('institution','Organisation')}</div>
 <details class="export-more"><summary>Anpassa dokument</summary>
 <div class="form-grid">${select('template','Mall',[['neutral','Neutral'],['lth','LTH – textmall'],['lu','LU – textmall'],['custom','Anpassad']],settings.template)}
 ${select('orientation','Pappersformat',[['portrait','A4 stående'],['landscape','A4 liggande']],settings.orientation)}
 ${field('documentTitle','Anpassad dokumentrubrik')}${field('accent','Accentfärg','color')}
 ${field('unit','Enhet / avdelning')}${field('postal','Postadress')}${field('visit','Besöksadress')}${field('phone','Telefon')}${field('email','E-post')}${field('web','Webbadress')}
 </div>
 <div id="custom-export-logo" ${settings.template==='custom'?'':'hidden'}><label>Egen godkänd logotyp (PNG/JPG, högst 1 MB)<input id="export-logo" type="file" accept="image/png,image/jpeg"></label><button data-export-remove-logo>Ta bort logotyp</button></div>
 <fieldset><legend>Avsnitt</legend>${checkbox('includeNotes','Överenskommelser, anteckningar och nästa steg')}${checkbox('includeContact','Kontaktuppgifter i dokumentet')}</fieldset>
 <fieldset><legend>Detaljerat dokument</legend>${checkbox('includePeriods','Officiell kursplacering')}${checkbox('includeRate','Studietakt')}${checkbox('includeDates','Egna planeringsdatum')}${checkbox('includeMonths','Planeringsmånader')}${checkbox('includeSources','Kursplanslänkar och fotnoter')}</fieldset>
 <p class="note-footer">Välj liggande A4 om flera uppgifter ska få plats i samma tabell.</p>
 <button data-export-save>Spara mallval</button>
 </details>
 <div class="export-utilities"><button data-export-refresh>Förhandsgranska</button><button data-export-backup>Exportera ärendet som JSON</button></div>
 </section><section class="export-preview" aria-label="Dokumentförhandsgranskning"><div class="export-preview-caption"><b>Förhandsgranskning</b><span id="export-page-count" role="status"></span></div>
 <div id="export-preview-pages" aria-busy="true"><p>Skapar förhandsgranskningen…</p></div><p class="preview-help">Förhandsgranskningen och PDF har samma sidlayout. Word kan radbryta annorlunda.</p></section></div>
 <div class="export-footer"><p id="export-status" role="status"></p><button data-export-close>Stäng</button><button data-export-download="pdf">↓ Ladda ner PDF</button><button class="primary" data-export-download="word">↓ Ladda ner Word</button></div>`;

 if (!document.querySelector('#export-fonts') && globalThis.STUDIE_FONTS) {
  const style = document.createElement('style');
  style.id = 'export-fonts';
  style.textContent = `@font-face{font-family:ExportSans;src:url(data:font/ttf;base64,${globalThis.STUDIE_FONTS.regular})} @font-face{font-family:ExportSans;font-weight:700;src:url(data:font/ttf;base64,${globalThis.STUDIE_FONTS.bold})}`;
  document.head.append(style);
 }
 const settingsHost = dialog.querySelector('.export-settings');
 const previewHost = dialog.querySelector('#export-preview-pages');
 const status = dialog.querySelector('#export-status');

 function read() {
  const next = {...settings};
  for (const field of settingsHost.querySelectorAll('[name]')) next[field.name] = field.type==='checkbox'?field.checked:field.value;
  temporaryName = settingsHost.querySelector('#temporary-name').value.trim();
  const {additionalScenario,...prefs} = next;
  settings = normalizedExportSettings(prefs);
  return additionalScenario;
 }
 function snapshot() {
  const extra = read();
  return context.snapshot(settings,temporaryName,extra);
 }
 async function preview() {
  const token = ++revision;
  previewHost.setAttribute('aria-busy','true');
  try {
   const scene = await exportScene(snapshot());
   if (signal.aborted || token!==revision) return;
   previewHost.innerHTML = sceneSVG(scene);
   dialog.querySelector('#export-page-count').textContent = scene.pages.length+(scene.pages.length===1?' sida':' sidor');
  } catch (error) {
   if (!signal.aborted && token===revision) previewHost.textContent = 'Kunde inte skapa förhandsgranskningen. '+error.message;
  } finally {
   if (!signal.aborted && token===revision) previewHost.setAttribute('aria-busy','false');
  }
 }
 function schedule() {
  revision++;
  clearTimeout(timer);
  timer = setTimeout(preview,200);
 }
 settingsHost.addEventListener('input',event=>{
  const field = event.target;
  if (field.id==='export-logo') return;
  if (field.name==='template') {
   const defaults = templateDefaults[field.value];
   settingsHost.querySelector('[name=accent]').value = defaults.accent;
   const institution = settingsHost.querySelector('[name=institution]');
   if (!institution.value || Object.values(templateDefaults).some(t=>t.institution===institution.value)) institution.value = defaults.institution;
   dialog.querySelector('#custom-export-logo').hidden = field.value!=='custom';
  }
  schedule();
 },{signal});
 settingsHost.addEventListener('change',async event=>{
  if (event.target.id!=='export-logo') return;
  const file = event.target.files[0];
  if (!file) return;
  const token = ++logoRevision;
  if (!['image/png','image/jpeg'].includes(file.type) || file.size>1024*1024) {
   status.textContent = 'Välj en PNG- eller JPG-bild på högst 1 MB.';
   return;
  }
  try {
   const image = await createImageBitmap(file);
   const reader = new FileReader();
   reader.onload = () => {
    if (!signal.aborted && token===logoRevision) {
     settings.customLogo = String(reader.result);
     settings.logoWidth = image.width;
     settings.logoHeight = image.height;
     schedule();
    }
    image.close();
   };
   reader.onerror = () => image.close();
   reader.readAsDataURL(file);
  } catch { status.textContent = 'Bilden kunde inte läsas.'; }
 },{signal});

 dialog.addEventListener('click',async event=>{
  const b = event.target.closest('button')?.dataset;
  if (!b) return;
  if ('exportClose' in b) { dialog.close(); return; }
  if ('exportBackup' in b) context.onBackup();
  if ('exportSave' in b) {
   read();
   status.textContent = context.onSave(settings)?'Mallval sparade på den här enheten.':'Mallvalen kunde inte sparas.';
  }
  if ('exportRemoveLogo' in b) { logoRevision++; settings.customLogo=''; dialog.querySelector('#export-logo').value=''; schedule(); }
  if ('exportRefresh' in b) { clearTimeout(timer); preview(); }
  if (!b.exportDownload || busy) return;
  busy = true;
  const controls = dialog.querySelectorAll('[data-export-download]');
  controls.forEach(button=>button.disabled=true);
  status.textContent = 'Skapar dokumentet…';
  try {
   const data = snapshot();
   const pdf = b.exportDownload==='pdf';
   const result = await (pdf ? createPDF(data) : createWord(data));
   if (signal.aborted) return;
   downloadFile(result,'Studieplanering'+(context.programme?'_'+context.programme:'')+'_'+settings.date+'.'+(pdf?'pdf':'docx'));
   temporaryName = '';
   settingsHost.querySelector('#temporary-name').value = '';
   previewHost.replaceChildren();
   schedule();
   status.textContent = 'Dokumentet är klart och finns i webbläsarens hämtningar.';
  } catch (error) { status.textContent = 'Exporten misslyckades. '+error.message; }
  finally {
   busy = false;
   controls.forEach(button=>button.disabled=false);
  }
 },{signal});
 dialog.addEventListener('close',()=>{
  clearTimeout(timer);
  controller.abort();
  temporaryName = '';
  settingsHost.querySelector('#temporary-name').value = '';
  previewHost.replaceChildren();
  dialog.classList.remove('export-dialog');
 },{once:true});
 dialog.showModal();
 preview();
}
