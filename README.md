# PaperClaw

Local CLI that turns a folder of raw PDFs (utility bills, invoices, contracts,
insurance letters, bank statements) into an organized document library.

Two commands:

- **`paperclaw classify [inbox-path]`** — scans a folder for PDFs, extracts
  their text, asks Claude to classify them, moves each PDF into
  `library/YYYY/category/` with a sensible filename, and writes a `.md`
  transcript alongside it.
- **`paperclaw ask "<question>"`** — loads relevant `.md` transcripts (via the
  built-in search) and asks Claude to answer in plain language (e.g. *"Which
  bills are overdue?"*).
- **`paperclaw mcp`** — runs as an [MCP](https://modelcontextprotocol.io/)
  stdio server, exposing two tools (`search_transcripts`, `get_transcript`) so
  an agent (e.g. Claude Code) can drive the library directly.

See [DESIGN.md](DESIGN.md) for architecture, transcript format, categories,
and limitations.

## Requirements

- Node.js 20+
- An Anthropic API key (`ANTHROPIC_API_KEY`)

## Setup

```bash
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

## Build

```bash
npm run build
```

## Run

Drop one or more PDFs into `./inbox/`, then either:

```bash
# Option A — via the local CLI bin (after building)
npm link
paperclaw classify

# Option B — without linking
node dist/main.js classify

# Option C — point at a different inbox folder
paperclaw classify /path/to/some/folder
```

Output:

- The PDF is **copied** to `library/{YYYY}/{category}/{YYYY-MM}-{slug}.pdf`.
- A matching `.md` transcript (YAML front-matter + extracted text) lives next to it.
- The original is moved to `inbox/done/` (never deleted).
- Every event is appended to `library/processing.log` (JSON Lines) and printed to stdout.

Low-confidence or unclassifiable documents land in
`library/{current-year}/unsorted/` with a date-prefixed filename for manual review.
Scanned/image-only PDFs are skipped with a warning (OCR is not yet supported).

## Ask & MCP

Once you have classified some documents, you can query the library two ways:

```bash
# Human-friendly Q&A — streams Claude's answer to stdout
paperclaw ask "Which bills are overdue?"
paperclaw ask "Show me documents from Stadtwerke"
paperclaw ask "Find the invoice for the gadget from three months ago"
```

```bash
# Agent-facing: speak MCP over stdio
paperclaw mcp
```

The repo ships a project-scoped [.mcp.json](.mcp.json) so Claude Code picks up
the server automatically when launched from the repo root (run `npm run build`
first). Inside Claude Code the same questions can be answered by the model
calling `search_transcripts` and `get_transcript` directly.

Tools exposed by the MCP server:

| Tool | Input | Purpose |
|---|---|---|
| `list_categories` | _(none)_ | List the categories present in the library with their counts. Use before `search_transcripts` to know which filters make sense. |
| `list_providers` | _(none)_ | List unique providers with counts and most recent document date. |
| `library_stats` | _(none)_ | Library summary: total docs, breakdown by category and year, next 5 upcoming due dates. |
| `search_transcripts` | `category`, `provider`, `dateFrom`, `dateTo`, `dueBefore`, `dueAfter`, `text`, `limit` | Filter the library by YAML front-matter and/or text. Returns hits with metadata and a snippet. |
| `get_transcript` | `path` (must be inside `LIBRARY_PATH`) | Return the full markdown transcript. |

What could come next as MCP tools (not implemented): `classify_pdf`,
`mark_paid`, `extract_amounts`, `summarize_year`, `find_duplicates`.

## Development

```bash
npm test            # run unit tests (no API key required)
npm run typecheck   # tsc --noEmit
npm run lint:check  # eslint
npm run format      # prettier --write
npm run start:dev   # nest start --watch
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(required)* | API key for Claude |
| `INBOX_PATH` | `./inbox` | Folder scanned by `classify` |
| `LIBRARY_PATH` | `./library` | Destination tree for organized documents |
