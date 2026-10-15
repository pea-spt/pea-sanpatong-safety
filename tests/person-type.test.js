import test from 'node:test';
import assert from 'node:assert/strict';
import {personType,parsePersonType} from '../person-type.js';
import {editPerson} from '../catalog-edit.js';
test('legacy roster defaults to employees; imported Thai categories stay distinct',()=>{
 assert.equal(personType({}), 'employee');
 assert.equal(parsePersonType(''), 'employee');
 assert.equal(parsePersonType('ลูกจ้าง'), 'hire');
 assert.equal(parsePersonType('ผู้ปฏิบัติงาน'), 'worker');
 assert.throws(()=>parsePersonType('unknown'));
});
test('changing category preserves person ID, status and movement history',()=>{
 const p={empId:'001',fullName:'Example',position:'',department:'',active:true};
 const state={people:{p},movements:{m:{personId:'p'}}};
 const changed=editPerson(state,'p',{...p,personType:'hire'},p);
 assert.equal(changed.people.p.personType,'hire');
 assert.equal(changed.people.p.empId,'001');
 assert.deepEqual(changed.movements,state.movements);
 assert.equal(personType(state.people.p),'employee');
 assert.throws(()=>editPerson(changed,'p',{...p,personType:'worker'},p));
});
