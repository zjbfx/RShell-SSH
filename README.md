# RShell

[English](README.en.md) · 简体中文

RShell 是 VS Code 内的 SSH 与 SFTP 工作台。底部面板按 **会话列表 | SSH 终端 | 实例列表** 排列，文件传输在独立编辑器窗口中进行。

## 功能

- 会话配置在同一个 VS Code 用户配置中跨项目保存，支持主机、端口、用户名及私钥路径。
- 双击会话连接，右键管理属性、文件传输及删除；实例点击切换，右键复制或关闭。
- 同名实例自动增加 `(1)`、`(2)`；终端标题显示会话名称及主机/IP、端口。
- 密码登录成功后保存在 VS Code SecretStorage，后续自动使用；认证失败时可修改属性或输入新密码。
- SFTP 双栏浏览本地和远程目录，支持窗口内拖拽、多选、文件夹递归上传与下载。
- 路径层级、地址栏、最近目录、前进/后退、主目录及本地文件夹选择器。
- 底部传输任务显示进度、成功、跳过及失败原因；覆盖文件前确认。
- 工作台与传输窗口支持拖动分隔线；界面与终端跟随 VS Code 主题及字体。
- 简体中文、English，或跟随 VS Code 显示语言。

## 安装与开始使用

当前准备发布 1.0.0，商店发布状态以 Marketplace 页面为准。

从源码构建：安装 Node.js 22 和 npm，运行：

```sh
npm ci --omit=optional
npm run package
```

在 VS Code 扩展面板的 `…` 菜单选择 **从 VSIX 安装**，选择生成的文件。也可以打开本项目，按 F5 启动扩展开发窗口。

1. 运行命令 `RShell: 打开 SSH 工作台`（英文环境为 `RShell: Open SSH Workspace`）。
2. 点击会话列表的 **＋**，填写主机、用户名等并保存。
3. 双击会话。首次连接请通过可信渠道核对服务器指纹，再选择信任。
4. 在在线会话或实例的右键菜单中打开文件传输。将文件拖到另一侧的当前目录即可传输；Ctrl/Cmd 支持多选。

需要 VS Code **1.95+**、可访问的 SSH 服务器及其 SFTP 子系统。不需要安装系统 ssh/sftp。扩展运行于本地桌面扩展宿主；不支持 vscode.dev 浏览器运行和不受信任的工作区。

## UI 语言与字体

打开 VS Code 设置，搜索 **RShell UI Language** 或 `rshell.uiLanguage`：

| 值 | 行为 |
| --- | --- |
| `auto`（默认） | 中文 VS Code 使用简体中文，其他显示语言使用 English |
| `zh-CN` | 简体中文 |
| `en` | English |

修改语言后重新加载窗口生效，这会断开当前 SSH 实例。设置为应用级，不能由项目工作区覆盖。命令面板和视图的名称由 VS Code 自身的显示语言决定，插件内界面及提示使用上述设置。远程程序输出和系统错误原文不会翻译。

终端使用 `terminal.integrated.fontFamily`、`fontSize`、`lineHeight`、`letterSpacing`。字体未指定时回退至编辑器字体。

## 数据与安全

会话配置、私钥**路径**、已信任服务器指纹存储于 `globalState`；不主动同步到其他电脑。密码仅存于 VS Code SecretStorage，不发送给 Webview，不写入仓库或日志。私钥从指定路径读取，私钥口令每次输入。修改连接目标或删除会话时移除对应的已保存密码。

主机密钥变化会拒绝连接。应先向服务器管理员核实原因；当前没有自动重置信任功能。终端历史仅在内存中保留有限缓冲，关闭 VS Code 或重新加载后实例断开。窗口布局仅在对应 Webview 状态中保存，不保证关闭并新建窗口后恢复。

详见 [隐私说明](PRIVACY.md)、[安全报告](SECURITY.md)。

## 当前限制

- 不支持 SSH Agent、跳板机、代理、端口转发、keyboard-interactive/多因素认证和 SSH config 导入。
- 拖拽限传输窗口内部；暂不支持与系统文件管理器互拖。
- 不传输符号链接或特殊文件；文件权限及时间戳不保证保留。
- 传输为顺序执行，不支持取消、断点续传和原子覆盖；失败可能留下不完整文件，目录任务失败时已完成文件保留。
- 任务记录只保留在本次传输窗口中；不持久化活动连接与传输。
- 尚未完成 Windows/macOS/Linux 的全平台人工验收。

## 开发与发布

```sh
npm ci --omit=optional
npm run build:i18n
npm run check
npm test
npm run package:verify
npm run package
```

参见 [贡献与多语言开发](CONTRIBUTING.md)、[发布步骤与人工验收](docs/PUBLISHING.md)、[变更记录](CHANGELOG.md)。

## 许可证

Apache-2.0，见 [LICENSE](LICENSE)。第三方依赖保留各自许可证，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 文件传输的本地起始目录

设置中搜索 `rshell.transfer.localDirectoryMode`，可选择用户主目录（默认）、当前项目目录或指定目录。指定目录模式使用 `rshell.transfer.localDirectory`，填写本地绝对路径，支持 `~`。例如：

```json
{
  "rshell.transfer.localDirectoryMode": "custom",
  "rshell.transfer.localDirectory": "D:\\Downloads"
}
```

使用当前项目目录时，将模式改成 `workspace`。多项目工作区优先使用当前编辑文件所属的本地项目，否则使用第一个本地项目。没有本地项目、路径不存在或无权限时提示并回退到用户主目录。设置对每次新打开的文件传输窗口生效，不改变已经打开的目录；不需要重载。支持用户设置或工作区设置。工具栏的“主目录”按钮仍返回用户主目录。

实例列表每一行右侧的 × 可关闭实例。连接中或已连接时会弹出确认；取消保留连接，确认后断开 SSH（该连接上的文件传输也会停止）。已断开的实例直接移除。右键关闭和 Delete 键遵循相同确认规则。

终端快捷键：Ctrl + 鼠标滚轮调整当前终端字号（6–72 px）；Ctrl+Shift+C 复制选中内容；Ctrl+Shift+V 将剪贴板内容粘贴到终端。
