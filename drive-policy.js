export const documentCategories=['ขอซื้อ','อนุมัติ','ใบสั่งซื้อ','ใบส่งของ','ตรวจรับ','ใบแจ้งหนี้','รูปประกอบ','อื่น ๆ'];
export function driveUrl(id){if(typeof id!=='string'||!/^[A-Za-z0-9_-]{10,200}$/.test(id))throw Error('รหัสไฟล์ Google Drive ไม่ถูกต้อง');return `https://drive.google.com/file/d/${id}/view`;}
export async function inspectFile(file,category){
 if(!file.size||file.size>100*1024*1024)throw Error('ไฟล์ต้องมีขนาดไม่เกิน 100 MB');
 if(!documentCategories.includes(category)||!file.name||file.name.length>180)throw Error('ชื่อหรือประเภทเอกสารไม่ถูกต้อง');
 const ext=file.name.split('.').at(-1).toLowerCase(),bytes=new Uint8Array(await file.arrayBuffer()),hex=[...bytes.slice(0,8)].map(n=>n.toString(16).padStart(2,'0')).join('');
 const mime={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'}[ext];
 const valid=ext==='pdf'?new TextDecoder().decode(bytes.slice(0,5))==='%PDF-':['doc','xls'].includes(ext)?hex==='d0cf11e0a1b11ae1':['docx','xlsx'].includes(ext)?hex.startsWith('504b0304'):['jpg','jpeg'].includes(ext)?hex.startsWith('ffd8ff'):ext==='png'?hex==='89504e470d0a1a0a':false;
 if(!mime||!valid)throw Error('รองรับ PDF, Word, Excel, JPG และ PNG ที่ตรงกับชนิดไฟล์จริง');
 const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
 return {mime,sha256};
}
export function attachDocument(current,record){
 if(!current?.procurements?.[record.folderId])throw Error('ไม่พบแฟ้มจัดซื้อ');
 if(current.documents?.[record.id]){if(current.documents[record.id].driveFileId!==record.driveFileId)throw Error('รหัสเอกสารซ้ำ');return structuredClone(current);}
 if(record.replacesId&&(current.documents?.[record.replacesId]?.folderId!==record.folderId||Object.values(current.documents||{}).some(d=>d.replacesId===record.replacesId)))throw Error('ไฟล์เดิมมีรุ่นใหม่แล้ว กรุณาตรวจข้อมูลล่าสุด');
 const next=structuredClone(current);next.documents||={};
 driveUrl(record.driveFileId);next.documents[record.id]=record;return next;
}
