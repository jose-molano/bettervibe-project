import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MCPService } from './mcp.service';
import { SearchService } from '../search/search.service';

function makeSearch(
  libraryPath: string,
  overrides: Partial<{
    hits: unknown[];
    categories: unknown[];
    providers: unknown[];
    stats: unknown;
  }> = {},
): SearchService {
  return {
    libraryPath: () => libraryPath,
    searchTranscripts: jest.fn().mockResolvedValue(overrides.hits ?? []),
    listCategories: jest.fn().mockResolvedValue(overrides.categories ?? []),
    listProviders: jest.fn().mockResolvedValue(overrides.providers ?? []),
    getStats: jest.fn().mockResolvedValue(
      overrides.stats ?? {
        total_documents: 0,
        by_category: {},
        by_year: {},
        upcoming_due_dates: [],
      },
    ),
  } as unknown as SearchService;
}

interface ToolEntry {
  handler: (args: unknown) => Promise<{ content: { text: string }[] }>;
}

function tools(server: unknown): Record<string, ToolEntry> {
  return (server as { _registeredTools: Record<string, ToolEntry> })._registeredTools;
}

describe('MCPService', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'paperclaw-mcp-'));
    await mkdir(join(tmp, '2024', 'utilities'), { recursive: true });
    await writeFile(join(tmp, '2024', 'utilities', 'a.md'), '---\ncategory: utilities\n---\nbody');
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('registers all five tools on the server', () => {
    const svc = new MCPService(makeSearch(tmp));
    const server = svc.buildServer();
    expect(Object.keys(tools(server)).sort()).toEqual([
      'get_transcript',
      'library_stats',
      'list_categories',
      'list_providers',
      'search_transcripts',
    ]);
  });

  it('get_transcript rejects paths outside LIBRARY_PATH', async () => {
    const svc = new MCPService(makeSearch(tmp));
    const server = svc.buildServer();
    const tool = tools(server)['get_transcript'];

    await expect(tool.handler({ path: '/etc/passwd' })).rejects.toThrow(/outside LIBRARY_PATH/);
  });

  it('get_transcript reads a file under LIBRARY_PATH', async () => {
    const svc = new MCPService(makeSearch(tmp));
    const server = svc.buildServer();
    const tool = tools(server)['get_transcript'];

    const result = await tool.handler({ path: join(tmp, '2024', 'utilities', 'a.md') });
    expect(result.content[0].text).toContain('category: utilities');
  });

  it('search_transcripts returns hits as JSON text content', async () => {
    const hits = [{ path: 'p', frontMatter: { category: 'utilities' }, snippet: 's' }];
    const svc = new MCPService(makeSearch(tmp, { hits }));
    const server = svc.buildServer();
    const tool = tools(server)['search_transcripts'];

    const result = await tool.handler({ category: 'utilities' });
    expect(JSON.parse(result.content[0].text)).toEqual(hits);
  });

  it('list_categories returns aggregated counts as JSON', async () => {
    const categories = [
      { category: 'utilities', count: 3 },
      { category: 'banking', count: 1 },
    ];
    const svc = new MCPService(makeSearch(tmp, { categories }));
    const server = svc.buildServer();
    const result = await tools(server)['list_categories'].handler({});
    expect(JSON.parse(result.content[0].text)).toEqual(categories);
  });

  it('list_providers returns aggregated providers as JSON', async () => {
    const providers = [{ provider: 'Vattenfall', count: 2, last_seen: '2024-12-15' }];
    const svc = new MCPService(makeSearch(tmp, { providers }));
    const server = svc.buildServer();
    const result = await tools(server)['list_providers'].handler({});
    expect(JSON.parse(result.content[0].text)).toEqual(providers);
  });

  it('library_stats returns the full stats object as JSON', async () => {
    const stats = {
      total_documents: 4,
      by_category: { utilities: 3, banking: 1 },
      by_year: { '2024': 4 },
      upcoming_due_dates: [
        { due_date: '2099-01-01', path: 'p', provider: 'X', category: 'utilities' },
      ],
    };
    const svc = new MCPService(makeSearch(tmp, { stats }));
    const server = svc.buildServer();
    const result = await tools(server)['library_stats'].handler({});
    expect(JSON.parse(result.content[0].text)).toEqual(stats);
  });
});
