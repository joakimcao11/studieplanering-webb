import {academicLabel,coursePace} from './model.js';
import {normalizedExportSettings,exportColumns} from './export-settings.js';
const exportStatuses={planned:'Planerad',progress:'Pågår',done:'Avklarad',summer:'Sommarstudier'};
const exportNumber=n=>Number(n).toLocaleString('sv-SE');
const xmlSafe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function exportSnapshot(student,courses,scope,catalog,options={}){
 const settings=normalizedExportSettings(options);
 const rows=courses.slice().sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title,'sv')).map(c=>{
  const first=academicLabel(c.start),last=academicLabel(c.end),startMonth=Number(c.start.slice(5,7)),endMonth=Number(c.end.slice(5,7));
  const shortDate=value=>new Date(value+'T12:00:00').toLocaleDateString('sv-SE',{month:'short',year:c.start.slice(0,4)===c.end.slice(0,4)?undefined:'numeric'});
  const semester=m=>m>=8?'Hösttermin':m===7?'Sommar':'Vårtermin';
  const official=catalog?.courses?.find(v=>v.code===c.code),offers=(official?.offerings||[]).filter(o=>!student.programmeId||o.programmeId===student.programmeId),periods=[...new Set(offers.flatMap(o=>o.periods))].sort();
  const pace=coursePace(c);
  return {...c,statusLabel:exportStatuses[c.status],academic:first===last?first:first+' – '+last,term:c.status==='summer'?'Sommar':first===last&&semester(startMonth)===semester(endMonth)?semester(startMonth):'Flera delar av året',months:shortDate(c.start)+(c.start.slice(0,7)===c.end.slice(0,7)?'':' – '+shortDate(c.end)),pace:pace.value+'%'+(pace.manual?'':'*'),creditsLabel:exportNumber(c.credits),periods:periods.length?periods.map(n=>'LP'+n).join(', '):'Ej angivet',dates:c.start+' – '+c.end};
 });
 const completed=c=>c.status==='done'?c.credits:Math.min(c.credits,Math.max(0,Number(c.completedCredits)||0));
 return {title:settings.documentTitle,student:{...student},scope,created:settings.date,settings,courses:rows,total:rows.reduce((n,c)=>n+c.credits,0),done:rows.reduce((n,c)=>n+completed(c),0),source:catalog?`LTH kursutbud ${catalog.academicYearLabel}. Hämtat ${catalog.fetchedAt.slice(0,10)}. Källa: ${catalog.sourceUrl}`:'Egna planeringsuppgifter.'};
}
function exportLogo(settings) {
 if (settings.template!=='custom' || !settings.customLogo) return null;
 return {dataUrl:settings.customLogo,width:settings.logoWidth||160,height:settings.logoHeight||70};
}
function exportContent(snapshot) {
 if (snapshot.blocks) return snapshot;
 const {settings,courses,student} = snapshot;
 const columns = exportColumns(settings);
 return {...snapshot,documentInfo:settings.includeStudent?[student.name,student.program,student.year].filter(Boolean):[],
  blocks:[{kind:'heading',text:'Handlingsplan – kurser'},
   {kind:'table',labels:columns.map(c=>c.label),weights:columns.map(c=>c.weight),
    rows:courses.length?courses.map(c=>columns.map(col=>String(col.key==='credits'?c.creditsLabel:c[col.key]??''))):[columns.map((_,i)=>i===1?'Inga kurser.':'')]},
   ...(settings.includeNotes && student.note ? [{kind:'heading',text:'Anteckningar och nästa steg'},{kind:'paragraph',text:student.note}]:[])]};
}
export async function exportScene(s,lib=globalThis.PDFLib){
 if(!lib)throw Error('PDF-stödet kunde inte laddas.');
 s = exportContent(s);
 const pdf=await lib.PDFDocument.create(),serif=s.settings.template==='lu';
 let normal,bold;
 if(globalThis.fontkit&&globalThis.STUDIE_FONTS){pdf.registerFontkit(globalThis.fontkit);const bytes=v=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));normal=await pdf.embedFont(bytes(globalThis.STUDIE_FONTS.regular),{subset:true});bold=await pdf.embedFont(bytes(globalThis.STUDIE_FONTS.bold),{subset:true});}
 else{normal=await pdf.embedFont(lib.StandardFonts.Helvetica);bold=await pdf.embedFont(lib.StandardFonts.HelveticaBold);}
 const serifNormal=serif?await pdf.embedFont(lib.StandardFonts.TimesRoman):null,serifBold=serif?await pdf.embedFont(lib.StandardFonts.TimesRomanBold):null;
 const chooseFont=(value,strong=false)=>{if(serif){const candidate=strong?serifBold:serifNormal;try{candidate.widthOfTextAtSize(value,10);return candidate;}catch{}}return strong?bold:normal;};
 const width=s.settings.orientation==='landscape'?841.89:595.28,height=s.settings.orientation==='landscape'?595.28:841.89,margin=46,contentWidth=width-2*margin;
 const accent=s.settings.template==='lu'?'#201b17':s.settings.accent,logo=exportLogo(s.settings),pages=[];let page,y;
 const clean=v=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/\t/g,' ');
 const wrap=(v,max,size=10,strong=false)=>{const text=clean(v),font=chooseFont(text,strong),lines=[];for(const raw of text.split('\n')){let line='';for(const word of raw.split(/\s+/)){if(!word)continue;const candidate=line?line+' '+word:word;if(font.widthOfTextAtSize(candidate,size)<=max){line=candidate;continue;}if(line){lines.push(line);line='';}if(font.widthOfTextAtSize(word,size)<=max){line=word;continue;}for(const ch of word){if(font.widthOfTextAtSize(line+ch,size)>max&&line){lines.push(line);line='';}line+=ch;}}lines.push(line||' ');}return lines;};
 const write=(text,x,top,size=10,strong=false,color='#111111',italic=false)=>page.push({kind:'text',text:clean(text),x,y:top,size,strong,color,italic,serif:serif&&chooseFont(clean(text),strong)===(strong?serifBold:serifNormal)});
 const line=(x1,y1,x2,y2,color='#d8dde3',weight=.5)=>page.push({kind:'line',x1,y1,x2,y2,color,weight});
 const addPage=()=>{page=[];pages.push(page);const headerTop=46;let logoHeight=0;if(logo){const maxW=serif?46:74,maxH=serif?58:45,scale=Math.min(maxW/logo.width,maxH/logo.height);logoHeight=logo.height*scale;page.push({kind:'image',...logo,x:margin,y:headerTop,width:logo.width*scale,height:logoHeight});}const meta=[[s.settings.role,s.settings.advisor].filter(Boolean).join(' · '),s.settings.institution,s.settings.unit,s.settings.date].filter(Boolean);let metaY=headerTop;meta.forEach((v,i)=>{const f=chooseFont(v,i===0);for(const t of wrap(v,contentWidth*.60,9,i===0)){write(t,width-margin-f.widthOfTextAtSize(t,9),metaY,9,i===0,accent);metaY+=12;}});y=Math.max(headerTop+logoHeight,metaY)+10;line(margin,y,width-margin,y,accent,1);y+=19;if(pages.length>1){const continuation=wrap(s.title+' · fortsättning',contentWidth,12,true);for(const t of continuation){write(t,margin,y,12,true,accent);y+=16;}y+=10;}};
 const ensure=h=>{if(y+h>height-49)addPage();};
 const paragraph=(value,{size=10,strong=false,color='#111111',after=8,italic=false}={})=>{const lines=wrap(value,contentWidth,size,strong);for(const [index,t] of lines.entries()){ensure(lines.length-index===2?(size+4)*2:size+5);write(t,margin,y,size,strong,color,italic);y+=size+4;}y+=after;};
 const heading=value=>{ensure(42);paragraph(value,{size:11,strong:true,color:accent,after:7});};
 addPage();
 if(s.settings.includeContact){const contact=[s.settings.postal&&'Postadress '+s.settings.postal,s.settings.visit&&'Besöksadress '+s.settings.visit,s.settings.phone&&'Telefon '+s.settings.phone,s.settings.email&&'E-post '+s.settings.email,s.settings.web&&'Webb '+s.settings.web].filter(Boolean).join('   ');if(contact)paragraph(contact,{size:7.5,color:'#555c67',italic:true,after:13});}
 paragraph(s.title,{size:17,strong:true,color:serif?'#111111':accent,after:9});
 for (const info of s.documentInfo) paragraph(info,{size:10,after:4});
 const table = block => {
  const totalWeight = block.weights.reduce((n,w)=>n+w,0);
  const widths = block.weights.map(w=>contentWidth*w/totalWeight);
  const size = 9.2, rowStep = size+3;
  const linesFor = (row,head) => row.map((value,i)=>wrap(value,widths[i]-10,size,head));
  const draw = (cells,count,head) => {
   const top = y, rowHeight = count*rowStep+10;
   let x = margin;
   cells.forEach((parts,i)=>{
    page.push({kind:'rect',x,y:top,width:widths[i],height:rowHeight,fill:head?'#f0f2f5':'#ffffff',stroke:'#dce4eb'});
    parts.forEach((text,j)=>write(text,x+5,top+4+j*rowStep,size,head));
    x+=widths[i];
   });
   y+=rowHeight;
  };
  const header = linesFor(block.labels,true);
  const headerLines = Math.max(...header.map(c=>c.length));
  const firstRowLines = block.rows[0] ? Math.max(...linesFor(block.rows[0],false).map(c=>c.length)) : 1;
  ensure((headerLines+Math.min(firstRowLines,3))*rowStep+20);
  const drawHeader = () => draw(header,headerLines,true);
  drawHeader();
  for (const row of block.rows) {
   const cells = linesFor(row,false);
   const length = Math.max(...cells.map(c=>c.length));
   let index = 0;
   while (index<length) {
    let room = Math.floor((height-49-y-10)/rowStep);
    if (room<Math.min(length-index,3) || (index===0 && length<=8 && room<length)) {
     addPage();
     drawHeader();
     room = Math.floor((height-49-y-10)/rowStep);
    }
    const count = Math.min(room,length-index);
    draw(cells.map(c=>c.slice(index,index+count)),count,false);
    index+=count;
   }
  }
  y+=10;
 };
 for (const block of s.blocks) {
  if (block.kind==='scenario') {
   ensure(100);
   y+=9;
   paragraph('Scenario: '+block.text,{size:14,strong:true,color:accent,after:10});
  } else if (block.kind==='heading') {
   ensure(85);
   heading(block.text);
  } else if (block.kind==='table') table(block);
  else paragraph(block.text,{size:10,after:7});
 }
 for(let i=0;i<pages.length;i++){page=pages[i];const footerLines=wrap(s.settings.documentName+' · '+s.settings.date,contentWidth-50,7);write(footerLines[0]+(footerLines.length>1?'…':''),margin,height-29,7,false,'#697480');const right=`${i+1}/${pages.length}`;write(right,width-margin-normal.widthOfTextAtSize(right,7),height-29,7,false,'#697480');}
 return {pdf,pages,width,height,normal,bold,serifNormal,serifBold,chooseFont};
}
export function sceneSVG(scene){return scene.pages.map((items,index)=>`<svg role="img" aria-label="Förhandsgranskning sida ${index+1}" viewBox="0 0 ${scene.width} ${scene.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/>${items.map(i=>i.kind==='text'?`<text x="${i.x}" y="${i.y+i.size}" font-size="${i.size}" font-weight="${i.strong?700:400}" font-style="${i.italic?'italic':'normal'}" font-family="${i.serif?'Times New Roman, serif':'ExportSans, Arial, sans-serif'}" fill="${i.color}">${xmlSafe(i.text)}</text>`:i.kind==='line'?`<line x1="${i.x1}" y1="${i.y1}" x2="${i.x2}" y2="${i.y2}" stroke="${i.color}" stroke-width="${i.weight}"/>`:i.kind==='rect'?`<rect x="${i.x}" y="${i.y}" width="${i.width}" height="${i.height}" fill="${i.fill}" stroke="${i.stroke}" stroke-width=".5"/>`:`<image href="${xmlSafe(i.dataUrl)}" x="${i.x}" y="${i.y}" width="${i.width}" height="${i.height}"/>`).join('')}</svg>`).join('');}
export async function createPDF(s,lib=globalThis.PDFLib){const scene=await exportScene(s,lib),{pdf}=scene;pdf.setTitle(s.title);pdf.setAuthor(s.settings.advisor||'Studieplanering');const rgb=hex=>{const n=parseInt(hex.slice(1),16);return lib.rgb((n>>16&255)/255,(n>>8&255)/255,(n&255)/255);};const images=new Map();for(const items of scene.pages){const p=pdf.addPage([scene.width,scene.height]);for(const i of items){if(i.kind==='text')p.drawText(i.text,{x:i.x,y:scene.height-i.y-i.size,size:i.size,font:scene.chooseFont(i.text,i.strong),color:rgb(i.color)});else if(i.kind==='line')p.drawLine({start:{x:i.x1,y:scene.height-i.y1},end:{x:i.x2,y:scene.height-i.y2},color:rgb(i.color),thickness:i.weight});else if(i.kind==='rect')p.drawRectangle({x:i.x,y:scene.height-i.y-i.height,width:i.width,height:i.height,color:rgb(i.fill),borderColor:rgb(i.stroke),borderWidth:.5});else{if(!images.has(i.dataUrl))images.set(i.dataUrl,await(i.dataUrl.startsWith('data:image/jpeg')?pdf.embedJpg(i.dataUrl):pdf.embedPng(i.dataUrl)));p.drawImage(images.get(i.dataUrl),{x:i.x,y:scene.height-i.y-i.height,width:i.width,height:i.height});}}}return new Blob([await pdf.save()],{type:'application/pdf'});}
export async function createWord(s,lib=globalThis.docx){
 if(!lib)throw Error('Word-stödet kunde inte laddas.');
 s = exportContent(s);
 const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,ImageRun,WidthType,HeadingLevel,AlignmentType,BorderStyle,Footer,Header,PageNumber}=lib,p=s.settings,serif=p.template==='lu',font=serif?'Times New Roman':'Arial',accent=serif?'201B17':p.accent.slice(1),logo=exportLogo(p),landscape=p.orientation==='landscape',totalWidth=landscape?14200:10050;
 const para=(text,opts={})=>new Paragraph({spacing:{after:100,line:250},children:[new TextRun({text:String(text),font,size:20,color:'111111',...opts.run})],...opts});
 const border={style:BorderStyle.SINGLE,size:4,color:'DCE4EB'};
 const noBorder={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
 const children=[];const logoChildren=[];
 if(logo){const bytes=Uint8Array.from(atob(logo.dataUrl.split(',')[1]),c=>c.charCodeAt(0)),scale=Math.min((serif?60:100)/logo.width,(serif?76:60)/logo.height);logoChildren.push(new Paragraph({children:[new ImageRun({data:bytes,type:logo.dataUrl.startsWith('data:image/jpeg')?'jpg':'png',transformation:{width:logo.width*scale,height:logo.height*scale}})]}));}else logoChildren.push(para(''));
 children.push(new Table({width:{size:totalWidth,type:WidthType.DXA},columnWidths:[Math.floor(totalWidth*.30),Math.floor(totalWidth*.70)],borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideHorizontal:noBorder,insideVertical:noBorder},rows:[new TableRow({children:[new TableCell({children:logoChildren,borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder}}),new TableCell({borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},children:[[p.role,p.advisor].filter(Boolean).join(' · '),p.institution,p.unit,p.date].filter(Boolean).map(v=>para(v,{alignment:AlignmentType.RIGHT,spacing:{after:40},run:{size:18}}))})]})]}));
 children.push(new Paragraph({spacing:{before:80,after:160},border:{bottom:{style:BorderStyle.SINGLE,size:8,color:accent}}}));
 if(p.includeContact){const contact=[p.postal&&'Postadress '+p.postal,p.visit&&'Besöksadress '+p.visit,p.phone&&'Telefon '+p.phone,p.email&&'E-post '+p.email,p.web&&'Webb '+p.web].filter(Boolean).join('   ');if(contact)children.push(para(contact,{run:{size:15,italics:true,color:'555C67'},spacing:{after:180}}));}
 children.push(para(s.title,{heading:HeadingLevel.TITLE,run:{size:34,bold:true,color:'111111'},spacing:{after:160},keepNext:true}));
 for (const info of s.documentInfo) children.push(para(info,{run:{size:20}}));
 const heading = (value,scenario=false)=>para(value,{heading:HeadingLevel.HEADING_1,run:{size:scenario?28:22,bold:true,color:accent},spacing:{before:180,after:100},keepNext:true});
 for (const block of s.blocks) {
  if (block.kind==='scenario') children.push(heading('Scenario: '+block.text,true));
  else if (block.kind==='heading') children.push(heading(block.text));
  else if (block.kind==='paragraph') children.push(...block.text.split('\n').map(line=>para(line||' ')));
  else {
   const weight = block.weights.reduce((n,w)=>n+w,0);
   const widths = block.weights.map(w=>Math.floor(totalWidth*w/weight));
   const makeCell = (text,i,head)=>new TableCell({width:{size:widths[i],type:WidthType.DXA},
    margins:{top:85,bottom:85,left:90,right:90},borders:{top:border,bottom:border,left:border,right:border},
    shading:{fill:head?'F0F2F5':'FFFFFF'},
    children:String(text).split('\n').map(value=>para(value||' ',{spacing:{after:0,line:220},run:{size:18,bold:head}}))});
   const rows = [new TableRow({tableHeader:true,children:block.labels.map((value,i)=>makeCell(value,i,true))}),
    ...block.rows.map(row=>new TableRow({children:row.map((value,i)=>makeCell(value,i,false))}))];
   children.push(new Table({width:{size:totalWidth,type:WidthType.DXA},columnWidths:widths,rows}));
  }
 }
 const createFooter = () => new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[
  new TextRun({children:['Sida ',PageNumber.CURRENT,' av ',PageNumber.TOTAL_PAGES],font,size:16,color:'52647B'})
 ]})]});
 const continuation = new Header({children:[para(s.title+' · fortsättning',{
  alignment:AlignmentType.LEFT,spacing:{after:30},run:{size:16,color:accent,bold:true}
 })]});
 const blankHeader = new Header({children:[new Paragraph('')]});
 const doc=new Document({creator:p.advisor||'Studieplanering',title:s.title,styles:{default:{document:{run:{font,size:20,color:'111111'}}},paragraphStyles:[{id:'Title',name:'Title',basedOn:'Normal',next:'Normal',run:{font,size:34,color:accent,bold:true},paragraph:{spacing:{after:160}}},{id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',run:{font,size:22,color:accent,bold:true},paragraph:{spacing:{before:160,after:100}}}]},sections:[{headers:{first:blankHeader,default:continuation},footers:{first:createFooter(),default:createFooter()},properties:{titlePage:true,page:{size:{width:landscape?16838:11906,height:landscape?11906:16838},margin:{top:920,bottom:920,left:928,right:928,header:405}}},children}]});return Packer.toBlob(doc);
}
export function downloadFile(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
