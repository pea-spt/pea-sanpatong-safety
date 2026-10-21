export function mountRequestPersonSearch(form,lookup){
 const fields=['empId','fullName'].map(name=>form.elements.namedItem(name));
 let generation=0,timer,selected;
 const hosts=fields.map(input=>{
  const host=document.createElement('div');host.className='item-search';
  input.placeholder='พิมพ์อย่างน้อย 3 ตัวอักษรเพื่อค้นหา';
  input.before(host);host.append(input);
  const list=document.createElement('div');list.className='item-search-options';list.hidden=true;
  list.id=`request-person-${input.name}`;list.setAttribute('role','listbox');host.append(list);
  input.autocomplete='off';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');
  return {input,host,list,people:[],cursor:-1};
 });
 const close=()=>hosts.forEach(h=>{h.list.hidden=true;h.input.setAttribute('aria-expanded','false');h.input.removeAttribute('aria-activedescendant');});
 const choose=person=>{generation++;clearTimeout(timer);fields[0].value=person.empId;fields[1].value=person.fullName;selected=person;close();};
 for(const h of hosts){
  const {input,list,host}=h;
  const message=text=>{list.replaceChildren();const p=document.createElement('p');p.textContent=text;list.append(p);};
  input.oninput=()=>{
   if(selected&&input.name==='fullName'&&input.value!==selected.fullName&&fields[0].value===selected.empId)fields[0].value='';
   selected=undefined;
   const token=++generation;clearTimeout(timer);close();h.people=[];h.cursor=-1;
   const query=input.value.trim();if(query.length<3)return;
   timer=setTimeout(async()=>{
    list.hidden=false;input.setAttribute('aria-expanded','true');message('กำลังค้นหา…');
    try{
     const people=await lookup({field:input.name,query});
     if(token!==generation||!form.isConnected)return;
     h.people=people;list.replaceChildren();
     if(!people.length)message('ไม่พบรายชื่อ กรอกชื่อ–นามสกุลเองได้');
     people.forEach((person,i)=>{const button=document.createElement('button');button.type='button';button.id=`${list.id}-${i}`;button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.textContent=`${person.empId||'ไม่มีรหัส'} • ${person.fullName}`;button.onmousedown=e=>e.preventDefault();button.onclick=()=>choose(person);list.append(button);});
    }catch{if(token===generation&&form.isConnected)message('ค้นหารายชื่อไม่ได้ชั่วคราว กรุณากรอกชื่อ–นามสกุลเอง');}
   },350);
  };
  input.onkeydown=e=>{
   if(e.key==='Escape'){generation++;clearTimeout(timer);close();return;}
   if(list.hidden||!h.people.length)return;
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();h.cursor=h.cursor<0?(e.key==='ArrowDown'?0:h.people.length-1):(h.cursor+(e.key==='ArrowDown'?1:-1)+h.people.length)%h.people.length;
    [...list.children].forEach((b,i)=>{b.classList.toggle('selected',i===h.cursor);b.setAttribute('aria-selected',String(i===h.cursor));});input.setAttribute('aria-activedescendant',list.children[h.cursor].id);
   }
   if(e.key==='Enter'){e.preventDefault();if(h.cursor>=0)choose(h.people[h.cursor]);else if(h.people.length===1)choose(h.people[0]);}
  };
  host.addEventListener('focusout',()=>queueMicrotask(()=>{if(!host.contains(document.activeElement)){generation++;clearTimeout(timer);close();}}));
 }
 return {close};
}
