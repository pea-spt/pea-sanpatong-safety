export function withdrawalView(state,id){
 const original=state.movements?.[id];if(original?.kind!=='withdrawal')throw Error('ไม่พบใบเบิก');
 const returns=Object.values(state.movements||{}).filter(m=>m.kind==='adjustment'&&m.withdrawalId===id);
 if(!original.lines?.length)throw Error('ใบเบิกไม่มีรายการ');const seen=new Set();
 const originals=new Set(original.lines.map(l=>l.itemId));
 const added=new Map();for(const m of returns)for(const l of m.lines||[])if(!originals.has(l.itemId))added.set(l.itemId,{...l,delta:0});
 const lines=[...original.lines,...added.values()].map(l=>{if(seen.has(l.itemId)||!Number.isSafeInteger(l.delta)||l.delta>0)throw Error('รายการเบิกไม่ถูกต้อง');seen.add(l.itemId);const returned=returns.reduce((sum,m)=>sum+(m.lines||[]).filter(x=>x.itemId===l.itemId).reduce((n,x)=>n+x.delta,0),0);const qty=-l.delta-returned;
 if(!Number.isSafeInteger(qty)||qty<0)throw Error('ประวัติคืนคลังไม่ถูกต้อง');return {...l,originalQty:-l.delta,qty,delta:-qty};});
 return {...original,lines,version:original.quantityVersion||0,status:original.cancelledByMovement?'cancelled':'active'};
}
export function reviseWithdrawal(current,id,change,actor,ts){
 const original=current.movements?.[id];if(original?.kind!=='withdrawal')throw Error('ไม่พบใบเบิก');
 if(!change.id||!actor?.uid)throw Error('ไม่มีรหัสการแก้ไขหรือผู้บันทึก');
 const existing=current.movements?.[change.id];
 if(existing){if(existing.kind==='adjustment'&&existing.withdrawalId===id)return structuredClone(current);throw Error('รหัสรายการซ้ำ');}
 const before=withdrawalView(current,id);
 if(before.status==='cancelled')throw Error('ใบเบิกนี้ยกเลิกและคืนคลังแล้ว');
 if(before.version!==change.expectedVersion)throw Error('จำนวนในใบเบิกถูกแก้ไขแล้ว กรุณาเปิดใหม่');
 const reason=String(change.reason||'').trim();if(!reason)throw Error('ระบุเหตุผลแก้ไขหรือยกเลิก');
 const seen=new Set(),requested=new Map();
 for(const line of change.lines||[]){const qty=line.qty;if(seen.has(line.itemId)||!current.items?.[line.itemId])throw Error('รายการซ้ำหรือไม่อยู่ในใบเบิก');if(!Number.isSafeInteger(qty)||qty<0)throw Error('จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 0');seen.add(line.itemId);requested.set(line.itemId,qty);}
 const s=structuredClone(current),lines=[],after=[];
 const all=[...before.lines,...[...requested.keys()].filter(key=>!before.lines.some(l=>l.itemId===key)).map(itemId=>({itemId,...s.items[itemId],qty:0}))];
 for(const l of all){const qty=change.cancel?0:(requested.has(l.itemId)?requested.get(l.itemId):l.qty);after.push({itemId:l.itemId,qty});const delta=l.qty-qty;if(!delta)continue;const x=s.items?.[l.itemId];if(!x||!Number.isSafeInteger(x.qty)||x.qty<0||!Number.isSafeInteger(x.qty+delta)||x.qty+delta<0)throw Error('ยอดคลังหรือรายการเบิกไม่ถูกต้อง');if(delta<0&&x.active===false)throw Error('ไม่พบรายการที่ใช้งาน');x.qty+=delta;lines.push({itemId:l.itemId,name:l.name,variant:l.variant||'',unit:l.unit,qty:Math.abs(delta),delta});}
 if(!lines.length)throw Error('จำนวนไม่เปลี่ยน ไม่ต้องบันทึก');
 const cancelled=after.every(l=>l.qty===0),version=before.version+1;
 s.movements[id].quantityVersion=version;if(cancelled)s.movements[id].cancelledByMovement=change.id;
 s.movements[change.id]={id:change.id,kind:'adjustment',withdrawalId:id,withdrawalVersion:version,date:original.date,note:(cancelled?'ยกเลิกใบเบิก / คืนคลัง: ':'แก้รายการใบเบิก: ')+reason,by:actor.uid,byEmail:actor.email||'',ts,lines,before:before.lines.map(l=>({itemId:l.itemId,qty:l.qty})),after};
 return s;
}
export function cancelWithdrawal(current,id,change,actor,ts){return reviseWithdrawal(current,id,{...change,cancel:true,expectedVersion:change.expectedVersion??current.movements?.[id]?.quantityVersion??0},actor,ts);}
