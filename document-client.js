import {driveConfig} from './drive-config.js';
import {inspectFile,driveUrl,attachDocument} from './drive-policy.js';
let legacyInvoke,backend,token='',expires=0,loadGoogle;
export function configureDocuments(functions,httpsCallable,adapter){legacyInvoke=(name,data)=>httpsCallable(functions,name,{timeout:120000})(data).then(r=>r.data);backend=adapter;}
export function resetDrive(){token='';expires=0;}
async function api(path,options={}){
 if(!token||Date.now()>=expires)throw Error('กรุณากดเชื่อม Google Drive อีกครั้ง');
 const response=await fetch(path,{...options,headers:{...options.headers,Authorization:`Bearer ${token}`}});
 if(response.status===401){resetDrive();throw Error('การเชื่อม Google หมดอายุ กรุณาเชื่อมอีกครั้ง');}
 if(!response.ok){const detail=await response.json().catch(()=>({}));throw Error(detail.error?.message||'Google Drive ไม่พร้อมใช้งาน');}
 return response.status===204?null:response.json();
}
export async function prepareDrive(){
 if(!driveConfig.clientId)throw Error('ยังไม่ได้ตั้งค่าการเชื่อม Google Drive');
 if(globalThis.google?.accounts?.oauth2)return;
 loadGoogle||=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=resolve;script.onerror=()=>{loadGoogle=null;reject(Error('โหลดบริการ Google ไม่สำเร็จ'));};document.head.append(script);});await loadGoogle;
}
export async function connectDrive(){
 if(!globalThis.google?.accounts?.oauth2)throw Error('บริการ Google ยังไม่พร้อม กรุณาลองอีกครั้ง');
 if(token&&Date.now()<expires)return {ownerEmail:driveConfig.ownerEmail};
 resetDrive();
 await new Promise((resolve,reject)=>{const client=google.accounts.oauth2.initTokenClient({client_id:driveConfig.clientId,scope:'https://www.googleapis.com/auth/drive.file',login_hint:driveConfig.ownerEmail,include_granted_scopes:false,callback:r=>{if(r.error||!r.access_token||!String(r.scope||'').split(' ').includes('https://www.googleapis.com/auth/drive.file'))return reject(Error('ไม่ได้รับอนุญาตเชื่อม Google Drive'));token=r.access_token;expires=Date.now()+Math.max(0,Number(r.expires_in)-60)*1000;resolve();},error_callback:()=>reject(Error('การเชื่อม Google ถูกยกเลิก'))});client.requestAccessToken({prompt:''});});
 try{const profile=await api('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');if(profile.user?.emailAddress?.toLowerCase()!==driveConfig.ownerEmail.toLowerCase())throw Error(`เลือกบัญชี ${driveConfig.ownerEmail} เพื่อเก็บเอกสาร`);}catch(e){resetDrive();throw e;}
 return {ownerEmail:driveConfig.ownerEmail};
}
export async function documentCall(name,data){
 if(name==='documentHealth'){await prepareDrive();return {connected:!!token&&Date.now()<expires,ownerEmail:driveConfig.ownerEmail};}
 if(!legacyInvoke)throw Error('บริการเอกสารเดิมยังไม่ได้เชื่อมต่อ');return legacyInvoke(name,data);
}
async function driveFolder(context,folder){
 if(!['live','qa'].includes(context.environment)||!['sanpatong','maewang'].includes(context.officeId)||!/^[A-Za-z0-9_-]{1,100}$/.test(folder.id))throw Error('รหัสแฟ้มไม่ถูกต้อง');
 const key=`${context.environment}-${context.officeId}-${folder.id}`;
 const query=`trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='safetyFolder' and value='${key}' }`;
 const existing=await api('https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q:query,fields:'files(id)',pageSize:'1'}));
 if(existing.files?.length)return existing.files[0].id;
 return (await api('https://www.googleapis.com/drive/v3/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`PEA Safety ${context.environment} • ${context.officeId} • ${folder.year} • ${folder.title}`,mimeType:'application/vnd.google-apps.folder',appProperties:{safetyFolder:key}})})).id;
}
export async function uploadFile(context,folderId,file,category,replacesId=''){
 if(!backend)throw Error('ยังไม่ได้เชื่อมฐานข้อมูลเอกสาร');
 const actor=backend.actor();if(!actor)throw Error('กรุณาเข้าสู่ระบบผู้ดูแล');
 const folder=await backend.folder(context,folderId);if(!folder)throw Error('ไม่พบแฟ้มจัดซื้อ');
 const {mime,sha256}=await inspectFile(file,category),parent=await driveFolder(context,{...folder,id:folderId}),id=crypto.randomUUID();
 const boundary='pea_'+crypto.randomUUID(),metadata={name:file.name,parents:[parent],appProperties:{safetyDocument:id,officeId:context.officeId,environment:context.environment,folderId}};
 const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,file,`\r\n--${boundary}--`]);
 const uploaded=await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
 const record={id,folderId,name:file.name,category,replacesId,size:file.size,mime,sha256,status:'ready',provider:'google-drive',driveFileId:uploaded.id,driveOwnerEmail:driveConfig.ownerEmail,by:actor.uid,byEmail:actor.email,ts:backend.timestamp()};
 try{await backend.save(context,current=>attachDocument(current,record));}catch(e){
  // Keep the original in Drive for recovery; never claim that its metadata was saved.
  throw Error(`ไฟล์อยู่ใน Drive แล้ว แต่บันทึกเข้าแฟ้มไม่สำเร็จ: ${e.message} • เปิด Drive ตรวจไฟล์ ${uploaded.id} ก่อนลองใหม่`);
 }
 return record;
}
export async function openFile(context,id){
 const record=await backend?.document(context,id);
 if(record?.provider==='google-drive'){
  const dialog=document.createElement('dialog'),link=document.createElement('a'),close=document.createElement('button');dialog.className='document-viewer';link.href=driveUrl(record.driveFileId);link.target='_blank';link.rel='noopener noreferrer';link.textContent=`เปิด ${record.name} ใน Google Drive`;close.textContent='ปิด';close.onclick=()=>dialog.close();dialog.append(link,close);dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();return;
 }
 const dialog=document.createElement('dialog');dialog.className='document-viewer';dialog.innerHTML='<div class="actions"><strong>กำลังเปิดเอกสาร…</strong><button type="button">ปิด</button></div><div class="document-content"></div>';document.body.append(dialog);let url;
 dialog.querySelector('button').onclick=()=>dialog.close();dialog.onclose=()=>{if(url)URL.revokeObjectURL(url);dialog.remove();};dialog.showModal();
 try{const data=await documentCall('readDocument',{...context,id});if(!dialog.isConnected)return;url=URL.createObjectURL(new Blob([Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0))],{type:data.mime}));dialog.querySelector('strong').textContent=data.name;const link=document.createElement('a');link.href=url;link.download=data.name;link.textContent='ดาวน์โหลดต้นฉบับ';const body=dialog.querySelector('.document-content');body.append(link);if(data.mime==='application/pdf'){const frame=document.createElement('iframe');frame.src=url;frame.title=data.name;body.append(frame);}else if(['image/jpeg','image/png'].includes(data.mime)){const img=document.createElement('img');img.src=url;img.alt=data.name;body.append(img);}}catch(e){if(dialog.isConnected)dialog.querySelector('strong').textContent=e.message;}
}
