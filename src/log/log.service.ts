import { Injectable, Logger } from '@nestjs/common';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type LogEvent =
  | { event: 'start'; file: string }
  | { event: 'processed'; file: string; destPdf: string; category: string; uncertain: boolean }
  | { event: 'skipped'; file: string; reason: string }
  | { event: 'error'; file: string; error: string };

@Injectable()
export class LogService {
  private readonly logger = new Logger('paperclaw');

  async event(libraryPath: string, entry: LogEvent): Promise<void> {
    const line = { ts: new Date().toISOString(), ...entry };
    const serialized = JSON.stringify(line);

    switch (entry.event) {
      case 'error':
        this.logger.error(this.humanize(entry));
        break;
      case 'skipped':
        this.logger.warn(this.humanize(entry));
        break;
      default:
        this.logger.log(this.humanize(entry));
    }

    const logPath = join(libraryPath, 'processing.log');
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, serialized + '\n', 'utf8');
  }

  private humanize(entry: LogEvent): string {
    switch (entry.event) {
      case 'start':
        return `→ ${entry.file}`;
      case 'processed':
        return `✓ ${entry.file} → ${entry.destPdf}${entry.uncertain ? ' (uncertain)' : ''}`;
      case 'skipped':
        return `⊘ ${entry.file} (${entry.reason})`;
      case 'error':
        return `✗ ${entry.file}: ${entry.error}`;
    }
  }
}
