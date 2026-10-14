export function cancelWithdrawal(current,id,change,actor,ts){
 const original=current.movements?.[id];
 if(original?.kind!=='withdrawal')throw Error('ไม่พบใบเบิก');
 if(!change.id||!actor?.uid)throw Error('ไม่มีรหัสการยกเลิกหรือผู้บันทึก');
 const existing=current.movements?.[change.id];
 if(existing){if(existing.withdrawalId===id&&original.cancelledByMovement===change.id)return structuredClone(current);throw Error('รหัสรายการซ้ำ');}
 if(original.cancelledByMovement)throw Error('ใบเบิกนี้ยกเลิกและคืนคลังแล้ว');
 const reason=String(change.reason||'').trim();if(!reason)throw Error('ระบุเหตุผลยกเลิก');
 const s=structuredClone(current),seen=new Set();
 if(!original.lines?.length)throw Error('ใบเบิกไม่มีรายการ');
 const lines=original.lines.map(l=>{const x=s.items?.[l.itemId],delta=-l.delta;
 if(seen.has(l.itemId)||!x||!Number.isSafeInteger(delta)||delta<=0||!Number.isSafeInteger(x.qty)||x.qty<0||!Number.isSafeInteger(x.qty+delta))throw Error('ยอดคลังหรือรายการเบิกไม่ถูกต้อง');
 seen.add(l.itemId);x.qty+=delta;return {...l,delta};});
 s.movements[id].cancelledByMovement=change.id;
 s.movements[change.id]={id:change.id,kind:'adjustment',withdrawalId:id,date:original.date,note:'ยกเลิกใบเบิก / คืนคลัง: '+reason,by:actor.uid,byEmail:actor.email||'',ts,lines};
 return s;
}
