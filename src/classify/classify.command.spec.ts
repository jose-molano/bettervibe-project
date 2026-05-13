import { ConfigService } from '@nestjs/config';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ExtractService } from '../extract/extract.service';
import { LibraryService } from '../library/library.service';
import { LogService } from '../log/log.service';
import { ClassifyCommand } from './classify.command';
import { ClassifyService } from './classify.service';

describe('ClassifyCommand', () => {
  let tmp: string;
  let inbox: string;
  let library: string;
  let command: ClassifyCommand;
  let extract: jest.Mocked<ExtractService>;
  let classify: jest.Mocked<ClassifyService>;
  let log: jest.Mocked<LogService>;
  // real LibraryService against tmp dirs — fewer surprises than mocking fs
  let libraryService: LibraryService;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'paperclaw-cmd-'));
    inbox = join(tmp, 'inbox');
    library = join(tmp, 'library');
    await mkdir(inbox, { recursive: true });
    await mkdir(library, { recursive: true });

    extract = { extractText: jest.fn() } as unknown as jest.Mocked<ExtractService>;
    classify = { classifyDocument: jest.fn() } as unknown as jest.Mocked<ClassifyService>;
    log = { event: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<LogService>;
    libraryService = new LibraryService();

    const config = {
      get: (key: string) =>
        key === 'INBOX_PATH' ? inbox : key === 'LIBRARY_PATH' ? library : undefined,
    } as unknown as ConfigService;

    command = new ClassifyCommand(config, extract, classify, libraryService, log);
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  async function dropPdf(name: string): Promise<string> {
    const p = join(inbox, name);
    await writeFile(p, 'pretend-pdf');
    return p;
  }

  it('routes a high-confidence PDF into library/{year}/{category}/', async () => {
    const file = await dropPdf('bill.pdf');
    extract.extractText.mockResolvedValue('a'.repeat(500));
    classify.classifyDocument.mockResolvedValue({
      category: 'utilities',
      date: '2024-09-01',
      provider: 'Vattenfall',
      summary: 'Electricity bill Sept 2024',
      filename: 'electricity-bill',
      confidence: 'high',
    });

    await command.run([]);

    const pdf = join(library, '2024', 'utilities', '2024-09-electricity-bill.pdf');
    const md = pdf.replace(/\.pdf$/, '.md');
    expect(await readFile(pdf, 'utf8')).toBe('pretend-pdf');
    const transcript = await readFile(md, 'utf8');
    expect(transcript).toContain('category: utilities');
    expect(transcript).toContain('provider: Vattenfall');
    // archived
    expect(await readFile(join(inbox, 'done', 'bill.pdf'), 'utf8')).toBe('pretend-pdf');
    expect(log.event).toHaveBeenCalledWith(
      library,
      expect.objectContaining({ event: 'processed', category: 'utilities', uncertain: false }),
    );
    void file;
  });

  it('routes low-confidence into library/{thisYear}/unsorted/ with today-prefixed name', async () => {
    await dropPdf('something-weird.pdf');
    extract.extractText.mockResolvedValue('a'.repeat(500));
    classify.classifyDocument.mockResolvedValue({
      category: 'utilities',
      date: '2020-01-01',
      provider: '',
      summary: 'unsure',
      filename: 'mystery',
      confidence: 'low',
    });

    await command.run([]);

    const today = new Date().toISOString().slice(0, 10);
    const year = today.slice(0, 4);
    const expectedPdf = join(library, year, 'unsorted', `${today}-something-weird.pdf`);
    expect(await readFile(expectedPdf, 'utf8')).toBe('pretend-pdf');
    expect(log.event).toHaveBeenCalledWith(
      library,
      expect.objectContaining({ event: 'processed', category: 'unsorted', uncertain: true }),
    );
  });

  it('skips PDFs with no extractable text and leaves them in inbox', async () => {
    const file = await dropPdf('scanned.pdf');
    extract.extractText.mockResolvedValue('   ');

    await command.run([]);

    expect(classify.classifyDocument).not.toHaveBeenCalled();
    expect(await readFile(file, 'utf8')).toBe('pretend-pdf');
    expect(log.event).toHaveBeenCalledWith(
      library,
      expect.objectContaining({ event: 'skipped', reason: expect.stringContaining('no-text') }),
    );
  });

  it('logs an error and leaves the PDF in inbox when extraction fails', async () => {
    const file = await dropPdf('broken.pdf');
    extract.extractText.mockRejectedValue(new Error('corrupt pdf'));

    await command.run([]);

    expect(await readFile(file, 'utf8')).toBe('pretend-pdf');
    expect(log.event).toHaveBeenCalledWith(
      library,
      expect.objectContaining({ event: 'error', error: 'corrupt pdf' }),
    );
  });

  it('handles empty inbox gracefully', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await command.run([]);
    expect(extract.extractText).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('treats category=unsorted from a high-confidence response as uncertain', async () => {
    await dropPdf('manual.pdf');
    extract.extractText.mockResolvedValue('a'.repeat(500));
    classify.classifyDocument.mockResolvedValue({
      category: 'unsorted',
      date: '2024-03-15',
      provider: '',
      summary: 'no clear category',
      filename: 'thing',
      confidence: 'high',
    });

    await command.run([]);

    expect(log.event).toHaveBeenCalledWith(
      library,
      expect.objectContaining({ event: 'processed', category: 'unsorted', uncertain: true }),
    );
  });
});
