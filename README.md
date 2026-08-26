# Novel Studio

A writing operating system inside Visual Studio Code. Draft in Markdown, keep canon in `codex/`, generate and revise with the engine you already pay for, then compile a manuscript.

## Get started

1. Open an empty folder (or an existing novel repo).
2. Command Palette → **Novel Studio: New Novel Workspace**.
3. Open `drafts/ch01.md`. Fill `drafts/contracts/ch01.json`.
4. **Novel Studio: Continue Scene** (`Ctrl+Alt+N`).
5. Optional: Activity Bar → Novel Studio → **Keys** to store tokens in VS Code SecretStorage.

A Get Started walkthrough also appears after install.

## Settings

- `novelStudio.offlineFirst` — prefer local Ollama
- `novelStudio.defaultProvider` / `defaultModel` / `localTextUrl`
- `novelStudio.privacyLocalCodex` — do not send bible/RAG to cloud models

## Publish

See [PUBLISH.md](PUBLISH.md). Publisher id: `kuuratsanik`.

## License

MIT
