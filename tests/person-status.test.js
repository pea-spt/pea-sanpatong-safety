import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changePersonStatus,isCurrentPerson,personStatus,transferLabel,validatePersonStatus} from '../person-status.js';
import {officeSummary} from '../requests.js';
import {applyMovement} from '../domain.js';
import {editPerson} from '../catalog-edit.js';
import {inspectBackup} from '../backup.js';
const fixture=()=>({people:{p:{empId:'QA',fullName:'Test',position:'',department:'',active:true}},items:{i:{name:'Test',unit:'ใบ',qty:1,active:true}},movements:{old:{id:'old',kind:'receipt',lines:[{itemId:'i',delta:1}]}}});
test('transfer preserves identity, stock and history while removing person from current count',()=>{
 const s=fixture(),p=s.people.p,n=changePersonStatus(s,'p',{status:'transferred',month:'10',year:'2569'},p,{uid:'qa'},123);
 assert.equal(n.people.p.transferMonth,'2026-10');assert.equal(n.people.p.empId,p.empId);assert.equal(n.people.p.statusUpdatedAt,123);
 assert.equal(transferLabel(n.people.p),'ย้าย • ตุลาคม 2569');assert.equal(officeSummary(n).people,0);assert.equal(officeSummary(s).people,1);
 assert.deepEqual(n.items,s.items);assert.deepEqual(n.movements,s.movements);assert.equal(s.people.p.active,true);
 assert.throws(()=>applyMovement(n,{id:'new',kind:'withdrawal',personId:'p',lines:[{itemId:'i',qty:1}]}),/ทะเบียน/);
 const edited=editPerson(n,'p',{fullName:'Changed',position:'',department:''},n.people.p);assert.equal(edited.people.p.transferMonth,'2026-10');
 const b={schemaVersion:1,environment:'qa',exportedAt:'2026-10-13T00:00:00Z',offices:{sanpatong:{path:'qa/office',data:n}}};assert.equal(inspectBackup(b).length,1);
});
test('legacy inactive people remain excluded; reactivation clears transfer month and rejects stale edits',()=>{
 const s=fixture();assert.equal(personStatus({active:false}),'inactive');assert.equal(isCurrentPerson({active:false}),false);
 const n=changePersonStatus(s,'p',{status:'transferred',month:1,year:2568},s.people.p,{uid:'qa'},1);
 assert.throws(()=>changePersonStatus(n,'p',{status:'active'},s.people.p,{uid:'qa'},2),/เปลี่ยน/);
 const restored=changePersonStatus(n,'p',{status:'active'},n.people.p,{uid:'qa'},2);assert.equal(restored.people.p.transferMonth,undefined);assert.equal(officeSummary(restored).people,1);
 const inactive=changePersonStatus(restored,'p',{status:'inactive'},restored.people.p,{uid:'qa'},3);assert.equal(officeSummary(inactive).people,0);
});
test('transfer requires a valid month/year and consistent active state',()=>{
 const s=fixture();for(const values of [{status:'transferred',month:0,year:2569},{status:'transferred',month:13,year:2569},{status:'transferred',month:1,year:'x'},{status:'other'}])assert.throws(()=>changePersonStatus(s,'p',values,s.people.p,{uid:'qa'},1));
 assert.throws(()=>validatePersonStatus({active:true,employmentStatus:'transferred',transferMonth:'2026-10'}));
 assert.throws(()=>validatePersonStatus({active:false,employmentStatus:'transferred',transferMonth:'2026-13'}));
});
