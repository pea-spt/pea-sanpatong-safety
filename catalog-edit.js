export function editPerson(current,id,values,expected){
 const s=structuredClone(current),p=s.people?.[id];if(!p)throw Error('ไม่พบบุคลากร');
 if(JSON.stringify(p)!==JSON.stringify(expected))throw Error('ข้อมูลเปลี่ยนแล้ว กรุณาเปิดฟอร์มใหม่');
 const fullName=values.fullName.trim();if(!fullName)throw Error('กรุณาระบุชื่อ');
 s.people[id]={...p,fullName,position:values.position.trim(),department:values.department.trim()};return s;
}
export function editItem(current,id,values,expected){
 const s=structuredClone(current),x=s.items?.[id];if(!x)throw Error('ไม่พบอุปกรณ์');
 // Stock may change while editing; compare metadata only and preserve latest quantity.
 for(const k of ['name','variant','zone','unit','minimum','active'])if(x[k]!==expected[k])throw Error('ข้อมูลเปลี่ยนแล้ว กรุณาเปิดฟอร์มใหม่');
 const name=values.name.trim(),variant=values.variant.trim(),unit=values.unit.trim(),minimum=Number(values.minimum);
 if(!name||!unit||!Number.isSafeInteger(minimum)||minimum<0)throw Error('ตรวจชื่อ หน่วย และขั้นต่ำ');
 if(Object.entries(s.items).some(([other,p])=>other!==id&&p.name===name&&(p.variant||'')===variant))throw Error('ชื่อและตัวเลือกนี้มีแล้ว');
 if(unit!==x.unit&&(x.qty!==0||Object.values(s.movements||{}).some(m=>m.lines?.some(l=>l.itemId===id))))throw Error('อุปกรณ์ที่มีคลังหรือประวัติแล้วเปลี่ยนหน่วยไม่ได้ ให้สร้าง SKU ใหม่');
 if(values.active===false&&(x.qty!==0||Object.values(s.requests||{}).some(rows=>Object.values(rows).some(r=>r?.status==='pending'&&r.lines?.some(l=>l.itemId===id)))))throw Error('ยังปิดอุปกรณ์ไม่ได้ มีของคงเหลือหรือคำขอรอยืนยัน');
 s.items[id]={...x,name,variant,unit,minimum,zone:values.zone,active:values.active};return s;
}
