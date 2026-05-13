import { Injectable } from '@nestjs/common';

@Injectable()
export class AgentService {
  async ask(_question: string, _transcripts: string[]): Promise<string> {
    throw new Error('Not implemented');
  }
}
