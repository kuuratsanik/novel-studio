# Changelog

## 1.1.0

System upgrades for packaging, CI, providers, and editor safety.

- Restore marketplace icon, commit the lockfile, and package without `--allow-missing-repository`
- GitHub Actions: Node 22, `npm ci`, SHA-pinned actions, pull-request runs, and `npm test` before VSIX publish
- Webview Content-Security-Policy plus nonce; only `https://toolsaday.com` tool URLs can be opened
- Await editor inserts/replaces; time out provider HTTP calls; point continuity diagnostics at the flagged span
- Gemini, oobabooga, and Tabby routing; provider enum and `novelStudio.requestTimeoutMs`
- Dependabot, F5 launch config, and a Node unit-test runner

## 1.0.0

First release.

- Multi-engine text and image generation
- Series bible, scene contracts, state machine, continuity Problems
- Craft commands, status bar, keybindings
- Compile manuscript, KDP zip, project archive
- SecretStorage keys; optional privacy mode
