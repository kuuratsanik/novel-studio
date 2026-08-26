# Publish Novel Studio

```bash
npm install
npm run compile
npx @vscode/vsce package
npx @vscode/vsce login kuuratsanik
npx @vscode/vsce publish
```

Create the publisher at https://marketplace.visualstudio.com/manage if needed.
Azure DevOps PAT with Marketplace (Acquire + Publish).
