const {t,html,setLanguage,resolveLanguage}=require('../media/i18n');
const v = require('vscode');
const {Client} = require('ssh2');
const fs = require('node:fs/promises');
const {randomUUID,randomBytes} = require('node:crypto');
const {openTransfer}=require('./transfer');
const {passwordKey,loadPassword,rememberPassword}=require('./credentials');
function activate(ctx) {
 const language=resolveLanguage(v.workspace?.getConfiguration('rshell').get('uiLanguage','auto')||'auto',v.env?.language||'zh-CN');setLanguage(language);
 let sessions=ctx.globalState.get('sessions',[]), view, active, viewReady=false, pendingEditor, selectedSession;
 const instances=new Map();
 const closing=new Set();
 const post=m=>view?.webview.postMessage(m);
 const state=()=>post({type:'state',sessions,active,instances:[...instances.values()].map(i=>({id:i.id,name:i.name,host:i.session.host,port:i.session.port,status:i.status,error:i.error}))});
 const terminalSettings=()=>{const c=v.workspace?.getConfiguration('terminal.integrated');return {fontFamily:c?.get('fontFamily')||v.workspace?.getConfiguration('editor').get('fontFamily')||'monospace',fontSize:c?.get('fontSize')||14,lineHeight:c?.get('lineHeight')||1,letterSpacing:c?.get('letterSpacing')||0};};
 if(v.workspace?.onDidChangeConfiguration)ctx.subscriptions.push(v.workspace.onDidChangeConfiguration(e=>{if(e.affectsConfiguration('rshell.uiLanguage'))v.window.showInformationMessage(t('UI 语言修改将在重新加载窗口后生效。'),t('重新加载窗口')).then(action=>{if(action===t('重新加载窗口'))v.commands.executeCommand('workbench.action.reloadWindow');});if(e.affectsConfiguration('terminal.integrated')||e.affectsConfiguration('editor.fontFamily'))post({type:'settings',settings:terminalSettings()});}));
 async function edit(s) {
  await v.commands.executeCommand('rshell.workspace.focus');
  const session=s||{name:'',host:'',port:22,user:'root',identity:''};
  if(viewReady)post({type:'editSession',session});else pendingEditor=session;
 }
 async function saveSession(m) {
  const data=m.session;
  try {
   if(!data || typeof data!=='object')throw Error(t('无效的会话配置'));
   const n={};
   for(const key of ['name','host','user','identity']) {
    if(typeof data[key]!=='string')throw Error(t('请填写完整的连接属性'));
    n[key]=data[key].trim();
    if(/[\r\n\0]/.test(n[key]))throw Error(t('连接属性包含无效字符'));
   }
   if(!n.host||/\s/.test(n.host))throw Error(t('请输入有效的主机名或 IP'));
   if(!n.user||/\s/.test(n.user))throw Error(t('请输入有效的用户名'));
   if(!/^\d+$/.test(String(data.port))||+data.port<1||+data.port>65535)throw Error(t('端口范围为 1–65535'));
   n.port=+data.port;n.name=n.name||n.host;
   if(data.id&&!sessions.some(x=>x.id===data.id))throw Error(t('该会话已被删除，请重新新建'));
   n.id=data.id||randomUUID();
   const next=data.id?sessions.map(x=>x.id===data.id?n:x):[...sessions,n];
   await ctx.globalState.update('sessions',next);
   const previous=sessions.find(x=>x.id===n.id);
   sessions=next;
   if(previous&&passwordKey(previous)!==passwordKey(n))ctx.secrets?.delete(passwordKey(previous)).catch(()=>{});
   state();post({type:'sessionSaved'});
  }catch(e){post({type:'sessionError',error:e.message});v.window.showErrorMessage?.('RShell: '+e.message);}
 }
 async function connect(s, forcePassword=false, forTransfer=false) {
  if(!s)return;
  const options={host:s.host,port:s.port,username:s.user,keepaliveInterval:15000,readyTimeout:30000};
  let password;
  if(s.identity&&!forcePassword){try{options.privateKey=await fs.readFile(s.identity);}catch(error){const action=await v.window.showWarningMessage(t('无法读取私钥，请修改连接属性或使用密码。'),t('修改连接属性'),t('使用新密码'));if(action===t('修改连接属性'))await edit(s);if(action===t('使用新密码'))return connect(s,true,forTransfer);return;}const p=await v.window.showInputBox({title:t('私钥口令（无口令则留空）'),password:true,ignoreFocusOut:true});if(p===undefined)return;options.passphrase=p;}
  else {password=await loadPassword(ctx.secrets,s,forcePassword,options=>v.window.showInputBox(options));if(password===undefined)return;options.password=password;}
  options.hostHash='sha256';options.hostVerifier=(hash,cb)=>{
   const key=`host:${s.host}:${s.port}`,known=ctx.globalState.get(key);
   if(known===hash)return cb(true);
   if(known){v.window.showErrorMessage(t('SSH 主机密钥已变化，连接已拒绝。'));return cb(false);}
   v.window.showWarningMessage(t`首次连接 ${s.host}:${s.port}，SHA256(hex): ${hash}`,{modal:true},t('信任并连接')).then(async answer=>{if(answer===t('信任并连接')){await ctx.globalState.update(key,hash);cb(true);}else cb(false);}).catch(()=>cb(false));
  };
  const used=new Set([...instances.values()].map(i=>i.name));let name=s.name,index=1;while(used.has(name)){name=s.name+'('+index+')';index++;}
  const client=new Client(),i={id:randomUUID(),name,session:{...s},client,status:'连接中',history:[],historyBytes:0};
  let settle;const result=forTransfer?new Promise(resolve=>settle=resolve):undefined;
  if(forTransfer){i.transferOnly=true;ctx.subscriptions.push({dispose:()=>client.destroy()});}else{instances.set(i.id,i);active=i.id;state();}
  const output=data=>{if(!instances.has(i.id))return;const encoded=data.toString('base64');i.history.push(encoded);i.historyBytes+=encoded.length;while(i.historyBytes>2*1024*1024&&i.history.length>1)i.historyBytes-=i.history.shift().length;post({type:'output',id:i.id,data:encoded});};
  client.on('ready',()=>{
   if(!forTransfer&&!instances.has(i.id)){client.destroy();return;}
   if(password!==undefined&&sessions.some(current=>passwordKey(current)===passwordKey(s)))rememberPassword(ctx.secrets,s,password).catch(()=>v.window.showWarningMessage(t('SSH 已连接，但密码未能保存到安全凭据存储，下次连接需重新输入。')));
   if(forTransfer){i.status='已连接';settle({instance:i});return;}
   client.shell({term:'xterm-256color',cols:100,rows:30},(err,stream)=>{
   if(err){i.status='错误';i.error=err.message;state();client.end();settle?.({error:err});return;}i.stream=stream;i.status='已连接';state();settle?.({instance:i});stream.on('data',output);stream.stderr.on('data',output);stream.on('close',()=>client.end());
  });});
  client.on('error',err=>{
   if(!forTransfer&&!instances.has(i.id))return;
   i.status=err.level==='client-authentication'?'认证失败':'错误';i.error=err.message;state();
   if(forTransfer){settle({error:err});client.destroy();return;}
   if(err.level==='client-authentication'){
    v.window.showWarningMessage(t('SSH 认证失败，请修改连接属性或输入新密码。'),t('修改连接属性'),t('使用新密码')).then(async action=>{
     if(action===t('修改连接属性'))await edit(sessions.find(x=>x.id===s.id)||s);
     if(action===t('使用新密码'))await connect(s,true);
    }).catch(e=>v.window.showErrorMessage('RShell: '+e.message));
   }
  });client.on('close',()=>{settle?.({error:Error('SSH 连接已关闭')});if(!i.status.startsWith('错误')&&i.status!=='认证失败')i.status='已断开';state();});
  try{client.connect(options);}catch(error){i.status='错误';i.error=error.message;state();client.destroy();if(forTransfer){settle({error});return result;}const action=await v.window.showWarningMessage(t('连接参数无效，请修改连接属性或使用密码。'),t('修改连接属性'),t('使用新密码'));if(action===t('修改连接属性'))await edit(s);if(action===t('使用新密码'))await connect(s,true);}
  return result;
 }
 async function closeInstance(id) {
  const instance=instances.get(id);if(!instance||closing.has(id))return;
  closing.add(id);
  try{
   if(instance.status==='连接中'||instance.status==='已连接'){
    const answer=await v.window.showWarningMessage(t`关闭 SSH 实例“${instance.name}”？`,{modal:true,detail:t('关闭将断开 SSH 连接，并中止此连接上的文件传输。')},t('关闭实例'));
    if(answer!==t('关闭实例'))return;
   }
   if(instances.get(id)!==instance)return;
   instances.delete(id);
   if(active===id)active=instances.keys().next().value;
   state();
   if(instance.status==='连接中')instance.client.destroy();else instance.client.end();
  }finally{closing.delete(id);}
 }
 async function transfer(i,sessionId=selectedSession) {
  await openTransfer(ctx,i,()=>sessions,async id=>{
   const session=sessions.find(s=>s.id===id);if(!session)throw Error('会话不存在');
   const existing=[...instances.values()].find(x=>x.session.id===id&&x.status==='已连接'&&passwordKey(x.session)===passwordKey(session));
   if(existing)return existing;
   let force=false;
   while(true){
    const result=await connect(session,force,true);
    if(result?.instance)return result.instance;
    if(result?.error?.level!=='client-authentication')throw result?.error||Error('已取消连接');
    const action=await v.window.showWarningMessage(t('SSH 认证失败，请重新输入密码。'),t('使用新密码'));
    if(action!==t('使用新密码'))throw Error('已取消密码输入');
    force=true;
   }
  },sessionId);
 }
 ctx.subscriptions.push(v.commands.registerCommand('rshell.files',()=>transfer()),v.commands.registerCommand('rshell.add',()=>edit()),v.commands.registerCommand('rshell.open',()=>v.commands.executeCommand('rshell.workspace.focus')));
 ctx.subscriptions.push(v.window.registerWebviewViewProvider('rshell.workspace',{resolveWebviewView(w){
  view=w;viewReady=false;w.webview.options={enableScripts:true,localResourceRoots:[ctx.extensionUri]};
  const uri=p=>w.webview.asWebviewUri(v.Uri.joinPath(ctx.extensionUri,p)).toString(),nonce=randomBytes(16).toString('hex');
  w.webview.html=html`<!doctype html><html lang="${language}"><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${uri('node_modules/@xterm/xterm/css/xterm.css')}"><link rel="stylesheet" href="${uri('media/style.css')}"></head><body><aside><header>会话列表 <button id="add" class="icon-button" title="新建 SSH 会话" aria-label="新建 SSH 会话"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12"/></svg></button></header><div id="sessions"></div></aside><div class="splitter" id="split-left" role="separator" aria-label="调整会话栏宽度" aria-orientation="vertical" tabindex="0"></div><main><header id="connection-title">尚未连接 SSH</header><div id="terminals"><div id="empty">新建会话并连接 SSH</div></div></main><div class="splitter" id="split-right" role="separator" aria-label="调整实例栏宽度" aria-orientation="vertical" tabindex="0"></div><aside><header>实例列表</header><div id="instances"></div></aside><script nonce="${nonce}" src="${uri('media/i18n.js')}"></script><script nonce="${nonce}" src="${uri('node_modules/@xterm/xterm/lib/xterm.js')}"></script><script nonce="${nonce}" src="${uri('node_modules/@xterm/addon-fit/lib/addon-fit.js')}"></script><script nonce="${nonce}" src="${uri('media/app.js')}"></script></body></html>`;
  w.onDidDispose(()=>{if(view===w){view=undefined;viewReady=false;}});
  w.webview.onDidReceiveMessage(async m=>{try{
   if(!m||typeof m.type!=='string')return;
   const s=sessions.find(x=>x.id===m.id),i=instances.get(m.id);
   switch(m.type){
    case 'ready':viewReady=true;if(pendingEditor){post({type:'editSession',session:pendingEditor});pendingEditor=undefined;}post({type:'settings',settings:terminalSettings()});state();for(const x of instances.values())for(const data of x.history)post({type:'output',id:x.id,data});break;
    case 'selectSession':if(s)selectedSession=s.id;break;
    case 'saveSession':await saveSession(m);break;
    case 'add':await edit();break;case 'edit':if(s)await edit(s);break;case 'connect':await connect(s);break;
    case 'delete':if(s&&await v.window.showWarningMessage(t`删除 ${s.name}？`,{modal:true},t('删除'))===t('删除')){const next=sessions.filter(x=>x.id!==s.id);await ctx.globalState.update('sessions',next);sessions=next;await ctx.secrets?.delete(passwordKey(s));state();}break;
    case 'duplicate':if(i)await connect(i.session);break;
    case 'select':if(i){active=i.id;state();}break;
    case 'close':await closeInstance(m.id);break;
    case 'copy':if(i&&typeof m.text==='string')await v.env.clipboard.writeText(m.text);break;
     case 'paste':if(i?.stream){const text=await v.env.clipboard.readText();if(instances.get(i.id)===i)post({type:'paste',id:i.id,text});}break;
     case 'input':if(i?.stream&&typeof m.data==='string')i.stream.write(m.data);break;
    case 'resize':if(i?.stream&&Number.isInteger(m.rows)&&Number.isInteger(m.cols)&&m.rows>0&&m.cols>0&&m.rows<1000&&m.cols<1000)i.stream.setWindow(m.rows,m.cols,0,0);break;
    case 'transfer':await transfer(i||[...instances.values()].find(x=>x.session.id===s?.id&&x.status==='已连接'),s?.id||i?.session.id||selectedSession);break;
   }
  }catch(e){v.window.showErrorMessage(`RShell: ${e.message}`);}});
 }},{webviewOptions:{retainContextWhenHidden:true}}));
 ctx.subscriptions.push({dispose(){for(const i of instances.values())i.client.destroy();}});
}
module.exports={activate};
