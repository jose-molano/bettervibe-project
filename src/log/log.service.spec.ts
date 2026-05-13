import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LogService } from './log.service';

describe('LogService', () => {
  let service: LogService;
  let tmp: string;

  beforeEach(async () => {
    service = new LogService();
    tmp = await mkdtemp(join(tmpdir(), 'paperclaw-log-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('appends a parseable JSON line per event', async () => {
    await service.event(tmp, { event: 'start', file: '/inbox/a.pdf' });
    await service.event(tmp, {
      event: 'processed',
      file: '/inbox/a.pdf',
      destPdf: '/library/2024/utilities/bill.pdf',
      category: 'utilities',
      uncertain: false,
    });

    const raw = await readFile(join(tmp, 'processing.log'), 'utf8');
    const lines = raw.trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]);
    const second = JSON.parse(lines[1]);
    expect(first.event).toBe('start');
    expect(first.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(second.event).toBe('processed');
    expect(second.category).toBe('utilities');
  });
});
