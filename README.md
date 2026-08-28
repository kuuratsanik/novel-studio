# Novel Studio

Write novels in VS Code: multi-engine generation, series bible, scene contracts, continuity audit, and manuscript compile.

Publisher: `kuuratsanik` · Extension id: `kuuratsanik.novel-studio`

## Install on this computer (Ubuntu / VS Code)

1. Download `novel-studio-1.0.0.vsix` (from the Novel Studio web app **Export** tab, or this repo once a release is attached).
2. In VS Code: Extensions view → ⋮ menu → **Install from VSIX…** → pick the file.
3. Reload the window. Open a folder with `drafts/` and `codex/` (or run **Novel Studio: Bootstrap workspace**).
4. Click the Novel Studio book icon in the Activity Bar. Store API keys once via **Novel Studio: Set API key**.

## Routing

| Tool | Destination |
| --- | --- |
| Story / Continue | Insert into the active Markdown draft at the cursor |
| Character | Append to `codex/characters.md` |
| World / items | Append to `codex/world_lore.md` or `codex/items.md` |
| Dialogue | Insert at cursor |
| Rephrase / edit | Replace the selection |
| Plot ideas | Append to `codex/plot_ideas.md` |

## Develop

```bash
npm install
npm run compile
npx @vscode/vsce package --allow-missing-repository
```

Marketplace publish still needs a personal Microsoft publisher + PAT on the publisher `kuuratsanik`.
