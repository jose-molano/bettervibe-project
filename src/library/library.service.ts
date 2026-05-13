import { Injectable } from '@nestjs/common';
import { copyFile, mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';

@Injectable()
export class LibraryService {
  async movePdf(sourcePath: string, destPath: string): Promise<string> {
    await mkdir(dirname(destPath), { recursive: true });
    const finalPath = await this.resolveCollision(destPath);
    await copyFile(sourcePath, finalPath);
    return finalPath;
  }

  async writeTranscript(destPath: string, content: string): Promise<string> {
    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, content, 'utf8');
    return destPath;
  }

  async archiveOriginal(sourcePath: string, doneDir: string): Promise<string> {
    await mkdir(doneDir, { recursive: true });
    const basename = sourcePath.split('/').pop() as string;
    const dest = join(doneDir, basename);
    const finalPath = await this.resolveCollision(dest);
    await rename(sourcePath, finalPath);
    return finalPath;
  }

  // M3: implement when adding `ask` command.
  async listTranscripts(_libraryPath: string): Promise<string[]> {
    throw new Error('listTranscripts is not implemented yet (M3)');
  }

  private async resolveCollision(path: string): Promise<string> {
    if (!(await this.exists(path))) return path;
    const ext = extname(path);
    const base = path.slice(0, -ext.length);
    for (let i = 2; i < 1000; i++) {
      const candidate = `${base}-${i}${ext}`;
      if (!(await this.exists(candidate))) return candidate;
    }
    throw new Error(`Too many filename collisions for ${path}`);
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }
}
