import {initializeApp} from 'firebase-admin/app';import {getDatabase,ServerValue} from 'firebase-admin/database';import {getStorage} from 'firebase-admin/storage';import {onCall,HttpsError} from 'firebase-functions/v2/https';import {createHash} from 'node:crypto';
import {MAX_BYTES,officePath,allowedOffice,safeId,validateUpload} from './document-policy.js';
import {requestPersonQuery,requestPersonMatches} from './request-person-policy.js';
initializeApp({databaseURL:'https://ppe-sanpatong-default-rtdb.asia-southeast1.firebasedatabase.app',storageBucket:'ppe-sanpatong.firebasestorage.app'});
const opts={region:'asia-southeast1',enforceAppCheck:true,memory:'512MiB',timeoutSeconds:120,maxInstances:3,cors:['https://pea-spt.github.io']};
const db=getDatabase(),bucket=getStorage().bucket();
// No directory read permission is granted to the public client. Return only bounded matches.
export const searchRequestPeople=onCall({...opts,memory:'256MiB',timeoutSeconds:15},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','กรุณาเปิดหน้าคำขอใหม่');
 let path,search;try{path=officePath(request.data?.officeId,request.data?.environment);search=requestPersonQuery(request.data);}catch(e){throw new HttpsError('invalid-argument',e.message);}
 if((await db.ref(`${path}/requestEnabled`).get()).val()!==true)throw new HttpsError('failed-precondition','หน่วยงานยังไม่เปิดรับคำขอ');
 return {people:requestPersonMatches((await db.ref(`${path}/people`).get()).val(),search)};
});
async function authorize(request){if(!request.auth)throw new HttpsError('unauthenticated','กรุณาเข้าสู่ระบบ');const {officeId,environment}=request.data||{};let path;try{path=officePath(officeId,environment);}catch(e){throw new HttpsError('invalid-argument',e.message);}const p=(await db.ref('admins/'+request.auth.uid).get()).val();if(!allowedOffice(p,officeId))throw new HttpsError('permission-denied','ไม่มีสิทธิ์เอกสารหน่วยงานนี้');return {path,officeId,environment,uid:request.auth.uid,email:request.auth.token.email||''};}
function objectPath(context,doc){safeId(doc.folderId);safeId(doc.id);const year=Number(doc.year);if(!Number.isSafeInteger(year)||year<2500||year>2700)throw new HttpsError('failed-precondition','ปีแฟ้มไม่ถูกต้อง');return `documents/${context.environment}/${context.officeId}/${year}/${doc.folderId}/${doc.id}`;}
export const documentHealth=onCall(opts,async request=>{await authorize(request);try{const [meta]=await bucket.getMetadata();return {ready:true,bucket:meta.name,maxBytes:MAX_BYTES};}catch{throw new HttpsError('failed-precondition','ยังไม่ได้เปิด Storage หรือบริการไม่มีสิทธิ์เข้าถึง กรุณาตรวจการตั้งค่า');}});
export const uploadDocument=onCall(opts,async request=>{
 const ctx=await authorize(request);let input;try{input=validateUpload(request.data);}catch(e){throw new HttpsError('invalid-argument',e.message);}const folder=(await db.ref(`${ctx.path}/procurements/${input.folderId}`).get()).val();if(!folder)throw new HttpsError('not-found','ไม่พบแฟ้มจัดซื้อ');
 const sha256=createHash('sha256').update(input.bytes).digest('hex'),existing=(await db.ref(`${ctx.path}/documents/${input.id}`).get()).val();if(existing){if(existing.sha256!==sha256||existing.folderId!==input.folderId)throw new HttpsError('already-exists','รหัสไฟล์ซ้ำ');return {id:input.id,duplicate:true};}
 const docs=(await db.ref(`${ctx.path}/documents`).get()).val()||{},same=Object.values(docs).find(d=>d.folderId===input.folderId&&d.sha256===sha256&&d.status==='ready');if(same)return {id:same.id,duplicate:true};
 if(input.replacesId){const prev=docs[input.replacesId];if(!prev||prev.folderId!==input.folderId)throw new HttpsError('invalid-argument','ไฟล์รุ่นเดิมไม่อยู่ในแฟ้มนี้');}
 const doc={id:input.id,folderId:input.folderId,year:folder.year,name:input.name,category:input.category,mime:input.mime,size:input.bytes.length,sha256,status:'ready',replacesId:input.replacesId,by:ctx.uid,byEmail:ctx.email,ts:ServerValue.TIMESTAMP},file=bucket.file(objectPath(ctx,doc));
 try{await file.save(input.bytes,{resumable:false,preconditionOpts:{ifGenerationMatch:0},metadata:{contentType:input.mime,cacheControl:'private, no-store',metadata:{sha256,officeId:ctx.officeId,environment:ctx.environment,folderId:input.folderId}}});}catch(e){if(Number(e.code)!==412)throw new HttpsError('internal','อัปโหลดไม่สำเร็จ กรุณาลองใหม่');const [meta]=await file.getMetadata();if(meta.metadata?.sha256!==sha256)throw new HttpsError('already-exists','ไฟล์เดิมมีข้อมูลต่างกัน');}
 const result=await db.ref(`${ctx.path}/documents/${input.id}`).transaction(current=>current||doc);return {id:result.snapshot.val().id,duplicate:false};
});
export const readDocument=onCall(opts,async request=>{
 const ctx=await authorize(request);let id;try{id=safeId(request.data.id);}catch(e){throw new HttpsError('invalid-argument',e.message);}const doc=(await db.ref(`${ctx.path}/documents/${id}`).get()).val();if(!doc||doc.status!=='ready'||doc.id!==id)throw new HttpsError('not-found','ไม่พบเอกสาร');const file=bucket.file(objectPath(ctx,doc));
 const [meta]=await file.getMetadata();if(Number(meta.size)>MAX_BYTES||meta.metadata?.officeId!==ctx.officeId||meta.metadata?.environment!==ctx.environment||meta.metadata?.folderId!==doc.folderId)throw new HttpsError('permission-denied','ข้อมูลไฟล์ไม่ตรงกับหน่วยงาน');
 const [bytes]=await file.download();if(createHash('sha256').update(bytes).digest('hex')!==doc.sha256)throw new HttpsError('failed-precondition','ไฟล์ไม่ตรงกับข้อมูลที่บันทึก');return {base64:bytes.toString('base64'),mime:meta.contentType,name:doc.name};
});
