import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {requestPersonQuery,requestPersonMatches} from '../functions/request-person-policy.js';
import {officePath} from '../functions/document-policy.js';

test('lookup query validates field and normalized bounded text',()=>{
 assert.deepEqual(requestPersonQuery({field:'fullName',query:'  ABC   DEF  '}),{field:'fullName',query:'abc def'});
 for(const data of [null,{field:'password',query:'abc'},{field:'empId',query:123},{field:'empId',query:'ab'},{field:'fullName',query:'x'.repeat(121)}])assert.throws(()=>requestPersonQuery(data));
});
test('lookup returns at most eight active matches with only identity pair',()=>{
 const people=Object.fromEntries(Array.from({length:12},(_,i)=>[i,{empId:`001${i}`,fullName:`Name ${i}`,active:true,department:'private'}]));
 people.a={empId:'001a',fullName:'inactive',active:false};people.b={empId:'001b',fullName:'transferred',active:true,employmentStatus:'transferred'};
 const matches=requestPersonMatches(people,requestPersonQuery({field:'empId',query:'001'}));assert.equal(matches.length,8);assert.deepEqual(Object.keys(matches[0]),['empId','fullName']);
 assert.deepEqual(requestPersonMatches({a:people.a,b:people.b},{field:'empId',query:'001'}),[]);
 assert.equal(requestPersonMatches(people,{field:'fullName',query:'name 11'})[0].empId,'00111');
});
test('callable requires auth, App Check, valid office/environment and request enabled; scopes reads',async()=>{
 const source=readFileSync(new URL('../functions/index.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').split('async function authorize')[0].replace('export const searchRequestPeople','const searchRequestPeople')+'\nsearchRequestPeople;';
 let enabled=true;const reads=[];let options;
 const context=vm.createContext({initializeApp(){},getStorage:()=>({bucket:()=>({})}),getDatabase:()=>({ref:path=>({async get(){reads.push(path);return {val:()=>path.endsWith('/requestEnabled')?enabled:{p:{active:true,empId:'001',fullName:'Test'}}};}})}),onCall:(opts,handler)=>{options=opts;return handler;},HttpsError:class extends Error{constructor(code,message){super(message);this.code=code;}},officePath,requestPersonQuery,requestPersonMatches});
 const callable=vm.runInContext(source,context);assert.equal(options.enforceAppCheck,true);assert.deepEqual(Array.from(options.cors),['https://pea-spt.github.io']);
 await assert.rejects(callable({data:{}}),{code:'unauthenticated'});assert.equal(reads.length,0);
 await assert.rejects(callable({auth:{uid:'guest'},data:{officeId:'../office',environment:'live',field:'empId',query:'001'}}),{code:'invalid-argument'});assert.equal(reads.length,0);
 for(const [officeId,environment,path] of [['sanpatong','live','office'],['maewang','live','offices/maewang'],['sanpatong','qa','qa/office'],['maewang','qa','qa/offices/maewang']]){reads.length=0;const result=await callable({auth:{uid:'guest'},data:{officeId,environment,field:'empId',query:'001'}});assert.equal(result.people[0].empId,'001');assert.deepEqual(reads,[`${path}/requestEnabled`,`${path}/people`]);}
 enabled=false;reads.length=0;await assert.rejects(callable({auth:{uid:'guest'},data:{officeId:'sanpatong',environment:'live',field:'empId',query:'001'}}),{code:'failed-precondition'});assert.deepEqual(reads,['office/requestEnabled']);
});

function searchHarness(lookup){
 let next=0;const timers=new Map();
 function element(name=''){
  return {name,value:'',children:[],attrs:{},listeners:{},hidden:false,classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},before(host){host.parent=this.parent;},append(child){this.children.push(child);child.parent=this;},replaceChildren(){this.children=[];},addEventListener(k,fn){this.listeners[k]=fn;},contains(child){return child===this||this.children.some(x=>x.contains(child));}};
 }
 const fields={empId:element('empId'),fullName:element('fullName')},form={isConnected:true,elements:{namedItem:name=>fields[name]}};
 const document={activeElement:null,createElement:()=>element()};
 const context=vm.createContext({document,queueMicrotask,setTimeout:fn=>{const id=++next;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 const source=readFileSync(new URL('../request-person-search.js',import.meta.url),'utf8').replace('export function','function')+'\nmountRequestPersonSearch;';
 vm.runInContext(source,context)(form,lookup);
 const input=(name,value)=>{fields[name].value=value;fields[name].oninput();};
 const flush=()=>{const pending=[...timers.values()];timers.clear();return Promise.all(pending.map(fn=>fn()));};
 return {fields,form,document,input,flush,list:name=>fields[name].parent.children[1],key(name,key){let prevented=false;fields[name].onkeydown({key,preventDefault(){prevented=true;}});return prevented;}};
}
const person={empId:'001',fullName:'ชื่อ ทดสอบ'};
test('both fields debounce lookup and mouse selection fills paired identity',async()=>{
 for(const name of ['empId','fullName']){const calls=[];const h=searchHarness(async q=>{calls.push(q);return [person];});h.input(name,'ab');await h.flush();assert.equal(calls.length,0);h.input(name,' abc ');await h.flush();assert.deepEqual({...calls[0]},{field:name,query:'abc'});assert.equal(h.list(name).hidden,false);h.list(name).children[0].onclick();assert.equal(h.fields.empId.value,'001');assert.equal(h.fields.fullName.value,person.fullName);assert.equal(h.list(name).hidden,true);}
});
test('new search wins over stale async results and detached form is ignored',async()=>{
 const pending=[];const h=searchHarness(()=>new Promise(resolve=>pending.push(resolve)));
 h.input('empId','001');const first=h.flush();h.input('fullName','ชื่อ');const second=h.flush();pending[1]([person]);await second;pending[0]([{empId:'stale',fullName:'old'}]);await first;assert.equal(h.list('empId').hidden,true);assert.equal(h.list('fullName').children[0].textContent,'001 • ชื่อ ทดสอบ');
 h.input('empId','002');const third=h.flush();h.form.isConnected=false;pending[2]([person]);await third;assert.equal(h.list('empId').children[0].textContent,'กำลังค้นหา…');
});
test('editing a selected name clears its paired ID while manually entered IDs survive name edits',async()=>{
 const h=searchHarness(async()=>[person]);h.input('empId','001');await h.flush();h.list('empId').children[0].onclick();h.input('fullName','ชื่อใหม่');assert.equal(h.fields.empId.value,'');
 h.input('empId','manual');h.input('fullName','ชื่อกรอกเอง');assert.equal(h.fields.empId.value,'manual');
 const manual=searchHarness(async()=>[]);manual.input('empId','002');manual.input('fullName','ชื่อเอง');assert.equal(manual.fields.empId.value,'002');
 const changed=searchHarness(async()=>[person]);changed.input('fullName','ชื่อ');await changed.flush();changed.list('fullName').children[0].onclick();changed.input('empId','new-id');changed.input('fullName','ชื่อแก้');assert.equal(changed.fields.empId.value,'new-id');
});
test('keyboard cycles, Enter selects, Escape closes and invalidates in-flight response',async()=>{
 const h=searchHarness(async()=>[person,{empId:'002',fullName:'สอง'}]);h.input('empId','001');await h.flush();assert.equal(h.key('empId','ArrowUp'),true);assert.equal(h.fields.empId.attrs['aria-activedescendant'],'request-person-empId-1');assert.equal(h.key('empId','ArrowDown'),true);h.key('empId','Enter');assert.equal(h.fields.empId.value,'001');assert.equal(h.fields.fullName.value,person.fullName);
 let resolve;const other=searchHarness(()=>new Promise(r=>resolve=r));other.input('empId','001');const pending=other.flush();other.key('empId','Escape');resolve([person]);await pending;assert.equal(other.list('empId').hidden,true);
});
test('empty/error results explain manual entry and focusout closes suggestions',async()=>{
 const h=searchHarness(async()=>[]);h.input('fullName','ชื่อ');await h.flush();assert.match(h.list('fullName').children[0].textContent,/ไม่พบรายชื่อ/);
 const error=searchHarness(async()=>{throw Error('offline');});error.input('empId','001');await error.flush();assert.match(error.list('empId').children[0].textContent,/กรุณากรอกชื่อ/);error.fields.empId.parent.listeners.focusout();await Promise.resolve();assert.equal(error.list('empId').hidden,true);
});
