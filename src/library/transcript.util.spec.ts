import { buildTranscriptContent } from './transcript.util';

describe('buildTranscriptContent', () => {
  it('produces valid YAML front-matter followed by title and body', () => {
    const result = buildTranscriptContent(
      { category: 'utilities', date: '2024-09-01', provider: 'Vattenfall' },
      'Electricity Bill – September 2024',
      'Bill amount: €87.50. Due date: 2024-10-15.',
    );

    expect(result).toMatch(/^---\n/);
    expect(result).toContain('category: utilities');
    expect(result).toContain('date: 2024-09-01');
    expect(result).toContain('provider: Vattenfall');
    expect(result).toContain('---');
    expect(result).toContain('# Electricity Bill – September 2024');
    expect(result).toContain('Bill amount: €87.50');
  });

  it('handles empty front-matter', () => {
    const result = buildTranscriptContent({}, 'Untitled', 'some body text');
    expect(result).toContain('# Untitled');
    expect(result).toContain('some body text');
  });
});
