import {resolveRecipient} from './recipients.js';
import {isCurrentPerson} from './person-status.js';
export const emptyOffice=()=>({settings:{name:'PEA Sanpatong Safety',location:'',contact:''},people:{},items:{},movements:{}});
export function positiveInteger(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Error('จำนวนต้องเป็นจำนวนเต็มมากกว่า 0');return n;}
export function applyMovement(current,record,context={}){
 record=structuredClone(record);
 const state=structuredClone(current||emptyOffice());state.items||={};state.movements||={};
 if(state.movements[record.id])return state;
 if(!['receipt','withdrawal','adjustment'].includes(record.kind))throw Error('ประเภทรายการไม่ถูกต้อง');
 if(!record.lines?.length)throw Error('กรุณาเพิ่มรายการ');
 if(record.kind==='withdrawal'){const {person,source}=resolveRecipient(state,record,context);if(source)Object.assign(record,{personOfficeId:source,issuingOfficeId:context.officeId,personName:person.fullName||'',empId:person.empId||'',personPosition:person.position||''});}
 if(record.kind==='adjustment'&&!record.note?.trim())throw Error('กรุณาระบุเหตุผลปรับยอด');
 const seen=new Set();
 for(const line of record.lines){
  if(seen.has(line.itemId))throw Error('รายการซ้ำในเอกสาร');seen.add(line.itemId);
  const item=state.items[line.itemId];if(!item||item.active===false)throw Error('ไม่พบรายการที่ใช้งาน');
  if(!Number.isSafeInteger(item.qty)||item.qty<0)throw Error('ยอดคลังเดิมไม่ถูกต้อง');
  const delta=record.kind==='adjustment'?Number(line.delta):positiveInteger(line.qty)*(record.kind==='withdrawal'?-1:1);
  if(!Number.isSafeInteger(delta)||delta===0)throw Error('จำนวนปรับยอดไม่ถูกต้อง');
  const next=item.qty+delta;if(!Number.isSafeInteger(next)||next<0)throw Error('ของไม่พอ: '+item.name);
  item.qty=next;line.delta=delta;line.name=item.name;line.variant=item.variant||'';line.unit=item.unit;
 }
 state.movements[record.id]=structuredClone(record);return state;
}
export function reconcile(state){const sums={};for(const m of Object.values(state.movements||{}))for(const l of m.lines||[])sums[l.itemId]=(sums[l.itemId]||0)+l.delta;return Object.entries(state.items||{}).map(([id,x])=>({id,expected:sums[id]||0,actual:x.qty,gap:(sums[id]||0)-x.qty}));}
export function csv(rows){return '\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');}
export function parseCSV(text){const rows=[];let row=[],value='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(value);value='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))rows.push(row);row=[];value='';}else value+=c;}if(quoted)throw Error('ไฟล์ CSV มีเครื่องหมายคำพูดไม่ครบ');row.push(value);if(row.some(x=>x.trim()))rows.push(row);if(rows[0])rows[0][0]=rows[0][0].replace(/^\ufeff/,'');return rows;}
