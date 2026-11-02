const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
for(const dir of ['src','media','scripts','test'])for(const file of fs.readdirSync(dir))if(file.endsWith('.js'))execFileSync(process.execPath,['--check',path.join(dir,file)],{stdio:'inherit'});
for(const file of ['package.json','package.nls.json','package.nls.zh-cn.json','media/en.json'])JSON.parse(fs.readFileSync(file,'utf8'));
console.log('JavaScript syntax and JSON validation passed.');
