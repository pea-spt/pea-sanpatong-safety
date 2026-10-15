import {resolveRecipient} from './recipients.js';
import {isCurrentPerson} from './person-status.js';

export function changeWithdrawalPerson(current,id,change,actor,ts,context={}){
 const original=current.movements?.[id];
 if(original?.kind!=='withdrawal')throw Error('ไม่พบใบเบิก');
 if(!change?.id||!actor?.uid)throw Error('ไม่มีรหัสการแก้ไขหรือผู้บันทึก');
 if(Object.hasOwn(original.personEdits||{},change.id))return structuredClone(current);
 if(original.cancelledByMovement)throw Error('ใบเบิกนี้ยกเลิกและคืนคลังแล้ว');
 if((original.personVersion||0)!==change.expectedVersion)throw Error('ผู้เบิกในใบเบิกถูกแก้ไขแล้ว กรุณาเปิดใหม่');
 if((original.quantityVersion||0)!==change.expectedQuantityVersion)throw Error('จำนวนในใบเบิกถูกแก้ไขแล้ว กรุณาเปิดใหม่');
 const reason=String(change.reason||'').trim();
 if(!reason)throw Error('ระบุเหตุผลแก้ไขผู้เบิก');
 let resolved;try{resolved=resolveRecipient(current,change,context);}catch(e){throw Error('กรุณาเลือกบุคลากรที่ยังปฏิบัติงานอยู่: '+e.message);}const {person,source}=resolved;
 if(original.personId===change.personId&&(original.personOfficeId||context.officeId)===source)throw Error('ผู้เบิกไม่เปลี่ยน ไม่ต้องบันทึก');
 const s=structuredClone(current),withdrawal=s.movements[id];
 const before={personId:original.personId||'',personName:original.personName||'',empId:original.empId||'',...(context.officeId?{personOfficeId:original.personOfficeId||context.officeId,personPosition:original.personPosition||''}:{})};
 const after={personId:change.personId,personName:person.fullName||'',empId:person.empId||'',...(source?{personOfficeId:source,personPosition:person.position||''}:{})};
 const personVersion=(original.personVersion||0)+1;
 Object.assign(withdrawal,after,{personVersion});
 withdrawal.personEdits={...withdrawal.personEdits,[change.id]:{id:change.id,before,after,reason,by:actor.uid,byEmail:actor.email||'',ts,personVersion}};
 return s;
}
