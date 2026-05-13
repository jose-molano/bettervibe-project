import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MCPService } from './mcp.service';
import { SearchService } from '../search/search.service';

function makeSearch(libraryPath: string, hits: unknown[] = []): SearchService {
  return {
    libraryPath: () => libraryPath,
    searchTranscripts: jest.fn().mockResolvedValue(hits),
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

  it('registers both tools on the server', () => {
    const svc = new MCPService(makeSearch(tmp));
    const server = svc.buildServer();
    expect(Object.keys(tools(server)).sort()).toEqual(['get_transcript', 'search_transcripts']);
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
    const svc = new MCPService(makeSearch(tmp, hits));
    const server = svc.buildServer();
    const tool = tools(server)['search_transcripts'];

    const result = await tool.handler({ category: 'utilities' });
    expect(JSON.parse(result.content[0].text)).toEqual(hits);
  });
});
