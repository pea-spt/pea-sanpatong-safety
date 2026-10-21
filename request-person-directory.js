// Keep the searchable values reproducible by Realtime Database Rules.
export const requestPersonPrefix=value=>String(value??'').toLowerCase();
export function publicRequestPeople(people){
 return Object.fromEntries(Object.entries(people||{}).filter(([,p])=>p?.active===true&&(!p.employmentStatus||p.employmentStatus==='active')).map(([id,p])=>[id,{empId:String(p.empId||''),fullName:String(p.fullName||''),empIdSearch:requestPersonPrefix(p.empId),fullNameSearch:requestPersonPrefix(p.fullName)}]));
}
export function requestPersonQuery(data){
 if(!['empId','fullName'].includes(data?.field)||typeof data.query!=='string')throw Error('ระบุช่องและคำค้นให้ถูกต้อง');
 const startAt=requestPersonPrefix(data.query.trim());
 if(startAt.length<3||startAt.length>120)throw Error('พิมพ์อย่างน้อย 3 ตัวอักษร และไม่เกิน 120 ตัวอักษร');
 return {orderByChild:data.field+'Search',startAt,endAt:startAt+'\uf8ff',limitToFirst:8};
}
