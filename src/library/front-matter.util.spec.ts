import { buildTranscriptContent } from './transcript.util';
import { parseFrontMatter } from './front-matter.util';

describe('parseFrontMatter', () => {
  it('parses a basic block and returns the body', () => {
    const { frontMatter, body } = parseFrontMatter(
      '---\ncategory: utilities\ndate: 2024-09-01\n---\n\n# Title\n\nbody text\n',
    );
    expect(frontMatter).toEqual({ category: 'utilities', date: '2024-09-01' });
    expect(body).toContain('# Title');
    expect(body).toContain('body text');
  });

  it('round-trips with buildTranscriptContent', () => {
    const built = buildTranscriptContent(
      {
        original_filename: 'bill.pdf',
        category: 'utilities',
        date: '2024-09-01',
        due_date: '2024-10-15',
        provider: 'Vattenfall',
        summary: 'Electricity bill: September 2024',
        confidence: 'high',
      },
      'Vattenfall — Electricity',
      'Full text here.',
    );
    const { frontMatter, body } = parseFrontMatter(built);
    expect(frontMatter.category).toBe('utilities');
    expect(frontMatter.due_date).toBe('2024-10-15');
    expect(frontMatter.summary).toBe('Electricity bill: September 2024');
    expect(body).toContain('Full text here.');
  });

  it('handles empty string scalars', () => {
    const { frontMatter } = parseFrontMatter('---\ndue_date: ""\nprovider: ""\n---\n');
    expect(frontMatter.due_date).toBe('');
    expect(frontMatter.provider).toBe('');
  });

  it('returns empty front-matter and full content when block is missing', () => {
    const result = parseFrontMatter('no front matter here\njust body');
    expect(result.frontMatter).toEqual({});
    expect(result.body).toBe('no front matter here\njust body');
  });
});
