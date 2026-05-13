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
