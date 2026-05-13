import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import pdfParse from 'pdf-parse';

@Injectable()
export class ExtractService {
  async extractText(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text ?? '';
  }
}
