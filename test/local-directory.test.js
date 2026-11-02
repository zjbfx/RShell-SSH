const {test}=require('node:test'),assert=require('node:assert/strict'),os=require('node:os'),path=require('node:path');
const {localStartDirectory}=require('../src/local-directory');
const root=path.resolve('project'),other=path.resolve('other');
const folder=p=>({uri:{scheme:'file',fsPath:p}});
function vscode(mode,custom,folders=[],active){return {workspace:{getConfiguration:()=>({get:(key,fallback)=>({'transfer.localDirectoryMode':mode,'transfer.localDirectory':custom}[key]??fallback)}),workspaceFolders:folders,getWorkspaceFolder:()=>active},window:{activeTextEditor:active?{document:{uri:{scheme:'file'}}}:undefined}};}
const io={stat:async()=>({isDirectory:()=>true}),readdir:async()=>[]};
test('custom directory and home expansion',async()=>{assert.equal((await localStartDirectory(vscode('custom',root),io)).directory,root);assert.equal((await localStartDirectory(vscode('custom','~/Downloads'),io)).directory,path.join(os.homedir(),'Downloads'));});
test('workspace prefers active project, then first local folder',async()=>{assert.equal((await localStartDirectory(vscode('workspace','',[folder(root),folder(other)],folder(other)),io)).directory,other);assert.equal((await localStartDirectory(vscode('workspace','',[folder(root)]),io)).directory,root);});
test('missing workspace, relative path and unreadable directories fall back',async()=>{for(const v of [vscode('workspace'),vscode('custom','relative'),vscode('custom','')])assert.deepEqual(await localStartDirectory(v,io),{directory:os.homedir(),fallback:true});assert.equal((await localStartDirectory(vscode('custom',root),{stat:async()=>{throw Error('denied');}})).fallback,true);assert.equal((await localStartDirectory(vscode('custom',root),{stat:async()=>({isDirectory:()=>false})})).fallback,true);});
