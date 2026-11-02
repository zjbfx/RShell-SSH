# Contributing

使用 Node.js 22，先运行 `npm ci --omit=optional`。按 F5 调试，提交前运行：

```sh
npm run build:i18n
npm run check
npm test
npm run package:verify
```

## 目录

- `src/extension.js`：会话、连接及终端消息。
- `src/credentials.js`：按会话和目标隔离的 SecretStorage 凭据。
- `src/transfer.js`：SFTP 浏览、递归传输及任务状态。
- `media/app.js` / `media/files.js`：两个 Webview 的交互。
- `media/en.json`：界面文案的英文映射；中文为源文案。
- `scripts/build-i18n.js`：生成共用的 `media/i18n.js`，不要单独手改生成文件。
- `package.nls*.json`：VS Code 命令、设置和视图名称。

## 多语言

可见文案通过 `t('源文案')` 或带参数的标记模板调用。带参数模板在字典中使用 `{0}`、`{1}`；不要把用户输入拼进源文案再翻译。静态 HTML 使用 `html` 标记模板，只翻译静态片段，动态值保留原样。内部状态值保持稳定；在展示边界翻译，不能因语言变化改变认证或任务逻辑。

修改 `media/en.json` 后运行 `npm run build:i18n`。扩展新语言时需增加字典选择机制、设置枚举、`resolveLanguage` 分支、对应 package.nls 文件、文档和测试。命令/视图名称受 VS Code 显示语言控制，不跟随 RShell 的覆盖设置。

不要在翻译层处理终端输出、用户会话名、路径、主机名或密码。未知系统错误保留原文。

## 测试范围

自动测试覆盖配置保存、密码读取/替换隔离和语言参数处理；不代表真实 SSH/SFTP、键盘交互、主题和跨平台验收已完成。新增认证、传输操作应补相应测试，并执行发布文档的人工验收。

问题报告应包含 VS Code/操作系统版本、重现步骤、预期行为及脱敏截图。禁止提交真实密码、私钥、服务器敏感信息或个人文件。
