import {driveUrl} from './drive-policy.js';
import {withdrawalGroupKey} from './withdrawal-groups.js';
export function attachWithdrawalEvidence(current,record){
 const next=structuredClone(current),movement=next.movements?.[record.movementId];
 if(movement?.kind!=='withdrawal')throw Error('ไม่พบรายการเบิกจ่าย');
 driveUrl(record.driveFileId);
 movement.files||={};
 if(movement.files[record.id]){if(movement.files[record.id].driveFileId!==record.driveFileId)throw Error('รหัสไฟล์ซ้ำ');return next;}
 if(record.evidenceGroup&&record.evidenceGroup!==withdrawalGroupKey(movement,record.evidenceOfficeId))throw Error('กลุ่มผู้เบิกหรือวันที่เปลี่ยนแล้ว กรุณาเปิดกลุ่มใหม่');
 if(record.replacesId&&(!movement.files[record.replacesId]||Object.values(movement.files).some(f=>f.replacesId===record.replacesId)))throw Error('ไฟล์นี้มีรุ่นใหม่แล้ว กรุณาเปิดรายการใหม่');
 movement.files[record.id]=record;return next;
}
export function editWithdrawalEvidence(current,id,values,actor,ts){
 const next=structuredClone(current),movement=next.movements?.[id];
 if(movement?.kind!=='withdrawal')throw Error('ไม่พบรายการเบิกจ่าย');
 if(movement.evidenceEdits?.[values.id])return next;
 if((movement.evidenceVersion||0)!==values.expectedVersion)throw Error('ข้อมูลเปลี่ยนแล้ว กรุณาเปิดรายการใหม่');
 const date=String(values.date||''),note=String(values.note||'').trim(),evidence=String(values.evidence||'').trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('วันที่ไม่ถูกต้อง');
 if(evidence&&!/^https:\/\//.test(evidence))throw Error('ลิงก์หลักฐานต้องเริ่มด้วย https://');
 if(!values.id)throw Error('ไม่มีรหัสการแก้ไข');
 movement.evidenceEdits||={};movement.evidenceEdits[values.id]={before:{date:movement.date,note:movement.note||'',evidence:movement.evidence||''},after:{date,note,evidence},by:actor.uid,byEmail:actor.email,ts};
 Object.assign(movement,{date,note,evidence,evidenceVersion:(movement.evidenceVersion||0)+1});return next;
}
