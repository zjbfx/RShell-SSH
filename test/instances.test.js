const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{EventEmitter}=require('node:events');
async function setup(answer){
 let receive,provider;const messages=[],clients=[],prompts=[];
 class Client extends EventEmitter{
  constructor(){super();clients.push(this);this.ended=0;this.destroyed=0;}
  connect(){}
  end(){this.ended++;this.emit('close');}
  destroy(){this.destroyed++;this.emit('close');}
  shell(options,cb){const stream=new EventEmitter();stream.stderr=new EventEmitter();cb(null,stream);}
 }
 const session={id:'test',name:'Production',host:'example.test',port:22,user:'test',identity:''};
 const v={env:{language:'zh-cn'},commands:{registerCommand:()=>({}),executeCommand:async()=>{}},window:{registerWebviewViewProvider:(id,p)=>{provider=p;return {};},showWarningMessage:async(...args)=>{prompts.push(args);return typeof answer==='function'?answer():answer;}},Uri:{joinPath:(_,p)=>p}};
 const ctx={extensionUri:'root',subscriptions:[],globalState:{get:(k,f)=>k==='sessions'?[session]:f},secrets:{get:async()=>'test-password',store:async()=>{}}};
 const sandbox={module:{exports:{}},require:n=>n==='vscode'?v:n==='ssh2'?{Client}:n==='./transfer'?{openTransfer:async()=>{}}:n==='./credentials'?require('../src/credentials'):n==='../media/i18n'?require('../media/i18n'):require(n)};
 vm.runInNewContext(fs.readFileSync('src/extension.js','utf8'),sandbox);sandbox.module.exports.activate(ctx);
 provider.resolveWebviewView({webview:{cspSource:'local',asWebviewUri:p=>p,onDidReceiveMessage:f=>receive=f,postMessage:m=>messages.push(structuredClone(m))},onDidDispose(){}});
 await receive({type:'connect',id:session.id});
 const state=()=>messages.filter(m=>m.type==='state').at(-1);
 return {send:receive,client:clients[0],id:state().instances[0].id,state,prompts};
}
test('cancel closing an online instance preserves the connection',async()=>{const x=await setup(undefined);x.client.emit('ready');await x.send({type:'close',id:x.id});assert.equal(x.prompts.length,1);assert.equal(x.prompts[0][1].modal,true);assert.equal(x.state().instances.length,1);assert.equal(x.client.ended,0);assert.equal(x.client.destroyed,0);});
test('confirm closing online instance disconnects and removes it',async()=>{const x=await setup('关闭实例');x.client.emit('ready');await x.send({type:'close',id:x.id});assert.equal(x.client.ended,1);assert.equal(x.state().instances.length,0);});
test('connecting instance requires confirmation and aborts handshake',async()=>{const x=await setup('关闭实例');await x.send({type:'close',id:x.id});assert.equal(x.prompts.length,1);assert.equal(x.client.destroyed,1);assert.equal(x.state().instances.length,0);});
test('disconnected instance closes without prompting',async()=>{const x=await setup(undefined);x.client.emit('close');await x.send({type:'close',id:x.id});assert.equal(x.prompts.length,0);assert.equal(x.state().instances.length,0);});
test('repeated close requests do not open multiple confirmations',async()=>{let resolve;const x=await setup(()=>new Promise(r=>resolve=r));const first=x.send({type:'close',id:x.id});await x.send({type:'close',id:x.id});assert.equal(x.prompts.length,1);resolve('关闭实例');await first;assert.equal(x.client.destroyed,1);});
