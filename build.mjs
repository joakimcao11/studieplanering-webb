import fs from 'node:fs';
const root = import.meta.dirname;
const read = name => fs.readFileSync(root + '/dist/' + name,'utf8');
const inline = value => value.replace(/<\/script/gi,'<\\/script');
let html = read('index.html');
const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)];
const css = styles.map(match => read(match[1])).join('\n');
styles.forEach(([tag],index) => { html = html.replace(tag, () => index ? '' : '<style>' + css + '</style>'); });
const modules = ['model.js','cases.js','lth-calendar.js','program-catalog.js','catalog-view.js','case-view.js','export-settings.js','exports.js','export-ui.js','app-v2.js'];
const strip = value => value.replace(/^\uFEFF/,'').replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const combined = modules.map(name => strip(read(name))).join('\n');
new Function(combined);
for (const [,name] of html.matchAll(/<script src="([^"]+)"><\/script>/g)) {
 html = html.replace('<script src="' + name + '"></script>', () => '<script>' + inline(read(name)) + '</script>');
}
html = html.replace('<script type="module" src="app-v2.js"></script>', () => '<script type="module">' + inline(combined) + '</script>');
fs.writeFileSync(root + '/Studieplanering.html',html);
console.log('Skapad: Studieplanering.html');
