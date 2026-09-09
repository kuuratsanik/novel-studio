# Changelog

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
