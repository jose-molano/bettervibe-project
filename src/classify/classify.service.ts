import { Injectable } from '@nestjs/common';

export interface ClassifyResult {
  category: string;
  date: string;
  provider: string;
  summary: string;
  filename: string;
}

@Injectable()
export class ClassifyService {
  async classifyDocument(_text: string, _originalFilename: string): Promise<ClassifyResult> {
    throw new Error('Not implemented');
  }
}
