import test from 'node:test';
import assert from 'node:assert/strict';
import {changeWithdrawalPerson} from '../withdrawal-person.js';
import {cancelWithdrawal,reviseWithdrawal} from '../withdrawal-cancel.js';
import {withdrawalLines,summarizeLines,filterLines} from '../meeting.js';
import {overviewModel} from '../overview-charts.js';

const actor={uid:'admin',email:'admin@example.com'};
const change={id:'person-edit',personId:'q',reason:'  เลือกชื่อผิด  ',expectedVersion:0,expectedQuantityVersion:0};
function fixture(){return {people:{p:{fullName:'เดิม',empId:'001',active:true,position:'เดิม'},q:{fullName:'ใหม่',empId:'002',active:true,employmentStatus:'active',position:'ช่าง'},r:{fullName:'อีกคน',empId:'003',active:true}},items:{a:{qty:7}},movements:{w:{id:'w',kind:'withdrawal',date:'2026-10-14',personId:'p',personName:'เดิม',empId:'001',by:'issuer',ts:10,evidence:{status:'recorded',fileId:'file'},lines:[{itemId:'a',name:'หมวก',unit:'ใบ',qty:3,delta:-3}]}},unrelated:{value:1}};}

test('recipient change preserves stock, quantities, evidence and original issue metadata with full audit',()=>{
 const s=fixture(),n=changeWithdrawalPerson(s,'w',change,actor,20),w=n.movements.w;
 assert.equal(w.personId,'q');assert.equal(w.personName,'ใหม่');assert.equal(w.empId,'002');assert.equal(w.personVersion,1);
 assert.deepEqual(w.personEdits['person-edit'],{id:'person-edit',before:{personId:'p',personName:'เดิม',empId:'001'},after:{personId:'q',personName:'ใหม่',empId:'002'},reason:'เลือกชื่อผิด',by:'admin',byEmail:'admin@example.com',ts:20,personVersion:1});
 assert.deepEqual(n.items,s.items);assert.deepEqual(w.lines,s.movements.w.lines);assert.deepEqual(w.evidence,s.movements.w.evidence);assert.equal(w.by,'issuer');assert.equal(w.ts,10);assert.equal(s.movements.w.personId,'p');assert.deepEqual(n.unrelated,s.unrelated);
});
test('retry is idempotent even after subsequent edits or cancellation',()=>{
 let s=changeWithdrawalPerson(fixture(),'w',change,actor,20);
 s=changeWithdrawalPerson(s,'w',{...change,id:'next',personId:'r',expectedVersion:1},actor,21);
 s=cancelWithdrawal(s,'w',{id:'cancel',reason:'ยกเลิก',expectedVersion:0},actor,22);
 assert.deepEqual(changeWithdrawalPerson(s,'w',change,actor,23),s);
 assert.throws(()=>changeWithdrawalPerson(s,'w',{...change,id:'another'},actor,24),/คืนคลังแล้ว/);
});
test('stale recipient or quantity versions reject changes without mutating input',()=>{
 const s=fixture(),n=changeWithdrawalPerson(s,'w',change,actor,20);
 assert.throws(()=>changeWithdrawalPerson(n,'w',{...change,id:'stale',personId:'r'},actor,21),/ผู้เบิก.*ถูกแก้ไขแล้ว/);
 const partial=reviseWithdrawal(s,'w',{id:'partial',expectedVersion:0,reason:'จำนวนผิด',lines:[{itemId:'a',qty:2}]},actor,21);
 assert.throws(()=>changeWithdrawalPerson(partial,'w',change,actor,22),/จำนวน.*ถูกแก้ไขแล้ว/);
 const updated=changeWithdrawalPerson(partial,'w',{...change,expectedQuantityVersion:1},actor,23);
 assert.equal(updated.items.a.qty,8);assert.deepEqual(updated.movements.partial,partial.movements.partial);assert.equal(updated.movements.w.quantityVersion,1);
 assert.throws(()=>changeWithdrawalPerson(s,'w',{...change,expectedVersion:undefined},actor,1),/ถูกแก้ไขแล้ว/);
 assert.throws(()=>changeWithdrawalPerson(s,'w',{...change,expectedQuantityVersion:undefined},actor,1),/ถูกแก้ไขแล้ว/);
});
test('requires withdrawal, request ID, actor, reason and a different current recipient',()=>{
 const s=fixture();
 assert.throws(()=>changeWithdrawalPerson(s,'missing',change,actor,1),/ไม่พบใบเบิก/);
 for(const invalid of [{...change,id:''},{...change,reason:' '},{...change,personId:'missing'},{...change,personId:'p'}])assert.throws(()=>changeWithdrawalPerson(s,'w',invalid,actor,1));
 assert.throws(()=>changeWithdrawalPerson(s,'w',change,{},1),/ผู้บันทึก/);
 for(const status of [{active:false},{active:true,employmentStatus:'transferred'},{active:true,employmentStatus:'inactive'}]){const n=fixture();Object.assign(n.people.q,status);assert.throws(()=>changeWithdrawalPerson(n,'w',change,actor,1),/ปฏิบัติงาน/);}
 assert.equal(s.items.a.qty,7);assert.equal(s.movements.w.personId,'p');
});
test('uses current person data and preserves concurrent state, dashboard filters and grouping follow recipient',()=>{
 const s=fixture();s.people.q.fullName='ชื่อปัจจุบัน';s.items.a.qty=99;s.movements.other={...s.movements.w,id:'other',personId:'q',personName:'ชื่อปัจจุบัน',empId:'002'};
 const n=changeWithdrawalPerson(s,'w',change,actor,20),lines=withdrawalLines({o:n},[{id:'o',name:'สำนักงาน'}]);
 assert.equal(n.items.a.qty,99);assert.deepEqual(n.movements.other,s.movements.other);
 assert.equal(lines[0].person,'ชื่อปัจจุบัน');assert.ok(lines.every(l=>l.personId==='q'&&l.empId==='002'&&l.position==='ช่าง'));
 assert.equal(summarizeLines(lines).people,1);assert.equal(filterLines(lines,{name:'เดิม'}).length,0);assert.equal(filterLines(lines,{empId:'002'}).length,2);
 assert.deepEqual(overviewModel(lines).people,[{label:'ช่าง',qty:1}]);
});


