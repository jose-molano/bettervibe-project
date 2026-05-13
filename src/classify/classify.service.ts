import Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable } from '@nestjs/common';
import { ANTHROPIC_CLIENT } from '../anthropic/anthropic.provider';
import { CATEGORIES, Category } from './categories';

export interface ClassifyResult {
  category: Category;
  date: string;
  provider: string;
  summary: string;
  filename: string;
  confidence: 'high' | 'medium' | 'low';
}

const MODEL = 'claude-sonnet-4-6';
const MAX_TEXT_CHARS = 30_000;
const TOOL_NAME = 'classify_document';

const SYSTEM_PROMPT = `You classify personal documents (bills, contracts, statements, etc.) extracted from PDFs.
For each document call the tool "classify_document" exactly once with your best guess of:
- category: one of ${CATEGORIES.join(', ')}. Pick "unsorted" only if no other category clearly applies.
- date: the most relevant date on the document in YYYY-MM-DD format (issue date for bills/invoices, signing date for contracts). If only month/year are visible, use the first day of that month.
- provider: the issuing entity (e.g. "Vattenfall", "Banco Santander"). Empty string if not identifiable.
- summary: one sentence (<= 200 chars) describing the document.
- filename: a short kebab-case slug (no extension, no dates) — e.g. "electricity-bill", "lease-agreement-apartment-4b".
- confidence: "high" if you are very sure, "medium" if you had to guess one field, "low" if the document is ambiguous or unreadable.
Be conservative with confidence: prefer "low" + "unsorted" over hallucinating a category.`;

@Injectable()
export class ClassifyService {
  constructor(@Inject(ANTHROPIC_CLIENT) private readonly client: Anthropic) {}

  async classifyDocument(text: string, originalFilename: string): Promise<ClassifyResult> {
    const truncated = text.slice(0, MAX_TEXT_CHARS);
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: TOOL_NAME,
          description: 'Record the classification of the provided document.',
          input_schema: {
            type: 'object',
            properties: {
              category: { type: 'string', enum: [...CATEGORIES] },
              date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              provider: { type: 'string' },
              summary: { type: 'string', maxLength: 200 },
              filename: { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
            required: ['category', 'date', 'provider', 'summary', 'filename', 'confidence'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [
        {
          role: 'user',
          content: `Original filename: ${originalFilename}\n\nExtracted PDF text:\n\n${truncated}`,
        },
      ],
    });

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('Claude did not return a tool_use block');
    }
    return toolUse.input as ClassifyResult;
  }
}
