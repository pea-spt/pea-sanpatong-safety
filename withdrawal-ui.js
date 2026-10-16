import {historyGroups,compareHistoryDate} from './history-view.js?v=20261016-issue-date';
import {mountWithdrawalGroupEvidence} from './withdrawal-group-ui.js';
import {recipientOptions,parseRecipient,officeNames} from './recipients.js';
import {changeWithdrawalPerson} from './withdrawal-person.js?v=20261015-cross';
import {isCurrentPerson} from './person-status.js';
import {cancelWithdrawal,reviseWithdrawal,withdrawalView} from './withdrawal-cancel.js?v=20261015-withdrawal-items';
import {searchSelects} from './select-search.js';
import {documentCall,connectDrive,uploadWithdrawalFile} from './document-client.js?v=20261016-group-evidence';
import {driveUrl} from './drive-policy.js';
import {editWithdrawalEvidence} from './withdrawal-evidence.js?v=20261016-group-evidence';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selected=new Map(),pending=new Map(),uploading=new Set();
const scope=c=>`${c.environment}:${c.officeId}`;
export function selectWithdrawal(context,id){selected.set(scope(context),id);}
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
 host.innerHTML='<section class="card"><h2>รายการเบิกจ่าย — เปิดใบและจัดการ</h2><label>ค้นหารายการเบิกจ่าย<input type="search" placeholder="ชื่อผู้เบิก วันที่ หรืออุปกรณ์"></label><div class="withdrawal-list"></div><div class="withdrawal-editor"></div></section>';
 const list=host.querySelector('.withdrawal-list'),editor=host.querySelector('.withdrawal-editor');
 const draw=q=>{const rows=Object.values(getState().movements||{}).filter(m=>m.kind==='withdrawal'&&[m.personName,m.empId,m.date,...m.lines.map(l=>l.name+' '+(l.variant||''))].join(' ').includes(q)).sort(compareHistoryDate);list.innerHTML=rows.length?historyGroups(rows,context.officeId).map((group,index)=>`<section class="history-group history-color-${index%4}"><div class="history-group-title"><strong>${esc(group.rows[0].personName||group.rows[0].empId)} • ${esc(group.rows[0].date)}</strong><span>${group.rows.length} ใบเบิก • เบิกวันเดียวกัน</span></div>${group.grouped?`<div data-withdrawal-group="${esc(group.key)}"></div>`:''}<details class="group-bills"><summary>ดูใบเบิกในกลุ่ม / แก้ไขยอด (${group.rows.length} ใบ)</summary>${group.rows.map(m=>`<div class="cart"><strong>${esc(m.date)} • ${esc(m.personName||m.empId)}</strong><p>${withdrawalView(getState(),m.id).lines.map(l=>`${esc(l.name)} ${esc(l.variant)} • ${l.qty} ${esc(l.unit)}`).join(' / ')}</p><p>${m.cancelledByMovement?'ยกเลิกแล้ว • คืนคลังแล้ว':'ใช้งาน'}</p><button type="button" data-withdrawal="${esc(m.id)}">เปิดใบเบิก / แก้ไข / ยกเลิก</button></div>`).join('')}</details></section>`).join(''):'<p>ไม่พบรายการเบิกจ่าย</p>';list.querySelectorAll('[data-withdrawal-group]').forEach(el=>mountWithdrawalGroupEvidence(el,el.dataset.withdrawalGroup,options));list.querySelectorAll('[data-withdrawal]').forEach(b=>b.onclick=()=>{selected.set(scope(context),b.dataset.withdrawal);open(b.dataset.withdrawal);});};
 host.querySelector('input[type=search]').oninput=e=>draw(e.target.value);draw('');
 function open(id){
  const movement=getState().movements?.[id];if(movement?.kind!=='withdrawal')return;
  const view=withdrawalView(getState(),id);
  const key=scope(context)+':'+id,files=Object.values(movement.files||{}),active=files.filter(f=>!files.some(n=>n.replacesId===f.id));
  editor.innerHTML=`<h3>หลักฐานเบิกจ่าย ${esc(movement.personName)} • ${esc(movement.date)}</h3><p>รหัสรายการ ${esc(id)}</p><form class="withdrawal-edit"><label>วันที่<input name="date" type="date" required value="${esc(movement.date)}"></label><label>หมายเหตุ / เหตุผล<input name="note" value="${esc(movement.note)}"></label><label>ลิงก์หลักฐาน (ไม่บังคับ)<input name="evidence" type="url" value="${esc(movement.evidence)}"></label><button type="submit">บันทึกการแก้ไข</button></form><p class="hint">แก้วันที่ หมายเหตุ และหลักฐานได้ โดยยอดจ่ายและยอดคลังไม่เปลี่ยน</p>${files.map(f=>`<p><a target="_blank" rel="noopener noreferrer" href="${driveUrl(f.driveFileId)}">${esc(f.name)}</a> ${active.includes(f)?'':'(รุ่นเก่า)'}</p>`).join('')}<div class="withdrawal-file-input"></div><label>การแนบไฟล์<select class="replace-file"><option value="">เพิ่มหลักฐานใหม่</option>${active.map(f=>`<option value="${esc(f.id)}">แนบรุ่นใหม่แทน ${esc(f.name)}</option>`).join('')}</select></label><p class="pending-files"></p><button type="button" class="withdrawal-upload">เชื่อม Drive / อัปโหลดหลักฐาน</button><p class="upload-status" role="status"></p>`;
  const metadata=document.createElement('section');metadata.className='withdrawal-panel withdrawal-metadata';
  const metadataHeading=document.createElement('h3');metadataHeading.textContent='วันที่และหมายเหตุ';metadata.append(metadataHeading);
  const metadataForm=editor.querySelector('.withdrawal-edit'),metadataHint=metadataForm.nextElementSibling;metadata.append(metadataForm,metadataHint);
  const attachments=document.createElement('section');attachments.className='withdrawal-panel withdrawal-attachments';attachments.innerHTML='<h3>หลักฐานและไฟล์แนบ</h3><p class="hint">แนบไฟล์ใหม่หรือเปิดหลักฐานเดิมของใบนี้</p>';
  while(editor.children.length>2)attachments.append(editor.children[2]);
  editor.append(metadata,attachments);
  editor.querySelector('h3').textContent='จัดการใบเบิก • '+(movement.personName||movement.empId)+' • '+movement.date;
  const summary=document.createElement('div');summary.className='withdrawal-summary';summary.innerHTML=`<span class="pill">${view.status==='cancelled'?'ยกเลิกแล้ว':'ใช้งาน'}</span><span>${view.lines.filter(l=>l.qty>0).length} รายการคงเหลือ</span><p>เลือกแก้เฉพาะส่วนที่ต้องการ แต่ละส่วนบันทึกแยกกัน</p>`;editor.insertBefore(summary,metadata);
  const recipient=document.createElement('section');recipient.className='withdrawal-panel withdrawal-recipient';metadata.before(recipient);
  const people=recipientOptions(context.officeId,getState(),options.getRosters?.()||{});
  recipient.innerHTML=`<h3>ผู้เบิก</h3><p>ผู้เบิกปัจจุบัน: <strong>${esc(movement.empId)} • ${esc(movement.personName)} • ${esc(officeNames[movement.personOfficeId||context.officeId])}</strong></p>${view.status==='active'?`<form class="withdrawal-person"><label>เปลี่ยนเป็นผู้เบิก<select name="personId" required><option value="">เลือกผู้เบิกที่ถูกต้อง</option>${people.map(([pid,p])=>`<option value="${esc(pid)}">${esc(p.empId)} • ${esc(p.fullName)} • ${esc(p.office)}</option>`).join('')}</select></label><label>เหตุผลเปลี่ยนผู้เบิก<input name="reason" required></label><button type="submit">บันทึกเปลี่ยนผู้เบิก</button></form><p class="hint">เปลี่ยนเฉพาะผู้เบิก ยอดคลังและจำนวนอุปกรณ์คงเดิม</p>`:'<p class="hint">ใบนี้ยกเลิกแล้ว จึงเปลี่ยนผู้เบิกไม่ได้</p>'}`;
  const personForm=recipient.querySelector('form');if(personForm)personForm.onsubmit=e=>{e.preventDefault();const values=Object.fromEntries(new FormData(personForm)),chosen=people.find(([key])=>key===values.personId),p=chosen?.[1];if(!p){report('เลือกผู้เบิกที่ถูกต้อง',true);return;}if(!confirm('เปลี่ยนผู้เบิกจาก '+movement.personName+' เป็น '+p.fullName+' โดยจำนวนและยอดคลังคงเดิม?'))return;const change={...values,...parseRecipient(values.personId),id:crypto.randomUUID(),expectedVersion:movement.personVersion||0,expectedQuantityVersion:view.version};save(s=>changeWithdrawalPerson(s,id,change,actor,timestamp(),{officeId:context.officeId,rosters:options.getRosters?.()||{}}));};
  const personHistory=Object.values(movement.personEdits||{});if(personHistory.length){const history=document.createElement('details');history.className='withdrawal-person-history';history.innerHTML='<summary>ประวัติเปลี่ยนผู้เบิก ('+personHistory.length+')</summary>'+personHistory.map(h=>`<p><strong>${esc(h.before.personName)} → ${esc(h.after.personName)}</strong><br>เหตุผล: ${esc(h.reason)}<br><small>ผู้บันทึก: ${esc(h.byEmail)}</small></p>`).join('');recipient.append(history);}
  const cancellation=document.createElement('section');cancellation.className='withdrawal-panel withdrawal-cancellation';editor.append(cancellation);
  cancellation.innerHTML=movement.cancelledByMovement?'<p class="hint">ยกเลิกแล้วและคืนยอดเข้าคลังแล้ว</p>':`<h3>ยกเลิกใบเบิกและคืนคลัง</h3><p>คืนทั้งหมด: ${view.lines.filter(l=>l.qty>0).map(l=>esc(l.name)+' '+esc(l.variant)+' • '+l.qty+' '+esc(l.unit)).join(' / ')}</p><form><label>เหตุผลยกเลิก<input name="reason" required></label><button type="submit">ยกเลิกใบเบิก / คืนคลังทั้งหมด</button></form><p class="hint">คืนคลังครั้งเดียว เก็บต้นฉบับและประวัติยกเลิกไว้ตรวจสอบ หากต้องการเบิกใหม่ให้สร้างรายการใหม่</p>`;
  if(view.status==='active'){const danger=document.createElement('details');danger.innerHTML='<summary>ยกเลิกทั้งใบและคืนคลังทั้งหมด</summary>';while(cancellation.firstChild)danger.append(cancellation.firstChild);cancellation.append(danger);}
  const cancelForm=cancellation.querySelector('form');if(cancelForm)cancelForm.onsubmit=e=>{e.preventDefault();const reason=new FormData(cancelForm).get('reason');if(!confirm('ยืนยันยกเลิกใบเบิกของ '+(movement.personName||movement.empId)+' และคืนอุปกรณ์ทั้งหมดเข้าคลัง?'))return;const change={id:crypto.randomUUID(),reason,expectedVersion:view.version};save(s=>cancelWithdrawal(s,id,change,actor,timestamp()));};
  if(view.status==='active'){
   const quantities=document.createElement('section');quantities.className='withdrawal-panel withdrawal-quantity';metadata.before(quantities);
   const draft=view.lines.map(l=>({...l}));
   quantities.innerHTML='<h3>แก้รายการและจำนวนเบิก</h3><p>เพิ่มรายการ ลบรายการ หรือแก้จำนวนได้ ระบบตัดหรือคืนคลังเฉพาะส่วนต่างเมื่อบันทึก</p><form class="withdrawal-quantities"><div class="edit-lines"></div><label>เพิ่มอุปกรณ์<select class="add-item"><option value="">เลือกอุปกรณ์</option>'+Object.entries(getState().items||{}).filter(([,x])=>x.active!==false).map(([key,x])=>`<option value="${esc(key)}">${esc(x.name)} ${esc(x.variant)} • คงคลัง ${x.qty} ${esc(x.unit)}</option>`).join('')+'</select></label><button type="button" class="add-line">เพิ่มรายการ</button><p class="return-preview" aria-live="polite"></p><label>เหตุผลแก้ไข<input name="reason" required></label><button type="submit">บันทึกรายการ / ปรับคลังส่วนต่าง</button></form><p class="hint">เก็บใบต้นฉบับและประวัติการแก้ไขทุกครั้ง ลบทุกรายการจะยกเลิกใบและคืนคลัง</p>';
   const form=quantities.querySelector('form');
   const read=()=>draft.map((l,i)=>({itemId:l.itemId,qty:form.elements['quantity-'+i].value===''?NaN:Number(form.elements['quantity-'+i].value)}));
   const preview=()=>{form.querySelector('.quantity-confirm')?.remove();const chosen=read(),changes=draft.map((l,i)=>({line:l,delta:(view.lines.find(x=>x.itemId===l.itemId)?.qty||0)-chosen[i].qty}));form.querySelector('.return-preview').textContent=['คืนคลัง: '+changes.filter(x=>x.delta>0).map(x=>x.line.name+' '+(x.line.variant||'')+' • '+x.delta+' '+x.line.unit).join(' / '),'เบิกเพิ่ม: '+changes.filter(x=>x.delta<0).map(x=>x.line.name+' '+(x.line.variant||'')+' • '+(-x.delta)+' '+x.line.unit).join(' / ')].join(' | ');};
   const drawLines=()=>{form.querySelector('.edit-lines').innerHTML=draft.map((l,i)=>`<div><label>${esc(l.name)} ${esc(l.variant)} (เดิม ${view.lines.find(x=>x.itemId===l.itemId)?.qty||0} ${esc(l.unit)})<input name="quantity-${i}" type="number" min="0" step="1" value="${l.qty}" required></label><button type="button" data-remove="${i}">ลบรายการ</button></div>`).join('');form.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{form.elements['quantity-'+b.dataset.remove].value=0;preview();});preview();};
   form.querySelector('.add-line').onclick=()=>{const key=form.querySelector('.add-item').value;if(!key){report('เลือกอุปกรณ์ก่อน',true);return;}read().forEach((l,i)=>draft[i].qty=l.qty);const existing=draft.find(l=>l.itemId===key);if(existing){if(existing.qty===0)existing.qty=1;else{report('มีอุปกรณ์นี้แล้ว แก้จำนวนในรายการเดิมได้',true);return;}}else draft.push({itemId:key,...getState().items[key],qty:1});drawLines();};
   form.oninput=preview;drawLines();
   form.onsubmit=e=>{e.preventDefault();form.querySelector('.quantity-confirm')?.remove();const change={id:crypto.randomUUID(),reason:new FormData(form).get('reason'),lines:read(),expectedVersion:view.version};const review=document.createElement('div');review.className='quantity-confirm';review.setAttribute('role','alert');const message=document.createElement('p');message.textContent=form.querySelector('.return-preview').textContent+' • ตรวจสอบแล้วจึงยืนยันบันทึก';const commit=document.createElement('button');commit.type='button';commit.className='primary';commit.textContent='ยืนยันบันทึกรายการ';commit.onclick=()=>{commit.disabled=true;save(s=>reviseWithdrawal(s,id,change,actor,timestamp()));review.remove();};const cancel=document.createElement('button');cancel.type='button';cancel.textContent='กลับไปแก้ไข';cancel.onclick=()=>review.remove();review.append(message,commit,cancel);form.append(review);commit.focus();};
  }
  const revisions=Object.values(getState().movements||{}).filter(m=>m.withdrawalId===id).sort((a,b)=>(a.withdrawalVersion||0)-(b.withdrawalVersion||0));
  if(revisions.length){const audit=document.createElement('details');audit.className='withdrawal-quantity-history';audit.innerHTML='<summary>ประวัติแก้รายการ ('+revisions.length+')</summary>'+revisions.map(m=>`<p><strong>ครั้งที่ ${esc(m.withdrawalVersion)}</strong> • ${esc(m.note)}<br>${m.lines.map(l=>`${esc(l.name)} ${esc(l.variant)}: ${l.delta>0?'คืนคลัง':'เบิกเพิ่ม'} ${Math.abs(l.delta)} ${esc(l.unit)}`).join('<br>')}<br><small>ผู้บันทึก: ${esc(m.byEmail)}</small></p>`).join('');editor.append(audit);}
  searchSelects(editor,'select.replace-file,select[name=personId]');
  const status=editor.querySelector('.upload-status'),upload=editor.querySelector('.withdrawal-upload'),fileHost=editor.querySelector('.withdrawal-file-input');
  const showPending=()=>{editor.querySelector('.pending-files').textContent=(pending.get(key)||[]).map(f=>f.name).join(' • ');upload.disabled=uploading.has(key);fileHost.querySelector('input').disabled=uploading.has(key);editor.querySelector('.replace-file').disabled=uploading.has(key);};
  mountWithdrawalFiles(fileHost,files=>{pending.set(key,files);showPending();});showPending();
  editor.querySelector('form.withdrawal-edit').onsubmit=e=>{e.preventDefault();const values={...Object.fromEntries(new FormData(e.target)),id:crypto.randomUUID(),expectedVersion:movement.evidenceVersion||0};save(s=>editWithdrawalEvidence(s,id,values,actor,timestamp()));};
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
