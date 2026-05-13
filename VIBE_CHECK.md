# 🪩 TL;DR
- **Score:** 35 / 100 — *You're going to feel this on Monday.*
- **Biggest win:** Schema validation at boundaries — Zod schemas on every MCP tool input.
- **Biggest miss:** No `AGENTS.md` / `CLAUDE.md` — an agent landing fresh has no orientation file.
- **Do this now:** Create an `AGENTS.md` that points to `DESIGN.md`, lists the `npm run build / test / typecheck / lint:check` verbs, and tells the agent how to drive `paperclaw classify` / `paperclaw ask` / MCP end-to-end.
- **Earned bonuses:** 2 earned 🎁🎁 → **Vibe Pioneer**

# 🌴 Stack detected
- **Language:** TypeScript (Node.js 20+)
- **Package manager:** npm
- **Toolchain notes:** NestJS 10 · nest-commander · Jest · ESLint 8 · Prettier 3 · Husky 9 · lint-staged 15 · MCP SDK · Anthropic SDK · Zod

# Vibe Check Report Card

```
┌─────┬─────────────────────────────────────┬──────┬─────────────────────────────────────────────────────────────────────────┐
│  #  │                Item                 │ Vibe │                                Evidence                                 │
├─────┼─────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
│  1  │ AGENTS.md / CLAUDE.md               │ 💀   │ Neither file exists at repo root. README is the only orientation.       │
├─────┼─────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
│  2  │ Strict type/compiler settings       │ 🩹   │ tsconfig.json has strictNullChecks + noImplicitAny but no "strict":     │
│     │                                     │      │ true, no noUncheckedIndexedAccess, no exactOptionalPropertyTypes.       │
├─────┼─────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
│  3  │ Strict linter / formatter           │ 🩹   │ .eslintrc.js uses default @typescript-eslint/recommended and turns      │
│     │                                     │      │ no-explicit-any OFF. Prettier wired. No --max-warnings 0.               │
├─────┼─────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
│  4  │ Schema validation at boundaries     │ 🚀   │ src/mcp/mcp.service.ts validates every MCP tool input with Zod          │
│     │                                     │      │ (regex'd date strings, enum categories, bounded limits).                │
├─────┼─────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
│  5  │ Business logic separated from I/O   │ 👍   │ front-matter.util.ts, transcript.util.ts, search.service.ts have       │
│     │                                     │      │ .spec files that exercise logic without mocking the filesystem.        │
├─────┼─────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
│  6  │ One-command bring-up                │ 🩹   │ README requires npm install → cp .env.example .env → npm run build.    │
│     │                                     │      │ No single `check` (typecheck + lint + test) script in package.json.    │
├─────┼─────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
│  7  │ Pre-commit feedback loop            │ 🩹   │ .husky/pre-commit runs `npx lint-staged` + `npm run typecheck`. No     │
│     │                                     │      │ secret scan (gitleaks), no tests on changed files. Hook only fires     │
│     │                                     │      │ after `npm install` triggers husky's `prepare`.                         │
├─────┼─────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
│  8  │ Dead-code guardrail                 │ 💀   │ No knip / ts-prune / equivalent in package.json or any script.          │
├─────┼─────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
│  9  │ Logs reachable from terminal        │ 🚀   │ README documents stdout output + JSONL `library/processing.log`        │
│     │                                     │      │ that any agent can tail.                                                │
├─────┼─────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
│ 10  │ Docs stay in sync with code         │ 💀   │ README.md + DESIGN.md exist but no pre-commit / CI check flags         │
│     │                                     │      │ code-only changes; no generated reference docs.                         │
├─────┼─────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
│ 11  │ Agent self-tests end-to-end         │ 👍   │ CLI verbs (`paperclaw classify` / `ask`) and MCP stdio server give an  │
│     │                                     │      │ agent real exercise paths; output is stdout/JSON. No AGENTS.md, but    │
│     │                                     │      │ README spells it out.                                                   │
├─────┼─────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
│ 12  │ Agentic review panel                │ 💀   │ No `/review` slash command, no REVIEW.md, no panel script. Human is   │
│     │                                     │      │ first reviewer of every diff.                                          │
├─────┼─────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
│ 13  │ Friction proportional to blast      │ 💀   │ No danger-zone hook, no CODEOWNERS, no named bypass for high-risk      │
│     │                                     │      │ surfaces (e.g. library write paths, MCP tool surface).                 │
├─────┼─────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────────────────┤
│ 14  │ Tooling tuned for the agent         │ 🩹   │ Failure paths print raw eslint/tsc/jest output — no remediation       │
│     │                                     │      │ hints, no allow-list comments explaining suppressions.                  │
└─────┴─────────────────────────────────────┴──────┴─────────────────────────────────────────────────────────────────────────┘
```

# 🎁 Bonus finds
- **`.mcp.json` ships in-repo** — Claude Code picks up the project's own MCP server automatically when launched from the repo root. Zero-config wiring is a big deal for an agent landing fresh.
- **Specialist MCP tools for the library** (`list_categories`, `list_providers`, `library_stats`, `search_transcripts`, `get_transcript`) — gives an agent typed entry points instead of forcing it to grep markdown files. Eats its own dog food.

Two genuine bonuses earned → **Vibe Pioneer** sticker awarded.

# 📊 Category scores

| Category | Items | Earned / Max | Badge |
|---|---|---|---|
| 🧱 Foundations | 2, 3, 4, 5 | 23 / 40 (58%) | 🔒 locked — needs ≥28 |
| ⚡ Feedback Loops | 6, 7, 8, 9, 14 | 19 / 50 (38%) | 🔒 locked — needs ≥35 |
| 🤖 Agent Enablement | 1, 10, 11, 12 | 7 / 40 (18%) | 🔒 locked — needs ≥28 |
| 🚨 Blast-Radius Safety | 13 | 0 / 10 (0%) | 🔒 locked |

No badges earned. The MCP/Zod work pulls Foundations close, but Agent Enablement is the bottleneck — the very category this whole audit is about.

# 🎯 Vibe Score: 35 / 100

# 💊 Top 3 hangover preventions

1. **Add an `AGENTS.md`.** Even 30 lines that point to `DESIGN.md`, list the four npm verbs (`build`/`test`/`typecheck`/`lint:check`), and describe the `classify` → `ask` → MCP loop would lift items 1, 10, and 11 in one move. Today, a fresh agent has to reverse-engineer the project from `package.json`.
2. **Tighten TypeScript and ESLint.** Flip `"strict": true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` in `tsconfig.json`, drop `eslint-plugin-prettier` indirection, re-enable `no-explicit-any`, and add a `check` script that runs `typecheck && lint:check && test`. One command, strict signal.
3. **Wire dead-code + secret-scan into the pre-commit loop.** Add `knip` (or `ts-prune`) and `gitleaks` to `.husky/pre-commit`, and print remediation lines on failure (e.g. *"run `npm run lint -- --fix`"*). This closes items 7, 8, and 14 together.

# 🪩 Verdict
**You're going to feel this on Monday.** — but with a *Vibe Pioneer* note: the MCP-first design is the seed of a genuinely agent-native repo. The scaffolding around it (orientation docs, review panel, blast-radius friction) hasn't caught up yet.
