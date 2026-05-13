export interface ParsedFrontMatter {
  frontMatter: Record<string, string>;
  body: string;
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontMatter(content: string): ParsedFrontMatter {
  const match = content.match(FM_RE);
  if (!match) return { frontMatter: {}, body: content };

  const [, raw, body] = match;
  const frontMatter: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = parseScalar(line.slice(idx + 1).trim());
    frontMatter[key] = value;
  }
  return { frontMatter, body };
}

function parseScalar(raw: string): string {
  if (raw === '""' || raw === "''") return '';
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return raw;
}
