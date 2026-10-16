import test from 'node:test';import assert from 'node:assert/strict';
import {historyRows,historyGroups} from '../history-view.js';import {reviseWithdrawal} from '../withdrawal-cancel.js';
function base(){return {items:{a:{name:'A',unit:'pair',qty:8,active:true},b:{name:'B',unit:'pair',qty:5,active:true}},movements:{w:{id:'w',kind:'withdrawal',personName:'Original',empId:'001',personId:'p',date:'2026-09-22',ts:1,lines:[{itemId:'a',name:'A',unit:'pair',qty:2,delta:-2}]},other:{id:'other',kind:'receipt',date:'2026-09-23',ts:2,lines:[{itemId:'b',name:'B',delta:5}]}}};}
test('added lines stay after original bill lines, with original name, type, date and order',()=>{
 const s=reviseWithdrawal(base(),'w',{id:'edit',expectedVersion:0,reason:'add',lines:[{itemId:'b',qty:3}]},{uid:'actor'},100);
 const rows=historyRows(s);assert.deepEqual(rows.map(r=>r.id),['other','w','w']);assert.deepEqual(rows.slice(1).map(r=>[r.itemId,r.personName,r.kind,r.date,r.delta]),[['a','Original','withdrawal','2026-09-22',-2],['b','Original','withdrawal','2026-09-22',-3]]);assert.equal(s.movements.edit.ts,100);assert.equal(s.movements.w.lines.length,1);
});
test('removal hides deleted line; edits replace quantities once and CSV rows share the result',()=>{
 let s=reviseWithdrawal(base(),'w',{id:'edit',expectedVersion:0,reason:'add',lines:[{itemId:'b',qty:3}]},{uid:'actor'},100);
 s=reviseWithdrawal(s,'w',{id:'undo',expectedVersion:1,reason:'remove',lines:[{itemId:'b',qty:0},{itemId:'a',qty:4}]},{uid:'actor'},101);
 assert.deepEqual(historyRows(s).filter(r=>r.id==='w').map(r=>[r.itemId,r.delta]),[['a',-4]]);assert.equal(s.items.b.qty,5);assert.ok(s.movements.edit);assert.ok(s.movements.undo);
});

test('groups nonadjacent bills for the same person and day without merging offices or receipts',()=>{
 const rows=[
  {id:'a',kind:'withdrawal',personId:'p',date:'2026-10-16'},
  {id:'b',kind:'withdrawal',personId:'q',date:'2026-10-16'},
  {id:'c',kind:'withdrawal',personId:'p',date:'2026-10-16'},
  {id:'d',kind:'withdrawal',personId:'p',date:'2026-10-15'},
  {id:'e',kind:'withdrawal',personId:'p',personOfficeId:'other',date:'2026-10-16'},
  {id:'f',kind:'receipt',date:'2026-10-16'},
  {id:'g',kind:'withdrawal',date:'2026-10-16'}
 ];
 const groups=historyGroups(rows);
 assert.deepEqual(groups.map(g=>g.rows.map(r=>r.id)),[['a','c'],['b'],['e'],['f'],['g'],['d']]);
 assert.equal(groups[3].grouped,false);assert.equal(groups[4].grouped,false);
 assert.equal(rows.length,7);
});


test('history and groups use issue date before entry timestamp, with undated records last',()=>{
 const movement=(id,date,ts,personId=id)=>({id,kind:'withdrawal',date,ts,personId,lines:[{itemId:'a',qty:1,delta:-1}]});
 const state={movements:{backdated:movement('backdated','2026-10-01',999),recent:movement('recent','2026-10-16',1),undated:movement('undated','',1000),sameDay:movement('sameDay','2026-10-16',2)}};
 const original=structuredClone(state),rows=historyRows(state);
 assert.deepEqual(rows.map(r=>r.id),['sameDay','recent','backdated','undated']);
 assert.deepEqual(historyGroups(Object.values(state.movements)).map(g=>g.rows[0].id),['sameDay','recent','backdated','undated']);
 assert.deepEqual(state,original);
 state.movements.backdated.date='2026-10-17';
 assert.equal(historyRows(state)[0].id,'backdated');
});
test('same person returning five minutes later stays in one date group with two traceable bills',()=>{
 const s=base();s.movements={first:{...s.movements.w,id:'first',date:'2026-10-16',ts:1000,lines:[{itemId:'a',qty:1,delta:-1}]},second:{...s.movements.w,id:'second',date:'2026-10-16',ts:301000,lines:[{itemId:'a',qty:1,delta:-1}]}};
 const groups=historyGroups(historyRows(s),'sanpatong');
 assert.equal(groups.length,1);assert.deepEqual(groups[0].rows.map(r=>r.id),['second','first']);
 assert.equal(groups[0].rows.reduce((n,r)=>n-r.delta,0),2);
});
