const {execFileSync}=require('node:child_process');
const files=execFileSync(process.execPath,['node_modules/@vscode/vsce/vsce','ls'],{encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
const required=['src/extension.js','src/credentials.js','src/local-directory.js','src/transfer.js','media/i18n.js','media/app.js','media/files.js','media/style.css','media/files.css','package.nls.json','package.nls.zh-cn.json','LICENSE','node_modules/ssh2/lib/index.js','node_modules/ssh2/lib/protocol/crypto.js','node_modules/asn1/lib/index.js','node_modules/bcrypt-pbkdf/index.js','node_modules/safer-buffer/safer.js','node_modules/tweetnacl/nacl-fast.js','node_modules/@xterm/xterm/lib/xterm.js','node_modules/@xterm/addon-fit/lib/addon-fit.js','node_modules/@xterm/xterm/css/xterm.css'];
for(const file of required)if(!files.includes(file))throw Error('Missing runtime file: '+file);
for(const file of files)if(/(^|\/)(test|tests|fixtures|scripts|\.github)\//.test(file)||/\.(vsix|node|log|map)$/.test(file))throw Error('Unexpected packaged file: '+file);
console.log(`Package manifest verified: ${files.length} files, all runtime entries present, no tests/fixtures/VSIX/native binaries.`);
