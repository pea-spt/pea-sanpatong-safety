import {documentCall,connectDrive,uploadWithdrawalFile} from './document-client.js?v=20261013-withdrawal';
import {driveUrl} from './drive-policy.js';
import {editWithdrawalEvidence} from './withdrawal-evidence.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selected=new Map(),pending=new Map(),uploading=new Set();
const scope=c=>`${c.environment}:${c.officeId}`;
export function mountWithdrawalFiles(host,onChange){
 host.innerHTML='<label>รูป / เอกสารหลักฐาน (ไม่บังคับ)<input type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"></label><p class="hint">เลือกไฟล์ไว้เพื่ออัปโหลดหลังบันทึกการจ่าย หรือกลับมาแนบภายหลังได้ • สูงสุด 100 MB ต่อไฟล์</p>';
 host.querySelector('input').onchange=e=>onChange([...e.target.files]);
}
export async function uploadWithdrawalFiles(id,files,options){
 const key=scope(options.context)+':'+id;selected.set(scope(options.context),id);pending.set(key,[...files]);
 uploading.add(key);
 try{await documentCall('documentHealth',options.context);await connectDrive();
 for(const file of [...pending.get(key)]){await uploadWithdrawalFile(options.context,id,file);pending.get(key).shift();}}
 finally{uploading.delete(key);}
}
export function mountWithdrawals(host,options){
 const {getState,context,report,save,actor,timestamp}=options;
 host.innerHTML='<section class="card"><h2>รายการเบิกจ่าย — แนบ / แก้ไขหลักฐานภายหลัง</h2><label>ค้นหารายการเบิกจ่าย<input type="search" placeholder="ชื่อผู้เบิก วันที่ หรืออุปกรณ์"></label><div class="withdrawal-list"></div><div class="withdrawal-editor"></div></section>';
 const list=host.querySelector('.withdrawal-list'),editor=host.querySelector('.withdrawal-editor');
 const draw=q=>{const rows=Object.values(getState().movements||{}).filter(m=>m.kind==='withdrawal'&&[m.personName,m.empId,m.date,...m.lines.map(l=>l.name+' '+(l.variant||''))].join(' ').includes(q)).sort((a,b)=>(b.ts||0)-(a.ts||0));list.innerHTML=rows.length?rows.map(m=>`<div class="cart"><strong>${esc(m.date)} • ${esc(m.personName||m.empId)}</strong><p>${m.lines.map(l=>`${esc(l.name)} ${esc(l.variant)} • ${l.qty} ${esc(l.unit)}`).join(' / ')}</p><p>${Object.keys(m.files||{}).length} ไฟล์</p><button type="button" data-withdrawal="${esc(m.id)}">แนบ / แก้ไขหลักฐาน</button></div>`).join(''):'<p>ไม่พบรายการเบิกจ่าย</p>';list.querySelectorAll('button').forEach(b=>b.onclick=()=>{selected.set(scope(context),b.dataset.withdrawal);open(b.dataset.withdrawal);});};
 host.querySelector('input[type=search]').oninput=e=>draw(e.target.value);draw('');
 function open(id){
  const movement=getState().movements?.[id];if(movement?.kind!=='withdrawal')return;
  const key=scope(context)+':'+id,files=Object.values(movement.files||{}),active=files.filter(f=>!files.some(n=>n.replacesId===f.id));
  editor.innerHTML=`<h3>หลักฐานเบิกจ่าย ${esc(movement.personName)} • ${esc(movement.date)}</h3><p>รหัสรายการ ${esc(id)}</p><form class="withdrawal-edit"><label>วันที่<input name="date" type="date" required value="${esc(movement.date)}"></label><label>หมายเหตุ / เหตุผล<input name="note" value="${esc(movement.note)}"></label><label>ลิงก์หลักฐาน (ไม่บังคับ)<input name="evidence" type="url" value="${esc(movement.evidence)}"></label><button type="submit">บันทึกการแก้ไข</button></form><p class="hint">แก้วันที่ หมายเหตุ และหลักฐานได้ โดยยอดจ่ายและยอดคลังไม่เปลี่ยน</p>${files.map(f=>`<p><a target="_blank" rel="noopener noreferrer" href="${driveUrl(f.driveFileId)}">${esc(f.name)}</a> ${active.includes(f)?'':'(รุ่นเก่า)'}</p>`).join('')}<div class="withdrawal-file-input"></div><label>การแนบไฟล์<select class="replace-file"><option value="">เพิ่มหลักฐานใหม่</option>${active.map(f=>`<option value="${esc(f.id)}">แนบรุ่นใหม่แทน ${esc(f.name)}</option>`).join('')}</select></label><p class="pending-files"></p><button type="button" class="withdrawal-upload">เชื่อม Drive / อัปโหลดหลักฐาน</button><p class="upload-status" role="status"></p>`;
  const status=editor.querySelector('.upload-status'),upload=editor.querySelector('.withdrawal-upload'),fileHost=editor.querySelector('.withdrawal-file-input');
  const showPending=()=>{editor.querySelector('.pending-files').textContent=(pending.get(key)||[]).map(f=>f.name).join(' • ');upload.disabled=uploading.has(key);fileHost.querySelector('input').disabled=uploading.has(key);editor.querySelector('.replace-file').disabled=uploading.has(key);};
  mountWithdrawalFiles(fileHost,files=>{pending.set(key,files);showPending();});showPending();
  editor.querySelector('form').onsubmit=e=>{e.preventDefault();const values={...Object.fromEntries(new FormData(e.target)),id:crypto.randomUUID(),expectedVersion:movement.evidenceVersion||0};save(s=>editWithdrawalEvidence(s,id,values,actor,timestamp()));};
  upload.onclick=async()=>{
   const chosen=[...(pending.get(key)||[])],replacesId=editor.querySelector('.replace-file').value;
   if(!chosen.length){report('เลือกไฟล์หลักฐานก่อน',true);return;}if(replacesId&&chosen.length!==1){report('แนบไฟล์รุ่นใหม่ครั้งละหนึ่งไฟล์',true);return;}
   uploading.add(key);showPending();status.textContent='กำลังเชื่อม Drive / อัปโหลด…';
   try{await documentCall('documentHealth',context);await connectDrive();for(const file of chosen){await uploadWithdrawalFile(context,id,file,replacesId);pending.get(key).shift();}report('อัปโหลดหลักฐานสำเร็จ');}
   catch(e){report(e.message,true);status.textContent=e.message;}
   finally{uploading.delete(key);if(options.refresh)options.refresh();else if(host.isConnected)mountWithdrawals(host,options);}
  };
 }
 const id=selected.get(scope(context));if(id)open(id);
}
