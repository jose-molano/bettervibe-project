import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { CATEGORIES, type Category } from '../classify/categories';
import { LibraryService } from '../library/library.service';
import { parseFrontMatter } from '../library/front-matter.util';

export interface SearchFilters {
  category?: Category;
  provider?: string;
  dateFrom?: string;
  dateTo?: string;
  dueBefore?: string;
  dueAfter?: string;
  text?: string;
  limit?: number;
}

export interface SearchHit {
  path: string;
  frontMatter: Record<string, string>;
  snippet: string;
}

const DEFAULT_LIMIT = 20;
const SNIPPET_BEFORE = 80;
const SNIPPET_AFTER = 220;

@Injectable()
export class SearchService {
  constructor(
    private readonly library: LibraryService,
    private readonly config: ConfigService,
  ) {}

  async searchTranscripts(filters: SearchFilters): Promise<SearchHit[]> {
    const libraryPath = this.libraryPath();
    const paths = await this.library.listTranscripts(libraryPath);
    const limit = filters.limit ?? DEFAULT_LIMIT;
    const hits: SearchHit[] = [];

    const text = filters.text?.toLowerCase().trim();
    const provider = filters.provider?.toLowerCase().trim();

    for (const path of paths) {
      let raw: string;
      try {
        raw = await readFile(path, 'utf8');
      } catch {
        continue;
      }
      const { frontMatter, body } = parseFrontMatter(raw);

      if (filters.category && frontMatter.category !== filters.category) continue;
      if (provider) {
        const fmProvider = (frontMatter.provider ?? '').toLowerCase();
        if (!fmProvider.includes(provider)) continue;
      }
      const date = frontMatter.date ?? '';
      if (filters.dateFrom && date < filters.dateFrom) continue;
      if (filters.dateTo && date > filters.dateTo) continue;
      const dueDate = frontMatter.due_date ?? '';
      if (filters.dueBefore) {
        if (!dueDate || dueDate >= filters.dueBefore) continue;
      }
      if (filters.dueAfter) {
        if (!dueDate || dueDate <= filters.dueAfter) continue;
      }

      let snippet: string;
      if (text) {
        const haystack = `${frontMatter.summary ?? ''}\n${body}`;
        const idx = haystack.toLowerCase().indexOf(text);
        if (idx < 0) continue;
        snippet = haystack
          .slice(Math.max(0, idx - SNIPPET_BEFORE), idx + text.length + SNIPPET_AFTER)
          .replace(/\s+/g, ' ')
          .trim();
      } else {
        snippet = body.slice(0, SNIPPET_AFTER).replace(/\s+/g, ' ').trim();
      }

      hits.push({ path, frontMatter, snippet });
      if (hits.length >= limit) break;
    }

    return hits;
  }

  libraryPath(): string {
    const raw = this.config.get<string>('LIBRARY_PATH') ?? './library';
    return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
  }

  static isCategory(value: string): value is Category {
    return (CATEGORIES as readonly string[]).includes(value);
  }
}
