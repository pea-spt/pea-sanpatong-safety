import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function harness(){
 const source=readFileSync(new URL('../public-request.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').split("try{if(!office)")[0];
 const nodes=new Map();
 function element(id){
  const node={value:'',click(){this.onclick?.();},reportValidity(){return [...nodes.values()].filter(x=>x.required).every(x=>x.value!=='');}};
  Object.defineProperty(node,'innerHTML',{get(){return this.html||'';},set(html){this.html=html;for(const match of html.matchAll(/<(\w+)\b([^>]*)>/g)){const attrs=match[2],key=attrs.match(/\bid="([^"]+)"/)?.[1]||attrs.match(/\bname="([^"]+)"/)?.[1];if(key){const child=element(key);child.required=/\brequired\b/.test(attrs);child.value=attrs.match(/\bvalue="([^"]*)"/)?.[1]||'';child.attrs=attrs;nodes.set(key,child);}}}});
  return node;
 }
 for(const id of ['request-app','status'])nodes.set(id,element(id));
 const context=vm.createContext({URL,location:{href:'https://example.test/request.html?office=test'},offices:[{id:'test',name:'Test',path:'test'}],isQA:false,sessionStorage:{getItem(){return null;},setItem(){}},crypto:{randomUUID(){return 'test-request';}},document:{querySelector(selector){return nodes.get(selector.slice(1));},querySelectorAll(){return [];}},FormData:class {constructor(){return ['empId','fullName','note'].map(key=>[key,nodes.get(key).value]);}},searchSelects(){}});
 context.mountRequestPersonSearch=()=>{};
 vm.runInContext(source,context);vm.runInContext('draw()',context);
 return {nodes,context,run:code=>vm.runInContext(code,context)};
}

test('request advances without employee ID, preserves identity on back and requires a name',()=>{
 const h=harness();assert.equal(h.nodes.get('empId').required,false);
 h.nodes.get('next').click();assert.equal(h.run('step'),0);
 h.nodes.get('fullName').value='   ';h.nodes.get('next').click();assert.equal(h.run('step'),0);
 h.nodes.get('fullName').value='ชื่อ ทดสอบ';h.nodes.get('note').value='หมายเหตุ';
 let prevented=false;h.nodes.get('who').onsubmit({preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(h.run('step'),1);
 h.nodes.get('prev').click();assert.equal(h.nodes.get('fullName').value,'ชื่อ ทดสอบ');assert.equal(h.nodes.get('empId').value,'');assert.equal(h.nodes.get('note').value,'หมายเหตุ');
});

test('evidence picker allows local files without forced camera and still requires evidence',()=>{
 const h=harness();h.run('step=2;draw()');const attrs=h.nodes.get('photo').attrs;
 assert.match(attrs,/type="file"/);assert.match(attrs,/accept="image\/jpeg,image\/png,image\/webp"/);assert.doesNotMatch(attrs,/capture/);
 h.nodes.get('next').click();assert.equal(h.run('step'),2);
});

test('all live and QA request validators accept blank employee ID without exposing personnel',()=>{
 const {rules}=JSON.parse(readFileSync(new URL('../firebase/database.rules.json',import.meta.url),'utf8'));
 for(const office of [rules.office,rules.offices.maewang,rules.qa.office,rules.qa.offices.maewang]){
  const validator=office.requests.$owner.$rid.empId['.validate'];
  for(const value of ['', '001','x'.repeat(40)])assert.equal(vm.runInNewContext(validator,{newData:{isString:()=>typeof value==='string',val:()=>value}}),true);
  const value='x'.repeat(41);assert.equal(vm.runInNewContext(validator,{newData:{isString:()=>true,val:()=>value}}),false);
  assert.match(office.people['.read'],/admins/);
 }
});
