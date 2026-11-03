const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const stat={isSymbolicLink:()=>false,isDirectory:()=>false,isFile:()=>true};
async function fixture(connectSession,noInstance=false){
 const {Readable,Writable}=require('node:stream');let received='';
 let handler,dispose,ended=false;const messages=[];
 const sftp={mkdir:(p,cb)=>cb(),createReadStream:()=>Readable.from(['remote payload']),createWriteStream:()=>new Writable({write(chunk,enc,cb){received+=chunk.toString();cb();}}),realpath:(p,cb)=>cb(null,'/home/test'),readdir:(p,cb)=>p==='/missing'?cb(Error('not found')):cb(null,p==='/home/test'?[{filename:'remote.txt',attrs:stat}]:[]),lstat:(p,cb)=>(p.endsWith('skip.txt')||p==='/home/test/remote.txt')?cb(null,stat):cb(Object.assign(Error('missing'),{code:2})),fastPut:(src,dest,opts,cb)=>{if(src.endsWith('fail.txt'))return cb(Error('permission denied'));opts.step(10,10,10);cb();},end:()=>{ended=true;}};
 const panel={webview:{cspSource:'local',asWebviewUri:p=>p,postMessage:m=>messages.push(structuredClone(m)),onDidReceiveMessage:f=>handler=f},onDidDispose:f=>dispose=f};
 const v={window:{createWebviewPanel:()=>panel,showOpenDialog:async()=>[{fsPath:require('node:path').resolve('ok.txt')}],showWarningMessage:async()=>undefined},ViewColumn:{Active:1},Uri:{joinPath:(_,a,b)=>b||a},env:{language:'zh-cn'}};
 const realFs=require('node:fs/promises');const local={...realFs,readdir:async(dir,opts)=>dir.includes('rshell-drop-')?realFs.readdir(dir,opts):['ok.txt','skip.txt','fail.txt'].map(name=>({name,isDirectory:()=>false,isSymbolicLink:()=>false})),lstat:async p=>p.includes('rshell-drop-')?realFs.lstat(p):stat};
 const sandbox={module:{exports:{}},process,Date,Buffer,require:n=>n==='vscode'?v:n==='node:fs/promises'?local:n==='./local-directory'?require('../src/local-directory'):n==='../media/i18n'?require('../media/i18n'):require(n)};
 vm.runInNewContext(fs.readFileSync('src/transfer.js','utf8'),sandbox);
 const other={id:'other',status:'已连接',name:'other',session:{name:'other'},client:{sftp:cb=>cb(null,{...sftp,realpath:(p,cb)=>cb(null,'/target')})}};
 await sandbox.module.exports.openTransfer({extensionUri:'root',subscriptions:[]},noInstance?undefined:{status:'已连接',name:'test',session:{name:'test',host:'127.0.0.1',port:22},client:{sftp:cb=>cb(null,sftp)}},()=>[other],connectSession?async id=>{if(id==='other')return other;throw Error('connection refused');}:undefined);
 await handler({type:'ready'});
 return {send:handler,messages,dispose,get ended(){return ended;},get received(){return received;}};
}
test('failed navigation retains the last successful remote directory',async()=>{const x=await fixture();await x.send({type:'browse',side:'remote',path:'/missing'});assert.equal(x.messages.at(-1).type,'status');await x.send({type:'browse',side:'remote'});assert.equal(x.messages.at(-1).path,'/home/test');});
test('transfer tasks preserve success, skipped and failed results',async()=>{const x=await fixture();await x.send({type:'transfer',from:'local',names:['ok.txt','skip.txt','fail.txt']});const tasks=x.messages.filter(m=>m.type==='tasks').at(-1).tasks;assert.deepEqual(tasks.map(t=>t.status),['成功','完成（有跳过）','失败']);assert.equal(tasks[0].completed,1);assert.equal(tasks[1].skipped,1);assert.match(tasks[2].detail,/permission denied/);assert.equal(x.messages.filter(m=>m.type==='busy').at(-1).value,false);});
test('rejects invalid transfer names without locking the window',async()=>{const x=await fixture();await x.send({type:'transfer',from:'local',names:['../secret']});assert.equal(x.messages.at(-1).type,'status');await x.send({type:'browse',side:'remote'});assert.equal(x.messages.at(-1).type,'listing');x.dispose();assert.equal(x.ended,true);});

test('remote endpoints switch independently and transfer streamed contents',async()=>{
 const x=await fixture();
 await x.send({type:'endpoint',side:'local',id:'other'});
 const listing=x.messages.filter(m=>m.type==='listing'&&m.side==='local').at(-1);
 assert.equal(listing.endpoint,'other');assert.equal(listing.path,'/target');assert.equal(listing.isLocal,false);
 await x.send({type:'transfer',from:'remote',names:['remote.txt']});
 assert.equal(x.received,'remote payload');
 assert.equal(x.messages.filter(m=>m.type==='tasks').at(-1).tasks[0].status,'成功');
 await x.send({type:'endpoint',side:'local',id:''});
 assert.equal(x.messages.filter(m=>m.type==='listing'&&m.side==='local').at(-1).isLocal,true);
});
test('unavailable endpoint leaves existing pane usable',async()=>{
 const x=await fixture();await x.send({type:'endpoint',side:'remote',id:'missing'});
 assert.equal(x.messages.at(-2).type,'status');assert.match(x.messages.at(-2).text,/切换失败/);assert.equal(x.messages.at(-1).value,false);
 await x.send({type:'browse',side:'remote'});
 assert.equal(x.messages.at(-1).path,'/home/test');
});

test('endpoint selectors unlock after switching without a transfer',()=>{
 const source=fs.readFileSync('media/files.js','utf8');
 const listener=source.split('\n').find(line=>line.startsWith("window.addEventListener('message'")&&line.includes("render(m)"));
 let receive;const selectors=[{disabled:false},{disabled:false}];
 const sandbox={busy:false,window:{addEventListener:(_,fn)=>receive=fn},document:{body:{classList:{toggle(){}}},querySelectorAll:()=>selectors},send(){},render(){selectors[0]={disabled:sandbox.busy};},renderTasks(){}};
 vm.runInNewContext(listener,sandbox);
 receive({data:{type:'busy',value:true}});
 assert.ok(selectors.every(s=>s.disabled));
 receive({data:{type:'listing'}});
 receive({data:{type:'busy',value:false}});
 assert.ok(selectors.every(s=>!s.disabled));
 receive({data:{type:'busy',value:true}});
 receive({data:{type:'busy',value:false}});
 assert.ok(selectors.every(s=>!s.disabled));
});

test('saved session selection connects on demand and preserves pane on failure',async()=>{
 const x=await fixture(true);
 await x.send({type:'endpoint',side:'local',id:'other'});
 assert.equal(x.messages.filter(m=>m.type==='listing'&&m.side==='local').at(-1).path,'/target');
 await x.send({type:'endpoint',side:'local',id:'bad'});
 assert.match(x.messages.at(-2).text,/切换失败.*connection refused/);
 await x.send({type:'browse',side:'local'});
 assert.equal(x.messages.at(-1).path,'/target');
});


test('native file picker upload copies to the selected endpoint',async()=>{
 const x=await fixture();await x.send({type:'upload',side:'remote',folders:false});
 const task=x.messages.filter(m=>m.type==='tasks').at(-1).tasks[0];
 assert.equal(task.name,'ok.txt');assert.equal(task.status,'成功');
 assert.equal(x.messages.filter(m=>m.type==='busy').at(-1).value,false);
});

test('file transfer opens without a connected instance',async()=>{
 const x=await fixture(true,true);
 const listings=x.messages.filter(m=>m.type==='listing');
 assert.equal(listings.length,2);
 assert.ok(listings.every(m=>m.isLocal));
 assert.ok(listings.every(m=>m.endpoints.some(e=>e.id==='other')));
 await x.send({type:'endpoint',side:'remote',id:'other'});
 assert.equal(x.messages.filter(m=>m.type==='listing').at(-1).path,'/target');
});
