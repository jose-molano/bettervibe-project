export function buildTranscriptContent(
  frontMatter: Record<string, string>,
  title: string,
  body: string,
): string {
  const fm = Object.entries(frontMatter)
    .map(([k, v]) => `${k}: ${yamlScalar(v)}`)
    .join('\n');
  return `---\n${fm}\n---\n\n# ${title}\n\n${body}`;
}

function yamlScalar(value: string): string {
  if (value === '') return '""';
  if (/[:#\n"'\[\]{}&*!|>%@`,]/.test(value) || /^\s|\s$/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return value;
}
