# PPE สันป่าตอง

เว็บเริ่มต้นสำหรับ GitHub Pages ไม่มีข้อมูลหรือการเชื่อมต่อของลำพูน ใช้ HTML/CSS/JavaScript modules ไม่ต้อง build ไม่มี dependency ติดตั้งในเครื่องเพื่อเปิดใช้งานหน้าเว็บ

## เปิดระบบ

อ่าน [คู่มือตั้งค่า](SETUP.html) สร้าง Firebase project ใหม่ เปิด Email/Password สร้างบัญชีแอดมิน เปิด Realtime Database แบบ Locked mode และ deploy `firebase/database.rules.json` จากนั้นเพิ่ม `/admins/{uid}=true` (boolean) ผ่าน Firebase Console

ใส่ Web config ใน `config.js` แทน null เพื่อใช้ร่วมทุกเครื่อง หรือกรอก JSON ในหน้าตั้งค่าเพื่อใช้เฉพาะเบราว์เซอร์นั้น ไม่มีบัญชีรหัสผ่านเริ่มต้น ห้ามใส่ password, service account key, GitHub token ใน repo

## GitHub Pages

ใช้ Settings → Pages → Deploy from a branch → main → /(root) หน้าเว็บใช้ relative paths จึงรองรับ project Pages ใต้ `/ppe-sanpatong/` โดยตรง หรือเผยแพร่ source ผ่าน workflow ที่เหมาะกับหน่วยงาน

## การทำงาน

- ล็อกอินแอดมินก่อนอ่านข้อมูลทั้งหมด ไม่เปิดทะเบียนหรือคลังให้สาธารณะ
- เพิ่มทะเบียน/เปิดปิดคน นำเข้า CSV สูงสุด 500 คนต่อครั้งโดย preview และข้ามรหัสเดิม ดาวน์โหลด template ว่างได้
- เพิ่มอุปกรณ์แยก variant และหน่วยมาตรฐานเป็น SKU ยอดเริ่ม 0
- รับเข้าและเบิกหลายรายการใน transaction เดียว พร้อมประวัติและ server timestamp
- idempotency key ป้องกันคำขอเดิมบันทึกซ้ำใน transaction; ปุ่มยืนยันปิดระหว่างรอบคำขอ
- ปรับยอดพร้อมเหตุผล ตรวจคลังเทียบกับ movement ledger
- ประวัติทั้งหมด CSV/พิมพ์ PDF และ backup JSON

## ข้อจำกัดรุ่นแรก

ยังไม่เปิดหน้า QR สาธารณะ ไม่อัปโหลดไฟล์เอง ใช้ลิงก์ HTTPS หลักฐานที่หน่วยงานกำหนดสิทธิ์ไว้ ยังไม่มี role viewer/storekeeper แยก, แก้ข้อมูลรายคน, แก้ catalog, ยกเลิกเอกสารหรือ restore ผ่านเว็บ ผู้จ่ายใช้บัญชีแอดมินเท่านั้น รายการผิดแก้ด้วย adjustment มีเหตุผล ไม่ลบประวัติจาก UI

Realtime Database transaction อ่าน/เขียน `/office` ทั้งก้อน เหมาะระบบเริ่มต้นคลังเดียว ต้องวางแผนย้าย server-side transaction เมื่อข้อมูลมากขึ้น Rules จำกัดสมาชิก admins ซึ่งเป็นผู้มีสิทธิ์เต็ม ไม่ใช่ระบบ immutable audit ที่กันแอดมินดัดแปลงข้อมูลเองได้ ห้ามใช้จำนวนผลต่างเป็นหลักฐานว่าของหายเสมอ

สำรอง JSON เป็น manual export ไม่ใช่ระบบ scheduled backup หรือ restore ที่ผ่านการทดสอบแล้ว การพิมพ์ PDF ใช้ browser print ไม่ใช่รายงานแบบจัดหน้าเฉพาะ

## ตรวจโค้ด

ใช้ Node.js แล้วรัน `npm test` และ `npm run check` ทดสอบ domain สำหรับ partial failure, insufficient stock, repeated request และ CSV ไม่มี production Firebase config ใน repo จึงยังไม่สามารถตรวจ end-to-end login/rules/network จริงได้

## ทำงานต่อบนเว็บ

เชื่อม repository นี้กับ Codex Cloud หรือให้ ChatGPT อ่านไฟล์ที่เกี่ยวข้องกับ README/AGENTS แล้วช่วยแก้ จากนั้นตรวจ diff และ commit การใช้ระบบประจำวันเปิด GitHub Pages ได้เลย ไม่ต้องลง Codex
