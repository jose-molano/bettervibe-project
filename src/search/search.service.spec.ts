import { ConfigService } from '@nestjs/config';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibraryService } from '../library/library.service';
import { buildTranscriptContent } from '../library/transcript.util';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let tmp: string;
  let service: SearchService;

  async function dropTranscript(
    relPath: string,
    fm: Record<string, string>,
    body: string,
  ): Promise<void> {
    const full = join(tmp, relPath);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, buildTranscriptContent(fm, 'Title', body));
  }

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'paperclaw-search-'));
    const config = {
      get: (key: string) => (key === 'LIBRARY_PATH' ? tmp : undefined),
    } as unknown as ConfigService;
    service = new SearchService(new LibraryService(), config);
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('filters by category', async () => {
    await dropTranscript(
      '2024/utilities/a.md',
      { category: 'utilities', date: '2024-09-01', due_date: '', provider: 'Vattenfall' },
      'electricity',
    );
    await dropTranscript(
      '2024/banking/b.md',
      { category: 'banking', date: '2024-08-01', due_date: '', provider: 'Santander' },
      'statement',
    );

    const hits = await service.searchTranscripts({ category: 'utilities' });
    expect(hits).toHaveLength(1);
    expect(hits[0].frontMatter.provider).toBe('Vattenfall');
  });

  it('filters by provider substring (case-insensitive)', async () => {
    await dropTranscript(
      '2024/utilities/a.md',
      { category: 'utilities', date: '2024-09-01', due_date: '', provider: 'Stadtwerke München' },
      'gas bill',
    );
    await dropTranscript(
      '2024/utilities/b.md',
      { category: 'utilities', date: '2024-09-01', due_date: '', provider: 'Vattenfall' },
      'electricity',
    );

    const hits = await service.searchTranscripts({ provider: 'stadtwerke' });
    expect(hits).toHaveLength(1);
    expect(hits[0].frontMatter.provider).toContain('Stadtwerke');
  });

  it('filters by dueBefore (ignores docs without due_date)', async () => {
    await dropTranscript(
      '2024/utilities/overdue.md',
      { category: 'utilities', date: '2024-09-01', due_date: '2024-10-01', provider: 'X' },
      'bill',
    );
    await dropTranscript(
      '2024/utilities/future.md',
      { category: 'utilities', date: '2024-09-01', due_date: '2030-01-01', provider: 'X' },
      'bill',
    );
    await dropTranscript(
      '2024/contracts/c.md',
      { category: 'contracts', date: '2024-09-01', due_date: '', provider: 'X' },
      'contract',
    );

    const hits = await service.searchTranscripts({ dueBefore: '2024-12-31' });
    expect(hits.map((h) => h.path)).toEqual([join(tmp, '2024/utilities/overdue.md')]);
  });

  it('filters by text and returns a context snippet around the match', async () => {
    await dropTranscript(
      '2024/utilities/a.md',
      { category: 'utilities', date: '2024-09-01', due_date: '', provider: 'Vattenfall' },
      `Lorem ipsum dolor.\nThe gadget order #42 totalled €199.\nThanks for your business.`,
    );
    await dropTranscript(
      '2024/banking/b.md',
      { category: 'banking', date: '2024-08-01', due_date: '', provider: 'Santander' },
      'statement, no mention of the keyword',
    );

    const hits = await service.searchTranscripts({ text: 'gadget' });
    expect(hits).toHaveLength(1);
    expect(hits[0].snippet.toLowerCase()).toContain('gadget');
  });

  it('honours limit', async () => {
    for (let i = 0; i < 5; i++) {
      await dropTranscript(
        `2024/utilities/${i}.md`,
        { category: 'utilities', date: '2024-09-01', due_date: '', provider: 'X' },
        'x',
      );
    }
    const hits = await service.searchTranscripts({ limit: 2 });
    expect(hits).toHaveLength(2);
  });
});
