let sequence=0;
export function mountSelectSearch(select,{placeholder}={}){
 if(!select||select.dataset.searchable)return;
 select.dataset.searchable='true';
 const required=select.required,label=select.closest('label'),title=[...(label?.childNodes||[])].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()||'รายการ';
 const host=document.createElement('div');host.className='item-search';
 const input=document.createElement('input');input.type='search';input.autocomplete='off';input.spellcheck=false;input.required=required;input.placeholder=placeholder||`พิมพ์ค้นหา${title}`;
 input.setAttribute('aria-label',title);input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
 const list=document.createElement('div');list.id=`select-search-${++sequence}`;list.className='item-search-options';list.setAttribute('role','listbox');list.setAttribute('aria-label',title);list.hidden=true;input.setAttribute('aria-controls',list.id);
 select.before(host);host.append(input,list);select.hidden=true;select.required=false;select.tabIndex=-1;
 let matches=[],cursor=-1,selectedValue=select.value;
 const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
 const validity=()=>input.setCustomValidity(input.value&&!select.value?'เลือกจากรายการที่แสดง':required&&!select.value?'เลือกจากรายการที่แสดง':'');
 const sync=()=>{selectedValue=select.value;input.value=selectedValue?select.selectedOptions[0]?.textContent||'':'';input.disabled=select.disabled;validity();close();};
 const highlight=()=>{[...list.children].forEach((node,i)=>{node.classList.toggle('selected',i===cursor);node.setAttribute('aria-selected',String(i===cursor));});if(cursor>=0){input.setAttribute('aria-activedescendant',list.children[cursor].id);list.children[cursor].scrollIntoView({block:'nearest'});}};
 const choose=option=>{select.value=option.value;sync();input.focus();close();select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));};
 const draw=()=>{
  const words=(select.value?'':input.value).trim().toLocaleLowerCase('th').split(/\s+/).filter(Boolean);
  matches=[...select.options].filter(o=>!o.disabled&&(!required||o.value)&&words.every(w=>o.textContent.toLocaleLowerCase('th').includes(w)));cursor=-1;list.replaceChildren();
  matches.forEach((option,i)=>{const button=document.createElement('button');button.type='button';button.textContent=option.textContent;button.id=`${list.id}-${i}`;button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.onmousedown=e=>e.preventDefault();button.onclick=()=>choose(option);list.append(button);});
  if(!matches.length){const empty=document.createElement('p');empty.textContent='ไม่พบรายการที่ตรงกับคำค้น';list.append(empty);}
  list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
 };
 input.oninput=()=>{select.value='';selectedValue='';validity();draw();};input.onfocus=draw;
 host.addEventListener('focusout',()=>queueMicrotask(()=>{if(!host.contains(document.activeElement))close();}));
 input.onkeydown=e=>{
  if(e.key==='Escape'){close();return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(list.hidden)draw();if(matches.length){cursor=cursor<0?(e.key==='ArrowDown'?0:matches.length-1):(cursor+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length;highlight();}}
  if(e.key==='Enter'&&!list.hidden){e.preventDefault();if(cursor>=0)choose(matches[cursor]);else if(matches.length===1)choose(matches[0]);}
 };
 select.addEventListener('change',sync);select.form?.addEventListener('reset',()=>queueMicrotask(sync));
 new MutationObserver(()=>{input.disabled=select.disabled;if(selectedValue!==select.value||select.value)sync();else{validity();if(!list.hidden)draw();}}).observe(select,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','selected','value']});
 sync();return {input,refresh:sync};
}
export function searchSelects(host,selector){host.querySelectorAll(selector).forEach(select=>mountSelectSearch(select));}
