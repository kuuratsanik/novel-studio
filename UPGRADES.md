# Suggested upgrades

A review of the extension as of `09d68a7`, split into what this branch already
changed and what is still worth doing. Items are ordered by expected payoff
against the invasiveness of the change, not by how hard they are.

## Already addressed on this branch

| Area | Problem | Evidence |
| --- | --- | --- |
| `wordDiff` | Allocated a full `(n+1)x(m+1)` matrix. A 12,000-word selection exhausted the extension host heap and killed the process; 6,000 words cost 1.2GB. `Ctrl+Alt+D` on a chapter was enough to trigger it. | `src/test/diff.test.ts` |
| Continuity audit | Every sentence-initial word was reported as an unknown proper name. One line of ordinary prose produced five false positives against one real finding. | `src/test/names.test.ts` |
| Diagnostics | Every flag was reported at line 1 regardless of where the text was. | `src/test/names.test.ts` |
| Activation | `activate` scaffolded `prompts/*.md` and `codex/beats.md` into *any* folder containing Markdown, with no user action. | `find` before/after in an unrelated project |
| Editor edits | `insert`/`replaceSel` never awaited `editor.edit`, so `continueScene` raced its own insertion and rejected edits failed silently. | — |
| Network | No request had a deadline, so an unreachable local engine hung the command with no way to cancel. | — |
| Privacy | `privacyLocalCodex` withheld the series bible but still sent `codex/state.json` (locations, statuses, inventories, relationships) to cloud providers. | — |
| Status bar | `setFlags` was never called, so the flag count was permanently `0`. | — |
| Compile | Lexicographic sort placed `ch10` before `ch2`, scrambling the manuscript. | `src/test/sort.test.ts` |
| Webview | `enableScripts` with no CSP, and a message handler that trusted `filename` and `url` verbatim. | — |
| Supply chain | No committed lockfile and `npm install` in CI, so no two builds resolved the same tree. CI ran no tests. | — |
| Marketplace icon | `resources/icon.png.b64` was a truncated PNG whose IDAT chunk failed its CRC, with no `IEND`. Nothing referenced it and no `icon` was declared. | — |

## High value, still open

### 1. Connect the sidebar to the extension's own engine

`NovelStudioProvider` is a form that assembles a prompt, copies it to the
clipboard, and links out to `toolsaday.com`. The user pastes the result back
into a textarea. Meanwhile `TextRouter` already talks to Anthropic, OpenAI,
OpenRouter, DeepInfra, Together, Fireworks, Ollama, Kobold and NovelAI.

The sidebar should call `TextRouter` directly and stream into the editor. It
previously accepted a `KeyManager` and a diagnostics collection but used
neither, which is the clearest signal that this was always the intent. This is
the single largest gap between what the extension advertises and what the UI
does.

Touches `NovelStudioProvider.ts` and `extension.ts`; needs a message protocol
for generate/cancel plus provider and model pickers backed by the existing
settings.

### 2. Make the placeholder commands do what their titles say

Five contributed commands write a note file and return:

- `novelStudio.publishPackage` writes `publish-notes-*.md`. The changelog
  advertises a "KDP zip"; no archive is produced.
- `novelStudio.archiveProject` writes a note telling the user to zip the
  folder themselves.
- `novelStudio.evalHarness` writes the *count* of files in `gold/`.
- `novelStudio.outlineSync` writes the count of drafts and whether a beat
  sheet exists. It never syncs anything.
- `novelStudio.clipResearch` saves the selection; there is no retrieval step
  that ever reads `research/` back.

Either implement them or withdraw them from `contributes.commands`. Shipping a
command palette entry that produces a note file is worse than not shipping it.

### 3. There is no retrieval, despite the settings implying one

`packContext` accepted `useRag` and `useStyle` and ignored both, and
`studio.json` (`pov`, `tense`, `banned`) is written by the bootstrapper and
never read by anything. So the "banned words" list has no effect and there is
no RAG. Either implement retrieval over `codex/` and `research/` and enforce
`studio.json`, or stop implying them in the configuration UI.

### 4. Replace the hand-rolled DOCX reader

`importDocx` walks ZIP local file headers directly. It assumes every entry
stores its compressed size in the local header, which is not true for
streamed archives that defer sizes to a data descriptor — the shape Word
itself produces in some export paths. It also always writes
`drafts/import-01.md`, overwriting a previous import with no prompt.

Read the central directory rather than scanning forward, derive the output
filename from the source document, and refuse to clobber an existing file.

### 5. Cache the workspace scan

`listMarkdown` walks the entire workspace and reads every `.md` into memory.
`loadBible`, `compileManuscript`, `writeAnalytics`, `buildVoiceModels`,
`exportLoraJsonl`, `runEval`, `readAloudReport` and `syncOutlineToDrafts` each
call it independently, so a single audit can re-read the manuscript several
times. It also ignores `files.exclude` and has no file-size ceiling.

Add a cache invalidated by a `FileSystemWatcher`, and prefer
`vscode.workspace.findFiles` so user excludes are respected.

## Worth doing, lower urgency

- **Bundle the extension.** 40 service modules are shipped and loaded
  individually. An esbuild bundle would cut activation time and VSIX size.
- **Integration tests.** The suite added here covers pure logic. Nothing
  verifies that activation succeeds or that all 33 contributed commands are
  actually registered — a typo in a command id is currently only caught by
  hand. `@vscode/test-cli` closes that gap.
- **`usage.ts` is racy.** It read-modify-writes `compile/usage.md` on every
  generation, so two concurrent commands lose entries. The ledger grows
  without bound and estimates tokens as `chars / 4`. Append instead, and
  prefer provider-reported token counts.
- **`listPrompts` ignores the prompt library.** It returns the four built-in
  keys, so a user who adds `prompts/my-pass.md` cannot select it — even though
  the whole point of writing prompts to disk is to edit them. Enumerate the
  directory.
- **`wikiIndex.ts` is dead code.** `buildWikiIndex` and `insertWikiLink` have
  no call sites and no command. It looks like an intended `[[wiki link]]`
  feature. Wire it up or delete it.
- **No way to remove a stored key.** `KeyManager.deleteKey` exists but no
  command exposes it, so a key can only be overwritten, never revoked.
- **State extraction is brittle.** `proposeStatePatches` infers location,
  death and inventory from regexes over prose, so it misses anything phrased
  indirectly and misfires on quoted speech. Structured output from the model
  already in use would be far more reliable.
- **No VS Code Web build.** `Buffer` and Node path handling rule out a
  `browser` entry point. Worth deciding whether vscode.dev is a target.

## Housekeeping

- `README.md` tells users to download the VSIX from a "Novel Studio web desk
  **Export** tab" that does not exist in this repository. The GitHub Actions
  **Package** artifact is the real source.
- The changelog claims a KDP zip that is not implemented (see above).
- `engines.vscode` is pinned at `^1.85.0` from late 2023. Nothing in the code
  needs an API that old; raising it unlocks newer APIs and shrinks the support
  matrix.
- Keybindings claim `ctrl+alt+n`, `ctrl+alt+a`, `ctrl+alt+d` and `ctrl+alt+s`
  unconditionally. They are only meaningful inside a novel workspace, so they
  should be gated on a `when` clause to avoid colliding with other extensions.
