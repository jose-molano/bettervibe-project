import { Command, CommandRunner } from 'nest-commander';
import { AgentService } from './agent.service';

@Command({
  name: 'ask',
  description: 'Ask a question about your document library',
  arguments: '<question>',
  argsDescription: { question: 'The question to answer using your library' },
})
export class AgentCommand extends CommandRunner {
  constructor(private readonly agent: AgentService) {
    super();
  }

  async run(passedParams: string[]): Promise<void> {
    const question = passedParams.join(' ').trim();
    if (!question) {
      console.error('Usage: paperclaw ask "<question>"');
      process.exitCode = 1;
      return;
    }
    await this.agent.ask(question);
  }
}
