jest.mock('pdf-parse', () => jest.fn());

import pdfParse from 'pdf-parse';
import { ExtractService } from './extract.service';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mockedPdfParse = pdfParse as unknown as jest.Mock;

describe('ExtractService', () => {
  let service: ExtractService;
  let tmpDir: string;

  beforeEach(async () => {
    service = new ExtractService();
    tmpDir = await mkdtemp(join(tmpdir(), 'paperclaw-extract-'));
    mockedPdfParse.mockReset();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns the text extracted by pdf-parse', async () => {
    mockedPdfParse.mockResolvedValueOnce({ text: 'hello world', numpages: 1 });
    const file = join(tmpDir, 'sample.pdf');
    await writeFile(file, Buffer.from('not really a pdf'));

    const text = await service.extractText(file);

    expect(text).toBe('hello world');
    expect(mockedPdfParse).toHaveBeenCalledTimes(1);
  });

  it('returns empty string if pdf-parse returns no text', async () => {
    mockedPdfParse.mockResolvedValueOnce({ text: undefined, numpages: 1 });
    const file = join(tmpDir, 'sample.pdf');
    await writeFile(file, Buffer.from('not really a pdf'));

    expect(await service.extractText(file)).toBe('');
  });

  it('propagates errors from pdf-parse', async () => {
    mockedPdfParse.mockRejectedValueOnce(new Error('corrupt pdf'));
    const file = join(tmpDir, 'sample.pdf');
    await writeFile(file, Buffer.from('garbage'));

    await expect(service.extractText(file)).rejects.toThrow('corrupt pdf');
  });
});
