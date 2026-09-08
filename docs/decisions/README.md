# Decisions

Architecture and product choices, one file each. Format: [TEMPLATE.md](TEMPLATE.md). Workflow: [WORKFLOW.md](../WORKFLOW.md).

Read this index before re-opening a choice. **Accepted** means Tauqueer locked it. Do not rewrite an Accepted body; supersede it with a new numbered file.

Current architecture (mutable “how”): [TRD.md](../TRD.md). Current snapshot: [CONTEXT.md](../CONTEXT.md).

| ID | Title | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-docs-as-code.md) | Docs live in the repo: map, context, ADRs, no empty Diátaxis folders | Accepted | 2026-09-08 |
| [0002](0002-hosted-fish-tts-per-persona.md) | Hosted Fish TTS per persona; Aura otherwise; no GPU; no id sniffing | Accepted | 2026-09-08 |
| [0003](0003-working-loop.md) | One named part; subparts; tests and logic; ask about manual; then commit and stop | Accepted | 2026-09-08 |
| [0004](0004-early-product-locks.md) | First-build locks that still hold (point to TRD / SHIPPED) | Accepted | 2026-09-08 |
| [0005](0005-persona-voice-provider.md) | Owner chooses Aura or Fish via an env-named provider key; do not infer from a Fish id | Accepted | 2026-09-08 |
