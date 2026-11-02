const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
async function localStartDirectory(v,io=fs){
 const config=v.workspace?.getConfiguration('rshell');
 const mode=config?.get('transfer.localDirectoryMode','home')||'home';
 const home=os.homedir();let candidate=home;
 if(mode==='workspace'){
  const uri=v.window.activeTextEditor?.document.uri;
  const active=uri?.scheme==='file'?v.workspace?.getWorkspaceFolder(uri):undefined;
  const folder=active?.uri.scheme==='file'?active:v.workspace?.workspaceFolders?.find(folder=>folder.uri.scheme==='file');
  candidate=folder?.uri.fsPath;
 }else if(mode==='custom'){
  candidate=config?.get('transfer.localDirectory','')?.trim();
  if(candidate==='~')candidate=home;
  else if(candidate?.startsWith('~/')||candidate?.startsWith('~\\'))candidate=path.join(home,candidate.slice(2));
 }
 if(!candidate||!path.isAbsolute(candidate))return {directory:home,fallback:true};
 try{if(!(await io.stat(candidate)).isDirectory())throw Error('Not a directory');await io.readdir(candidate);return {directory:path.normalize(candidate),fallback:false};}
 catch{return {directory:home,fallback:mode!=='home'};}
}
module.exports={localStartDirectory};
