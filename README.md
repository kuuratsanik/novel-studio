# Novel Studio

Write novels in VS Code: multi-engine generation, series bible, scene contracts, continuity audit, and manuscript compile.

Publisher: `kuuratsanik` · Extension id: `kuuratsanik.novel-studio`

Repo: https://github.com/kuuratsanik/novel-studio

## Install on Ubuntu (VS Code, this computer)

**Fastest — no compile.** Use the packaged VSIX:

1. Download `novel-studio-1.0.0.vsix` from the Novel Studio web desk **Export** tab (or from GitHub Actions **Package** artifacts after a main-branch run).
2. In VS Code press `Ctrl+Shift+P` → **Extensions: Install from VSIX…** → pick that file.
3. Reload the window when asked.
4. Click the Novel Studio book icon in the Activity Bar.
5. Command Palette → **Novel Studio: New Novel Workspace** → open the folder it creates.
6. Command Palette → **Novel Studio: Set API Key** for OpenRouter / NovelAI / OpenAI (or leave empty and use local Ollama).

Shortcuts after install: `Ctrl+Alt+N` continue scene, `Ctrl+Alt+A` continuity audit, `Ctrl+Alt+D` diff rewrite, `Ctrl+Alt+S` snapshot.

## Automatic mode (default)

Novel Studio runs end-to-end without copy/paste:

1. Open a folder — workspace files bootstrap automatically if missing.
2. Open the Studio Hub, fill a tool, click **Generate & Route Automatically**.
3. Prose lands in your draft or codex; state patches apply; continuity audits run on save.
4. `Ctrl+Alt+N` continues the scene (contracts auto-infer from frontmatter when empty).

Use `novelStudio.fullyAutomatic: false` in settings to restore confirmation prompts.

Additional automation in v1.2+: streaming local generation, wiki `[[link]]` autocomplete, contract violation audits, outline→draft sync, and richer compile/analytics reports.

v1.3 adds a **Contract** tab in Studio Hub, semantic embedding RAG (`ollama pull nomic-embed-text`), EPUB export, and snapshot diff view.

v1.4 adds an **Analytics** tab (live word counts, progress, per-chapter stats), auto-rebuild embeddings on save (`novelStudio.autoRebuildEmbeddings`), and EPUB themes (`novelStudio.epubTheme`: serif, sans, dark).

v1.5 adds a **Workflow** tab (compile, HTML, EPUB, KDP zip), sidebar streaming, contract gate, cross-chapter continuity audit, voice-model context, incremental embeddings, and clickable chapters in Analytics.

v2.0 adds **tiered local models** (7B fast / 32B writer), generation cancel, editor streaming from Hub, hybrid RAG, manuscript graph, continuity quick-fixes, **Write Scene Pipeline**, outline sync v2, and PDF export.

v2.1 adds the **Autopilot orchestrator** — coordinates bootstrap, wiki, graph, embeddings, analytics, compile, and publish across Ollama and local CLI tools. Runs automatically on open/save; use the **Autopilot** tab for full/publish pipelines.

```bash
ollama pull qwen2.5:7b-instruct
ollama pull qwen2.5:32b-instruct
ollama pull nomic-embed-text
```

## Routing

| Tool | Destination |
| --- | --- |
| Story / Continue | Insert into the active Markdown draft at the cursor |
| Character | Append to `codex/characters.md` |
| World / items | Append to `codex/world_lore.md` or `codex/items.md` |
| Dialogue | Insert at cursor |
| Rephrase / edit | Replace the selection |
| Plot ideas | Append to `codex/plot_ideas.md` |

## Develop from this repo

```bash
git clone https://github.com/kuuratsanik/novel-studio.git
cd novel-studio
npm install
npm run compile
npx @vscode/vsce package --allow-missing-repository
code --install-extension novel-studio-1.0.0.vsix
```

## Marketplace

GitHub is ready. Marketplace publish still needs a **personal** Microsoft publisher id `kuuratsanik` (not a work/school account) plus an Azure DevOps PAT with Marketplace → Publish. See [PUBLISH.md](PUBLISH.md). A GitHub address is fine for the publisher GitHub field; a custom domain is not required.
