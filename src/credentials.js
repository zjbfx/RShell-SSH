const {t}=require('../media/i18n');
const {createHash}=require('node:crypto');
// Scope credentials to both the saved session and its endpoint. Editing a host
// or username must never send an old password to a different destination.
function passwordKey(session){
 return 'rshell.password.'+createHash('sha256').update(JSON.stringify([session.id,session.host,session.port,session.user])).digest('hex');
}
async function loadPassword(secrets,session,force,prompt){
 if(!force){const saved=await secrets.get(passwordKey(session));if(saved!==undefined)return saved;}
 return prompt({title:force?t`${session.user}@${session.host} 的新密码`:t`${session.user}@${session.host} 的密码`,password:true,ignoreFocusOut:true,prompt:t('登录成功后保存到 VS Code 安全凭据存储，供后续连接使用')});
}
async function rememberPassword(secrets,session,password){await secrets.store(passwordKey(session),password);}
module.exports={passwordKey,loadPassword,rememberPassword};
