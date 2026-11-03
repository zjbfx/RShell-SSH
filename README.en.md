# RShell

English · [简体中文](README.md)

An SSH and SFTP workspace for VS Code: **Sessions | SSH terminal | Instances**, with a separate dual-pane file transfer window.

## Features

- Global session profiles, password or private-key authentication, independent duplicate connections.
- Custom xterm.js terminals, theme/font integration, resizable panels and instance switching.
- Passwords saved in VS Code SecretStorage only after successful authentication.
- SFTP directory browsing, internal drag-and-drop, multi-selection and recursive folder transfers.
- Navigation history, editable paths, breadcrumbs and a task table with progress and results.
- English and Simplified Chinese, selectable through `rshell.uiLanguage`.

## Getting started

Requires desktop VS Code 1.95+, SSH access and an enabled SFTP subsystem. System ssh/sftp tools are not required. Browser-based VS Code and untrusted workspaces are not supported.

Current version: 1.0.1. Marketplace availability is subject to publication. To build locally with Node.js 22:

```sh
npm ci --omit=optional
npm run package
```

Install the VSIX through Extensions → `…` → Install from VSIX. For development, open the repository and press F5.

Run **RShell: Open SSH Workspace**, click **＋**, save a connection, and double-click it to connect. Verify the server fingerprint through a trusted channel before accepting it. Right-click an online session/instance to open file transfer. Drag files between the local and remote panes; Ctrl/Cmd supports multi-selection.

## Language and settings

Set **RShell: UI Language** (`rshell.uiLanguage`) to `auto`, `en`, or `zh-CN`. Auto uses Simplified Chinese for Chinese VS Code display languages and English otherwise. Reload the window after changes; this disconnects active sessions. Command and view labels follow VS Code's display language. Terminal output and system errors retain their original language.

Terminal fonts follow `terminal.integrated.fontFamily`, `fontSize`, `lineHeight`, and `letterSpacing`. Layout ratios remain in the corresponding Webview state, not a global layout profile.

## Security and limitations

Profiles, private-key paths and accepted host fingerprints use global extension storage. Passwords use SecretStorage, are scoped to the profile and endpoint, and are removed when that endpoint is changed or the profile is deleted. Private keys are read locally; passphrases are prompted each time. Changed server host keys are rejected. No telemetry or analytics is implemented. See [Privacy](PRIVACY.md) and [Security](SECURITY.md).

SSH Agent, jump hosts, proxies, forwarding, SSH config import and multi-factor/keyboard-interactive authentication are not supported. Drag-and-drop is internal to the transfer window. Use Upload files… / Upload folder… and Download to… for system files. Symlinks and special files are rejected. Transfers are sequential, have no cancellation/resume or atomic overwrite, and may leave partial files after errors. Permissions/timestamps are not guaranteed to be preserved. Connections and task history do not survive closing/reloading.

## Development

```sh
npm ci --omit=optional
npm run build:i18n
npm run check
npm test
npm run package:verify
npm run package
```

See [Contributing](CONTRIBUTING.md) and [Publishing](docs/PUBLISHING.md). Licensed under [Apache-2.0](LICENSE); dependencies retain their [own licenses](THIRD_PARTY_NOTICES.md).

## Local starting directory

Set `rshell.transfer.localDirectoryMode` to `home` (default), `workspace`, or `custom`. Custom mode reads the absolute path from `rshell.transfer.localDirectory`, with `~` expansion. Workspace mode prefers the active file's local project folder, otherwise the first local workspace folder. Missing/unreadable paths or unavailable local workspaces fall back to the user home directory with a warning. Changes apply when opening a new transfer window, without reloading. Both user and workspace settings are supported. The Home toolbar action still opens the user home directory.

Each instance has a × close button. Connecting/connected instances require confirmation before disconnecting SSH and its file transfers; disconnected instances are removed immediately. The context menu and Delete key use the same confirmation rule.

Terminal shortcuts: Ctrl + mouse wheel adjusts the current terminal font size (6–72 px). Ctrl+Shift+C copies the selection; Ctrl+Shift+V pastes the clipboard into the terminal.

Both transfer panes can select the local filesystem or a connected SSH instance. Remote-to-remote files and directories stream through this computer without temporary copies. Endpoint switching is locked during transfers; refresh a pane to update the connected-instance list.


Use Upload files… or Upload folder… to copy local items into the current pane directory, and Download to… to save selected items locally. External drops may be handled by the VS Code editor; use the picker buttons instead.
