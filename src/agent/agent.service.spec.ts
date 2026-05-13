import type Anthropic from '@anthropic-ai/sdk';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentService } from './agent.service';
import { SearchService } from '../search/search.service';
import { buildTranscriptContent } from '../library/transcript.util';

function makeClient(stream: jest.Mock): Anthropic {
  return { messages: { stream } } as unknown as Anthropic;
}

function makeSearch(hits: { path: string }[]): SearchService {
  return {
    searchTranscripts: jest.fn().mockResolvedValue(hits),
  } as unknown as SearchService;
}

class FakeStream extends EventEmitter {
  constructor(private readonly chunks: string[]) {
    super();
  }
  async finalMessage(): Promise<unknown> {
    for (const chunk of this.chunks) this.emit('text', chunk);
    return { content: [{ type: 'text', text: this.chunks.join('') }] };
  }
}

describe('AgentService', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'paperclaw-agent-'));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  async function transcriptAt(rel: string): Promise<string> {
    const full = join(tmp, rel);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(
      full,
      buildTranscriptContent(
        { category: 'utilities', date: '2024-09-01', due_date: '2024-10-01', provider: 'X' },
        'Title',
        'transcript body',
      ),
    );
    return full;
  }

  it('streams text chunks to the writer and includes transcripts in the user message', async () => {
    const path = await transcriptAt('2024/utilities/a.md');
    const stream = jest.fn().mockReturnValue(new FakeStream(['Hello ', 'world.']));
    const search = makeSearch([{ path }]);
    const svc = new AgentService(makeClient(stream), search);

    let output = '';
    await svc.ask('what is this?', (c) => {
      output += c;
    });

    expect(output).toContain('Hello world.');
    const callArgs = stream.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-4-6');
    const userContent = callArgs.messages[0].content as string;
    expect(userContent).toContain('what is this?');
    expect(userContent).toContain('transcript body');
    expect(userContent).toContain(path);
  });

  it('prints a helpful message and returns when library is empty', async () => {
    const stream = jest.fn();
    const search = makeSearch([]);
    const svc = new AgentService(makeClient(stream), search);

    // search returns [] for both prefiltered and fallback calls
    (search.searchTranscripts as jest.Mock).mockResolvedValue([]);

    let output = '';
    await svc.ask('anything?', (c) => {
      output += c;
    });

    expect(output).toMatch(/no transcripts/i);
    expect(stream).not.toHaveBeenCalled();
  });

  it('falls back to full library when pre-filter has fewer than 3 hits', async () => {
    const path = await transcriptAt('2024/utilities/a.md');
    const stream = jest.fn().mockReturnValue(new FakeStream(['ok']));

    const calls: object[] = [];
    const search = {
      searchTranscripts: jest.fn(async (f: object) => {
        calls.push(f);
        if (calls.length === 1) return []; // prefilter empty
        return [{ path }]; // fallback returns hit
      }),
    } as unknown as SearchService;

    const svc = new AgentService(makeClient(stream), search);
    let output = '';
    await svc.ask('q', (c) => {
      output += c;
    });

    expect(calls.length).toBe(2);
    expect(output).toContain('ok');
  });
});
