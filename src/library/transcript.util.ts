export function buildTranscriptContent(
  frontMatter: Record<string, string>,
  title: string,
  body: string,
): string {
  const fm = Object.entries(frontMatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return `---\n${fm}\n---\n\n# ${title}\n\n${body}`;
}
