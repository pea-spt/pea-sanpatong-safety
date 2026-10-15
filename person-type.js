export const personTypes=[['employee','พนักงาน'],['hire','ลูกจ้าง'],['worker','ผู้ปฏิบัติงาน']];
export function personType(p){return p.personType||'employee';}
export function parsePersonType(value){
 const text=String(value||'').trim();
 if(!text)return 'employee';
 const found=personTypes.find(([id,label])=>id===text||label===text);
 if(!found)throw Error('ประเภทบุคลากรต้องเป็น พนักงาน ลูกจ้าง หรือผู้ปฏิบัติงาน');
 return found[0];
}
export function personTypeField(value='employee'){
 return `<label>ประเภทบุคลากร<select name="personType">${personTypes.map(([id,label])=>`<option value="${id}" ${id===value?'selected':''}>${label}</option>`).join('')}</select></label>`;
}
