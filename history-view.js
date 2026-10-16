import {withdrawalView} from './withdrawal-cancel.js';
import {withdrawalGroupKey} from './withdrawal-groups.js';
// Group only identified recipients; unrelated receipts remain in their original bills.
export function historyGroups(rows,officeId=''){
 const groups=new Map();
 for(const row of rows){
  const groupKey=withdrawalGroupKey(row,officeId);
  const key=groupKey||JSON.stringify(['bill',row.id]);
  if(!groups.has(key))groups.set(key,{key,grouped:!!groupKey,rows:[]});
  groups.get(key).rows.push(row);
 }
 return [...groups.values()];
}
// Keep withdrawal revisions in their original bill, using its original ordering and recipient.
// The immutable movement ledger remains available in the bill revision history.
export function historyRows(state){
 const movements=Object.values(state.movements||{}).filter(m=>!(m.withdrawalId&&state.movements?.[m.withdrawalId]?.kind==='withdrawal')).sort((a,b)=>(b.ts||0)-(a.ts||0));
 return movements.flatMap(m=>{
  const lines=m.kind==='withdrawal'?withdrawalView(state,m.id).lines.filter(l=>l.qty>0||m.cancelledByMovement):m.lines||[];
  return lines.map(l=>({...m,...l,id:m.id,lines:undefined}));
 });
}
