import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectDrive,configureDocuments,uploadFile,documentCall,resetDrive} from '../document-client.js';
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
