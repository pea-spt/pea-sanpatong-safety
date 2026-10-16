// Person IDs are scoped to their home office. Legacy bills omit that office.
export function withdrawalGroupKey(movement,officeId=''){
 if(movement?.kind!=='withdrawal'||!movement.date||!(movement.personId||movement.empId))return null;
 return JSON.stringify([movement.personOfficeId||officeId,movement.personId||movement.empId,movement.date]);
}
export function withdrawalGroup(state,key,officeId){
 const bills=Object.values(state.movements||{}).filter(m=>withdrawalGroupKey(m,officeId)===key)
  .sort((a,b)=>(a.ts||0)-(b.ts||0)||a.id.localeCompare(b.id));
 const files=new Map(),links=new Set();
 for(const m of Object.values(state.movements||{})){
  const belongs=withdrawalGroupKey(m,officeId)===key;
  if(belongs&&/^https:\/\//.test(m.evidence||''))links.add(m.evidence);
  for(const f of Object.values(m.files||{}))if(f.evidenceGroup===key||(!f.evidenceGroup&&belongs))files.set(f.id,f);
 }
 const all=[...files.values()].sort((a,b)=>(a.ts||0)-(b.ts||0));
 return {bills,files:all.filter(f=>!all.some(n=>n.replacesId===f.id)),links:[...links]};
}
