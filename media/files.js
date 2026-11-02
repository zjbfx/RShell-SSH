const {t}=RShellI18n;
const api=acquireVsCodeApi();let busy=false;const selected={local:new Set(),remote:new Set()};
function send(type,data){api.postMessage({type,...data});}
const navigation={local:{back:[],forward:[],recent:[]},remote:{back:[],forward:[],recent:[]}};
const icons={'←':'M10 3 5 8l5 5M5 8h9','→':'m6 3 5 5-5 5M2 8h9','↑':'m3 7 5-5 5 5M8 2v12','⌂':'m2 7 6-5 6 5M4 6v8h8V6M7 14v-4h2v4','↻':'M13 6a5 5 0 1 0 0 4M13 2v4H9','选择文件夹':'M2 4h5l2 2h5v8H2z'};
function control(text,title,fn){const b=document.createElement('button');b.type='button';if(icons[text]||icons[Object.keys(icons).find(key=>t(key)===text)]){b.className='icon-button';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 16 16');svg.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',icons[text]||icons[Object.keys(icons).find(key=>t(key)===text)]);svg.append(path);b.append(svg);}else b.textContent=text;b.title=title;b.setAttribute('aria-label',title);b.onclick=()=>{if(!busy)fn();};return b;}
function navigate(side,path){send('browse',{side,path});}
function render(m){
 const nav=navigation[m.side];
 if(nav.current&&nav.current!==m.path){if(nav.pending==='back'){nav.back.pop();nav.forward.push(nav.current);}else if(nav.pending==='forward'){nav.forward.pop();nav.back.push(nav.current);}else{nav.back.push(nav.current);nav.forward=[];}}
 nav.pending=undefined;nav.current=m.path;nav.recent=[m.path,...nav.recent.filter(p=>p!==m.path)].slice(0,20);

 const section=document.getElementById(m.side);section.replaceChildren();selected[m.side].clear();
 const heading=document.createElement('div');heading.className='pane-heading';
 const title=document.createElement('h3');title.textContent=m.side==='local'?'本地文件':t('远程 · ')+(m.connection?.name||'SSH');
 const subtitle=document.createElement('div');subtitle.className='pane-subtitle';subtitle.textContent=m.side==='local'?'本机文件系统':(m.connection?.host||'')+':'+(m.connection?.port||22);heading.append(title,subtitle);
 const bar=document.createElement('form'),input=document.createElement('input');input.value=m.path;input.setAttribute('aria-label',title.textContent+t('路径'));const go=document.createElement('button');go.textContent=t('转到');go.className='secondary';bar.append(input,go);bar.onsubmit=e=>{e.preventDefault();send('browse',{side:m.side,path:input.value});};
 const toolbar=document.createElement('div');toolbar.className='navigation';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label',m.side==='local'?'本地导航':t('远程导航'));
 const back=control('←',t('后退'),()=>{nav.pending='back';navigate(m.side,nav.back.at(-1));});back.disabled=!nav.back.length;
 const forward=control('→',t('前进'),()=>{nav.pending='forward';navigate(m.side,nav.forward.at(-1));});forward.disabled=!nav.forward.length;
 toolbar.append(back,forward,control('↑',t('上级目录'),()=>send('browse',{side:m.side,name:'..'})),control('⌂',t('主目录'),()=>send('browse',{side:m.side,action:'home'})),control('↻',t('刷新'),()=>send('browse',{side:m.side})));
 if(m.side==='local')toolbar.append(control(t('选择文件夹'),t('选择本地文件夹'),()=>send('browse',{side:m.side,action:'pick'})));
 const recent=document.createElement('select');recent.title=t('最近访问目录');recent.setAttribute('aria-label',t('最近访问目录'));for(const p of nav.recent){const o=document.createElement('option');o.value=p;o.textContent=p;recent.append(o);}recent.onchange=()=>navigate(m.side,recent.value);input.setAttribute('list','recent-'+m.side);const history=document.createElement('datalist');history.id='recent-'+m.side;for(const p of nav.recent){const o=document.createElement('option');o.value=p;history.append(o);}bar.append(history);
 const crumbs=document.createElement('div');crumbs.className='breadcrumbs';
 const slash=String.fromCharCode(92),windows=m.side==='local'&&m.path.includes(slash),separator=windows?slash:'/';
 const parts=m.path.split(/[\\/]+/).filter(Boolean);let current='',root='';
 if(m.path.startsWith(slash+slash)){root=slash+slash+parts.splice(0,2).join(slash)+slash;}
 else if(windows||/^[A-Za-z]:/.test(m.path)){root=parts.shift()+separator;}
 else if(m.path.startsWith('/'))root='/';
 current=root;if(root)crumbs.append(control(root,root,()=>navigate(m.side,root)));
 for(const part of parts){current+=part+separator;const target=current;crumbs.append(control(part,target,()=>navigate(m.side,target)));}
 const list=document.createElement('div');list.className='file-list';
 const up=document.createElement('div');up.className='file';up.textContent='📁 ..';up.ondblclick=()=>send('browse',{side:m.side,name:'..'});list.append(up);
 for(const entry of m.entries){
  const row=document.createElement('div');row.className='file';row.tabIndex=0;row.textContent=(entry.directory?'📁 ':'📄 ')+entry.name+(entry.link?' ↗':'');row.draggable=!entry.link;
  row.onclick=e=>{if(!e.ctrlKey&&!e.metaKey){selected[m.side].clear();list.querySelectorAll('.selected').forEach(x=>x.classList.remove('selected'));}if(selected[m.side].has(entry.name)){selected[m.side].delete(entry.name);row.classList.remove('selected');}else{selected[m.side].add(entry.name);row.classList.add('selected');}};
  row.ondblclick=()=>{if(entry.directory)send('browse',{side:m.side,name:entry.name});};
  row.ondragstart=e=>{if(busy){e.preventDefault();return;}const names=selected[m.side].has(entry.name)?[...selected[m.side]]:[entry.name];e.dataTransfer.setData('application/x-rshell-files',JSON.stringify({from:m.side,names}));e.dataTransfer.effectAllowed='copy';};
  row.onkeydown=e=>{if(e.key==='Enter'&&entry.directory)send('browse',{side:m.side,name:entry.name});};list.append(row);
 }
 const transfer=document.createElement('button');transfer.textContent=m.side==='local'?'上传选中 →':t('← 下载选中');transfer.onclick=()=>{if(!busy&&selected[m.side].size)send('transfer',{from:m.side,names:[...selected[m.side]]});};
 transfer.className='transfer-action';toolbar.append(transfer);section.append(heading,toolbar,bar,crumbs,list);
 section.ondragover=e=>{if(!busy&&[...e.dataTransfer.types].includes('application/x-rshell-files')){e.preventDefault();e.dataTransfer.dropEffect='copy';section.classList.add('drop-target');}};
 section.ondragleave=e=>{if(!section.contains(e.relatedTarget))section.classList.remove('drop-target');};
 section.ondrop=e=>{e.preventDefault();section.classList.remove('drop-target');if(busy)return;try{const data=JSON.parse(e.dataTransfer.getData('application/x-rshell-files'));if(data.from!==m.side)send('transfer',data);}catch{}};
}
window.addEventListener('message',({data:m})=>{if(m.type==='listing')render(m);if(m.type==='tasks')renderTasks(m.tasks);if(m.type==='status')document.getElementById('status').textContent=m.text;if(m.type==='busy'){busy=m.value;document.body.classList.toggle('busy',busy);}});send('ready',{});

function renderTasks(tasks){
 const list=document.getElementById('task-list');list.replaceChildren();
 for(const task of tasks){const row=document.createElement('tr');row.className=task.status==='失败'?'failed':task.status==='成功'?'success':'';for(const text of [task.name,task.from==='local'?'上传 ↑':t('下载 ↓'),task.dest,t(task.status),task.detail]){const cell=document.createElement('td');cell.textContent=text;cell.title=text;row.append(cell);}list.append(row);}
 const count=status=>tasks.filter(t=>t.status===status).length;
 document.getElementById('task-summary').textContent=t`共 ${tasks.length} 项 · 等待 ${count('等待中')} · 传输中 ${count('传输中')} · 成功 ${count('成功')} · 有跳过 ${count('完成（有跳过）')} · 失败 ${count('失败')}`;
}
document.getElementById('clear-tasks').onclick=()=>send('clearTasks',{});

// Ratios survive Webview recreation; pixel limits adapt to the available space.
const savedLayout=api.getState()?.fileLayout;
const layout={columns:Number.isFinite(savedLayout?.columns)?savedLayout.columns:.5,rows:Number.isFinite(savedLayout?.rows)?savedLayout.rows:.74};
const main=document.querySelector('main'),columnSplit=document.getElementById('file-split-columns'),rowSplit=document.getElementById('file-split-rows');
function boundedRatio(value,available,minimum){const limit=Math.min(minimum/Math.max(1,available),.45);return Math.max(limit,Math.min(1-limit,value));}
function updateLayout(){
 const availableWidth=Math.max(1,main.clientWidth-6);
 const availableHeight=Math.max(1,document.body.clientHeight-72);
 const columns=boundedRatio(layout.columns,availableWidth,180),rows=boundedRatio(layout.rows,availableHeight,100);
 main.style.gridTemplateColumns=`minmax(0,${columns}fr) 6px minmax(0,${1-columns}fr)`;
 document.body.style.gridTemplateRows=`38px minmax(0,${rows}fr) 6px minmax(0,${1-rows}fr) 28px`;
 columnSplit.setAttribute('aria-valuenow',Math.round(columns*100));rowSplit.setAttribute('aria-valuenow',Math.round(rows*100));
}
function saveLayout(){api.setState({...api.getState(),fileLayout:layout});}
for(const [handle,axis] of [[columnSplit,'columns'],[rowSplit,'rows']]){
 let dragging=false;
 handle.setAttribute('aria-valuemin','0');handle.setAttribute('aria-valuemax','100');
 handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();dragging=true;handle.setPointerCapture(e.pointerId);document.body.classList.add('split-dragging',axis==='columns'?'drag-columns':'drag-rows');};
 handle.onpointermove=e=>{if(!dragging)return;const rect=main.getBoundingClientRect();const available=axis==='columns'?Math.max(1,rect.width-6):Math.max(1,document.body.clientHeight-72);const value=axis==='columns'?(e.clientX-rect.left-3)/available:(e.clientY-rect.top-3)/available;layout[axis]=boundedRatio(value,available,axis==='columns'?180:100);updateLayout();};
 const finish=()=>{if(!dragging)return;dragging=false;document.body.classList.remove('split-dragging','drag-columns','drag-rows');saveLayout();};
 handle.onpointerup=finish;handle.onpointercancel=finish;handle.onlostpointercapture=finish;
 handle.onkeydown=e=>{const keys=axis==='columns'?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'];if(!keys.includes(e.key))return;e.preventDefault();layout[axis]=Math.max(.05,Math.min(.95,layout[axis]+(e.key===keys[0]?-.02:.02)));updateLayout();saveLayout();};
 handle.ondblclick=()=>{layout[axis]=axis==='columns'?.5:.74;updateLayout();saveLayout();};
}
new ResizeObserver(updateLayout).observe(document.body);updateLayout();
