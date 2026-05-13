import { Injectable } from '@nestjs/common';

@Injectable()
export class ExtractService {
  async extractText(_filePath: string): Promise<string> {
    throw new Error('Not implemented');
  }
}
