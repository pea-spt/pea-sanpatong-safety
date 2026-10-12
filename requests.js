import {applyMovement,emptyOffice} from './domain.js';
export const offices=[{id:'sanpatong',name:'กฟส.สันป่าตอง',path:'office'},{id:'maewang',name:'กฟส.แม่วาง',path:'offices/maewang'}];
export function approveRequest(current,owner,id,actor,ts,date){
 const s=structuredClone(current||emptyOffice()),r=s.requests?.[owner]?.[id];
 if(!r)throw Error('ไม่พบคำขอ');
 if(s.movements?.[id])return s;
 if(r.status!=='pending')throw Error('คำขอนี้ดำเนินการแล้ว');
 const people=Object.entries(s.people||{}).filter(([,p])=>p.empId===r.empId&&p.active);
 if(people.length!==1)throw Error('กรุณาเพิ่มหรือตรวจรหัสผู้เบิกในทะเบียนก่อนยืนยันจ่าย');
 const [personId,p]=people[0];
 const result=applyMovement(s,{id,kind:'withdrawal',personId,empId:p.empId,personName:p.fullName,requestName:r.fullName,requestId:id,by:actor.uid,byEmail:actor.email,ts,date,note:r.note||'',lines:r.lines});
 result.requests[owner][id]={...r,status:'approved',processedBy:actor.uid,processedAt:ts};
 return result;
}
export function publicCatalog(state){return Object.fromEntries(Object.entries(state.items||{}).filter(([,x])=>x.active).map(([id,x])=>[id,{name:x.name,variant:x.variant||'',unit:x.unit,qty:x.qty,zone:x.zone||''}]));}
export function officeSummary(state){const items=Object.values(state?.items||{}).filter(x=>x.active),movements=Object.values(state?.movements||{}),requests=Object.values(state?.requests||{}).flatMap(x=>Object.values(x));return {people:Object.values(state?.people||{}).filter(x=>x.active).length,skus:items.length,low:items.filter(x=>x.qty<=x.minimum).length,withdrawals:movements.filter(x=>x.kind==='withdrawal').length,pending:requests.filter(x=>x.status==='pending').length};}
