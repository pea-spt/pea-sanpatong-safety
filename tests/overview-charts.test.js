import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewModel,overviewCharts} from '../overview-charts.js';
import {filterLines} from '../meeting.js';
const line={officeId:'sanpatong',office:'สันป่าตอง',personId:'p',person:'ชื่อเดียวกัน',position:'ช่าง',empId:'',id:'w',date:'2026-01-02',ts:1,itemId:'hat',item:'หมวก',variant:'ขาว',zone:'ศีรษะ',unit:'ใบ',qty:3};
test('recipient summaries keep equipment, variants and issuing stockrooms separate',()=>{
 const m=overviewModel([line,{...line,id:'w2',qty:2},{...line,itemId:'mask',item:'หน้ากาก',qty:4},{...line,itemId:'blue-hat',variant:'ฟ้า',qty:1},{...line,personOfficeId:'sanpatong',officeId:'maewang',office:'แม่วาง',qty:6}]);
 assert.equal(m.recipients.length,1);const p=m.recipients[0];assert.equal(p.bills,3);assert.equal(p.items.length,4);
 assert.deepEqual(p.items.map(i=>i.qty),[5,4,1,6]);
 assert.ok(!('units' in p));
});
test('same roster identity combines across issuing offices but different rosters remain distinct',()=>{
 const m=overviewModel([line,{...line,personOfficeId:'sanpatong',personOffice:'สันป่าตอง',officeId:'maewang',office:'แม่วาง'}, {...line,officeId:'maewang',office:'แม่วาง'}]);
 assert.equal(m.recipients.length,2);assert.equal(m.recipients.find(p=>p.personOfficeId==='sanpatong').items.length,2);
});
test('recipients sort by withdrawal date then timestamp and expose latest name',()=>{
 const m=overviewModel([line,{...line,person:'ชื่อใหม่',date:'2026-04-01',ts:2},{...line,personId:'p2',date:'2026-03-31',ts:999},{...line,personId:'p3',date:'2026-04-01',ts:3}]);
 assert.deepEqual(m.recipients.map(p=>p.personId),['p3','p','p2']);assert.equal(m.recipients[1].person,'ชื่อใหม่');
});
test('filters affect per-person quantities and output has no graphs or unsafe markup',()=>{
 const lines=[line,{...line,date:'2026-03-02',qty:7}];
 const selected=overviewModel(filterLines(lines,{from:'2026-03-01',to:'2026-03-31'}));
 assert.equal(selected.recipients[0].items[0].qty,7);assert.equal(selected.recipients[0].bills,1);
 assert.ok(overviewCharts([]).includes('ไม่มีข้อมูลการเบิกจ่าย'));
 const html=overviewCharts([{...line,person:'<script>',item:'<img src=x onerror=alert(1)>'}]);
 assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<svg'));assert.ok(!html.includes('overview-bar'));assert.ok(!html.includes('overview-month'));
 assert.ok(html.includes('จ่ายจาก สันป่าตอง'));assert.ok(html.includes('2026-01-02'));
});

test('recipient equipment with the same SKU combines after variant correction; other SKU stays distinct',()=>{const m=overviewModel([{...line,variant:'ยังไม่ระบุไซส์',date:'2026-01-01',qty:1},{...line,variant:'ไซส์ 47',date:'2026-02-01',qty:2},{...line,itemId:'another',variant:'ไซส์ 47',qty:5}]);assert.equal(m.recipients[0].items.length,2);assert.equal(m.recipients[0].items.find(x=>x.itemId==='hat').qty,3);assert.equal(m.recipients[0].items.find(x=>x.itemId==='hat').variant,'ไซส์ 47');});
