import {reconcile} from './domain.js';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function inspectBackup(value){
 if(!object(value)||value.schemaVersion!==1||!['live','qa'].includes(value.environment)||!Number.isFinite(Date.parse(value.exportedAt))||!object(value.offices))throw Error('ใช้ไฟล์สำรองทุกหน่วยงานรูปแบบ version 1');
 const entries=Object.entries(value.offices);if(!entries.length)throw Error('ไฟล์ไม่มีหน่วยงาน');
 return entries.map(([id,entry])=>{
  const path={sanpatong:'office',maewang:'offices/maewang'}[id];
  if(!path||!object(entry)||entry.path!==(value.environment==='qa'?'qa/':'')+path||!object(entry.data))throw Error('เส้นทางหน่วยงานในไฟล์ไม่ถูกต้อง');
  const s=entry.data;
  for(const key of ['people','items','movements'])if(s[key]!==undefined&&!object(s[key]))throw Error('รูปแบบ '+key+' ไม่ถูกต้อง');
  const ids=new Set();for(const p of Object.values(s.people||{})){if(!object(p)||typeof p.empId!=='string'||!p.empId.trim()||typeof p.fullName!=='string'||!p.fullName.trim()||typeof p.active!=='boolean'||ids.has(p.empId))throw Error('ทะเบียนมีข้อมูลผิดหรือรหัสซ้ำ');ids.add(p.empId);}
  for(const x of Object.values(s.items||{}))if(!object(x)||typeof x.name!=='string'||!x.name.trim()||typeof x.unit!=='string'||!x.unit.trim()||!Number.isSafeInteger(x.qty)||x.qty<0||typeof x.active!=='boolean')throw Error('อุปกรณ์หรือยอดคงเหลือไม่ถูกต้อง');
  for(const [mid,m] of Object.entries(s.movements||{})){
   if(!object(m)||m.id!==mid||!['receipt','withdrawal','adjustment'].includes(m.kind)||!Array.isArray(m.lines)||!m.lines.length)throw Error('ประวัติรายการไม่ถูกต้อง');
   const seen=new Set();for(const l of m.lines){if(!object(l)||!s.items?.[l.itemId]||seen.has(l.itemId)||!Number.isSafeInteger(l.delta)||l.delta===0||(m.kind==='receipt'&&l.delta<=0)||(m.kind==='withdrawal'&&l.delta>=0))throw Error('ประวัติอ้างอิงอุปกรณ์หรือจำนวนผิด');seen.add(l.itemId);}
  }
  const gaps=reconcile(s).filter(x=>x.gap!==0);if(gaps.length)throw Error('ยอดคลังไม่ตรงกับประวัติ '+id+' ('+gaps.length+' รายการ)');
  return {id,path:entry.path,people:Object.keys(s.people||{}).length,items:Object.keys(s.items||{}).length,movements:Object.keys(s.movements||{}).length};
 });
}
