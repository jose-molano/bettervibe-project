import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibraryService } from './library.service';

describe('LibraryService', () => {
  let service: LibraryService;
  let tmp: string;

  beforeEach(async () => {
    service = new LibraryService();
    tmp = await mkdtemp(join(tmpdir(), 'paperclaw-lib-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('movePdf creates nested directories and copies the file', async () => {
    const src = join(tmp, 'source.pdf');
    await writeFile(src, 'PDFBYTES');

    const dest = join(tmp, 'library', '2024', 'utilities', '2024-09-bill.pdf');
    const final = await service.movePdf(src, dest);

    expect(final).toBe(dest);
    expect(await readFile(final, 'utf8')).toBe('PDFBYTES');
    // source still exists (it's a copy)
    expect((await stat(src)).isFile()).toBe(true);
  });

  it('movePdf appends -2, -3 on collision', async () => {
    const src = join(tmp, 'source.pdf');
    await writeFile(src, 'PDFBYTES');
    const dest = join(tmp, 'library', '2024', 'utilities', 'bill.pdf');

    const first = await service.movePdf(src, dest);
    const second = await service.movePdf(src, dest);
    const third = await service.movePdf(src, dest);

    expect(first).toBe(dest);
    expect(second).toBe(dest.replace('.pdf', '-2.pdf'));
    expect(third).toBe(dest.replace('.pdf', '-3.pdf'));
  });

  it('writeTranscript writes content to disk', async () => {
    const dest = join(tmp, 'library', '2024', 'utilities', 'bill.md');
    await service.writeTranscript(dest, '# hello\n');
    expect(await readFile(dest, 'utf8')).toBe('# hello\n');
  });

  it('archiveOriginal moves the file into the done dir', async () => {
    const src = join(tmp, 'source.pdf');
    await writeFile(src, 'PDFBYTES');
    const done = join(tmp, 'inbox', 'done');

    const finalPath = await service.archiveOriginal(src, done);

    expect(finalPath).toBe(join(done, 'source.pdf'));
    expect(await readFile(finalPath, 'utf8')).toBe('PDFBYTES');
    await expect(stat(src)).rejects.toThrow();
  });

  it('archiveOriginal resolves basename collisions', async () => {
    const { mkdir } = await import('node:fs/promises');
    const dir1 = join(tmp, 'a');
    const dir2 = join(tmp, 'b');
    await mkdir(dir1);
    await mkdir(dir2);
    const src1 = join(dir1, 'source.pdf');
    const src2 = join(dir2, 'source.pdf');
    await writeFile(src1, 'A');
    await writeFile(src2, 'B');
    const done = join(tmp, 'inbox', 'done');

    const final1 = await service.archiveOriginal(src1, done);
    const final2 = await service.archiveOriginal(src2, done);

    expect(final1).toBe(join(done, 'source.pdf'));
    expect(final2).toBe(join(done, 'source-2.pdf'));
    expect(await readFile(final1, 'utf8')).toBe('A');
    expect(await readFile(final2, 'utf8')).toBe('B');
  });
});
