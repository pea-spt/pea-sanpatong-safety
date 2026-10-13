import {groupQuantity,summarizeLines} from './meeting.js';
const colors=['#7b1fa2','#0e9384','#e49a28','#4e76be','#dc6a83','#857e92'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>Number(n).toLocaleString('th-TH');
const percent=(n,total)=>total?Math.round(n*1000/total)/10:0;
const empty='<div class="overview-empty">ไม่มีข้อมูลการเบิกจ่ายในช่วงที่เลือก</div>';
export function overviewModel(lines){
 const people=new Map(),groups=new Map();
 for(const l of lines){const key=JSON.stringify([l.officeId,l.personId||l.empId||l.person]);if(!people.has(key)){people.set(key,true);const position=l.position||'ไม่ระบุ';groups.set(position,(groups.get(position)||0)+1);}}
 const months=lines.map(l=>l.date.slice(0,7)).filter(m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m)).sort();
 const last=months.at(-1),first=months[0],keys=[];
 if(last){let [year,month]=last.split('-').map(Number);for(let i=0;i<12;i++){const key=`${year}-${String(month).padStart(2,'0')}`;keys.unshift(key);if(key<=first&&i>=2)break;if(--month<1){year--;month=12;}}}
 const units=[...new Set(lines.map(l=>l.unit||'ไม่ระบุหน่วย'))];
 return {summary:summarizeLines(lines),people:[...groups].map(([label,qty])=>({label,qty})).sort((a,b)=>b.qty-a.qty),
  zones:groupQuantity(lines,l=>l.zone),offices:groupQuantity(lines,l=>l.office),items:groupQuantity(lines,l=>l.item+(l.variant?' • '+l.variant:'')),
  months:units.map(unit=>({unit,rows:keys.map(label=>({label,unit,qty:lines.filter(l=>l.date.startsWith(label)&&(l.unit||'ไม่ระบุหน่วย')===unit).reduce((n,l)=>n+l.qty,0)}))}))};
}
export function overviewStats(rows){return `<div class="overview-stats">${rows.map(([label,value],i)=>`<div class="overview-stat overview-tone-${i%4}"><span class="overview-stat-mark" aria-hidden="true">${['▤','◉','▦','↗'][i%4]}</span><div><span>${esc(label)}</span><strong>${number(value)}</strong></div></div>`).join('')}</div>`;}
function card(title,subtitle,body,wide=false){return `<section class="overview-card${wide?' overview-wide':''}"><div class="overview-card-head"><h3>${esc(title)}</h3><span>${esc(subtitle)}</span></div>${body}</section>`;}
function donut(rows){
 const total=rows.reduce((n,r)=>n+r.qty,0);if(!total)return empty;
 const circumference=2*Math.PI*55;let offset=0;
 const circles=rows.map((r,i)=>{const length=circumference*r.qty/total,start=offset;offset+=length;return `<circle cx="72" cy="72" r="55" fill="none" stroke="${colors[i%colors.length]}" stroke-width="22" stroke-dasharray="${Math.max(0,length-(rows.length>1?2:0))} ${circumference}" stroke-dashoffset="${-start}"><title>${esc(r.label)}: ${number(r.qty)} คน (${percent(r.qty,total)}%)</title></circle>`;}).join('');
 return `<div class="overview-donut"><div class="overview-ring"><svg viewBox="0 0 144 144" role="img" aria-label="${esc(rows.map(r=>`${r.label} ${r.qty} คน`).join(', '))}"><g transform="rotate(-90 72 72)">${circles}</g></svg><div class="overview-ring-center"><strong>${number(total)}</strong><span>คน</span></div></div><div class="overview-legend">${rows.map((r,i)=>`<div><i style="background:${colors[i%colors.length]}" aria-hidden="true"></i><span>${esc(r.label)}</span><strong>${number(r.qty)}</strong><small>${percent(r.qty,total)}%</small></div>`).join('')}</div></div>`;
}
function bars(rows,{top=false,teal=false}={}){
 if(!rows.length)return empty;
 return [...new Set(rows.map(r=>r.unit))].map(unit=>{const all=rows.filter(r=>r.unit===unit),total=all.reduce((n,r)=>n+r.qty,0),list=top?all.slice(0,10):all,max=Math.max(1,...all.map(r=>r.qty));return `<div class="overview-unit"><h4>หน่วย: ${esc(unit||'ไม่ระบุ')}</h4>${list.map((r,i)=>`<div class="overview-bar-row${top?' overview-bar-stack':''}" title="${esc(r.label)}: ${number(r.qty)} ${esc(unit)} (${percent(r.qty,total)}%)"><span>${esc(r.label)}</span><div class="overview-bar-track"><div style="width:${r.qty/max*100}%;background:${teal?'#0e9384':colors[i%colors.length]}"></div></div><strong>${number(r.qty)} <small>${percent(r.qty,total)}%</small></strong></div>`).join('')}</div>`;}).join('');
}
function columns(series){
 if(!series.length)return empty;return series.map(({unit,rows})=>{const max=Math.max(1,...rows.map(r=>r.qty));return `<div class="overview-unit"><h4>หน่วย: ${esc(unit)}</h4><div class="overview-months" role="img" aria-label="${esc(rows.map(r=>`${r.label}: ${r.qty} ${unit}`).join(', '))}">${rows.map(r=>{const [year,month]=r.label.split('-').map(Number),label=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][month-1];return `<div class="overview-month" title="${label} ${year+543}: ${number(r.qty)} ${esc(unit)}"><div class="overview-column-track"><div class="overview-column" style="height:${r.qty/max*100}%">${r.qty?`<strong>${number(r.qty)}</strong>`:''}</div></div><span>${label}<small>${year+543}</small></span></div>`;}).join('')}</div></div>`;}).join('');
}
export function overviewCharts(lines){const m=overviewModel(lines);return `<div class="overview-heading"><h2>ภาพรวมการเบิกจ่าย</h2><span>กราฟตามตัวกรอง • นับเฉพาะรายการที่ยืนยันจ่ายแล้ว</span></div><div class="overview-chart-grid">${card('กลุ่มผู้เบิกตามตำแหน่ง','จำนวนคน • นับผู้เบิกแต่ละคนครั้งเดียว',donut(m.people))}${card('อุปกรณ์ที่เบิก แยกตามส่วนของร่างกาย','จำนวนและสัดส่วน แยกหน่วยนับ',bars(m.zones))}${card('สัดส่วนการเบิกแยกตามหน่วยงาน','เทียบปริมาณในหน่วยเดียวกัน',bars(m.offices))}${card('รายการที่เบิกมากที่สุด 10 อันดับ','แยกสี / ไซส์ และหน่วยนับ',bars(m.items,{top:true,teal:true}))}${card('แนวโน้มการเบิกรายเดือน','สูงสุด 12 เดือน • เดือนที่ไม่มีการเบิกแสดงเป็นศูนย์',columns(m.months),true)}</div>`;}
