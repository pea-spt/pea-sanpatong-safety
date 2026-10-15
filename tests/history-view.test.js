import test from 'node:test';import assert from 'node:assert/strict';
import {historyRows} from '../history-view.js';import {reviseWithdrawal} from '../withdrawal-cancel.js';
function base(){return {items:{a:{name:'A',unit:'pair',qty:8,active:true},b:{name:'B',unit:'pair',qty:5,active:true}},movements:{w:{id:'w',kind:'withdrawal',personName:'Original',empId:'001',personId:'p',date:'2026-09-22',ts:1,lines:[{itemId:'a',name:'A',unit:'pair',qty:2,delta:-2}]},other:{id:'other',kind:'receipt',ts:2,lines:[{itemId:'b',name:'B',delta:5}]}}};}
test('added lines stay after original bill lines, with original name, type, date and order',()=>{
 const s=reviseWithdrawal(base(),'w',{id:'edit',expectedVersion:0,reason:'add',lines:[{itemId:'b',qty:3}]},{uid:'actor'},100);
 const rows=historyRows(s);assert.deepEqual(rows.map(r=>r.id),['other','w','w']);assert.deepEqual(rows.slice(1).map(r=>[r.itemId,r.personName,r.kind,r.date,r.delta]),[['a','Original','withdrawal','2026-09-22',-2],['b','Original','withdrawal','2026-09-22',-3]]);assert.equal(s.movements.edit.ts,100);assert.equal(s.movements.w.lines.length,1);
});
test('removal hides deleted line; edits replace quantities once and CSV rows share the result',()=>{
 let s=reviseWithdrawal(base(),'w',{id:'edit',expectedVersion:0,reason:'add',lines:[{itemId:'b',qty:3}]},{uid:'actor'},100);
 s=reviseWithdrawal(s,'w',{id:'undo',expectedVersion:1,reason:'remove',lines:[{itemId:'b',qty:0},{itemId:'a',qty:4}]},{uid:'actor'},101);
 assert.deepEqual(historyRows(s).filter(r=>r.id==='w').map(r=>[r.itemId,r.delta]),[['a',-4]]);assert.equal(s.items.b.qty,5);assert.ok(s.movements.edit);assert.ok(s.movements.undo);
});
