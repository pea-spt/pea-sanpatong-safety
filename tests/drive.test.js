import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectFile,attachDocument,driveUrl} from '../drive-policy.js';
const record={id:'doc',folderId:'f',driveFileId:'drive_file_123',replacesId:''};
test('Drive metadata is atomic, idempotent and rejects stale replacement',()=>{
 const original={procurements:{f:{id:'f'}},items:{a:{qty:7}}};
 const attached=attachDocument(original,record);assert.equal(original.documents,undefined);assert.equal(attached.items.a.qty,7);
 assert.deepEqual(attachDocument(attached,record),attached);
 assert.throws(()=>attachDocument(attached,{...record,driveFileId:'another_file_123'}),/ซ้ำ/);
 const revision={...record,id:'doc2',driveFileId:'drive_file_456',replacesId:'doc'};const second=attachDocument(attached,revision);assert.deepEqual(attachDocument(second,revision),second);
 assert.throws(()=>attachDocument(second,{...record,id:'doc3',replacesId:'doc'}),/รุ่นใหม่/);
 assert.throws(()=>attachDocument(original,{...record,folderId:'missing'}),/แฟ้ม/);
 assert.throws(()=>driveUrl('https://evil.example'),/ไม่ถูกต้อง/);
});
test('Drive upload inspects bytes and computes digest rather than trusting MIME',async()=>{
 const pdf=new File(['%PDF-1.4 test'],'invoice.pdf',{type:'text/plain'});
 const result=await inspectFile(pdf,'ตรวจรับ');assert.equal(result.mime,'application/pdf');assert.match(result.sha256,/^[a-f0-9]{64}$/);
 await assert.rejects(inspectFile(new File(['plain text'],'fake.pdf'),'ตรวจรับ'));
 await assert.rejects(inspectFile(new File(['%PDF-1.4'],'good.pdf'),'unknown'));
 await assert.rejects(inspectFile(new File([],'empty.pdf'),'ตรวจรับ'));
});
