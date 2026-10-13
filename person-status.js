export function personStatus(person){return person.employmentStatus|| (person.active?'active':'inactive');}
export function isCurrentPerson(person){return person.active===true&&personStatus(person)==='active';}
export function validatePersonStatus(person){
 const status=personStatus(person);
 if(!['active','inactive','transferred'].includes(status)||typeof person.active!=='boolean'||person.active!==(status==='active'))throw Error('สถานะบุคลากรไม่ถูกต้อง');
 if(status==='transferred'&&!/^(19|[2-9]\d)\d{2}-(0[1-9]|1[0-2])$/.test(person.transferMonth||''))throw Error('กรุณาระบุเดือนและปีที่ย้ายให้ถูกต้อง');
 if(status!=='transferred'&&person.transferMonth)throw Error('เดือนที่ย้ายไม่ตรงกับสถานะ');
}
export function changePersonStatus(current,id,values,expected,actor,ts){
 const next=structuredClone(current),person=next.people?.[id];if(!person)throw Error('ไม่พบบุคลากร');
 if(JSON.stringify(person)!==JSON.stringify(expected))throw Error('ข้อมูลเปลี่ยนแล้ว กรุณาเปิดฟอร์มใหม่');
 const updated={...person,employmentStatus:values.status,active:values.status==='active',statusUpdatedBy:actor.uid,statusUpdatedAt:ts};
 delete updated.transferMonth;
 if(values.status==='transferred'){
  const year=Number(values.year),month=Number(values.month);
  if(!Number.isInteger(year)||year<2443||year>10542||!Number.isInteger(month)||month<1||month>12)throw Error('กรุณาระบุเดือนและปี พ.ศ. ที่ย้ายให้ถูกต้อง');
  updated.transferMonth=`${year-543}-${String(month).padStart(2,'0')}`;
 }
 validatePersonStatus(updated);next.people[id]=updated;return next;
}
export function transferLabel(person){
 if(personStatus(person)!=='transferred')return '';
 const [year,month]=(person.transferMonth||'').split('-').map(Number);
 const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
 return `ย้าย • ${months[month-1]||'ไม่ระบุเดือน'} ${year+543}`;
}
