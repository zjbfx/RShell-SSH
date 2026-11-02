const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(fail=false,locale="zh-cn"){
 let receive,provider;const messages=[],storage=new Map();
 const vscode={env:{language:locale},commands:{registerCommand:()=>({dispose(){}}),executeCommand:async()=>{}},window:{registerWebviewViewProvider:(id,p)=>{provider=p;return {dispose(){}};}},Uri:{joinPath:(_,p)=>p}};
 const context={globalState:{get:(key,fallback)=>storage.get(key)??fallback,update:async(key,value)=>{if(fail)throw Error('存储失败');storage.set(key,structuredClone(value));}},subscriptions:[],extensionUri:'root'};
 const sandbox={require:name=>name==='vscode'?vscode:name==='ssh2'?{Client:class{}}:name==='../media/i18n'?require('../media/i18n'):name==='./credentials'?require('../src/credentials'):name==='./transfer'?{openTransfer:async()=>{}}:require(name),module:{exports:{}}};
 vm.runInNewContext(fs.readFileSync('src/extension.js','utf8'),sandbox);sandbox.module.exports.activate(context);
 const webview={cspSource:'local',asWebviewUri:p=>p,postMessage:m=>messages.push(m),onDidReceiveMessage:fn=>receive=fn};
 provider.resolveWebviewView({webview,onDidDispose(){}});
 return {send:receive,messages,storage,webview};
}
const session={name:'',host:' server.example ',port:'22',user:' root ',identity:''};
test('添加配置全局保存、默认名称、编辑保持 ID',async()=>{
 const x=setup();await x.send({type:'saveSession',session});let saved=x.storage.get('sessions');assert.equal(saved.length,1);assert.equal(saved[0].name,'server.example');assert.equal(saved[0].port,22);
 const id=saved[0].id;await x.send({type:'saveSession',session:{...saved[0],name:'生产环境'}});saved=x.storage.get('sessions');assert.equal(saved.length,1);assert.equal(saved[0].id,id);assert.equal(saved[0].name,'生产环境');assert.equal(x.messages.at(-1).type,'sessionSaved');
});
test('无效端口与主机不能保存',async()=>{
 for(const patch of [{port:'0'},{port:'65536'},{port:'1.5'},{host:'a b'},{user:''}]){const x=setup();await x.send({type:'saveSession',session:{...session,...patch}});assert.equal(x.storage.has('sessions'),false);assert.equal(x.messages.at(-1).type,'sessionError');}
});
test('存储失败不能报告成功或修改会话列表',async()=>{
 const x=setup(true);await x.send({type:'saveSession',session});assert.equal(x.messages.at(-1).type,'sessionError');await x.send({type:'ready'});assert.equal(x.messages.at(-1).sessions.length,0);
});

test('English workspace renders translated initial HTML with shared language runtime',()=>{const x=setup(false,'en');assert.match(x.webview.html,/<html lang="en">/);assert.match(x.webview.html,/Sessions/);assert.match(x.webview.html,/media\/i18n.js/);assert.doesNotMatch(x.webview.html,/[\p{Script=Han}]/u);});
