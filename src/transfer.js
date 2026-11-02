const {localStartDirectory}=require('./local-directory');
const {t,html,setLanguage,resolveLanguage}=require('../media/i18n');
const v=require('vscode'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{randomBytes,randomUUID}=require('node:crypto');
const call=(s,method,...args)=>new Promise((resolve,reject)=>s[method](...args,(e,r)=>e?reject(e):resolve(r)));
function safeName(name){if(typeof name!=='string'||!name||name==='.'||name==='..'||/[\\/\0]/.test(name))throw Error(t('无效文件名'));return name;}
async function openTransfer(ctx,instance){
 if(!instance||instance.status!=='已连接')throw Error(t('请先连接一个 SSH 实例'));
 const localStart=await localStartDirectory(v);
 if(localStart.fallback)v.window.showWarningMessage(t('本地起始目录不可用，已使用用户主目录。'));
 const sftp=await call(instance.client,'sftp');
 let remoteHome;try{remoteHome=await call(sftp,'realpath','.');}catch(e){sftp.end();throw e;}
 const panel=v.window.createWebviewPanel('rshell.files',t`文件传输 · ${instance.name}`,v.ViewColumn.Active,{enableScripts:true,localResourceRoots:[v.Uri.joinPath(ctx.extensionUri,'media')]});
 const nonce=randomBytes(16).toString('hex'),uri=p=>panel.webview.asWebviewUri(v.Uri.joinPath(ctx.extensionUri,'media',p));
 let disposed=false,busy=false;const dirs={local:localStart.directory,remote:remoteHome},entries={local:[],remote:[]};
 const homes={local:os.homedir(),remote:remoteHome};const tasks=[];const navigating=new Set();
 ctx.subscriptions.push(panel);
 const taskState=()=>post({type:'tasks',tasks});
 const post=m=>{if(!disposed)panel.webview.postMessage(m);};
 panel.onDidDispose(()=>{disposed=true;sftp.end();});
 panel.webview.html=html`<!doctype html><html lang="${resolveLanguage(v.workspace?.getConfiguration('rshell').get('uiLanguage','auto')||'auto',v.env?.language||'zh-CN')}"><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}'"><link rel="stylesheet" href="${uri('files.css')}"></head><body><header>文件传输 · 本地 ⇄ 远程</header><main><section id="local"></section><div id="file-split-columns" class="file-splitter columns" role="separator" aria-label="调整本地与远程宽度" aria-orientation="vertical" tabindex="0"></div><section id="remote"></section></main><div id="file-split-rows" class="file-splitter rows" role="separator" aria-label="调整文件区域与任务区域高度" aria-orientation="horizontal" tabindex="0"></div><div id="tasks"><div class="task-heading">传输任务 <button id="clear-tasks">清除已完成</button></div><div id="task-summary"></div><div class="task-scroll"><table><thead><tr><th>文件 / 文件夹</th><th>方向</th><th>目标</th><th>状态</th><th>详情</th></tr></thead><tbody id="task-list"></tbody></table></div></div><footer id="status" role="status">将文件或文件夹拖到另一侧即可传输</footer><script nonce="${nonce}" src="${uri('i18n.js')}"></script><script nonce="${nonce}" src="${uri('files.js')}"></script></body></html>`;
 async function list(side,dir=dirs[side]){
  const files=side==='local'?(await fs.readdir(dir,{withFileTypes:true})).map(e=>({name:e.name,directory:e.isDirectory(),link:e.isSymbolicLink()})):(await call(sftp,'readdir',dir)).map(e=>({name:e.filename,directory:e.attrs.isDirectory(),link:e.attrs.isSymbolicLink()}));
  dirs[side]=dir;
  entries[side]=files.filter(e=>e.name!=='.'&&e.name!=='..').sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name));
  post({type:'listing',side,path:dir,entries:entries[side],connection:{name:instance.session?.name||instance.name,host:instance.session?.host||'',port:instance.session?.port||22}});
 }
 async function copy(side,source,dest,task){
  if(disposed)throw Error(t('传输窗口已关闭'));
  const upload=side==='local';const stat=upload?await fs.lstat(source):await call(sftp,'lstat',source);
  if(stat.isSymbolicLink())throw Error(t('暂不传输符号链接'));
  let existing;try{existing=upload?await call(sftp,'lstat',dest):await fs.lstat(dest);}catch(e){if(e.code!==2&&e.code!=='ENOENT')throw e;}
  if(existing){if(existing.isSymbolicLink())throw Error(t('目标是符号链接，已跳过'));if(existing.isDirectory()!==stat.isDirectory())throw Error(t('目标存在同名且类型不同的文件'));if(!stat.isDirectory()&&await v.window.showWarningMessage(t`覆盖 ${dest}？`,{modal:true},t('覆盖'))!==t('覆盖')){task.skipped++;taskState();return;}}
  if(stat.isDirectory()){
   if(!existing){if(upload)await call(sftp,'mkdir',dest);else await fs.mkdir(dest);}
   const names=upload?await fs.readdir(source):(await call(sftp,'readdir',source)).map(e=>e.filename);
   for(const name of names){if(name==='.'||name==='..')continue;safeName(name);if(!upload&&process.platform==='win32'&&(/[<>:"|?*]/.test(name)||/[. ]$/.test(name)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name)))throw Error(t('该文件名不能安全保存到 Windows'));await copy(side,(upload?path:path.posix).join(source,name),(upload?path.posix:path).join(dest,name),task);}
  }else{
   if(!stat.isFile())throw Error(t('仅支持普通文件和目录'));
   post({type:'status',text:t`正在${upload?'上传':'下载'}：${source}`});
   await call(sftp,upload?'fastPut':'fastGet',source,dest,{step:(total,chunk,size)=>{task.detail=`${source} · ${size?Math.floor(total/size*100):100}%`;const now=Date.now();if(!task.lastUpdate||now-task.lastUpdate>200){task.lastUpdate=now;taskState();}}});
   task.completed++;task.detail=t`已完成 ${task.completed} 个文件，跳过 ${task.skipped} 个`;taskState();
  }
 }
 panel.webview.onDidReceiveMessage(async m=>{
  try{
   if(!m||typeof m.type!=='string')return;
   if(m.type==='clearTasks'){for(let n=tasks.length-1;n>=0;n--)if(tasks[n].status!=='传输中'&&tasks[n].status!=='等待中')tasks.splice(n,1);taskState();return;}
   if(m.type==='ready'){taskState();await Promise.all([list('local'),list('remote')]);return;}
   if(busy)return;
   if(m.type==='browse'&&['local','remote'].includes(m.side)){
    const side=m.side;if(navigating.has(side))return;navigating.add(side);try{const join=side==='local'?path:path.posix;
    let next=dirs[side];
    if(m.action==='pick'&&side==='local'){const picked=await v.window.showOpenDialog({canSelectFiles:false,canSelectFolders:true,canSelectMany:false,defaultUri:v.Uri.file(dirs.local)});if(!picked)return;next=picked[0].fsPath;}
    else if(m.action==='home')next=homes[side];
    else if(m.name==='..')next=join.dirname(dirs[side]);
    else if(typeof m.path==='string'){const value=m.path.trim();next=join.isAbsolute(value)?join.normalize(value):join.resolve(dirs[side],value);}
    else if(m.name){const item=entries[side].find(e=>e.name===m.name&&e.directory);if(!item)return;next=join.join(dirs[side],safeName(item.name));}
    await list(side,next);
    }finally{navigating.delete(side);}
   }
   if(m.type==='transfer'&&['local','remote'].includes(m.from)&&Array.isArray(m.names)){
    if(navigating.size)return;
    const from=m.from,to=from==='local'?'remote':'local';
    const sourceDir=dirs[from],targetDir=dirs[to];
    const queue=[...new Set(m.names)].map(name=>{safeName(name);if(from==='remote'&&process.platform==='win32'&&(/[<>:"|?*]/.test(name)||/[. ]$/.test(name)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name)))throw Error(t('该文件名不能安全保存到 Windows'));if(!entries[from].some(e=>e.name===name))throw Error(t('文件列表已变化，请刷新后重试'));return {id:randomUUID(),name,from,dest:(to==='local'?path:path.posix).join(targetDir,name),status:'等待中',detail:'',completed:0,skipped:0};});
    busy=true;post({type:'busy',value:true});tasks.push(...queue);taskState();
    try{for(const task of queue){task.status='传输中';taskState();try{await copy(from,(from==='local'?path:path.posix).join(sourceDir,task.name),task.dest,task);task.status=task.skipped?'完成（有跳过）':'成功';task.detail=t`完成 ${task.completed} 个文件，跳过 ${task.skipped} 个`;}catch(e){task.status='失败';task.detail=e.message;}taskState();}post({type:'status',text:t('本批传输结束，请查看下方任务结果')});}

    finally{busy=false;post({type:'busy',value:false});await Promise.all([list('local'),list('remote')]);}
   }
  }catch(e){post({type:'status',text:t`失败：${e.message}`});}
 });
}
module.exports={openTransfer,safeName};
