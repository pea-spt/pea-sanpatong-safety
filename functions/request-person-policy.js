const normalize=value=>String(value??'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('th');
export function requestPersonQuery(data){
 if(!['empId','fullName'].includes(data?.field)||typeof data.query!=='string')throw Error('ระบุช่องและคำค้นให้ถูกต้อง');
 const query=normalize(data.query);
 if(query.length<3||query.length>120)throw Error('พิมพ์อย่างน้อย 3 ตัวอักษร และไม่เกิน 120 ตัวอักษร');
 return {field:data.field,query};
}
export function requestPersonMatches(people,search){
 return Object.values(people||{}).filter(p=>p?.active===true&&(!p.employmentStatus||p.employmentStatus==='active')&&normalize(p[search.field]).includes(search.query)).slice(0,8).map(p=>({empId:String(p.empId||''),fullName:String(p.fullName||'')}));
}
