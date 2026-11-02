# Publishing and release verification

## 尚需填写的发布信息

1. 将 `package.json` 的 `publisher: rshell-local` 替换为你在 Marketplace 注册的真实 publisher ID。不要随意更改已安装插件的 publisher，否则其扩展 ID 和存储命名空间也会变化。
2. 创建 GitHub 仓库后填写 `repository`、`homepage` 和 `bugs.url`。不要提交占位的伪链接。
3. 已接入小熊猫 PNG 商店图标 `media/rshell-red-panda.png`，发布前可添加脱敏截图。面板仍使用独立 SVG 图标。README 图片需满足 Marketplace 的 HTTPS/图片格式要求。
4. 确认扩展名 `rshell`、显示名、版本和 publisher 对应关系。检查商店名称是否可用；本次未检查名称占用。
5. 已选择 Apache-2.0；LICENSE 中版权归属为 RShell contributors，发布前确认作者署名需求。第三方许可证随依赖保留。

## 本地构建

```sh
npm ci --omit=optional
npm run build:i18n
npm run check
npm test
npm run package:verify
npm run package
```

打包时自动执行文案生成、语法/JSON 校验和测试。当前 package 命令允许暂缺仓库元数据，供本地安装验收；补齐真实仓库后移除 `--allow-missing-repository` 和 `--no-rewrite-relative-links`，让文档链接重写为真实 GitHub URL（当前本地测试包不重写链接，不适合直接上架）。打包不会自动发布。

`.vscodeignore` 排除源码测试、依赖 fixtures、旧 VSIX、日志及本机原生二进制。运行依赖保留许可证；ssh2 使用 JavaScript 加密回退，不打入特定本机 ABI 的可选加速模块。GitHub CI 在 Windows/Linux 上使用 Node.js 22 检查和构建，尚不等于真实 VS Code 扩展宿主测试。

## 上传前人工验收

在干净的 VS Code 用户配置中从生成的 VSIX 安装，至少检查：

- [ ] Windows、macOS、Linux 的真实 SSH 登录、终端输入、中文、复制粘贴、尺寸调整及连接关闭。
- [ ] 首次指纹确认、再次信任、错误指纹拒绝、密码保存、新密码替换、私钥及错误私钥提示。
- [ ] 新建/编辑/删除配置、跨项目持久化、同名实例编号。
- [ ] SFTP 上传/下载单文件、多选、嵌套目录、空文件/空目录、覆盖跳过、失败后部分文件行为。
- [ ] 路径导航（Windows 盘符、UNC；远程 POSIX 路径）、文件名含空格/中文/HTML 字符、符号链接拒绝。
- [ ] 两个窗口的分隔线、滚动、任务状态和关闭窗口释放连接。
- [ ] `auto`、`zh-CN`、`en`，深色/浅色/高对比主题与字体变化。
- [ ] 运行 `npm audit --omit=dev --registry=https://registry.npmjs.org` 并评估结果；检查开发工具依赖。
- [ ] `npm run package:verify` 通过；VSIX 内无日志、真实密钥、截图敏感信息或旧安装包。

## GitHub

已有 `.gitignore` 和 CI。先在 GitHub 创建仓库，填好仓库元数据，在本地 review 所有文件，再由你执行 git 初始化/提交/push。CI 只验证和生成 VSIX，不保存发布凭据，不自动发布商店。

## Marketplace

按官方发布文档创建 publisher。可以先通过 Marketplace 管理页上传已验收的 VSIX；也可在正确配置身份后运行 `npx vsce publish`。不要将 PAT 或其他身份凭据写入仓库。自动发布时按官方最新的 trusted publishing / 身份配置流程设置，而不是照搬过期的 token 教程。

官方参考：
- https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- https://code.visualstudio.com/api/references/extension-manifest

当前状态：已准备本地构建和检查流程；不代表已向 GitHub 推送或 Marketplace 发布。

打包工具使用 vsce 4.1+（Node.js 22+）。为修复 GHSA-g3hv-75wg-m249，对 vsce 的 minimatch 设置了 >=11.0.1 的定向 override；已验证文件清单和本地 VSIX 构建。未来升级 vsce 后应重新核对 override 是否仍必要。
