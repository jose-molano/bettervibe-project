# PaperClaw — Design Document

## What It Does

PaperClaw is a local CLI tool that turns a folder of raw PDFs (utility bills,
invoices, contracts, insurance letters, bank statements) into an organized
document library. It has two commands:

- **`paperclaw classify [inbox-path]`** — scans a folder for PDFs, extracts
  their text, sends it to Claude for classification and filename suggestion,
  moves the PDF to the library under a logical path, and writes a `.md`
  transcript alongside it.

- **`paperclaw ask "<question>"`** — loads all `.md` transcripts from the
  library and sends them together with the user's question to Claude, which
  answers in plain language (e.g. "Which bills are overdue?", "Show me the
  latest electricity bill.").

Pipeline:

```
~/inbox/  ──classify──►  extract text (pdf-parse)
                       ──► Claude: {category, filename, summary, date}
                       ──► move PDF  →  ~/library/YYYY/category/YYYY-MM-description.pdf
                       ──► write MD  →  ~/library/YYYY/category/YYYY-MM-description.md

~/library/  ──ask──►  load all .md transcripts
                    ──► Claude agent answers the question
```

### Transcript Format

Each classified document gets a `.md` file with a YAML front-matter block
followed by the full extracted text:

```markdown
---
original_filename: electricity-bill-sept.pdf
category: utilities
date: 2024-09-01
provider: Vattenfall
summary: Electricity bill for September 2024, €87.50, due 2024-10-15
classified_at: 2024-10-01T10:00:00Z
---

# Vattenfall Electricity Bill – September 2024

[full extracted text]
```

---

## Language and Key Tools

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 + TypeScript 5 |
| Framework | NestJS 10 (standalone app — no HTTP server) |
| CLI layer | `nest-commander` (wraps commander.js, integrates with NestJS DI) |
| PDF extraction | `pdf-parse` (pure JS, no native dependencies) |
| LLM | Anthropic Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk` |
| Config | `@nestjs/config` + `.env` file |
| Testing | Jest + `@nestjs/testing` |
| Linting | ESLint + `@typescript-eslint` |
| Formatting | Prettier |
| Pre-commit | Husky + lint-staged |

---

## Architecture Overview

```
paperclaw/
├── src/
│   ├── main.ts                    # CommandFactory.run — CLI entrypoint
│   ├── app.module.ts              # Root module, imports all feature modules
│   ├── config/
│   │   └── config.module.ts       # ConfigModule: ANTHROPIC_API_KEY, LIBRARY_PATH, INBOX_PATH
│   ├── extract/
│   │   ├── extract.module.ts
│   │   └── extract.service.ts     # extractText(filePath): Promise<string>
│   ├── classify/
│   │   ├── classify.module.ts
│   │   ├── classify.service.ts    # classifyDocument(text, filename): Promise<ClassifyResult>
│   │   └── classify.command.ts    # @Command({ name: 'classify' })
│   ├── library/
│   │   ├── library.module.ts
│   │   └── library.service.ts     # movePdf(), writeTranscript(), listTranscripts()
│   └── agent/
│       ├── agent.module.ts
│       ├── agent.service.ts       # ask(question, transcripts[]): Promise<string>
│       └── agent.command.ts       # @Command({ name: 'ask' })
├── inbox/                         # Drop PDFs here (.gitkeep; real PDFs gitignored)
│   └── done/                      # Processed PDFs moved here (never deleted)
├── library/                       # Organized output (.gitkeep; contents gitignored)
│   └── {YYYY}/
│       └── {category}/
│           ├── YYYY-MM-{description}.pdf
│           └── YYYY-MM-{description}.md
└── test/
    └── extract.service.spec.ts
```

### Module Dependency Graph

```
AppModule
  ├── ConfigModule (global)
  ├── ExtractModule
  ├── ClassifyModule  →  ExtractModule
  ├── LibraryModule
  └── AgentModule     →  LibraryModule
```

### Data Flow: `classify`

1. Scan `inbox/` for `*.pdf` files
2. `ExtractService.extractText()` — pdf-parse returns raw string
3. If extracted text is empty or very short (< 100 chars): warn the user and skip the file — the PDF is likely scanned/image-based and cannot be processed without OCR (see Limitations)
4. `ClassifyService.classifyDocument()` — Claude returns `{ category, date, provider, summary, filename }`
5. `LibraryService.movePdf()` — copy to `library/YYYY/category/filename.pdf` (YYYY = document date, not classification date)
6. `LibraryService.writeTranscript()` — write front-matter + text to `filename.md`
7. Move original from `inbox/` to `inbox/done/` (never deleted — pipeline is recoverable)

### Data Flow: `ask`

1. `LibraryService.listTranscripts()` — glob all `*.md` files in `library/`
2. **Pre-filter** — extract keywords and date hints from the question; discard transcripts whose front-matter and content have no overlap with those keywords. This keeps the Claude context small even with large libraries.
3. `AgentService.ask()` — send filtered transcripts + question to Claude, stream answer to stdout

### Limitations

- **Scanned PDFs** — `pdf-parse` can only extract text from digitally-generated PDFs. Image-based or scanned PDFs will yield empty text and be skipped with a warning. OCR support (e.g., via Claude's vision API) is a planned future enhancement.
- **Pre-filter recall** — the keyword pre-filter is best-effort. Vague questions ("show me everything important") will fall back to sending all transcripts. A hard token-count cap prevents exceeding Claude's context window.

---

## Security and Privacy Considerations

- **API key** — `ANTHROPIC_API_KEY` is loaded exclusively from a `.env` file
  which is listed in `.gitignore`. It is never hard-coded or logged.

- **Documents leave the machine** — PDF text is sent to the Anthropic API for
  classification and Q&A. Users should be aware of this before pointing the
  tool at sensitive documents (e.g. medical records, legal contracts with
  confidential clauses).

- **No cloud storage** — The library lives entirely on the local filesystem.
  No data is written to any remote service other than the Anthropic API calls.

- **`inbox/` and `library/` are gitignored** — Personal documents are never
  accidentally committed. Only `.gitkeep` placeholder files are tracked.

- **No database** — Metadata lives in the `.md` front-matter, keeping the
  entire state visible and auditable with standard text tools.

- **Prompt injection** — Transcripts fed to the agent `ask` command come from
  local files the user controls; risk is low but users should avoid storing
  adversarially crafted PDFs in their library.
