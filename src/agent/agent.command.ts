import { Command, CommandRunner } from 'nest-commander';

@Command({
  name: 'ask',
  description: 'Ask a question about your document library',
  arguments: '<question>',
  argsDescription: { question: 'The question to answer using your library' },
})
export class AgentCommand extends CommandRunner {
  async run(_passedParam: string[]): Promise<void> {
    throw new Error('Not implemented');
  }
}
