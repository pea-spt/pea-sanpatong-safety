import {stockZones} from './stock-view.js';
import {receiptView} from './receipt-edit.js';
import {withdrawalView} from './withdrawal-cancel.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const num=n=>Number(n).toLocaleString('th-TH',{maximumFractionDigits:1});
export function inventoryModel(snapshots,offices,filters={}){
 const rows=new Map(),from=validDate(filters.from)?filters.from:'',to=validDate(filters.to)?filters.to:'';
 if(from&&to&&from>to)throw Error('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
 for(const o of offices){
  if(filters.office&&filters.office!==o.id)continue;
  const s=snapshots[o.id]||{};
  for(const [id,m] of Object.entries(s.movements||{})){
   let view,kind=m.kind;
   if(kind==='receipt')view=receiptView(s,id);
   else if(kind==='withdrawal')view=withdrawalView(s,id);
   else if(kind==='adjustment'&&!m.receiptId&&!m.withdrawalId)view=m;
   else continue;
   if(!validDate(view.date)||(to&&view.date>to))continue;
   for(const l of view.lines||[]){
    const item=s.items?.[l.itemId]||{},name=item.name||l.name||'ไม่ระบุอุปกรณ์',variant=item.variant??l.variant??'',unit=item.unit||l.unit||'ไม่ระบุหน่วย';
    if(filters.item&&filters.item!==name)continue;
    const zone=item.zone||l.zone||'ไม่ระบุหมวด';
    const key=JSON.stringify([o.id,l.itemId]);
    if(!rows.has(key))rows.set(key,{key,officeId:o.id,office:o.name,itemId:l.itemId,name,variant,unit,zone,received:0,issued:0,adjusted:0,cumulativeReceived:0,cumulativeIssued:0,cumulativeAdjusted:0,opening:0});
    const r=rows.get(key),qty=kind==='adjustment'?l.delta:(l.qty??(kind==='withdrawal'?-l.delta:l.delta));
    if(!Number.isFinite(qty))continue;
    const field=kind==='receipt'?'Received':kind==='withdrawal'?'Issued':'Adjusted',delta=kind==='withdrawal'?-qty:qty;
    r['cumulative'+field]+=qty;
    if(from&&view.date<from)r.opening+=delta;else r[field.toLowerCase()]+=qty;
   }
  }
 }
 const items=[...rows.values()].map(r=>({...r,remaining:r.cumulativeReceived-r.cumulativeIssued+r.cumulativeAdjusted,percent:r.cumulativeReceived>0?100*r.cumulativeIssued/r.cumulativeReceived:null}));
 const rank=field=>(a,b)=>b[field]-a[field]||a.name.localeCompare(b.name,'th')||a.key.localeCompare(b.key);
 const groups=[...stockZones,...new Set(items.map(r=>r.zone).filter(zone=>!stockZones.includes(zone)))].map(zone=>{const entries=items.filter(r=>r.zone===zone);return {zone,received:entries.filter(r=>r.received>0).sort(rank('received')).slice(0,10),issued:entries.filter(r=>r.issued>0).sort(rank('issued')).slice(0,10),comparison:entries.filter(r=>r.received||r.issued||r.adjusted||r.opening).sort((a,b)=>b.issued-a.issued||b.received-a.received||a.name.localeCompare(b.name,'th')||a.key.localeCompare(b.key)).slice(0,10)};});
 return {items,groups,from,to};
}
export function inventoryCharts(snapshots,offices,filters={}){
 const model=inventoryModel(snapshots,offices,filters);
 const percent=r=>r.percent===null?'คำนวณ % ไม่ได้: ไม่มีรับเข้าสะสม':`เบิกสะสม ${num(r.percent)}% ของรับเข้าสะสม${r.percent>100?' • เบิกเกินรับเข้า มีผลจากยอดปรับตรวจนับ':''}`;
 function section(title,field,paired=false){return `<section class="inventory-section"><h3>${title}</h3>${model.groups.map(g=>{const rows=g[field];if(!rows.length)return `<div class="inventory-category inventory-category-empty"><h4>${esc(g.zone)}</h4><p>ไม่มีข้อมูลในหมวดนี้ตามช่วงที่เลือก</p></div>`;return `<div class="inventory-category"><h4>${esc(g.zone)} <small>สูงสุด 10 รายการ · เรียงจำนวนมากไปน้อย</small></h4><ol class="inventory-card-grid">${rows.map((r,index)=>{const max=Math.max(1,...rows.filter(x=>x.unit===r.unit).flatMap(x=>paired?[x.received,x.issued]:[x[field]]));return `<li class="inventory-item-card"><span class="inventory-rank">อันดับ ${index+1}</span><div class="inventory-label"><strong>${esc(r.name)}</strong> ${esc(r.variant)}<small>${esc(r.office)}</small></div>${(paired?['received','issued']:[field]).map(f=>`<div class="inventory-bar-row"><span>${f==='received'?'รับเข้า':'เบิกสุทธิ'}</span><div class="inventory-track"><i class="inventory-fill inventory-${f}" style="width:${Math.max(0,100*r[f]/max)}%"></i></div><b>${num(r[f])} ${esc(r.unit)}</b></div>`).join('')}<p class="inventory-percent">${esc(percent(r))}</p>${paired?`<p class="inventory-balance">คงเหลือ ณ สิ้นช่วง ${num(r.remaining)} ${esc(r.unit)} · ยอดต้นช่วง ${num(r.opening)} · ปรับตรวจนับในช่วง ${num(r.adjusted)}</p>`:''}</li>`;}).join('')}</ol></div>`;}).join('')||'<p class="overview-empty">ไม่มีข้อมูลในช่วงที่เลือก</p>'}</section>`;}
 return `<div class="inventory-charts"><div class="overview-heading"><h2>รับเข้าและเบิกจ่ายรายอุปกรณ์</h2><span>แยก 6 หมวดอุปกรณ์ · ระบุคลัง สี/ไซส์ และหน่วยกำกับ</span></div><p class="inventory-basis">แท่งกราฟแสดงจำนวนในช่วงที่เลือก · เปอร์เซ็นต์ = เบิกสุทธิสะสม ÷ รับเข้าสะสม ตั้งแต่เริ่มบันทึกถึง ${esc(model.to||'วันที่ล่าสุด')} × 100 (ไม่ตัดตามวันเริ่มช่วง) · รับเข้าเพิ่มแล้วเปอร์เซ็นต์ลดลงเมื่อยอดเบิกเท่าเดิม · ใช้ยอดหลังแก้ไขและยกเลิก · ตัวกรองชื่อผู้เบิกและรหัสพนักงานใช้กับรายชื่อผู้เบิกเท่านั้น</p>${section('รับเข้าเทียบเบิกออก พร้อมยอดคงเหลือ','comparison',true)}<details class="inventory-disclosure"><summary>รับเข้ามากที่สุด <span>คลิกเพื่อแสดง / ซ่อน</span></summary>${section('รับเข้ามากที่สุด','received')}</details><details class="inventory-disclosure"><summary>เบิกมากที่สุด <span>คลิกเพื่อแสดง / ซ่อน</span></summary>${section('เบิกมากที่สุด','issued')}</details></div>`;
}
