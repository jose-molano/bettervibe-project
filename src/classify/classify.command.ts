import { ConfigService } from '@nestjs/config';
import { readdir } from 'node:fs/promises';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { Command, CommandRunner } from 'nest-commander';
import { ExtractService } from '../extract/extract.service';
import { LibraryService } from '../library/library.service';
import { buildTranscriptContent } from '../library/transcript.util';
import { LogService } from '../log/log.service';
import { ClassifyService } from './classify.service';

const MIN_TEXT_CHARS = 100;

@Command({
  name: 'classify',
  description: 'Classify PDFs from the inbox folder and move them into the library',
  arguments: '[inbox-path]',
  argsDescription: { 'inbox-path': 'Path to inbox folder (default: $INBOX_PATH or ./inbox)' },
})
export class ClassifyCommand extends CommandRunner {
  constructor(
    private readonly config: ConfigService,
    private readonly extract: ExtractService,
    private readonly classify: ClassifyService,
    private readonly library: LibraryService,
    private readonly log: LogService,
  ) {
    super();
  }

  async run(passedParams: string[]): Promise<void> {
    const inboxArg = passedParams[0];
    const inboxPath = resolveAgainstCwd(
      inboxArg ?? this.config.get<string>('INBOX_PATH') ?? './inbox',
    );
    const libraryPath = resolveAgainstCwd(this.config.get<string>('LIBRARY_PATH') ?? './library');
    const doneDir = join(inboxPath, 'done');

    const pdfs = await this.listPdfs(inboxPath);
    if (pdfs.length === 0) {
      console.log(`No PDFs found in ${inboxPath}`);
      return;
    }

    let processed = 0;
    let skipped = 0;
    let errored = 0;
    let uncertain = 0;

    for (const file of pdfs) {
      await this.log.event(libraryPath, { event: 'start', file });
      try {
        const text = await this.extract.extractText(file);
        if (text.trim().length < MIN_TEXT_CHARS) {
          await this.log.event(libraryPath, {
            event: 'skipped',
            file,
            reason: 'no-text (likely scanned/image PDF — OCR not supported)',
          });
          skipped++;
          continue;
        }

        const result = await this.classify.classifyDocument(text, basename(file));
        const isUncertain = result.confidence === 'low' || result.category === 'unsorted';

        let year: string;
        let category: string;
        let stem: string;

        if (isUncertain) {
          const today = new Date().toISOString().slice(0, 10);
          year = today.slice(0, 4);
          category = 'unsorted';
          stem = `${today}-${slug(basename(file, '.pdf'))}`;
        } else {
          year = result.date.slice(0, 4);
          category = result.category;
          stem = `${result.date.slice(0, 7)}-${result.filename}`;
        }

        const destPdf = join(libraryPath, year, category, `${stem}.pdf`);
        const finalPdf = await this.library.movePdf(file, destPdf);
        const finalMd = finalPdf.replace(/\.pdf$/, '.md');

        const transcript = buildTranscriptContent(
          {
            original_filename: basename(file),
            category,
            date: result.date,
            due_date: result.due_date,
            provider: result.provider,
            summary: result.summary,
            confidence: result.confidence,
            classified_at: new Date().toISOString(),
          },
          deriveTitle(result, basename(file)),
          text,
        );
        await this.library.writeTranscript(finalMd, transcript);
        await this.library.archiveOriginal(file, doneDir);

        await this.log.event(libraryPath, {
          event: 'processed',
          file,
          destPdf: finalPdf,
          category,
          uncertain: isUncertain,
        });
        processed++;
        if (isUncertain) uncertain++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.log.event(libraryPath, { event: 'error', file, error: message });
        errored++;
      }
    }

    console.log(
      `\nDone. processed: ${processed} (uncertain: ${uncertain}), skipped: ${skipped}, errored: ${errored}`,
    );
  }

  private async listPdfs(inboxPath: string): Promise<string[]> {
    let entries: string[];
    try {
      entries = await readdir(inboxPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Cannot read inbox at ${inboxPath}: ${message}`);
    }
    return entries
      .filter((name) => name.toLowerCase().endsWith('.pdf'))
      .map((name) => join(inboxPath, name))
      .sort();
  }
}

function resolveAgainstCwd(p: string): string {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'document'
  );
}

function deriveTitle(
  result: { provider: string; summary: string; date: string },
  fallback: string,
): string {
  if (result.provider && result.summary) return `${result.provider} — ${result.summary}`;
  if (result.summary) return result.summary;
  if (result.provider) return `${result.provider} (${result.date})`;
  return fallback;
}
