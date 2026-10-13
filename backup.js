import {driveUrl} from './drive-policy.js';
import {reconcile} from './domain.js';
import {receiptVersions} from './receipt-edit.js';
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
  if(s.receiptRevisions!==undefined&&!object(s.receiptRevisions))throw Error('รูปแบบประวัติแก้ใบรับเข้าไม่ถูกต้อง');
  for(const [rid,r] of Object.entries(s.receiptRevisions||{})){
   if(!object(r)||r.id!==rid||s.movements?.[r.receiptId]?.kind!=='receipt'||!Number.isSafeInteger(r.version)||r.version<1||!r.reason?.trim()||!object(r.before)||!object(r.after)||!Array.isArray(r.before.lines)||(r.after.lines!==undefined&&!Array.isArray(r.after.lines)))throw Error('ประวัติแก้ใบรับเข้าไม่ถูกต้อง');
   for(const view of [r.before,r.after]){const seen=new Set(),lines=view.lines||[];if(!['active','cancelled'].includes(view.status)||(view.status==='active'&&!lines.length)||(view.status==='cancelled'&&lines.length))throw Error('สถานะใบรับเข้าไม่ถูกต้อง');for(const l of lines){if(!s.items?.[l.itemId]||seen.has(l.itemId)||!Number.isSafeInteger(l.qty)||l.qty<=0)throw Error('จำนวนในใบรับเข้าไม่ถูกต้อง');seen.add(l.itemId);}}
   const versions=receiptVersions(s,r.receiptId);if(versions.filter(v=>v.version===r.version).length!==1||r.version>versions.length)throw Error('ลำดับแก้ใบรับเข้าไม่ครบ');
   const prev=r.version===1?s.movements[r.receiptId]:versions.find(v=>v.version===r.version-1)?.after;
   const quantities=lines=>Object.fromEntries(lines.map(l=>[l.itemId,l.qty??l.delta]));
   if(JSON.stringify(quantities(r.before.lines))!==JSON.stringify(quantities(prev.lines)))throw Error('ใบรับเข้าก่อนแก้ไม่ตรงกับประวัติ');
   const deltas={};for(const l of r.before.lines)deltas[l.itemId]=-l.qty;for(const l of r.after.lines||[])deltas[l.itemId]=(deltas[l.itemId]||0)+l.qty;
   const expected=Object.entries(deltas).filter(([,n])=>n!==0).sort(),m=s.movements[rid];
   if(expected.length&&(!m||m.kind!=='adjustment'||m.receiptId!==r.receiptId||JSON.stringify(m.lines.map(l=>[l.itemId,l.delta]).sort())!==JSON.stringify(expected)))throw Error('ยอดแก้ใบรับเข้าไม่ตรงกับส่วนต่าง');
  }
  for(const key of ['procurements','receiptFolders','documents'])if(s[key]!==undefined&&!object(s[key]))throw Error('รูปแบบแฟ้มเอกสารไม่ถูกต้อง');
  for(const [fid,f] of Object.entries(s.procurements||{}))if(!object(f)||f.id!==fid||!f.title?.trim()||!f.reference?.trim()||!Number.isSafeInteger(f.year))throw Error('แฟ้มจัดซื้อไม่ถูกต้อง');
  for(const [rid,fid] of Object.entries(s.receiptFolders||{}))if(s.movements?.[rid]?.kind!=='receipt'||!s.procurements?.[fid])throw Error('ใบรับเข้าไม่ตรงกับแฟ้มจัดซื้อ');
  for(const [did,d] of Object.entries(s.documents||{}))if(!object(d)||d.id!==did||!s.procurements?.[d.folderId]||d.status!=='ready'||!Number.isSafeInteger(d.size)||d.size<=0||d.size>10*1024*1024||!d.name||!d.mime||!d.sha256||(d.replacesId&&s.documents?.[d.replacesId]?.folderId!==d.folderId))throw Error('ข้อมูลไฟล์แนบไม่ถูกต้อง');
  for(const d of Object.values(s.documents||{}))if(d.provider==='google-drive'){driveUrl(d.driveFileId);if(d.driveOwnerEmail!=='sarinyawannasuwong@gmail.com')throw Error('เจ้าของไฟล์ Drive ไม่ถูกต้อง');}
  const gaps=reconcile(s).filter(x=>x.gap!==0);if(gaps.length)throw Error('ยอดคลังไม่ตรงกับประวัติ '+id+' ('+gaps.length+' รายการ)');
  return {id,path:entry.path,people:Object.keys(s.people||{}).length,items:Object.keys(s.items||{}).length,movements:Object.keys(s.movements||{}).length};
 });
}
