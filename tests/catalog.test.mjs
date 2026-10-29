import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/catalog.json',import.meta.url)));
test('LTH-katalogen lagrar program, kurskopplingar och alla hämtade kursplaner',()=>{assert.equal(catalog.academicYear,'26_27');assert.equal(catalog.programmes.length,61);assert.equal(catalog.courses.length,1253);assert.equal(new Set(catalog.courses.map(c=>c.code)).size,1253);assert.ok(catalog.courses.every(c=>c.credits>0&&c.contents&&c.admission));const programmes=new Set(catalog.programmes.map(p=>p.id));assert.ok(catalog.courses.every(c=>c.offerings.every(o=>programmes.has(o.programmeId))));});
test('Webbprogrammering har officiellt innehåll, poäng och kursplankälla',()=>{const c=catalog.courses.find(c=>c.code==='EDAF90');assert.equal(c.credits,7.5);assert.match(c.contents,/JavaScript/i);assert.match(c.syllabusUrl,/kurser.lth.se/);assert.match(c.prerequisites,/EDAA/);assert.ok(c.offerings.some(o=>o.programmeId==='D'));});
