import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {publicRequestPeople,requestPersonQuery,requestPersonPrefix} from '../request-person-directory.js';

const person={empId:'001',fullName:'Name ทดสอบ',active:true,department:'private',email:'private@example.test'};
test('directory projects only identity/search fields from active roster and removes retired people',()=>{
 const people={p:person,inactive:{...person,active:false},transferred:{...person,employmentStatus:'transferred'}};
 assert.deepEqual(publicRequestPeople(people),{p:{empId:'001',fullName:'Name ทดสอบ',empIdSearch:'001',fullNameSearch:'name ทดสอบ'}});assert.equal(people.p.department,'private');assert.deepEqual(publicRequestPeople(null),{});
 assert.equal(requestPersonPrefix('ABC'),'abc');
});
test('prefix query validates field and boundaries and requests maximum eight matching rows',()=>{
 assert.deepEqual(requestPersonQuery({field:'fullName',query:'  NAME  '}),{orderByChild:'fullNameSearch',startAt:'name',endAt:'name\uf8ff',limitToFirst:8});
 for(const data of [null,{field:'password',query:'abc'},{field:'empId',query:123},{field:'empId',query:'ab'},{field:'fullName',query:'x'.repeat(121)}])assert.throws(()=>requestPersonQuery(data));
 assert.equal(requestPersonQuery({field:'empId',query:'0'.repeat(120)}).startAt.length,120);
});
const {rules}=JSON.parse(readFileSync(new URL('../firebase/database.rules.json',import.meta.url),'utf8'));
const offices=[['office',rules.office],['offices/maewang',rules.offices.maewang],['qa/office',rules.qa.office],['qa/offices/maewang',rules.qa.offices.maewang]];
function snapshot(value,parent){return {val:()=>value??null,isString:()=>typeof value==='string',hasChild:key=>value!=null&&Object.hasOwn(value,key),hasChildren:keys=>keys.every(key=>value!=null&&Object.hasOwn(value,key)),parent:()=>parent,child(path){return snapshot(path.split('/').reduce((v,k)=>v?.[k],value),this);}};}
function allowRead(rule,query,auth,enabledPath){try{return vm.runInNewContext(rule,{query,auth,root:snapshot(enabledPath)})===true;}catch{return false;}}
test('all office scopes deny unbounded, wrong-order, overlimit, disabled and unauthenticated directory reads',()=>{
 for(const [path,office] of offices){const rule=office.requestPeople['.read'],valid=requestPersonQuery({field:'empId',query:'001'}),auth={uid:'guest',token:{firebase:{sign_in_provider:'anonymous'}}};
  const enabled={};let cursor=enabled;const parts=path.split('/');for(const part of parts)cursor=cursor[part]={};cursor.requestEnabled=true;
  assert.equal(allowRead(rule,valid,auth,enabled),true,path);assert.equal(allowRead(rule,valid,null,enabled),false);assert.equal(allowRead(rule,valid,{...auth,token:{firebase:{sign_in_provider:'password'}}},enabled),false);assert.equal(allowRead(rule,valid,auth,{}),false);
  for(const invalid of [{},{...valid,orderByChild:'fullName'},{...valid,startAt:'00',endAt:'00\uf8ff'},{...valid,startAt:123,endAt:'123\uf8ff'},{...valid,limitToFirst:null},{...valid,limitToFirst:0},{...valid,limitToFirst:9},{...valid,endAt:'999'},{...valid,startAt:'a'.repeat(121),endAt:'a'.repeat(121)+'\uf8ff'}])assert.equal(allowRead(rule,invalid,auth,enabled),false,JSON.stringify(invalid));
  assert.deepEqual(office.requestPeople['.indexOn'],['empIdSearch','fullNameSearch']);assert.match(office.people['.read'],/admins/);assert.equal(office.requestPeople.$id.$other['.validate'],false);
 }
});
test('directory rows bind both identity and search fields to same-office post-write active roster',()=>{
 for(const [,office] of offices){const row=publicRequestPeople({p:person}).p,rule=office.requestPeople.$id['.validate'];
  function valid(value,source=person){const state=snapshot({people:{p:source}}),directory=snapshot({},state),newData=snapshot(value,directory);return vm.runInNewContext(rule,{newData,$id:'p'});}
  assert.equal(valid(row),true);assert.equal(valid({...row,empId:'other'}),false);assert.equal(valid({...row,fullName:'other'}),false);assert.equal(valid({...row,empIdSearch:'other'}),false);assert.equal(valid({...row,fullNameSearch:'other'}),false);assert.equal(valid(row,{...person,active:false}),false);assert.equal(valid(row,{...person,employmentStatus:'transferred'}),false);
  const updated={...person,fullName:'Updated'};assert.equal(valid(publicRequestPeople({p:updated}).p,updated),true);
  assert.equal(Object.hasOwn(office.requestPeople.$id,'.write'),false); // Existing admin parent write is the sole writer.
 }
});
