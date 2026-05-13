import { Command, CommandRunner } from 'nest-commander';

@Command({
  name: 'classify',
  description: 'Classify PDFs from the inbox folder',
  arguments: '[inbox-path]',
  argsDescription: { 'inbox-path': 'Path to inbox folder (default: ./inbox)' },
})
export class ClassifyCommand extends CommandRunner {
  async run(_passedParam: string[]): Promise<void> {
    throw new Error('Not implemented');
  }
}
