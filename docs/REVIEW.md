# Review status — 2026-11-02

已检查并修复：

- 加入全局 UI 语言设置、中文/英文词典及 manifest 本地化。
- 私钥文件不存在或配置无效时可修改属性或改用密码；SSH 错误不会被断开状态覆盖。
- 删除会话及修改目标后清理旧凭据；连接成功时只为仍存在且目标匹配的配置保存密码。
- 限制终端历史缓冲，隐藏终端不再执行无效尺寸同步。
- 新建命令首次打开 Webview 时等待 ready 消息再显示表单。
- SFTP 窗口关闭/扩展卸载时释放通道，导航失败保持原目录，并避免同一栏并发导航。
- 下载时拒绝 Windows 危险文件名及特殊文件，保留符号链接拒绝逻辑。
- 防止旧 VSIX、依赖测试/fixtures 和本机 native 二进制进入发布包。
- 升级 vsce 4.1，并定向覆盖 minimatch 至修复版本；构建使用 Node.js 22。

自动验证：JavaScript/JSON 校验、13 项测试、运行文件清单及 VSIX 构建。npm 官方扫描的完整依赖最终结果为 0 vulnerabilities（包含开发依赖；这不代表不存在未知漏洞）。

测试包括模拟 SecretStorage/VS Code/SFTP，不是真实服务器或 Extension Host 全流程测试。发布前仍需执行 PUBLISHING.md 的人工验收；尤其是不同平台的终端输入/粘贴、路径/权限、真实传输、主题与语言。SFTP 原子写入、取消/续传、多因素认证仍未实现，已在 README 中明确。

当前未设置真实 Marketplace publisher 或 GitHub URL，也未执行 git push / 商店发布。生成的 VSIX 用于本地验收，README 相对链接不重写；正式上架前需要补齐仓库 URL 并重新构建。
