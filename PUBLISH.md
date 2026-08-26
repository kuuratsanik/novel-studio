# Configure vsce publisher ID

The Marketplace extension ID will be:

**`kuuratsanik.novel-studio`**

That comes from `package.json`:

```json
"publisher": "kuuratsanik",
"name": "novel-studio"
```

## 1. Create the publisher (once)

1. Open https://marketplace.visualstudio.com/manage
2. Sign in with the Microsoft account you want as the publisher owner.
3. **Create publisher** → Publisher ID: **`kuuratsanik`** (must match `package.json` exactly).
4. Display name can be "Sven Katkosilt" or "Novel Studio".

If `kuuratsanik` is taken, either claim a different ID and change `"publisher"` in `package.json`, or use a name you already own on the Marketplace.

## 2. Azure DevOps PAT

1. https://dev.azure.com → User settings → **Personal access tokens**
2. New token → Organization: **All accessible organizations**
3. Scopes: **Marketplace** → **Acquire** + **Publish** (or Manage)
4. Copy the token (shown once).

## 3. Login and publish

```bash
cd novel-studio-toolsaday   # or your clone of kuuratsanik/novel-studio
npm install
npm run compile

# Store publisher credentials (token is the PAT above)
npx @vscode/vsce login kuuratsanik

# Local .vsix smoke test
npx @vscode/vsce package
code --install-extension kuuratsanik-novel-studio-1.0.0.vsix

# Live Marketplace
npx @vscode/vsce publish
```

OpenVSX (optional, for Cursor / VSCodium):

```bash
npx ovsx publish *.vsix -p $OVSX_PAT
```

## 4. CI

Repo workflow `.github/workflows/publish.yml` runs on GitHub Release.
Add secret **`VSCE_PAT`** = the same Azure DevOps token.

## Change publisher later

Edit `"publisher"` in `package.json`, then:

```bash
npx @vscode/vsce login NEW_ID
npx @vscode/vsce publish
```

Unpublished extensions can switch ID freely; published ones keep the original ID forever.
