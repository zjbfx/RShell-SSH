# Security

Please do not include passwords, private keys, real server addresses or confidential terminal output in public issues.

Before publishing this repository, enable GitHub private vulnerability reporting. Report security issues through that channel once it is available. Until then, do not open a public issue with exploit details or sensitive data; contact the repository owner privately.

Only the latest development version is maintained at this stage. RShell uses SSH host-key confirmation on first connection and rejects changed keys. Verify fingerprints independently. Passwords use VS Code SecretStorage. The extension does not execute a local shell to construct SSH/SFTP commands.

Known limits: SFTP writes are not atomic, cancellation/resume is not implemented, and failed transfers may leave partial files. Symbolic links are rejected during transfer, but filesystem changes by another process during a transfer are not fully guarded against. Use trusted local folders and remote accounts with appropriate permissions.
