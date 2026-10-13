import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewModel,overviewCharts} from '../overview-charts.js';
import {filterLines} from '../meeting.js';
const line={officeId:'sanpatong',office:'สันป่าตอง',personId:'p',person:'ชื่อเดียวกัน',position:'ช่าง',empId:'',id:'w',date:'2026-01-02',item:'หมวก',variant:'ขาว',zone:'ศีรษะ',unit:'ใบ',qty:3};
test('overview keeps people distinct by ID, avoids duplicate people, and separates units',()=>{
 const m=overviewModel([line,{...line,id:'w2',qty:2},{...line,personId:'p2',unit:'คู่',item:'ถุงมือ',qty:4},{...line,officeId:'maewang',office:'แม่วาง',qty:1}]);
 assert.equal(m.summary.people,3);assert.equal(m.people.reduce((n,r)=>n+r.qty,0),3);
 assert.deepEqual(m.summary.units,{'ใบ':6,'คู่':4});
 assert.equal(m.zones.find(r=>r.unit==='ใบ').qty,6);assert.equal(m.zones.find(r=>r.unit==='คู่').qty,4);
});
test('monthly charts fill missing months and filters affect every chart',()=>{
 const lines=[line,{...line,date:'2026-03-02',qty:7}],m=overviewModel(lines);
 assert.deepEqual(m.months[0].rows.map(r=>[r.label,r.qty]),[['2026-01',3],['2026-02',0],['2026-03',7]]);
 const selected=overviewModel(filterLines(lines,{from:'2026-03-01',to:'2026-03-31'}));
 assert.equal(selected.summary.units['ใบ'],7);assert.equal(selected.zones[0].qty,7);assert.equal(selected.items[0].qty,7);
 assert.ok(overviewCharts([]).includes('ไม่มีข้อมูลการเบิกจ่าย'));assert.ok(!overviewCharts([{...line,item:'<img src=x onerror=alert(1)>'}]).includes('<img src=x'));
});
