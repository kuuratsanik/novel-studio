# Novel Studio

Write novels in VS Code: multi-engine generation, series bible, scene contracts, continuity audit, manuscript compile.

**Publisher ID:** `kuuratsanik`  
**Extension ID:** `kuuratsanik.novel-studio`  
**Repo:** https://github.com/kuuratsanik/novel-studio

## Status of this repository

Packaging, docs, and core TypeScript entrypoints are on `main`.  
The complete `src/` tree is also shipped in the project zip (`novel-studio-1.0.0-full.zip`). If any service file is missing after clone, unpack the zip over this folder.

## Local install (no Marketplace needed)

```bash
git clone https://github.com/kuuratsanik/novel-studio.git
cd novel-studio
# if src/ is incomplete, copy from the full zip
npm install
npm run compile
npx @vscode/vsce package
code --install-extension kuuratsanik-novel-studio-1.0.0.vsix
```

## Marketplace publish

1. Create publisher `kuuratsanik` at https://marketplace.visualstudio.com/manage  
   (website field can be `https://github.com/kuuratsanik`)
2. Azure DevOps PAT with Marketplace **Publish**
3. Then:

```bash
npx @vscode/vsce login kuuratsanik
npx @vscode/vsce publish
```

See [PUBLISH.md](PUBLISH.md).

## License

MIT
