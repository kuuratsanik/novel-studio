# Changelog

## Unreleased

Fixed

- `Diff Rewrite Selection` no longer exhausts the extension host heap on a
  chapter-sized selection, and shows the change in a real diff editor.
- The continuity audit no longer reports ordinary sentence-initial words as
  unknown proper names, and its flags point at the offending text instead of
  line 1.
- Opening a Markdown file no longer scaffolds `prompts/` and `codex/beats.md`
  into unrelated projects. Scaffolding happens only on the seed and bootstrap
  commands.
- `privacyLocalCodex` now also withholds `codex/state.json` from cloud
  providers, not just the series bible.
- `Compile Manuscript` orders chapters numerically, so `ch2` precedes `ch10`.
- Generation requests time out and can be cancelled; the status bar flag count
  updates; narration reports over-long input instead of silently truncating.

Added

- `novelStudio.requestTimeoutMs` and `novelStudio.auditOnSave` settings.
- A "Novel Studio" log output channel.
- A marketplace icon, replacing a corrupt unreferenced payload.

## 1.0.0

First release.

- Multi-engine text generation
- Series bible, scene contracts, state machine, continuity Problems
- Craft commands, status bar, keybindings
- Compile manuscript to `compile/manuscript.md`
- SecretStorage keys; optional privacy mode
