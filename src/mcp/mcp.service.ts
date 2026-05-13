import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { CATEGORIES } from '../classify/categories';
import { SearchService, type SearchFilters } from '../search/search.service';

const SEARCH_INPUT = {
  category: z.enum(CATEGORIES).optional().describe('Filter by document category.'),
  provider: z
    .string()
    .optional()
    .describe('Substring match against the document provider (case-insensitive).'),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Earliest document date (YYYY-MM-DD).'),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Latest document date (YYYY-MM-DD).'),
  dueBefore: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Only return docs with due_date < this date. Docs without due_date are excluded.'),
  dueAfter: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Only return docs with due_date > this date. Docs without due_date are excluded.'),
  text: z
    .string()
    .optional()
    .describe('Case-insensitive substring search across summary and body text.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of hits to return (default 20).'),
};

const GET_INPUT = {
  path: z
    .string()
    .describe('Absolute path to a .md transcript inside the configured LIBRARY_PATH.'),
};

const BILLS_INPUT = {
  days: z
    .number()
    .int()
    .min(1)
    .max(60)
    .optional()
    .describe('Window size in days from today (inclusive). Default 7.'),
};

const EXTRACT_AMOUNTS_INPUT = {
  path: z
    .string()
    .describe('Absolute path to a .md transcript inside LIBRARY_PATH to scan for amounts.'),
};

function addDays(yyyymmdd: string, days: number): string {
  const d = new Date(`${yyyymmdd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class MCPService {
  constructor(private readonly search: SearchService) {}

  buildServer(): McpServer {
    const server = new McpServer({ name: 'paperclaw', version: '0.1.0' });

    server.registerTool(
      'search_transcripts',
      {
        title: 'Search transcripts',
        description:
          'Search the document library by YAML front-matter (category, provider, date range, due date) and/or text. Returns matching transcripts with metadata and a snippet. Use this first; then call get_transcript for documents you need to inspect in full.',
        inputSchema: SEARCH_INPUT,
      },
      async (args) => {
        const filters: SearchFilters = args;
        const hits = await this.search.searchTranscripts(filters);
        return {
          content: [{ type: 'text', text: JSON.stringify(hits, null, 2) }],
        };
      },
    );

    server.registerTool(
      'list_categories',
      {
        title: 'List categories',
        description:
          'List the document categories present in the library with their counts. Call this before search_transcripts when you do not know which categories exist.',
        inputSchema: {},
      },
      async () => {
        const result = await this.search.listCategories();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.registerTool(
      'list_providers',
      {
        title: 'List providers',
        description:
          "List unique providers in the library with their document counts and the date of the most recent document from each. Useful for queries like 'show me everything from X'.",
        inputSchema: {},
      },
      async () => {
        const result = await this.search.listProviders();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.registerTool(
      'library_stats',
      {
        title: 'Library stats',
        description:
          'Return a summary of the library: total documents, breakdown by category and by year, and the next 5 upcoming due dates (excluding overdue).',
        inputSchema: {},
      },
      async () => {
        const result = await this.search.getStats();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.registerTool(
      'bills_due_this_week',
      {
        title: 'Bills due in the next N days',
        description:
          "Return documents whose due_date falls within the next N days (inclusive of today). Defaults to 7 days. Use this for questions like 'what's due this week' or 'show me bills due soon'.",
        inputSchema: BILLS_INPUT,
      },
      async (args) => {
        const days = args.days ?? 7;
        const today = new Date().toISOString().slice(0, 10);
        const dueAfter = addDays(today, -1);
        const dueBefore = addDays(today, days + 1);
        const hits = await this.search.searchTranscripts({ dueAfter, dueBefore });
        return {
          content: [{ type: 'text', text: JSON.stringify(hits, null, 2) }],
        };
      },
    );

    server.registerTool(
      'extract_amounts',
      {
        title: 'Extract monetary amounts from a transcript',
        description:
          "Scan a transcript for monetary amounts (€, EUR, $, USD) and return each with the surrounding text. Use this when the user asks 'how much was X' or 'find the total in this document'.",
        inputSchema: EXTRACT_AMOUNTS_INPUT,
      },
      async ({ path }) => {
        const content = await this.readTranscript(path);
        const amounts = SearchService.extractAmounts(content);
        return {
          content: [{ type: 'text', text: JSON.stringify(amounts, null, 2) }],
        };
      },
    );

    server.registerTool(
      'get_transcript',
      {
        title: 'Get transcript',
        description:
          'Read the full markdown transcript at the given path. The path must be inside LIBRARY_PATH (paths outside are rejected).',
        inputSchema: GET_INPUT,
      },
      async ({ path }) => {
        const content = await this.readTranscript(path);
        return { content: [{ type: 'text', text: content }] };
      },
    );

    return server;
  }

  async start(): Promise<void> {
    const server = this.buildServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }

  private async readTranscript(rawPath: string): Promise<string> {
    if (!isAbsolute(rawPath)) {
      throw new Error('path must be absolute');
    }
    const libraryPath = this.search.libraryPath();
    const resolved = resolve(rawPath);
    const rel = relative(libraryPath, resolved);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error(`path is outside LIBRARY_PATH (${libraryPath})`);
    }
    return readFile(resolved, 'utf8');
  }
}
