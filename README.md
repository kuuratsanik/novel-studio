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
