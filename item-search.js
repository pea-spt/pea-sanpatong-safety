export function mountItemSearch(host, items) {
  const label=document.createElement('label');
  label.textContent='อุปกรณ์';
  const input=document.createElement('input');
  input.type='search';input.placeholder='พิมพ์ชื่ออุปกรณ์ / สี / ไซส์';
  input.autocomplete='off';input.spellcheck=false;input.required=true;
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls','item-search-options');
  const hidden=document.createElement('input');hidden.type='hidden';hidden.name='itemId';
  const list=document.createElement('div');list.id='item-search-options';list.className='item-search-options';list.setAttribute('role','listbox');list.hidden=true;
  label.append(input);host.append(label,hidden,list);host.classList.add('item-search');
  const entries=items.map(([id,x])=>({id,text:`${x.name} ${x.variant||''} • เหลือ ${x.qty} ${x.unit}`}));
  let matches=[],cursor=-1;
  const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
  const choose=entry=>{hidden.value=entry.id;input.value=entry.text;input.setCustomValidity('');close();input.focus();};
  const highlight=()=>{[...list.children].forEach((node,i)=>{node.classList.toggle('selected',i===cursor);node.setAttribute('aria-selected',String(i===cursor));});if(cursor>=0){input.setAttribute('aria-activedescendant',list.children[cursor].id);list.children[cursor].scrollIntoView({block:'nearest'});}};
  const draw=()=>{
    const words=(hidden.value?'':input.value).trim().toLocaleLowerCase('th').split(/\s+/).filter(Boolean);
    matches=entries.filter(x=>words.every(w=>x.text.toLocaleLowerCase('th').includes(w)));cursor=-1;list.replaceChildren();
    matches.forEach((entry,i)=>{const option=document.createElement('button');option.type='button';option.textContent=entry.text;option.id=`item-search-option-${i}`;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.onmousedown=e=>e.preventDefault();option.onclick=()=>choose(entry);list.append(option);});
    if(!matches.length){const empty=document.createElement('p');empty.textContent='ไม่พบอุปกรณ์ที่ตรงกับคำค้น';list.append(empty);}
    list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
  };
  input.oninput=()=>{hidden.value='';input.setCustomValidity('เลือกอุปกรณ์จากรายการที่แสดง');draw();};
  input.onfocus=draw;
  input.onblur=()=>{if(!host.contains(document.activeElement))close();};
  host.addEventListener('focusout',()=>queueMicrotask(()=>{if(!host.contains(document.activeElement))close();}));
  input.onkeydown=e=>{
    if(e.key==='Escape'){close();return;}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(list.hidden)draw();if(matches.length){cursor=(cursor+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length;highlight();}}
    if(e.key==='Enter'&&!list.hidden&&!hidden.value){e.preventDefault();if(cursor>=0)choose(matches[cursor]);else if(matches.length===1)choose(matches[0]);}
  };
  input.setCustomValidity('เลือกอุปกรณ์จากรายการที่แสดง');
}
