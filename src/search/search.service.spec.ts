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

  describe('listCategories', () => {
    it('groups by category and sorts by count desc', async () => {
      await dropTranscript(
        '2024/utilities/a.md',
        { category: 'utilities', date: '2024-09-01', due_date: '', provider: 'X' },
        'x',
      );
      await dropTranscript(
        '2024/utilities/b.md',
        { category: 'utilities', date: '2024-09-01', due_date: '', provider: 'X' },
        'x',
      );
      await dropTranscript(
        '2024/banking/c.md',
        { category: 'banking', date: '2024-09-01', due_date: '', provider: 'X' },
        'x',
      );

      const result = await service.listCategories();
      expect(result).toEqual([
        { category: 'utilities', count: 2 },
        { category: 'banking', count: 1 },
      ]);
    });

    it('returns an empty array when library is empty', async () => {
      expect(await service.listCategories()).toEqual([]);
    });
  });

  describe('listProviders', () => {
    it('groups by provider, ignores empty, tracks last_seen', async () => {
      await dropTranscript(
        '2024/utilities/a.md',
        { category: 'utilities', date: '2024-09-01', due_date: '', provider: 'Vattenfall' },
        'x',
      );
      await dropTranscript(
        '2024/utilities/b.md',
        { category: 'utilities', date: '2024-12-15', due_date: '', provider: 'Vattenfall' },
        'x',
      );
      await dropTranscript(
        '2024/banking/c.md',
        { category: 'banking', date: '2024-08-01', due_date: '', provider: 'Santander' },
        'x',
      );
      await dropTranscript(
        '2024/contracts/d.md',
        { category: 'contracts', date: '2024-01-01', due_date: '', provider: '' },
        'x',
      );

      const result = await service.listProviders();
      expect(result).toEqual([
        { provider: 'Vattenfall', count: 2, last_seen: '2024-12-15' },
        { provider: 'Santander', count: 1, last_seen: '2024-08-01' },
      ]);
    });
  });

  describe('getStats', () => {
    it('returns zeros on empty library', async () => {
      const stats = await service.getStats();
      expect(stats).toEqual({
        total_documents: 0,
        by_category: {},
        by_year: {},
        upcoming_due_dates: [],
      });
    });

    it('builds totals, by_category, by_year, and upcoming_due_dates', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const farFuture = '2999-12-31';
      const farFuture2 = '2999-12-30';

      await dropTranscript(
        '2024/utilities/a.md',
        {
          category: 'utilities',
          date: '2024-09-01',
          due_date: farFuture,
          provider: 'Vattenfall',
        },
        'x',
      );
      await dropTranscript(
        '2025/utilities/b.md',
        {
          category: 'utilities',
          date: '2025-02-10',
          due_date: farFuture2,
          provider: 'Vattenfall',
        },
        'x',
      );
      await dropTranscript(
        '2024/banking/c.md',
        { category: 'banking', date: '2024-08-01', due_date: '', provider: 'Santander' },
        'x',
      );
      // overdue document — should NOT appear in upcoming
      await dropTranscript(
        '2024/utilities/d.md',
        { category: 'utilities', date: '2020-01-01', due_date: '2020-01-15', provider: 'X' },
        'x',
      );

      const stats = await service.getStats();
      expect(stats.total_documents).toBe(4);
      expect(stats.by_category).toEqual({ utilities: 3, banking: 1 });
      expect(stats.by_year).toEqual({ '2024': 2, '2025': 1, '2020': 1 });
      expect(stats.upcoming_due_dates.map((u) => u.due_date)).toEqual([farFuture2, farFuture]);
      expect(stats.upcoming_due_dates[0].provider).toBe('Vattenfall');
      void today;
    });

    it('caps upcoming_due_dates at 5', async () => {
      for (let i = 1; i <= 7; i++) {
        await dropTranscript(
          `2099/utilities/${i}.md`,
          {
            category: 'utilities',
            date: '2099-01-01',
            due_date: `2099-0${i}-01`,
            provider: 'X',
          },
          'x',
        );
      }
      const stats = await service.getStats();
      expect(stats.upcoming_due_dates).toHaveLength(5);
      expect(stats.upcoming_due_dates[0].due_date).toBe('2099-01-01');
      expect(stats.upcoming_due_dates[4].due_date).toBe('2099-05-01');
    });
  });
});
