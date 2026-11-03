const {t}=RShellI18n;
const api=acquireVsCodeApi(),terms=new Map();let active,settings={fontSize:14,fontFamily:"monospace"};
const send=(type,id,data={})=>api.postMessage({type,id,...data});
function instanceStatus(i){return t(i.status)+(i.error?' · '+i.error:'');}
function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=fn;return b;}
function terminal(id){if(terms.has(id))return terms.get(id);const el=document.createElement('div');el.className='terminal';document.querySelector('#terminals').append(el);const term=new Terminal({cursorBlink:true,scrollback:5000,...settings,theme:terminalTheme()}),fit=new FitAddon.FitAddon();term.loadAddon(fit);term.open(el);
 term.attachCustomKeyEventHandler(e=>{
  if(!e.ctrlKey||!e.shiftKey||e.altKey||e.metaKey||!['c','v'].includes(e.key.toLowerCase()))return true;
  if(e.type==='keydown'&&!e.repeat){if(e.key.toLowerCase()==='c'){const text=term.getSelection();if(text)send('copy',id,{text});}else send('paste',id);}
  e.preventDefault();e.stopPropagation();return false;
 });
 el.addEventListener('wheel',e=>{
  if(!e.ctrlKey||!e.deltaY)return;
  e.preventDefault();e.stopPropagation();
  term.options.fontSize=Math.max(6,Math.min(72,term.options.fontSize+(e.deltaY<0?1:-1)));
  requestAnimationFrame(resize);
 },{passive:false,capture:true});
 term.onData(data=>send('input',id,{data}));term.onResize(({cols,rows})=>send('resize',id,{cols,rows}));const t={term,fit,el};terms.set(id,t);return t;}
function resize(){const t=terms.get(active);if(t&&t.el.clientWidth>0&&t.el.clientHeight>0){t.fit.fit();send('resize',active,{cols:t.term.cols,rows:t.term.rows});}}


document.querySelector('#add').onclick=()=>send('add');
window.addEventListener('message',({data:m})=>{
 if(m.type==='paste'){terms.get(m.id)?.term.paste(m.text);return;}
 if(m.type==='editSession'){openSessionForm(m.session);return;}
 if(m.type==='sessionSaved'){document.querySelector('#session-editor')?.remove();return;}
 if(m.type==='sessionError'){const form=document.querySelector('#session-editor');if(form){form.querySelector('[role=alert]').textContent=m.error;form.querySelector('[type=submit]').disabled=false;}return;}
 if(m.type==='settings'){settings=m.settings;for(const t of terms.values())Object.assign(t.term.options,settings);requestAnimationFrame(resize);return;}
 if(m.type==='output'){terminal(m.id).term.write(Uint8Array.from(atob(m.data),c=>c.charCodeAt(0)));return;}
 if(m.type!=='state')return;active=m.active;
 const sessions=document.querySelector('#sessions');sessions.replaceChildren();
 for(const s of m.sessions){
  const row=document.createElement('div');row.className='list-row';row.tabIndex=0;row.textContent='▸  '+s.name;row.title=s.user+'@'+s.host+':'+s.port;
  row.onclick=()=>{sessions.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected'));row.classList.add('selected');};
  row.ondblclick=()=>send('connect',s.id);row.onkeydown=e=>{if(e.key==='Enter')send('connect',s.id);if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=row.getBoundingClientRect();showMenu(r.left,r.bottom,sessionActions(s));}};
  row.oncontextmenu=e=>{e.preventDefault();row.focus();showMenu(e.clientX,e.clientY,sessionActions(s));};sessions.append(row);
 }
 const list=document.querySelector('#instances');list.replaceChildren();
 for(const i of m.instances){
  terminal(i.id);const row=document.createElement('div');row.className='list-row instance'+(i.id===active?' selected':'');row.tabIndex=0;row.title=i.name+' · '+t(i.status);
  const label=document.createElement('span');label.className='instance-name';label.textContent='▸  '+i.name;
  const dot=document.createElement('span');dot.className='status-dot';dot.textContent=i.status==='已连接'?'●':'○';dot.title=t(i.status);
  const close=document.createElement('button');close.type='button';close.className='instance-close icon-button';close.title=t('关闭实例');close.setAttribute('aria-label',t('关闭实例')+' '+i.name);
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 16 16');icon.setAttribute('aria-hidden','true');const cross=document.createElementNS('http://www.w3.org/2000/svg','path');cross.setAttribute('d','M4 4l8 8M12 4l-8 8');icon.append(cross);close.append(icon);
  close.onclick=e=>{e.stopPropagation();send('close',i.id);};close.onkeydown=e=>e.stopPropagation();
  row.append(dot,label,close);row.onclick=()=>send('select',i.id);row.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')send('select',i.id);if(e.key==='Delete')send('close',i.id);if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=row.getBoundingClientRect();showMenu(r.left,r.bottom,instanceActions(i));}};
  row.oncontextmenu=e=>{e.preventDefault();row.focus();showMenu(e.clientX,e.clientY,instanceActions(i));};list.append(row);
 }
 const current=m.instances.find(i=>i.id===active);const title=document.querySelector('#connection-title');title.textContent=current?current.name+' · '+current.host+':'+current.port:t('SSH 终端 · 尚未连接');title.title=current?current.name+' · '+instanceStatus(current):'';
 const ids=new Set(m.instances.map(i=>i.id));for(const [id,t]of terms){if(!ids.has(id)){t.term.dispose();t.el.remove();terms.delete(id);}else t.el.style.display=id===active?'block':'none';}
 document.querySelector('#empty').hidden=!!m.instances.length;requestAnimationFrame(()=>{resize();if(!document.querySelector('#session-editor'))terms.get(active)?.term.focus();});
});
send('ready');
if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(document.querySelector('#terminals'));


function sessionActions(s){return [[t('连接'),()=>send('connect',s.id)],[t('修改连接属性'),()=>send('edit',s.id)],[t('文件传输'),()=>send('transfer',s.id)],[t('删除会话'),()=>send('delete',s.id)]];}
function instanceActions(i){return [[t('切换到此实例'),()=>send('select',i.id)],[t('复制 SSH 会话'),()=>send('duplicate',i.id)],[t('文件传输'),()=>send('transfer',i.id)],[t('关闭实例'),()=>send('close',i.id)]];}
function showMenu(x,y,actions){
 document.querySelector('#context-menu')?.remove();const menu=document.createElement('div');menu.id='context-menu';menu.setAttribute('role','menu');
 for(const [label,fn]of actions){const item=button(label,()=>{menu.remove();fn();});item.setAttribute('role','menuitem');menu.append(item);}
 document.body.append(menu);menu.style.left=Math.max(0,Math.min(x,innerWidth-menu.offsetWidth))+'px';menu.style.top=Math.max(0,Math.min(y,innerHeight-menu.offsetHeight))+'px';menu.firstChild.focus();
 menu.onkeydown=e=>{const items=[...menu.children],at=items.indexOf(document.activeElement);if(e.key==='Escape'){menu.remove();}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();items[(at+(e.key==='ArrowDown'?1:items.length-1))%items.length].focus();}};
}
document.addEventListener('pointerdown',e=>{const menu=document.querySelector('#context-menu');if(menu&&!menu.contains(e.target))menu.remove();});
function terminalTheme(){
 const css=getComputedStyle(document.body),read=(key,fallback)=>css.getPropertyValue('--vscode-'+key).trim()||fallback;
 const result={background:read('terminal-background',read('editor-background','#1e1e1e')),foreground:read('terminal-foreground',read('foreground','#cccccc')),cursor:read('terminalCursor-foreground',read('foreground','#cccccc')),selectionBackground:read('terminal-selectionBackground','#80808066')};
 for(const color of ['Black','Red','Green','Yellow','Blue','Magenta','Cyan','White','BrightBlack','BrightRed','BrightGreen','BrightYellow','BrightBlue','BrightMagenta','BrightCyan','BrightWhite']){const value=read('terminal-ansi'+color,'');if(value)result[color[0].toLowerCase()+color.slice(1)]=value;}
 return result;
}
new MutationObserver(()=>{for(const t of terms.values())t.term.options.theme=terminalTheme();}).observe(document.body,{attributes:true,attributeFilter:['class','style','data-vscode-theme-id']});
const widths=api.getState()?.widths||[220,190];
function applyWidths(){const available=document.body.clientWidth-10;const min=Math.min(100,available/4),center=Math.min(140,available/3);let left=Math.max(min,Math.min(widths[0],available-center-min)),right=Math.max(min,Math.min(widths[1],available-center-left));document.body.style.gridTemplateColumns=left+'px 5px minmax(0,1fr) 5px '+right+'px';requestAnimationFrame(resize);}
for(const [index,id]of ['split-left','split-right'].entries()){
 const handle=document.getElementById(id);let drag;
 handle.onpointerdown=e=>{if(e.button!==0)return;drag={x:e.clientX,width:index===0?document.body.firstElementChild.getBoundingClientRect().width:document.querySelector('aside:last-of-type').getBoundingClientRect().width};handle.setPointerCapture(e.pointerId);document.body.classList.add('resizing');e.preventDefault();};
 handle.onpointermove=e=>{if(!drag)return;widths[index]=Math.max(80,drag.width+(e.clientX-drag.x)*(index===0?1:-1));applyWidths();};
 const finish=()=>{drag=undefined;document.body.classList.remove('resizing');api.setState({...api.getState(),widths});};handle.onpointerup=finish;handle.onlostpointercapture=finish;
 handle.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();widths[index]+= (e.key==='ArrowRight'?16:-16)*(index===0?1:-1);applyWidths();api.setState({...api.getState(),widths});};
}
window.addEventListener('resize',applyWidths);applyWidths();

function openSessionForm(session){
 if(document.querySelector('#session-editor'))return;
 const overlay=document.createElement('div');overlay.id='session-editor';
 const form=document.createElement('form');form.setAttribute('role','dialog');form.setAttribute('aria-modal','true');form.setAttribute('aria-label',t(session.id?'修改 SSH 会话':'新建 SSH 会话'));
 const heading=document.createElement('h3');heading.textContent=t(session.id?'修改 SSH 会话':'新建 SSH 会话');form.append(heading);
 const inputs={};
 for(const [key,label] of [['name','会话名称（可选，默认使用主机）'],['host','主机名 / IP'],['port','端口'],['user','用户名'],['identity','私钥路径（可选，留空使用密码）']]){
  const field=document.createElement('label');field.textContent=t(label);
  const input=document.createElement('input');input.name=key;input.value=String(session[key]??'');input.type=key==='port'?'number':'text';
  if(key==='port'){input.min='1';input.max='65535';input.step='1';}
  input.required=['host','port','user'].includes(key);field.append(input);form.append(field);inputs[key]=input;
 }
 const error=document.createElement('p');error.setAttribute('role','alert');form.append(error);
 const actions=document.createElement('div');actions.className='form-actions';
 const save=button(t('保存'),()=>{});save.type='submit';
 const cancel=button(t('取消'),()=>overlay.remove());cancel.type='button';cancel.className='secondary';actions.append(cancel,save);form.append(actions);
 form.onsubmit=e=>{e.preventDefault();if(save.disabled)return;save.disabled=true;error.textContent='';const data={};for(const [key,input]of Object.entries(inputs))data[key]=input.value;if(session.id)data.id=session.id;send('saveSession',undefined,{session:data});};
 overlay.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();overlay.remove();}if(e.key==='Tab'){const items=[...form.querySelectorAll('input,button')].filter(x=>!x.disabled);if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}}};
 overlay.append(form);document.body.append(overlay);inputs.host.focus();
}
