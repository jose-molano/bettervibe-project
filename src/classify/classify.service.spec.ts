import { ClassifyService } from './classify.service';
import type Anthropic from '@anthropic-ai/sdk';

function makeClient(create: jest.Mock): Anthropic {
  return { messages: { create } } as unknown as Anthropic;
}

describe('ClassifyService', () => {
  it('maps a tool_use response into a ClassifyResult', async () => {
    const create = jest.fn().mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'classify_document',
          input: {
            category: 'utilities',
            date: '2024-09-01',
            due_date: '2024-10-15',
            provider: 'Vattenfall',
            summary: 'Electricity bill Sept 2024',
            filename: 'electricity-bill',
            confidence: 'high',
          },
        },
      ],
    });
    const service = new ClassifyService(makeClient(create));

    const result = await service.classifyDocument('Vattenfall bill...', 'invoice.pdf');

    expect(result).toEqual({
      category: 'utilities',
      date: '2024-09-01',
      due_date: '2024-10-15',
      provider: 'Vattenfall',
      summary: 'Electricity bill Sept 2024',
      filename: 'electricity-bill',
      confidence: 'high',
    });
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0][0];
    expect(args.model).toBe('claude-sonnet-4-6');
    expect(args.tool_choice).toEqual({ type: 'tool', name: 'classify_document' });
  });

  it('throws when Claude response has no tool_use block', async () => {
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'I cannot classify this.' }],
    });
    const service = new ClassifyService(makeClient(create));

    await expect(service.classifyDocument('text', 'a.pdf')).rejects.toThrow(/tool_use/);
  });

  it('truncates very long input text before sending', async () => {
    const create = jest.fn().mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'classify_document',
          input: {
            category: 'unsorted',
            date: '2024-01-01',
            due_date: '',
            provider: '',
            summary: 'x',
            filename: 'x',
            confidence: 'low',
          },
        },
      ],
    });
    const service = new ClassifyService(makeClient(create));
    const huge = 'a'.repeat(50_000);

    await service.classifyDocument(huge, 'big.pdf');

    const userMsg = create.mock.calls[0][0].messages[0].content as string;
    expect(userMsg.length).toBeLessThan(huge.length);
    expect(userMsg).toContain('big.pdf');
  });
});
