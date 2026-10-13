let invoke;
export function configureDocuments(functions,httpsCallable){invoke=(name,data)=>httpsCallable(functions,name,{timeout:120000})(data).then(r=>r.data);}
export async function documentCall(name,data){if(!invoke)throw Error('บริการเอกสารยังไม่ได้เชื่อมต่อ');try{return await invoke(name,data);}catch(e){if(['functions/not-found','functions/unavailable','functions/internal'].includes(e.code))throw Error('บริการเก็บเอกสารยังไม่พร้อม กรุณาตรวจการเปิด Storage และการติดตั้งบริการ');throw e;}}
export async function uploadFile(context,folderId,file,category,replacesId=''){
 if(!file.size||file.size>10*1024*1024)throw Error('ไฟล์ต้องมีขนาดไม่เกิน 10 MB');
 const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('อ่านไฟล์ไม่สำเร็จ'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file);});
 return documentCall('uploadDocument',{...context,id:crypto.randomUUID(),folderId,name:file.name,category,replacesId,base64});
}
export async function openFile(context,id){
 const dialog=document.createElement('dialog');dialog.className='document-viewer';dialog.innerHTML='<div class="actions"><strong>กำลังเปิดเอกสาร…</strong><button type="button">ปิด</button></div><div class="document-content"></div>';document.body.append(dialog);let url;
 dialog.querySelector('button').onclick=()=>dialog.close();dialog.onclose=()=>{if(url)URL.revokeObjectURL(url);dialog.remove();};dialog.showModal();
 try{const data=await documentCall('readDocument',{...context,id});if(!dialog.isConnected)return;const bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0));url=URL.createObjectURL(new Blob([bytes],{type:data.mime}));dialog.querySelector('strong').textContent=data.name;
  const body=dialog.querySelector('.document-content'),download=document.createElement('a');download.href=url;download.download=data.name;download.textContent='ดาวน์โหลดต้นฉบับ';download.className='button';body.append(download);
  if(data.mime==='application/pdf'){const frame=document.createElement('iframe');frame.src=url;frame.title=data.name;body.append(frame);}else if(['image/jpeg','image/png'].includes(data.mime)){const img=document.createElement('img');img.src=url;img.alt=data.name;body.append(img);}else{const p=document.createElement('p');p.textContent='ไฟล์ Word / Excel ให้ดาวน์โหลดเปิดด้วยโปรแกรมของเครื่อง';body.append(p);}
 }catch(e){if(dialog.isConnected)dialog.querySelector('strong').textContent=e.message;}
}
