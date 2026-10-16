import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectDrive,configureDocuments,uploadFile,uploadWithdrawalFile,uploadWithdrawalGroupFile,documentCall,resetDrive} from '../document-client.js';
import {driveConfig} from '../drive-config.js';
test('Drive rejects wrong owner and never reports attachment success after metadata save fails',async()=>{
 const priorGoogle=globalThis.google,priorFetch=globalThis.fetch;
 let owner='wrong@example.test',writes=0,scopes='',requested,configuration,granted=true;
 globalThis.google={accounts:{oauth2:{initTokenClient:options=>{scopes=options.scope;configuration=options;return {requestAccessToken:override=>{requested=override;options.callback({access_token:'test-only',expires_in:3600,scope:granted?options.scope:''});}};}}}};
 globalThis.fetch=async url=>new Response(JSON.stringify(url.includes('/about?')?{user:{emailAddress:owner}}:url.includes('uploadType=')?{id:'test_drive_file_123'}:{files:[{id:'test_folder_123'}]}),{status:200,headers:{'Content-Type':'application/json'}});
 configureDocuments({},()=>{}, {actor:()=>({uid:'test',email:'test@example.test'}),folder:async()=>({id:'f',year:2570,title:'Test'}),timestamp:()=>1,save:async()=>{writes++;throw Error('offline');}});
 try{
  await assert.rejects(connectDrive(),/เลือกบัญชี/);assert.equal((await documentCall('documentHealth')).connected,false);
  owner=driveConfig.ownerEmail;granted=false;await assert.rejects(connectDrive(),/ไม่ได้รับอนุญาต/);granted=true;await connectDrive();assert.equal(requested.prompt,'');assert.equal(configuration.login_hint,driveConfig.ownerEmail);assert.equal(configuration.include_granted_scopes,false);assert.equal(scopes,'https://www.googleapis.com/auth/drive.file');
  await assert.rejects(uploadFile({officeId:'sanpatong',environment:'qa'},'f',new File(['%PDF-1.4 test'],'test.pdf'),'ตรวจรับ'),/ไฟล์อยู่ใน Drive แล้ว.*offline/);assert.equal(writes,1);
 }finally{resetDrive();globalThis.google=priorGoogle;globalThis.fetch=priorFetch;}
});
test('withdrawal upload attaches to existing bill without procurement or inventory writes',async()=>{
 const priorGoogle=globalThis.google,priorFetch=globalThis.fetch;
 let state={items:{a:{qty:3}},movements:{w:{id:'w',kind:'withdrawal',date:'2026-10-13',personName:'ทดสอบ',lines:[{itemId:'a',qty:2,delta:-2}]}}};
 globalThis.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>o.callback({access_token:'test',expires_in:3600,scope:o.scope})})}}};
 globalThis.fetch=async url=>Response.json(url.includes('/about?')?{user:{emailAddress:driveConfig.ownerEmail}}:url.includes('uploadType=')?{id:'withdrawal_file_123'}:{files:[{id:'withdrawal_folder_123'}]});
 configureDocuments({},()=>{}, {actor:()=>({uid:'test',email:'test@example.test'}),movement:async(c,id)=>state.movements[id],timestamp:()=>1,save:async(c,update)=>{state=update(state);}});
 try{await connectDrive();const file=new File(['%PDF-1.4 test'],'proof.pdf');const record=await uploadWithdrawalFile({officeId:'sanpatong',environment:'qa'},'w',file);
 assert.equal(record.movementId,'w');assert.equal(record.folderId,undefined);assert.equal(state.items.a.qty,3);assert.equal(state.procurements,undefined);assert.equal(state.movements.w.files[record.id].driveFileId,'withdrawal_file_123');
 await assert.rejects(uploadWithdrawalFile({officeId:'sanpatong',environment:'qa'},'missing',file),/ไม่พบ/);
 }finally{resetDrive();globalThis.google=priorGoogle;globalThis.fetch=priorFetch;}
});
test('large Drive uploads use a session and save only after content finishes',async()=>{
 const priorGoogle=globalThis.google,priorFetch=globalThis.fetch;
 const file=new File(['%PDF-1.4',new Uint8Array(11*1024*1024)],'large.pdf');let uploaded=false,saved=0;
 globalThis.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:'test-only',expires_in:3600,scope:options.scope})})}}};
 globalThis.fetch=async(url,options)=>{
  if(url.includes('/about?'))return Response.json({user:{emailAddress:driveConfig.ownerEmail}});
  if(url.includes('upload_id=')){assert.equal(options.method,'PUT');assert.equal(options.body,file);uploaded=true;return Response.json({id:'large_drive_file_123'});}
  if(url.includes('uploadType=resumable')){assert.equal(options.headers['X-Upload-Content-Length'],String(file.size));assert.equal(options.headers['X-Upload-Content-Type'],'application/pdf');return new Response(null,{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test'}});}
  return Response.json({files:[{id:'test_folder_123'}]});
 };
 configureDocuments({},()=>{}, {actor:()=>({uid:'test',email:'test@example.test'}),folder:async()=>({id:'f',year:2570,title:'Test'}),timestamp:()=>1,save:async (context,update)=>{assert.ok(uploaded);const next=update({procurements:{f:{id:'f'}}});assert.equal(Object.values(next.documents)[0].size,file.size);saved++;}});
 try{await connectDrive();await uploadFile({officeId:'sanpatong',environment:'qa'},'f',file,'ตรวจรับ');assert.equal(saved,1);
  uploaded=false;globalThis.fetch=async url=>url.includes('uploadType=resumable')?new Response(null,{headers:{Location:'https://evil.example/upload'}}):Response.json({files:[{id:'test_folder_123'}]});
  await assert.rejects(uploadFile({officeId:'sanpatong',environment:'qa'},'f',file,'ตรวจรับ'),/ช่องทางอัปโหลด/);assert.equal(saved,1);
 }finally{resetDrive();globalThis.google=priorGoogle;globalThis.fetch=priorFetch;}
});

test('group uploads share one Drive folder across bills and reject a changed recipient',async()=>{
 const priorGoogle=globalThis.google,priorFetch=globalThis.fetch;
 let state={items:{a:{qty:3}},movements:{a:{id:'a',kind:'withdrawal',date:'2026-10-16',personId:'p',lines:[]},b:{id:'b',kind:'withdrawal',date:'2026-10-16',personId:'p',lines:[]}}};
 const queries=[];
 globalThis.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>o.callback({access_token:'test',expires_in:3600,scope:o.scope})})}}};
 globalThis.fetch=async url=>{
  if(url.includes('/about?'))return Response.json({user:{emailAddress:driveConfig.ownerEmail}});
  if(url.includes('uploadType='))return Response.json({id:'group_file_123'});
  queries.push(new URL(url).searchParams.get('q'));return Response.json({files:[{id:'shared_folder_123'}]});
 };
 configureDocuments({},()=>{}, {actor:()=>({uid:'test',email:'test@example.test'}),movement:async(c,id)=>state.movements[id],timestamp:()=>1,save:async(c,update)=>{state=update(state);}});
 try{
  await connectDrive();const context={officeId:'sanpatong',environment:'qa'},key=JSON.stringify(['sanpatong','p','2026-10-16']),file=new File(['%PDF-1.4 test'],'proof.pdf');
  await uploadWithdrawalGroupFile(context,'a',key,file);await uploadWithdrawalGroupFile(context,'b',key,file);
  assert.equal(queries.length,2);assert.equal(queries[0],queries[1]);assert.match(queries[0],/qa-sanpatong-group-/);
  assert.equal(Object.values(state.movements.a.files)[0].evidenceGroup,key);assert.equal(state.items.a.qty,3);
  state.movements.b.personId='other';await assert.rejects(uploadWithdrawalGroupFile(context,'b',key,file),/เปลี่ยน/);
 }finally{resetDrive();globalThis.google=priorGoogle;globalThis.fetch=priorFetch;}
});
