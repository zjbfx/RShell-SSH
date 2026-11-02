const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const stat={isSymbolicLink:()=>false,isDirectory:()=>false,isFile:()=>true};
async function fixture(){
 let handler,dispose,ended=false;const messages=[];
 const sftp={realpath:(p,cb)=>cb(null,'/home/test'),readdir:(p,cb)=>p==='/missing'?cb(Error('not found')):cb(null,[]),lstat:(p,cb)=>p.endsWith('skip.txt')?cb(null,stat):cb(Object.assign(Error('missing'),{code:2})),fastPut:(src,dest,opts,cb)=>{if(src.endsWith('fail.txt'))return cb(Error('permission denied'));opts.step(10,10,10);cb();},end:()=>{ended=true;}};
 const panel={webview:{cspSource:'local',asWebviewUri:p=>p,postMessage:m=>messages.push(structuredClone(m)),onDidReceiveMessage:f=>handler=f},onDidDispose:f=>dispose=f};
 const v={window:{createWebviewPanel:()=>panel,showWarningMessage:async()=>undefined},ViewColumn:{Active:1},Uri:{joinPath:(_,a,b)=>b||a},env:{language:'zh-cn'}};
 const local={readdir:async()=>['ok.txt','skip.txt','fail.txt'].map(name=>({name,isDirectory:()=>false,isSymbolicLink:()=>false})),lstat:async()=>stat};
 const sandbox={module:{exports:{}},process,Date,require:n=>n==='vscode'?v:n==='node:fs/promises'?local:n==='./local-directory'?require('../src/local-directory'):n==='../media/i18n'?require('../media/i18n'):require(n)};
 vm.runInNewContext(fs.readFileSync('src/transfer.js','utf8'),sandbox);
 await sandbox.module.exports.openTransfer({extensionUri:'root',subscriptions:[]},{status:'已连接',name:'test',session:{name:'test',host:'127.0.0.1',port:22},client:{sftp:cb=>cb(null,sftp)}});
 await handler({type:'ready'});
 return {send:handler,messages,dispose,get ended(){return ended;}};
}
test('failed navigation retains the last successful remote directory',async()=>{const x=await fixture();await x.send({type:'browse',side:'remote',path:'/missing'});assert.equal(x.messages.at(-1).type,'status');await x.send({type:'browse',side:'remote'});assert.equal(x.messages.at(-1).path,'/home/test');});
test('transfer tasks preserve success, skipped and failed results',async()=>{const x=await fixture();await x.send({type:'transfer',from:'local',names:['ok.txt','skip.txt','fail.txt']});const tasks=x.messages.filter(m=>m.type==='tasks').at(-1).tasks;assert.deepEqual(tasks.map(t=>t.status),['成功','完成（有跳过）','失败']);assert.equal(tasks[0].completed,1);assert.equal(tasks[1].skipped,1);assert.match(tasks[2].detail,/permission denied/);assert.equal(x.messages.filter(m=>m.type==='busy').at(-1).value,false);});
test('rejects invalid transfer names without locking the window',async()=>{const x=await fixture();await x.send({type:'transfer',from:'local',names:['../secret']});assert.equal(x.messages.at(-1).type,'status');await x.send({type:'browse',side:'remote'});assert.equal(x.messages.at(-1).type,'listing');x.dispose();assert.equal(x.ended,true);});
