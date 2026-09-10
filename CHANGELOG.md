# Changelog

## 2.1.0

- **Orchestrator** coordinates all Novel Studio tasks across workspace + local infrastructure.
- Profiles: `startup`, `save`, `full`, `publish` — run from **Autopilot** tab or command palette.
- Auto-runs startup pipeline on workspace open; save pipeline debounced after markdown saves.
- Infrastructure probe writes `compile/infrastructure.md` (Ollama, pandoc, zip, espeak).
- Reports: `compile/orchestrator-report.md`, `.novel-studio/orchestrator-log.jsonl`.
- CI: `npm run orchestrate:ci` validates tests + demo-novel fixture.

## 2.0.0

### Phase 1 — Local intelligence loop
- Tiered model router: `novelStudio.fastModel` / `novelStudio.writerModel`
- Generation cancel (`novelStudio.cancelGeneration`) and Studio Hub Stop button
- Studio Hub streams prose tools directly into the editor
- Hybrid RAG v2: keyword + embedding re-rank with speaker boost
- JSON contract inference via Ollama when available

### Phase 2 — Continuity compiler
- Manuscript graph in `.novel-studio/graph.json` (rebuilt on save)
- Continuity quick-fix code actions (fast model rewrite)
- Graph-aware continuity flags

### Phase 3 — Agentic pipeline
- **Write Scene Pipeline** command: contract → generate → state → audit
- Multi-agent uses fast model for editor/continuity passes
- Outline sync v2 updates existing chapter beats and contracts
- Workspace `prompts/*.md` hot-loaded in prompt library

### Phase 4 — Publish-ready
- **Export PDF** via pandoc when installed
- KDP publish zip includes ISBN field, cover placeholder
- Local TTS fallback (`espeak` / `pico2wave`) for narration path

## 1.5.0

- Studio Hub **Workflow** tab: compile, HTML, EPUB, publish zip, outline sync, embeddings, snapshot, audit.
- Sidebar streams generation into the output panel; contract gate before story generation.
- Editor sync: contract and analytics refresh when you switch chapters.
- Clickable chapter rows in Analytics open the draft file.
- Model/provider footer with **Pick local model** in Studio Hub.
- Markdown index cache (invalidated on save) for faster audits and RAG.
- Incremental embedding rebuild on save (only changed files).
- Cross-chapter continuity audit, POV/tense/banned-word checks from `studio.json`.
- Character voice models injected into generation context.
- Richer EPUB/HTML: bold, italic, lists, `[[wiki]]` links.
- Real publish/KDP zip with manuscript.md, manuscript.html, manifest.
- **Export HTML Manuscript** command (`compile/manuscript.html`).

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
