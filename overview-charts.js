const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>Number(n).toLocaleString('th-TH');
const empty='<div class="overview-empty">ไม่มีข้อมูลการเบิกจ่ายในช่วงที่เลือก</div>';
const newer=(a,b)=>String(b.date||'').localeCompare(String(a.date||''))||(Number(b.ts)||0)-(Number(a.ts)||0);
export function overviewModel(lines){
 const people=new Map();
 for(const l of [...lines].sort(newer)){
  const personOfficeId=l.personOfficeId||l.officeId,key=JSON.stringify([personOfficeId,l.personId||l.empId||l.person]);
  if(!people.has(key))people.set(key,{key,personId:l.personId,person:l.person,empId:l.empId,personOfficeId,personOffice:l.personOffice||l.office,position:l.position,date:l.date,ts:l.ts,bills:new Set(),items:new Map()});
  const p=people.get(key);p.bills.add(JSON.stringify([l.officeId,l.id]));
  const itemKey=JSON.stringify([l.officeId,l.itemId||l.item,l.variant||'',l.unit||'']);
  if(!p.items.has(itemKey))p.items.set(itemKey,{officeId:l.officeId,office:l.office,itemId:l.itemId,item:l.item,variant:l.variant||'',unit:l.unit||'ไม่ระบุหน่วย',qty:0});
  p.items.get(itemKey).qty+=l.qty;
 }
 const positions=new Map();for(const p of people.values()){const label=p.position||'ไม่ระบุ';positions.set(label,(positions.get(label)||0)+1);}
 return {people:[...positions].map(([label,qty])=>({label,qty})).sort((a,b)=>b.qty-a.qty),recipients:[...people.values()].map(p=>({...p,bills:p.bills.size,items:[...p.items.values()]})).sort((a,b)=>newer(a,b)||String(a.person).localeCompare(String(b.person),'th'))};
}
export function overviewStats(rows){return `<div class="overview-stats">${rows.map(([label,value],i)=>`<div class="overview-stat overview-tone-${i%4}"><span class="overview-stat-mark" aria-hidden="true">${['▤','◉','▦','↗'][i%4]}</span><div><span>${esc(label)}</span><strong>${number(value)}</strong></div></div>`).join('')}</div>`;}
export function overviewCharts(lines){
 const m=overviewModel(lines);
 return `<div class="overview-heading"><h2>ผู้เบิกและอุปกรณ์ที่ได้รับ</h2><span>เรียงตามวันที่เบิกล่าสุด • เฉพาะรายการที่จ่ายแล้วตามตัวกรอง</span></div><div class="overview-recipients">${m.recipients.length?m.recipients.map(p=>`<section class="overview-card overview-recipient"><div class="overview-recipient-head"><div><h3>${esc(p.person||'ไม่ระบุชื่อผู้เบิก')}</h3><p>${esc([p.empId,p.personOffice,p.position].filter(Boolean).join(' • '))}</p></div><div class="overview-recipient-meta"><span>เบิกล่าสุด <strong>${esc(p.date||'ไม่ระบุวันที่')}</strong></span><span>${number(p.bills)} ใบเบิกในช่วงที่เลือก</span></div></div><ul class="overview-recipient-items">${p.items.map(i=>`<li><div><strong>${esc(i.item||'ไม่ระบุอุปกรณ์')}</strong>${i.variant?`<span>${esc(i.variant)}</span>`:''}<small>จ่ายจาก ${esc(i.office||i.officeId||'ไม่ระบุคลัง')}</small></div><b>${number(i.qty)} <span>${esc(i.unit)}</span></b></li>`).join('')}</ul></section>`).join(''):empty}</div>`;
}
