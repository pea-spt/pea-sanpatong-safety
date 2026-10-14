import {isCurrentPerson} from './person-status.js';

export function changeWithdrawalPerson(current,id,change,actor,ts){
 const original=current.movements?.[id];
 if(original?.kind!=='withdrawal')throw Error('ไม่พบใบเบิก');
 if(!change?.id||!actor?.uid)throw Error('ไม่มีรหัสการแก้ไขหรือผู้บันทึก');
 if(Object.hasOwn(original.personEdits||{},change.id))return structuredClone(current);
 if(original.cancelledByMovement)throw Error('ใบเบิกนี้ยกเลิกและคืนคลังแล้ว');
 if((original.personVersion||0)!==change.expectedVersion)throw Error('ผู้เบิกในใบเบิกถูกแก้ไขแล้ว กรุณาเปิดใหม่');
 if((original.quantityVersion||0)!==change.expectedQuantityVersion)throw Error('จำนวนในใบเบิกถูกแก้ไขแล้ว กรุณาเปิดใหม่');
 const reason=String(change.reason||'').trim();
 if(!reason)throw Error('ระบุเหตุผลแก้ไขผู้เบิก');
 const person=current.people?.[change.personId];
 if(!person||!isCurrentPerson(person))throw Error('กรุณาเลือกบุคลากรที่ยังปฏิบัติงานอยู่');
 if(original.personId===change.personId)throw Error('ผู้เบิกไม่เปลี่ยน ไม่ต้องบันทึก');
 const s=structuredClone(current),withdrawal=s.movements[id];
 const before={personId:original.personId||'',personName:original.personName||'',empId:original.empId||''};
 const after={personId:change.personId,personName:person.fullName||'',empId:person.empId||''};
 const personVersion=(original.personVersion||0)+1;
 Object.assign(withdrawal,after,{personVersion});
 withdrawal.personEdits={...withdrawal.personEdits,[change.id]:{id:change.id,before,after,reason,by:actor.uid,byEmail:actor.email||'',ts,personVersion}};
 return s;
}
