# Privacy

RShell does not implement analytics, telemetry, advertising or a remote account service.

- Session profiles (name, host, port, username and private-key path) and trusted server host fingerprints are stored in VS Code global extension storage.
- Passwords are stored through VS Code SecretStorage after authentication succeeds. They are not sent to Webviews or written to session JSON. Secrets are scoped to the session and endpoint; editing the endpoint or deleting the session removes the old associated password.
- Private-key contents are read from the selected file for authentication. Passphrases are prompted each time and not persisted.
- SSH credentials are used only for authentication with the configured server. SFTP transfers access the selected local and remote files. File names, paths and transfer results appear in the transfer window.
- Terminal output and limited scrollback are held in extension/Webview memory during the connection. Transfer task history is held for the lifetime of the transfer window.
- Webview state stores layout ratios. The extension does not explicitly enable Settings Sync for its profiles or passwords; VS Code controls storage and credential backing services.

To remove a saved session and its currently associated password, delete it from the session list. Uninstalling an extension does not necessarily remove all VS Code extension data. Host fingerprint reset and bulk credential removal do not currently have a dedicated UI.

VS Code and installed dependencies are governed by their own privacy/security policies. Avoid publishing logs or screenshots containing sensitive terminal output.
