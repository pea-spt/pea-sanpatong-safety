import {withdrawalGroup} from './withdrawal-groups.js';
import {documentCall,connectDrive,uploadWithdrawalGroupFile} from './document-client.js?v=20261016-group-evidence';
import {driveUrl} from './drive-policy.js';
const sessions=new Map(),views=new Set();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function redraw(){for(const view of views){if(view.host.isConnected)view.draw();else views.delete(view);}}
export function mountWithdrawalGroupEvidence(host,key,options){
 const {getState,context,report}=options,sessionKey=JSON.stringify([context.environment,context.officeId,options.actor?.uid||'',key]);
 if(!sessions.has(sessionKey))sessions.set(sessionKey,{files:[],busy:false,status:''});
 const session=sessions.get(sessionKey);
 function draw(){
  const group=withdrawalGroup(getState(),key,context.officeId);
  host.classList.add('group-evidence');
  host.innerHTML=`<h3>หลักฐานร่วมของกลุ่ม • ${group.files.length} ไฟล์</h3><p class="hint">รูปถ่ายรวมหรือแยกอัปโหลดไว้ด้วยกันได้ เพิ่มได้หลายครั้ง ไม่ต้องแนบซ้ำทีละใบ • สูงสุด 100 MB ต่อไฟล์</p><div class="group-file-list">${group.files.map(f=>`<a href="${driveUrl(f.driveFileId)}" target="_blank" rel="noopener noreferrer">${esc(f.name)}${f.evidenceGroup?'':' (จากใบเบิกเดิม)'}</a>`).join('')}${group.links.map((link,i)=>`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">ลิงก์หลักฐานเดิม ${i+1}</a>`).join('')||''}</div><label>เพิ่มรูป / เอกสารของกลุ่ม<input type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx" ${session.busy?'disabled':''}></label><p class="group-pending">${session.files.length?'รออัปโหลด '+session.files.length+' ไฟล์: '+session.files.map(f=>esc(f.name)).join(' • '):''}</p><div class="actions"><button type="button" class="group-upload" ${session.busy?'disabled':''}>${session.busy?'กำลังอัปโหลด…':'อัปโหลดหลักฐานเข้ากลุ่ม'}</button>${session.files.length&&!session.busy?'<button type="button" class="group-clear">ล้างไฟล์ที่เลือก</button>':''}</div><p role="status">${esc(session.status)}</p>`;
  host.querySelector('input').onchange=e=>{session.files.push(...e.target.files);session.status='';redraw();};
  const clear=host.querySelector('.group-clear');if(clear)clear.onclick=()=>{session.files=[];session.status='';redraw();};
  host.querySelector('.group-upload').onclick=async()=>{
   if(session.busy)return;
   if(!session.files.length){report('เลือกรูปหรือเอกสารก่อนอัปโหลด',true);return;}
   const anchor=withdrawalGroup(getState(),key,context.officeId).bills[0];
   if(!anchor){report('ไม่พบกลุ่มเบิกจ่าย กรุณาเปิดประวัติใหม่',true);return;}
   session.busy=true;session.status='กำลังเชื่อม Google Drive…';redraw();
   let completed=0;
   try{
    await documentCall('documentHealth',context);await connectDrive();
    const total=session.files.length;
    while(session.files.length){
     session.status=`กำลังอัปโหลด ${completed+1}/${total} • ${session.files[0].name}`;redraw();
     await uploadWithdrawalGroupFile(context,anchor.id,key,session.files[0]);session.files.shift();completed++;redraw();
    }
    session.status=`อัปโหลดสำเร็จ ${completed} ไฟล์ • หลักฐานอยู่ในกลุ่มเดียวกัน`;report(session.status);
   }catch(e){session.status=`อัปโหลดสำเร็จ ${completed} ไฟล์ • ${e.message} • ไฟล์ที่เหลือยังอยู่ในรายการรออัปโหลด`;report(session.status,true);}
   finally{session.busy=false;redraw();}
  };
 }
 views.add({host,draw});draw();
}
