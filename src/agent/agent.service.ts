import Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { ANTHROPIC_CLIENT } from '../anthropic/anthropic.provider';
import { SearchService } from '../search/search.service';

const MODEL = 'claude-sonnet-4-6';
const MAX_TRANSCRIPT_CHARS = 80_000;
const MIN_PREFILTER_HITS = 3;
const PREFILTER_LIMIT = 40;

const SYSTEM_PROMPT = `You are a personal document assistant. Answer the user's question using ONLY the provided transcripts of their classified documents.
- Cite the source transcript path inline when you reference a specific document.
- If the transcripts don't contain enough information, say so explicitly. Do not invent dates, amounts, or vendors.
- For "overdue" questions, compare due_date (from YAML front-matter) against today's date provided in the question context.
- Answer in plain language. Be concise.`;

@Injectable()
export class AgentService {
  constructor(
    @Inject(ANTHROPIC_CLIENT) private readonly client: Anthropic,
    private readonly search: SearchService,
  ) {}

  async ask(
    question: string,
    write: (chunk: string) => void = (c) => process.stdout.write(c),
  ): Promise<void> {
    const transcripts = await this.gatherTranscripts(question);
    if (transcripts.length === 0) {
      write('No transcripts found in the library. Run `paperclaw classify` first.\n');
      return;
    }

    const userMessage = this.buildUserMessage(question, transcripts);

    const stream = this.client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    stream.on('text', (text) => write(text));
    await stream.finalMessage();
    write('\n');
  }

  private async gatherTranscripts(question: string): Promise<{ path: string; content: string }[]> {
    let hits = await this.search.searchTranscripts({ text: question, limit: PREFILTER_LIMIT });
    if (hits.length < MIN_PREFILTER_HITS) {
      hits = await this.search.searchTranscripts({ limit: PREFILTER_LIMIT });
    }

    const out: { path: string; content: string }[] = [];
    let budget = MAX_TRANSCRIPT_CHARS;
    for (const hit of hits) {
      let raw: string;
      try {
        raw = await readFile(hit.path, 'utf8');
      } catch {
        continue;
      }
      const piece = raw.length > budget ? raw.slice(0, budget) : raw;
      out.push({ path: hit.path, content: piece });
      budget -= piece.length;
      if (budget <= 0) break;
    }
    return out;
  }

  private buildUserMessage(
    question: string,
    transcripts: { path: string; content: string }[],
  ): string {
    const today = new Date().toISOString().slice(0, 10);
    const blocks = transcripts
      .map(({ path, content }) => `### Transcript: ${basename(path)}\nPath: ${path}\n\n${content}`)
      .join('\n\n---\n\n');
    return `Today's date is ${today}.\n\nUser question:\n${question}\n\nTranscripts (${transcripts.length}):\n\n${blocks}`;
  }
}
