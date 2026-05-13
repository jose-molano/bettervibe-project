import { Injectable } from '@nestjs/common';

@Injectable()
export class LibraryService {
  async movePdf(_sourcePath: string, _destPath: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async writeTranscript(_destPath: string, _content: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async listTranscripts(_libraryPath: string): Promise<string[]> {
    throw new Error('Not implemented');
  }
}
