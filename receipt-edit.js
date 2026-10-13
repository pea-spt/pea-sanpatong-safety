import {positiveInteger} from './domain.js';
const normalize=v=>({...v,note:v.note||'',evidence:v.evidence||'',lines:v.lines||[]});
export function receiptVersions(state,id){return Object.values(state.receiptRevisions||{}).filter(r=>r.receiptId===id).map(r=>({...r,before:normalize(r.before),after:normalize(r.after)})).sort((a,b)=>a.version-b.version);}
export function receiptView(state,id){
 const original=state.movements?.[id];if(original?.kind!=='receipt')throw Error('ไม่พบใบรับเข้า');
 const revisions=receiptVersions(state,id),last=revisions.at(-1);
 return last?{...last.after,id,version:last.version}:{id,version:0,status:'active',reference:original.reference||'',date:original.date||'',note:original.note||'',evidence:original.evidence||'',lines:original.lines.map(l=>({...l,qty:l.qty??l.delta}))};
}
export function reviseReceipt(current,id,change,actor,ts){
 if(!change.id)throw Error('ไม่มีรหัสการแก้ไข');
 if(current.receiptRevisions?.[change.id]){if(current.receiptRevisions[change.id].receiptId!==id)throw Error('รหัสการแก้ไขซ้ำ');return structuredClone(current);}
 const before=receiptView(current,id);
 if(before.version!==change.expectedVersion)throw Error('ใบรับเข้าถูกแก้ไขแล้ว กรุณาเปิดใหม่');
 if(before.status==='cancelled')throw Error('ใบรับเข้านี้ยกเลิกแล้ว');
 const reason=String(change.reason||'').trim();if(!reason)throw Error('ระบุเหตุผลการแก้ไขหรือยกเลิก');
 const cancel=change.cancel===true;
 const reference=cancel?before.reference:String(change.reference??before.reference).trim(),date=cancel?before.date:change.date??before.date;
 if(!cancel&&(!reference||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw Error('ระบุเลขเอกสารและวันที่ตรวจรับที่ถูกต้อง');
 const seen=new Set(),lines=cancel?[]:(change.lines||[]).map(l=>{
  if(seen.has(l.itemId))throw Error('รายการซ้ำในใบรับเข้า');seen.add(l.itemId);
  const x=current.items?.[l.itemId],old=before.lines.find(o=>o.itemId===l.itemId);
  if(!x||(!x.active&&!old))throw Error('ไม่พบอุปกรณ์ที่ใช้งาน');
  return {itemId:l.itemId,qty:positiveInteger(l.qty),name:old?.name||x.name,variant:old?.variant??x.variant??'',unit:old?.unit||x.unit};
 });
 if(!cancel&&!lines.length)throw Error('ใบรับเข้าต้องมีอย่างน้อยหนึ่งรายการ');
 const after={status:cancel?'cancelled':'active',reference,date,note:cancel?before.note:String(change.note??before.note),evidence:cancel?before.evidence:String(change.evidence??before.evidence),lines};
 const comparable=v=>JSON.stringify({status:v.status,reference:v.reference,date:v.date,note:v.note,evidence:v.evidence,lines:v.lines.map(l=>[l.itemId,l.qty]).sort((a,b)=>a[0].localeCompare(b[0]))});
 if(comparable(before)===comparable(after))throw Error('ข้อมูลไม่เปลี่ยน ไม่ต้องบันทึก');
 const deltas=new Map();for(const l of before.lines)deltas.set(l.itemId,-l.qty);for(const l of lines)deltas.set(l.itemId,(deltas.get(l.itemId)||0)+l.qty);
 const s=structuredClone(current),movementLines=[];
 for(const [itemId,delta] of deltas){if(!delta)continue;const x=s.items?.[itemId];if(!x||!Number.isSafeInteger(x.qty)||x.qty<0)throw Error('ยอดคลังเดิมไม่ถูกต้อง');const next=x.qty+delta;
  if(!Number.isSafeInteger(next)||next<0)throw Error('แก้ใบนี้ไม่ได้: '+x.name+' จะติดลบ อาจมีการเบิกไปแล้ว');
  x.qty=next;movementLines.push({itemId,delta,name:x.name,variant:x.variant||'',unit:x.unit});
 }
 const version=before.version+1;
 s.receiptRevisions||={};s.receiptRevisions[change.id]={id:change.id,receiptId:id,version,before,after,reason,by:actor.uid,byEmail:actor.email,ts};
 if(movementLines.length){s.movements||={};if(s.movements[change.id])throw Error('รหัสรายการซ้ำ');s.movements[change.id]={id:change.id,kind:'adjustment',receiptId:id,receiptRevisionId:change.id,reference,date,note:(cancel?'ยกเลิกใบรับเข้า: ':'แก้ไขใบรับเข้า: ')+reason,by:actor.uid,byEmail:actor.email,ts,lines:movementLines};}
 return s;
}
