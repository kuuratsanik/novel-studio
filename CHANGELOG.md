# Changelog

## 1.4.0

- Studio Hub **Analytics** tab with live word counts, progress bar, and per-chapter stats.
- Auto-rebuild embedding index on save (`novelStudio.autoRebuildEmbeddings`).
- EPUB themes: serif, sans, dark (`novelStudio.epubTheme`).
- Integration test scaffold via `@vscode/test-electron` (`npm run test:integration`).

## 1.3.0

- Studio Hub **Contract** tab: edit, auto-infer, and save scene contracts in the sidebar.
- Semantic RAG via Ollama `nomic-embed-text` (hybrid with keyword wiki RAG).
- **Rebuild Embedding Index** command stores vectors in `.novel-studio/embeddings.json`.
- **Export EPUB** builds a valid EPUB from drafts (`zip` required).
- **Compare Snapshot to Trunk** opens a diff editor for branch snapshots.

## 1.2.0

- Stream local generation into the editor (`novelStudio.streamGeneration`).
- Contract mustInclude/mustNot audits in continuity diagnostics.
- Wiki `[[link]]` autocomplete and hover; broken-link report command.
- Outline sync creates missing chapter drafts + contracts from beats.
- Richer eval, analytics, read-aloud QA, compile TOC, and LoRA export format.
- Pick local Ollama model command; polish prompt distinct from expand.
- Multi-agent adds continuity pass when fully automatic.

## 1.1.0

- Fully automatic mode (default): Studio Hub generates and routes output without copy/paste.
- Auto-bootstrap workspace, infer scene contracts, apply state patches, and audit on save.
- Local-first routing probes Ollama automatically; RAG retrieval wired into context packing.
- Continuity diagnostics jump to the matching prose range.

## 1.0.1

- Centralize fiction-oriented default models (Claude Sonnet 5, GPT-4.1, Qwen 2.5 32B, NovelAI Erato).
- Route NovelAI text generation through `text.novelai.net` with `llama-3-erato-v1`.
- Drop unimplemented local provider names from privacy routing.

## 1.0.0

First release.

- Multi-engine text and image generation
- Series bible, scene contracts, state machine, continuity Problems
- Craft commands, status bar, keybindings
- Compile manuscript, KDP zip, project archive
- SecretStorage keys; optional privacy mode
