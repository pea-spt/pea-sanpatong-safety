import test from 'node:test';
import assert from 'node:assert/strict';
import {attachWithdrawalEvidence,editWithdrawalEvidence} from '../withdrawal-evidence.js';
const actor={uid:'admin',email:'admin@example.test'};
const state=()=>({items:{a:{qty:5}},movements:{w:{id:'w',kind:'withdrawal',date:'2026-10-13',lines:[{itemId:'a',qty:2,delta:-2}],personId:'p',by:'original'}}});
const record={id:'f',movementId:'w',driveFileId:'abcdefghijk123',replacesId:''};
test('late evidence is idempotent and preserves inventory and original withdrawal',()=>{
 const original=state(),next=attachWithdrawalEvidence(original,record);
 assert.deepEqual(next.items,original.items);assert.deepEqual(next.movements.w.lines,original.movements.w.lines);
 assert.equal(original.movements.w.files,undefined);assert.equal(next.movements.w.by,'original');
 assert.deepEqual(attachWithdrawalEvidence(next,record),next);
 assert.throws(()=>attachWithdrawalEvidence(next,{...record,driveFileId:'otherfile123'}),/ซ้ำ/);
 assert.throws(()=>attachWithdrawalEvidence(original,{...record,movementId:'missing'}),/ไม่พบ/);
});
test('replacement retains original file and rejects competing replacement',()=>{
 const next=attachWithdrawalEvidence(attachWithdrawalEvidence(state(),record),{...record,id:'new',replacesId:'f'});
 assert.equal(Object.keys(next.movements.w.files).length,2);
 assert.throws(()=>attachWithdrawalEvidence(next,{...record,id:'other',replacesId:'f'}),/รุ่นใหม่/);
});
test('metadata edits retain audit and stock; stale edits and invalid dates fail',()=>{
 const original=state(),values={id:'edit',expectedVersion:0,date:'2026-10-12',note:'เพิ่มหลักฐาน',evidence:'https://example.test/file'};
 const next=editWithdrawalEvidence(original,'w',values,actor,123);
 assert.deepEqual(next.items,original.items);assert.deepEqual(next.movements.w.lines,original.movements.w.lines);
 assert.equal(next.movements.w.evidenceEdits.edit.before.date,'2026-10-13');assert.equal(next.movements.w.by,'original');
 assert.deepEqual(editWithdrawalEvidence(next,'w',values,actor,124),next);
 assert.throws(()=>editWithdrawalEvidence(next,'w',{...values,id:'other'},actor,124),/เปลี่ยน/);
 assert.throws(()=>editWithdrawalEvidence(original,'w',{...values,date:'2026-02-30'},actor,123),/วันที่/);
 assert.throws(()=>editWithdrawalEvidence(original,'w',{...values,evidence:'javascript:alert(1)'},actor,123),/https/);
});
