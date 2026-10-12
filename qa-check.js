import {protectApp} from './app-check.js';
import {firebaseConfig} from './config.js';
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,signInAnonymously} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getDatabase,ref,get,set} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
let connected;
document.querySelector('#run').onclick=async()=>{
 const output=document.querySelector('#result'),button=document.querySelector('#run');button.disabled=true;output.textContent='กำลังตรวจสิทธิ์…';
 try{
  if(!connected)connected=(async()=>{const fb=getApps().find(a=>a.name==='qa-permissions')||initializeApp(firebaseConfig,'qa-permissions');await protectApp(fb);await signInAnonymously(getAuth(fb));return getDatabase(fb);})();
  const db=await connected,checks=[];
  for(const [name,path] of [['สันป่าตอง','office'],['แม่วาง','offices/maewang']]){
   checks.push([name+' • อ่าน catalog QA ได้ (ต้องเปิด catalog ก่อน)',()=>get(ref(db,'qa/'+path+'/catalog')),true]);
   for(const [label,target] of [['ทะเบียนจริง',path+'/people'],['คลังจริง',path+'/items'],['ประวัติจริง',path+'/movements'],['ทะเบียน QA','qa/'+path+'/people'],['คำขอผู้อื่น','qa/'+path+'/requests/not-your-account']])checks.push([name+' • อ่าน'+label+'ไม่ได้',()=>get(ref(db,target)),false]);
   checks.push([name+' • เขียนคลัง QA ไม่ได้',()=>set(ref(db,'qa/'+path+'/items/__permission_probe__'),{name:'QA permission probe',unit:'ใบ',qty:0,active:false}),false]);
  }
  const results=[];for(const [name,fn,allowed] of checks){try{await fn();results.push((allowed?'PASS':'FAIL')+' • '+name);}catch(e){const denied=/permission.denied/i.test(e.code+' '+e.message);results.push((!allowed&&denied?'PASS':'FAIL')+' • '+name+' ('+(denied?'PERMISSION_DENIED':e.code||'เชื่อมต่อผิดพลาด')+')');}}
  output.textContent=results.join('\n');
 }catch(e){connected=null;output.textContent='ตรวจไม่สำเร็จ: '+(e.code||e.message)+' กรุณาตรวจ App Check/เครือข่าย แล้วลองใหม่';}finally{button.disabled=false;}
};
