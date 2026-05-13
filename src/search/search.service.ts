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

export interface CategoryCount {
  category: string;
  count: number;
}

export interface ProviderCount {
  provider: string;
  count: number;
  last_seen: string;
}

export interface UpcomingDueDate {
  due_date: string;
  path: string;
  provider: string;
  category: string;
}

export interface LibraryStats {
  total_documents: number;
  by_category: Record<string, number>;
  by_year: Record<string, number>;
  upcoming_due_dates: UpcomingDueDate[];
}

const UPCOMING_DUE_LIMIT = 5;

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

  async listCategories(): Promise<CategoryCount[]> {
    const counts = new Map<string, number>();
    for await (const { frontMatter } of this.iterTranscripts()) {
      const category = frontMatter.category;
      if (!category) continue;
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  }

  async listProviders(): Promise<ProviderCount[]> {
    const byProvider = new Map<string, { count: number; last_seen: string }>();
    for await (const { frontMatter } of this.iterTranscripts()) {
      const provider = frontMatter.provider?.trim();
      if (!provider) continue;
      const date = frontMatter.date ?? '';
      const existing = byProvider.get(provider);
      if (existing) {
        existing.count++;
        if (date > existing.last_seen) existing.last_seen = date;
      } else {
        byProvider.set(provider, { count: 1, last_seen: date });
      }
    }
    return [...byProvider.entries()]
      .map(([provider, { count, last_seen }]) => ({ provider, count, last_seen }))
      .sort((a, b) => b.count - a.count || a.provider.localeCompare(b.provider));
  }

  async getStats(): Promise<LibraryStats> {
    const today = new Date().toISOString().slice(0, 10);
    const stats: LibraryStats = {
      total_documents: 0,
      by_category: {},
      by_year: {},
      upcoming_due_dates: [],
    };
    const upcoming: UpcomingDueDate[] = [];

    for await (const { path, frontMatter } of this.iterTranscripts()) {
      stats.total_documents++;

      const category = frontMatter.category;
      if (category) {
        stats.by_category[category] = (stats.by_category[category] ?? 0) + 1;
      }

      const date = frontMatter.date ?? '';
      const year = date.slice(0, 4);
      if (/^\d{4}$/.test(year)) {
        stats.by_year[year] = (stats.by_year[year] ?? 0) + 1;
      }

      const dueDate = frontMatter.due_date?.trim();
      if (dueDate && dueDate >= today) {
        upcoming.push({
          due_date: dueDate,
          path,
          provider: frontMatter.provider ?? '',
          category: frontMatter.category ?? '',
        });
      }
    }

    stats.upcoming_due_dates = upcoming
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, UPCOMING_DUE_LIMIT);

    return stats;
  }

  private async *iterTranscripts(): AsyncIterable<{
    path: string;
    frontMatter: Record<string, string>;
  }> {
    const paths = await this.library.listTranscripts(this.libraryPath());
    for (const path of paths) {
      let raw: string;
      try {
        raw = await readFile(path, 'utf8');
      } catch {
        continue;
      }
      const { frontMatter } = parseFrontMatter(raw);
      yield { path, frontMatter };
    }
  }

  libraryPath(): string {
    const raw = this.config.get<string>('LIBRARY_PATH') ?? './library';
    return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
  }

  static isCategory(value: string): value is Category {
    return (CATEGORIES as readonly string[]).includes(value);
  }
}
