const {test}=require('node:test');const assert=require('node:assert/strict');
const {passwordKey,loadPassword,rememberPassword}=require('../src/credentials');
const session={id:'one',host:'example',port:22,user:'root'};
test('首次提示密码，成功保存后后续直接读取',async()=>{
 const map=new Map(),secrets={get:async k=>map.get(k),store:async(k,v)=>map.set(k,v)};let prompts=0;
 const prompt=async()=>{prompts++;return 'secret';};
 assert.equal(await loadPassword(secrets,session,false,prompt),'secret');assert.equal(map.size,0);
 await rememberPassword(secrets,session,'secret');assert.equal(await loadPassword(secrets,session,false,prompt),'secret');assert.equal(prompts,1);
});
test('新密码绕过旧值，取消不覆盖，成功后才替换',async()=>{
 const map=new Map([[passwordKey(session),'old']]),secrets={get:async k=>map.get(k),store:async(k,v)=>map.set(k,v)};
 assert.equal(await loadPassword(secrets,session,true,async()=>undefined),undefined);assert.equal(map.get(passwordKey(session)),'old');
 assert.equal(await loadPassword(secrets,session,true,async()=>'new'),'new');assert.equal(map.get(passwordKey(session)),'old');await rememberPassword(secrets,session,'new');assert.equal(map.get(passwordKey(session)),'new');
});
test('修改目标主机、端口、用户或会话不能复用旧密码',()=>{
 for(const patch of [{host:'other'},{port:2222},{user:'other'},{id:'two'}])assert.notEqual(passwordKey({...session,...patch}),passwordKey(session));
});
